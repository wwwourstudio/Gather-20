import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Headphones,
  Mic,
  MicOff,
  Music2,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Waves,
  X,
} from 'lucide-react';
import { AudioChannelState } from '../types/studio';
import {
  audioEngine,
  AutoDuckerConfig,
  AutoDuckerTelemetry,
} from '../utils/audioEngine';
import { PRESET_STINGER_PADS } from './StingerDeckDrawer';

interface AudioMixerDrawerProps {
  open: boolean;
  channels: AudioChannelState[];
  masterGain: number;
  onUpdateChannel: (id: string, patch: Partial<AudioChannelState>) => void;
  onUpdateMasterGain: (gain: number) => void;
  onOpenStingerDeck?: () => void;
  onClose: () => void;
}

interface ChannelHistoryGraphProps {
  channelId: string;
  label: string;
  muted?: boolean;
  accentMode?: 'channel' | 'master';
  resetSignal: number;
  onTelemetryTick: (channelId: string, peak: number, peakHold: number) => void;
  onResetPeak: (channelId: string) => void;
}

const HISTORY_SAMPLES = 96;

const ChannelHistoryGraph: React.FC<ChannelHistoryGraphProps> = ({
  channelId,
  label,
  muted = false,
  accentMode = 'channel',
  resetSignal,
  onTelemetryTick,
  onResetPeak,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const peakHoldRef = useRef<number>(0);

  useEffect(() => {
    peakHoldRef.current = 0;
  }, [resetSignal]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const syncSize = () => {
      const rect = host.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const targetW = Math.max(140, Math.round(rect.width * dpr));
      const targetH = Math.max(52, Math.round(rect.height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
    };

    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(host);

    // Seed initial rolling history from engine so graph isn't empty on drawer open
    const initial = audioEngine.sampleChannelTelemetry(channelId, muted);
    const peakHist = new Array<number>(HISTORY_SAMPLES).fill(0);
    const rmsHist = new Array<number>(HISTORY_SAMPLES).fill(0);
    if (initial.history.length > 0 && !muted) {
      const offset = Math.max(0, HISTORY_SAMPLES - initial.history.length);
      for (let i = 0; i < initial.history.length && offset + i < HISTORY_SAMPLES; i++) {
        peakHist[offset + i] = initial.history[i];
        rmsHist[offset + i] = initial.rmsHistory[i] ?? initial.history[i] * 0.7;
      }
      peakHoldRef.current = initial.peakHold;
    }

    let scratch = new Uint8Array(256);
    let lastUiReport = 0;
    let rafId = 0;

    const renderFrame = (ts: number) => {
      let peak = 0;
      let rms = 0;

      if (!muted) {
        const analyser: AnalyserNode | null = audioEngine.getAnalyserNode(channelId);
        if (analyser) {
          const bins = analyser.frequencyBinCount;
          if (scratch.length < bins) {
            scratch = new Uint8Array(bins);
          }
          const view = scratch.length === bins ? scratch : scratch.subarray(0, bins);
          analyser.getByteTimeDomainData(view);

          let sumSq = 0;
          for (let i = 0; i < bins; i++) {
            const sample = (view[i] - 128) / 128;
            const abs = Math.abs(sample);
            if (abs > peak) peak = abs;
            sumSq += sample * sample;
          }
          peak = Math.min(1, peak * 1.85);
          rms = Math.min(1, Math.sqrt(sumSq / Math.max(1, bins)) * 2.2);
        }
      }

      if (peak > peakHoldRef.current) {
        peakHoldRef.current = peak;
      } else {
        peakHoldRef.current = Math.max(0, peakHoldRef.current * 0.992 - 0.0012);
      }

      peakHist.push(peak);
      if (peakHist.length > HISTORY_SAMPLES) peakHist.shift();
      rmsHist.push(rms);
      if (rmsHist.length > HISTORY_SAMPLES) rmsHist.shift();

      if (ts - lastUiReport >= 75) {
        lastUiReport = ts;
        onTelemetryTick(channelId, peak, peakHoldRef.current);
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        const w = canvas.width;
        const h = canvas.height;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const styles = getComputedStyle(document.documentElement);
        const colOk = styles.getPropertyValue('--ok').trim() || '#22c55e';
        const colWarn = styles.getPropertyValue('--warn').trim() || '#f59e0b';
        const colLive = styles.getPropertyValue('--live').trim() || '#ef4444';
        const colAccent = styles.getPropertyValue('--accent').trim() || '#2f6bf0';
        const colLine = styles.getPropertyValue('--line').trim() || 'rgba(148,163,184,0.22)';
        const colMuted = styles.getPropertyValue('--ink-3').trim() || '#94a3b8';

        ctx.clearRect(0, 0, w, h);

        const padY = 4 * dpr;
        const usableH = h - padY * 2;
        const slotW = w / HISTORY_SAMPLES;
        const barW = Math.max(1.25 * dpr, slotW * 0.68);

        ctx.save();
        // dB threshold gridlines (-14 dB, -6 dB, 0 dB clip)
        ctx.strokeStyle = colLine;
        ctx.lineWidth = Math.max(1, dpr * 0.75);
        for (const lvl of [0.3, 0.65, 0.88]) {
          const y = Math.round(h - padY - lvl * usableH);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }

        if (!muted) {
          // 60fps peak history bars
          for (let i = 0; i < HISTORY_SAMPLES; i++) {
            const v = peakHist[i];
            if (v <= 0.01) continue;
            const barH = Math.max(1.5 * dpr, v * usableH);
            const x = i * slotW + (slotW - barW) * 0.5;
            const y = h - padY - barH;
            ctx.fillStyle =
              v > 0.86
                ? colLive
                : v > 0.65
                ? colWarn
                : accentMode === 'master'
                ? colAccent
                : colOk;
            ctx.globalAlpha = 0.28 + (i / HISTORY_SAMPLES) * 0.68;
            ctx.fillRect(x, y, barW, barH);
          }

          // Smooth RMS envelope area + stroke
          ctx.globalAlpha = 0.94;
          ctx.strokeStyle = accentMode === 'master' ? colAccent : colOk;
          ctx.lineWidth = Math.max(1.25 * dpr, 1.4);
          ctx.beginPath();
          for (let i = 0; i < HISTORY_SAMPLES; i++) {
            const x = (i + 0.5) * slotW;
            const y = h - padY - rmsHist[i] * usableH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Live right-edge instantaneous level marker
          const lastPeakH = Math.max(1.5 * dpr, peak * usableH);
          ctx.globalAlpha = 1;
          ctx.fillStyle = peak > 0.86 ? colLive : peak > 0.65 ? colWarn : accentMode === 'master' ? colAccent : colOk;
          ctx.fillRect(w - Math.max(3 * dpr, slotW * 1.4), h - padY - lastPeakH, Math.max(3 * dpr, slotW * 1.4), lastPeakH);

          // Decaying peak-hold dashed line
          const hold = peakHoldRef.current;
          if (hold > 0.025) {
            const holdY = Math.round(h - padY - hold * usableH);
            ctx.globalAlpha = 0.88;
            ctx.setLineDash([3 * dpr, 3 * dpr]);
            ctx.strokeStyle = hold >= 0.86 ? colLive : hold >= 0.65 ? colWarn : colMuted;
            ctx.lineWidth = Math.max(1, dpr);
            ctx.beginPath();
            ctx.moveTo(0, holdY);
            ctx.lineTo(w, holdY);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        } else {
          ctx.globalAlpha = 0.55;
          ctx.strokeStyle = colLive;
          ctx.lineWidth = Math.max(1, dpr);
          ctx.beginPath();
          ctx.moveTo(0, h - padY);
          ctx.lineTo(w, h - padY);
          ctx.stroke();
        }
        ctx.restore();
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [channelId, muted, accentMode, onTelemetryTick]);

  return (
    <div
      ref={hostRef}
      onClick={() => onResetPeak(channelId)}
      title={`${label} 60fps AnalyserNode level history (click to reset peak hold)`}
      className="relative w-full h-14 rounded-[6px] border border-[var(--line)] bg-[var(--fill)] overflow-hidden cursor-pointer"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};

export const AudioMixerDrawer: React.FC<AudioMixerDrawerProps> = ({
  open,
  channels,
  masterGain,
  onUpdateChannel,
  onUpdateMasterGain,
  onOpenStingerDeck,
  onClose,
}) => {
  const [levels, setLevels] = useState<Record<string, { peak: number; peakHold: number }>>({});
  const [resetSignals, setResetSignals] = useState<Record<string, number>>({});
  const [activeIds, setActiveIds] = useState<string[]>(() => audioEngine.getActiveIds());
  const [duckerConfig, setDuckerConfig] = useState<AutoDuckerConfig>(() =>
    audioEngine.getAutoDuckerConfig()
  );
  const [duckerTelemetry, setDuckerTelemetry] = useState<AutoDuckerTelemetry>(() =>
    audioEngine.getAutoDuckerTelemetry()
  );

  useEffect(() => {
    return audioEngine.subscribe(() => {
      setActiveIds(audioEngine.getActiveIds());
      setDuckerConfig(audioEngine.getAutoDuckerConfig());
      setDuckerTelemetry(audioEngine.getAutoDuckerTelemetry());
    });
  }, []);

  useEffect(() => {
    if (!open || !duckerConfig.enabled) return;
    const id = window.setInterval(() => {
      setDuckerTelemetry(audioEngine.getAutoDuckerTelemetry());
    }, 85);
    return () => window.clearInterval(id);
  }, [open, duckerConfig.enabled]);

  const handleTelemetryTick = useCallback((channelId: string, peak: number, peakHold: number) => {
    setLevels((prev) => {
      const existing = prev[channelId];
      if (
        existing &&
        Math.abs(existing.peak - peak) < 0.015 &&
        Math.abs(existing.peakHold - peakHold) < 0.015
      ) {
        return prev;
      }
      return {
        ...prev,
        [channelId]: { peak, peakHold },
      };
    });
  }, []);

  const handleResetPeak = useCallback((channelId: string) => {
    audioEngine.resetPeakHold(channelId);
    setResetSignals((prev) => ({ ...prev, [channelId]: (prev[channelId] || 0) + 1 }));
    setLevels((prev) => ({
      ...prev,
      [channelId]: { peak: prev[channelId]?.peak ?? 0, peakHold: 0 },
    }));
  }, []);

  if (!open) return null;

  const toDb = (lvl: number) => {
    if (lvl <= 0.01) return '-∞ dB';
    const db = Math.max(-48, Math.round(20 * Math.log10(lvl)));
    return `${db > 0 ? '+' : ''}${db} dB`;
  };

  const resolveTriggerLabel = (channelId: string | null) => {
    if (!channelId) return 'Voice active';
    return channels.find((c) => c.id === channelId)?.label || 'Speaker';
  };

  return (
    <div className="border-b border-[var(--line)] bg-[var(--bg)] overflow-hidden animate-gather-drawer">
      <div className="px-4 py-2.5 border-b border-[var(--line)] flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <Waves className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
          <h3 className="font-display text-xs font-medium text-[var(--ink)] whitespace-nowrap">
            Pro Audio Mix Bus
          </h3>
          <span className="text-[11px] text-[var(--ink-3)] hidden sm:inline truncate">
            · 60fps AnalyserNode peak history · Live stream &amp; recordings
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            role="switch"
            aria-checked={duckerConfig.enabled}
            onClick={() => audioEngine.setAutoDuckerConfig({ enabled: !duckerConfig.enabled })}
            title="Automatically lower Media / Video gain when Host Mic or Guests speak"
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              duckerConfig.enabled
                ? duckerTelemetry.ducking
                  ? 'text-[var(--warn)]'
                  : 'text-[var(--accent-text)]'
                : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
            }`}
          >
            <span>
              {duckerConfig.enabled
                ? duckerTelemetry.ducking
                  ? `Auto-Duck · ${duckerTelemetry.reductionDb.toFixed(1)} dB`
                  : 'Auto-Duck · Armed'
                : 'Auto-Duck · Off'}
            </span>
          </button>
          {onOpenStingerDeck && (
            <button
              type="button"
              onClick={onOpenStingerDeck}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-text)] hover:underline whitespace-nowrap cursor-pointer"
            >
              <Music2 className="w-3 h-3" />
              <span>Custom Stingers</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close audio mixer"
            className="h-6 w-6 grid place-items-center rounded-[6px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Hairline-divided console strip — zero nested cards, percentage grid tracks */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[var(--line)]">
        {/* Channel Strips */}
        <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--line)]">
          {channels.map((ch) => {
            const metrics = levels[ch.id] ?? { peak: 0, peakHold: 0 };
            const lvl = metrics.peak;
            const isSfx = ch.id === 'stinger-fx';
            const isMedia = ch.id === 'media-deck';
            const isDuckedMedia = isMedia && duckerConfig.enabled && duckerTelemetry.ducking;
            const effectivePct = isMedia && duckerConfig.enabled
              ? Math.round(ch.gain * duckerTelemetry.currentDuckGain * 100)
              : Math.round(ch.gain * 100);
            return (
              <div key={ch.id} className="w-full min-w-0 p-3.5 space-y-2.5 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-xs font-semibold text-[var(--ink)] truncate">
                    {ch.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleResetPeak(ch.id)}
                    title="Click to reset peak hold"
                    className={`text-[11px] font-mono-num shrink-0 whitespace-nowrap cursor-pointer ${
                      metrics.peakHold >= 0.86 ? 'text-[var(--live)] font-semibold' : 'text-[var(--ink-3)]'
                    }`}
                  >
                    {toDb(lvl)} · Pk {toDb(metrics.peakHold)}
                  </button>
                </div>

                {/* Real-time 60fps AnalyserNode Audio-Level History Graph */}
                <ChannelHistoryGraph
                  channelId={ch.id}
                  label={ch.label}
                  muted={ch.muted}
                  resetSignal={resetSignals[ch.id] || 0}
                  onTelemetryTick={handleTelemetryTick}
                  onResetPeak={handleResetPeak}
                />

                {/* Gain Fader + Sidechain Duck Indicator for Media / Video */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={1.5}
                      step={0.05}
                      value={ch.gain}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        audioEngine.setChannelParams(ch.id, { gain: val, muted: ch.muted });
                        onUpdateChannel(ch.id, { gain: val });
                      }}
                      aria-label={`${ch.label} gain`}
                      className="gather-range flex-1 min-w-0"
                    />
                    <span
                      className={`text-[11px] font-mono-num w-11 text-right shrink-0 tabular-nums ${
                        isDuckedMedia ? 'text-[var(--warn)] font-semibold' : 'text-[var(--ink-2)]'
                      }`}
                      title={
                        isDuckedMedia
                          ? `Base ${Math.round(ch.gain * 100)}% → Ducked to ${effectivePct}%`
                          : undefined
                      }
                    >
                      {effectivePct}%
                    </span>
                  </div>
                  {isMedia && duckerConfig.enabled && (
                    <div className="flex items-center justify-between gap-1.5 text-[10px] font-mono-num tabular-nums">
                      <span
                        className={`truncate ${
                          isDuckedMedia ? 'text-[var(--warn)] font-semibold' : 'text-[var(--ink-3)]'
                        }`}
                      >
                        {isDuckedMedia
                          ? `Ducking (${resolveTriggerLabel(duckerTelemetry.triggerChannelId)})`
                          : 'Auto-Ducker Armed'}
                      </span>
                      <span
                        className={`shrink-0 ${
                          isDuckedMedia ? 'text-[var(--warn)]' : 'text-[var(--ink-3)]'
                        }`}
                      >
                        {duckerTelemetry.reductionDb < -0.1
                          ? `${duckerTelemetry.reductionDb.toFixed(1)} dB`
                          : '0.0 dB'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Channel Switches */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !ch.muted;
                      audioEngine.setChannelParams(ch.id, { muted: next, gain: ch.gain });
                      onUpdateChannel(ch.id, { muted: next });
                    }}
                    className={`flex-1 h-7 rounded-[6px] text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer ${
                      ch.muted
                        ? 'bg-[var(--live)] text-white'
                        : 'bg-[var(--fill)] hover:bg-[var(--fill-hover)] text-[var(--ink-2)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {ch.muted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                    <span>{ch.muted ? 'Muted' : 'Live'}</span>
                  </button>
                  {!isSfx && (
                    <button
                      type="button"
                      title="Voice Clarity EQ + Compressor"
                      onClick={() => {
                        const next = !ch.clarityEq;
                        audioEngine.setChannelParams(ch.id, { clarityEq: next });
                        onUpdateChannel(ch.id, { clarityEq: next });
                      }}
                      className={`h-7 px-2 rounded-[6px] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer ${
                        ch.clarityEq
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--fill)] text-[var(--ink-3)]'
                      }`}
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      <span>EQ</span>
                    </button>
                  )}
                  <button
                    type="button"
                    title="Monitor in headphones"
                    onClick={() => {
                      const next = !ch.monitor;
                      audioEngine.setChannelParams(ch.id, { monitor: next });
                      onUpdateChannel(ch.id, { monitor: next });
                    }}
                    className={`h-7 w-7 grid place-items-center rounded-[6px] cursor-pointer ${
                      ch.monitor
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--fill)] text-[var(--ink-3)]'
                    }`}
                  >
                    <Headphones className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Master Bus Strip */}
          <div className="w-full min-w-0 p-3.5 space-y-2.5 bg-[var(--bg)]/45 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-xs font-bold text-[var(--accent-text)] truncate">Master Bus</span>
              <button
                type="button"
                onClick={() => handleResetPeak('master')}
                title="Click to reset master peak hold"
                className="text-[11px] font-mono-num text-[var(--ink-3)] shrink-0 whitespace-nowrap cursor-pointer"
              >
                {toDb(levels.master?.peak ?? 0)} · Pk {toDb(levels.master?.peakHold ?? 0)}
              </button>
            </div>
            <ChannelHistoryGraph
              channelId="master"
              label="Master Bus"
              muted={masterGain === 0}
              accentMode="master"
              resetSignal={resetSignals.master || 0}
              onTelemetryTick={handleTelemetryTick}
              onResetPeak={handleResetPeak}
            />
            <div className="flex items-center gap-2">
              {masterGain === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-[var(--live)] shrink-0" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-[var(--ink-2)] shrink-0" />
              )}
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={masterGain}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  audioEngine.setMasterGain(val);
                  onUpdateMasterGain(val);
                }}
                aria-label="Master bus gain"
                className="gather-range flex-1 min-w-0"
              />
              <span className="text-[11px] font-mono-num text-[var(--ink-2)] w-10 text-right shrink-0">
                {Math.round(masterGain * 100)}%
              </span>
            </div>
            <p className="text-[11px] text-[var(--ink-3)]">Program &amp; Watch feed</p>
          </div>
        </div>

        {/* Right Console Column: Sidechain Auto-Ducker + Quick Stinger Trigger Pads */}
        <div className="lg:col-span-3 divide-y divide-[var(--line)] flex flex-col justify-between">
          {/* Auto-Ducker Sidechain Console */}
          <div className="p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[var(--ink)] flex items-center gap-1.5">
                  <span>Auto-Ducker</span>
                  {duckerConfig.enabled && duckerTelemetry.ducking && (
                    <span className="text-[10px] font-mono-num tabular-nums text-[var(--warn)]">
                      {duckerTelemetry.reductionDb.toFixed(1)} dB
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[var(--ink-3)] truncate">
                  Dips Media / Video on Host or Guest speech
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={duckerConfig.enabled}
                aria-label="Toggle Auto-Ducker"
                onClick={() => audioEngine.setAutoDuckerConfig({ enabled: !duckerConfig.enabled })}
                className={`w-8 h-4.5 rounded-full p-0.5 transition-colors shrink-0 flex items-center cursor-pointer ${
                  duckerConfig.enabled
                    ? 'bg-[var(--accent)] justify-end'
                    : 'bg-white/15 justify-start'
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-full bg-white shadow-xs" />
              </button>
            </div>

            {duckerConfig.enabled && (
              <div className="space-y-2 pt-0.5">
                {/* Duck Depth Preset Row */}
                <div className="grid grid-cols-4 gap-1">
                  {[-6, -12, -18, -24].map((db) => {
                    const active = duckerConfig.reductionDb === db;
                    return (
                      <button
                        key={db}
                        type="button"
                        onClick={() => audioEngine.setAutoDuckerConfig({ reductionDb: db })}
                        className={`h-6 rounded-[5px] border text-[10px] font-mono-num tabular-nums whitespace-nowrap cursor-pointer transition-colors ${
                          active
                            ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--ink)] font-semibold'
                            : 'bg-[var(--fill)] border-[var(--line)] text-[var(--ink-3)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {db}dB
                      </button>
                    );
                  })}
                </div>

                {/* Threshold & Live Gain Reduction Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[var(--ink-3)]">Voice Trigger</span>
                    <span className="font-mono-num tabular-nums text-[var(--ink-2)]">
                      {Math.round(duckerConfig.threshold * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.03}
                    max={0.28}
                    step={0.01}
                    value={duckerConfig.threshold}
                    aria-label="Auto-Ducker voice trigger threshold"
                    onChange={(e) =>
                      audioEngine.setAutoDuckerConfig({ threshold: Number(e.target.value) })
                    }
                    className="gather-range w-full"
                  />
                  {/* Live Gain-Reduction Bar */}
                  <div className="h-1.5 w-full rounded-full bg-[var(--fill)] border border-[var(--line)] overflow-hidden">
                    <div
                      className={`h-full transition-[width] duration-75 ${
                        duckerTelemetry.ducking ? 'bg-[var(--warn)]' : 'bg-[var(--accent)]/60'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            duckerTelemetry.ducking
                              ? (Math.abs(duckerTelemetry.reductionDb) /
                                  Math.max(6, Math.abs(duckerConfig.reductionDb))) *
                                  100
                              : Math.min(100, (duckerTelemetry.speechEnergy / duckerConfig.threshold) * 35)
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Stinger Trigger Pads */}
          <div className="p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--ink)]">Quick Stingers</span>
              {onOpenStingerDeck && (
                <button
                  type="button"
                  onClick={onOpenStingerDeck}
                  className="text-[11px] text-[var(--accent-text)] hover:underline cursor-pointer"
                >
                  + Upload
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESET_STINGER_PADS.slice(0, 4).map((pad) => {
                const active = activeIds.includes(`pad:${pad.id}`);
                return (
                  <button
                    key={pad.id}
                    type="button"
                    onClick={() => audioEngine.playStinger(pad.id)}
                    className={`px-2.5 py-1.5 rounded-[6px] border text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--ink)]'
                        : 'bg-[var(--fill)] hover:bg-[var(--fill-hover)] border-[var(--line)] text-[var(--ink)]'
                    }`}
                  >
                    <div className="text-xs font-medium truncate leading-tight">{pad.label}</div>
                    <div className="text-[10px] text-[var(--ink-3)] truncate">{pad.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
