import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CalendarPlus,
  Check,
  Clock,
  Command,
  Copy,
  DollarSign,
  Download,
  Eye,
  Gamepad2,
  Keyboard,
  Layers,
  Link2,
  Mail,
  Radio,
  RotateCcw,
  ShoppingBag,
  Sliders,
  Sparkles,
  Sun,
  Moon,
  Upload,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import { DEFAULT_VIDEO_FX, VIRTUAL_BG_PRESETS } from '../constants/studioDefaults';
import { audioEngine, AutoDuckerConfig } from '../utils/audioEngine';
import { resolveBgMode } from '../utils/cameraFxProcessor';
import { GatherLogo } from './GatherLogo';
import {
  AspectRatio,
  DestinationConfig,
  RoomState,
  ScheduledShow,
  VideoBgMode,
  VideoFxSettings,
  WatchMode,
} from '../types/studio';

export const InviteModal: React.FC<{
  open: boolean;
  roomCode: string;
  watchMode?: WatchMode;
  onClose: () => void;
  onOpenWatchPreview: () => void;
}> = ({ open, roomCode, watchMode = 'standard', onClose, onOpenWatchPreview }) => {
  const [copied, setCopied] = useState<string | null>(null);
  if (!open) return null;

  const guestUrl = `${window.location.origin}/?join=${roomCode}`;
  const watchUrl = `${window.location.origin}/?watch=${roomCode}`;

  const copyText = (key: string, value: string) => {
    void navigator.clipboard?.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  };

  const watchLabel =
    watchMode === 'shop'
      ? 'Live Shop Watch Page Link'
      : watchMode === 'gamer'
      ? 'Gaming Arena Watch Page Link'
      : 'Broadcast Watch Page Link';

  return (
    <div
      className="fixed inset-0 z-50 gather-lightbox-scrim flex items-center justify-center p-4 animate-gather-backdrop"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] rounded-[18px] gather-glass-elevated animate-gather-modal p-5 space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
          <div className="flex items-center gap-2.5">
            <GatherLogo size={22} />
            <h2 className="font-display text-[15px] font-medium text-[var(--ink)]">
              Invite Co-Hosts &amp; Share Watch Page
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close invite modal"
            className="h-8 w-8 grid place-items-center rounded-[8px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-[var(--line)] space-y-4 text-xs">
          <div className="space-y-1.5">
            <div className="font-semibold text-[var(--ink)]">
              On-Stage Guest Invite (up to 6 speakers)
            </div>
            <p className="text-[11px] text-[var(--ink-3)]">
              Guests join from their browser with zero installs or account fees.
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={guestUrl}
                className="flex-1 h-9 px-3 rounded-[8px] bg-[var(--fill)] border border-[var(--line-2)] font-mono-num text-[11px] text-[var(--ink-2)]"
              />
              <button
                type="button"
                onClick={() => copyText('guest', guestUrl)}
                className="h-9 px-3.5 rounded-[8px] gather-btn-primary font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copied === 'guest' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied === 'guest' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="pt-4 space-y-1.5">
            <div className="font-semibold text-[var(--ink)]">{watchLabel}</div>
            <p className="text-[11px] text-[var(--ink-3)]">
              Viewers watch in HD and send 0%-fee tips directly inside live chat without leaving.
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={watchUrl}
                className="flex-1 h-9 px-3 rounded-[8px] bg-[var(--fill)] border border-[var(--line-2)] font-mono-num text-[11px] text-[var(--ink-2)]"
              />
              <button
                type="button"
                onClick={() => copyText('watch', watchUrl)}
                className="h-9 px-3.5 rounded-[8px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line-2)] text-[var(--ink)] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copied === 'watch' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied === 'watch' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenWatchPreview();
              }}
              className="text-[11px] font-semibold text-[var(--accent-text)] hover:underline inline-flex items-center gap-1.5 pt-1 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview live Watch Page inside Studio</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const GoLiveModal: React.FC<{
  open: boolean;
  room: RoomState;
  destinations: DestinationConfig[];
  onUpdateDestinations: (dests: DestinationConfig[]) => void;
  onToggleLive: () => void;
  onChangeAspect: (aspect: AspectRatio) => void;
  onChangeWatchMode?: (mode: WatchMode) => void;
  onNotifySubscribers?: () => void;
  onClose: () => void;
}> = ({
  open,
  room,
  destinations,
  onUpdateDestinations,
  onToggleLive,
  onChangeAspect,
  onChangeWatchMode,
  onNotifySubscribers,
  onClose,
}) => {
  if (!open) return null;

  const enabledCount = destinations.filter((d) => d.enabled).length;

  return (
    <div
      className="fixed inset-0 z-50 gather-lightbox-scrim flex items-center justify-center p-4 animate-gather-backdrop"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[580px] rounded-[18px] gather-glass-elevated animate-gather-modal p-5 space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
          <div className="flex items-center gap-2.5">
            <GatherLogo size={24} />
            <div>
              <h2 className="font-display text-[15px] font-medium text-[var(--ink)]">
                Go Live &amp; Free 8-Platform Simulcast
              </h2>
              <p className="text-[11px] text-[var(--ink-3)] font-mono-num mt-0.5">
                $0/mo unlimited multi-streaming · Gather Watch Page always active
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Go Live modal"
            className="h-8 w-8 grid place-items-center rounded-[8px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Watch Format + Aspect Ratio Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {onChangeWatchMode && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-[var(--ink-2)] block">
                Watch Page Format
              </span>
              <div className="gather-seg w-full grid grid-cols-3">
                {(
                  [
                    { id: 'standard', label: 'Broadcast' },
                    { id: 'shop', label: 'Shop' },
                    { id: 'gamer', label: 'Gaming' },
                  ] as Array<{ id: WatchMode; label: string }>
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-selected={room.watchMode === m.id}
                    onClick={() => onChangeWatchMode(m.id)}
                    className={`gather-seg-btn h-7 text-[11px] ${
                      room.watchMode === m.id ? 'active' : ''
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-[var(--ink-2)] block">Stage Aspect</span>
            <div className="gather-seg w-full grid grid-cols-2">
              {(['16:9', '9:16'] as AspectRatio[]).map((ar) => (
                <button
                  key={ar}
                  type="button"
                  aria-selected={room.aspectRatio === ar}
                  onClick={() => onChangeAspect(ar)}
                  className={`gather-seg-btn h-7 text-[11px] ${
                    room.aspectRatio === ar ? 'active' : ''
                  }`}
                >
                  {ar === '16:9' ? '16:9 Landscape' : '9:16 Vertical'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 8 Simulcast Destinations */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--ink-2)]">
              Simulcast Destinations (all 8 unlocked free)
            </span>
            <span className="font-mono-num text-[11px] text-[var(--ok)]">
              {enabledCount} external + Gather Watch Page
            </span>
          </div>
          <div className="max-h-[260px] overflow-y-auto gather-scroll pr-1 divide-y divide-[var(--line)] border border-[var(--line)] rounded-[12px] px-3 bg-[var(--fill)]">
            {destinations.map((d) => (
              <div key={d.id} className="py-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--ink)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={d.enabled}
                      onChange={(e) =>
                        onUpdateDestinations(
                          destinations.map((item) =>
                            item.id === d.id ? { ...item, enabled: e.target.checked } : item
                          )
                        )
                      }
                      className="accent-[var(--accent)]"
                    />
                    <span>{d.label}</span>
                  </label>
                  <span className="text-[10px] font-mono-num text-[var(--ink-3)] uppercase">
                    {d.platform}
                  </span>
                </div>

                {d.enabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {d.platform === 'custom' && (
                      <input
                        type="url"
                        value={d.rtmpUrl || ''}
                        onChange={(e) =>
                          onUpdateDestinations(
                            destinations.map((item) =>
                              item.id === d.id ? { ...item, rtmpUrl: e.target.value } : item
                            )
                          )
                        }
                        placeholder="rtmp://live.example.com/app"
                        className="w-full h-8 px-2.5 rounded-[7px] bg-[var(--bg)]/70 border border-[var(--line-2)] text-xs text-[var(--ink)]"
                      />
                    )}
                    <input
                      type="password"
                      value={d.streamKey}
                      onChange={(e) =>
                        onUpdateDestinations(
                          destinations.map((item) =>
                            item.id === d.id ? { ...item, streamKey: e.target.value } : item
                          )
                        )
                      }
                      placeholder={`Paste ${d.label} stream key`}
                      className={`w-full h-8 px-2.5 rounded-[7px] bg-[var(--bg)]/70 border border-[var(--line-2)] text-xs text-[var(--ink)] ${
                        d.platform === 'custom' ? '' : 'sm:col-span-2'
                      }`}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {onNotifySubscribers && (
            <button
              type="button"
              onClick={onNotifySubscribers}
              className="h-10 px-4 rounded-[10px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line-2)] text-xs font-semibold text-[var(--ink)] inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              <span>Email Subscribers</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onToggleLive();
              onClose();
            }}
            className={`flex-1 h-10 rounded-[10px] text-[13px] font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              room.isLive ? 'gather-btn-live' : 'gather-btn-primary'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>{room.isLive ? 'End Live Broadcast' : 'Start Live Broadcast Now'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

function toLocalDateStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nextWeekendDateStr(): string {
  const d = new Date();
  const dayOfWeek = d.getDay();
  const daysToSat = (6 - dayOfWeek + 7) % 7 || 7;
  return toLocalDateStr(daysToSat);
}

function formatPreviewSchedule(dateStr: string, timeStr: string): string {
  try {
    const dt = new Date(`${dateStr}T${timeStr || '18:00'}:00`);
    if (Number.isNaN(dt.getTime())) return `${dateStr} · ${timeStr}`;
    const formattedDate = new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(dt);
    const formattedTime = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(dt);
    return `${formattedDate} · ${formattedTime}`;
  } catch {
    return `${dateStr} · ${timeStr}`;
  }
}

const SCHEDULE_DEFAULTS: Record<WatchMode, { title: string; desc: string }> = {
  standard: {
    title: 'Product Keynote & Live Q&A',
    desc: 'Join live on our Gather Watch Page with Q&A, Polls & 0%-fee direct tips.',
  },
  shop: {
    title: 'Limited Studio Objects Live Drop',
    desc: 'Exclusive small-batch release with live demos & 1-click Express Bag checkout.',
  },
  gamer: {
    title: 'Ranked Squad Co-Stream & Viewer Games',
    desc: 'Join squad queues live, vote on map picks & clip top highlights in real time.',
  },
};

export const ScheduleModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSaveShow: (show: ScheduledShow, notifySubscribers?: boolean) => void;
}> = ({ open, onClose, onSaveShow }) => {
  const [watchMode, setWatchMode] = useState<WatchMode>('standard');
  const [title, setTitle] = useState(SCHEDULE_DEFAULTS.standard.title);
  const [description, setDescription] = useState(SCHEDULE_DEFAULTS.standard.desc);
  const [editedText, setEditedText] = useState(false);
  const [date, setDate] = useState(() => toLocalDateStr(1));
  const [time, setTime] = useState('18:00');
  const [durationMin, setDurationMin] = useState(45);
  const [notifySubscribers, setNotifySubscribers] = useState(true);
  const [draftRoomCode, setDraftRoomCode] = useState(() =>
    Math.random().toString(36).slice(2, 8).toUpperCase()
  );
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraftRoomCode(Math.random().toString(36).slice(2, 8).toUpperCase());
    setCopiedLink(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const todayStr = toLocalDateStr(0);
  const tomorrowStr = toLocalDateStr(1);
  const weekendStr = nextWeekendDateStr();
  const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop()?.replace(/_/g, ' ') || 'Local';
  const watchUrl = `${window.location.origin}/?watch=${draftRoomCode}`;

  const handleSelectMode = (mode: WatchMode) => {
    setWatchMode(mode);
    if (!editedText) {
      setTitle(SCHEDULE_DEFAULTS[mode].title);
      setDescription(SCHEDULE_DEFAULTS[mode].desc);
    }
  };

  const handleCopyLink = () => {
    void navigator.clipboard?.writeText(watchUrl);
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 1800);
  };

  const handleDownloadIcs = () => {
    const start = new Date(`${date}T${time || '18:00'}:00`);
    const safeStart = Number.isNaN(start.getTime()) ? new Date() : start;
    const end = new Date(safeStart.getTime() + durationMin * 60000);
    const fmt = (d: Date) =>
      d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//gather.//Broadcast Scheduler//EN',
      'BEGIN:VEVENT',
      `UID:${draftRoomCode}@gather.live`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(safeStart)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${(title || 'Gather Live Broadcast').replace(/\n/g, ' ')}`,
      `DESCRIPTION:${(description || '').replace(/\n/g, ' ')}\\nWatch: ${watchUrl}`,
      `URL:${watchUrl}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gather-${draftRoomCode.toLowerCase()}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const show: ScheduledShow = {
      id: `show-${Date.now()}`,
      title: title.trim() || 'Scheduled Show',
      description,
      date,
      time,
      durationMin,
      watchMode,
      roomCode: draftRoomCode,
      invitees: '',
    };
    onSaveShow(show, notifySubscribers);
    onClose();
  };

  const inputCls =
    'w-full h-9.5 px-3 rounded-[9px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line-2)] text-[12.5px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--accent)] transition-colors';

  const FormatIcon =
    watchMode === 'shop' ? ShoppingBag : watchMode === 'gamer' ? Gamepad2 : Radio;

  return (
    <div
      className="fixed inset-0 z-50 gather-lightbox-scrim flex items-center justify-center p-3 sm:p-5 overflow-y-auto gather-scroll animate-gather-backdrop"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-modal-heading"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[860px] max-h-[92vh] overflow-y-auto gather-scroll rounded-[18px] gather-glass-elevated animate-gather-modal"
      >
        {/* Top Lightbox Header */}
        <div className="flex items-center justify-between gap-4 px-5 sm:px-6 py-3.5 border-b border-[var(--line)]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-8 h-8 rounded-[9px] bg-[var(--accent-soft)] border border-[var(--accent-line)] grid place-items-center shrink-0">
              <Calendar className="w-4 h-4 text-[var(--accent-text)]" />
            </span>
            <div className="min-w-0">
              <h2
                id="schedule-modal-heading"
                className="font-display text-[15px] font-medium text-[var(--ink)] tracking-tight leading-tight"
              >
                Schedule a Broadcast
              </h2>
              <p className="text-[11px] text-[var(--ink-3)] font-mono-num mt-0.5 truncate">
                Auto-generates Watch Page Countdown &amp; Room Pass · $0 Platform Fees
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close schedule modal"
            className="h-8 w-8 grid place-items-center rounded-[8px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSave}
          className="grid grid-cols-1 lg:grid-cols-[56%_44%] min-w-0"
        >
          {/* Left 56%: Show Details, Smart Date/Time & Notifications */}
          <div className="p-5 sm:p-6 space-y-4 min-w-0">
            {/* Watch Page Format Cards */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)] block">
                Watch Page Format
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'standard', label: 'Broadcast', icon: Radio },
                    { id: 'shop', label: 'Live Shop', icon: ShoppingBag },
                    { id: 'gamer', label: 'Gaming', icon: Gamepad2 },
                  ] as Array<{
                    id: WatchMode;
                    label: string;
                    icon: React.ComponentType<{ className?: string }>;
                  }>
                ).map((m) => {
                  const Icon = m.icon;
                  const active = watchMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-selected={active}
                      onClick={() => handleSelectMode(m.id)}
                      className={`p-2.5 rounded-[10px] border text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--ink)] shadow-[0_0_0_1px_rgba(79,110,247,0.3)]'
                          : 'bg-[var(--fill)] border-[var(--line)] text-[var(--ink-3)] hover:text-[var(--ink)] hover:border-[var(--line-2)]'
                      }`}
                    >
                      <Icon
                        className={`w-3.5 h-3.5 mb-1.5 ${
                          active ? 'text-[var(--accent-text)]' : ''
                        }`}
                      />
                      <div className="text-[11.5px] font-semibold whitespace-nowrap">
                        {m.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="block space-y-1.5">
              <span className="text-[11.5px] font-medium text-[var(--ink-2)]">Show title</span>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => {
                  setEditedText(true);
                  setTitle(e.target.value);
                }}
                placeholder="Product Keynote & Live Q&A"
                className={inputCls}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-[11.5px] font-medium text-[var(--ink-2)]">
                Description &amp; Agenda
              </span>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => {
                  setEditedText(true);
                  setDescription(e.target.value);
                }}
                placeholder="What viewers can expect when they tune in live..."
                className="w-full p-3 rounded-[9px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line-2)] text-[12px] leading-relaxed text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
              />
            </label>

            {/* Quick Day Shortcuts + Date / Time Pickers */}
            <div className="space-y-2.5 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11.5px] font-medium text-[var(--ink-2)]">
                  Air Date &amp; Time ({tzName})
                </span>
                <div className="flex items-center gap-3 text-[11px]">
                  {[
                    { label: 'Today', val: todayStr },
                    { label: 'Tomorrow', val: tomorrowStr },
                    { label: 'Weekend', val: weekendStr },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setDate(preset.val)}
                      className={`pb-0.5 border-b transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        date === preset.val
                          ? 'border-[var(--accent)] text-[var(--ink)] font-semibold'
                          : 'border-transparent text-[var(--ink-3)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="date"
                  aria-label="Broadcast date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`${inputCls} font-mono-num [color-scheme:dark]`}
                />
                <input
                  type="time"
                  aria-label="Broadcast time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className={`${inputCls} font-mono-num [color-scheme:dark]`}
                />
              </div>
            </div>

            {/* Duration Presets */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="font-medium text-[var(--ink-2)]">Estimated Runtime</span>
                <span className="font-mono-num tabular-nums text-[var(--ink-3)]">
                  {durationMin} min
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[30, 45, 60, 90].map((mins) => {
                  const active = durationMin === mins;
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setDurationMin(mins)}
                      className={`h-8 rounded-[8px] border text-[11.5px] font-mono-num tabular-nums transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--ink)] font-semibold'
                          : 'bg-[var(--fill)] border-[var(--line)] text-[var(--ink-3)] hover:text-[var(--ink)] hover:border-[var(--line-2)]'
                      }`}
                    >
                      {mins}m
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subscriber Notification Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={notifySubscribers}
              onClick={() => setNotifySubscribers((v) => !v)}
              className={`w-full flex items-center justify-between gap-3 p-3 rounded-[10px] border text-left transition-colors cursor-pointer ${
                notifySubscribers
                  ? 'bg-[var(--accent-soft)]/70 border-[var(--accent-line)]'
                  : 'bg-[var(--fill)] border-[var(--line)] hover:border-[var(--line-2)]'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <Mail
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    notifySubscribers ? 'text-[var(--accent-text)]' : 'text-[var(--ink-3)]'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-[var(--ink)]">
                    Notify subscribers &amp; pin reminder
                  </div>
                  <div className="text-[11px] text-[var(--ink-3)] leading-snug">
                    Dispatches calendar email + countdown banner on Watch Page.
                  </div>
                </div>
              </div>
              <span
                aria-hidden="true"
                className={`w-8 h-4.5 rounded-full p-0.5 transition-colors shrink-0 flex items-center ${
                  notifySubscribers ? 'bg-[var(--accent)] justify-end' : 'bg-white/15 justify-start'
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-full bg-white shadow-xs" />
              </span>
            </button>
          </div>

          {/* Right 44%: Live Watch Card Preview & Broadcast Pass */}
          <div className="p-5 sm:p-6 flex flex-col justify-between gap-5 border-t lg:border-t-0 lg:border-l border-[var(--line)] bg-white/[0.015] min-w-0">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">
                  Live Watch Pass Preview
                </span>
                <span className="font-mono-num text-[10.5px] text-[var(--ink-3)]">
                  Room {draftRoomCode}
                </span>
              </div>

              {/* Obsidian Broadcast Pass Card */}
              <div className="relative rounded-[14px] border border-white/12 bg-[#070b16] p-4 space-y-3.5 shadow-[0_22px_50px_-20px_rgba(0,0,0,0.85)] overflow-hidden">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-12 -right-12 w-36 h-36 rounded-full blur-2xl opacity-35"
                  style={{
                    background:
                      watchMode === 'shop'
                        ? 'radial-gradient(circle, #10b981, transparent 70%)'
                        : watchMode === 'gamer'
                        ? 'radial-gradient(circle, #8b5cf6, transparent 70%)'
                        : 'radial-gradient(circle, #4f6ef7, transparent 70%)',
                  }}
                />

                <div className="relative flex items-center justify-between gap-2 text-[10px] font-mono-num uppercase tracking-[0.08em]">
                  <span className="inline-flex items-center gap-1.5 text-[var(--accent-text)] font-semibold">
                    <FormatIcon className="w-3.5 h-3.5" />
                    <span>
                      {watchMode === 'shop'
                        ? 'Live Shop Drop'
                        : watchMode === 'gamer'
                        ? 'Gaming Co-Stream'
                        : 'Live Broadcast'}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-white/55 tabular-nums">
                    <Clock className="w-3 h-3" />
                    <span>{durationMin}m</span>
                  </span>
                </div>

                <div className="relative space-y-1.5">
                  <div className="text-[11.5px] font-mono-num font-semibold text-white/90">
                    {formatPreviewSchedule(date, time)} · {tzName}
                  </div>
                  <h3 className="font-display text-[15.5px] font-medium text-white leading-snug line-clamp-2">
                    {title.trim() || 'Untitled Gather Broadcast'}
                  </h3>
                  <p className="text-[11.5px] text-white/60 leading-relaxed line-clamp-2">
                    {description.trim() || 'Tune in live directly from your browser.'}
                  </p>
                </div>

                <div className="relative pt-3 border-t border-white/[0.08] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[9.5px] uppercase tracking-wider text-white/40">
                      Watch URL
                    </div>
                    <div className="text-[10.5px] font-mono-num text-white/75 truncate">
                      /?watch={draftRoomCode}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="h-7 px-2.5 rounded-[7px] bg-white/[0.06] hover:bg-white/[0.12] border border-white/12 text-[10.5px] font-medium text-white inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
                    >
                      {copiedLink ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Link2 className="w-3 h-3" />
                      )}
                      <span>{copiedLink ? 'Copied' : 'Copy link'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadIcs}
                      title="Download .ics calendar invite"
                      className="h-7 px-2.5 rounded-[7px] bg-white/[0.06] hover:bg-white/[0.12] border border-white/12 text-[10.5px] font-medium text-white inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <CalendarPlus className="w-3 h-3" />
                      <span>.ics</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-[var(--ink-3)] leading-relaxed">
                Saved broadcasts appear on your homepage bar so you can launch the studio in 1 click when showtime arrives.
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="submit"
                className="group w-full h-11 rounded-[10px] gather-btn-primary text-[13px] font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <span>
                  {notifySubscribers
                    ? 'Schedule & Notify Subscribers'
                    : 'Save Scheduled Broadcast'}
                </span>
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full h-8 text-[11.5px] font-medium text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

type SettingsSection = 'appearance' | 'camera' | 'audio' | 'ai';

export const SettingsModal: React.FC<{
  open: boolean;
  theme: 'dark' | 'light';
  videoFx: VideoFxSettings;
  onToggleTheme: () => void;
  onUpdateVideoFx: (fx: VideoFxSettings) => void;
  onOpenAiStudio?: () => void;
  onClose: () => void;
}> = ({ open, theme, videoFx, onToggleTheme, onUpdateVideoFx, onOpenAiStudio, onClose }) => {
  const [section, setSection] = useState<SettingsSection>('appearance');
  const [ducker, setDucker] = useState<AutoDuckerConfig>(() => audioEngine.getAutoDuckerConfig());

  useEffect(() => {
    if (!open) return;
    setDucker(audioEngine.getAutoDuckerConfig());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const bgMode = resolveBgMode(videoFx);

  const updateDucker = (patch: Partial<AutoDuckerConfig>) => {
    const next = { ...ducker, ...patch };
    setDucker(next);
    audioEngine.setAutoDuckerConfig(next);
  };

  const navItems: Array<{ id: SettingsSection; label: string; desc: string; icon: React.ReactNode }> = [
    {
      id: 'appearance',
      label: 'Appearance',
      desc: 'Dark obsidian & light glass',
      icon: theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />,
    },
    {
      id: 'camera',
      label: 'Camera & Color',
      desc: 'Framing, blur & exposure',
      icon: <Video className="w-4 h-4" />,
    },
    {
      id: 'audio',
      label: 'Audio & Auto-Ducker',
      desc: 'Sidechain voice ducking',
      icon: <Sliders className="w-4 h-4" />,
    },
    {
      id: 'ai',
      label: 'AI Creative Studio',
      desc: 'HUDs, brands, voice & clips',
      icon: <Sparkles className="w-4 h-4" />,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 gather-lightbox-scrim flex items-center justify-center p-3 sm:p-5 overflow-y-auto gather-scroll animate-gather-backdrop"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-heading"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[780px] rounded-[20px] gather-glass-elevated animate-gather-modal overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 bg-[var(--elevated-header)] border-b border-[var(--line)]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-8 h-8 rounded-[9px] bg-[var(--accent-soft)] border border-[var(--accent-line)] grid place-items-center shrink-0">
              <GatherLogo size={16} />
            </span>
            <div className="min-w-0">
              <h2
                id="settings-modal-heading"
                className="font-display text-[15px] font-medium text-[var(--ink)] tracking-tight leading-tight"
              >
                Studio Settings
              </h2>
              <p className="text-[11px] text-[var(--ink-3)] mt-0.5 truncate">
                Workspace appearance, camera grading, master audio sidechain &amp; AI tools
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings modal"
            className="h-8 w-8 grid place-items-center rounded-[8px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] cursor-pointer transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2-Column Categorized Shell */}
        <div className="grid grid-cols-1 md:grid-cols-[224px_minmax(0,1fr)] min-h-[380px]">
          {/* Category Nav Rail */}
          <nav
            aria-label="Settings categories"
            className="p-2.5 md:p-3 bg-[var(--elevated-rail)] border-b md:border-b-0 md:border-r border-[var(--line)] flex md:flex-col gap-1 overflow-x-auto gather-scroll"
          >
            {navItems.map((item) => {
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-left transition-colors cursor-pointer shrink-0 md:w-full ${
                    active
                      ? 'bg-[var(--accent-soft)] text-[var(--ink)] border border-[var(--accent-line)]'
                      : 'text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] border border-transparent'
                  }`}
                >
                  <span className={active ? 'text-[var(--accent-text)]' : 'text-[var(--ink-3)]'}>
                    {item.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-medium whitespace-nowrap">
                      {item.label}
                    </span>
                    <span className="hidden md:block text-[10.5px] text-[var(--ink-3)] truncate">
                      {item.desc}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Active Setting Canvas */}
          <div className="p-5 sm:p-6 space-y-5">
            {section === 'appearance' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-display text-[14px] font-medium text-[var(--ink)]">
                    Studio Surface Theme
                  </h3>
                  <p className="text-[11.5px] text-[var(--ink-3)] mt-0.5">
                    Switch between low-glare Obsidian Dark and crisp Porcelain Light across Studio &amp; Watch Pages.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (theme !== 'dark') onToggleTheme();
                    }}
                    className={`p-3 rounded-[13px] border text-left transition-all cursor-pointer space-y-2.5 ${
                      theme === 'dark'
                        ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
                        : 'border-[var(--line-2)] bg-[var(--fill)] hover:bg-[var(--fill-hover)]'
                    }`}
                  >
                    <div className="h-20 rounded-[9px] bg-[#060a16] border border-white/10 p-2.5 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="h-2 w-12 rounded bg-white/80" />
                        <span className="h-2 w-5 rounded bg-blue-500" />
                      </div>
                      <div className="grid grid-cols-[1.6fr_1fr] gap-1.5 h-9">
                        <span className="rounded bg-white/10 border border-white/10" />
                        <span className="rounded bg-white/5 border border-white/10" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-medium text-[var(--ink)]">
                        Obsidian Dark
                      </span>
                      {theme === 'dark' && (
                        <span className="text-[11px] font-medium text-[var(--accent-text)] inline-flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Active
                        </span>
                      )}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (theme !== 'light') onToggleTheme();
                    }}
                    className={`p-3 rounded-[13px] border text-left transition-all cursor-pointer space-y-2.5 ${
                      theme === 'light'
                        ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
                        : 'border-[var(--line-2)] bg-[var(--fill)] hover:bg-[var(--fill-hover)]'
                    }`}
                  >
                    <div className="h-20 rounded-[9px] bg-[#eef3fc] border border-slate-900/10 p-2.5 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="h-2 w-12 rounded bg-slate-900/80" />
                        <span className="h-2 w-5 rounded bg-blue-600" />
                      </div>
                      <div className="grid grid-cols-[1.6fr_1fr] gap-1.5 h-9">
                        <span className="rounded bg-white border border-slate-900/10" />
                        <span className="rounded bg-white/80 border border-slate-900/10" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-medium text-[var(--ink)]">
                        Porcelain Light
                      </span>
                      {theme === 'light' && (
                        <span className="text-[11px] font-medium text-[var(--accent-text)] inline-flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Active
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              </div>
            )}

            {section === 'camera' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-[14px] font-medium text-[var(--ink)]">
                      Camera Look &amp; Color Grading
                    </h3>
                    <p className="text-[11.5px] text-[var(--ink-3)] mt-0.5">
                      Real-time hardware color correction applied to the live stage canvas.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateVideoFx(DEFAULT_VIDEO_FX)}
                    className="h-8 px-2.5 rounded-[8px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line-2)] inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  <span className="text-[11.5px] font-medium text-[var(--ink-2)] block">
                    Background &amp; Keying Treatment
                  </span>
                  <div className="gather-seg w-full grid grid-cols-5">
                    {(
                      [
                        { id: 'natural', label: 'Natural' },
                        { id: 'blur', label: 'Soft Blur' },
                        { id: 'cutout', label: 'Cutout BG' },
                        { id: 'greenscreen', label: 'Greenscreen' },
                        { id: 'dim', label: 'Spotlight' },
                      ] as Array<{ id: VideoBgMode; label: string }>
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        aria-selected={bgMode === m.id}
                        onClick={() =>
                          onUpdateVideoFx({
                            ...videoFx,
                            bgMode: m.id,
                            blurBg: m.id === 'blur',
                            chromaKey: m.id === 'greenscreen',
                          })
                        }
                        className={`gather-seg-btn h-8 text-[11px] ${bgMode === m.id ? 'active' : ''}`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {bgMode === 'blur' && (
                    <label className="flex items-center justify-between gap-4 text-[12px] pt-1">
                      <span className="text-[var(--ink-2)] w-24 shrink-0">Blur Amount</span>
                      <input
                        type="range"
                        min={4}
                        max={24}
                        value={videoFx.blurAmount ?? 14}
                        onChange={(e) =>
                          onUpdateVideoFx({ ...videoFx, blurAmount: Number(e.target.value) })
                        }
                        className="gather-range flex-1"
                      />
                      <span className="font-mono-num text-[11.5px] text-[var(--ink)] w-11 text-right">
                        {videoFx.blurAmount ?? 14}px
                      </span>
                    </label>
                  )}

                  {(bgMode === 'cutout' || bgMode === 'greenscreen') && (
                    <div className="p-3 rounded-[10px] bg-[var(--fill)] border border-[var(--line)] space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11.5px] font-medium text-[var(--ink-2)]">Virtual Backdrop</span>
                        <label className="h-7 px-2 rounded-[6px] border border-[var(--line-2)] bg-[var(--surface)] hover:bg-[var(--fill-hover)] text-[11px] text-[var(--ink)] inline-flex items-center gap-1 cursor-pointer">
                          <Upload className="w-3 h-3" />
                          <span>Custom Image</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = () => {
                                if (typeof reader.result === 'string') {
                                  onUpdateVideoFx({
                                    ...videoFx,
                                    virtualBgPreset: 'custom',
                                    virtualBgUrl: reader.result,
                                  });
                                }
                              };
                              reader.readAsDataURL(file);
                              e.currentTarget.value = '';
                            }}
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {VIRTUAL_BG_PRESETS.map((preset) => {
                          const active =
                            (videoFx.virtualBgPreset || 'studio-aurora') === preset.id &&
                            !videoFx.virtualBgUrl;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() =>
                                onUpdateVideoFx({
                                  ...videoFx,
                                  virtualBgPreset: preset.id,
                                  virtualBgUrl: preset.imageUrl || '',
                                })
                              }
                              className={`h-7 px-2 rounded-[6px] border text-[11px] font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                                active
                                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]'
                                  : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]'
                              }`}
                            >
                              <span
                                className="w-3 h-3 rounded-[3px]"
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
                      </div>

                      {bgMode === 'cutout' && (
                        <label className="flex items-center justify-between gap-4 text-[12px]">
                          <span className="text-[var(--ink-2)] w-24 shrink-0">Sensitivity</span>
                          <input
                            type="range"
                            min={20}
                            max={88}
                            value={videoFx.cutoutSensitivity ?? 55}
                            onChange={(e) =>
                              onUpdateVideoFx({
                                ...videoFx,
                                cutoutSensitivity: Number(e.target.value),
                              })
                            }
                            className="gather-range flex-1"
                          />
                          <span className="font-mono-num text-[11.5px] text-[var(--ink)] w-11 text-right">
                            {videoFx.cutoutSensitivity ?? 55}%
                          </span>
                        </label>
                      )}

                      {bgMode === 'greenscreen' && (
                        <div className="space-y-2 pt-1 border-t border-[var(--line)]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11.5px] text-[var(--ink-2)]">Key Color</span>
                            <div className="flex items-center gap-1.5">
                              {['#16a34a', '#2563eb', '#0d9488'].map((hex) => (
                                <button
                                  key={hex}
                                  type="button"
                                  onClick={() =>
                                    onUpdateVideoFx({
                                      ...videoFx,
                                      chromaColor: hex,
                                      chromaKey: true,
                                    })
                                  }
                                  className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                                    videoFx.chromaColor.toLowerCase() === hex
                                      ? 'border-white scale-110'
                                      : 'border-transparent'
                                  }`}
                                  style={{ backgroundColor: hex }}
                                  aria-label={`Select key color ${hex}`}
                                />
                              ))}
                              <input
                                type="color"
                                value={videoFx.chromaColor || '#16a34a'}
                                onChange={(e) =>
                                  onUpdateVideoFx({
                                    ...videoFx,
                                    chromaColor: e.target.value,
                                    chromaKey: true,
                                  })
                                }
                                className="w-6 h-6 rounded bg-transparent cursor-pointer"
                                aria-label="Custom key color"
                              />
                            </div>
                          </div>
                          <label className="flex items-center justify-between gap-4 text-[12px]">
                            <span className="text-[var(--ink-2)] w-24 shrink-0">Tolerance</span>
                            <input
                              type="range"
                              min={14}
                              max={85}
                              value={videoFx.chromaTolerance}
                              onChange={(e) =>
                                onUpdateVideoFx({
                                  ...videoFx,
                                  chromaTolerance: Number(e.target.value),
                                })
                              }
                              className="gather-range flex-1"
                            />
                            <span className="font-mono-num text-[11.5px] text-[var(--ink)] w-11 text-right">
                              {videoFx.chromaTolerance}
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-1">
                  <label className="flex items-center justify-between gap-4 text-[12px]">
                    <span className="text-[var(--ink-2)] w-24 shrink-0">Brightness</span>
                    <input
                      type="range"
                      min={60}
                      max={140}
                      value={videoFx.brightness}
                      onChange={(e) =>
                        onUpdateVideoFx({ ...videoFx, brightness: Number(e.target.value) })
                      }
                      className="gather-range flex-1"
                    />
                    <span className="font-mono-num text-[11.5px] text-[var(--ink)] w-11 text-right">
                      {videoFx.brightness}%
                    </span>
                  </label>
                  <label className="flex items-center justify-between gap-4 text-[12px]">
                    <span className="text-[var(--ink-2)] w-24 shrink-0">Contrast</span>
                    <input
                      type="range"
                      min={60}
                      max={140}
                      value={videoFx.contrast}
                      onChange={(e) =>
                        onUpdateVideoFx({ ...videoFx, contrast: Number(e.target.value) })
                      }
                      className="gather-range flex-1"
                    />
                    <span className="font-mono-num text-[11.5px] text-[var(--ink)] w-11 text-right">
                      {videoFx.contrast}%
                    </span>
                  </label>
                  <label className="flex items-center justify-between gap-4 text-[12px]">
                    <span className="text-[var(--ink-2)] w-24 shrink-0">Saturation</span>
                    <input
                      type="range"
                      min={40}
                      max={170}
                      value={videoFx.saturation}
                      onChange={(e) =>
                        onUpdateVideoFx({ ...videoFx, saturation: Number(e.target.value) })
                      }
                      className="gather-range flex-1"
                    />
                    <span className="font-mono-num text-[11.5px] text-[var(--ink)] w-11 text-right">
                      {videoFx.saturation}%
                    </span>
                  </label>
                </div>

                <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between">
                  <div>
                    <div className="text-[12.5px] font-medium text-[var(--ink)]">
                      Mirror local camera
                    </div>
                    <div className="text-[11px] text-[var(--ink-3)]">
                      Flip preview horizontally without inverting overlays
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(videoFx.mirror)}
                    onClick={() => onUpdateVideoFx({ ...videoFx, mirror: !videoFx.mirror })}
                    className={`h-6 w-11 rounded-full p-0.5 transition-colors cursor-pointer ${
                      videoFx.mirror ? 'bg-[var(--accent)]' : 'bg-[var(--fill-active)]'
                    }`}
                  >
                    <span
                      className={`block h-5 w-5 rounded-full bg-white transition-transform ${
                        videoFx.mirror ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {section === 'audio' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-[14px] font-medium text-[var(--ink)]">
                      Voice Sidechain Auto-Ducker
                    </h3>
                    <p className="text-[11.5px] text-[var(--ink-3)] mt-0.5">
                      Automatically dips background media &amp; stinger music when any speaker talks.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={ducker.enabled}
                    onClick={() => updateDucker({ enabled: !ducker.enabled })}
                    className={`h-6 w-11 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                      ducker.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--fill-active)]'
                    }`}
                  >
                    <span
                      className={`block h-5 w-5 rounded-full bg-white transition-transform ${
                        ducker.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="space-y-2 pt-1">
                  <span className="text-[11.5px] font-medium text-[var(--ink-2)] block">
                    Ducking Depth
                  </span>
                  <div className="gather-seg w-full grid grid-cols-4">
                    {([-6, -12, -18, -24] as const).map((db) => (
                      <button
                        key={db}
                        type="button"
                        disabled={!ducker.enabled}
                        onClick={() => updateDucker({ reductionDb: db })}
                        className={`gather-seg-btn h-8 text-[11.5px] font-mono-num ${
                          ducker.reductionDb === db ? 'active' : ''
                        }`}
                      >
                        {db} dB
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center justify-between gap-4 text-[12px]">
                  <span className="text-[var(--ink-2)] w-32 shrink-0">Speech Sensitivity</span>
                  <input
                    type="range"
                    min={3}
                    max={25}
                    value={Math.round(ducker.threshold * 100)}
                    disabled={!ducker.enabled}
                    onChange={(e) => updateDucker({ threshold: Number(e.target.value) / 100 })}
                    className="gather-range flex-1"
                  />
                  <span className="font-mono-num text-[11.5px] text-[var(--ink)] w-11 text-right">
                    {Math.round(ducker.threshold * 100)}%
                  </span>
                </label>

                <div className="space-y-2">
                  <span className="text-[11.5px] font-medium text-[var(--ink-2)] block">
                    Release Recovery
                  </span>
                  <div className="gather-seg w-full grid grid-cols-3">
                    {(
                      [
                        { ms: 320, label: 'Fast (320ms)' },
                        { ms: 520, label: 'Smooth (520ms)' },
                        { ms: 900, label: 'Cinema (900ms)' },
                      ] as const
                    ).map((r) => (
                      <button
                        key={r.ms}
                        type="button"
                        disabled={!ducker.enabled}
                        onClick={() => updateDucker({ releaseMs: r.ms })}
                        className={`gather-seg-btn h-8 text-[11.5px] ${
                          Math.abs(ducker.releaseMs - r.ms) < 120 ? 'active' : ''
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {section === 'ai' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-display text-[14px] font-medium text-[var(--ink)]">
                    Google AI Creative Studio
                  </h3>
                  <p className="text-[11.5px] text-[var(--ink-3)] mt-0.5">
                    Powered by free-tier Gemini 4 &amp; Gemini 3.8 TTS models — generate gaming HUD frames, full Store Brand Kits, voice stingers, synth music beds, and kinetic WebM bumpers.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[12px]">
                  <div className="p-3 rounded-[11px] bg-[var(--fill)] border border-[var(--line)] space-y-1">
                    <div className="font-medium text-[var(--ink)]">Transparent Gaming HUDs</div>
                    <p className="text-[11px] text-[var(--ink-3)]">
                      16:9 overlays, webcam frames, logos &amp; vector stage backdrops.
                    </p>
                  </div>
                  <div className="p-3 rounded-[11px] bg-[var(--fill)] border border-[var(--line)] space-y-1">
                    <div className="font-medium text-[var(--ink)]">Firestore Brand Kits</div>
                    <p className="text-[11px] text-[var(--ink-3)]">
                      Complete shop catalogs, fonts, palettes &amp; overlays synced across rooms.
                    </p>
                  </div>
                  <div className="p-3 rounded-[11px] bg-[var(--fill)] border border-[var(--line)] space-y-1">
                    <div className="font-medium text-[var(--ink)]">Voice Drops &amp; Loops</div>
                    <p className="text-[11px] text-[var(--ink-3)]">
                      Gemini 3.8 announcer voice stingers &amp; synthesized audio loops.
                    </p>
                  </div>
                  <div className="p-3 rounded-[11px] bg-[var(--fill)] border border-[var(--line)] space-y-1">
                    <div className="font-medium text-[var(--ink)]">Kinetic Motion Bumpers</div>
                    <p className="text-[11px] text-[var(--ink-3)]">
                      Animated intro/BRB WebM clips pushed straight to the stage deck.
                    </p>
                  </div>
                </div>

                {onOpenAiStudio && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAiStudio();
                    }}
                    className="w-full h-10 rounded-[10px] gather-btn-primary text-[12.5px] font-medium inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Open AI Creative Studio</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const RecordingModal: React.FC<{
  open: boolean;
  blobUrl: string | null;
  filename: string;
  isoWavUrl?: string | null;
  isoWavFilename?: string;
  recoverableCount?: number;
  onRecoverLatest?: () => void;
  onClose: () => void;
}> = ({
  open,
  blobUrl,
  filename,
  isoWavUrl,
  isoWavFilename,
  recoverableCount = 0,
  onRecoverLatest,
  onClose,
}) => {
  if (!open || (!blobUrl && recoverableCount === 0)) return null;

  return (
    <div
      className="fixed inset-0 z-50 gather-lightbox-scrim flex items-center justify-center p-4 animate-gather-backdrop"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[680px] rounded-[18px] gather-glass-elevated animate-gather-modal p-5 space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
          <div>
            <h2 className="font-display text-[15px] font-medium text-[var(--ink)]">
              OPFS Multi-Track Recording &amp; Replay Capture
            </h2>
            <p className="text-[11px] text-[var(--ink-3)] mt-0.5">
              Crash-proof chunked program WebM {isoWavUrl ? '+ uncompressed 16-bit WAV mic stem' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close recording modal"
            className="h-8 w-8 grid place-items-center rounded-[8px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {blobUrl && (
          <video
            src={blobUrl}
            controls
            autoPlay
            className="w-full aspect-video rounded-[10px] bg-black border border-[var(--line)]"
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          {recoverableCount > 0 && onRecoverLatest ? (
            <button
              type="button"
              onClick={onRecoverLatest}
              className="h-9 px-3 rounded-[9px] gather-btn-ghost text-xs font-medium cursor-pointer"
            >
              Recover OPFS Session ({recoverableCount})
            </button>
          ) : (
            <span />
          )}

          <div className="flex flex-wrap items-center gap-2">
            {isoWavUrl && (
              <a
                href={isoWavUrl}
                download={isoWavFilename || 'gather-iso-mic.wav'}
                className="h-9 px-3.5 rounded-[9px] gather-btn-ghost text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download ISO Mic (.wav)</span>
              </a>
            )}
            {blobUrl && (
              <a
                href={blobUrl}
                download={filename}
                className="h-9 px-4 rounded-[9px] gather-btn-primary text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download {filename}</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ShowNotesModal: React.FC<{
  open: boolean;
  markdown: string;
  loading: boolean;
  onClose: () => void;
}> = ({ open, markdown, loading, onClose }) => {
  const [copied, setCopied] = useState(false);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 gather-lightbox-scrim flex items-center justify-center p-4 animate-gather-backdrop"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[600px] rounded-[18px] gather-glass-elevated animate-gather-modal p-5 space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
          <h2 className="font-display text-[15px] font-medium text-[var(--ink)]">
            AI Show Notes &amp; Chapter Timestamps
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close show notes modal"
            className="h-8 w-8 grid place-items-center rounded-[8px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {loading ? (
          <p className="text-xs text-[var(--ink-2)] py-8 text-center">
            Synthesizing show notes, chat highlights, and clips…
          </p>
        ) : (
          <>
            <pre className="p-3.5 rounded-[10px] bg-[var(--fill)] border border-[var(--line)] text-xs text-[var(--ink-2)] whitespace-pre-wrap max-h-[340px] overflow-y-auto gather-scroll">
              {markdown}
            </pre>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(markdown);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="h-9 px-4 rounded-[9px] gather-btn-primary text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied Markdown' : 'Copy Markdown'}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const CommandPaletteModal: React.FC<{
  open: boolean;
  onClose: () => void;
  actions: Array<{ id: string; label: string; shortcut?: string; run: () => void }>;
}> = ({ open, onClose, actions }) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const filtered = actions.filter((a) =>
    a.label.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 gather-lightbox-scrim flex items-start justify-center pt-24 p-4 animate-gather-backdrop"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] rounded-[18px] gather-glass-elevated animate-gather-modal overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--line)]">
          <Command className="w-4 h-4 text-[var(--accent-text)]" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Run a studio action…"
            className="flex-1 bg-transparent text-sm text-[var(--ink)] focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
          >
            Esc
          </button>
        </div>
        <div className="max-h-[300px] overflow-y-auto gather-scroll p-2 space-y-1">
          {filtered.map((act) => (
            <button
              key={act.id}
              type="button"
              onClick={() => {
                act.run();
                onClose();
              }}
              className="w-full px-3 py-2 rounded-[8px] hover:bg-[var(--fill-hover)] text-left flex items-center justify-between text-xs cursor-pointer"
            >
              <span className="text-[var(--ink)] font-medium">{act.label}</span>
              {act.shortcut && (
                <span className="font-mono-num text-[11px] text-[var(--ink-3)]">
                  {act.shortcut}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export const HelpModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const shortcuts = [
    ['Cmd / Ctrl + K', 'Command Palette'],
    ['/', 'Toggle AI Cue Bar'],
    ['S', 'Stingers & Audio FX Deck'],
    ['M', 'Mute / Unmute Mic'],
    ['V', 'Camera On / Off'],
    ['1 – 4', 'Switch Stage Scenes'],
  ];

  const workflows = [
    {
      icon: <DollarSign className="w-3.5 h-3.5 text-[var(--ok)] shrink-0 mt-0.5" />,
      title: 'In-Chat Direct Creator Payments',
      desc: 'Click "Drop Pay Card" in Chat — viewers tip inside live chat via Apple/Google Pay, Card, Venmo, PayPal, or Cash App without leaving.',
    },
    {
      icon: <Layers className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0 mt-0.5" />,
      title: 'Stream-Specific Watch Pages',
      desc: 'Broadcast, Live Shop, and Gaming Arena each render dedicated Watch Pages with zero irrelevant widgets.',
    },
    {
      icon: <Volume2 className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0 mt-0.5" />,
      title: 'Custom Stingers & Master Bus FX',
      desc: 'Upload custom audio drops or record 3s mic stingers — synced live to the Master Audio Bus.',
    },
    {
      icon: <Upload className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0 mt-0.5" />,
      title: 'Custom PNG Overlays, Sponsors & PDFs',
      desc: 'Upload transparent 16:9 PNG frames, sponsor rotators, or drop PDF slides directly onto the stage.',
    },
    {
      icon: <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0 mt-0.5" />,
      title: 'Cue AI & Multi-Language Captions',
      desc: 'Direct scenes, spotlight Q&A, or enable live captions across 10 languages in real time.',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 gather-lightbox-scrim flex items-center justify-center p-4 animate-gather-backdrop"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[660px] rounded-[18px] gather-glass-elevated animate-gather-modal overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
          <div className="flex items-center gap-2.5">
            <GatherLogo size={24} />
            <div>
              <h2 className="font-display text-[15px] font-medium text-[var(--ink)] leading-tight">
                Studio Guide &amp; Keyboard Shortcuts
              </h2>
              <p className="text-[11px] text-[var(--ink-3)] mt-0.5">
                100% Free · Made in Texas · Zero-fee broadcast studio
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close studio guide"
            className="h-8 w-8 grid place-items-center rounded-[8px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[var(--line)]">
          {/* Left: Shortcuts Matrix */}
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
              <Keyboard className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              <span>Keyboard Controls</span>
            </div>
            <div className="divide-y divide-[var(--line)] text-xs">
              {shortcuts.map(([k, desc]) => (
                <div key={k} className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-[var(--ink-2)]">{desc}</span>
                  <kbd className="font-mono-num text-[11px] px-2 py-0.5 rounded-[5px] bg-[var(--fill)] border border-[var(--line-2)] text-[var(--ink)]">
                    {k}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Key Workflows */}
          <div className="p-5 space-y-3">
            <div className="text-xs font-semibold text-[var(--ink)]">Broadcast Workflows</div>
            <div className="divide-y divide-[var(--line)]">
              {workflows.map((wf) => (
                <div key={wf.title} className="py-2 first:pt-0 last:pb-0 flex items-start gap-2.5">
                  {wf.icon}
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-[var(--ink)]">{wf.title}</div>
                    <p className="text-[11px] leading-relaxed text-[var(--ink-3)]">{wf.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
