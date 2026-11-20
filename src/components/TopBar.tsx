import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Command,
  Eye,
  HelpCircle,
  LogIn,
  LogOut,
  Moon,
  Radio,
  Settings,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Sun,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import { ConnectionState } from '../hooks/useStudioSocket';
import { WatchMode } from '../types/studio';
import { GatherLogo } from './GatherLogo';

export interface AuthUserSummary {
  displayName?: string | null;
  photoURL?: string | null;
  email?: string | null;
}

interface TopBarProps {
  mode: 'landing' | 'studio' | 'watch';
  studioTitle?: string;
  connState?: ConnectionState;
  isLive?: boolean;
  isRecording?: boolean;
  recordingSec?: number;
  watchMode?: WatchMode;
  viewerCount?: number;
  bagCount?: number;
  theme: 'dark' | 'light';
  user?: AuthUserSummary | null;
  onToggleTheme: () => void;
  onGoHome: () => void;
  onCreateStudio?: () => void;
  onOpenSchedule?: () => void;
  onOpenWatchDemo?: (mode: WatchMode) => void;
  onOpenWatchPreview?: () => void;
  onExitWatchPreview?: () => void;
  onOpenInvite?: () => void;
  onOpenGoLive?: () => void;
  onOpenSettings?: () => void;
  onOpenBrandKits?: () => void;
  onOpenHelp?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenBag?: () => void;
  onOpenAuth?: () => void;
  onLeaveWatch?: () => void;
}

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const TopBar: React.FC<TopBarProps> = ({
  mode,
  studioTitle,
  connState = 'offline',
  isLive = false,
  isRecording = false,
  recordingSec = 0,
  watchMode = 'standard',
  viewerCount = 0,
  bagCount = 0,
  theme,
  user = null,
  onToggleTheme,
  onGoHome,
  onOpenWatchDemo,
  onOpenWatchPreview,
  onExitWatchPreview,
  onOpenInvite,
  onOpenGoLive,
  onOpenSettings,
  onOpenBrandKits,
  onOpenHelp,
  onOpenCommandPalette,
  onOpenBag,
  onOpenAuth,
  onLeaveWatch,
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userMenuOpen]);

  const shortName = user?.displayName?.trim().split(/\s+/)[0] || 'You';
  const displayFullName = user?.displayName?.trim() || 'Guest Creator';

  const hdrBtn =
    'inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-[9px] border border-[var(--glass-border)] bg-[var(--fill)] hover:bg-[var(--fill-hover)] text-[13px] font-medium text-[var(--ink)] whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';

  const hdrIconBtn =
    'h-9 w-9 grid place-items-center rounded-[9px] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';

  const formatWatchingCount = (n: number) => {
    const safe = Math.max(1, n);
    if (safe >= 1000) return `${(safe / 1000).toFixed(1).replace(/\.0$/, '')}K`;
    return safe.toLocaleString();
  };

  const watchSectionLabel =
    watchMode === 'shop' ? 'Live Shop' : watchMode === 'gamer' ? 'Gaming Arena' : 'Sessions';

  const renderUserMenu = (variant: 'pill' | 'compact' | 'ghost') => (
    <div ref={userMenuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setUserMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={userMenuOpen}
        aria-label="User menu, theme, and help"
        className={
          variant === 'pill'
            ? 'inline-flex items-center gap-2.5 h-10 pl-1.5 pr-3 rounded-full border border-[var(--glass-border)] bg-[var(--fill)] hover:bg-[var(--fill-hover)] text-left whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
            : variant === 'ghost'
            ? 'inline-flex items-center justify-center gap-1.5 h-8 pl-1.5 pr-2 rounded-[7px] hover:bg-[var(--fill-hover)] text-[12.5px] font-medium text-[var(--ink)] whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
            : `${hdrBtn} pl-1.5 pr-2.5`
        }
      >
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt={shortName}
            referrerPolicy="no-referrer"
            className={`${variant === 'pill' ? 'w-7 h-7' : 'w-6 h-6'} rounded-full object-cover shrink-0`}
          />
        ) : (
          <span
            className={`${
              variant === 'pill' ? 'w-7 h-7 text-[11px]' : 'w-6 h-6 text-[10.5px]'
            } rounded-full font-display font-medium grid place-items-center shrink-0 ${
              user
                ? 'bg-indigo-500 text-white'
                : 'bg-[var(--fill-active)] text-[var(--ink-2)] border border-[var(--line-2)]'
            }`}
            aria-hidden="true"
          >
            {user ? shortName[0]?.toUpperCase() || 'Y' : <User className="w-3.5 h-3.5" />}
          </span>
        )}

        {variant === 'pill' ? (
          <span className="hidden sm:flex flex-col leading-tight">
            <span className="text-[12px] font-medium text-[var(--ink)] max-w-[96px] truncate">
              {user ? shortName : 'Guest'}
            </span>
            <span className="text-[10.5px] text-[var(--ink-3)]">
              {user ? 'Your account' : 'Sign in'}
            </span>
          </span>
        ) : (
          <span className="hidden sm:inline max-w-[92px] truncate">
            {user ? shortName : 'Sign in'}
          </span>
        )}

        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--ink-3)] transition-transform duration-150 ${
            userMenuOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {userMenuOpen && (
        <div
          role="menu"
          aria-label="Account, theme, and help options"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[272px] rounded-[16px] gather-dropdown-surface overflow-hidden animate-gather-modal origin-top-right"
        >
          <div className="px-3.5 py-3 bg-[var(--elevated-header)] border-b border-[var(--line)] flex items-center gap-2.5">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={displayFullName}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover border border-[var(--line-2)] shrink-0"
              />
            ) : (
              <span
                className={`w-8 h-8 rounded-full font-display font-medium text-[12px] grid place-items-center shrink-0 ${
                  user
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--fill-active)] text-[var(--ink-2)] border border-[var(--line-2)]'
                }`}
                aria-hidden="true"
              >
                {user ? shortName[0]?.toUpperCase() || 'Y' : <User className="w-4 h-4" />}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-[var(--ink)] truncate">
                {user ? displayFullName : 'Browsing as guest'}
              </div>
              <div className="text-[11px] text-[var(--ink-3)] truncate">
                {user?.email || 'Sign in to sync kits, rooms & payouts'}
              </div>
            </div>
          </div>

          <div className="p-1.5 space-y-0.5">
            {onOpenAuth && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setUserMenuOpen(false);
                  onOpenAuth();
                }}
                className="w-full h-9 px-2.5 rounded-[10px] hover:bg-[var(--fill-hover)] text-[12.5px] font-medium text-[var(--ink)] flex items-center justify-between gap-2 cursor-pointer transition-colors whitespace-nowrap"
              >
                <span className="inline-flex items-center gap-2.5">
                  {user ? (
                    <User className="w-4 h-4 text-[var(--cyan)] shrink-0" />
                  ) : (
                    <LogIn className="w-4 h-4 text-[var(--cyan)] shrink-0" />
                  )}
                  <span>{user ? 'Account & payouts' : 'Sign in with Google'}</span>
                </span>
              </button>
            )}

            {onOpenBrandKits && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setUserMenuOpen(false);
                  onOpenBrandKits();
                }}
                className="w-full h-9 px-2.5 rounded-[10px] hover:bg-[var(--fill-hover)] text-[12.5px] font-medium text-[var(--ink)] flex items-center justify-between gap-2 cursor-pointer transition-colors whitespace-nowrap"
              >
                <span className="inline-flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
                  <span>AI Brand Kits &amp; Overlays</span>
                </span>
              </button>
            )}

            {onOpenSettings && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setUserMenuOpen(false);
                  onOpenSettings();
                }}
                className="w-full h-9 px-2.5 rounded-[10px] hover:bg-[var(--fill-hover)] text-[12.5px] font-medium text-[var(--ink)] flex items-center justify-between gap-2 cursor-pointer transition-colors whitespace-nowrap"
              >
                <span className="inline-flex items-center gap-2.5">
                  <SlidersHorizontal className="w-4 h-4 text-[var(--ink-2)] shrink-0" />
                  <span>Studio Settings</span>
                </span>
              </button>
            )}
          </div>

          <div className="px-2.5 py-2 border-t border-[var(--line)] flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-[var(--ink-2)] whitespace-nowrap">
              Appearance
            </span>
            <div className="gather-seg inline-grid grid-cols-2 shrink-0" role="group" aria-label="Theme">
              <button
                type="button"
                onClick={() => {
                  if (theme !== 'dark') onToggleTheme();
                }}
                className={`gather-seg-btn h-6.5 px-2 text-[11px] inline-flex items-center gap-1 ${
                  theme === 'dark' ? 'active' : ''
                }`}
              >
                <Moon className="w-3 h-3" />
                <span>Dark</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (theme !== 'light') onToggleTheme();
                }}
                className={`gather-seg-btn h-6.5 px-2 text-[11px] inline-flex items-center gap-1 ${
                  theme === 'light' ? 'active' : ''
                }`}
              >
                <Sun className="w-3 h-3" />
                <span>Light</span>
              </button>
            </div>
          </div>

          {onOpenHelp && (
            <div className="p-1.5 pt-0">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setUserMenuOpen(false);
                  onOpenHelp();
                }}
                className="w-full h-9 px-2.5 rounded-[10px] hover:bg-[var(--fill-hover)] text-[12.5px] font-medium text-[var(--ink)] flex items-center justify-between gap-2 cursor-pointer transition-colors whitespace-nowrap"
              >
                <span className="inline-flex items-center gap-2.5">
                  <HelpCircle className="w-4 h-4 text-[var(--ink-2)] shrink-0" />
                  <span>Help &amp; shortcuts</span>
                </span>
                <kbd className="text-[10.5px] font-mono-num px-1.5 py-0.5 rounded-[5px] bg-[var(--fill)] border border-[var(--line-2)] text-[var(--ink-3)]">
                  ?
                </kbd>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (mode === 'landing') {
    return (
      <header className="w-[90%] max-w-[1360px] mx-auto h-[58px] shrink-0 flex items-center justify-between gap-4 sm:gap-8 border-b border-[var(--line)] relative z-40">
        {/* Zone 1: Clean Gather Wordmark */}
        <button
          type="button"
          onClick={onGoHome}
          className="inline-flex items-center font-display text-[23px] font-medium leading-none tracking-[-0.03em] text-[var(--ink)] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[6px] py-1"
          aria-label="gather home"
        >
          <span>
            gather<span className="text-[var(--accent)] ml-[1px]">.</span>
          </span>
        </button>

        {/* Zone 2/3: Live Demo Action + Compact Account / Theme Switcher */}
        <div className="flex items-center gap-3 sm:gap-6 shrink-0">
          {onOpenWatchDemo && (
            <button
              type="button"
              onClick={() => onOpenWatchDemo('standard')}
              className="text-[13px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[4px]"
            >
              See it in action
            </button>
          )}
          {renderUserMenu('compact')}
        </div>
      </header>
    );
  }

  if (mode === 'watch') {
    return (
      <header className="w-full h-[56px] shrink-0 flex items-center justify-between gap-3 sm:gap-6 px-3 sm:px-5 border border-[var(--line)] rounded-[14px] gather-header-glass relative z-40">
        {/* Zone 1 + Breadcrumb: Clean Wordmark & Session Status */}
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={onGoHome}
            className="inline-flex items-center gap-2 font-display text-[23px] font-medium leading-none tracking-[-0.03em] text-[var(--ink)] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[6px] py-1"
            aria-label="gather home"
          >
            <GatherLogo size={22} />
            <span className="hidden sm:inline">
              gather<span className="text-[var(--accent)] ml-[1px]">.</span>
            </span>
          </button>

          <div className="hidden sm:flex items-center gap-2.5 text-[13px] min-w-0">
            <span className="font-medium text-[var(--ink)] whitespace-nowrap">
              {watchSectionLabel}
            </span>
            <span className="text-[var(--ink-3)]" aria-hidden="true">
              /
            </span>
            <span className="text-[var(--ink-2)] whitespace-nowrap truncate max-w-[220px]">
              {isLive ? 'Live now' : studioTitle || 'Preview'}
            </span>
          </div>
        </div>

        {/* Zone 2/3: Watching Counter + Controls + User Dropdown */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <div className="hidden md:inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--ink-2)] pr-2 whitespace-nowrap">
            <Users className="w-3.5 h-3.5 text-[var(--ink-3)]" />
            <span className="font-mono-num font-semibold text-[var(--ink)]">
              {formatWatchingCount(viewerCount)}
            </span>
            <span className="text-[var(--ink-3)]">watching</span>
          </div>

          {onExitWatchPreview ? (
            <button type="button" onClick={onExitWatchPreview} className={hdrBtn}>
              <Settings className="w-3.5 h-3.5 text-[var(--ink-2)]" />
              <span className="hidden sm:inline">Back to Studio</span>
              <span className="sm:hidden">Studio</span>
            </button>
          ) : (
            onLeaveWatch && (
              <button type="button" onClick={onLeaveWatch} className={hdrBtn} aria-label="Exit watch page">
                <LogOut className="w-3.5 h-3.5 text-[var(--ink-2)] sm:hidden" />
                <span className="hidden sm:inline">Exit Watch</span>
              </button>
            )
          )}

          {watchMode === 'shop' && onOpenBag && (
            <button
              type="button"
              onClick={onOpenBag}
              className="lg:hidden inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-[10px] gather-btn-primary text-[13px] font-semibold whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span className="font-mono-num">
                <span className="hidden sm:inline">Bag </span>({bagCount})
              </span>
            </button>
          )}

          {renderUserMenu('pill')}
        </div>
      </header>
    );
  }

  const studioGhostBtn =
    'inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-[7px] text-[12.5px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';

  return (
    <header className="gather-studio-header h-14 shrink-0 flex items-center justify-between gap-2 sm:gap-6 px-2.5 sm:px-4 relative z-40">
      {/* Zone 1 + 2: Wordmark + Clean Breadcrumb */}
      <div className="flex items-center gap-4 min-w-0">
        <button
          type="button"
          onClick={onGoHome}
          className="inline-flex items-center gap-2 font-display text-[21px] font-medium leading-none tracking-[-0.03em] text-[var(--ink)] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[6px] py-1"
          aria-label="gather home"
        >
          <GatherLogo size={22} />
          <span className="hidden sm:inline">
            gather<span className="text-[var(--accent)] ml-[1px]">.</span>
          </span>
        </button>

        <div className="hidden md:flex items-center gap-2 min-w-0 pl-4 border-l border-[var(--line)] h-5 text-[12.5px]">
          <span className="font-medium text-[var(--ink)] truncate max-w-[240px]">
            {studioTitle || 'Gather Studio'}
          </span>
          <span className="text-[var(--ink-3)]" aria-hidden="true">
            ·
          </span>
          <span className="text-[12px] text-[var(--ink-2)] whitespace-nowrap">
            {watchMode === 'shop'
              ? 'Live Shop'
              : watchMode === 'gamer'
              ? 'Gaming Arena'
              : 'Broadcast'}
          </span>
          <span className="text-[var(--ink-3)]" aria-hidden="true">
            ·
          </span>
          <span
            className={`text-[12px] font-mono-num whitespace-nowrap inline-flex items-center gap-1.5 ${
              connState === 'offline' ? 'text-[var(--warn)]' : 'text-[var(--ink-3)]'
            }`}
            title={
              connState === 'offline'
                ? 'Realtime server unreachable. You can rehearse locally, but guests and viewers cannot join until it reconnects.'
                : undefined
            }
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connState === 'online'
                  ? 'bg-[var(--ok)]'
                  : connState === 'offline'
                  ? 'bg-[var(--warn)]'
                  : 'bg-[var(--ink-3)] animate-pulse'
              }`}
              aria-hidden="true"
            />
            {connState === 'online'
              ? `${viewerCount} watching`
              : connState === 'offline'
              ? 'Local preview'
              : 'Connecting…'}
          </span>
          {isRecording && (
            <>
              <span className="text-[var(--ink-3)]" aria-hidden="true">
                ·
              </span>
              <span className="text-[12px] font-mono-num font-medium text-[var(--live)] whitespace-nowrap">
                REC {formatTimer(recordingSec)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Zone 3: Unboxed Ghost Actions + Primary Broadcast CTA */}
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          title="Command palette (Cmd/Ctrl + K)"
          aria-label="Command palette"
          className={`${studioGhostBtn} max-sm:hidden px-2`}
        >
          <Command className="w-3.5 h-3.5 text-[var(--ink-3)]" />
          <span className="font-mono-num text-[11.5px]">K</span>
        </button>
        <button
          type="button"
          onClick={onOpenWatchPreview}
          aria-label="Watch Page"
          className={studioGhostBtn}
        >
          <Eye className="w-3.5 h-3.5 text-[var(--ink-3)]" />
          <span className="hidden sm:inline">Watch Page</span>
        </button>
        <button
          type="button"
          onClick={onOpenInvite}
          aria-label="Invite guests or viewers"
          className={studioGhostBtn}
        >
          <UserPlus className="w-3.5 h-3.5 text-[var(--ink-3)]" />
          <span className="hidden sm:inline">Invite</span>
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Studio settings"
          title="Studio settings"
          className="hidden sm:grid h-8 w-8 place-items-center rounded-[7px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>

        <div className="relative shrink-0">
          {renderUserMenu('ghost')}
        </div>

        <span className="hidden sm:block h-4 w-px bg-[var(--line-2)] mx-1.5 shrink-0" aria-hidden="true" />

        <button
          type="button"
          onClick={onOpenGoLive}
          className={`inline-flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-[7px] text-[12.5px] font-medium whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
            isLive ? 'gather-btn-live gather-live-glow' : 'gather-btn-primary'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>{isLive ? 'On Air' : 'Go Live'}</span>
        </button>
      </div>
    </header>
  );
};
