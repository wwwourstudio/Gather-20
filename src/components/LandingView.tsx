import React, { useState } from 'react';
import { ArrowRight, Trash2 } from 'lucide-react';
import { ScheduledShow, WatchMode } from '../types/studio';
import { GatherLogo } from './GatherLogo';
import { LandingStageShowcase } from './landing/LandingStageShowcase';

interface LandingViewProps {
  scheduledShows: ScheduledShow[];
  isSignedIn?: boolean;
  userName?: string | null;
  onCreateStudio: (initialFormat?: WatchMode) => void;
  onJoinCode: (codeOrUrl: string) => void;
  onOpenWatchDemo: (mode: WatchMode) => void;
  onOpenSchedule: () => void;
  onOpenAuth?: () => void;
  onLaunchScheduled: (show: ScheduledShow) => void;
  onDeleteScheduled: (id: string) => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  scheduledShows,
  userName,
  onCreateStudio,
  onJoinCode,
  onOpenWatchDemo,
  onOpenSchedule,
  onLaunchScheduled,
  onDeleteScheduled,
}) => {
  const [joinInput, setJoinInput] = useState('');
  const [joinError, setJoinError] = useState('');

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = joinInput.trim();
    if (!trimmed) {
      setJoinError('Paste an invite link or enter a room code.');
      return;
    }
    setJoinError('');
    onJoinCode(trimmed);
  };

  return (
    <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden gather-scroll animate-gather-panel">
      {/* Single-screen homepage: the hero centres itself in the viewport. On small screens,
          where it cannot fit, the page scrolls instead of clipping the top. */}
      <section className="w-[90%] max-w-[1360px] mx-auto min-h-full flex flex-col justify-center overflow-clip py-6 sm:py-8 lg:py-4">
        <div className="grid grid-cols-1 lg:grid-cols-[44%_56%] gap-8 lg:gap-0 items-center">
          {/* Left Column: Clean Editorial Value Proposition */}
          <div className="flex flex-col items-start gap-5 xl:gap-6 lg:pr-[6%]">
            <div
              className="inline-flex items-center gap-2.5 animate-gather-hero"
              style={{ animationDelay: '40ms' }}
            >
              <span className="w-7 h-7 rounded-[7px] bg-[var(--accent-soft)] border border-[var(--accent-line)] grid place-items-center shrink-0">
                <GatherLogo size={14} />
              </span>
              <span className="text-[11.5px] font-medium tracking-[0.15em] uppercase text-[var(--ink-3)]">
                Broadcasting, reimagined
              </span>
            </div>

            <div
              className="space-y-4 animate-gather-hero"
              style={{ animationDelay: '100ms' }}
            >
              <h1 className="font-display text-[clamp(2.5rem,4.3vw,4.15rem)] font-normal leading-[1.03] tracking-[-0.032em] text-balance">
                <span className="block text-[var(--ink)]">Your show.</span>
                <span className="block gather-headline-flow pb-[0.06em]">Live, together.</span>
              </h1>

              <p className="text-[15.5px] font-normal leading-[1.6] text-[var(--ink-2)] max-w-[44ch]">
                Bring guests, scenes, live chat, and an AI producer into one beautiful studio.
                Go live everywhere—right from your browser.
              </p>
            </div>

            <div
              className="flex flex-wrap items-center gap-6 pt-0.5 animate-gather-hero"
              style={{ animationDelay: '160ms' }}
            >
              <button
                type="button"
                onClick={() => onCreateStudio('standard')}
                className="group h-12 px-6 rounded-[10px] gather-btn-primary text-[14.5px] font-medium inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <span>Create a studio</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>

              <button
                type="button"
                onClick={onOpenSchedule}
                className="pb-1.5 border-b border-[var(--line-2)] hover:border-[var(--ink)] text-[14px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors whitespace-nowrap shrink-0 cursor-pointer rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--bg)]"
              >
                Schedule for later
              </button>
            </div>

            {/* Unified Invite Join Bar */}
            <div
              className="w-full max-w-[94%] sm:max-w-[82%] space-y-2 pt-1 animate-gather-hero"
              style={{ animationDelay: '220ms' }}
            >
              <label
                htmlFor="gather-join-code"
                className="block text-[12px] font-medium text-[var(--ink-3)]"
              >
                Already have an invite?
              </label>
              <form
                onSubmit={handleJoinSubmit}
                className="h-12 pl-4 pr-1.5 rounded-[10px] gather-input-glass border border-[var(--line-2)] focus-within:border-[var(--accent)] flex items-center gap-2"
              >
                <input
                  id="gather-join-code"
                  type="text"
                  value={joinInput}
                  onChange={(e) => {
                    setJoinInput(e.target.value);
                    if (joinError) setJoinError('');
                  }}
                  aria-invalid={Boolean(joinError)}
                  aria-describedby={joinError ? 'gather-join-error' : undefined}
                  placeholder="Paste link or room code"
                  spellCheck={false}
                  className="flex-1 min-w-0 bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none"
                />
                <button
                  type="submit"
                  className="group h-9 px-4 rounded-[7px] bg-[var(--fill-hover)] hover:bg-[var(--fill-active)] border border-[var(--line)] text-[13px] font-medium text-[var(--ink)] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <span>Join</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </button>
              </form>
              {joinError && (
                <p id="gather-join-error" role="alert" className="text-[12.5px] text-[var(--danger)]">
                  {joinError}
                </p>
              )}
            </div>

            {/* Quiet Unboxed Benefits Row */}
            <div
              className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px] text-[var(--ink-3)] animate-gather-hero"
              style={{ animationDelay: '280ms' }}
            >
              <span className="inline-flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                <span>No downloads</span>
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                <span>Free to start</span>
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                <span>Go live in minutes</span>
              </span>
            </div>

            {scheduledShows.length > 0 && (
              <div className="w-full flex flex-wrap gap-2">
                {scheduledShows.slice(0, 2).map((show) => (
                  <div
                    key={show.id}
                    className="flex items-center gap-2 px-3 py-1 rounded-[8px] border border-[var(--line)] bg-[var(--fill)] text-[11.5px]"
                  >
                    <button
                      type="button"
                      onClick={() => onLaunchScheduled(show)}
                      className="font-medium text-[var(--accent-text)] hover:underline whitespace-nowrap cursor-pointer"
                    >
                      {show.title} · {show.date}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteScheduled(show.id)}
                      aria-label="Remove scheduled show"
                      className="text-[var(--ink-3)] hover:text-[var(--danger)] cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Above-the-Fold Studio Preview Showcase */}
          <LandingStageShowcase userName={userName} onOpenWatchDemo={onOpenWatchDemo} />
        </div>
      </section>
    </main>
  );
};
