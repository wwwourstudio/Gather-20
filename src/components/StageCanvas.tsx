import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Pause,
  Play,
  Repeat,
  Upload,
  X,
} from 'lucide-react';
import { VIRTUAL_BG_PRESETS } from '../constants/studioDefaults';
import {
  buildBoxesForTemplate,
  CustomStageElement,
  MediaAsset,
  ProductItem,
  RoomState,
  VideoFxSettings,
} from '../types/studio';
import {
  needsPixelProcessing,
  processCameraFxFrame,
} from '../utils/cameraFxProcessor';
import { renderFallbackStageFrame } from '../utils/stageRendererFallback';

interface StageCanvasProps {
  room: RoomState;
  localClientId: string;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  activeMedia: MediaAsset | null;
  videoFx: VideoFxSettings;
  editMode: boolean;
  viewerMode?: boolean;
  showSafeZone916?: boolean;
  selectedElId?: string | null;
  onSelectEl?: (id: string | null) => void;
  snapToGrid?: boolean;
  onToggleSnapToGrid?: () => void;
  onExitEditMode: () => void;
  onUpdateCustomElements: (els: CustomStageElement[]) => void;
  onResetCustomElements?: () => void;
  onDropMediaFile: (file: File) => void;
  onMediaPageChange: (delta: number) => void;
  onStopMedia: () => void;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const StageCanvas: React.FC<StageCanvasProps> = ({
  room,
  localClientId,
  localStream,
  screenStream,
  remoteStreams,
  activeMedia,
  videoFx,
  editMode,
  viewerMode = false,
  showSafeZone916 = false,
  selectedElId: controlledSelectedElId,
  onSelectEl,
  snapToGrid: controlledSnapToGrid,
  onToggleSnapToGrid,
  onExitEditMode,
  onUpdateCustomElements,
  onResetCustomElements,
  onDropMediaFile,
  onMediaPageChange,
  onStopMedia,
  onCanvasReady,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const [workerActive, setWorkerActive] = useState<boolean>(false);

  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const productImgCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const avatarImgCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const qrImgRef = useRef<{ url: string; img: HTMLImageElement } | null>(null);
  const logoImgRef = useRef<{ url: string; img: HTMLImageElement } | null>(null);
  const bgImgRef = useRef<{ url: string; img: HTMLImageElement } | null>(null);
  const overlayImgRef = useRef<{ url: string; img: HTMLImageElement } | null>(null);
  const virtualBgImgRef = useRef<{ url: string; img: HTMLImageElement } | null>(null);
  const localFxCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const transferredStaticKeysRef = useRef<Set<string>>(new Set());

  const editOverlayRef = useRef<HTMLDivElement | null>(null);
  const latestElementsRef = useRef<CustomStageElement[]>(room.scene.customElements);
  latestElementsRef.current = room.scene.customElements;

  const [dragOver, setDragOver] = useState(false);
  const [elementDropPreview, setElementDropPreview] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
  } | null>(null);
  const [vidPlaying, setVidPlaying] = useState(true);
  const [vidLoop, setVidLoop] = useState(false);
  const [vidProgress, setVidProgress] = useState(0);
  const [vidTimeStr, setVidTimeStr] = useState('00:00 / 00:00');
  const [internalSelectedElId, setInternalSelectedElId] = useState<string | null>(null);
  const [internalSnapToGrid, setInternalSnapToGrid] = useState(true);
  const [blockedElId, setBlockedElId] = useState<string | null>(null);
  const [snapGuides, setSnapGuides] = useState<{ v: number | null; h: number | null }>({
    v: null,
    h: null,
  });
  const [dragTarget, setDragTarget] = useState<{
    id: string;
    mode: 'move' | ResizeHandle;
    startX: number;
    startY: number;
    orig: CustomStageElement;
  } | null>(null);

  const selectedElId =
    controlledSelectedElId !== undefined ? controlledSelectedElId : internalSelectedElId;
  const setSelectedElId = (id: string | null) => {
    if (onSelectEl) onSelectEl(id);
    else setInternalSelectedElId(id);
  };
  const snapToGrid =
    controlledSnapToGrid !== undefined ? controlledSnapToGrid : internalSnapToGrid;

  const isVertical = room.aspectRatio === '9:16';
  const stageW = isVertical ? 720 : 1280;
  const stageH = isVertical ? 1280 : 720;

  useEffect(() => {
    if (canvasRef.current) {
      onCanvasReady(canvasRef.current);
    }
  }, [onCanvasReady]);

  // Sync hidden video elements for local, remote, and screen streams
  useEffect(() => {
    const map = videoElementsRef.current;

    const ensureVideo = (id: string, stream: MediaStream | null) => {
      if (!stream || stream.getVideoTracks().length === 0) {
        map.delete(id);
        workerRef.current?.postMessage({ type: 'clearVideoFrame', id });
        return;
      }
      let vid = map.get(id);
      if (!vid) {
        vid = document.createElement('video');
        vid.autoplay = true;
        vid.muted = true;
        vid.playsInline = true;
        map.set(id, vid);
      }
      if (vid.srcObject !== stream) {
        vid.srcObject = stream;
        void vid.play().catch(() => {});
      }
    };

    ensureVideo(localClientId, localStream);
    for (const [peerId, stream] of Object.entries(remoteStreams)) {
      ensureVideo(peerId, stream);
    }

    if (screenStream && screenStream.getVideoTracks().length > 0) {
      if (!screenVideoRef.current) {
        screenVideoRef.current = document.createElement('video');
        screenVideoRef.current.autoplay = true;
        screenVideoRef.current.muted = true;
        screenVideoRef.current.playsInline = true;
      }
      if (screenVideoRef.current.srcObject !== screenStream) {
        screenVideoRef.current.srcObject = screenStream;
        void screenVideoRef.current.play().catch(() => {});
      }
    } else {
      screenVideoRef.current = null;
      workerRef.current?.postMessage({ type: 'clearVideoFrame', id: '__screen__' });
    }
  }, [localClientId, localStream, remoteStreams, screenStream]);

  // Preload virtual backdrop image when cutout or greenscreen uses an image backdrop
  useEffect(() => {
    const selectedVirtualPreset = VIRTUAL_BG_PRESETS.find(
      (p) => p.id === (videoFx.virtualBgPreset || 'studio-aurora')
    );
    const resolvedVirtualUrl = videoFx.virtualBgUrl || selectedVirtualPreset?.imageUrl || '';
    if (!resolvedVirtualUrl) {
      virtualBgImgRef.current = null;
    } else if (virtualBgImgRef.current?.url !== resolvedVirtualUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = resolvedVirtualUrl;
      virtualBgImgRef.current = { url: resolvedVirtualUrl, img };
    }
  }, [videoFx.virtualBgPreset, videoFx.virtualBgUrl]);

  // Generate QR code for Watch Page URL
  useEffect(() => {
    const watchUrl = `${window.location.origin}/?watch=${room.roomCode}`;
    if (qrImgRef.current?.url === watchUrl) return;
    void QRCode.toDataURL(watchUrl, {
      width: 140,
      margin: 1,
      color: { dark: '#080c16', light: '#ffffff' },
    }).then((dataUrl) => {
      const img = new Image();
      img.onload = () => {
        transferredStaticKeysRef.current.delete('qr');
      };
      img.src = dataUrl;
      qrImgRef.current = { url: watchUrl, img };
    });
  }, [room.roomCode]);

  // Sync video media playback timeline
  useEffect(() => {
    if (!activeMedia || activeMedia.kind !== 'video' || !activeMedia.videoEl) return;
    const vid = activeMedia.videoEl;
    const onTime = () => {
      if (!vid.duration) return;
      setVidProgress(vid.currentTime / vid.duration);
      const fmt = (s: number) =>
        `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      setVidTimeStr(`${fmt(vid.currentTime)} / ${fmt(vid.duration)}`);
    };
    vid.addEventListener('timeupdate', onTime);
    return () => vid.removeEventListener('timeupdate', onTime);
  }, [activeMedia]);

  // Initialize 60fps OffscreenCanvas Web Worker compositor
  useEffect(() => {
    const supportsOffscreen =
      typeof Worker !== 'undefined' &&
      typeof OffscreenCanvas !== 'undefined' &&
      typeof createImageBitmap === 'function';

    if (!supportsOffscreen) {
      setWorkerActive(false);
      return;
    }

    try {
      const worker = new Worker(
        new URL('../workers/stageCompositor.worker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;
      setWorkerActive(true);

      worker.onmessage = (ev: MessageEvent) => {
        const msg = ev.data as { type?: string; bitmap?: ImageBitmap; width?: number; height?: number };
        if (msg.type === 'frame' && msg.bitmap) {
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(msg.bitmap, 0, 0, canvas.width, canvas.height);
            }
          }
          msg.bitmap.close();
        }
      };

      worker.onerror = () => {
        worker.terminate();
        workerRef.current = null;
        setWorkerActive(false);
      };

      return () => {
        worker.postMessage({ type: 'stop' });
        worker.terminate();
        workerRef.current = null;
        transferredStaticKeysRef.current.clear();
      };
    } catch {
      setWorkerActive(false);
    }
  }, []);

  // Push lightweight Room + FX state snapshot to OffscreenCanvas Worker
  useEffect(() => {
    const worker = workerRef.current;
    if (!worker || !workerActive) return;

    worker.postMessage({
      type: 'state',
      stageW,
      stageH,
      localClientId,
      viewerMode,
      hasMedia: Boolean(screenVideoRef.current || activeMedia),
      videoFx,
      room: {
        roomCode: room.roomCode,
        title: room.title,
        aspectRatio: room.aspectRatio,
        watchMode: room.watchMode,
        participants: room.participants.map((p) => ({
          id: p.id,
          name: p.name,
          initials: p.initials,
          avatarUrl: p.avatarUrl,
          onStage: p.onStage,
          micOn: p.micOn,
          camOn: p.camOn,
        })),
        scene: room.scene,
        overlays: room.overlays,
        brand: room.brand,
        commerce: {
          storeLabel: room.commerce.storeLabel,
          pinnedProductId: room.commerce.pinnedProductId,
          products: room.commerce.products.map((p) => ({
            id: p.id,
            source: p.source,
            title: p.title,
            price: p.price,
            stock: p.stock,
            imageUrl: p.imageUrl,
          })),
          activeFlashSale: room.commerce.activeFlashSale || null,
          latestSalePopup: room.commerce.latestSalePopup || null,
        },
        gamer: {
          gameTitle: room.gamer.gameTitle,
          activePoll: room.gamer.activePoll,
        },
        hypeTrain: room.hypeTrain,
        questions: room.questions,
        chatMessages: room.chatMessages.slice(-20),
      },
    });
  }, [room, localClientId, videoFx, stageW, stageH, viewerMode, activeMedia, workerActive]);

  // Helper for loading & transferring static CORS images to Worker
  useEffect(() => {
    if (!workerActive || !workerRef.current) return;
    const worker = workerRef.current;

    const transferStatic = (key: string, img: HTMLImageElement | null) => {
      if (!img || !img.complete || img.naturalWidth === 0 || transferredStaticKeysRef.current.has(key)) {
        return;
      }
      transferredStaticKeysRef.current.add(key);
      void createImageBitmap(img)
        .then((bitmap) => {
          worker.postMessage({ type: 'staticAsset', key, bitmap }, [bitmap]);
        })
        .catch(() => {
          transferredStaticKeysRef.current.delete(key);
        });
    };

    const ensureStaticUrl = (key: string, url: string, ref: React.MutableRefObject<{ url: string; img: HTMLImageElement } | null>) => {
      if (ref.current?.url !== url) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => transferStatic(key, img);
        img.src = url;
        ref.current = { url, img };
      } else {
        transferStatic(key, ref.current.img);
      }
    };

    if (qrImgRef.current?.img) transferStatic('qr', qrImgRef.current.img);
    if (room.brand.customBackdropUrl) {
      ensureStaticUrl(`bg:${room.brand.customBackdropUrl}`, room.brand.customBackdropUrl, bgImgRef);
    }
    if (room.brand.customOverlayUrl) {
      ensureStaticUrl(`overlay:${room.brand.customOverlayUrl}`, room.brand.customOverlayUrl, overlayImgRef);
    }
    if (room.brand.logoUrl) {
      ensureStaticUrl(`logo:${room.brand.logoUrl}`, room.brand.logoUrl, logoImgRef);
    }

    for (const p of room.participants) {
      if (!p.avatarUrl) continue;
      const key = `avatar:${p.avatarUrl}`;
      let img = avatarImgCacheRef.current.get(p.avatarUrl);
      if (!img) {
        img = new Image();
        img.crossOrigin = 'anonymous';
        const captured = img;
        img.onload = () => transferStatic(key, captured);
        img.src = p.avatarUrl;
        avatarImgCacheRef.current.set(p.avatarUrl, img);
      } else {
        transferStatic(key, img);
      }
    }

    for (const prod of room.commerce.products) {
      if (!prod.imageUrl) continue;
      const key = `product:${prod.imageUrl}`;
      let img = productImgCacheRef.current.get(prod.imageUrl);
      if (!img) {
        img = new Image();
        img.crossOrigin = 'anonymous';
        const captured = img;
        img.onload = () => transferStatic(key, captured);
        img.src = prod.imageUrl;
        productImgCacheRef.current.set(prod.imageUrl, img);
      } else {
        transferStatic(key, img);
      }
    }
  }, [room.participants, room.commerce.products, room.brand, workerActive]);

  // Pump live video + media ImageBitmaps to Worker (with async backpressure guard) OR run main-thread fallback
  useEffect(() => {
    let rafId = 0;
    const startTs = performance.now();

    if (workerActive && workerRef.current) {
      const worker = workerRef.current;
      let busy = false;

      const pumpFrames = async () => {
        if (busy) {
          rafId = requestAnimationFrame(() => void pumpFrames());
          return;
        }
        busy = true;
        try {
          for (const [id, vid] of videoElementsRef.current.entries()) {
            if (vid.readyState >= 2 && vid.videoWidth > 0 && vid.videoHeight > 0) {
              if (id === localClientId && needsPixelProcessing(videoFx)) {
                if (!localFxCanvasRef.current) {
                  localFxCanvasRef.current = document.createElement('canvas');
                  localFxCanvasRef.current.width = 640;
                  localFxCanvasRef.current.height = 360;
                }
                processCameraFxFrame(vid, videoFx, localFxCanvasRef.current, {
                  applyMirror: false,
                  applyColorFilter: false,
                  bgImg: virtualBgImgRef.current?.img || null,
                });
                const bitmap = await createImageBitmap(localFxCanvasRef.current);
                worker.postMessage({ type: 'videoFrame', id, bitmap }, [bitmap]);
              } else {
                const bitmap = await createImageBitmap(vid);
                worker.postMessage({ type: 'videoFrame', id, bitmap }, [bitmap]);
              }
            }
          }
          const sv = screenVideoRef.current;
          if (sv && sv.readyState >= 2 && sv.videoWidth > 0 && sv.videoHeight > 0) {
            const bitmap = await createImageBitmap(sv);
            worker.postMessage({ type: 'videoFrame', id: '__screen__', bitmap }, [bitmap]);
          }
          if (activeMedia) {
            if (activeMedia.kind === 'pdf' && activeMedia.pages?.length) {
              const pg = activeMedia.pages[activeMedia.currentPage - 1];
              if (pg && pg.width > 0) {
                const bitmap = await createImageBitmap(pg);
                worker.postMessage({ type: 'mediaFrame', bitmap }, [bitmap]);
              }
            } else if (
              activeMedia.kind === 'video' &&
              activeMedia.videoEl &&
              activeMedia.videoEl.readyState >= 2 &&
              activeMedia.videoEl.videoWidth > 0
            ) {
              const bitmap = await createImageBitmap(activeMedia.videoEl);
              worker.postMessage({ type: 'mediaFrame', bitmap }, [bitmap]);
            } else if (
              activeMedia.kind === 'image' &&
              activeMedia.imageEl?.complete &&
              activeMedia.imageEl.naturalWidth > 0
            ) {
              const bitmap = await createImageBitmap(activeMedia.imageEl);
              worker.postMessage({ type: 'mediaFrame', bitmap }, [bitmap]);
            }
          } else {
            worker.postMessage({ type: 'mediaFrame', bitmap: null });
          }
        } catch {
          // ignore transient bitmap errors when stream is ending
        } finally {
          busy = false;
        }
        rafId = requestAnimationFrame(() => void pumpFrames());
      };

      rafId = requestAnimationFrame(() => void pumpFrames());
      return () => cancelAnimationFrame(rafId);
    }

    // Main-thread fallback loop if OffscreenCanvas Worker is unavailable
    const getProductImg = (prod: ProductItem): HTMLImageElement | null => {
      const cached = productImgCacheRef.current.get(prod.imageUrl);
      if (cached) return cached;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = prod.imageUrl;
      productImgCacheRef.current.set(prod.imageUrl, img);
      return img;
    };

    const getAvatarImg = (url: string): HTMLImageElement | null => {
      const cached = avatarImgCacheRef.current.get(url);
      if (cached) return cached;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      avatarImgCacheRef.current.set(url, img);
      return img;
    };

    const tick = (now: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        let localFxCanvas: HTMLCanvasElement | null = null;
        const localVid = videoElementsRef.current.get(localClientId);
        if (
          localVid &&
          localVid.readyState >= 2 &&
          localVid.videoWidth > 0 &&
          needsPixelProcessing(videoFx)
        ) {
          if (!localFxCanvasRef.current) {
            localFxCanvasRef.current = document.createElement('canvas');
            localFxCanvasRef.current.width = 640;
            localFxCanvasRef.current.height = 360;
          }
          processCameraFxFrame(localVid, videoFx, localFxCanvasRef.current, {
            applyMirror: false,
            applyColorFilter: false,
            bgImg: virtualBgImgRef.current?.img || null,
          });
          localFxCanvas = localFxCanvasRef.current;
        }

        renderFallbackStageFrame({
          ctx,
          now,
          startTs,
          stageW,
          stageH,
          isVertical,
          room,
          localClientId,
          videoFx,
          viewerMode,
          activeMedia,
          videoElements: videoElementsRef.current,
          localFxCanvas,
          screenVideo: screenVideoRef.current,
          getProductImg,
          getAvatarImg,
          qrImg: qrImgRef.current?.img || null,
          logoImg: logoImgRef.current?.img || null,
          bgImg: bgImgRef.current?.img || null,
          overlayImg: overlayImgRef.current?.img || null,
        });
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [workerActive, room, localClientId, activeMedia, videoFx, stageW, stageH, isVertical, viewerMode]);

  // Keyboard arrow nudge + Escape + Delete during stage edit
  useEffect(() => {
    if (!editMode || viewerMode) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (ev.key === 'Escape') {
        if (selectedElId) {
          setSelectedElId(null);
        } else {
          onExitEditMode();
        }
        return;
      }
      if (!selectedElId) return;
      const cur = room.scene.customElements.find((item) => item.id === selectedElId);
      if (!cur || cur.locked) return;

      if (ev.key === 'Delete' || ev.key === 'Backspace') {
        ev.preventDefault();
        setSelectedElId(null);
        onUpdateCustomElements(
          room.scene.customElements.filter((item) => item.id !== selectedElId)
        );
        return;
      }

      const step = ev.shiftKey ? 0.032 : 0.006;
      let dx = 0;
      let dy = 0;
      if (ev.key === 'ArrowLeft') dx = -step;
      else if (ev.key === 'ArrowRight') dx = step;
      else if (ev.key === 'ArrowUp') dy = -step;
      else if (ev.key === 'ArrowDown') dy = step;
      else return;

      ev.preventDefault();
      const nextX = Math.max(0.01, Math.min(0.99 - cur.w, cur.x + dx));
      const nextY = Math.max(0.01, Math.min(0.99 - cur.h, cur.y + dy));
      onUpdateCustomElements(
        room.scene.customElements.map((item) =>
          item.id === cur.id ? { ...item, x: nextX, y: nextY } : item
        )
      );
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editMode, viewerMode, selectedElId, room.scene.customElements]);

  const boxesOverlap = (
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number }
  ) => {
    const pad = 0.003;
    return !(
      a.x + a.w <= b.x + pad ||
      b.x + b.w <= a.x + pad ||
      a.y + a.h <= b.y + pad ||
      b.y + b.h <= a.y + pad
    );
  };

  const applyMagneticSnap = (
    box: { x: number; y: number; w: number; h: number },
    others: CustomStageElement[],
    mode: 'move' | ResizeHandle
  ): { x: number; y: number; w: number; h: number; guideV: number | null; guideH: number | null } => {
    if (!snapToGrid) return { ...box, guideV: null, guideH: null };
    const thresh = 0.014;
    let { x, y, w, h } = box;
    let guideV: number | null = null;
    let guideH: number | null = null;

    const vTargets = [0.04, 0.5, 0.96];
    const hTargets = [0.05, 0.5, 0.95];
    for (const o of others) {
      vTargets.push(o.x, o.x + o.w, o.x + o.w / 2);
      hTargets.push(o.y, o.y + o.h, o.y + o.h / 2);
    }

    if (mode === 'move') {
      const cx = x + w / 2;
      const cy = y + h / 2;
      for (const t of vTargets) {
        if (Math.abs(cx - t) < thresh) {
          x = t - w / 2;
          guideV = t;
          break;
        }
        if (Math.abs(x - t) < thresh) {
          x = t;
          guideV = t;
          break;
        }
        if (Math.abs(x + w - t) < thresh) {
          x = t - w;
          guideV = t;
          break;
        }
      }
      for (const t of hTargets) {
        if (Math.abs(cy - t) < thresh) {
          y = t - h / 2;
          guideH = t;
          break;
        }
        if (Math.abs(y - t) < thresh) {
          y = t;
          guideH = t;
          break;
        }
        if (Math.abs(y + h - t) < thresh) {
          y = t - h;
          guideH = t;
          break;
        }
      }
    }

    x = Math.max(0.01, Math.min(0.99 - w, x));
    y = Math.max(0.01, Math.min(0.99 - h, y));
    return { x, y, w, h, guideV, guideH };
  };

  const updateDragFromClientPos = (clientX: number, clientY: number, altKey: boolean) => {
    if (!dragTarget || !editMode) return;
    const rect = editOverlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;

    const dx = (clientX - dragTarget.startX) / rect.width;
    const dy = (clientY - dragTarget.startY) / rect.height;
    const orig = dragTarget.orig;
    const currentEls = latestElementsRef.current;
    const siblings = currentEls.filter(
      (el) => el.id !== orig.id && !el.hidden && !el.stack
    );

    const minW = 0.08;
    const minH = 0.07;
    const cand = { x: orig.x, y: orig.y, w: orig.w, h: orig.h };

    if (dragTarget.mode === 'move') {
      cand.x = Math.max(0.01, Math.min(0.99 - orig.w, orig.x + dx));
      cand.y = Math.max(0.01, Math.min(0.99 - orig.h, orig.y + dy));
    } else {
      const m = dragTarget.mode;
      if (m.includes('e')) {
        cand.w = Math.max(minW, Math.min(0.99 - orig.x, orig.w + dx));
      }
      if (m.includes('s')) {
        cand.h = Math.max(minH, Math.min(0.99 - orig.y, orig.h + dy));
      }
      if (m.includes('w')) {
        const right = orig.x + orig.w;
        const nextX = Math.max(0.01, Math.min(right - minW, orig.x + dx));
        cand.x = nextX;
        cand.w = right - nextX;
      }
      if (m.includes('n')) {
        const bottom = orig.y + orig.h;
        const nextY = Math.max(0.01, Math.min(bottom - minH, orig.y + dy));
        cand.y = nextY;
        cand.h = bottom - nextY;
      }
    }

    const snapped = applyMagneticSnap(cand, siblings, dragTarget.mode);
    const nextBox = { x: snapped.x, y: snapped.y, w: snapped.w, h: snapped.h };
    setSnapGuides({ v: snapped.guideV, h: snapped.guideH });

    const allowOverlap = altKey || Boolean(orig.stack);
    const collides = !allowOverlap && siblings.some((other) => boxesOverlap(nextBox, other));
    if (collides) {
      setBlockedElId(orig.id);
      return;
    }
    if (blockedElId) setBlockedElId(null);

    const updated = currentEls.map((el) =>
      el.id === dragTarget.id ? { ...el, ...nextBox } : el
    );
    onUpdateCustomElements(updated);
  };

  useEffect(() => {
    if (!dragTarget || !editMode) return;
    const onWindowMove = (ev: PointerEvent) => {
      updateDragFromClientPos(ev.clientX, ev.clientY, ev.altKey);
    };
    const onWindowUp = () => {
      setDragTarget(null);
      setBlockedElId(null);
      setSnapGuides({ v: null, h: null });
    };
    window.addEventListener('pointermove', onWindowMove);
    window.addEventListener('pointerup', onWindowUp);
    window.addEventListener('pointercancel', onWindowUp);
    return () => {
      window.removeEventListener('pointermove', onWindowMove);
      window.removeEventListener('pointerup', onWindowUp);
      window.removeEventListener('pointercancel', onWindowUp);
    };
  }, [dragTarget, editMode, snapToGrid, blockedElId]);

  const parseDraggedStagePayload = (e: React.DragEvent<HTMLDivElement>) => {
    const raw = e.dataTransfer.getData('application/x-gather-element');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as {
        kind: CustomStageElement['kind'];
        label: string;
        w: number;
        h: number;
        extra?: Partial<CustomStageElement>;
      };
      if (!parsed?.kind) return null;
      return parsed;
    } catch {
      return null;
    }
  };

  return (
    <div className="gather-stage-wrap">
      <div
        onDragOver={
          viewerMode
            ? undefined
            : (e) => {
                e.preventDefault();
                if (e.dataTransfer.types.includes('application/x-gather-element')) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const relX = (e.clientX - rect.left) / Math.max(1, rect.width);
                  const relY = (e.clientY - rect.top) / Math.max(1, rect.height);
                  const w = 0.28;
                  const h = 0.24;
                  setElementDropPreview({
                    x: Math.max(0.02, Math.min(0.98 - w, relX - w / 2)),
                    y: Math.max(0.02, Math.min(0.98 - h, relY - h / 2)),
                    w,
                    h,
                    label: 'Drop to place',
                  });
                } else {
                  setDragOver(true);
                }
              }
        }
        onDragLeave={
          viewerMode
            ? undefined
            : () => {
                setDragOver(false);
                setElementDropPreview(null);
              }
        }
        onDrop={
          viewerMode
            ? undefined
            : (e) => {
                e.preventDefault();
                setDragOver(false);
                setElementDropPreview(null);
                const payload = parseDraggedStagePayload(e);
                if (payload) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const relX = (e.clientX - rect.left) / Math.max(1, rect.width);
                  const relY = (e.clientY - rect.top) / Math.max(1, rect.height);
                  const w = payload.w || 0.28;
                  const h = payload.h || 0.22;
                  const x = Math.max(0.02, Math.min(0.98 - w, relX - w / 2));
                  const y = Math.max(0.02, Math.min(0.98 - h, relY - h / 2));
                  const baseEls =
                    room.scene.customElements.length > 0 &&
                    (room.scene.templateId === 'custom' ||
                      room.scene.templateId.startsWith('custom-'))
                      ? room.scene.customElements
                      : buildBoxesForTemplate(
                          room.scene.templateId,
                          room.aspectRatio,
                          room.participants
                        );
                  const onStageList = room.participants.filter((p) => p.onStage);
                  const defaultP = onStageList[0] || room.participants[0];
                  const nextEl: CustomStageElement = {
                    id: `el-${payload.kind}-${Date.now().toString(36)}`,
                    kind: payload.kind,
                    label: payload.label,
                    participantId: payload.kind === 'participant' ? defaultP?.id : undefined,
                    x,
                    y,
                    w,
                    h,
                    stack: true,
                    ...(payload.extra || {}),
                  };
                  onUpdateCustomElements([...baseEls, nextEl]);
                  setSelectedElId(nextEl.id);
                  return;
                }
                const file = e.dataTransfer.files?.[0];
                if (file) onDropMediaFile(file);
              }
        }
        className={`${isVertical ? 'gather-stage-frame-vertical' : 'gather-stage-frame'}${
          viewerMode ? '' : ' gather-glow-rim'
        }`}
      >
        <canvas
          ref={canvasRef}
          width={stageW}
          height={stageH}
          aria-label="Broadcast stage program output"
          className="w-full h-full block object-contain"
        />

        {!viewerMode && !isVertical && showSafeZone916 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[31.64%] border-x-2 border-dashed border-sky-400/65 bg-sky-400/[0.03] flex items-end justify-center pb-2"
          >
            <span className="px-2 py-0.5 rounded bg-[var(--surface-solid)] text-[10px] font-mono-num text-[var(--accent-text)] border border-[var(--line-2)]">
              9:16 Shorts / Reels Safe Frame
            </span>
          </div>
        )}

        {!viewerMode && dragOver && (
          <div className="absolute inset-0 bg-[var(--accent)]/25 backdrop-blur-sm border-2 border-dashed border-[var(--accent)] flex flex-col items-center justify-center gap-2 pointer-events-none">
            <Upload className="w-8 h-8 text-white" />
            <p className="text-sm font-semibold text-white">Drop PDF, Video, or Image to present</p>
          </div>
        )}

        {!viewerMode && elementDropPreview && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-30 rounded-[6px] border-2 border-dashed border-[var(--accent)] bg-[var(--accent)]/20 flex items-center justify-center"
            style={{
              left: `${elementDropPreview.x * 100}%`,
              top: `${elementDropPreview.y * 100}%`,
              width: `${elementDropPreview.w * 100}%`,
              height: `${elementDropPreview.h * 100}%`,
            }}
          >
            <span className="px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono-num text-white">
              {elementDropPreview.label}
            </span>
          </div>
        )}

        {!viewerMode && editMode && (
          <div
            ref={editOverlayRef}
            onPointerDown={() => setSelectedElId(null)}
            className="absolute inset-0 bg-black/15 select-none touch-none"
          >
            {/* Subtle Title-Safe Frame */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-[4%] border border-dashed border-white/15 rounded-[6px]"
            />

            {/* Alignment Snap Guides */}
            {snapGuides.v !== null && (
              <div
                aria-hidden="true"
                className="gather-snap-v"
                style={{ left: `${snapGuides.v * 100}%` }}
              />
            )}
            {snapGuides.h !== null && (
              <div
                aria-hidden="true"
                className="gather-snap-h"
                style={{ top: `${snapGuides.h * 100}%` }}
              />
            )}

            {/* Slim Floating Top Mode Indicator Bar (keeps stage unobstructed; controls live in Look -> Layout) */}
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[var(--hud-bg)]/95 backdrop-blur-md border border-[var(--hud-border)] text-[11px] text-[var(--hud-ink)] shadow-lg whitespace-nowrap"
            >
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                <span>Editing stage</span>
              </span>
              <span className="hidden sm:inline text-[var(--hud-ink-muted)]">
                · Hold Alt to overlap
              </span>
              <button
                type="button"
                onClick={() => {
                  if (onToggleSnapToGrid) onToggleSnapToGrid();
                  else setInternalSnapToGrid((s) => !s);
                }}
                className={`h-5 px-2 rounded-full border text-[10px] font-mono-num cursor-pointer ${
                  snapToGrid
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-line)] text-[var(--hud-ink)]'
                    : 'border-[var(--hud-border)] text-[var(--hud-ink-muted)]'
                }`}
              >
                {snapToGrid ? 'Snap on' : 'Snap off'}
              </button>
              {onResetCustomElements && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedElId(null);
                    onResetCustomElements();
                  }}
                  className="text-[11px] text-[var(--hud-ink-muted)] hover:text-[var(--hud-ink)] cursor-pointer"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectedElId(null);
                  onExitEditMode();
                }}
                className="h-5 px-2.5 rounded-full gather-btn-primary text-white text-[10.5px] font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>

            {/* Clean Hover-Revealed Interactive Element Boxes */}
            {room.scene.customElements.map((el) => {
              const isSelected = el.id === selectedElId;
              const isBlocked = el.id === blockedElId;
              const handles: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
              return (
                <div
                  key={el.id}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelectedElId(el.id);
                    if (el.locked) return;
                    setDragTarget({
                      id: el.id,
                      mode: 'move',
                      startX: e.clientX,
                      startY: e.clientY,
                      orig: el,
                    });
                  }}
                  style={{
                    left: `${el.x * 100}%`,
                    top: `${el.y * 100}%`,
                    width: `${el.w * 100}%`,
                    height: `${el.h * 100}%`,
                  }}
                  className={`gather-ebox ${isSelected ? 'is-selected' : ''} ${
                    el.locked ? 'is-locked' : ''
                  } ${el.hidden ? 'is-hidden-el' : ''} ${isBlocked ? 'is-blocked' : ''}`}
                >
                  <div className="gather-elab flex items-center gap-1.5">
                    {el.locked && <Lock className="w-2.5 h-2.5 text-amber-300 shrink-0" />}
                    <span className="truncate">{el.label}</span>
                    {isSelected && (
                      <span className="text-[9.5px] text-white/70 shrink-0">
                        {Math.round(el.w * 100)}×{Math.round(el.h * 100)}%
                      </span>
                    )}
                  </div>

                  {!el.locked &&
                    handles.map((h) => (
                      <div
                        key={h}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setSelectedElId(el.id);
                          setDragTarget({
                            id: el.id,
                            mode: h,
                            startX: e.clientX,
                            startY: e.clientY,
                            orig: el,
                          });
                        }}
                        className={`gather-ehandle ${h}`}
                      />
                    ))}
                </div>
              );
            })}
          </div>
        )}

        {activeMedia && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 px-3.5 py-2 rounded-xl bg-black/75 backdrop-blur-md border border-white/15 text-white text-xs">
            <span className="font-mono-num text-[var(--accent-text)] uppercase">
              {activeMedia.kind}
            </span>
            <span className="max-w-[140px] truncate text-white/85">{activeMedia.name}</span>

            {activeMedia.kind === 'pdf' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onMediaPageChange(-1)}
                  aria-label="Previous slide"
                  className="h-7 w-7 grid place-items-center rounded bg-white/10 hover:bg-white/20 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono-num px-1">
                  {activeMedia.currentPage} / {activeMedia.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => onMediaPageChange(1)}
                  aria-label="Next slide"
                  className="h-7 w-7 grid place-items-center rounded bg-white/10 hover:bg-white/20 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {activeMedia.kind === 'video' && activeMedia.videoEl && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const v = activeMedia.videoEl!;
                    if (v.paused) {
                      void v.play();
                      setVidPlaying(true);
                    } else {
                      v.pause();
                      setVidPlaying(false);
                    }
                  }}
                  className="h-7 px-2 rounded bg-white/10 hover:bg-white/20 inline-flex items-center gap-1 cursor-pointer"
                >
                  {vidPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={vidProgress}
                  onChange={(e) => {
                    const v = activeMedia.videoEl!;
                    if (v.duration) v.currentTime = Number(e.target.value) * v.duration;
                  }}
                  className="gather-range w-20"
                />
                <span className="font-mono-num text-[11px]">{vidTimeStr}</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = !vidLoop;
                    activeMedia.videoEl!.loop = next;
                    setVidLoop(next);
                  }}
                  aria-label="Toggle loop"
                  className={`h-7 w-7 grid place-items-center rounded cursor-pointer ${
                    vidLoop ? 'bg-[var(--accent)]' : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onStopMedia}
              aria-label="Stop presenting"
              className="h-7 w-7 grid place-items-center rounded bg-white/10 hover:bg-[var(--live)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
