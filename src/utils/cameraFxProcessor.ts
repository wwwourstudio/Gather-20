import { VIRTUAL_BG_PRESETS } from '../constants/studioDefaults';
import { VideoBgMode, VideoFxSettings } from '../types/studio';

export function resolveBgMode(fx: VideoFxSettings): VideoBgMode {
  if (fx.bgMode) return fx.bgMode;
  if (fx.chromaKey) return 'greenscreen';
  if (fx.blurBg) return 'blur';
  return 'natural';
}

export function needsPixelProcessing(fx: VideoFxSettings): boolean {
  const mode = resolveBgMode(fx);
  return mode === 'blur' || mode === 'cutout' || mode === 'greenscreen';
}

interface FxScratchBuffers {
  maskCanvas: HTMLCanvasElement;
  maskCtx: CanvasRenderingContext2D;
  fgCanvas: HTMLCanvasElement;
  fgCtx: CanvasRenderingContext2D;
  bgBlurCanvas: HTMLCanvasElement;
  bgBlurCtx: CanvasRenderingContext2D;
  sampleCanvas: HTMLCanvasElement;
  sampleCtx: CanvasRenderingContext2D;
  alphaImg: ImageData;
}

const bufferMap = new WeakMap<HTMLCanvasElement, FxScratchBuffers>();

const SAMPLE_W = 160;
const SAMPLE_H = 90;

function getScratch(target: HTMLCanvasElement): FxScratchBuffers | null {
  let entry = bufferMap.get(target);
  if (!entry) {
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = SAMPLE_W;
    maskCanvas.height = SAMPLE_H;
    const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });

    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = SAMPLE_W;
    sampleCanvas.height = SAMPLE_H;
    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

    const fgCanvas = document.createElement('canvas');
    fgCanvas.width = target.width || 640;
    fgCanvas.height = target.height || 360;
    const fgCtx = fgCanvas.getContext('2d');

    const bgBlurCanvas = document.createElement('canvas');
    bgBlurCanvas.width = target.width || 640;
    bgBlurCanvas.height = target.height || 360;
    const bgBlurCtx = bgBlurCanvas.getContext('2d');

    if (!maskCtx || !sampleCtx || !fgCtx || !bgBlurCtx) return null;
    entry = {
      maskCanvas,
      maskCtx,
      fgCanvas,
      fgCtx,
      bgBlurCanvas,
      bgBlurCtx,
      sampleCanvas,
      sampleCtx,
      alphaImg: maskCtx.createImageData(SAMPLE_W, SAMPLE_H),
    };
    bufferMap.set(target, entry);
  }
  if (entry.fgCanvas.width !== target.width || entry.fgCanvas.height !== target.height) {
    entry.fgCanvas.width = target.width;
    entry.fgCanvas.height = target.height;
    entry.bgBlurCanvas.width = target.width;
    entry.bgBlurCanvas.height = target.height;
  }
  return entry;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16) || 22,
      parseInt(clean[1] + clean[1], 16) || 163,
      parseInt(clean[2] + clean[2], 16) || 74,
    ];
  }
  const num = parseInt(clean.slice(0, 6), 16);
  if (Number.isNaN(num)) return [22, 163, 74];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToCbCr(r: number, g: number, b: number): [number, number, number] {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return [y, cb, cr];
}

function drawVirtualBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  fx: VideoFxSettings,
  bgImg?: HTMLImageElement | null
) {
  const preset =
    VIRTUAL_BG_PRESETS.find((p) => p.id === (fx.virtualBgPreset || 'studio-aurora')) ||
    VIRTUAL_BG_PRESETS[0];

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, preset.colors[0]);
  grad.addColorStop(0.55, preset.colors[1]);
  grad.addColorStop(1, preset.colors[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Atmospheric glow orb
  const orb = ctx.createRadialGradient(w * 0.72, h * 0.25, 10, w * 0.72, h * 0.25, w * 0.55);
  orb.addColorStop(0, `${preset.colors[2]}40`);
  orb.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = orb;
  ctx.fillRect(0, 0, w, h);

  if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
    const scale = Math.max(w / bgImg.naturalWidth, h / bgImg.naturalHeight);
    const dw = bgImg.naturalWidth * scale;
    const dh = bgImg.naturalHeight * scale;
    ctx.drawImage(bgImg, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }
}

function computeChromaAlpha(
  srcData: Uint8ClampedArray,
  alphaData: Uint8ClampedArray,
  keyHex: string,
  tolerance: number
) {
  const [kr, kg, kb] = hexToRgb(keyHex);
  const [, kCb, kCr] = rgbToCbCr(kr, kg, kb);
  const tolLow = Math.max(8, tolerance * 0.65);
  const tolHigh = Math.max(tolLow + 14, tolerance * 1.45);

  for (let i = 0; i < srcData.length; i += 4) {
    const r = srcData[i];
    const g = srcData[i + 1];
    const b = srcData[i + 2];
    const [, cb, cr] = rgbToCbCr(r, g, b);
    const chromaDist = Math.hypot(cb - kCb, cr - kCr);

    let alpha = 255;
    if (chromaDist < tolLow) {
      alpha = 0;
    } else if (chromaDist < tolHigh) {
      alpha = Math.round(((chromaDist - tolLow) / (tolHigh - tolLow)) * 255);
    }
    alphaData[i] = 255;
    alphaData[i + 1] = 255;
    alphaData[i + 2] = 255;
    alphaData[i + 3] = alpha;
  }
}

function computeAdaptiveCutoutAlpha(
  srcData: Uint8ClampedArray,
  alphaData: Uint8ClampedArray,
  sensitivity: number
) {
  // Sample 8 border regions (top-left, top-right, left-edge, right-edge) for background colors
  const sampleCoords = [
    [4, 4],
    [14, 10],
    [SAMPLE_W - 5, 4],
    [SAMPLE_W - 15, 10],
    [4, Math.floor(SAMPLE_H * 0.4)],
    [SAMPLE_W - 5, Math.floor(SAMPLE_H * 0.4)],
    [6, Math.floor(SAMPLE_H * 0.72)],
    [SAMPLE_W - 7, Math.floor(SAMPLE_H * 0.72)],
  ];
  const bgSamples = sampleCoords.map(([sx, sy]) => {
    const idx = (sy * SAMPLE_W + sx) * 4;
    return [srcData[idx], srcData[idx + 1], srcData[idx + 2]] as [number, number, number];
  });

  const baseThresh = 22 + (100 - Math.max(20, Math.min(90, sensitivity))) * 0.68;

  for (let y = 0; y < SAMPLE_H; y++) {
    const ny = y / SAMPLE_H;
    for (let x = 0; x < SAMPLE_W; x++) {
      const idx = (y * SAMPLE_W + x) * 4;
      const r = srcData[idx];
      const g = srcData[idx + 1];
      const b = srcData[idx + 2];

      let minDist = 999;
      for (let s = 0; s < bgSamples.length; s++) {
        const bg = bgSamples[s];
        const dr = r - bg[0];
        const dg = g - bg[1];
        const db = b - bg[2];
        const d = Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11);
        if (d < minDist) minDist = d;
      }

      // Centered head-and-shoulders geometric prior
      const dx = (x / SAMPLE_W - 0.5) / 0.34;
      const dy = (ny - 0.56) / 0.52;
      const radial = Math.sqrt(dx * dx + dy * dy);
      const centerBonus = Math.max(0, 1 - radial) * 28;

      // Skin chroma protection
      const [, cb, cr] = rgbToCbCr(r, g, b);
      const isSkinTone = cr > 133 && cr < 178 && cb > 75 && cb < 130;
      const effectiveDist = minDist + centerBonus + (isSkinTone && radial < 1.15 ? 24 : 0);

      let alpha = 255;
      if (effectiveDist < baseThresh) {
        alpha = 0;
      } else if (effectiveDist < baseThresh + 20) {
        alpha = Math.round(((effectiveDist - baseThresh) / 20) * 255);
      }

      // Outside wide outer rim is softly attenuated unless high color divergence
      if (radial > 1.35 && minDist < baseThresh + 14) {
        alpha = Math.min(alpha, 24);
      }

      alphaData[idx] = 255;
      alphaData[idx + 1] = 255;
      alphaData[idx + 2] = 255;
      alphaData[idx + 3] = alpha;
    }
  }
}

export function processCameraFxFrame(
  source: HTMLVideoElement | HTMLCanvasElement,
  fx: VideoFxSettings,
  targetCanvas: HTMLCanvasElement,
  options?: {
    applyMirror?: boolean;
    applyColorFilter?: boolean;
    bgImg?: HTMLImageElement | null;
  }
) {
  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return;

  const w = targetCanvas.width;
  const h = targetCanvas.height;
  if (!w || !h) return;

  const sw =
    source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const sh =
    source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  if (!sw || !sh) return;

  const mode = resolveBgMode(fx);
  const applyMirror = options?.applyMirror ?? false;
  const applyColorFilter = options?.applyColorFilter ?? true;
  const colorFilter = applyColorFilter
    ? `brightness(${fx.brightness}%) contrast(${fx.contrast}%) saturate(${fx.saturation}%)`
    : 'none';

  // Helper to cover-draw source with optional mirror
  const drawCoverSource = (c: CanvasRenderingContext2D, filterStr: string) => {
    const scale = Math.max(w / sw, h / sh);
    const cw = w / scale;
    const ch = h / scale;
    const sx = (sw - cw) / 2;
    const sy = (sh - ch) / 2;

    c.save();
    c.filter = filterStr;
    if (applyMirror) {
      c.translate(w, 0);
      c.scale(-1, 1);
    }
    c.drawImage(source, sx, sy, cw, ch, 0, 0, w, h);
    c.restore();
  };

  if (mode === 'natural' || mode === 'dim') {
    drawCoverSource(ctx, colorFilter);
    if (mode === 'dim') {
      const vig = ctx.createRadialGradient(
        w * 0.5,
        h * 0.45,
        Math.min(w, h) * 0.24,
        w * 0.5,
        h * 0.45,
        Math.max(w, h) * 0.66
      );
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(5,9,20,0.72)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    }
    return;
  }

  const scratch = getScratch(targetCanvas);
  if (!scratch) {
    drawCoverSource(ctx, colorFilter);
    return;
  }

  // Downsample to 160x90 matching cover framing
  const scale = Math.max(w / sw, h / sh);
  const cw = w / scale;
  const ch = h / scale;
  const sx = (sw - cw) / 2;
  const sy = (sh - ch) / 2;

  scratch.sampleCtx.save();
  scratch.sampleCtx.clearRect(0, 0, SAMPLE_W, SAMPLE_H);
  if (applyMirror) {
    scratch.sampleCtx.translate(SAMPLE_W, 0);
    scratch.sampleCtx.scale(-1, 1);
  }
  scratch.sampleCtx.drawImage(source, sx, sy, cw, ch, 0, 0, SAMPLE_W, SAMPLE_H);
  scratch.sampleCtx.restore();

  const srcPixels = scratch.sampleCtx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;

  if (mode === 'greenscreen') {
    computeChromaAlpha(
      srcPixels,
      scratch.alphaImg.data,
      fx.chromaColor || '#16a34a',
      fx.chromaTolerance ?? 38
    );
  } else {
    computeAdaptiveCutoutAlpha(
      srcPixels,
      scratch.alphaImg.data,
      fx.cutoutSensitivity ?? 55
    );
  }

  scratch.maskCtx.putImageData(scratch.alphaImg, 0, 0);

  // Prepare sharp foreground clipped by feathered alpha matte
  scratch.fgCtx.save();
  scratch.fgCtx.globalCompositeOperation = 'source-over';
  scratch.fgCtx.clearRect(0, 0, w, h);
  drawCoverSource(scratch.fgCtx, colorFilter);
  scratch.fgCtx.globalCompositeOperation = 'destination-in';
  scratch.fgCtx.filter = 'blur(2.4px)';
  scratch.fgCtx.drawImage(scratch.maskCanvas, 0, 0, w, h);
  scratch.fgCtx.restore();

  if (mode === 'blur') {
    const blurPx = Math.max(4, Math.min(24, fx.blurAmount ?? 14));
    scratch.bgBlurCtx.save();
    scratch.bgBlurCtx.clearRect(0, 0, w, h);
    drawCoverSource(
      scratch.bgBlurCtx,
      `${colorFilter === 'none' ? '' : `${colorFilter} `}blur(${blurPx}px)`
    );
    scratch.bgBlurCtx.restore();

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(scratch.bgBlurCanvas, 0, 0, w, h);
    ctx.drawImage(scratch.fgCanvas, 0, 0, w, h);
    return;
  }

  // 'cutout' or 'greenscreen': render virtual backdrop first, then crisp foreground subject
  ctx.clearRect(0, 0, w, h);
  drawVirtualBackdrop(ctx, w, h, fx, options?.bgImg);
  ctx.drawImage(scratch.fgCanvas, 0, 0, w, h);
}
