import React, { useState } from 'react';
import { ArrowUp, Check, Mic, Play, Sparkles, X } from 'lucide-react';
import {
  AutoDirectorLogEntry,
  AutoDirectorSensitivity,
} from '../../hooks/useAutoDirector';
import { AILogEntry, RoomState } from '../../types/studio';
import { ComposerShareControl } from '../ComposerShareControl';

interface AiCueTabProps {
  room: RoomState;
  isHost: boolean;
  aiLogs: AILogEntry[];
  aiBusy: boolean;
  autoDirectorEnabled?: boolean;
  autoDirectorSensitivity?: AutoDirectorSensitivity;
  autoDirectorAnalyzing?: boolean;
  autoDirectorLogs?: AutoDirectorLogEntry[];
  onToggleAutoDirector?: () => void;
  onChangeAutoDirectorSensitivity?: (sensitivity: AutoDirectorSensitivity) => void;
  onTriggerAutoDirector?: () => void;
  onApproveAutoSuggestion?: (entryId: string) => void;
  onDismissAutoSuggestion?: (entryId: string) => void;
  onAskAi: (prompt: string) => void;
  onPushAiToStage: (entry: AILogEntry) => void;
}

export const AiCueTab: React.FC<AiCueTabProps> = ({
  room,
  isHost,
  aiLogs,
  aiBusy,
  autoDirectorEnabled = false,
  autoDirectorSensitivity = 'copilot',
  autoDirectorAnalyzing = false,
  autoDirectorLogs = [],
  onToggleAutoDirector,
  onChangeAutoDirectorSensitivity,
  onTriggerAutoDirector,
  onApproveAutoSuggestion,
  onDismissAutoSuggestion,
  onAskAi,
  onPushAiToStage,
}) => {
  const [aiDraft, setAiDraft] = useState('');
  const [aiNoteOnly, setAiNoteOnly] = useState(false);

  const handleVoicePrompt = () => {
    interface SpeechRecLike {
      lang: string;
      interimResults: boolean;
      onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      start: () => void;
    }
    type SpeechRecCtor = new () => SpeechRecLike;
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecCtor;
      webkitSpeechRecognition?: SpeechRecCtor;
    };
    const SpeechRec = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRec) return;
    const rec = new SpeechRec();
    rec.lang = room.overlays.captionLang || 'en-US';
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const transcript = ev.results?.[0]?.[0]?.transcript;
      if (transcript) {
        setAiDraft(transcript);
        onAskAi(transcript);
      }
    };
    rec.start();
  };

  const pendingSuggestions = autoDirectorLogs.filter((d) => d.status === 'suggested');
  const recentDecisions = autoDirectorLogs.filter((d) => d.status !== 'suggested').slice(0, 4);

  return (
    <div className="flex flex-col h-full min-h-[380px] justify-between gap-3">
      <div className="space-y-4 flex-1 overflow-y-auto gather-scroll pr-1">
        {/* Autonomous Cue Auto-Director Panel */}
        {isHost && onToggleAutoDirector && (
          <section className="p-3 rounded-[10px] bg-[var(--fill)] border border-[var(--line)] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[var(--ink)] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
                  <span className="truncate">Auto-Director</span>
                </div>
                <p className="text-[10.5px] text-[var(--ink-3)] truncate">
                  {autoDirectorAnalyzing
                    ? 'Evaluating speech & audience rhythm…'
                    : autoDirectorEnabled
                      ? 'Watching captions, audio levels & chat'
                      : 'Off · enable for live editorial cues'}
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleAutoDirector}
                className={`h-7 px-2.5 rounded-[7px] text-[11px] font-semibold cursor-pointer shrink-0 transition-colors ${
                  autoDirectorEnabled
                    ? 'gather-btn-primary text-white'
                    : 'bg-[var(--surface-2)] border border-[var(--glass-border)] text-[var(--ink-2)] hover:text-[var(--ink)]'
                }`}
              >
                {autoDirectorEnabled ? 'Active' : 'Enable'}
              </button>
            </div>

            {onChangeAutoDirectorSensitivity && (
              <div className="flex items-center justify-between gap-2">
                <div className="gather-seg flex-1 grid grid-cols-3">
                  {(['copilot', 'balanced', 'fast'] as AutoDirectorSensitivity[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onChangeAutoDirectorSensitivity(mode)}
                      className={`gather-seg-btn capitalize text-[11px] h-6 ${
                        autoDirectorSensitivity === mode ? 'active' : ''
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                {onTriggerAutoDirector && (
                  <button
                    type="button"
                    disabled={!autoDirectorEnabled || autoDirectorAnalyzing}
                    onClick={onTriggerAutoDirector}
                    title="Evaluate cue cycle now"
                    className="h-7 px-2.5 rounded-[7px] bg-[var(--surface-2)] hover:bg-[var(--fill-hover)] border border-[var(--glass-border)] text-[11px] font-semibold text-[var(--ink)] inline-flex items-center gap-1 cursor-pointer disabled:opacity-45 whitespace-nowrap"
                  >
                    <Play className="w-3 h-3" />
                    <span>Cue now</span>
                  </button>
                )}
              </div>
            )}

            {/* Copilot Pending Suggestions */}
            {pendingSuggestions.length > 0 && (
              <div className="space-y-2 pt-1">
                {pendingSuggestions.map((sugg) => (
                  <div
                    key={sugg.id}
                    className="p-2.5 rounded-[8px] bg-[var(--accent-soft)] border border-[var(--accent-line)] space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2 text-[11px]">
                      <span className="font-semibold text-[var(--ink)] leading-snug">
                        {sugg.reason}
                      </span>
                      <span className="font-mono-num text-[var(--accent-text)] shrink-0">
                        {Math.round(sugg.confidence * 100)}%
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[10.5px] font-mono-num text-[var(--ink-2)]">
                      {sugg.actions.map((act, idx) => (
                        <span key={idx}>{act.name}</span>
                      ))}
                    </div>
                    <div className="flex items-center justify-end gap-1.5">
                      {onDismissAutoSuggestion && (
                        <button
                          type="button"
                          onClick={() => onDismissAutoSuggestion(sugg.id)}
                          className="h-6 px-2 rounded-[6px] bg-[var(--surface-2)] text-[11px] text-[var(--ink-2)] hover:text-[var(--ink)] cursor-pointer"
                        >
                          Dismiss
                        </button>
                      )}
                      {onApproveAutoSuggestion && (
                        <button
                          type="button"
                          onClick={() => onApproveAutoSuggestion(sugg.id)}
                          className="h-6 px-2.5 rounded-[6px] gather-btn-primary text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>Apply cue</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Decision Feed */}
            {recentDecisions.length > 0 && (
              <div className="pt-1 border-t border-[var(--line)] divide-y divide-[var(--line)] text-[10.5px]">
                {recentDecisions.map((entry) => (
                  <div key={entry.id} className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-[var(--ink-2)] truncate">{entry.reason}</span>
                    <span
                      className={`font-mono-num shrink-0 ${
                        entry.status === 'applied' ? 'text-[var(--ok)]' : 'text-[var(--ink-3)]'
                      }`}
                    >
                      {entry.status === 'applied' ? 'Applied' : 'Dismissed'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="space-y-2 pb-3 border-b border-[var(--line)]">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[var(--ink-3)] font-medium">Quick cues</span>
            <button
              type="button"
              onClick={() => setAiNoteOnly((v) => !v)}
              className={`h-6 px-2 rounded-[5px] font-medium cursor-pointer transition-colors ${
                aiNoteOnly
                  ? 'bg-[var(--fill)] text-[var(--ink)] border border-[var(--glass-border)]'
                  : 'text-[var(--accent-text)] hover:bg-[var(--fill)]'
              }`}
            >
              {aiNoteOnly ? 'Private note only' : 'Auto stage actions'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: '5m countdown', prompt: 'Start a 5 minute countdown labeled Starting Soon' },
              { label: 'Switch Duo', prompt: 'Switch stage scene to duo layout' },
              { label: 'Launch Q&A banner', prompt: 'Show a lower-third banner inviting audience Q&A' },
              { label: 'Launch poll', prompt: 'Launch a viewer poll about what topic to cover next' },
            ].map((cue) => (
              <button
                key={cue.label}
                type="button"
                disabled={aiBusy}
                onClick={() =>
                  onAskAi(
                    aiNoteOnly
                      ? `${cue.prompt} (Answer as private host research note only, do not call stage tools.)`
                      : cue.prompt
                  )
                }
                className="h-7 px-2.5 rounded-[6px] bg-[var(--fill)] hover:border-[var(--accent)] border border-[var(--glass-border)] text-[11px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] text-left truncate cursor-pointer"
              >
                {cue.label}
              </button>
            ))}
          </div>
        </div>

        {aiLogs.length === 0 ? (
          <div className="divide-y divide-[var(--line)]">
            <p className="text-xs text-[var(--ink-3)] pb-2.5">
              Try a cue or live research question:
            </p>
            {[
              'Switch to Duo Split and show an Episode 12 welcome banner',
              'Launch an audience poll with 3 architecture topics',
              'Play the intro stinger and start a 3 minute countdown',
              'Advance to the next show rundown step',
            ].map((sugg) => (
              <button
                key={sugg}
                type="button"
                onClick={() => onAskAi(sugg)}
                className="w-full text-left py-2.5 hover:text-[var(--ink)] text-xs text-[var(--ink-2)] cursor-pointer"
              >
                {sugg}
              </button>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {aiLogs.map((entry) => (
              <div key={entry.id} className="py-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span
                    className={`font-semibold ${
                      entry.role === 'user' ? 'text-[var(--ink)]' : 'text-[var(--accent-text)]'
                    }`}
                  >
                    {entry.role === 'user' ? 'Host' : 'Cue AI'}
                  </span>
                  {entry.role === 'ai' && (
                    <button
                      type="button"
                      onClick={() => onPushAiToStage(entry)}
                      className="text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      {entry.pushedToStage ? 'On stage' : 'Push to banner'}
                    </button>
                  )}
                </div>
                <p className="leading-relaxed text-[var(--ink-2)] whitespace-pre-wrap">
                  {entry.text}
                </p>
                {entry.actions && entry.actions.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-0.5 text-[11px] font-mono-num text-[var(--ok)]">
                    {entry.actions.map((act, i) => (
                      <span key={i}>✓ {act.name}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!aiDraft.trim() || aiBusy) return;
          const promptText = aiNoteOnly
            ? `${aiDraft.trim()} (Private note only — do not modify stage overlays or call tools.)`
            : aiDraft.trim();
          onAskAi(promptText);
          setAiDraft('');
        }}
        className="pt-3 border-t border-[var(--line)]"
      >
        <div className="gather-composer">
          <ComposerShareControl roomCode={room.roomCode} roomTitle={room.title} />
          <span className={`gather-orb ${aiBusy ? 'busy' : ''}`} />
          <input
            type="text"
            value={aiDraft}
            onChange={(e) => setAiDraft(e.target.value)}
            placeholder={
              aiBusy
                ? 'Directing…'
                : aiNoteOnly
                  ? 'Private research note…'
                  : 'Ask or direct Cue AI…'
            }
          />
          {aiDraft.length > 0 && (
            <button
              type="button"
              aria-label="Clear AI prompt"
              title="Clear"
              onClick={(e) => {
                setAiDraft('');
                (
                  e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement | null
                )?.focus();
              }}
              className="h-6 w-6 shrink-0 grid place-items-center rounded-full bg-[var(--fill)] hover:bg-[var(--fill-active)] text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer transition-colors"
            >
              <X className="w-3 h-3" strokeWidth={2} />
            </button>
          )}
          <button
            type="button"
            onClick={handleVoicePrompt}
            aria-label="Speak to AI Producer"
            className="h-7 w-7 shrink-0 grid place-items-center rounded-[7px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] cursor-pointer"
          >
            <Mic className="w-3.5 h-3.5" />
          </button>
          <button
            type="submit"
            aria-label="Run AI command"
            disabled={aiBusy || !aiDraft.trim()}
            className={`gather-send-btn ${aiDraft.trim() && !aiBusy ? 'ready' : ''}`}
          >
            <ArrowUp className="w-4 h-4 stroke-[2.25]" />
          </button>
        </div>
      </form>
    </div>
  );
};
