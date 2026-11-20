import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Captions,
  CheckCircle2,
  Clock,
  Layers,
  ListChecks,
  QrCode,
  X,
} from 'lucide-react';
import { CAPTION_LANGUAGES, DEFAULT_BANNER_PRESETS } from '../../constants/studioDefaults';
import { BannerStyle, CaptionStyle, RoomState, RundownStep } from '../../types/studio';
import { CONSOLE_INPUT_CLS } from './consoleTypes';

interface ShowTabProps {
  room: RoomState;
  isHost: boolean;
  onPatchRoom: (patch: Record<string, unknown>) => void;
  onLaunchPoll: (question: string, options: string[], showOnStage: boolean) => void;
  onClosePoll: (clear?: boolean) => void;
  onRunRundownStep: (step: RundownStep) => void;
  onToggleCaptions: () => void;
}

export const ShowTab: React.FC<ShowTabProps> = ({
  room,
  isHost,
  onPatchRoom,
  onLaunchPoll,
  onClosePoll,
  onRunRundownStep,
  onToggleCaptions,
}) => {
  const [bannerTitle, setBannerTitle] = useState(room.overlays.banner.title);
  const [bannerSub, setBannerSub] = useState(room.overlays.banner.subtitle);
  const [tickerText, setTickerText] = useState(room.overlays.ticker.text);
  const [countdownLabel, setCountdownLabel] = useState(
    room.overlays.countdownLabel || 'Starting Soon'
  );
  const [savedPresets, setSavedPresets] = useState<Array<{ title: string; subtitle: string }>>(
    () => {
      try {
        const raw = localStorage.getItem('gather:banner-presets');
        return raw ? (JSON.parse(raw) as Array<{ title: string; subtitle: string }>) : [];
      } catch {
        return [];
      }
    }
  );
  const [pollQ, setPollQ] = useState('Which topic should we cover next?');
  const [pollOpts, setPollOpts] = useState('Option A, Option B, Option C');

  useEffect(() => {
    setBannerTitle(room.overlays.banner.title);
    setBannerSub(room.overlays.banner.subtitle);
  }, [room.overlays.banner.title, room.overlays.banner.subtitle]);

  useEffect(() => {
    setTickerText(room.overlays.ticker.text);
  }, [room.overlays.ticker.text]);

  useEffect(() => {
    if (room.overlays.countdownLabel) {
      setCountdownLabel(room.overlays.countdownLabel);
    }
  }, [room.overlays.countdownLabel]);

  return (
    <div className="divide-y divide-[var(--line)] space-y-5">
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[var(--ink)]">Lower-Third Banner</h3>
          {room.overlays.banner.visible && (
            <button
              type="button"
              onClick={() =>
                onPatchRoom({
                  overlays: {
                    ...room.overlays,
                    banner: { ...room.overlays.banner, visible: false },
                  },
                })
              }
              className="text-[11px] text-[var(--live)] hover:underline cursor-pointer"
            >
              Hide
            </button>
          )}
        </div>
        <input
          type="text"
          value={bannerTitle}
          onChange={(e) => setBannerTitle(e.target.value)}
          placeholder="Headline"
          className={`w-full ${CONSOLE_INPUT_CLS}`}
        />
        <input
          type="text"
          value={bannerSub}
          onChange={(e) => setBannerSub(e.target.value)}
          placeholder="Supporting line"
          className={`w-full ${CONSOLE_INPUT_CLS}`}
        />
        <div className="flex items-center gap-2">
          <select
            value={room.overlays.banner.style}
            onChange={(e) =>
              onPatchRoom({
                overlays: {
                  ...room.overlays,
                  banner: { ...room.overlays.banner, style: e.target.value as BannerStyle },
                },
              })
            }
            aria-label="Banner style"
            className={CONSOLE_INPUT_CLS}
          >
            <option value="glass">Glass</option>
            <option value="editorial">Editorial</option>
            <option value="broadcast">Broadcast</option>
            <option value="minimal">Minimal</option>
            <option value="block">Solid Accent</option>
          </select>
          <button
            type="button"
            disabled={!isHost}
            onClick={() =>
              onPatchRoom({
                overlays: {
                  ...room.overlays,
                  banner: {
                    ...room.overlays.banner,
                    visible: true,
                    title: bannerTitle,
                    subtitle: bannerSub,
                  },
                },
              })
            }
            className="flex-1 h-8 rounded-[7px] gather-btn-primary text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            Show on stage
          </button>
          <button
            type="button"
            onClick={() => {
              if (!bannerTitle.trim()) return;
              const next = [
                { title: bannerTitle.trim(), subtitle: bannerSub.trim() },
                ...savedPresets,
              ].slice(0, 6);
              setSavedPresets(next);
              try {
                localStorage.setItem('gather:banner-presets', JSON.stringify(next));
              } catch {
                // ignore
              }
            }}
            title="Save as reusable preset"
            className="h-8 px-2.5 rounded-[7px] bg-[var(--fill)] hover:border-[var(--accent)] border border-[var(--glass-border)] text-xs font-medium text-[var(--ink-2)] cursor-pointer whitespace-nowrap"
          >
            + Save
          </button>
        </div>
        <div className="pt-1 divide-y divide-[var(--line)]">
          {[...savedPresets, ...DEFAULT_BANNER_PRESETS].map((p, idx) => (
            <div
              key={`${p.title}-${idx}`}
              className="flex items-center justify-between gap-2 py-2 hover:bg-[var(--fill-hover)] px-1.5 -mx-1.5 rounded-[6px] transition-colors"
            >
              <button
                type="button"
                onClick={() => {
                  setBannerTitle(p.title);
                  setBannerSub(p.subtitle);
                  onPatchRoom({
                    overlays: {
                      ...room.overlays,
                      banner: {
                        ...room.overlays.banner,
                        visible: true,
                        title: p.title,
                        subtitle: p.subtitle,
                      },
                    },
                  });
                }}
                className="min-w-0 flex-1 text-left text-xs cursor-pointer"
              >
                <div className="font-medium text-[var(--ink)] truncate">{p.title}</div>
                <div className="text-[11px] text-[var(--ink-3)] truncate">{p.subtitle}</div>
              </button>
              {idx < savedPresets.length && (
                <button
                  type="button"
                  aria-label="Delete saved preset"
                  onClick={() => {
                    const next = savedPresets.filter((_, i) => i !== idx);
                    setSavedPresets(next);
                    try {
                      localStorage.setItem('gather:banner-presets', JSON.stringify(next));
                    } catch {
                      // ignore
                    }
                  }}
                  className="text-[var(--ink-3)] hover:text-[var(--danger)] cursor-pointer p-1"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="pt-5 space-y-2.5">
        <h3 className="text-xs font-semibold text-[var(--ink)]">Live Stage HUD Overlays</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              onPatchRoom({
                overlays: {
                  ...room.overlays,
                  chatOverlayOnStage: !room.overlays.chatOverlayOnStage,
                },
              })
            }
            className={`h-8 px-2.5 rounded-[7px] border text-[11.5px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
              room.overlays.chatOverlayOnStage
                ? 'gather-btn-primary text-white'
                : 'bg-[var(--fill)] border-[var(--glass-border)] text-[var(--ink-2)] hover:text-[var(--ink)]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Chat on Stage</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onPatchRoom({
                overlays: {
                  ...room.overlays,
                  showSupportQrOnStage: !room.overlays.showSupportQrOnStage,
                },
              })
            }
            className={`h-8 px-2.5 rounded-[7px] border text-[11.5px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
              room.overlays.showSupportQrOnStage
                ? 'gather-btn-tip text-white'
                : 'bg-[var(--fill)] border-[var(--glass-border)] text-[var(--ink-2)] hover:text-[var(--ink)]'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Tip QR on Stage</span>
          </button>
        </div>
      </section>

      <section className="pt-5 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[var(--ink)] inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[var(--accent-text)]" />
            <span>Stage Countdown</span>
          </h3>
          {room.overlays.countdownEndAt && (
            <button
              type="button"
              onClick={() =>
                onPatchRoom({
                  overlays: { ...room.overlays, countdownEndAt: null },
                })
              }
              className="text-[11px] text-[var(--live)] hover:underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
        <input
          type="text"
          value={countdownLabel}
          onChange={(e) => setCountdownLabel(e.target.value)}
          placeholder="Timer label (e.g. Starting Soon)"
          className={`w-full ${CONSOLE_INPUT_CLS}`}
        />
        <div className="grid grid-cols-3 gap-1.5">
          {[1, 3, 5].map((mins) => (
            <button
              key={mins}
              type="button"
              disabled={!isHost}
              onClick={() =>
                onPatchRoom({
                  overlays: {
                    ...room.overlays,
                    countdownEndAt: Date.now() + mins * 60 * 1000,
                    countdownLabel: countdownLabel.trim() || 'Starting Soon',
                  },
                })
              }
              className="h-8 rounded-[7px] bg-[var(--fill)] hover:border-[var(--accent)] border border-[var(--glass-border)] text-xs font-mono-num font-medium text-[var(--ink)] cursor-pointer"
            >
              {mins}m timer
            </button>
          ))}
        </div>
      </section>

      <section className="pt-5 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[var(--ink)]">Live Captions &amp; Ticker</h3>
          <button
            type="button"
            onClick={onToggleCaptions}
            className={`h-7 px-2.5 rounded-[6px] text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
              room.overlays.captionsEnabled
                ? 'gather-btn-primary text-white'
                : 'bg-[var(--fill)] text-[var(--ink-2)]'
            }`}
          >
            <Captions className="w-3.5 h-3.5" />
            <span>{room.overlays.captionsEnabled ? 'Captions on' : 'Captions off'}</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            aria-label="Caption language"
            value={room.overlays.captionLang || 'en-US'}
            onChange={(e) =>
              onPatchRoom({
                overlays: { ...room.overlays, captionLang: e.target.value },
              })
            }
            className={CONSOLE_INPUT_CLS}
          >
            {CAPTION_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Caption visual style"
            value={room.overlays.captionStyle || 'glass'}
            onChange={(e) =>
              onPatchRoom({
                overlays: {
                  ...room.overlays,
                  captionStyle: e.target.value as CaptionStyle,
                },
              })
            }
            className={CONSOLE_INPUT_CLS}
          >
            <option value="glass">Glass Pill</option>
            <option value="bar">Cinema Bar</option>
            <option value="minimal">Clean Text</option>
          </select>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={tickerText}
            onChange={(e) => setTickerText(e.target.value)}
            placeholder="Scrolling ticker…"
            className={`flex-1 ${CONSOLE_INPUT_CLS}`}
          />
          <button
            type="button"
            onClick={() =>
              onPatchRoom({
                overlays: {
                  ...room.overlays,
                  ticker: {
                    visible:
                      !room.overlays.ticker.visible ||
                      tickerText !== room.overlays.ticker.text,
                    text: tickerText,
                  },
                },
              })
            }
            className="h-8 px-3 rounded-[7px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--glass-border)] text-xs font-medium text-[var(--ink)] cursor-pointer whitespace-nowrap"
          >
            {room.overlays.ticker.visible ? 'Toggle' : 'Show'}
          </button>
        </div>
      </section>

      <section className="pt-5 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[var(--ink)] inline-flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-[var(--accent-text)]" />
            <span>Audience Poll</span>
          </h3>
          {room.gamer.activePoll && (
            <button
              type="button"
              onClick={() => onClosePoll(true)}
              className="text-[11px] text-[var(--live)] hover:underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {room.gamer.activePoll ? (
          <div className="space-y-2 py-1">
            <div className="text-xs font-medium text-[var(--ink)]">
              {room.gamer.activePoll.question}
            </div>
            <div className="divide-y divide-[var(--line)]">
              {room.gamer.activePoll.options.map((opt) => (
                <div key={opt.id} className="flex items-center justify-between py-1.5 text-xs">
                  <span className="text-[var(--ink-2)]">{opt.label}</span>
                  <span className="font-mono-num text-[var(--ink)]">{opt.votes} votes</span>
                </div>
              ))}
            </div>
            {room.gamer.activePoll.isOpen && (
              <button
                type="button"
                onClick={() => onClosePoll(false)}
                className="w-full h-8 rounded-[7px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] text-xs font-medium text-[var(--ink)] cursor-pointer"
              >
                Close voting
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={pollQ}
              onChange={(e) => setPollQ(e.target.value)}
              placeholder="Poll question…"
              className={`w-full ${CONSOLE_INPUT_CLS}`}
            />
            <input
              type="text"
              value={pollOpts}
              onChange={(e) => setPollOpts(e.target.value)}
              placeholder="Comma-separated options"
              className={`w-full ${CONSOLE_INPUT_CLS}`}
            />
            <button
              type="button"
              onClick={() =>
                onLaunchPoll(
                  pollQ,
                  pollOpts
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                  true
                )
              }
              className="w-full h-8 rounded-[7px] gather-btn-primary text-xs font-semibold cursor-pointer"
            >
              Launch live poll
            </button>
          </div>
        )}
      </section>

      <section className="pt-5 space-y-2">
        <div className="flex items-center gap-1.5">
          <ListChecks className="w-3.5 h-3.5 text-[var(--accent-text)]" />
          <h3 className="text-xs font-semibold text-[var(--ink)]">Show Rundown Cues</h3>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {room.rundown.steps.map((step, idx) => {
            const isActive = room.rundown.activeStepId === step.id;
            return (
              <div
                key={step.id}
                className={`py-2.5 flex items-center justify-between gap-2 ${
                  isActive ? 'bg-[var(--accent-soft)] -mx-2 px-2 rounded-[6px]' : ''
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[var(--ink)] truncate">
                    0{idx + 1}. {step.title}
                  </div>
                  <div className="text-[11px] text-[var(--ink-3)] font-mono-num">
                    {step.durationMin}m · {step.sceneId}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRunRundownStep(step)}
                  className="shrink-0 h-7 px-2.5 rounded-[6px] bg-[var(--fill)] border border-[var(--glass-border)] text-[11px] font-medium text-[var(--ink)] hover:border-[var(--accent)] cursor-pointer"
                >
                  {step.completed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--ok)]" />
                  ) : (
                    'Cue'
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
