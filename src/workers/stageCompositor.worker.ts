/// <reference lib="webworker" />

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface BackdropPresetData {
  gradient: [string, string];
  gridTint: string;
}

interface WorkerParticipant {
  id: string;
  name: string;
  initials: string;
  avatarUrl?: string;
  onStage: boolean;
  micOn: boolean;
  camOn: boolean;
}

interface WorkerCustomElement {
  id: string;
  kind: 'participant' | 'media' | 'text' | 'clock' | 'block' | 'qr' | 'chat' | 'ai' | 'image';
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  participantId?: string;
  text?: string;
  color?: string;
  bg?: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  fontSize?: number;
  locked?: boolean;
  hidden?: boolean;
  countdownEndAt?: number;
  imageUrl?: string;
}

interface WorkerRoomSnapshot {
  roomCode: string;
  title: string;
  aspectRatio: '16:9' | '9:16';
  watchMode: 'standard' | 'shop' | 'gamer';
  participants: WorkerParticipant[];
  scene: {
    templateId: string;
    transitionType: 'cut' | 'dissolve' | 'slide' | 'push';
    transitionMs: number;
    customElements: WorkerCustomElement[];
  };
  overlays: {
    banner: { visible: boolean; title: string; subtitle: string; style: string };
    ticker: { visible: boolean; text: string };
    featuredChatId: string | null;
    featuredQuestionId?: string | null;
    chatOverlayOnStage?: boolean;
    showSupportQrOnStage?: boolean;
    captionsEnabled: boolean;
    captionText: string;
    captionStyle?: 'glass' | 'bar' | 'minimal';
    countdownEndAt?: number | null;
    countdownLabel?: string;
  };
  brand: {
    accent: string;
    backdrop: string;
    customBackdropUrl?: string;
    customOverlayUrl?: string;
    backdropDim: number;
    font: string;
    frame: 'none' | 'border' | 'corners' | 'vignette';
    nameTagStyle?: 'glass' | 'solid' | 'outline' | 'minimal';
    showNames: boolean;
    logoUrl?: string;
    logoPosition: 'tl' | 'tr' | 'bl' | 'br';
    logoSize: number;
    sponsorsEnabled?: boolean;
    sponsorIntervalSec?: number;
    sponsors?: Array<{ id: string; label: string }>;
  };
  commerce: {
    storeLabel: string;
    pinnedProductId: string | null;
    products: Array<{
      id: string;
      source: string;
      title: string;
      price: number;
      stock: number;
      imageUrl: string;
    }>;
    activeFlashSale?: {
      productId: string;
      discountPct: number;
      totalUnits: number;
      soldUnits: number;
      endsAt: number;
      active: boolean;
    } | null;
    latestSalePopup?: {
      id: string;
      orderNumber: string;
      buyerName: string;
      buyerCity: string;
      productTitle: string;
      source: string;
      quantity: number;
      total: number;
      remainingStock: number;
      createdAt: number;
    } | null;
  };
  gamer: {
    gameTitle: string;
    activePoll: {
      question: string;
      options: Array<{ id: string; label: string; votes: number }>;
      isOpen: boolean;
      showOnStage: boolean;
    } | null;
  };
  hypeTrain?: {
    active: boolean;
    level: number;
    points: number;
    goalPoints: number;
    endsAt: number;
  };
  questions?: Array<{ id: string; author: string; text: string; upvotes: number }>;
  chatMessages: Array<{
    id: string;
    author: string;
    role: string;
    source: string;
    audience?: 'public' | 'studio';
    text: string;
    superChat?: { amount: number; method: string; tier: string };
  }>;
}

interface WorkerVideoFx {
  brightness: number;
  contrast: number;
  saturation: number;
  mirror: boolean;
  blurBg: boolean;
  bgMode?: 'natural' | 'blur' | 'dim';
}

const BACKDROP_MAP: Record<string, BackdropPresetData> = {
  dusk: { gradient: ['#0a1226', '#162447'], gridTint: 'rgba(138, 180, 255, 0.05)' },
  graphite: { gradient: ['#0d1017', '#1a202c'], gridTint: 'rgba(255, 255, 255, 0.04)' },
  ember: { gradient: ['#1b0f17', '#321622'], gridTint: 'rgba(251, 146, 60, 0.05)' },
  forest: { gradient: ['#091915', '#122f26'], gridTint: 'rgba(52, 211, 153, 0.05)' },
  paper: { gradient: ['#f4f1ea', '#e8e2d5'], gridTint: 'rgba(15, 23, 42, 0.06)' },
};

let stageW = 1280;
let stageH = 720;
let offscreen = new OffscreenCanvas(stageW, stageH);
let ctx = offscreen.getContext('2d', { alpha: false });
let prevSnapshot: OffscreenCanvas | null = null;
let transitionStart = 0;
let lastTemplateId = '';

let room: WorkerRoomSnapshot | null = null;
let localClientId = '';
let videoFx: WorkerVideoFx = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  mirror: false,
  blurBg: false,
  bgMode: 'natural',
};
let viewerMode = false;
let hasMedia = false;

const videoBitmaps = new Map<string, ImageBitmap>();
const staticAssets = new Map<string, ImageBitmap>();
let mediaBitmap: ImageBitmap | null = null;

const startTs = performance.now();
let renderTimer: number | null = null;

function drawRoundedRect(
  c: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + radius, y);
  c.arcTo(x + w, y, x + w, y + h, radius);
  c.arcTo(x + w, y + h, x, y + h, radius);
  c.arcTo(x, y + h, x, y, radius);
  c.arcTo(x, y, x + w, y, radius);
  c.closePath();
}

function drawImageCover(
  c: OffscreenCanvasRenderingContext2D,
  source: ImageBitmap,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  mirror = false
) {
  const sw = source.width;
  const sh = source.height;
  if (!sw || !sh) return;
  const scale = Math.max(dw / sw, dh / sh);
  const cw = dw / scale;
  const ch = dh / scale;
  const sx = (sw - cw) / 2;
  const sy = (sh - ch) / 2;

  c.save();
  if (mirror) {
    c.translate(dx + dw, dy);
    c.scale(-1, 1);
    c.drawImage(source, sx, sy, cw, ch, 0, 0, dw, dh);
  } else {
    c.drawImage(source, sx, sy, cw, ch, dx, dy, dw, dh);
  }
  c.restore();
}

function drawImageContain(
  c: OffscreenCanvasRenderingContext2D,
  source: ImageBitmap,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const sw = source.width;
  const sh = source.height;
  if (!sw || !sh) return;
  const scale = Math.min(dw / sw, dh / sh);
  const rw = sw * scale;
  const rh = sh * scale;
  const rx = dx + (dw - rw) / 2;
  const ry = dy + (dh - rh) / 2;
  c.drawImage(source, 0, 0, sw, sh, rx, ry, rw, rh);
}

function drawParticipantTile(
  c: OffscreenCanvasRenderingContext2D,
  p: WorkerParticipant,
  rect: Rect,
  accent: string,
  showNames: boolean
) {
  if (!room) return;
  const pad = viewerMode ? 0 : 6;
  const radius = viewerMode ? 0 : 14;
  const rx = rect.x + pad;
  const ry = rect.y + pad;
  const rw = Math.max(40, rect.w - pad * 2);
  const rh = Math.max(40, rect.h - pad * 2);

  c.save();
  if (radius > 0) {
    drawRoundedRect(c, rx, ry, rw, rh, radius);
    c.clip();
  } else {
    c.beginPath();
    c.rect(rx, ry, rw, rh);
    c.clip();
  }

  c.fillStyle = '#0f172a';
  c.fillRect(rx, ry, rw, rh);

  const liveBmp = p.camOn ? videoBitmaps.get(p.id) : undefined;
  if (liveBmp && liveBmp.width > 0) {
    if (p.id === localClientId) {
      c.filter = `brightness(${videoFx.brightness}%) contrast(${videoFx.contrast}%) saturate(${videoFx.saturation}%)`;
    }
    drawImageCover(c, liveBmp, rx, ry, rw, rh, p.id === localClientId && videoFx.mirror);
    c.filter = 'none';
    if (
      p.id === localClientId &&
      (videoFx.bgMode === 'blur' || videoFx.bgMode === 'dim' || videoFx.blurBg)
    ) {
      const edge = c.createRadialGradient(
        rx + rw / 2,
        ry + rh / 2,
        Math.min(rw, rh) * 0.28,
        rx + rw / 2,
        ry + rh / 2,
        Math.max(rw, rh) * 0.65
      );
      edge.addColorStop(0, 'rgba(0,0,0,0)');
      edge.addColorStop(
        1,
        videoFx.bgMode === 'dim' ? 'rgba(6,10,22,0.72)' : 'rgba(10,16,32,0.52)'
      );
      c.fillStyle = edge;
      c.fillRect(rx, ry, rw, rh);
    }
  } else if (p.avatarUrl && staticAssets.has(`avatar:${p.avatarUrl}`)) {
    const av = staticAssets.get(`avatar:${p.avatarUrl}`)!;
    drawImageCover(c, av, rx, ry, rw, rh, false);
    const scrim = c.createLinearGradient(rx, ry + rh * 0.5, rx, ry + rh);
    scrim.addColorStop(0, 'rgba(8, 12, 22, 0)');
    scrim.addColorStop(1, 'rgba(8, 12, 22, 0.72)');
    c.fillStyle = scrim;
    c.fillRect(rx, ry, rw, rh);
  } else {
    const grad = c.createLinearGradient(rx, ry, rx + rw, ry + rh);
    grad.addColorStop(0, '#0d1426');
    grad.addColorStop(1, '#070b16');
    c.fillStyle = grad;
    c.fillRect(rx, ry, rw, rh);

    const cx = rx + rw / 2;
    const cy = ry + rh / 2 - 6;
    const radius = Math.min(rw, rh) * 0.145;

    const halo = c.createRadialGradient(cx, cy, radius * 0.35, cx, cy, radius * 2.8);
    halo.addColorStop(0, 'rgba(59, 130, 246, 0.16)');
    halo.addColorStop(1, 'rgba(7, 11, 22, 0)');
    c.fillStyle = halo;
    c.fillRect(rx, ry, rw, rh);

    c.beginPath();
    c.arc(cx, cy, radius + 7, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    c.lineWidth = 1;
    c.stroke();

    const badgeGrad = c.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    badgeGrad.addColorStop(0, '#18274b');
    badgeGrad.addColorStop(1, '#0b1224');
    c.beginPath();
    c.arc(cx, cy, radius, 0, Math.PI * 2);
    c.fillStyle = badgeGrad;
    c.fill();
    c.strokeStyle = accent;
    c.lineWidth = 1.5;
    c.stroke();

    c.fillStyle = '#f8fafc';
    c.font = `700 ${Math.max(16, Math.round(radius * 0.66))}px "Manrope", "Plus Jakarta Sans", sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(p.initials, cx, cy + 1);

    c.fillStyle = 'rgba(148, 163, 184, 0.78)';
    c.font = '500 11px "Manrope", "Plus Jakarta Sans", sans-serif';
    c.fillText('Camera off', cx, cy + radius + 20);
  }

  if (!viewerMode) {
    c.strokeStyle = 'rgba(255,255,255,0.1)';
    c.lineWidth = 1;
    drawRoundedRect(c, rx, ry, rw, rh, 12);
    c.stroke();
  }

  if (showNames) {
    const labelText = `${p.name}${!p.micOn ? ' · Muted' : ''}`;
    const tagStyle = room.brand.nameTagStyle || 'glass';
    c.font = '600 13px "Manrope", "Plus Jakarta Sans", sans-serif';
    const metrics = c.measureText(labelText);
    const bw = Math.min(rw - 24, metrics.width + 24);
    const bx = rx + 12;
    let by = ry + rh - (viewerMode ? 58 : 40);
    // Lift the name tag above the lower-third banner when they would collide.
    const bannerOn =
      room.overlays.banner.visible &&
      room.overlays.banner.title &&
      !(viewerMode && room.watchMode === 'shop');
    if (bannerOn) {
      const bannerTop = room.overlays.ticker.visible ? stageH - 124 : viewerMode ? stageH - 110 : stageH - 98;
      const bannerRight = 34 + Math.min(stageW - 68, 640);
      if (by + 28 > bannerTop - 8 && bx < bannerRight && bx + bw > 34) {
        by = Math.max(ry + 8, bannerTop - 8 - 28);
      }
    }

    if (tagStyle === 'solid') {
      c.fillStyle = accent;
      drawRoundedRect(c, bx, by, bw, 28, 7);
      c.fill();
    } else if (tagStyle === 'outline') {
      c.fillStyle = 'rgba(6, 10, 22, 0.52)';
      drawRoundedRect(c, bx, by, bw, 28, 7);
      c.fill();
      c.strokeStyle = accent;
      c.lineWidth = 1.5;
      drawRoundedRect(c, bx, by, bw, 28, 7);
      c.stroke();
    } else if (tagStyle === 'minimal') {
      const scrim = c.createLinearGradient(bx - 6, by, bx + bw, by);
      scrim.addColorStop(0, 'rgba(6, 10, 22, 0.68)');
      scrim.addColorStop(1, 'rgba(6, 10, 22, 0)');
      c.fillStyle = scrim;
      drawRoundedRect(c, bx, by, bw + 12, 28, 6);
      c.fill();
    } else {
      c.fillStyle = 'rgba(10, 17, 35, 0.76)';
      drawRoundedRect(c, bx, by, bw, 28, 8);
      c.fill();
      c.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      c.lineWidth = 1;
      drawRoundedRect(c, bx, by, bw, 28, 8);
      c.stroke();
    }

    c.fillStyle = '#f8fafc';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(labelText, bx + 11, by + 14.5, bw - 20);
  }

  c.restore();
}

function drawMediaSlot(c: OffscreenCanvasRenderingContext2D, rect: Rect) {
  if (!room) return;
  const pad = viewerMode ? 0 : 6;
  const radius = viewerMode ? 0 : 14;
  const rx = rect.x + pad;
  const ry = rect.y + pad;
  const rw = Math.max(60, rect.w - pad * 2);
  const rh = Math.max(60, rect.h - pad * 2);

  c.save();
  if (radius > 0) {
    drawRoundedRect(c, rx, ry, rw, rh, radius);
    c.clip();
  } else {
    c.beginPath();
    c.rect(rx, ry, rw, rh);
    c.clip();
  }
  c.fillStyle = '#070b14';
  c.fillRect(rx, ry, rw, rh);

  const screenBmp = videoBitmaps.get('__screen__');
  if (screenBmp && screenBmp.width > 0) {
    drawImageContain(c, screenBmp, rx, ry, rw, rh);
  } else if (mediaBitmap && mediaBitmap.width > 0) {
    drawImageContain(c, mediaBitmap, rx, ry, rw, rh);
  } else if (viewerMode) {
    const slateGrad = c.createLinearGradient(rx, ry, rx + rw, ry + rh);
    slateGrad.addColorStop(0, '#0d1528');
    slateGrad.addColorStop(1, '#12213f');
    c.fillStyle = slateGrad;
    c.fillRect(rx, ry, rw, rh);

    c.fillStyle = '#7fa8ff';
    c.font = '700 12px "JetBrains Mono", monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const slateTag =
      room.watchMode === 'gamer'
        ? room.gamer.gameTitle.toUpperCase()
        : room.watchMode === 'shop'
        ? room.commerce.storeLabel.toUpperCase()
        : 'LIVE BROADCAST · GATHER STUDIO';
    c.fillText(slateTag, rx + rw / 2, ry + rh / 2 - 18, rw - 48);

    c.fillStyle = '#eef2f9';
    c.font = `700 24px "${room.brand.font}", sans-serif`;
    c.fillText(room.title || 'Live Broadcast', rx + rw / 2, ry + rh / 2 + 12, rw - 48);
  } else {
    c.fillStyle = '#11192e';
    c.fillRect(rx, ry, rw, rh);
    c.fillStyle = '#8a97ae';
    c.font = '600 18px "Manrope", "Plus Jakarta Sans", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(
      'Share your screen or drop PDF / Video / Image here',
      rx + rw / 2,
      ry + rh / 2
    );
  }

  if (!viewerMode) {
    c.strokeStyle = 'rgba(255,255,255,0.12)';
    c.lineWidth = 1.5;
    drawRoundedRect(c, rx, ry, rw, rh, 14);
    c.stroke();
  }
  c.restore();
}

function renderFrame(now: number) {
  if (!ctx || !room) return;
  const w = stageW;
  const h = stageH;
  const isVertical = room.aspectRatio === '9:16';
  const preset = BACKDROP_MAP[room.brand.backdrop] || BACKDROP_MAP.dusk;
  const accent = room.brand.accent || '#2f6bf0';

  // 1. Backdrop
  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, preset.gradient[0]);
  bgGrad.addColorStop(1, preset.gradient[1]);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  const customBg = room.brand.customBackdropUrl
    ? staticAssets.get(`bg:${room.brand.customBackdropUrl}`)
    : undefined;
  if (customBg) {
    drawImageCover(ctx, customBg, 0, 0, w, h);
    ctx.fillStyle = `rgba(8, 12, 22, ${room.brand.backdropDim / 100})`;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.strokeStyle = preset.gridTint;
    ctx.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 80) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (let gy = 0; gy < h; gy += 80) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }
  }

  // 2. Active Participants & Scene Layout
  const onStage = room.participants.filter((p) => p.onStage).slice(0, 6);
  const pad = viewerMode ? 0 : 26;
  const area: Rect = { x: pad, y: pad, w: w - pad * 2, h: h - pad * 2 };
  const tpl = room.scene.templateId;
  const qrAsset = staticAssets.get('qr');

  if (
    room.scene.customElements.length > 0 &&
    (tpl === 'custom' || tpl.startsWith('custom-'))
  ) {
    for (const el of room.scene.customElements) {
      if (el.hidden) continue;
      const rect = { x: el.x * w, y: el.y * h, w: el.w * w, h: el.h * h };
      if (el.kind === 'media') {
        drawMediaSlot(ctx, rect);
      } else if (el.kind === 'participant') {
        const p = onStage.find((item) => item.id === el.participantId) || onStage[0];
        if (p) drawParticipantTile(ctx, p, rect, accent, room.brand.showNames);
      } else if (el.kind === 'block') {
        ctx.save();
        ctx.fillStyle = el.bg || el.color || 'rgba(15, 23, 42, 0.85)';
        drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.5;
        drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
        ctx.stroke();
        if (el.text) {
          ctx.fillStyle = '#f8fafc';
          ctx.font = `600 14px "Manrope", "Plus Jakarta Sans", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(el.text, rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w - 20);
        }
        ctx.restore();
      } else if (el.kind === 'text') {
        ctx.save();
        const bgStyle = el.bg ?? 'rgba(8, 12, 22, 0.82)';
        if (bgStyle && bgStyle !== 'transparent') {
          ctx.fillStyle = bgStyle;
          drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 10);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.14)';
          ctx.lineWidth = 1;
          drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 10);
          ctx.stroke();
        }
        ctx.fillStyle = el.color || '#f8fafc';
        const weight = el.bold === false ? 500 : 700;
        const px = el.fontSize
          ? Math.max(12, Math.min(54, el.fontSize))
          : Math.max(15, Math.min(32, Math.round(rect.h * 0.36)));
        ctx.font = `${weight} ${px}px "${room.brand.font}", "Plus Jakarta Sans", sans-serif`;
        const align = el.align || 'center';
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        const tx =
          align === 'left'
            ? rect.x + 14
            : align === 'right'
            ? rect.x + rect.w - 14
            : rect.x + rect.w / 2;
        ctx.fillText(el.text || el.label, tx, rect.y + rect.h / 2, rect.w - 28);
        ctx.restore();
      } else if (el.kind === 'clock') {
        ctx.save();
        ctx.fillStyle = el.bg || 'rgba(8, 12, 22, 0.86)';
        drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 10);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.5;
        drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 10);
        ctx.stroke();
        let displayStr = '';
        if (el.countdownEndAt && el.countdownEndAt > Date.now()) {
          const rem = Math.max(0, Math.ceil((el.countdownEndAt - Date.now()) / 1000));
          const mm = String(Math.floor(rem / 60)).padStart(2, '0');
          const ss = String(rem % 60).padStart(2, '0');
          displayStr = `${mm}:${ss}`;
        } else {
          displayStr = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
        }
        ctx.fillStyle = el.color || '#ffffff';
        ctx.font = `700 ${Math.max(18, Math.min(34, Math.round(rect.h * 0.42)))}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayStr, rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w - 20);
        ctx.restore();
      } else if (el.kind === 'chat') {
        ctx.save();
        ctx.fillStyle = el.bg || 'rgba(8, 12, 22, 0.84)';
        drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.lineWidth = 1;
        drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
        ctx.stroke();

        ctx.fillStyle = accent;
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText((el.label || 'LIVE CHAT').toUpperCase(), rect.x + 12, rect.y + 10);

        const feed = room.chatMessages
          .filter((m) => m.role !== 'system' && m.role !== 'payment-card' && m.audience !== 'studio')
          .slice(-Math.max(2, Math.floor((rect.h - 34) / 26)));
        let yCursor = rect.y + 30;
        for (const m of feed) {
          ctx.fillStyle = m.superChat ? '#34d399' : '#93c5fd';
          ctx.font = '700 11px "Manrope", "Plus Jakarta Sans", sans-serif';
          const pre = `${m.author}: `;
          const pw = Math.min(rect.w * 0.38, ctx.measureText(pre).width);
          ctx.fillText(pre, rect.x + 12, yCursor, pw);
          ctx.fillStyle = '#f8fafc';
          ctx.font = '500 11px "Manrope", "Plus Jakarta Sans", sans-serif';
          ctx.fillText(m.text, rect.x + 14 + pw, yCursor, rect.w - pw - 26);
          yCursor += 24;
          if (yCursor > rect.y + rect.h - 14) break;
        }
        ctx.restore();
      } else if (el.kind === 'ai') {
        ctx.save();
        const aiGrad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
        aiGrad.addColorStop(0, 'rgba(30, 41, 82, 0.88)');
        aiGrad.addColorStop(1, 'rgba(15, 23, 42, 0.92)');
        ctx.fillStyle = el.bg || aiGrad;
        drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(125, 211, 252, 0.42)';
        ctx.lineWidth = 1.2;
        drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
        ctx.stroke();

        ctx.fillStyle = '#7dd3fc';
        ctx.font = '700 10.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('CUE AI · STAGE BRIEF', rect.x + 14, rect.y + 12);

        ctx.fillStyle = el.color || '#f8fafc';
        ctx.font = '600 13px "Manrope", "Plus Jakarta Sans", sans-serif';
        ctx.fillText(
          el.text || room.overlays.banner.subtitle || 'Live context & talking points synced',
          rect.x + 14,
          rect.y + 34,
          rect.w - 28
        );
        ctx.restore();
      } else if (el.kind === 'image') {
        drawMediaSlot(ctx, rect);
      } else if (el.kind === 'qr' && qrAsset) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 10);
        ctx.fill();
        const padQr = Math.min(rect.w, rect.h) * 0.1;
        const qrSize = Math.min(rect.w, rect.h) - padQr * 2;
        ctx.drawImage(
          qrAsset,
          rect.x + (rect.w - qrSize) / 2,
          rect.y + (rect.h - qrSize) / 2,
          qrSize,
          qrSize
        );
        ctx.restore();
      }
    }
  } else if ((tpl === 'full-media' || (hasMedia && tpl === 'solo')) && !isVertical) {
    drawMediaSlot(ctx, area);
  } else if (tpl === 'screen-cam' || tpl === 'slides-cam') {
    const mediaW = area.w * 0.72;
    drawMediaSlot(ctx, { x: area.x, y: area.y, w: mediaW, h: area.h });
    const sideW = area.w - mediaW;
    const count = Math.max(1, Math.min(3, onStage.length));
    const tileH = area.h / count;
    onStage.slice(0, count).forEach((p, idx) => {
      drawParticipantTile(
        ctx!,
        p,
        { x: area.x + mediaW, y: area.y + idx * tileH, w: sideW, h: tileH },
        accent,
        room!.brand.showNames
      );
    });
  } else if (tpl === 'pip') {
    drawMediaSlot(ctx, area);
    if (onStage[0]) {
      const pipW = 280;
      const pipH = 164;
      drawParticipantTile(
        ctx,
        onStage[0],
        { x: area.x + area.w - pipW - 14, y: area.y + area.h - pipH - 14, w: pipW, h: pipH },
        accent,
        room.brand.showNames
      );
    }
  } else if (tpl === 'v-screen' || tpl === 'v-slides') {
    drawMediaSlot(ctx, { x: area.x, y: area.y, w: area.w, h: area.h * 0.62 });
    if (onStage[0]) {
      drawParticipantTile(
        ctx,
        onStage[0],
        { x: area.x, y: area.y + area.h * 0.62, w: area.w, h: area.h * 0.38 },
        accent,
        room.brand.showNames
      );
    }
  } else if (tpl === 'v-duo') {
    const halfH = area.h / 2;
    onStage.slice(0, 2).forEach((p, idx) => {
      drawParticipantTile(
        ctx!,
        p,
        { x: area.x, y: area.y + idx * halfH, w: area.w, h: halfH },
        accent,
        room!.brand.showNames
      );
    });
  } else if (tpl === 'spotlight' && onStage.length > 1) {
    const leadW = area.w * 0.68;
    drawParticipantTile(
      ctx,
      onStage[0],
      { x: area.x, y: area.y, w: leadW, h: area.h },
      accent,
      room.brand.showNames
    );
    const others = onStage.slice(1);
    const slotH = area.h / others.length;
    others.forEach((p, idx) => {
      drawParticipantTile(
        ctx!,
        p,
        { x: area.x + leadW, y: area.y + idx * slotH, w: area.w - leadW, h: slotH },
        accent,
        room!.brand.showNames
      );
    });
  } else if (tpl === 'duo' && onStage.length >= 2) {
    const halfW = area.w / 2;
    onStage.slice(0, 2).forEach((p, idx) => {
      drawParticipantTile(
        ctx!,
        p,
        { x: area.x + idx * halfW, y: area.y, w: halfW, h: area.h },
        accent,
        room!.brand.showNames
      );
    });
  } else {
    if (onStage.length === 0) {
      ctx.fillStyle = '#8a97ae';
      ctx.font = '600 20px "Manrope", "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No speakers on stage — toggle a crew member in the dock', w / 2, h / 2);
    } else {
      const cols = onStage.length === 1 ? 1 : onStage.length <= 4 ? 2 : 3;
      const rows = Math.ceil(onStage.length / cols);
      const cw = area.w / cols;
      const ch = area.h / rows;
      onStage.forEach((p, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        drawParticipantTile(
          ctx!,
          p,
          { x: area.x + col * cw, y: area.y + row * ch, w: cw, h: ch },
          accent,
          room!.brand.showNames
        );
      });
    }
  }

  // 2b. Custom PNG Overlay
  const customOverlay = room.brand.customOverlayUrl
    ? staticAssets.get(`overlay:${room.brand.customOverlayUrl}`)
    : undefined;
  if (customOverlay) {
    ctx.drawImage(customOverlay, 0, 0, w, h);
  }

  // 3. Pinned Product Drop + Flash Sale HUD
  const pinnedProd =
    !viewerMode && room.watchMode === 'shop'
      ? room.commerce.products.find((pr) => pr.id === room!.commerce.pinnedProductId)
      : undefined;
  const activeFlash =
    room.watchMode === 'shop' &&
    room.commerce.activeFlashSale?.active &&
    room.commerce.activeFlashSale.endsAt > Date.now()
      ? room.commerce.activeFlashSale
      : null;

  if (pinnedProd) {
    const isFlashProd = activeFlash && activeFlash.productId === pinnedProd.id;
    const cardW = isVertical ? w - 64 : isFlashProd ? 416 : 368;
    const cardH = isFlashProd ? 132 : 108;
    const cx = isVertical ? 32 : w - cardW - 34;
    const cy = room.overlays.banner.visible ? h - cardH - 134 : h - cardH - 54;

    ctx.save();
    ctx.fillStyle = isFlashProd ? 'rgba(14, 14, 30, 0.94)' : 'rgba(10, 15, 28, 0.90)';
    drawRoundedRect(ctx, cx, cy, cardW, cardH, 12);
    ctx.fill();
    ctx.strokeStyle = isFlashProd ? '#f59e0b' : accent;
    ctx.lineWidth = isFlashProd ? 2 : 1.5;
    drawRoundedRect(ctx, cx, cy, cardW, cardH, 12);
    ctx.stroke();

    const pImg = staticAssets.get(`product:${pinnedProd.imageUrl}`);
    if (pImg) {
      ctx.save();
      drawRoundedRect(ctx, cx + 10, cy + 10, 88, 88, 8);
      ctx.clip();
      drawImageCover(ctx, pImg, cx + 10, cy + 10, 88, 88);
      ctx.restore();
    }

    if (isFlashProd && activeFlash) {
      const remFlashSec = Math.max(0, Math.ceil((activeFlash.endsAt - Date.now()) / 1000));
      const fMin = String(Math.floor(remFlashSec / 60)).padStart(2, '0');
      const fSec = String(remFlashSec % 60).padStart(2, '0');
      const flashUnitLeft = Math.max(0, activeFlash.totalUnits - activeFlash.soldUnits);
      const flashPrice = pinnedProd.price * (1 - activeFlash.discountPct / 100);

      ctx.fillStyle = '#fbbf24';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(
        `TV FLASH DEAL · ${fMin}:${fSec} · ONLY ${flashUnitLeft}/${activeFlash.totalUnits} LEFT`,
        cx + 110,
        cy + 12,
        cardW - 196
      );
      ctx.fillStyle = '#f8fafc';
      ctx.font = `700 15px "${room.brand.font}", sans-serif`;
      ctx.fillText(pinnedProd.title, cx + 110, cy + 31, cardW - 196);
      ctx.fillStyle = '#34d399';
      ctx.font = '700 19px "JetBrains Mono", monospace';
      ctx.fillText(`$${flashPrice.toFixed(2)}`, cx + 110, cy + 56);

      const barX = cx + 10;
      const barY = cy + cardH - 22;
      const barW = cardW - 96;
      const pctLeft = Math.max(
        0.06,
        Math.min(1, flashUnitLeft / Math.max(1, activeFlash.totalUnits))
      );
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      drawRoundedRect(ctx, barX, barY, barW, 10, 5);
      ctx.fill();
      ctx.fillStyle = flashUnitLeft <= 4 ? '#f43f5e' : '#f59e0b';
      drawRoundedRect(ctx, barX, barY, barW * pctLeft, 10, 5);
      ctx.fill();
    } else {
      ctx.fillStyle = '#7fa8ff';
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(
        `${pinnedProd.source.toUpperCase()} · ${pinnedProd.stock} LEFT`,
        cx + 110,
        cy + 14
      );
      ctx.fillStyle = '#f8fafc';
      ctx.font = `700 15px "${room.brand.font}", sans-serif`;
      ctx.fillText(pinnedProd.title, cx + 110, cy + 33, cardW - 190);
      ctx.fillStyle = '#34d399';
      ctx.font = '700 18px "JetBrains Mono", monospace';
      ctx.fillText(`$${pinnedProd.price.toFixed(2)}`, cx + 110, cy + 64);
    }

    if (qrAsset) {
      ctx.fillStyle = '#ffffff';
      drawRoundedRect(ctx, cx + cardW - 76, cy + 16, 62, 62, 6);
      ctx.fill();
      ctx.drawImage(qrAsset, cx + cardW - 73, cy + 19, 56, 56);
      ctx.fillStyle = '#aab5ca';
      ctx.font = '500 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('IN-STREAM', cx + cardW - 45, cy + 84);
    }
    ctx.restore();
  }

  // 3b. Live On-Screen Order Popup
  const salePopup = room.commerce.latestSalePopup;
  if (salePopup && Date.now() - salePopup.createdAt < 7500) {
    const ageMs = Date.now() - salePopup.createdAt;
    const enterT = Math.min(1, ageMs / 260);
    const exitT = ageMs > 6900 ? Math.max(0, (7500 - ageMs) / 600) : 1;
    const alpha = enterT * exitT;
    const slideOffset = (1 - enterT) * -24;

    const popW = Math.min(w - 68, 468);
    const popH = 78;
    const popX = (w - popW) / 2;
    const popY = 28 + slideOffset;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(8, 20, 28, 0.94)';
    drawRoundedRect(ctx, popX, popY, popW, popH, 14);
    ctx.fill();
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, popX, popY, popW, popH, 14);
    ctx.stroke();

    ctx.fillStyle = '#34d399';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(
      `LIVE ORDER ${salePopup.orderNumber} · ${salePopup.source.toUpperCase()} CHECKOUT`,
      popX + 18,
      popY + 12,
      popW - 36
    );
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 15px "Manrope", "Plus Jakarta Sans", sans-serif';
    ctx.fillText(
      `${salePopup.buyerName} (${salePopup.buyerCity}) grabbed ${salePopup.quantity}× ${salePopup.productTitle}`,
      popX + 18,
      popY + 31,
      popW - 36
    );
    ctx.fillStyle = '#fbbf24';
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillText(
      `$${salePopup.total.toFixed(2)} paid in-stream · Only ${salePopup.remainingStock} left!`,
      popX + 18,
      popY + 54,
      popW - 36
    );
    ctx.restore();
  }

  // 3c. Hype Train HUD
  const hypeTrain = room.hypeTrain;
  if (!viewerMode && hypeTrain && hypeTrain.active && hypeTrain.endsAt > Date.now()) {
    const remHypeSec = Math.max(0, Math.ceil((hypeTrain.endsAt - Date.now()) / 1000));
    const hm = String(Math.floor(remHypeSec / 60)).padStart(2, '0');
    const hs = String(remHypeSec % 60).padStart(2, '0');
    const pct = Math.min(
      100,
      Math.round((hypeTrain.points / Math.max(1, hypeTrain.goalPoints)) * 100)
    );
    const hw = 236;
    const hh = 48;
    const hx = w - hw - 34;
    const hy = 34;

    ctx.save();
    ctx.fillStyle = 'rgba(13, 18, 38, 0.88)';
    drawRoundedRect(ctx, hx, hy, hw, hh, 10);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.4;
    drawRoundedRect(ctx, hx, hy, hw, hh, 10);
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`HYPE TRAIN LVL ${hypeTrain.level} · ${hm}:${hs}`, hx + 12, hy + 9);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(`${pct}%`, hx + hw - 12, hy + 9);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    drawRoundedRect(ctx, hx + 12, hy + 28, hw - 24, 9, 4.5);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    drawRoundedRect(ctx, hx + 12, hy + 28, Math.max(8, ((hw - 24) * pct) / 100), 9, 4.5);
    ctx.fill();
    ctx.restore();
  }

  // 4. Gamer Poll Overlay
  const poll = room.gamer.activePoll;
  if (poll && poll.showOnStage && !(viewerMode && room.watchMode === 'gamer')) {
    const totalVotes = poll.options.reduce((acc, o) => acc + o.votes, 0);
    const pw = 310;
    const ph = 52 + poll.options.length * 32;
    const px = 34;
    const py = 34;
    ctx.save();
    ctx.fillStyle = 'rgba(10, 15, 28, 0.88)';
    drawRoundedRect(ctx, px, py, pw, ph, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, px, py, pw, ph, 12);
    ctx.stroke();

    ctx.fillStyle = '#7fa8ff';
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(
      `${poll.isOpen ? 'LIVE POLL' : 'FINAL RESULT'} · ${totalVotes} VOTES`,
      px + 14,
      py + 12
    );
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 14px "Manrope", "Plus Jakarta Sans", sans-serif';
    ctx.fillText(poll.question, px + 14, py + 29, pw - 28);

    poll.options.forEach((opt, i) => {
      const oy = py + 54 + i * 30;
      const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
      ctx!.fillStyle = 'rgba(255,255,255,0.08)';
      drawRoundedRect(ctx!, px + 14, oy, pw - 28, 22, 6);
      ctx!.fill();
      if (pct > 0) {
        ctx!.fillStyle = accent;
        drawRoundedRect(ctx!, px + 14, oy, Math.max(12, ((pw - 28) * pct) / 100), 22, 6);
        ctx!.fill();
      }
      ctx!.fillStyle = '#f8fafc';
      ctx!.font = '600 12px "Manrope", "Plus Jakarta Sans", sans-serif';
      ctx!.textBaseline = 'middle';
      ctx!.textAlign = 'left';
      ctx!.fillText(opt.label, px + 22, oy + 11, pw - 86);
      ctx!.font = '700 11px "JetBrains Mono", monospace';
      ctx!.textAlign = 'right';
      ctx!.fillText(`${pct}%`, px + pw - 22, oy + 11);
    });
    ctx.restore();
  }

  // 5. Featured Chat Comment Spotlight
  if (room.overlays.featuredChatId) {
    const feat = room.chatMessages.find((m) => m.id === room!.overlays.featuredChatId);
    if (feat) {
      const sc = feat.superChat;
      const scColor = sc
        ? sc.tier === 'rose'
          ? '#fb7185'
          : sc.tier === 'amber'
          ? '#f59e0b'
          : sc.tier === 'emerald'
          ? '#34d399'
          : '#60a5fa'
        : accent;
      const fw = Math.min(w - 80, 620);
      const fx = 34;
      const fy = h - 165;
      ctx.save();
      ctx.fillStyle = sc ? 'rgba(10, 16, 30, 0.94)' : 'rgba(10, 15, 28, 0.92)';
      drawRoundedRect(ctx, fx, fy, fw, 74, 12);
      ctx.fill();
      ctx.strokeStyle = scColor;
      ctx.lineWidth = sc ? 2 : 1.5;
      drawRoundedRect(ctx, fx, fy, fw, 74, 12);
      ctx.stroke();

      ctx.fillStyle = scColor;
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(
        sc
          ? `SUPER CHAT $${sc.amount.toFixed(0)} · ${sc.method.toUpperCase()} · ${feat.author}`
          : `${feat.author} · ${feat.source}`,
        fx + 16,
        fy + 12,
        fw - 32
      );
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 16px "Manrope", "Plus Jakarta Sans", sans-serif';
      ctx.fillText(feat.text, fx + 16, fy + 34, fw - 32);
      ctx.restore();
    }
  }

  // 5b. Featured Q&A Spotlight
  if (room.overlays.featuredQuestionId) {
    const qItem = (room.questions || []).find((q) => q.id === room!.overlays.featuredQuestionId);
    if (qItem) {
      const qw = Math.min(w - 80, 650);
      const qx = 34;
      const qy = h - 172;
      ctx.save();
      ctx.fillStyle = 'rgba(11, 18, 36, 0.93)';
      drawRoundedRect(ctx, qx, qy, qw, 80, 12);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.6;
      drawRoundedRect(ctx, qx, qy, qw, 80, 12);
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(
        `AUDIENCE Q&A · ${qItem.upvotes} UPVOTES · ${qItem.author.toUpperCase()}`,
        qx + 18,
        qy + 13,
        qw - 36
      );
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 16px "Manrope", "Plus Jakarta Sans", sans-serif';
      ctx.fillText(qItem.text, qx + 18, qy + 36, qw - 36);
      ctx.restore();
    }
  }

  // 5c. Compact Stage Chat Feed
  if (room.overlays.chatOverlayOnStage) {
    const recentChat = room.chatMessages
      .filter((m) => m.role !== 'system' && m.role !== 'payment-card' && m.audience !== 'studio')
      .slice(-3);
    if (recentChat.length > 0) {
      const cw = 320;
      const cx = w - cw - 34;
      let cy = h - (room.overlays.banner.visible ? 190 : 120) - recentChat.length * 44;
      recentChat.forEach((m) => {
        ctx!.save();
        ctx!.fillStyle =
          m.role === 'superchat' ? 'rgba(16, 185, 129, 0.24)' : 'rgba(10, 16, 32, 0.78)';
        drawRoundedRect(ctx!, cx, cy, cw, 38, 9);
        ctx!.fill();
        ctx!.strokeStyle =
          m.role === 'superchat' ? 'rgba(52, 211, 153, 0.55)' : 'rgba(255,255,255,0.12)';
        ctx!.lineWidth = 1;
        drawRoundedRect(ctx!, cx, cy, cw, 38, 9);
        ctx!.stroke();

        ctx!.fillStyle = '#93c5fd';
        ctx!.font = '700 11px "Manrope", "Plus Jakarta Sans", sans-serif';
        ctx!.textAlign = 'left';
        ctx!.textBaseline = 'middle';
        const prefix = m.superChat ? `${m.author} ($${m.superChat.amount}): ` : `${m.author}: `;
        const preW = Math.min(130, ctx!.measureText(prefix).width);
        ctx!.fillText(prefix, cx + 12, cy + 19, 130);
        ctx!.fillStyle = '#f8fafc';
        ctx!.font = '500 12px "Manrope", "Plus Jakarta Sans", sans-serif';
        ctx!.fillText(m.text, cx + 14 + preW, cy + 19, cw - preW - 26);
        ctx!.restore();
        cy += 44;
      });
    }
  }

  // 5d. On-Stage Support QR
  if (room.overlays.showSupportQrOnStage && qrAsset) {
    const sw = 186;
    const sh = 78;
    const sx = w - sw - 34;
    const sy = 96;
    ctx.save();
    ctx.fillStyle = 'rgba(10, 17, 35, 0.90)';
    drawRoundedRect(ctx, sx, sy, sw, sh, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, sx, sy, sw, sh, 12);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, sx + 10, sy + 10, 58, 58, 6);
    ctx.fill();
    ctx.drawImage(qrAsset, sx + 13, sy + 13, 52, 52);
    ctx.fillStyle = '#34d399';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('0% FEE TIP', sx + 78, sy + 16);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 12px "Manrope", "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Tip in Live Chat', sx + 78, sy + 32, 98);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 10px "Manrope", "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Instant · Direct', sx + 78, sy + 50, 98);
    ctx.restore();
  }

  // 5e. Rotating Sponsor Banner HUD
  if (room.brand.sponsorsEnabled && room.brand.sponsors && room.brand.sponsors.length > 0) {
    const intervalMs = Math.max(5, room.brand.sponsorIntervalSec || 15) * 1000;
    const activeIdx = Math.floor((now - startTs) / intervalMs) % room.brand.sponsors.length;
    const sp = room.brand.sponsors[activeIdx];
    if (sp) {
      const spW = 250;
      const spH = 48;
      const spX = 34;
      const spY = poll && poll.showOnStage ? 182 : 34;
      ctx.save();
      ctx.fillStyle = 'rgba(10, 17, 35, 0.86)';
      drawRoundedRect(ctx, spX, spY, spW, spH, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, spX, spY, spW, spH, 10);
      ctx.stroke();
      ctx.fillStyle = '#8ab4ff';
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('SPONSORED BY', spX + 14, spY + 8);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 13px "Manrope", "Plus Jakarta Sans", sans-serif';
      ctx.fillText(sp.label, spX + 14, spY + 22, spW - 28);
      ctx.restore();
    }
  }

  // 6. Lower-Third Banner
  if (
    room.overlays.banner.visible &&
    room.overlays.banner.title &&
    !(viewerMode && room.watchMode === 'shop')
  ) {
    const bx = 34;
    const by = room.overlays.ticker.visible ? h - 124 : viewerMode ? h - 110 : h - 98;
    const bw = Math.min(w - 68, 640);
    const bh = 64;
    ctx.save();
    if (room.overlays.banner.style === 'block') {
      ctx.fillStyle = accent;
    } else if (room.overlays.banner.style === 'minimal') {
      ctx.fillStyle = 'rgba(6, 10, 22, 0.65)';
    } else if (room.overlays.banner.style === 'glass') {
      ctx.fillStyle = 'rgba(13, 22, 44, 0.82)';
    } else {
      ctx.fillStyle = 'rgba(12, 18, 34, 0.92)';
    }
    drawRoundedRect(ctx, bx, by, bw, bh, 11);
    ctx.fill();
    if (room.overlays.banner.style !== 'block') {
      ctx.strokeStyle =
        room.overlays.banner.style === 'glass'
          ? 'rgba(138, 180, 255, 0.36)'
          : 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1.2;
      drawRoundedRect(ctx, bx, by, bw, bh, 11);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 20px "${room.brand.font}", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(room.overlays.banner.title, bx + 18, by + 12, bw - 36);
    if (room.overlays.banner.subtitle) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '500 13px "Manrope", "Plus Jakarta Sans", sans-serif';
      ctx.fillText(room.overlays.banner.subtitle, bx + 18, by + 39, bw - 36);
    }
    ctx.restore();
  }

  // 7. Live Captions
  if (room.overlays.captionsEnabled && room.overlays.captionText) {
    const capText = room.overlays.captionText.slice(-110);
    const cStyle = room.overlays.captionStyle || 'glass';
    ctx.save();
    ctx.font = '600 18px "Manrope", "Plus Jakarta Sans", sans-serif';
    const mw = Math.min(w - 100, ctx.measureText(capText).width + 38);
    const cx = (w - mw) / 2;
    const cy = h - (room.overlays.ticker.visible ? 140 : 112);
    if (cStyle === 'bar') {
      ctx.fillStyle = 'rgba(5, 10, 23, 0.92)';
      ctx.fillRect(0, cy - 2, w, 40);
    } else if (cStyle === 'glass') {
      ctx.fillStyle = 'rgba(12, 20, 40, 0.82)';
      drawRoundedRect(ctx, cx, cy, mw, 36, 9);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, cx, cy, mw, 36, 9);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(capText, w / 2, cy + 18, mw - 24);
    ctx.restore();
  }

  // 8. Scrolling Ticker
  if (room.overlays.ticker.visible && room.overlays.ticker.text) {
    const ty = h - 38;
    ctx.save();
    ctx.fillStyle = 'rgba(8, 12, 22, 0.94)';
    ctx.fillRect(0, ty, w, 38);
    ctx.fillStyle = accent;
    ctx.fillRect(0, ty, w, 2);

    const text = `${room.overlays.ticker.text}   ·   `;
    ctx.font = '600 14px "Manrope", "Plus Jakarta Sans", sans-serif';
    const tw = ctx.measureText(text).width;
    const offset = ((now - startTs) * 0.08) % Math.max(1, tw);
    ctx.fillStyle = '#e8edf6';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let x = -offset; x < w; x += tw) {
      ctx.fillText(text, x, ty + 20);
    }
    ctx.restore();
  }

  // 8b. Countdown HUD
  if (room.overlays.countdownEndAt && room.overlays.countdownEndAt > Date.now() - 2000) {
    const remSec = Math.max(0, Math.ceil((room.overlays.countdownEndAt - Date.now()) / 1000));
    const mm = String(Math.floor(remSec / 60)).padStart(2, '0');
    const ss = String(remSec % 60).padStart(2, '0');
    const cdLabel = (room.overlays.countdownLabel || 'COUNTDOWN').slice(0, 20).toUpperCase();
    const cdW = 166;
    const cdH = 52;
    const cdX = w - cdW - 34;
    const cdY = room.brand.logoUrl && room.brand.logoPosition === 'tr' ? 84 : 34;
    ctx.save();
    ctx.fillStyle = 'rgba(8, 12, 22, 0.88)';
    drawRoundedRect(ctx, cdX, cdY, cdW, cdH, 10);
    ctx.fill();
    ctx.strokeStyle = remSec <= 10 ? '#e11d48' : accent;
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, cdX, cdY, cdW, cdH, 10);
    ctx.stroke();
    ctx.fillStyle = '#7fa8ff';
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(cdLabel, cdX + cdW / 2, cdY + 8);
    ctx.fillStyle = remSec <= 10 ? '#fb7185' : '#ffffff';
    ctx.font = '700 22px "JetBrains Mono", monospace';
    ctx.fillText(`${mm}:${ss}`, cdX + cdW / 2, cdY + 22);
    ctx.restore();
  }

  // 9. Brand Logo
  if (room.brand.logoUrl) {
    const li = staticAssets.get(`logo:${room.brand.logoUrl}`);
    if (li) {
      const ls = room.brand.logoSize || 44;
      const margin = 26;
      const pos = room.brand.logoPosition;
      const lx = pos === 'tl' || pos === 'bl' ? margin : w - ls - margin;
      const ly = pos === 'tl' || pos === 'tr' ? margin : h - ls - margin;
      ctx.drawImage(li, lx, ly, ls, ls);
    }
  }

  // 10. Frame Treatments
  if (room.brand.frame === 'border') {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
  } else if (room.brand.frame === 'corners') {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    const len = 36;
    [
      [16, 16, 1, 1],
      [w - 16, 16, -1, 1],
      [16, h - 16, 1, -1],
      [w - 16, h - 16, -1, -1],
    ].forEach(([cx, cy, dx, dy]) => {
      ctx!.beginPath();
      ctx!.moveTo(cx + len * dx, cy);
      ctx!.lineTo(cx, cy);
      ctx!.lineTo(cx, cy + len * dy);
      ctx!.stroke();
    });
  } else if (room.brand.frame === 'vignette') {
    const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.52)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  // 11. Outgoing Transition
  if (prevSnapshot) {
    const elapsed = now - transitionStart;
    const dur = Math.max(120, room.scene.transitionMs || 320);
    if (elapsed >= dur) {
      prevSnapshot = null;
    } else {
      const t = Math.min(1, elapsed / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      ctx.save();
      if (room.scene.transitionType === 'dissolve') {
        ctx.globalAlpha = 1 - eased;
        ctx.drawImage(prevSnapshot, 0, 0, stageW, stageH);
      } else if (room.scene.transitionType === 'slide') {
        ctx.drawImage(prevSnapshot, -stageW * eased, 0, stageW, stageH);
      } else if (room.scene.transitionType === 'push') {
        ctx.globalAlpha = 1 - eased * 0.6;
        ctx.drawImage(prevSnapshot, 0, stageH * eased, stageW, stageH);
      }
      ctx.restore();
    }
  }
}

function tickLoop() {
  if (!room || !ctx) return;
  renderFrame(performance.now());
  const bitmap = offscreen.transferToImageBitmap();
  self.postMessage({ type: 'frame', bitmap, width: stageW, height: stageH }, [bitmap]);
}

self.onmessage = (ev: MessageEvent) => {
  const msg = ev.data as Record<string, unknown>;
  const type = String(msg.type || '');

  if (type === 'state') {
    const nextW = Number(msg.stageW || 1280);
    const nextH = Number(msg.stageH || 720);
    if (nextW !== stageW || nextH !== stageH) {
      stageW = nextW;
      stageH = nextH;
      offscreen = new OffscreenCanvas(stageW, stageH);
      ctx = offscreen.getContext('2d', { alpha: false });
      prevSnapshot = null;
    }

    const nextRoom = msg.room as WorkerRoomSnapshot;
    if (
      lastTemplateId &&
      nextRoom &&
      lastTemplateId !== nextRoom.scene.templateId &&
      nextRoom.scene.transitionType !== 'cut' &&
      ctx
    ) {
      renderFrame(performance.now());
      const snap = new OffscreenCanvas(stageW, stageH);
      const sctx = snap.getContext('2d');
      if (sctx) {
        sctx.drawImage(offscreen, 0, 0);
        prevSnapshot = snap;
        transitionStart = performance.now();
      }
    }
    if (nextRoom) lastTemplateId = nextRoom.scene.templateId;

    room = nextRoom;
    localClientId = String(msg.localClientId || '');
    if (msg.videoFx) videoFx = msg.videoFx as WorkerVideoFx;
    viewerMode = Boolean(msg.viewerMode);
    hasMedia = Boolean(msg.hasMedia);

    if (renderTimer === null) {
      renderTimer = self.setInterval(tickLoop, 1000 / 60);
    }
    return;
  }

  if (type === 'videoFrame') {
    const id = String(msg.id || '');
    const bmp = msg.bitmap as ImageBitmap;
    const prev = videoBitmaps.get(id);
    if (prev) prev.close();
    videoBitmaps.set(id, bmp);
    return;
  }

  if (type === 'clearVideoFrame') {
    const id = String(msg.id || '');
    const prev = videoBitmaps.get(id);
    if (prev) prev.close();
    videoBitmaps.delete(id);
    return;
  }

  if (type === 'mediaFrame') {
    if (mediaBitmap) mediaBitmap.close();
    mediaBitmap = (msg.bitmap as ImageBitmap) || null;
    return;
  }

  if (type === 'staticAsset') {
    const key = String(msg.key || '');
    const bmp = msg.bitmap as ImageBitmap;
    const prev = staticAssets.get(key);
    if (prev) prev.close();
    staticAssets.set(key, bmp);
    return;
  }

  if (type === 'stop') {
    if (renderTimer !== null) {
      self.clearInterval(renderTimer);
      renderTimer = null;
    }
    for (const b of videoBitmaps.values()) b.close();
    for (const b of staticAssets.values()) b.close();
    videoBitmaps.clear();
    staticAssets.clear();
    if (mediaBitmap) {
      mediaBitmap.close();
      mediaBitmap = null;
    }
  }
};
