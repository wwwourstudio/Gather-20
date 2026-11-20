import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Camera,
  CameraOff,
  CheckCircle2,
  FlipHorizontal2,
  Gamepad2,
  ImagePlus,
  LogIn,
  Mic,
  MicOff,
  Radio,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import { DEFAULT_VIDEO_FX, VIRTUAL_BG_PRESETS } from '../constants/studioDefaults';
import { VideoBgMode, VideoFxSettings, WatchMode } from '../types/studio';
import {
  needsPixelProcessing,
  processCameraFxFrame,
  resolveBgMode,
} from '../utils/cameraFxProcessor';
import { GatherLogo } from './GatherLogo';

interface GreenRoomModalProps {
  open: boolean;
  roomCode: string;
  initialName: string;
  initialAvatarUrl?: string;
  initialFx: VideoFxSettings;
  initialWatchMode?: WatchMode;
  isSignedIn?: boolean;
  onOpenAuth?: () => void;
  onCancel: () => void;
  onEnter: (payload: {
    name: string;
    avatarUrl?: string;
    micOn: boolean;
    camOn: boolean;
    stream: MediaStream | null;
    fx: VideoFxSettings;
    studioTitle?: string;
    watchMode: WatchMode;
    isHost: boolean;
  }) => void;
  isNewStudio: boolean;
}

const DEFAULT_TITLES: Record<WatchMode, string> = {
  standard: 'Gather Live Broadcast',
  shop: 'Studio Objects Live Drop',
  gamer: 'Ranked Squad Co-Stream',
};

export const GreenRoomModal: React.FC<GreenRoomModalProps> = ({
  open,
  roomCode,
  initialName,
  initialAvatarUrl,
  initialFx,
  initialWatchMode = 'standard',
  isSignedIn = false,
  onOpenAuth,
  onCancel,
  onEnter,
  isNewStudio,
}) => {
  const [name, setName] = useState(initialName || '');
  const [nameError, setNameError] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [studioTitle, setStudioTitle] = useState(DEFAULT_TITLES[initialWatchMode]);
  const [titleEdited, setTitleEdited] = useState(false);
  const [watchMode, setWatchMode] = useState<WatchMode>(initialWatchMode);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(initialAvatarUrl);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [fx, setFx] = useState<VideoFxSettings>(initialFx);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [selectedCam, setSelectedCam] = useState('');
  const [meterLevel, setMeterLevel] = useState(0);
  const [mediaUnavailable, setMediaUnavailable] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fxCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const virtualBgImgRef = useRef<{ url: string; img: HTMLImageElement } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (initialName) setName(initialName);
  }, [initialName]);

  useEffect(() => {
    if (initialAvatarUrl) setAvatarUrl(initialAvatarUrl);
  }, [initialAvatarUrl]);

  useEffect(() => {
    if (open) {
      setFx(initialFx);
      setWatchMode(initialWatchMode);
      setTitleEdited(false);
      setStudioTitle(DEFAULT_TITLES[initialWatchMode]);
    }
  }, [open, initialWatchMode, initialFx]);

  const closeModal = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    onCancel();
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeModal]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    let rafId = 0;
    let analyserCtx: AudioContext | null = null;

    const initDevices = async () => {
      setMediaUnavailable(false);
      try {
        const constraints: MediaStreamConstraints = {
          audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
          video: selectedCam
            ? { deviceId: { exact: selectedCam }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { width: { ideal: 1280 }, height: { ideal: 720 } },
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const list = await navigator.mediaDevices.enumerateDevices();
        if (active) setDevices(list);

        if (stream.getAudioTracks().length > 0) {
          analyserCtx = new AudioContext();
          const src = analyserCtx.createMediaStreamSource(stream);
          const analyser = analyserCtx.createAnalyser();
          analyser.fftSize = 128;
          src.connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            if (!active) return;
            analyser.getByteTimeDomainData(data);
            let peak = 0;
            for (let i = 0; i < data.length; i++) {
              const v = Math.abs(data[i] - 128) / 128;
              if (v > peak) peak = v;
            }
            setMeterLevel(Math.min(100, Math.round(peak * 220)));
            rafId = requestAnimationFrame(tick);
          };
          tick();
        }
      } catch {
        if (active) setMediaUnavailable(true);
      }
    };

    void initDevices();

    return () => {
      active = false;
      if (rafId) cancelAnimationFrame(rafId);
      if (analyserCtx) void analyserCtx.close();
    };
  }, [open, selectedMic, selectedCam, retryCount]);

  useEffect(() => {
    if (!streamRef.current) return;
    streamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = micOn;
    });
    streamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = camOn;
    });
  }, [micOn, camOn]);

  const trimmedName = name.trim();
  const initials = trimmedName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  const bgMode = resolveBgMode(fx);
  const useFxCanvas = needsPixelProcessing(fx);
  const activeMeter = micOn ? meterLevel : 0;
  const voiceRingScale = 1 + (activeMeter / 100) * 0.22;
  const cameraLive = camOn && !mediaUnavailable;

  const selectedPreset = VIRTUAL_BG_PRESETS.find((p) => p.id === (fx.virtualBgPreset || 'studio-aurora'));
  const resolvedVirtualBgUrl = fx.virtualBgUrl || selectedPreset?.imageUrl || '';

  useEffect(() => {
    if (!resolvedVirtualBgUrl) {
      virtualBgImgRef.current = null;
      return;
    }
    if (virtualBgImgRef.current?.url === resolvedVirtualBgUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = resolvedVirtualBgUrl;
    virtualBgImgRef.current = { url: resolvedVirtualBgUrl, img };
  }, [resolvedVirtualBgUrl]);

  useEffect(() => {
    if (!open || !cameraLive || !useFxCanvas) return;
    let rafId = 0;
    const renderLoop = () => {
      const vid = videoRef.current;
      const canvas = fxCanvasRef.current;
      if (vid && canvas && vid.readyState >= 2 && vid.videoWidth > 0) {
        processCameraFxFrame(vid, fx, canvas, {
          applyMirror: fx.mirror,
          applyColorFilter: true,
          bgImg: virtualBgImgRef.current?.img || null,
        });
      }
      rafId = requestAnimationFrame(renderLoop);
    };
    rafId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafId);
  }, [open, cameraLive, useFxCanvas, fx]);

  if (!open) return null;

  const audioInputs = devices.filter((d) => d.kind === 'audioinput');
  const videoInputs = devices.filter((d) => d.kind === 'videoinput');

  const handleSelectMode = (mode: WatchMode) => {
    setWatchMode(mode);
    if (!titleEdited) {
      setStudioTitle(DEFAULT_TITLES[mode]);
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmedName) {
      // Point at what's missing instead of silently doing nothing.
      setNameError(true);
      const input = nameInputRef.current;
      if (input) {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus({ preventScroll: true });
      }
      return;
    }
    onEnter({
      name: trimmedName,
      avatarUrl,
      micOn,
      camOn,
      stream: streamRef.current,
      fx,
      studioTitle: isNewStudio ? studioTitle.trim() || DEFAULT_TITLES[watchMode] : undefined,
      watchMode,
      isHost: isNewStudio,
    });
  };

  const handleAvatarFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setAvatarUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Readiness: what the person still needs to sort out before going in.
  const checks: Array<{ id: string; label: string; ok: boolean; detail: string }> = [
    {
      id: 'camera',
      label: 'Camera',
      ok: cameraLive || !camOn,
      detail: mediaUnavailable ? 'No access yet' : camOn ? 'Looking good' : 'Off — your avatar shows instead',
    },
    {
      id: 'mic',
      label: 'Microphone',
      ok: !mediaUnavailable,
      detail: mediaUnavailable ? 'No access yet' : micOn ? (activeMeter > 6 ? 'We can hear you' : 'Say something to test') : 'Muted',
    },
    {
      id: 'name',
      label: 'Name',
      ok: Boolean(trimmedName),
      detail: trimmedName ? trimmedName : 'Add your name',
    },
  ];

  const inputCls =
    'w-full h-10 px-3 rounded-[10px] gather-input-glass border border-[var(--line-2)] hover:border-[var(--ink-3)]/40 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--accent)]';
  const sectionLabel = 'text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-3)]';
  const glassBtn = (on: boolean) =>
    `h-10 w-10 sm:w-auto sm:px-3.5 rounded-full text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 backdrop-blur-xl border transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
      on ? 'bg-black/45 text-white border-white/20 hover:bg-black/65' : 'gather-btn-live border-transparent'
    }`;

  const FORMATS: Array<{ id: WatchMode; label: string; blurb: string; icon: React.ElementType }> = [
    { id: 'standard', label: 'Broadcast', blurb: 'Q&A, polls and tips', icon: Radio },
    { id: 'shop', label: 'Live Shop', blurb: 'Products and checkout', icon: ShoppingBag },
    { id: 'gamer', label: 'Gaming', blurb: 'Predictions and clips', icon: Gamepad2 },
  ];

  const LOOKS: Array<{ id: VideoBgMode; label: string; hint: string }> = [
    { id: 'natural', label: 'Natural', hint: 'Raw lens' },
    { id: 'blur', label: 'Soft blur', hint: 'Depth blur' },
    { id: 'cutout', label: 'Cutout BG', hint: 'Virtual set' },
    { id: 'greenscreen', label: 'Greenscreen', hint: 'Chroma key' },
    { id: 'dim', label: 'Spotlight', hint: 'Studio dim' },
  ];

  const handleSelectBgMode = (mode: VideoBgMode) => {
    setFx((p) => ({
      ...p,
      bgMode: mode,
      blurBg: mode === 'blur',
      chromaKey: mode === 'greenscreen',
    }));
  };

  const handleVirtualBgUpload = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const nextUrl = reader.result;
        setFx((p) => ({
          ...p,
          bgMode: p.bgMode === 'greenscreen' ? 'greenscreen' : 'cutout',
          virtualBgPreset: 'custom',
          virtualBgUrl: nextUrl,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const SLIDERS = [
    { key: 'brightness', label: 'Brightness', min: 60, max: 140 },
    { key: 'contrast', label: 'Contrast', min: 60, max: 140 },
    { key: 'saturation', label: 'Colour', min: 40, max: 160 },
  ] as const;

  const fxChanged =
    fx.brightness !== 100 ||
    fx.contrast !== 100 ||
    fx.saturation !== 100 ||
    bgMode !== 'natural';

  return (
    <div
      className="fixed inset-0 z-50 gather-lightbox-scrim flex items-stretch sm:items-center justify-center sm:p-5 animate-gather-backdrop"
      onClick={closeModal}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="green-room-heading"
        aria-describedby="green-room-sub"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[1040px] h-full sm:h-auto sm:max-h-[94vh] flex flex-col sm:rounded-[20px] gather-glass-elevated animate-gather-modal overflow-hidden"
      >
        {/* Header */}
        <header className="relative flex items-center justify-between gap-4 px-5 sm:px-6 h-16 border-b border-[var(--line)] shrink-0 overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute -top-16 -left-10 w-72 h-40 rounded-full bg-[var(--accent)]/20 blur-3xl pointer-events-none"
          />
          <div className="relative flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-[10px] bg-[var(--accent-soft)] border border-[var(--accent-line)] grid place-items-center shrink-0">
              <GatherLogo size={17} />
            </span>
            <div className="min-w-0">
              <h2
                id="green-room-heading"
                className="font-display text-[16px] font-medium text-[var(--ink)] tracking-tight leading-tight"
              >
                {isNewStudio ? 'Set up your studio' : 'Get ready to join'}
              </h2>
              <p id="green-room-sub" className="text-[12px] text-[var(--ink-3)] mt-0.5 truncate">
                Check how you look and sound before you go in.
              </p>
            </div>
          </div>

          <div className="relative flex items-center gap-2 shrink-0">
            <span
              className="hidden sm:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-[var(--line-2)] bg-[var(--fill)] text-[11.5px] text-[var(--ink-2)]"
              title="Room code"
            >
              <span className="text-[var(--ink-3)]">Room</span>
              <span className="font-mono-num font-medium text-[var(--ink)] tracking-wider">{roomCode}</span>
            </span>
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close"
              className="h-9 w-9 grid place-items-center rounded-[9px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <form onSubmit={handleJoin} noValidate className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden gather-scroll">
          {/* Left: preview + look */}
          <div className="lg:w-[58%] p-5 sm:p-6 space-y-4 min-w-0 lg:overflow-y-auto gather-scroll">
            <div className="gather-glow-rim relative aspect-video rounded-[16px] overflow-hidden bg-[#060a14] shadow-[0_28px_70px_-24px_rgba(0,0,0,0.75)]">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  cameraLive && !useFxCanvas ? 'opacity-100' : 'opacity-0'
                }`}
                style={{
                  transform: fx.mirror ? 'scaleX(-1)' : 'none',
                  filter: `brightness(${fx.brightness}%) contrast(${fx.contrast}%) saturate(${fx.saturation}%)`,
                }}
              />

              {cameraLive && useFxCanvas && (
                <canvas
                  ref={fxCanvasRef}
                  width={640}
                  height={360}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}

              {cameraLive && bgMode === 'dim' && (
                <div
                  className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                  style={{
                    background:
                      'radial-gradient(circle at 50% 45%, transparent 32%, rgba(6,10,22,0.74) 95%)',
                  }}
                />
              )}

              {/* Status chip */}
              <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-2 pointer-events-none">
                <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-black/45 backdrop-blur-xl border border-white/15 text-[11.5px] font-medium text-white">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      mediaUnavailable ? 'bg-amber-400' : cameraLive ? 'bg-emerald-400 animate-pulse' : 'bg-white/60'
                    }`}
                    aria-hidden="true"
                  />
                  {mediaUnavailable ? 'Waiting for access' : cameraLive ? 'Camera preview' : 'Camera off'}
                </span>
                {cameraLive && fx.mirror && (
                  <span className="h-7 px-2.5 rounded-full bg-black/35 backdrop-blur-xl border border-white/10 text-[11px] text-white/80 inline-flex items-center">
                    Mirrored for you only
                  </span>
                )}
              </div>

              {/* Camera off / no permission */}
              {!cameraLive && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center"
                  style={{
                    background:
                      'radial-gradient(circle at 50% 42%, rgba(79,110,247,0.28), rgba(124,58,237,0.10) 45%, rgba(6,10,20,0.97) 78%)',
                  }}
                >
                  <div className="relative grid place-items-center">
                    <span
                      aria-hidden="true"
                      className="absolute w-24 h-24 rounded-full border border-[#60a5fa]/40 transition-transform duration-100"
                      style={{
                        transform: `scale(${voiceRingScale})`,
                        opacity: micOn ? 0.45 + (activeMeter / 100) * 0.55 : 0.2,
                      }}
                    />
                    <span
                      aria-hidden="true"
                      className="absolute w-32 h-32 rounded-full border border-[#a78bfa]/25 transition-transform duration-150"
                      style={{
                        transform: `scale(${1 + (activeMeter / 100) * 0.3})`,
                        opacity: micOn ? 0.3 + (activeMeter / 100) * 0.45 : 0.12,
                      }}
                    />
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="relative z-10 w-20 h-20 rounded-full object-cover border-2 border-white/30 shadow-xl"
                      />
                    ) : (
                      <div className="relative z-10 w-20 h-20 rounded-full gather-btn-primary font-display font-medium text-[22px] grid place-items-center shadow-xl">
                        {initials || <User className="w-8 h-8" strokeWidth={1.6} aria-hidden="true" />}
                      </div>
                    )}
                  </div>

                  {mediaUnavailable ? (
                    <div className="space-y-2.5 max-w-[38ch]">
                      <p className="text-[14px] font-medium text-white">We can&rsquo;t see your camera or mic yet</p>
                      <p className="text-[12.5px] text-white/65 leading-relaxed">
                        Allow access from the camera icon in your browser&rsquo;s address bar, then try again. You can
                        also go in without them and use your avatar.
                      </p>
                      <button
                        type="button"
                        onClick={() => setRetryCount((c) => c + 1)}
                        className="mt-1 h-9 px-4 rounded-full bg-white text-[#0b1426] text-[12.5px] font-semibold inline-flex items-center gap-1.5 hover:bg-white/90 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                        Try again
                      </button>
                    </div>
                  ) : (
                    <p className="text-[13px] font-medium text-white/85 max-w-[34ch]">
                      Camera is off. Guests will see your avatar.
                    </p>
                  )}
                </div>
              )}

              {/* Bottom controls */}
              <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMicOn((v) => !v)}
                    aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
                    aria-pressed={!micOn}
                    className={glassBtn(micOn)}
                  >
                    {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    <span className="hidden sm:inline">{micOn ? 'Mic' : 'Muted'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCamOn((v) => !v)}
                    aria-label={camOn ? 'Turn camera off' : 'Turn camera on'}
                    aria-pressed={!camOn}
                    className={glassBtn(camOn)}
                  >
                    {camOn ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
                    <span className="hidden sm:inline">{camOn ? 'Camera' : 'Camera off'}</span>
                  </button>
                </div>

                <div
                  className="flex items-center gap-2 h-10 pl-3 pr-3.5 rounded-full bg-black/45 backdrop-blur-xl border border-white/15 min-w-0 w-[44%] max-w-[220px]"
                  role="meter"
                  aria-label="Microphone level"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={activeMeter}
                >
                  {micOn ? (
                    <Mic className="w-3.5 h-3.5 text-white/70 shrink-0" aria-hidden="true" />
                  ) : (
                    <MicOff className="w-3.5 h-3.5 text-white/50 shrink-0" aria-hidden="true" />
                  )}
                  <div className="relative flex-1 h-1.5 rounded-full bg-white/15 overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-75"
                      style={{
                        width: `${Math.max(micOn ? 3 : 0, activeMeter)}%`,
                        background: 'linear-gradient(90deg, #22c55e 0%, #84cc16 55%, #f59e0b 80%, #ef4444 100%)',
                        backgroundSize: '220px 100%',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Look */}
            <section aria-labelledby="gr-look" className="rounded-[14px] gather-card-obsidian p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 id="gr-look" className={sectionLabel}>
                  Your look
                </h3>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={fx.mirror}
                    onClick={() => setFx((p) => ({ ...p, mirror: !p.mirror }))}
                    className="h-8 pl-2 pr-3 rounded-full border border-[var(--line-2)] bg-[var(--fill)] hover:bg-[var(--fill-hover)] text-[12px] text-[var(--ink-2)] inline-flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <span
                      className={`relative w-7 h-4 rounded-full transition-colors ${
                        fx.mirror ? 'bg-[var(--accent)]' : 'bg-[var(--line-2)]'
                      }`}
                      aria-hidden="true"
                    >
                      <span
                        className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-[left] duration-200 ${
                          fx.mirror ? 'left-3.5' : 'left-0.5'
                        }`}
                      />
                    </span>
                    <FlipHorizontal2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Mirror
                  </button>
                  <button
                    type="button"
                    disabled={!fxChanged}
                    onClick={() => setFx((p) => ({ ...DEFAULT_VIDEO_FX, mirror: p.mirror }))}
                    className="h-8 px-2.5 rounded-full text-[12px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    Reset
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" role="radiogroup" aria-label="Background and keying">
                {LOOKS.map((mode) => {
                  const active = bgMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => handleSelectBgMode(mode.id)}
                      className={`gather-lift h-[60px] px-1.5 rounded-[11px] border text-[11.5px] font-medium flex flex-col items-center justify-center gap-1 cursor-pointer ${
                        active
                          ? 'bg-[var(--accent-soft)] border-[var(--accent-line)] text-[var(--ink)]'
                          : 'bg-[var(--fill)] border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:border-[var(--line-2)]'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="w-8 h-3.5 rounded-[4px] border border-white/15"
                        style={{
                          background:
                            mode.id === 'natural'
                              ? 'linear-gradient(135deg,#64748b,#94a3b8)'
                              : mode.id === 'blur'
                              ? 'radial-gradient(circle at 50% 50%, #e2e8f0 22%, #334155 88%)'
                              : mode.id === 'cutout'
                              ? 'linear-gradient(135deg,#4f46e5,#0ea5e9)'
                              : mode.id === 'greenscreen'
                              ? 'linear-gradient(135deg,#16a34a,#15803d)'
                              : 'radial-gradient(circle at 50% 50%, #cbd5e1 15%, #0b1222 80%)',
                        }}
                      />
                      <span className="leading-none truncate max-w-full">{mode.label}</span>
                    </button>
                  );
                })}
              </div>

              {bgMode === 'blur' && (
                <label className="block space-y-1.5 pt-1">
                  <span className="flex justify-between text-[12px]">
                    <span className="text-[var(--ink-2)]">Background blur strength</span>
                    <span className="font-mono-num text-[var(--ink-3)]">{fx.blurAmount ?? 14}px</span>
                  </span>
                  <input
                    type="range"
                    min={4}
                    max={24}
                    value={fx.blurAmount ?? 14}
                    onChange={(e) => setFx((p) => ({ ...p, blurAmount: Number(e.target.value) }))}
                    className="gather-range w-full"
                  />
                </label>
              )}

              {(bgMode === 'cutout' || bgMode === 'greenscreen') && (
                <div className="space-y-3 rounded-[11px] bg-[var(--fill)]/70 border border-[var(--line)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11.5px] font-medium text-[var(--ink-2)] inline-flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                      Virtual Background
                    </span>
                    <label className="h-7 px-2.5 rounded-[7px] border border-[var(--line-2)] bg-[var(--surface)] hover:bg-[var(--fill-hover)] text-[11px] font-medium text-[var(--ink)] inline-flex items-center gap-1.5 cursor-pointer">
                      <Upload className="w-3 h-3" />
                      <span>Upload BG</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          handleVirtualBgUpload(e.target.files?.[0]);
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {VIRTUAL_BG_PRESETS.map((preset) => {
                      const isSel = (fx.virtualBgPreset || 'studio-aurora') === preset.id && !fx.virtualBgUrl;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() =>
                            setFx((p) => ({
                              ...p,
                              virtualBgPreset: preset.id,
                              virtualBgUrl: preset.imageUrl || '',
                            }))
                          }
                          className={`h-8 px-2.5 rounded-[8px] border text-[11px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                            isSel
                              ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]'
                              : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:text-[var(--ink)]'
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-[4px] border border-white/20 shrink-0"
                            style={{
                              background: preset.imageUrl
                                ? `url(${preset.imageUrl}) center/cover`
                                : `linear-gradient(135deg, ${preset.colors[0]}, ${preset.colors[2]})`,
                            }}
                          />
                          <span>{preset.label}</span>
                        </button>
                      );
                    })}
                    {fx.virtualBgUrl && fx.virtualBgPreset === 'custom' && (
                      <span className="h-8 px-2.5 rounded-[8px] border border-[var(--accent)] bg-[var(--accent-soft)] text-[11px] font-medium text-[var(--ink)] inline-flex items-center gap-1.5">
                        <span
                          className="w-3.5 h-3.5 rounded-[4px] border border-white/20 bg-cover bg-center"
                          style={{ backgroundImage: `url(${fx.virtualBgUrl})` }}
                        />
                        <span>Custom image</span>
                      </span>
                    )}
                  </div>

                  {bgMode === 'cutout' && (
                    <label className="block space-y-1.5">
                      <span className="flex justify-between text-[11.5px]">
                        <span className="text-[var(--ink-2)]">Cutout edge sensitivity</span>
                        <span className="font-mono-num text-[var(--ink-3)]">{fx.cutoutSensitivity ?? 55}%</span>
                      </span>
                      <input
                        type="range"
                        min={20}
                        max={88}
                        value={fx.cutoutSensitivity ?? 55}
                        onChange={(e) => setFx((p) => ({ ...p, cutoutSensitivity: Number(e.target.value) }))}
                        className="gather-range w-full"
                      />
                    </label>
                  )}

                  {bgMode === 'greenscreen' && (
                    <div className="space-y-2.5 pt-1 border-t border-[var(--line)]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11.5px] text-[var(--ink-2)]">Chroma key screen color</span>
                        <div className="flex items-center gap-1.5">
                          {[
                            { hex: '#16a34a', name: 'Studio Green' },
                            { hex: '#2563eb', name: 'Blue Screen' },
                            { hex: '#0d9488', name: 'Teal Key' },
                          ].map((c) => (
                            <button
                              key={c.hex}
                              type="button"
                              onClick={() => setFx((p) => ({ ...p, chromaColor: c.hex, chromaKey: true }))}
                              title={c.name}
                              className={`h-6 px-2 rounded-[6px] border text-[10.5px] font-medium inline-flex items-center gap-1 cursor-pointer ${
                                fx.chromaColor.toLowerCase() === c.hex
                                  ? 'border-white text-[var(--ink)] bg-[var(--fill-active)]'
                                  : 'border-[var(--line)] text-[var(--ink-3)] hover:text-[var(--ink)]'
                              }`}
                            >
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.hex }} />
                              <span>{c.name.split(' ')[1]}</span>
                            </button>
                          ))}
                          <label className="h-6 px-1.5 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] inline-flex items-center gap-1 cursor-pointer text-[10.5px] text-[var(--ink-2)]">
                            <input
                              type="color"
                              value={fx.chromaColor || '#16a34a'}
                              onChange={(e) => setFx((p) => ({ ...p, chromaColor: e.target.value, chromaKey: true }))}
                              className="w-4 h-4 rounded border-0 bg-transparent cursor-pointer"
                              aria-label="Pick custom chroma color"
                            />
                            <span>Custom</span>
                          </label>
                        </div>
                      </div>
                      <label className="block space-y-1">
                        <span className="flex justify-between text-[11.5px]">
                          <span className="text-[var(--ink-2)]">Key tolerance / spill</span>
                          <span className="font-mono-num text-[var(--ink-3)]">{fx.chromaTolerance}</span>
                        </span>
                        <input
                          type="range"
                          min={14}
                          max={85}
                          value={fx.chromaTolerance}
                          onChange={(e) => setFx((p) => ({ ...p, chromaTolerance: Number(e.target.value) }))}
                          className="gather-range w-full"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-5 gap-y-3">
                {SLIDERS.map((sl) => {
                  const value = fx[sl.key];
                  const delta = value - 100;
                  return (
                    <label key={sl.key} className="space-y-2">
                      <span className="flex justify-between text-[12px]">
                        <span className="text-[var(--ink-2)]">{sl.label}</span>
                        <span className="font-mono-num tabular-nums text-[var(--ink-3)]">
                          {delta === 0 ? 'Auto' : `${delta > 0 ? '+' : ''}${delta}`}
                        </span>
                      </span>
                      <input
                        type="range"
                        min={sl.min}
                        max={sl.max}
                        value={value}
                        onChange={(e) => setFx((p) => ({ ...p, [sl.key]: Number(e.target.value) }))}
                        onDoubleClick={() => setFx((p) => ({ ...p, [sl.key]: 100 }))}
                        className="gather-range w-full"
                        aria-valuetext={delta === 0 ? 'Default' : `${delta > 0 ? 'plus' : 'minus'} ${Math.abs(delta)}`}
                      />
                    </label>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="gr-devices" className="rounded-[14px] gather-card-obsidian p-4 space-y-3">
              <h3 id="gr-devices" className={sectionLabel}>
                Devices
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="flex items-center gap-2.5 min-w-0">
                <span className="w-10 h-10 rounded-[10px] bg-[var(--fill)] border border-[var(--line)] grid place-items-center shrink-0">
                  <Mic className="w-4 h-4 text-[var(--ink-2)]" aria-hidden="true" />
                </span>
                <span className="sr-only">Microphone</span>
                <select value={selectedMic} onChange={(e) => setSelectedMic(e.target.value)} className={inputCls}>
                  <option value="">Default microphone</option>
                  {audioInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Microphone ${d.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2.5 min-w-0">
                <span className="w-10 h-10 rounded-[10px] bg-[var(--fill)] border border-[var(--line)] grid place-items-center shrink-0">
                  <Camera className="w-4 h-4 text-[var(--ink-2)]" aria-hidden="true" />
                </span>
                <span className="sr-only">Camera</span>
                <select value={selectedCam} onChange={(e) => setSelectedCam(e.target.value)} className={inputCls}>
                  <option value="">Default camera</option>
                  {videoInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera ${d.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              </label>
              </div>
            </section>
          </div>

          {/* Right: show, you, launch */}
          <div className="lg:w-[42%] flex flex-col border-t lg:border-t-0 lg:border-l border-[var(--line)] min-w-0 lg:min-h-0">
            <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto gather-scroll p-5 sm:p-6 space-y-6">
              {isNewStudio && (
                <section aria-labelledby="gr-show" className="space-y-3">
                  <h3 id="gr-show" className={sectionLabel}>
                    Your show
                  </h3>
                  <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Watch page format">
                    {FORMATS.map((opt) => {
                      const Icon = opt.icon;
                      const active = watchMode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => handleSelectMode(opt.id)}
                          className={`gather-lift relative p-3 rounded-[12px] border text-left cursor-pointer overflow-hidden ${
                            active
                              ? 'bg-[var(--accent-soft)] border-[var(--accent-line)] text-[var(--ink)]'
                              : 'bg-[var(--fill)] border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:border-[var(--line-2)]'
                          }`}
                        >
                          {active && (
                            <span
                              aria-hidden="true"
                              className="absolute -top-8 -right-8 w-20 h-20 rounded-full bg-[var(--accent)]/30 blur-2xl"
                            />
                          )}
                          <Icon
                            className={`relative w-4 h-4 mb-2 ${active ? 'text-[var(--accent-text)]' : 'text-[var(--ink-3)]'}`}
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                          <span className="relative block text-[12.5px] font-semibold whitespace-nowrap">{opt.label}</span>
                          <span className="relative block text-[11px] text-[var(--ink-3)] leading-snug mt-0.5">{opt.blurb}</span>
                        </button>
                      );
                    })}
                  </div>
                  <label className="block space-y-1.5">
                    <span className="text-[12px] font-medium text-[var(--ink-2)]">Show title</span>
                    <input
                      type="text"
                      value={studioTitle}
                      onChange={(e) => {
                        setTitleEdited(true);
                        setStudioTitle(e.target.value);
                      }}
                      placeholder="Name your show"
                      maxLength={80}
                      className={inputCls}
                    />
                  </label>
                </section>
              )}

              <section aria-labelledby="gr-you" className="space-y-3">
                <h3 id="gr-you" className={sectionLabel}>
                  You
                </h3>
                <div className="flex items-center gap-3">
                  <label
                    className="group relative w-12 h-12 rounded-full shrink-0 cursor-pointer focus-within:ring-2 focus-within:ring-[var(--accent)]"
                    title={avatarUrl ? 'Change photo' : 'Add a photo'}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover border border-[var(--line-2)]" />
                    ) : (
                      <span className="w-12 h-12 rounded-full gather-btn-primary font-display font-medium text-[15px] grid place-items-center">
                        {initials || <User className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />}
                      </span>
                    )}
                    <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[var(--bg)] border border-[var(--line-2)] grid place-items-center text-[var(--ink-2)] group-hover:text-[var(--ink)]">
                      <ImagePlus className="w-3 h-3" aria-hidden="true" />
                    </span>
                    <span className="sr-only">{avatarUrl ? 'Change photo' : 'Add a photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        handleAvatarFile(e.target.files?.[0]);
                        e.currentTarget.value = '';
                      }}
                    />
                  </label>
                  <div className="flex-1 min-w-0 space-y-1">
                    <label htmlFor="greenroom-display-name" className="block text-[12px] font-medium text-[var(--ink-2)]">
                      Display name
                    </label>
                    <input
                      ref={nameInputRef}
                      id="greenroom-display-name"
                      type="text"
                      required
                      aria-invalid={nameError}
                      aria-describedby={nameError ? 'greenroom-name-error' : undefined}
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (nameError && e.target.value.trim()) setNameError(false);
                      }}
                      placeholder="How guests will see you"
                      autoComplete="name"
                      autoFocus={!initialName && typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches}
                      maxLength={40}
                      className={`${inputCls} ${
                        nameError ? '!border-[var(--warn)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--warn)_18%,transparent)]' : ''
                      }`}
                    />
                    {nameError && (
                      <p id="greenroom-name-error" role="alert" className="text-[12px] text-[var(--warn)]">
                        Add your name so guests know who you are.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                  {avatarUrl ? (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl(undefined)}
                      className="inline-flex items-center gap-1 text-[var(--ink-3)] hover:text-[var(--danger)] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Remove photo
                    </button>
                  ) : (
                    <span className="text-[var(--ink-3)]">Your photo shows when your camera is off.</span>
                  )}
                  {!isSignedIn && onOpenAuth && (
                    <button
                      type="button"
                      onClick={onOpenAuth}
                      className="inline-flex items-center gap-1 font-medium text-[var(--accent-text)] hover:underline cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                      Sign in to save
                    </button>
                  )}
                </div>
              </section>

            </div>

            {/* Ready check + launch (stays visible) */}
            <div className="sticky bottom-0 lg:static shrink-0 border-t border-[var(--line)] p-5 sm:p-6 pt-4 space-y-3.5 bg-[var(--elevated-header)] lg:bg-[var(--elevated-header)]/60 backdrop-blur-xl pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <ul className="hidden min-[400px]:grid grid-cols-3 gap-2" aria-label="Ready check">
                {checks.map((c) => (
                  <li
                    key={c.id}
                    className={`rounded-[10px] border px-2.5 py-2 min-w-0 ${
                      c.ok ? 'border-[var(--line)] bg-[var(--fill)]' : 'border-[var(--warn)]/40 bg-[var(--warn)]/10'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--ink)]">
                      {c.ok ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--ok)] shrink-0" aria-hidden="true" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-[var(--warn)] shrink-0" aria-hidden="true" />
                      )}
                      {c.label}
                    </span>
                    <span className="block text-[11px] text-[var(--ink-3)] truncate mt-0.5">{c.detail}</span>
                  </li>
                ))}
              </ul>
              <button
                type="submit"
                className="group w-full h-12 rounded-[12px] gather-btn-primary text-[14px] font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
              >
                <span>{isNewStudio ? 'Open my studio' : 'Join now'}</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
              <p className="flex items-center justify-center gap-1.5 text-[11.5px] text-[var(--ink-3)] text-center">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {isNewStudio
                  ? 'You go live only when you press Go Live.'
                  : 'The host will let you in from the waiting room.'}
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
