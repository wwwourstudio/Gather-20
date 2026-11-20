export type SoundboardPadId =
  | 'intro'
  | 'whoosh'
  | 'applause'
  | 'order'
  | 'hype'
  | 'drumroll'
  | 'alert';

export interface CustomStingerItem {
  id: string;
  name: string;
  durationSec: number;
  loop: boolean;
  sourceKind: 'upload' | 'mic' | 'ai-voice' | 'ai-music';
}

interface StoredCustomStinger extends CustomStingerItem {
  buffer: AudioBuffer;
}

interface ChannelNodes {
  source: AudioNode | null;
  highpass: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  gain: GainNode;
  duckGain?: GainNode;
  analyser: AnalyserNode;
  monitorGain: GainNode;
  streamId: string;
}

interface ActivePlaybackHandle {
  id: string;
  envelopeGain: GainNode;
  stop: () => void;
  timerId?: number;
}

export interface ChannelLevelTelemetry {
  peak: number;
  rms: number;
  peakHold: number;
  clipped: boolean;
  history: number[];
  rmsHistory: number[];
}

export interface MasterBeatTelemetry {
  bpm: number;
  confidence: number; // 0..1
  beatIndex: 1 | 2 | 3 | 4; // 1 === downbeat
  beatProgress: number; // 0..1 within single beat
  barProgress: number; // 0..1 within 4/4 measure
  msUntilDownbeat: number;
  signalDetected: boolean;
  lastBeatAt: number;
  lastDownbeatAt: number;
  masterEnergy: number;
}

export interface AutoDuckerConfig {
  enabled: boolean;
  reductionDb: number;
  threshold: number;
  releaseMs: number;
}

export interface AutoDuckerTelemetry {
  enabled: boolean;
  ducking: boolean;
  triggerChannelId: string | null;
  currentDuckGain: number;
  reductionDb: number;
  speechEnergy: number;
}

const HISTORY_CAPACITY = 64;
const BEAT_ENERGY_WINDOW = 45;
const AUTO_DUCKER_STORAGE_KEY = 'gather:auto-ducker';

const DEFAULT_AUTO_DUCKER_CONFIG: AutoDuckerConfig = {
  enabled: true,
  reductionDb: -12,
  threshold: 0.08,
  releaseMs: 460,
};

class GatherAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterMonitorBus: GainNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private channels = new Map<string, ChannelNodes>();
  private mediaElementSources = new Map<HTMLMediaElement, MediaElementAudioSourceNode>();

  // Rolling peak/RMS audio-level history backed by Web Audio AnalyserNode
  private historyBuffers = new Map<string, { peaks: number[]; rms: number[]; peakHold: number; lastSampleAt: number }>();
  private analyserScratch = new Uint8Array(256);
  private historySamplerTimer: number | null = null;

  // Real-time Master Bus Beat & Downbeat Tempo Estimator
  private beatFreqScratch = new Uint8Array(128);
  private beatPrevFreqScratch = new Uint8Array(128);
  private beatEnergyWindow: number[] = [];
  private beatOnsets: number[] = [];
  private detectedBpm = 120;
  private beatConfidence = 0;
  private beatCounter = 0;
  private lastBeatAt = 0;
  private lastDownbeatAt = 0;
  private beatClockAnchor = typeof performance !== 'undefined' ? performance.now() : Date.now();
  private lastMasterEnergy = 0;

  // Custom Stingers & Active Playback Tracking
  private customStingers = new Map<string, StoredCustomStinger>();
  private activeHandles = new Map<string, ActivePlaybackHandle>();
  private listeners = new Set<() => void>();
  private sfxTargetGain = 1.0;
  private sfxMuted = false;

  // Sidechain Auto-Ducker (lowers 'media-deck' gain when 'local-mic' or 'peer-*' speaks)
  private channelMuted = new Map<string, boolean>();
  private autoDuckerConfig: AutoDuckerConfig = (() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(AUTO_DUCKER_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<AutoDuckerConfig>;
          return {
            enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
            reductionDb:
              typeof parsed.reductionDb === 'number'
                ? Math.max(-24, Math.min(-3, parsed.reductionDb))
                : -12,
            threshold:
              typeof parsed.threshold === 'number'
                ? Math.max(0.03, Math.min(0.35, parsed.threshold))
                : 0.08,
            releaseMs:
              typeof parsed.releaseMs === 'number'
                ? Math.max(200, Math.min(1400, parsed.releaseMs))
                : 460,
          };
        }
      }
    } catch {
      // ignore storage errors
    }
    return { ...DEFAULT_AUTO_DUCKER_CONFIG };
  })();
  private lastSpeechAt = 0;
  private isDuckingActive = false;
  private duckTriggerChannelId: string | null = null;
  private currentDuckGainValue = 1.0;
  private lastSpeechEnergy = 0;

  private emit(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch {
        // ignore listener error
      }
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1.0;

      // Local monitor output scales synchronously with Master Bus gain
      this.masterMonitorBus = this.ctx.createGain();
      this.masterMonitorBus.gain.value = 1.0;
      this.masterMonitorBus.connect(this.ctx.destination);

      this.masterAnalyser = this.ctx.createAnalyser();
      this.masterAnalyser.fftSize = 256;

      this.destination = this.ctx.createMediaStreamDestination();
      this.masterGain.connect(this.masterAnalyser);
      this.masterAnalyser.connect(this.destination);

      // Initialize dedicated Stingers & Audio FX bus ('stinger-fx') routed to Master Bus + Monitor Bus
      const sfxHighpass = this.ctx.createBiquadFilter();
      sfxHighpass.type = 'highpass';
      sfxHighpass.frequency.value = 35;

      const sfxCompressor = this.ctx.createDynamicsCompressor();
      sfxCompressor.threshold.value = -16;
      sfxCompressor.knee.value = 14;
      sfxCompressor.ratio.value = 3;
      sfxCompressor.attack.value = 0.004;
      sfxCompressor.release.value = 0.18;

      const sfxGain = this.ctx.createGain();
      sfxGain.gain.value = this.sfxMuted ? 0 : this.sfxTargetGain;

      const sfxAnalyser = this.ctx.createAnalyser();
      sfxAnalyser.fftSize = 128;

      const sfxMonitorGain = this.ctx.createGain();
      sfxMonitorGain.gain.value = 1.0;

      sfxHighpass.connect(sfxCompressor);
      sfxCompressor.connect(sfxGain);
      sfxGain.connect(sfxAnalyser);
      sfxAnalyser.connect(this.masterGain);
      sfxAnalyser.connect(sfxMonitorGain);
      sfxMonitorGain.connect(this.masterMonitorBus);

      this.channels.set('stinger-fx', {
        source: null,
        highpass: sfxHighpass,
        compressor: sfxCompressor,
        gain: sfxGain,
        analyser: sfxAnalyser,
        monitorGain: sfxMonitorGain,
        streamId: 'stinger-fx-bus',
      });
      this.ensureHistorySampler();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private ensureHistorySampler(): void {
    if (this.historySamplerTimer !== null || typeof window === 'undefined') return;
    this.historySamplerTimer = window.setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      this.evaluateAutoDucker();
      this.readAndPushSample('master', false);
      for (const chId of this.channels.keys()) {
        this.readAndPushSample(chId, Boolean(this.channelMuted.get(chId)));
      }
    }, 48);
  }

  private evaluateAutoDucker(): void {
    const mediaCh = this.channels.get('media-deck');
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

    if (!this.autoDuckerConfig.enabled) {
      this.lastSpeechEnergy = 0;
      const wasDucking = this.isDuckingActive;
      this.isDuckingActive = false;
      this.duckTriggerChannelId = null;
      this.currentDuckGainValue += (1.0 - this.currentDuckGainValue) * 0.35;
      if (Math.abs(1.0 - this.currentDuckGainValue) < 0.005) this.currentDuckGainValue = 1.0;
      if (mediaCh?.duckGain && this.ctx) {
        mediaCh.duckGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.04);
      }
      if (wasDucking) this.emit();
      return;
    }

    let maxEnergy = 0;
    let loudestId: string | null = null;

    for (const chId of this.channels.keys()) {
      if (chId !== 'local-mic' && !chId.startsWith('peer-')) continue;
      if (this.channelMuted.get(chId)) continue;
      const { peak, rms } = this.readAnalyserPeakAndRms(chId);
      const speechEnergy = Math.max(rms * 1.15, peak * 0.72);
      if (speechEnergy > maxEnergy) {
        maxEnergy = speechEnergy;
        loudestId = chId;
      }
    }

    this.lastSpeechEnergy = maxEnergy;
    if (maxEnergy >= this.autoDuckerConfig.threshold && loudestId) {
      this.lastSpeechAt = now;
      this.duckTriggerChannelId = loudestId;
    }

    const holdRemaining =
      this.lastSpeechAt > 0 && now - this.lastSpeechAt < this.autoDuckerConfig.releaseMs;
    const prevDucking = this.isDuckingActive;
    this.isDuckingActive = holdRemaining;

    const targetGain = holdRemaining
      ? Math.pow(10, this.autoDuckerConfig.reductionDb / 20)
      : 1.0;

    if (!holdRemaining && this.currentDuckGainValue > 0.96) {
      this.duckTriggerChannelId = null;
    }

    // Smooth visual/telemetry mirror matching Web Audio exponential attack/release
    const lerpRate = holdRemaining ? 0.42 : 0.14;
    this.currentDuckGainValue += (targetGain - this.currentDuckGainValue) * lerpRate;
    if (!holdRemaining && Math.abs(1.0 - this.currentDuckGainValue) < 0.004) {
      this.currentDuckGainValue = 1.0;
    }

    if (mediaCh?.duckGain && this.ctx) {
      const timeConstant = holdRemaining
        ? 0.045
        : Math.max(0.14, this.autoDuckerConfig.releaseMs / 2400);
      mediaCh.duckGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, timeConstant);
    }

    if (prevDucking !== this.isDuckingActive) {
      this.emit();
    }
  }

  private getSfxInputNode(): AudioNode {
    const ctx = this.ensureContext();
    const sfxCh = this.channels.get('stinger-fx');
    return sfxCh ? sfxCh.highpass : this.masterGain ?? ctx.destination;
  }

  getMasterStream(): MediaStream | null {
    this.ensureContext();
    return this.destination?.stream ?? null;
  }

  attachStream(channelId: string, stream: MediaStream, monitor = false): void {
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    const ctx = this.ensureContext();
    const existing = this.channels.get(channelId);
    const trackId = audioTracks[0].id;
    if (existing && existing.streamId === trackId) {
      return;
    }
    if (existing) {
      this.detachChannel(channelId);
    }

    const audioOnlyStream = new MediaStream([audioTracks[0]]);
    const source = ctx.createMediaStreamSource(audioOnlyStream);

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 85;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.2;

    const gain = ctx.createGain();
    gain.gain.value = 1.0;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;

    const monitorGain = ctx.createGain();
    monitorGain.gain.value = monitor ? 1.0 : 0.0;

    source.connect(highpass);
    highpass.connect(compressor);
    compressor.connect(gain);
    gain.connect(analyser);

    if (this.masterGain) {
      analyser.connect(this.masterGain);
    }
    analyser.connect(monitorGain);
    monitorGain.connect(this.masterMonitorBus ?? ctx.destination);

    this.channels.set(channelId, {
      source,
      highpass,
      compressor,
      gain,
      analyser,
      monitorGain,
      streamId: trackId,
    });
  }

  attachMediaElement(channelId: string, el: HTMLVideoElement): void {
    const ctx = this.ensureContext();
    let src = this.mediaElementSources.get(el);
    if (!src) {
      try {
        src = ctx.createMediaElementSource(el);
        this.mediaElementSources.set(el, src);
      } catch {
        return;
      }
    }
    const existing = this.channels.get(channelId);
    if (existing && existing.source === src) return;
    if (existing) {
      this.detachChannel(channelId);
    }

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'allpass';
    const compressor = ctx.createDynamicsCompressor();
    const gain = ctx.createGain();
    gain.gain.value = 0.85;
    const duckGain = ctx.createGain();
    duckGain.gain.value = this.isDuckingActive && this.autoDuckerConfig.enabled
      ? Math.pow(10, this.autoDuckerConfig.reductionDb / 20)
      : 1.0;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    const monitorGain = ctx.createGain();
    monitorGain.gain.value = 1.0;

    src.connect(gain);
    gain.connect(duckGain);
    duckGain.connect(analyser);
    if (this.masterGain) analyser.connect(this.masterGain);
    analyser.connect(monitorGain);
    monitorGain.connect(this.masterMonitorBus ?? ctx.destination);

    this.channels.set(channelId, {
      source: src,
      highpass,
      compressor,
      gain,
      duckGain,
      analyser,
      monitorGain,
      streamId: 'media-el',
    });
  }

  detachChannel(channelId: string): void {
    if (channelId === 'stinger-fx') return;
    const ch = this.channels.get(channelId);
    if (!ch) return;
    try {
      ch.source?.disconnect();
      ch.highpass.disconnect();
      ch.compressor.disconnect();
      ch.gain.disconnect();
      ch.duckGain?.disconnect();
      ch.analyser.disconnect();
      ch.monitorGain.disconnect();
    } catch {
      // ignore disconnect errors
    }
    this.channels.delete(channelId);
  }

  setChannelParams(
    channelId: string,
    opts: { gain?: number; muted?: boolean; monitor?: boolean; clarityEq?: boolean }
  ): void {
    if (typeof opts.muted === 'boolean') {
      this.channelMuted.set(channelId, opts.muted);
    }
    this.ensureContext();
    const ch = this.channels.get(channelId);
    if (!ch || !this.ctx) return;
    if (channelId === 'stinger-fx') {
      if (typeof opts.gain === 'number') this.sfxTargetGain = opts.gain;
      if (typeof opts.muted === 'boolean') this.sfxMuted = opts.muted;
    }
    if (typeof opts.gain === 'number' || typeof opts.muted === 'boolean') {
      const target = opts.muted ? 0 : (opts.gain ?? 1);
      ch.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
    }
    if (typeof opts.monitor === 'boolean') {
      ch.monitorGain.gain.setTargetAtTime(opts.monitor ? 1 : 0, this.ctx.currentTime, 0.02);
    }
    if (typeof opts.clarityEq === 'boolean' && channelId !== 'stinger-fx') {
      ch.highpass.frequency.setTargetAtTime(opts.clarityEq ? 95 : 20, this.ctx.currentTime, 0.02);
      ch.compressor.ratio.setTargetAtTime(opts.clarityEq ? 4.5 : 1, this.ctx.currentTime, 0.02);
    }
    this.emit();
  }

  getAutoDuckerConfig(): AutoDuckerConfig {
    return { ...this.autoDuckerConfig };
  }

  setAutoDuckerConfig(patch: Partial<AutoDuckerConfig>): AutoDuckerConfig {
    const next: AutoDuckerConfig = {
      enabled:
        typeof patch.enabled === 'boolean' ? patch.enabled : this.autoDuckerConfig.enabled,
      reductionDb:
        typeof patch.reductionDb === 'number'
          ? Math.max(-24, Math.min(-3, Math.round(patch.reductionDb)))
          : this.autoDuckerConfig.reductionDb,
      threshold:
        typeof patch.threshold === 'number'
          ? Math.max(0.03, Math.min(0.35, Number(patch.threshold.toFixed(3))))
          : this.autoDuckerConfig.threshold,
      releaseMs:
        typeof patch.releaseMs === 'number'
          ? Math.max(200, Math.min(1400, Math.round(patch.releaseMs)))
          : this.autoDuckerConfig.releaseMs,
    };
    this.autoDuckerConfig = next;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(AUTO_DUCKER_STORAGE_KEY, JSON.stringify(next));
      }
    } catch {
      // ignore
    }
    if (!next.enabled) {
      this.isDuckingActive = false;
      this.duckTriggerChannelId = null;
      this.currentDuckGainValue = 1.0;
      const mediaCh = this.channels.get('media-deck');
      if (mediaCh?.duckGain && this.ctx) {
        mediaCh.duckGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.04);
      }
    }
    this.emit();
    return { ...next };
  }

  getAutoDuckerTelemetry(): AutoDuckerTelemetry {
    const safeGain = Math.max(0.05, Math.min(1, this.currentDuckGainValue));
    const reductionDb =
      safeGain >= 0.995 ? 0 : Math.round(20 * Math.log10(safeGain) * 10) / 10;
    return {
      enabled: this.autoDuckerConfig.enabled,
      ducking: this.isDuckingActive && this.autoDuckerConfig.enabled,
      triggerChannelId: this.duckTriggerChannelId,
      currentDuckGain: safeGain,
      reductionDb,
      speechEnergy: this.lastSpeechEnergy,
    };
  }

  setMasterGain(value: number): void {
    this.ensureContext();
    if (!this.ctx) return;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.02);
    }
    if (this.masterMonitorBus) {
      this.masterMonitorBus.gain.setTargetAtTime(value, this.ctx.currentTime, 0.02);
    }
    this.emit();
  }

  private getOrCreateHistoryEntry(channelId: string) {
    let entry = this.historyBuffers.get(channelId);
    if (!entry) {
      entry = {
        peaks: new Array<number>(HISTORY_CAPACITY).fill(0),
        rms: new Array<number>(HISTORY_CAPACITY).fill(0),
        peakHold: 0,
        lastSampleAt: 0,
      };
      this.historyBuffers.set(channelId, entry);
    }
    return entry;
  }

  private readAnalyserPeakAndRms(channelId: string): { peak: number; rms: number } {
    if (channelId === 'stinger-fx' && !this.ctx) {
      return { peak: 0, rms: 0 };
    }
    const analyser =
      channelId === 'master' ? this.masterAnalyser : this.channels.get(channelId)?.analyser;
    if (!analyser) return { peak: 0, rms: 0 };

    const binCount = analyser.frequencyBinCount;
    if (this.analyserScratch.length < binCount) {
      this.analyserScratch = new Uint8Array(binCount);
    }
    const buf =
      this.analyserScratch.length === binCount
        ? this.analyserScratch
        : this.analyserScratch.subarray(0, binCount);
    analyser.getByteTimeDomainData(buf);

    let peak = 0;
    let sumSq = 0;
    for (let i = 0; i < binCount; i++) {
      const sample = (buf[i] - 128) / 128;
      const abs = Math.abs(sample);
      if (abs > peak) peak = abs;
      sumSq += sample * sample;
    }
    const rmsRaw = Math.sqrt(sumSq / Math.max(1, binCount));
    return {
      peak: Math.min(1, peak * 1.85),
      rms: Math.min(1, rmsRaw * 2.2),
    };
  }

  private readAndPushSample(channelId: string, muted: boolean, minStepMs = 48): ChannelLevelTelemetry {
    const entry = this.getOrCreateHistoryEntry(channelId);
    const { peak: rawPeak, rms: rawRms } = muted ? { peak: 0, rms: 0 } : this.readAnalyserPeakAndRms(channelId);
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

    if (rawPeak > entry.peakHold) {
      entry.peakHold = rawPeak;
    } else if (now - entry.lastSampleAt >= minStepMs) {
      entry.peakHold = Math.max(0, entry.peakHold * 0.985 - 0.004);
    }

    if (now - entry.lastSampleAt >= minStepMs) {
      entry.lastSampleAt = now;
      entry.peaks.push(rawPeak);
      if (entry.peaks.length > HISTORY_CAPACITY) entry.peaks.shift();
      entry.rms.push(rawRms);
      if (entry.rms.length > HISTORY_CAPACITY) entry.rms.shift();
    } else if (rawPeak > entry.peaks[entry.peaks.length - 1]) {
      entry.peaks[entry.peaks.length - 1] = rawPeak;
      entry.rms[entry.rms.length - 1] = Math.max(entry.rms[entry.rms.length - 1], rawRms);
    }

    return {
      peak: rawPeak,
      rms: rawRms,
      peakHold: entry.peakHold,
      clipped: entry.peakHold >= 0.9 || rawPeak >= 0.9,
      history: entry.peaks,
      rmsHistory: entry.rms,
    };
  }

  getAnalyserNode(channelId: string): AnalyserNode | null {
    if (channelId === 'stinger-fx' && !this.ctx) {
      return null;
    }
    return channelId === 'master'
      ? this.masterAnalyser
      : this.channels.get(channelId)?.analyser ?? null;
  }

  getLevel(channelId: string): number {
    return this.readAnalyserPeakAndRms(channelId).peak;
  }

  sampleChannelTelemetry(channelId: string, muted = false): ChannelLevelTelemetry {
    return this.readAndPushSample(channelId, muted, 42);
  }

  resetPeakHold(channelId?: string): void {
    if (channelId) {
      const entry = this.historyBuffers.get(channelId);
      if (entry) entry.peakHold = 0;
      return;
    }
    for (const entry of this.historyBuffers.values()) {
      entry.peakHold = 0;
    }
  }

  resetBeatTracker(): void {
    this.beatEnergyWindow = [];
    this.beatOnsets = [];
    this.detectedBpm = 120;
    this.beatConfidence = 0;
    this.beatCounter = 0;
    this.lastBeatAt = 0;
    this.lastDownbeatAt = 0;
    this.beatClockAnchor = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.lastMasterEnergy = 0;
  }

  sampleMasterBeatTelemetry(): MasterBeatTelemetry {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let signalDetected = false;
    let instantEnergy = 0;

    if (this.masterAnalyser && this.ctx && this.ctx.state === 'running') {
      const bins = this.masterAnalyser.frequencyBinCount;
      if (this.beatFreqScratch.length < bins) {
        this.beatFreqScratch = new Uint8Array(bins);
        this.beatPrevFreqScratch = new Uint8Array(bins);
      }
      const freq = this.beatFreqScratch;
      const prev = this.beatPrevFreqScratch;
      this.masterAnalyser.getByteFrequencyData(freq);

      // Weight low kick/bass bins (0..6) heavily alongside mid transient flux (7..24)
      let weightedSum = 0;
      let weightTotal = 0;
      let flux = 0;
      const inspectBins = Math.min(28, bins);
      for (let i = 0; i < inspectBins; i++) {
        const val = freq[i] / 255;
        const prevVal = prev[i] / 255;
        const w = i <= 5 ? 2.4 : i <= 14 ? 1.15 : 0.7;
        weightedSum += val * w;
        weightTotal += w;
        const diff = val - prevVal;
        if (diff > 0) flux += diff * w;
        prev[i] = freq[i];
      }

      instantEnergy = weightTotal > 0 ? weightedSum / weightTotal : 0;
      const normFlux = weightTotal > 0 ? flux / weightTotal : 0;
      this.lastMasterEnergy = instantEnergy;

      this.beatEnergyWindow.push(instantEnergy);
      if (this.beatEnergyWindow.length > BEAT_ENERGY_WINDOW) {
        this.beatEnergyWindow.shift();
      }

      let sum = 0;
      for (let i = 0; i < this.beatEnergyWindow.length; i++) {
        sum += this.beatEnergyWindow[i];
      }
      const avg = sum / Math.max(1, this.beatEnergyWindow.length);
      let varSum = 0;
      for (let i = 0; i < this.beatEnergyWindow.length; i++) {
        const d = this.beatEnergyWindow[i] - avg;
        varSum += d * d;
      }
      const std = Math.sqrt(varSum / Math.max(1, this.beatEnergyWindow.length));

      signalDetected = avg > 0.015 || instantEnergy > 0.03;

      const onsetThreshold = Math.max(0.055, avg * 1.32 + std * 0.72);
      if (
        instantEnergy > onsetThreshold &&
        normFlux > 0.025 &&
        now - this.lastBeatAt >= 260
      ) {
        this.lastBeatAt = now;
        this.beatOnsets.push(now);
        // Keep last 10s of beat onsets
        while (this.beatOnsets.length > 0 && now - this.beatOnsets[0] > 10000) {
          this.beatOnsets.shift();
        }
        if (this.beatOnsets.length > 16) {
          this.beatOnsets.shift();
        }

        if (this.beatOnsets.length >= 3) {
          const ibis: number[] = [];
          for (let i = 1; i < this.beatOnsets.length; i++) {
            let ibi = this.beatOnsets[i] - this.beatOnsets[i - 1];
            if (ibi < 250 || ibi > 2400) continue;
            // Fold double/half time outliers cleanly into 72..172 BPM pocket
            while (ibi < 348) ibi *= 2;
            while (ibi > 833) ibi /= 2;
            ibis.push(ibi);
          }
          if (ibis.length >= 2) {
            ibis.sort((a, b) => a - b);
            const medianIbi = ibis[Math.floor(ibis.length / 2)];
            const rawBpm = Math.max(64, Math.min(176, 60000 / medianIbi));
            this.detectedBpm = Math.round(this.detectedBpm * 0.65 + rawBpm * 0.35);
            this.beatConfidence = Math.min(1, 0.35 + ibis.length * 0.1);
          }
        }

        const isStrongAccent = instantEnergy > avg * 1.62 && now - this.lastDownbeatAt > 1200;
        if (isStrongAccent && (this.beatCounter === 3 || this.beatCounter === 0)) {
          this.beatCounter = 0;
        } else {
          this.beatCounter = (this.beatCounter + 1) % 4;
        }
        if (this.beatCounter === 0 || this.lastDownbeatAt === 0) {
          this.lastDownbeatAt = now;
          this.beatClockAnchor = now;
        }
      }
    }

    if (now - this.lastBeatAt > 5000) {
      this.beatConfidence = Math.max(0, this.beatConfidence - 0.015);
    }

    const beatIntervalMs = 60000 / Math.max(60, this.detectedBpm);
    const barMs = beatIntervalMs * 4;
    const anchor = this.lastDownbeatAt > 0 ? this.lastDownbeatAt : this.beatClockAnchor;
    const rawElapsed = now - anchor;
    const barPosMs = ((rawElapsed % barMs) + barMs) % barMs;
    const beatIndex = ((Math.floor(barPosMs / beatIntervalMs) % 4) + 1) as 1 | 2 | 3 | 4;
    const beatProgress = (barPosMs % beatIntervalMs) / beatIntervalMs;
    const barProgress = barPosMs / barMs;
    const msUntilDownbeat = Math.max(0, barMs - barPosMs);

    return {
      bpm: this.detectedBpm,
      confidence: Number(this.beatConfidence.toFixed(2)),
      beatIndex,
      beatProgress,
      barProgress,
      msUntilDownbeat,
      signalDetected,
      lastBeatAt: this.lastBeatAt,
      lastDownbeatAt: this.lastDownbeatAt,
      masterEnergy: this.lastMasterEnergy,
    };
  }

  getMasterBeatTelemetry(): MasterBeatTelemetry {
    return this.sampleMasterBeatTelemetry();
  }

  getCustomStingers(): CustomStingerItem[] {
    return Array.from(this.customStingers.values()).map(({ buffer: _b, ...item }) => item);
  }

  getActiveIds(): string[] {
    return Array.from(this.activeHandles.keys());
  }

  private registerHandle(id: string, envelopeGain: GainNode, rawStop: () => void, autoClearMs?: number): void {
    const prev = this.activeHandles.get(id);
    if (prev) {
      if (prev.timerId) window.clearTimeout(prev.timerId);
      prev.stop();
    }
    const handle: ActivePlaybackHandle = {
      id,
      envelopeGain,
      stop: () => {
        if (handle.timerId) window.clearTimeout(handle.timerId);
        try {
          rawStop();
        } catch {
          // ignore already stopped
        }
        try {
          envelopeGain.disconnect();
        } catch {
          // ignore
        }
        this.activeHandles.delete(id);
        this.emit();
      },
    };
    if (autoClearMs && autoClearMs > 0) {
      handle.timerId = window.setTimeout(() => {
        if (this.activeHandles.get(id) === handle) {
          this.activeHandles.delete(id);
          try {
            envelopeGain.disconnect();
          } catch {
            // ignore
          }
          this.emit();
        }
      }, autoClearMs);
    }
    this.activeHandles.set(id, handle);
    this.emit();
  }

  async loadCustomAudioFile(file: File): Promise<CustomStingerItem> {
    const cleanName = file.name.replace(/\.[^.]+$/, '').slice(0, 32) || 'Custom Stinger';
    return this.loadCustomAudioBlob(file, cleanName, 'upload');
  }

  async loadCustomAudioBlob(
    blob: Blob,
    name: string,
    sourceKind: 'upload' | 'mic' | 'ai-voice' | 'ai-music' = 'upload',
    loop = false
  ): Promise<CustomStingerItem> {
    const ctx = this.ensureContext();
    const arrayBuf = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
    const cleanName = name.slice(0, 32) || 'Custom Stinger';
    const id = `cst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const stored: StoredCustomStinger = {
      id,
      name: cleanName,
      durationSec: Math.max(0.3, Number(audioBuffer.duration.toFixed(1))),
      loop,
      sourceKind,
      buffer: audioBuffer,
    };
    this.customStingers.set(id, stored);
    this.emit();
    return {
      id: stored.id,
      name: stored.name,
      durationSec: stored.durationSec,
      loop: stored.loop,
      sourceKind: stored.sourceKind,
    };
  }

  async recordMicStinger(
    durationMs = 3000,
    existingStream?: MediaStream | null
  ): Promise<CustomStingerItem> {
    const ctx = this.ensureContext();
    let ownedStream: MediaStream | null = null;
    const activeAudioTrack = existingStream?.getAudioTracks().find((t) => t.readyState === 'live');
    const recStream = activeAudioTrack
      ? new MediaStream([activeAudioTrack])
      : ((ownedStream = await navigator.mediaDevices.getUserMedia({ audio: true })), ownedStream);

    return new Promise<CustomStingerItem>((resolve, reject) => {
      try {
        const chunks: Blob[] = [];
        const rec = new MediaRecorder(recStream);
        rec.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunks.push(ev.data);
        };
        rec.onerror = () => {
          ownedStream?.getTracks().forEach((t) => t.stop());
          reject(new Error('Microphone recording failed.'));
        };
        rec.onstop = async () => {
          ownedStream?.getTracks().forEach((t) => t.stop());
          try {
            const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
            const arrayBuf = await blob.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
            const count =
              Array.from(this.customStingers.values()).filter((s) => s.sourceKind === 'mic')
                .length + 1;
            const id = `mic-${Date.now().toString(36)}`;
            const stored: StoredCustomStinger = {
              id,
              name: `Mic Drop #${count}`,
              durationSec: Math.max(0.4, Number(audioBuffer.duration.toFixed(1))),
              loop: false,
              sourceKind: 'mic',
              buffer: audioBuffer,
            };
            this.customStingers.set(id, stored);
            this.emit();
            resolve({
              id: stored.id,
              name: stored.name,
              durationSec: stored.durationSec,
              loop: stored.loop,
              sourceKind: stored.sourceKind,
            });
          } catch (err) {
            reject(err instanceof Error ? err : new Error('Unable to decode recorded audio.'));
          }
        };
        rec.start(150);
        window.setTimeout(() => {
          if (rec.state !== 'inactive') rec.stop();
        }, durationMs);
      } catch (err) {
        ownedStream?.getTracks().forEach((t) => t.stop());
        reject(err instanceof Error ? err : new Error('MediaRecorder unavailable.'));
      }
    });
  }

  playCustomStinger(id: string): void {
    const existing = this.activeHandles.get(id);
    if (existing) {
      existing.stop();
      return;
    }
    const item = this.customStingers.get(id);
    if (!item) return;

    const ctx = this.ensureContext();
    const sfxIn = this.getSfxInputNode();
    const env = ctx.createGain();
    env.gain.setValueAtTime(1.0, ctx.currentTime);
    env.connect(sfxIn);

    const src = ctx.createBufferSource();
    src.buffer = item.buffer;
    src.loop = item.loop;
    src.connect(env);

    src.onended = () => {
      const curr = this.activeHandles.get(id);
      if (curr) {
        if (curr.timerId) window.clearTimeout(curr.timerId);
        this.activeHandles.delete(id);
        try {
          env.disconnect();
        } catch {
          // ignore
        }
        this.emit();
      }
    };

    src.start(0);
    this.registerHandle(
      id,
      env,
      () => {
        src.onended = null;
        src.stop();
      },
      item.loop ? undefined : Math.ceil(item.buffer.duration * 1000) + 120
    );
  }

  toggleCustomStingerLoop(id: string): void {
    const item = this.customStingers.get(id);
    if (!item) return;
    item.loop = !item.loop;
    this.emit();
  }

  removeCustomStinger(id: string): void {
    const active = this.activeHandles.get(id);
    if (active) active.stop();
    this.customStingers.delete(id);
    this.emit();
  }

  stopAllStingers(): void {
    for (const handle of Array.from(this.activeHandles.values())) {
      handle.stop();
    }
    this.activeHandles.clear();
    this.emit();
  }

  fadeOutAllStingers(durationMs = 900): void {
    if (!this.ctx || this.activeHandles.size === 0) return;
    const now = this.ctx.currentTime;
    const durSec = Math.max(0.15, durationMs / 1000);
    const snapshot = Array.from(this.activeHandles.values());
    for (const handle of snapshot) {
      try {
        handle.envelopeGain.gain.cancelScheduledValues(now);
        handle.envelopeGain.gain.setValueAtTime(
          Math.max(0.001, handle.envelopeGain.gain.value),
          now
        );
        handle.envelopeGain.gain.exponentialRampToValueAtTime(0.0008, now + durSec);
      } catch {
        // ignore
      }
    }
    window.setTimeout(() => {
      for (const handle of snapshot) {
        if (this.activeHandles.get(handle.id) === handle) {
          handle.stop();
        }
      }
    }, durationMs + 40);
  }

  playStinger(pad: SoundboardPadId): void {
    const handleKey = `pad:${pad}`;
    const already = this.activeHandles.get(handleKey);
    if (already) {
      already.stop();
      return;
    }

    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const sfxIn = this.getSfxInputNode();
    const env = ctx.createGain();
    env.gain.setValueAtTime(1.0, now);
    env.connect(sfxIn);

    const stopCallbacks: Array<() => void> = [];
    const stopAllNodes = () => {
      stopCallbacks.forEach((fn) => {
        try {
          fn();
        } catch {
          // ignore
        }
      });
    };

    if (pad === 'order') {
      [880, 1318.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);
        g.gain.setValueAtTime(0.001, now + idx * 0.09);
        g.gain.exponentialRampToValueAtTime(0.24, now + idx * 0.09 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.55);
        osc.connect(g);
        g.connect(env);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.6);
        stopCallbacks.push(() => osc.stop());
      });
      this.registerHandle(handleKey, env, stopAllNodes, 720);
      return;
    }

    if (pad === 'intro') {
      [220, 277.18, 329.63, 440, 554.37].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);
        g.gain.setValueAtTime(0.001, now + idx * 0.04);
        g.gain.exponentialRampToValueAtTime(0.09, now + idx * 0.04 + 0.16);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.35);
        osc.connect(g);
        g.connect(env);
        osc.start(now + idx * 0.04);
        osc.stop(now + 1.4);
        stopCallbacks.push(() => osc.stop());
      });
      this.registerHandle(handleKey, env, stopAllNodes, 1450);
      return;
    }

    if (pad === 'whoosh') {
      const bufferSize = Math.floor(ctx.sampleRate * 0.5);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.8;
      filter.frequency.setValueAtTime(220, now);
      filter.frequency.exponentialRampToValueAtTime(2100, now + 0.22);
      filter.frequency.exponentialRampToValueAtTime(260, now + 0.48);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.01, now);
      g.gain.exponentialRampToValueAtTime(0.28, now + 0.18);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      noise.connect(filter);
      filter.connect(g);
      g.connect(env);
      noise.start(now);
      stopCallbacks.push(() => noise.stop());
      this.registerHandle(handleKey, env, stopAllNodes, 540);
      return;
    }

    if (pad === 'applause') {
      const bufferSize = Math.floor(ctx.sampleRate * 1.6);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const envShape = Math.sin((i / bufferSize) * Math.PI);
        const burst = 0.55 + 0.45 * Math.sin(i * 0.017);
        data[i] = (Math.random() * 2 - 1) * envShape * burst * 0.55;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1250;
      const g = ctx.createGain();
      g.gain.value = 0.3;
      noise.connect(filter);
      filter.connect(g);
      g.connect(env);
      noise.start(now);
      stopCallbacks.push(() => noise.stop());
      this.registerHandle(handleKey, env, stopAllNodes, 1650);
      return;
    }

    if (pad === 'hype') {
      // Punchy brassy broadcast hype sting
      [0, 0.13, 0.26].forEach((offset, idx) => {
        const baseFreq = idx === 2 ? 466.16 : 392.0;
        [baseFreq, baseFreq * 1.006, baseFreq * 1.5].forEach((freq) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq * 0.96, now + offset);
          osc.frequency.exponentialRampToValueAtTime(freq, now + offset + 0.03);
          const dur = idx === 2 ? 0.52 : 0.11;
          g.gain.setValueAtTime(0.001, now + offset);
          g.gain.exponentialRampToValueAtTime(0.085, now + offset + 0.015);
          g.gain.exponentialRampToValueAtTime(0.001, now + offset + dur);
          osc.connect(g);
          g.connect(env);
          osc.start(now + offset);
          osc.stop(now + offset + dur + 0.03);
          stopCallbacks.push(() => osc.stop());
        });
      });
      this.registerHandle(handleKey, env, stopAllNodes, 840);
      return;
    }

    if (pad === 'drumroll') {
      // Rising tension snare roll + cymbal hit
      const bufferSize = Math.floor(ctx.sampleRate * 1.35);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const t = i / ctx.sampleRate;
        const rate = 16 + t * 14;
        const pulse = Math.pow(Math.abs(Math.sin(Math.PI * rate * t)), 6);
        const crescendo = Math.min(1, 0.25 + t * 0.65);
        data[i] = (Math.random() * 2 - 1) * pulse * crescendo * 0.55;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 380;
      noise.connect(filter);
      filter.connect(env);
      noise.start(now);
      stopCallbacks.push(() => noise.stop());
      this.registerHandle(handleKey, env, stopAllNodes, 1400);
      return;
    }

    // Alert cue
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(783.99, now + 0.1);
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    osc.connect(g);
    g.connect(env);
    osc.start(now);
    osc.stop(now + 0.4);
    stopCallbacks.push(() => osc.stop());
    this.registerHandle(handleKey, env, stopAllNodes, 430);
  }
}

export const audioEngine = new GatherAudioEngine();
