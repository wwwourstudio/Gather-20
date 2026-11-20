import { AiMotionBumperSpec, AiMusicSpec } from '../types/studio';
import { encodeAudioBufferToWav } from './wavEncoder';

export function sanitizeSvg(rawSvg: string, width = 1920, height = 1080): string {
  let svg = String(rawSvg || '').trim();
  const start = svg.indexOf('<svg');
  const end = svg.lastIndexOf('</svg>');
  if (start >= 0 && end > start) {
    svg = svg.slice(start, end + 6);
  } else {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="none"><rect x="32" y="32" width="${width - 64}" height="${height - 64}" rx="28" stroke="#3B82F6" stroke-width="5"/></svg>`;
  }
  svg = svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/on[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<image[^>]*href\s*=\s*(['"])\s*https?:[\s\S]*?>/gi, '');
  if (!/xmlns=/.test(svg)) {
    svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return svg;
}

export function svgToCompactDataUrl(svg: string): string {
  const clean = sanitizeSvg(svg);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(clean)}`;
}

export async function renderSvgToPngDataUrl(
  svg: string,
  width: number,
  height: number,
  transparent = false
): Promise<string> {
  const clean = sanitizeSvg(svg, width, height);
  const blob = new Blob([clean], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not rasterize vector SVG.'));
      el.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return svgToCompactDataUrl(clean);

    if (!transparent) {
      ctx.fillStyle = '#070C19';
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function base64WavToBlob(dataUrlOrBase64: string): Blob {
  const raw = dataUrlOrBase64.includes(',')
    ? dataUrlOrBase64.slice(dataUrlOrBase64.indexOf(',') + 1)
    : dataUrlOrBase64;
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: 'audio/wav' });
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Renders a Gemini-composed AiMusicSpec into a stereo 44.1kHz 16-bit PCM WAV Blob
 * via WebAudio OfflineAudioContext so hosts get real loopable broadcast music beds.
 */
export async function renderMusicSpecToWavBlob(spec: AiMusicSpec): Promise<Blob> {
  const sampleRate = 44100;
  const beatSec = 60 / Math.max(70, Math.min(150, spec.bpm || 110));
  const durationSec = Math.max(4, Math.min(16, spec.durationSec || 8));
  const totalSamples = Math.floor(sampleRate * durationSec);
  const offline = new OfflineAudioContext(2, totalSamples, sampleRate);

  const master = offline.createGain();
  master.gain.value = 0.72;
  master.connect(offline.destination);

  const scale = spec.scaleIntervals.length > 0 ? spec.scaleIntervals : [0, 2, 4, 7, 9];
  const degreeToMidi = (deg: number, octaveShift = 0): number => {
    const wrapped = ((deg % scale.length) + scale.length) % scale.length;
    const oct = Math.floor(deg / scale.length) + octaveShift;
    return spec.keyRootMidi + scale[wrapped] + oct * 12;
  };

  const stepSec = beatSec / 2; // 8th-note grid
  const totalSteps = Math.floor(durationSec / stepSec);
  const chords = spec.chordProgression.length > 0 ? spec.chordProgression : [0, 3, 4, 2];
  const lead = spec.leadPattern.length > 0 ? spec.leadPattern : [0, 2, 4, -1, 3, 2, 1, -1];
  const bass = spec.bassPattern.length > 0 ? spec.bassPattern : [0, 0, 2, 0, 3, 3, 4, 2];

  for (let step = 0; step < totalSteps; step++) {
    const t = step * stepSec;

    // Warm Stereo Chord Pad on bar downbeats
    if (step % 4 === 0) {
      const chordDeg = chords[Math.floor(step / 4) % chords.length];
      const chordNotes = [
        degreeToMidi(chordDeg, 0),
        degreeToMidi(chordDeg + 2, 0),
        degreeToMidi(chordDeg + 4, 0),
      ];
      chordNotes.forEach((midi, idx) => {
        const osc = offline.createOscillator();
        const pan = offline.createStereoPanner();
        const filter = offline.createBiquadFilter();
        const env = offline.createGain();

        osc.type = spec.synthTimbre === 'esports-bass' ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(midiToFreq(midi), t);
        pan.pan.setValueAtTime((idx - 1) * 0.28, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(spec.synthTimbre === 'lofi-keys' ? 1400 : 2100, t);

        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(0.11, t + 0.08);
        env.gain.exponentialRampToValueAtTime(0.0008, Math.min(durationSec, t + stepSec * 4.1));

        osc.connect(filter);
        filter.connect(env);
        env.connect(pan);
        pan.connect(master);

        osc.start(t);
        osc.stop(Math.min(durationSec, t + stepSec * 4.2));
      });
    }

    // Bass groove
    const bassDeg = bass[step % bass.length];
    if (bassDeg >= 0) {
      const osc = offline.createOscillator();
      const filter = offline.createBiquadFilter();
      const env = offline.createGain();
      osc.type = spec.synthTimbre === 'esports-bass' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(midiToFreq(degreeToMidi(bassDeg, -1)), t);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(420, t);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.24, t + 0.015);
      env.gain.exponentialRampToValueAtTime(0.001, Math.min(durationSec, t + stepSec * 0.92));
      osc.connect(filter);
      filter.connect(env);
      env.connect(master);
      osc.start(t);
      osc.stop(Math.min(durationSec, t + stepSec));
    }

    // Lead / Pluck motif
    const leadDeg = lead[step % lead.length];
    if (leadDeg >= 0) {
      const osc = offline.createOscillator();
      const pan = offline.createStereoPanner();
      const env = offline.createGain();
      osc.type = spec.synthTimbre === 'synthwave-pluck' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(midiToFreq(degreeToMidi(leadDeg, 1)), t);
      pan.pan.setValueAtTime(step % 2 === 0 ? -0.22 : 0.22, t);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.12, t + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0008, Math.min(durationSec, t + stepSec * 0.85));
      osc.connect(env);
      env.connect(pan);
      pan.connect(master);
      osc.start(t);
      osc.stop(Math.min(durationSec, t + stepSec));
    }

    // Kick & Hi-Hat percussion
    if (spec.drumIntensity > 0.15) {
      if (step % 2 === 0) {
        const kick = offline.createOscillator();
        const kEnv = offline.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(125, t);
        kick.frequency.exponentialRampToValueAtTime(42, t + 0.11);
        kEnv.gain.setValueAtTime(0.32 * spec.drumIntensity, t);
        kEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        kick.connect(kEnv);
        kEnv.connect(master);
        kick.start(t);
        kick.stop(t + 0.17);
      }

      if (spec.drumIntensity > 0.4 && step % 2 === 1) {
        const bufLen = Math.floor(sampleRate * 0.045);
        const noiseBuf = offline.createBuffer(1, bufLen, sampleRate);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.35));
        }
        const noise = offline.createBufferSource();
        noise.buffer = noiseBuf;
        const hp = offline.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 6500;
        const nGain = offline.createGain();
        nGain.gain.value = 0.09 * spec.drumIntensity;
        noise.connect(hp);
        hp.connect(nGain);
        nGain.connect(master);
        noise.start(t);
      }
    }
  }

  const rendered = await offline.startRendering();
  return encodeAudioBufferToWav(rendered);
}

/**
 * Renders a Gemini-choreographed kinetic broadcast video bumper onto an offscreen canvas
 * and captures a real WebM video File playable inside Gather Studio's stage media deck.
 */
export async function renderMotionBumperToWebm(spec: AiMotionBumperSpec): Promise<File> {
  const isVertical = spec.aspectRatio === '9:16';
  const width = isVertical ? 720 : 1280;
  const height = isVertical ? 1280 : 720;
  const durationMs = Math.max(3000, Math.min(8000, (spec.durationSec || 5) * 1000));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable for bumper rendering.');

  const stream = canvas.captureStream(30);
  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3_500_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data.size > 0) chunks.push(ev.data);
  };

  const drawFrame = (progress: number) => {
    ctx.clearRect(0, 0, width, height);

    // Base studio obsidian gradient
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, spec.surfaceHex || '#060A16');
    bg.addColorStop(0.55, '#0B1328');
    bg.addColorStop(1, '#040711');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Kinetic ambient orb motion
    const orbX = width * (0.28 + 0.44 * Math.sin(progress * Math.PI * 2));
    const orbY = height * (0.35 + 0.2 * Math.cos(progress * Math.PI * 2));
    const orb = ctx.createRadialGradient(orbX, orbY, 20, orbX, orbY, width * 0.55);
    orb.addColorStop(0, `${spec.primaryHex}66`);
    orb.addColorStop(0.5, `${spec.secondaryHex}28`);
    orb.addColorStop(1, 'transparent');
    ctx.fillStyle = orb;
    ctx.fillRect(0, 0, width, height);

    // Motion pattern layer
    ctx.save();
    ctx.strokeStyle = `${spec.primaryHex}44`;
    ctx.lineWidth = 2;
    if (spec.motionStyle === 'kinetic-grid' || spec.motionStyle === 'esports-slash') {
      const offset = (progress * 120) % 80;
      for (let x = -80; x < width + 80; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x + offset, 0);
        ctx.lineTo(x + offset - (spec.motionStyle === 'esports-slash' ? 140 : 0), height);
        ctx.stroke();
      }
    } else if (spec.motionStyle === 'countdown-ring') {
      const maxR = Math.min(width, height) * 0.38;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, maxR, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.strokeStyle = spec.primaryHex;
      ctx.lineWidth = 6;
      ctx.stroke();
    } else {
      for (let r = 120; r < width * 0.65; r += 110) {
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, r + Math.sin(progress * Math.PI * 2) * 18, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Smooth ease-in-out typography reveal
    const enterAlpha = Math.min(1, progress * 5);
    const exitAlpha = progress > 0.85 ? Math.max(0, (1 - progress) / 0.15) : 1;
    const alpha = Math.min(enterAlpha, exitAlpha);
    const slideY = (1 - Math.min(1, progress * 4)) * 28;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';

    // Top badge
    ctx.fillStyle = `${spec.primaryHex}33`;
    ctx.strokeStyle = `${spec.primaryHex}AA`;
    ctx.lineWidth = 1.5;
    const badgeW = 240;
    const badgeY = height * 0.34 + slideY;
    ctx.beginPath();
    ctx.roundRect(width / 2 - badgeW / 2, badgeY, badgeW, 38, 19);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '600 15px "JetBrains Mono", monospace';
    ctx.fillText((spec.badgeText || 'GATHER LIVE').toUpperCase(), width / 2, badgeY + 24);

    // Main headline
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `600 ${isVertical ? 54 : 68}px "Outfit", sans-serif`;
    ctx.fillText(spec.headline.slice(0, 32), width / 2, height * 0.5 + slideY);

    // Subtitle
    ctx.fillStyle = 'rgba(226, 232, 240, 0.82)';
    ctx.font = `400 ${isVertical ? 24 : 26}px "Outfit", sans-serif`;
    ctx.fillText(spec.subtitle.slice(0, 56), width / 2, height * 0.57 + slideY);

    // Bottom progress accent line
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(width * 0.25, height * 0.72, width * 0.5, 4);
    ctx.fillStyle = spec.primaryHex;
    ctx.fillRect(width * 0.25, height * 0.72, width * 0.5 * progress, 4);

    ctx.restore();
  };

  return new Promise<File>((resolve, reject) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: 'video/webm' });
      const safeName = spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 28) || 'ai-bumper';
      resolve(new File([blob], `${safeName}.webm`, { type: 'video/webm' }));
    };
    recorder.onerror = () => {
      stream.getTracks().forEach((t) => t.stop());
      reject(new Error('Failed to encode WebM motion bumper.'));
    };

    recorder.start(250);
    const startAt = performance.now();
    const tick = () => {
      const elapsed = performance.now() - startAt;
      const progress = Math.min(1, elapsed / durationMs);
      drawFrame(progress);
      if (progress < 1) {
        window.setTimeout(tick, 33);
      } else {
        window.setTimeout(() => recorder.stop(), 120);
      }
    };
    tick();
  });
}
