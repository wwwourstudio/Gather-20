import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUp,
  Check,
  Flame,
  Gamepad2,
  Layers,
  MessageSquare,
  Mic,
  MicOff,
  Plus,
  ShoppingBag,
  Sparkles,
  Users,
  Video,
  VideoOff,
} from 'lucide-react';
import { WatchMode } from '../../types/studio';
import { GatherLogo } from '../GatherLogo';
import { AudioPulseRings } from './AudioPulseRings';

export type StageSceneDemo = 'duo' | 'solo' | 'pip';
export type ChatDemoChannel = 'all' | 'shop' | 'gamer';

type DemoChatKind = 'standard' | 'superchat' | 'shop_drop' | 'shop_order' | 'gamer_queue' | 'gamer_poll';

interface DemoChatEntry {
  id: string;
  channel: 'general' | 'shop' | 'gamer';
  kind: DemoChatKind;
  name: string;
  initials: string;
  tone: string;
  text: string;
  amount?: string;
  meta?: string;
  actionLabel?: string;
  watchMode?: WatchMode;
  pollA?: { label: string; pct: number };
  pollB?: { label: string; pct: number };
}

const STREAM_EVENTS: DemoChatEntry[] = [
  {
    id: 'ev-1',
    channel: 'general',
    kind: 'standard',
    name: 'Dev',
    initials: 'D',
    tone: 'bg-[#d97736] text-white',
    text: 'What camera & lens is Maya running?',
  },
  {
    id: 'ev-2',
    channel: 'general',
    kind: 'superchat',
    name: 'Jason',
    initials: 'J',
    tone: 'bg-[#a3e635] text-[#08101c]',
    amount: '$10',
    meta: 'Super Chat',
    text: 'Zero-latency audio sync on desktop is unreal.',
  },
  {
    id: 'ev-3',
    channel: 'shop',
    kind: 'shop_drop',
    name: 'Studio Drop',
    initials: 'S',
    tone: 'bg-[#10b981] text-[#051a12]',
    amount: '$38',
    meta: 'Cobalt Mug · 4 left',
    text: 'Limited batch stoneware · Ships today',
    actionLabel: 'Quick Add',
    watchMode: 'shop',
  },
  {
    id: 'ev-4',
    channel: 'gamer',
    kind: 'gamer_queue',
    name: 'Kuro',
    initials: 'K',
    tone: 'bg-[#7c3aed] text-white',
    meta: 'Squad #VAL-402 · 2/4',
    text: 'Host duo ranked lobby open — comms live',
    actionLabel: 'Join',
    watchMode: 'gamer',
  },
  {
    id: 'ev-5',
    channel: 'shop',
    kind: 'shop_order',
    name: 'Sora',
    initials: 'S',
    tone: 'bg-[#0ea5e9] text-white',
    amount: 'Order #1048',
    meta: 'Verified Bag',
    text: 'Claimed Matte Pour-Over Set + FLASH20',
    watchMode: 'shop',
  },
  {
    id: 'ev-6',
    channel: 'gamer',
    kind: 'gamer_poll',
    name: 'Arena Poll',
    initials: 'A',
    tone: 'bg-[#4f6ef7] text-white',
    meta: '412 votes live',
    text: 'Next match map rotation',
    pollA: { label: 'Ascent', pct: 64 },
    pollB: { label: 'Bind', pct: 36 },
    watchMode: 'gamer',
  },
  {
    id: 'ev-7',
    channel: 'general',
    kind: 'superchat',
    name: 'Clara',
    initials: 'C',
    tone: 'bg-[#38bdf8] text-[#071526]',
    amount: '$25',
    meta: 'Direct Tip · 0% fee',
    text: 'Keep these creator breakdowns coming!',
  },
  {
    id: 'ev-8',
    channel: 'shop',
    kind: 'shop_drop',
    name: 'Maya Pinned',
    initials: 'M',
    tone: 'bg-[#3b6cf5] text-white',
    amount: '$119',
    meta: 'Creator Desk Mic · 20% off',
    text: 'Use code GATHER20 at express checkout',
    actionLabel: 'Shop Live',
    watchMode: 'shop',
  },
  {
    id: 'ev-9',
    channel: 'gamer',
    kind: 'superchat',
    name: 'Rex',
    initials: 'R',
    tone: 'bg-[#f43f5e] text-white',
    amount: '$15',
    meta: 'Clip Boost · +500 XP',
    text: 'Clipped Jordan 4K Sheriff clutch at 00:42:10',
    watchMode: 'gamer',
  },
  {
    id: 'ev-10',
    channel: 'general',
    kind: 'standard',
    name: 'Ana',
    initials: 'A',
    tone: 'bg-[#cc567d] text-white',
    text: 'Watching cleanly in 1080p60 from Lisbon!',
  },
];

function formatDemoClock(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

interface LandingStageShowcaseProps {
  userName?: string | null;
  onOpenWatchDemo: (mode: WatchMode) => void;
}

export const LandingStageShowcase: React.FC<LandingStageShowcaseProps> = ({
  userName,
  onOpenWatchDemo,
}) => {
  const [stageLayout, setStageLayout] = useState<StageSceneDemo>('duo');
  const [demoMicOn, setDemoMicOn] = useState(true);
  const [showLiveCams, setShowLiveCams] = useState(false);
  const [liveSec, setLiveSec] = useState(42 * 60 + 18);
  const [viewerCount, setViewerCount] = useState(1284);
  const [chatChannel, setChatChannel] = useState<ChatDemoChannel>('all');
  const [streamCursor, setStreamCursor] = useState(4);
  const [chatDraft, setChatDraft] = useState('');
  const [customChats, setCustomChats] = useState<DemoChatEntry[]>([]);
  const [superChatActive, setSuperChatActive] = useState(true);
  const [claimedItems, setClaimedItems] = useState<Record<string, boolean>>({});
  const [votedPollSide, setVotedPollSide] = useState<'A' | 'B' | null>(null);

  // Live broadcast timer + gentle organic viewer oscillation
  useEffect(() => {
    const timer = window.setInterval(() => {
      setLiveSec((s) => s + 1);
    }, 1000);
    // Viewer count drifts slowly so it reads as live, not as jitter.
    const drift = window.setInterval(() => {
      setViewerCount((v) => Math.max(1240, v + Math.round(Math.random() * 9) - 2));
    }, 7000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(drift);
    };
  }, []);

  // Auto-stream new chat messages, Super Chats, Shopping drops & Gamer queues
  useEffect(() => {
    const ticker = window.setInterval(() => {
      setStreamCursor((prev) => prev + 1);
    }, 2600);
    return () => window.clearInterval(ticker);
  }, []);

  const poolForChannel = useMemo(() => {
    if (chatChannel === 'shop') {
      return STREAM_EVENTS.filter((ev) => ev.channel === 'shop' || ev.kind === 'superchat');
    }
    if (chatChannel === 'gamer') {
      return STREAM_EVENTS.filter((ev) => ev.channel === 'gamer' || ev.kind === 'superchat');
    }
    return STREAM_EVENTS;
  }, [chatChannel]);

  const visibleChats = useMemo(() => {
    const len = poolForChannel.length;
    const rotated: DemoChatEntry[] = [];
    const windowSize = 4;
    for (let i = windowSize - 1; i >= 0; i -= 1) {
      const idx = (streamCursor - i + len * 100) % len;
      const item = poolForChannel[idx];
      rotated.push({
        ...item,
        id: `${item.id}-${streamCursor - i}`,
      });
    }
    return [...rotated, ...customChats].slice(-4);
  }, [poolForChannel, streamCursor, customChats]);

  // Synchronize top stage spotlight toast with active channel / superchat flow
  const stageToast = useMemo(() => {
    const latestSuper = [...visibleChats]
      .reverse()
      .find((m) => m.kind === 'superchat' || m.kind === 'shop_drop' || m.kind === 'gamer_queue');
    if (chatChannel === 'shop') {
      return {
        badge: '$38',
        badgeTone: 'bg-[#10b981] text-[#041710]',
        text: 'Cobalt Ceramic Mug · Express drop live',
        mode: 'shop' as WatchMode,
      };
    }
    if (chatChannel === 'gamer') {
      return {
        badge: 'LIVE QUEUE',
        badgeTone: 'bg-[#7c3aed] text-white',
        text: 'Kuro & 3 viewers queued · #VAL-402',
        mode: 'gamer' as WatchMode,
      };
    }
    if (latestSuper?.kind === 'superchat' && latestSuper.amount) {
      return {
        badge: latestSuper.amount,
        badgeTone: 'bg-[#a3e635] text-[#08101c]',
        text: `${latestSuper.name} sent a ${latestSuper.meta?.toLowerCase() || 'super chat'}`,
        mode: latestSuper.watchMode || ('standard' as WatchMode),
      };
    }
    return {
      badge: '$10',
      badgeTone: 'bg-[#a3e635] text-[#08101c]',
      text: 'Jason sent a super chat',
      mode: 'standard' as WatchMode,
    };
  }, [chatChannel, visibleChats]);

  const cycleStageScene = () => {
    setStageLayout((prev) => (prev === 'duo' ? 'solo' : prev === 'solo' ? 'pip' : 'duo'));
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatDraft.trim();
    if (!trimmed) return;
    const sender = userName?.trim() || 'You';
    setCustomChats((prev) => [
      ...prev.slice(-2),
      {
        id: `usr-${Date.now()}`,
        channel: 'general',
        kind: 'standard',
        name: sender.split(/\s+/)[0],
        initials: sender[0]?.toUpperCase() || 'Y',
        tone: 'bg-[#4f6ef7] text-white',
        text: trimmed,
      },
    ]);
    setChatDraft('');
  };

  const handleActionClick = (ev: DemoChatEntry) => {
    setClaimedItems((prev) => ({ ...prev, [ev.id]: true }));
    if (ev.watchMode) {
      onOpenWatchDemo(ev.watchMode);
    }
  };

  return (
    <div className="gather-mock relative w-full min-w-0 pt-11 pb-11 sm:pt-12 sm:pb-12 [@media(min-width:1024px)_and_(max-height:800px)]:pt-10 [@media(min-width:1024px)_and_(max-height:800px)]:pb-10 animate-gather-stage">
      {/* Live 60fps Audio Pulse Rings & Polar Frequency Visualizer */}
      <AudioPulseRings active={demoMicOn} pulseTrigger={streamCursor} />

      {/* Top-Right Outer Floating Viewer Card — Positioned strictly above header bar so 1080p is 100% clear */}
      <button
        type="button"
        onClick={() => onOpenWatchDemo('standard')}
        aria-label={`Open live broadcast preview with ${viewerCount.toLocaleString()} viewers`}
        className="hidden sm:flex absolute top-0 right-4 xl:right-6 z-20 items-center gap-2.5 px-3 py-2 rounded-[11px] border border-white/14 bg-[#0d1120]/96 backdrop-blur-xl shadow-[0_18px_42px_-12px_rgba(0,0,0,0.85)] hover:border-white/28 transition-colors cursor-pointer text-left animate-gather-float-card"
      >
        <div className="flex items-center -space-x-2 shrink-0">
          <span className="w-6 h-6 rounded-full bg-[#6d59b8] border border-[#0d1120] text-[9px] font-bold text-white grid place-items-center">
            JD
          </span>
          <span className="w-6 h-6 rounded-full bg-[#334e7c] border border-[#0d1120] text-[9px] font-bold text-white grid place-items-center">
            MK
          </span>
          <span className="w-6 h-6 rounded-full bg-[#1e2638] border border-[#0d1120] text-[9px] font-semibold text-white/80 grid place-items-center">
            +8
          </span>
        </div>
        <div className="leading-tight">
          <div className="text-[12px] font-medium font-mono-num tabular-nums text-white">
            {viewerCount.toLocaleString()}
          </div>
          <div className="text-[9.5px] text-white/55 whitespace-nowrap">watching now</div>
        </div>
      </button>

      {/* Main Obsidian Studio Console Window */}
      <div className="gather-glow-rim relative z-10 w-full rounded-[16px] border border-white/[0.11] bg-[#080c17]/95 backdrop-blur-2xl shadow-[0_32px_90px_-24px_rgba(0,0,0,0.9)] overflow-hidden text-white">
        {/* Window Top Chrome */}
        <div className="h-10 px-4 border-b border-white/[0.07] grid grid-cols-3 items-center">
          {/* Left Window Traffic Dots */}
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="w-2.5 h-2.5 rounded-full bg-[#d95863]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#d99e46]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#456d96]" />
          </div>

          {/* Center Live Status & Tabular Clock */}
          <div className="flex items-center justify-center gap-2 text-[11px] font-mono-num tabular-nums">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f43f5e]" aria-hidden="true" />
            <span className="font-medium tracking-[0.06em] text-white">LIVE</span>
            <span className="text-white/55">{formatDemoClock(liveSec)}</span>
          </div>

          {/* Right Quality & Signal Bars */}
          <div className="flex items-center justify-end gap-2 text-[10.5px] font-mono-num text-white/55">
            <svg width="14" height="11" viewBox="0 0 14 11" fill="none" aria-hidden="true">
              <rect x="0" y="7" width="2" height="4" rx="0.8" fill="currentColor" opacity="0.55" />
              <rect x="4" y="5" width="2" height="6" rx="0.8" fill="currentColor" opacity="0.7" />
              <rect x="8" y="2.5" width="2" height="8.5" rx="0.8" fill="currentColor" opacity="0.85" />
              <rect x="12" y="0" width="2" height="11" rx="0.8" fill="#10b981" />
            </svg>
            <span>1080p</span>
          </div>
        </div>

        {/* Percentage Split: 68% Stage Frame | 32% Multi-Mode Live Chat */}
        <div className="grid grid-cols-1 sm:grid-cols-[68%_32%] min-w-0">
          {/* Broadcast Stage Column */}
          <div className="p-3 sm:p-3.5 min-w-0">
            <div className="mock-video relative w-full aspect-[16/10] rounded-[10px] overflow-hidden bg-[#060913]">
              {/* Split Duo Scene */}
              {stageLayout === 'duo' && (
                <div className="w-full h-full grid grid-cols-2 gap-[2%]">
                  {/* Host Maya Tile */}
                  <div
                    className="relative rounded-[9px] overflow-hidden border border-white/[0.08] flex items-center justify-center"
                    style={{
                      background:
                        'radial-gradient(circle at 50% 46%, #3153a8 0%, #1d3270 48%, #0e1838 100%)',
                    }}
                  >
                    {showLiveCams && (
                      <img
                        src="/src/assets/images/host_maya_studio_1794840297410.jpg"
                        alt="Maya live studio feed"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                    {showLiveCams && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/25" />
                    )}
                    {!showLiveCams && (
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-white/15 bg-white/[0.06] grid place-items-center text-[18px] font-display font-semibold text-white/95 shadow-inner">
                        M
                      </div>
                    )}
                    <div className="absolute left-3 bottom-2.5 z-10 leading-tight">
                      <div className="text-[11px] font-semibold text-white">Maya</div>
                      <div className="text-[9.5px] text-white/60">Host</div>
                    </div>
                  </div>

                  {/* Guest Jordan Tile */}
                  <div
                    className="relative rounded-[9px] overflow-hidden border border-white/[0.08] flex items-center justify-center"
                    style={{
                      background:
                        'radial-gradient(circle at 50% 46%, #8244e5 0%, #4d229c 50%, #1b103f 100%)',
                    }}
                  >
                    {showLiveCams && (
                      <img
                        src="/src/assets/images/host_jordan_studio_1794840296850.jpg"
                        alt="Jordan live guest feed"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                    {showLiveCams && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/25" />
                    )}
                    {!showLiveCams && (
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-white/15 bg-white/[0.06] grid place-items-center text-[18px] font-display font-semibold text-white/95 shadow-inner">
                        J
                      </div>
                    )}
                    <div className="absolute left-3 bottom-2.5 z-10 leading-tight">
                      <div className="text-[11px] font-semibold text-white">Jordan</div>
                      <div className="text-[9.5px] text-white/60">Guest</div>
                    </div>
                    <div
                      className="absolute right-3 bottom-2.5 z-10 inline-flex items-end gap-[2.5px] h-3.5"
                      aria-hidden="true"
                    >
                      <span
                        className={`w-[2.5px] rounded-full bg-[#22c55e] ${
                          demoMicOn ? 'h-2 animate-gather-eq' : 'h-1 opacity-40'
                        }`}
                      />
                      <span
                        className={`w-[2.5px] rounded-full bg-[#22c55e] ${
                          demoMicOn ? 'h-3.5 animate-gather-eq' : 'h-1 opacity-40'
                        }`}
                        style={{ animationDelay: '160ms' }}
                      />
                      <span
                        className={`w-[2.5px] rounded-full bg-[#22c55e] ${
                          demoMicOn ? 'h-2.5 animate-gather-eq' : 'h-1 opacity-40'
                        }`}
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Solo Spotlight Scene */}
              {stageLayout === 'solo' && (
                <div
                  className="relative w-full h-full rounded-[9px] overflow-hidden border border-white/[0.08] flex items-center justify-center"
                  style={{
                    background:
                      'radial-gradient(circle at 50% 44%, #3153a8 0%, #192b62 52%, #0b132e 100%)',
                  }}
                >
                  {showLiveCams && (
                    <img
                      src="/src/assets/images/host_maya_studio_1794840297410.jpg"
                      alt="Maya solo studio feed"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                  {!showLiveCams && (
                    <div className="w-16 h-16 rounded-full border border-white/15 bg-white/[0.06] grid place-items-center text-[20px] font-display font-semibold text-white">
                      M
                    </div>
                  )}
                  <div className="absolute left-3 bottom-2.5 z-10 leading-tight">
                    <div className="text-[11px] font-semibold text-white">Maya</div>
                    <div className="text-[9px] text-white/55">Host · Solo Cut</div>
                  </div>
                </div>
              )}

              {/* Keynote PIP Scene */}
              {stageLayout === 'pip' && (
                <div
                  className="relative w-full h-full rounded-[9px] overflow-hidden border border-white/[0.08] p-5 flex flex-col justify-between"
                  style={{
                    background:
                      'linear-gradient(145deg, #101b3d 0%, #0b1228 60%, #19133a 100%)',
                  }}
                >
                  <div className="text-[10px] font-mono-num text-[#7dd3fc] tracking-wider uppercase">
                    Keynote Deck · Dissolve 340ms
                  </div>
                  <div className="space-y-1.5 pr-[30%] my-auto">
                    <div className="text-sm font-display font-medium text-white">
                      Direct Creator Broadcasts
                    </div>
                    <div className="text-[11px] text-white/70 leading-relaxed">
                      1080p60 Worker Compositor · Multi-track OPFS WAV stems · 0% platform cut.
                    </div>
                  </div>
                  <div className="h-1 w-[46%] rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full w-[72%] bg-[#4f6ef7]" />
                  </div>
                  <div
                    className="absolute right-3 bottom-3 w-[26%] aspect-video rounded-[7px] overflow-hidden border border-white/20 flex items-center justify-center"
                    style={{
                      background:
                        'radial-gradient(circle at 50% 45%, #3153a8 0%, #14224b 100%)',
                    }}
                  >
                    {showLiveCams ? (
                      <img
                        src="/src/assets/images/host_maya_studio_1794840297410.jpg"
                        alt="Maya PIP"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-display font-semibold text-white">M</span>
                    )}
                  </div>
                </div>
              )}

              {/* Top Stage Spotlight Toast (Super Chat / Shop Drop / Gamer Queue) */}
              {superChatActive && (
                <button
                  key={`${stageToast.badge}-${stageToast.text}`}
                  type="button"
                  onClick={() => onOpenWatchDemo(stageToast.mode)}
                  className="absolute top-2.5 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-[#090d1a]/94 border border-white/14 shadow-[0_8px_22px_rgba(0,0,0,0.65)] whitespace-nowrap cursor-pointer hover:border-white/30 transition-colors animate-gather-msg"
                >
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold font-mono-num ${stageToast.badgeTone}`}
                  >
                    {stageToast.badge}
                  </span>
                  <span className="text-[10.5px] font-medium text-white/92">
                    {stageToast.text}
                  </span>
                </button>
              )}

              {/* Bottom Lower-Third Overlay Card (Clear of left Host label & right EQ meter) */}
              <div className="hidden sm:flex absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 items-center gap-2 px-2.5 py-1.5 rounded-[9px] bg-[#0a0f1d]/95 border border-white/10 shadow-[0_10px_28px_rgba(0,0,0,0.68)] max-w-[52%]">
                <span className="w-5 h-5 rounded-[5px] bg-[#182952] border border-[#4f6ef7]/35 grid place-items-center shrink-0">
                  <GatherLogo size={11} />
                </span>
                <div className="min-w-0 leading-tight">
                  <div className="text-[10px] font-semibold text-white truncate">
                    The Future of Creative Work
                  </div>
                  <div className="text-[8.5px] text-white/50 truncate">
                    Live conversations · Episode 08
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Animated Live Chat Sidebar (32%) — Bounded strictly to stage height */}
          <div className="border-t sm:border-t-0 sm:border-l border-white/[0.07] sm:relative min-w-0 bg-white/[0.015]">
            <div className="p-3 sm:absolute sm:inset-0 flex flex-col justify-between gap-2 overflow-hidden">
              {/* Header + Interactive Chat Mode Switcher */}
              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/[0.06] shrink-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <MessageSquare className="w-3 h-3 text-[#4f6ef7] shrink-0" />
                  <span className="text-[11px] font-semibold text-white/90 truncate">Live chat</span>
                </div>
                <div className="flex items-center gap-2.5 text-[10px] font-medium shrink-0">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'shop', label: 'Shop' },
                      { id: 'gamer', label: 'Gamers' },
                    ] as const
                  ).map((tab) => {
                    const active = chatChannel === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setChatChannel(tab.id);
                          setSuperChatActive(true);
                        }}
                        className={`pb-0.5 border-b transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'border-[#4f6ef7] text-white font-semibold'
                            : 'border-transparent text-white/45 hover:text-white/80'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Streaming Feed Items (Super Chats, Live Shopping Drops & Gamer Queues) */}
              <div className="flex-1 min-h-0 flex flex-col justify-end gap-1.5 overflow-hidden">
                {visibleChats.map((msg) => {
                  const claimed = Boolean(claimedItems[msg.id]);

                  if (msg.kind === 'superchat') {
                    return (
                      <div
                        key={msg.id}
                        className="gather-superchat-sheen rounded-[8px] border border-[#a3e635]/30 bg-[#a3e635]/[0.07] px-2.5 py-1.5 animate-gather-msg"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`w-4 h-4 rounded-full text-[8.5px] font-bold grid place-items-center shrink-0 ${msg.tone}`}
                            >
                              {msg.initials}
                            </span>
                            <span className="text-[10px] font-semibold text-white truncate">
                              {msg.name}
                            </span>
                            <span className="text-[8.5px] text-lime-700/80 dark:text-[#bef264]/80 truncate">
                              {msg.meta}
                            </span>
                          </div>
                          <span className="text-[10.5px] font-bold font-mono-num tabular-nums text-lime-700 dark:text-[#bef264] shrink-0">
                            {msg.amount}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[9.5px] text-white/80 truncate">{msg.text}</p>
                      </div>
                    );
                  }

                  if (msg.kind === 'shop_drop' || msg.kind === 'shop_order') {
                    const isOrder = msg.kind === 'shop_order';
                    return (
                      <div
                        key={msg.id}
                        className="rounded-[8px] border border-emerald-400/25 bg-emerald-500/[0.08] px-2.5 py-1.5 animate-gather-msg"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <ShoppingBag className="w-3 h-3 text-emerald-600 dark:text-emerald-300 shrink-0" />
                            <span className="text-[9.5px] font-semibold text-white truncate">
                              {msg.meta}
                            </span>
                          </div>
                          <span className="text-[9.5px] font-bold font-mono-num tabular-nums text-emerald-600 dark:text-emerald-300 shrink-0">
                            {msg.amount}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <span className="text-[9px] text-white/65 truncate">{msg.text}</span>
                          {!isOrder && msg.actionLabel && (
                            <button
                              type="button"
                              onClick={() => handleActionClick(msg)}
                              className="px-1.5 py-0.5 rounded-[5px] bg-emerald-400/20 hover:bg-emerald-400/35 border border-emerald-400/35 text-[8.5px] font-semibold text-emerald-700 dark:text-emerald-200 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                            >
                              {claimed ? (
                                <span className="inline-flex items-center gap-0.5">
                                  <Check className="w-2.5 h-2.5" /> Added
                                </span>
                              ) : (
                                msg.actionLabel
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }

                  if (msg.kind === 'gamer_queue' || msg.kind === 'gamer_poll') {
                    return (
                      <div
                        key={msg.id}
                        className="rounded-[8px] border border-violet-400/28 bg-violet-500/[0.09] px-2.5 py-1.5 animate-gather-msg"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {msg.kind === 'gamer_queue' ? (
                              <Gamepad2 className="w-3 h-3 text-violet-600 dark:text-violet-300 shrink-0" />
                            ) : (
                              <Flame className="w-3 h-3 text-amber-600 dark:text-amber-300 shrink-0" />
                            )}
                            <span className="text-[9.5px] font-semibold text-white truncate">
                              {msg.name} · {msg.meta}
                            </span>
                          </div>
                          {msg.actionLabel && (
                            <button
                              type="button"
                              onClick={() => handleActionClick(msg)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[5px] bg-violet-500/25 hover:bg-violet-500/40 border border-violet-400/35 text-[8.5px] font-semibold text-violet-700 dark:text-violet-100 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                            >
                              <Users className="w-2.5 h-2.5" />
                              <span>{claimed ? 'Queued' : msg.actionLabel}</span>
                            </button>
                          )}
                        </div>

                        {msg.kind === 'gamer_poll' && msg.pollA && msg.pollB ? (
                          <div className="mt-1 grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => setVotedPollSide('A')}
                              className={`text-left px-1.5 py-0.5 rounded-[4px] border text-[8.5px] font-mono-num tabular-nums transition-colors cursor-pointer ${
                                votedPollSide === 'A'
                                  ? 'border-violet-400/60 bg-violet-500/25 text-white'
                                  : 'border-white/10 bg-white/[0.04] text-white/75 hover:border-white/25'
                              }`}
                            >
                              {msg.pollA.label} {votedPollSide === 'A' ? msg.pollA.pct + 2 : msg.pollA.pct}%
                            </button>
                            <button
                              type="button"
                              onClick={() => setVotedPollSide('B')}
                              className={`text-left px-1.5 py-0.5 rounded-[4px] border text-[8.5px] font-mono-num tabular-nums transition-colors cursor-pointer ${
                                votedPollSide === 'B'
                                  ? 'border-violet-400/60 bg-violet-500/25 text-white'
                                  : 'border-white/10 bg-white/[0.04] text-white/75 hover:border-white/25'
                              }`}
                            >
                              {msg.pollB.label} {votedPollSide === 'B' ? msg.pollB.pct + 2 : msg.pollB.pct}%
                            </button>
                          </div>
                        ) : (
                          <p className="mt-0.5 text-[9px] text-white/65 truncate">{msg.text}</p>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className="flex items-start gap-2 px-0.5 animate-gather-msg">
                      <span
                        className={`w-4.5 h-4.5 rounded-full text-[8.5px] font-bold grid place-items-center shrink-0 mt-0.5 ${msg.tone}`}
                      >
                        {msg.initials}
                      </span>
                      <div className="min-w-0 leading-tight">
                        <span className="text-[10px] font-semibold text-white/90 mr-1.5">
                          {msg.name}
                        </span>
                        <span className="text-[9.5px] text-white/55 break-words">{msg.text}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Interactive Chat Composer */}
              <form
                onSubmit={handleSendChat}
                className="pt-1.5 border-t border-white/[0.06] flex items-center gap-1.5 shrink-0"
              >
                <input
                  type="text"
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  placeholder="Say something..."
                  aria-label="Send a demo chat message"
                  className="flex-1 min-w-0 h-7 px-2.5 rounded-[7px] bg-white/[0.04] border border-white/[0.08] focus:border-[#4f6ef7] text-[10px] text-white placeholder:text-[var(--ink-3)] focus:outline-none"
                />
                {chatDraft.trim() && (
                  <button
                    type="submit"
                    aria-label="Send message"
                    className="w-7 h-7 rounded-[7px] bg-[#4f6ef7] text-white grid place-items-center shrink-0 cursor-pointer"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                )}
              </form>
            </div>
          </div>
        </div>

        {/* Bottom Transport Bar */}
        <div className="h-11 px-4 border-t border-white/[0.07] flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDemoMicOn((v) => !v)}
              aria-label={demoMicOn ? 'Mute studio preview mic' : 'Unmute studio preview mic'}
              title={demoMicOn ? 'Studio mic & audio waves active' : 'Studio mic muted'}
              className={`w-8 h-8 rounded-[8px] border grid place-items-center transition-colors cursor-pointer ${
                demoMicOn
                  ? 'bg-white/[0.04] border-white/[0.1] text-white/80 hover:bg-white/[0.08]'
                  : 'bg-rose-500/15 border-rose-500/35 text-rose-600 dark:text-rose-300'
              }`}
            >
              {demoMicOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setShowLiveCams((v) => !v)}
              aria-label={showLiveCams ? 'Show studio initials' : 'Preview host cameras'}
              title="Toggle studio camera feeds"
              className={`w-8 h-8 rounded-[8px] border grid place-items-center transition-colors cursor-pointer ${
                showLiveCams
                  ? 'bg-[#4f6ef7]/25 border-[#4f6ef7]/50 text-[#93c5fd]'
                  : 'bg-white/[0.04] border-white/[0.1] text-white/80 hover:bg-white/[0.08]'
              }`}
            >
              {showLiveCams ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={cycleStageScene}
              aria-label="Switch scene layout"
              title="Switch scene layout"
              className="w-8 h-8 rounded-[8px] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-white/80 grid place-items-center transition-colors cursor-pointer"
            >
              {stageLayout === 'duo' ? (
                <Plus className="w-3.5 h-3.5" />
              ) : (
                <Layers className="w-3.5 h-3.5 text-[#93c5fd]" />
              )}
            </button>
          </div>

          <span className="hidden md:block text-[10.5px] text-white/35 whitespace-nowrap">
            Everyone looks and sounds great
          </span>

          <button
            type="button"
            onClick={() => onOpenWatchDemo('standard')}
            className="h-8 px-3.5 rounded-[8px] bg-rose-100 hover:bg-rose-200 dark:bg-[#2a121a] dark:hover:bg-[#3a1723] border border-rose-500/20 text-[10.5px] font-semibold text-rose-700 dark:text-rose-300/90 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            End stream
          </button>
        </div>
      </div>

      {/* Bottom-Right Outer Floating AI Producer Card — Positioned strictly below transport bar so End stream is 100% clear */}
      <button
        type="button"
        onClick={cycleStageScene}
        className="hidden sm:flex absolute bottom-0 right-4 xl:right-6 z-20 items-center gap-2.5 px-3 py-2 rounded-[11px] border border-white/14 bg-[#0d1222]/96 backdrop-blur-xl shadow-[0_20px_48px_-12px_rgba(0,0,0,0.85)] hover:border-white/28 transition-colors cursor-pointer text-left animate-gather-float-card"
        style={{ animationDelay: '900ms' }}
      >
        <span className="w-6.5 h-6.5 rounded-[7px] bg-[#182952] border border-[#4f6ef7]/35 grid place-items-center shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-[#7dd3fc]" />
        </span>
        <div className="leading-tight">
          <div className="text-[9px] text-white/45">AI Producer</div>
          <div className="text-[11px] font-semibold text-white whitespace-nowrap">
            Next scene is ready
          </div>
        </div>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-0.5 shrink-0" aria-hidden="true" />
      </button>
    </div>
  );
};
