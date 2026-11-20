import React, { useState } from 'react';
import {
  ArrowUp,
  Check,
  Clapperboard,
  Copy,
  Cpu,
  Crosshair,
  Flame,
  ThumbsUp,
  Trophy,
  X,
} from 'lucide-react';
import { AudienceQuestion, RoomState } from '../../types/studio';
import {
  formatClock,
  GamerSubTab,
  GoogleMarkSvg,
  ProgramSubTab,
  RailTab,
} from './watchTypes';

interface WatchCompanionPanelProps {
  room: RoomState;
  railTab: RailTab;
  gamerSubTab: GamerSubTab;
  onChangeGamerSubTab: (tab: GamerSubTab) => void;
  programSubTab: ProgramSubTab;
  onChangeProgramSubTab: (tab: ProgramSubTab) => void;
  elapsedSec: number;
  arenaXp: number;
  onAwardXp: (delta: number) => void;
  wagerStake: number;
  onChangeWagerStake: (amt: number) => void;
  votedPollId: string | null;
  activePrediction: {
    pollId: string;
    optionId: string;
    optionLabel: string;
    stake: number;
    odds: number;
  } | null;
  onVotePoll: (optionId: string, pollId: string) => void;
  onLockPrediction: (pollId: string, optionId: string, optionLabel: string, odds: number) => void;
  onJoinSquadQueue: (
    handle: string,
    platform: string,
    note?: string,
    role?: string,
    rank?: string
  ) => void;
  onQuickClipCapture: (title?: string) => void;
  clipSavedToast: boolean;
  sortedQuestions: AudienceQuestion[];
  canPostToChat: boolean;
  questionDraft: string;
  onChangeQuestionDraft: (val: string) => void;
  onSubmitQuestion: (e: React.FormEvent) => void;
  upvotedIds: Record<string, boolean>;
  onUpvoteQuestion: (id: string) => void;
  onSignInWithGoogle?: () => Promise<void>;
}

export const WatchCompanionPanel: React.FC<WatchCompanionPanelProps> = ({
  room,
  railTab,
  gamerSubTab,
  onChangeGamerSubTab,
  programSubTab,
  onChangeProgramSubTab,
  elapsedSec,
  arenaXp,
  onAwardXp,
  wagerStake,
  onChangeWagerStake,
  votedPollId,
  activePrediction,
  onVotePoll,
  onLockPrediction,
  onJoinSquadQueue,
  onQuickClipCapture,
  clipSavedToast,
  sortedQuestions,
  canPostToChat,
  questionDraft,
  onChangeQuestionDraft,
  onSubmitQuestion,
  upvotedIds,
  onUpvoteQuestion,
  onSignInWithGoogle,
}) => {
  const [copiedLobby, setCopiedLobby] = useState(false);
  const [copiedCrosshair, setCopiedCrosshair] = useState(false);
  const [clipUpvotes, setClipUpvotes] = useState<Record<string, boolean>>({});
  const [clipLabel, setClipLabel] = useState('');
  const [squadHandle, setSquadHandle] = useState('');
  const [squadPlatform, setSquadPlatform] = useState('PC · Discord');
  const [squadRole, setSquadRole] = useState('Flex');
  const [squadRank, setSquadRank] = useState('Ascendant');
  const [squadJoined, setSquadJoined] = useState(false);

  const isGamerMode = room.watchMode === 'gamer';
  const isStandardMode = room.watchMode === 'standard';
  const activePoll = room.gamer.activePoll;
  const totalPollVotes = activePoll
    ? activePoll.options.reduce((sum, o) => sum + o.votes, 0)
    : 0;

  const handleCopyCrosshair = () => {
    const code = room.gamer.crosshairCode || '0;P;c;5;o;1;0l;4;0o;2;0a;1;0f;0;1b;0';
    void navigator.clipboard.writeText(code);
    setCopiedCrosshair(true);
    window.setTimeout(() => setCopiedCrosshair(false), 1800);
  };

  if (isGamerMode && railTab === 'companion') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-3.5 py-2 border-b border-[var(--line)] bg-[var(--fill)] flex items-center justify-between gap-2 text-[11px] shrink-0">
          <span className="font-mono-num font-medium text-amber-600 dark:text-amber-300 inline-flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5" />
            <span>{arenaXp.toLocaleString()} XP</span>
          </span>
          <span className="font-mono-num text-[var(--ink-2)]">
            {room.gamer.teamAName || 'GATHER'} {room.gamer.teamAScore ?? 11}–
            {room.gamer.teamBScore ?? 9} {room.gamer.teamBName || 'APEX'}
          </span>
          <span className="font-mono-num text-[var(--cyan)] inline-flex items-center gap-1">
            <Flame className="w-3 h-3" />
            <span>{room.gamer.hypeCount}</span>
          </span>
        </div>

        <div className="px-3.5 border-b border-[var(--line)] flex items-center gap-4 text-[12px] overflow-x-auto gather-scroll shrink-0">
          {(
            [
              { id: 'squad', label: `Squad (${room.squadQueue.length})` },
              { id: 'poll', label: 'Picks' },
              { id: 'rig', label: 'Rig & !sens' },
              { id: 'clips', label: `Clips (${room.gamer.clips.length})` },
            ] as const
          ).map((sub) => {
            const active = gamerSubTab === sub.id;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => onChangeGamerSubTab(sub.id)}
                className={`py-2 -mb-px font-medium cursor-pointer transition-colors border-b whitespace-nowrap ${
                  active
                    ? 'text-[var(--ink)] border-[var(--cyan)]'
                    : 'text-[var(--ink-3)] hover:text-[var(--ink)] border-transparent'
                }`}
              >
                {sub.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 gather-scroll min-h-0">
          {gamerSubTab === 'squad' && (
            <>
              {room.gamer.lobbyCode && (
                <div className="p-2.5 rounded-[10px] bg-[var(--fill)] border border-[var(--line)] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
                      Custom Lobby Sync
                    </div>
                    <div className="font-mono-num text-[13px] font-medium text-[var(--ink)]">
                      {room.gamer.lobbyCode}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(room.gamer.lobbyCode);
                      setCopiedLobby(true);
                      window.setTimeout(() => setCopiedLobby(false), 1600);
                    }}
                    className="h-7 px-2.5 rounded-[7px] gather-liquid-pill text-[11px] font-medium text-[var(--ink)] inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {copiedLobby ? (
                      <Check className="w-3 h-3 text-[var(--ok)]" />
                    ) : (
                      <Copy className="w-3 h-3 text-[var(--cyan)]" />
                    )}
                    <span>{copiedLobby ? 'Copied' : 'Copy Code'}</span>
                  </button>
                </div>
              )}

              {squadJoined ? (
                <div className="p-3 rounded-[10px] bg-[var(--ok)]/14 border border-[var(--ok)]/30 text-[12px] text-[var(--ok)] font-medium">
                  Queued as <span className="font-mono-num font-medium">{squadHandle}</span> ({squadRole} · {squadRank})
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!squadHandle.trim()) return;
                    onJoinSquadQueue(squadHandle.trim(), squadPlatform, undefined, squadRole, squadRank);
                    setSquadJoined(true);
                  }}
                  className="space-y-2 pb-2 border-b border-[var(--line)]"
                >
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={squadHandle}
                      onChange={(e) => setSquadHandle(e.target.value)}
                      placeholder="Riot ID / Gamertag..."
                      className="flex-1 min-w-0 h-8 px-2.5 rounded-[8px] bg-[var(--fill)] border border-[var(--line-2)] text-[12px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--cyan)]"
                    />
                    <select
                      aria-label="Gaming platform"
                      value={squadPlatform}
                      onChange={(e) => setSquadPlatform(e.target.value)}
                      className="h-8 px-2 rounded-[8px] bg-[var(--fill)] border border-[var(--line-2)] text-[11px] text-[var(--ink)]"
                    >
                      <option value="PC · Discord">PC</option>
                      <option value="PlayStation">PS5</option>
                      <option value="Xbox">Xbox</option>
                    </select>
                  </div>
                  <div className="flex gap-1.5">
                    <select
                      aria-label="In-game role"
                      value={squadRole}
                      onChange={(e) => setSquadRole(e.target.value)}
                      className="h-8 px-2 rounded-[8px] bg-[var(--fill)] border border-[var(--line-2)] text-[11px] text-[var(--ink)]"
                    >
                      <option value="Flex">Flex</option>
                      <option value="Entry">Entry</option>
                      <option value="IGL">IGL</option>
                      <option value="Sentinel">Sentinel</option>
                      <option value="Support">Support</option>
                    </select>
                    <select
                      aria-label="Competitive rank"
                      value={squadRank}
                      onChange={(e) => setSquadRank(e.target.value)}
                      className="h-8 px-2 rounded-[8px] bg-[var(--fill)] border border-[var(--line-2)] text-[11px] text-[var(--ink)]"
                    >
                      <option value="Radiant">Radiant</option>
                      <option value="Immortal">Immortal</option>
                      <option value="Ascendant">Ascendant</option>
                      <option value="Diamond">Diamond</option>
                      <option value="Platinum">Platinum</option>
                    </select>
                    <button
                      type="submit"
                      className="flex-1 h-8 px-3 rounded-[8px] gather-btn-primary text-[11.5px] font-semibold cursor-pointer whitespace-nowrap"
                    >
                      Join Queue
                    </button>
                  </div>
                </form>
              )}

              <div className="divide-y divide-[var(--line)]">
                {room.squadQueue.length === 0 ? (
                  <p className="text-[12px] text-[var(--ink-3)] py-6 text-center">
                    Drop your handle, role &amp; rank to join next lobby.
                  </p>
                ) : (
                  room.squadQueue.map((q, i) => (
                    <div key={q.id} className="py-2.5 first:pt-0 space-y-1">
                      <div className="flex items-center justify-between text-[10.5px] font-mono-num">
                        <span className="text-[var(--cyan)] font-semibold">
                          #{i + 1} {i === 0 ? '· UP NEXT' : ''} · {q.role || 'Flex'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-[var(--fill)] border border-[var(--line)] text-[var(--ink-2)]">
                          {q.rank || 'Ranked'}
                        </span>
                      </div>
                      <div className="text-[13px] font-semibold text-[var(--ink)] truncate">
                        {q.handle}
                      </div>
                      <div className="text-[11px] text-[var(--ink-3)] truncate">{q.platform}</div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {gamerSubTab === 'rig' && (
            <div className="space-y-3">
              <div className="p-3 rounded-[12px] bg-[var(--fill)] border border-[var(--line-2)] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cyan)]">
                    Pro In-Game Settings
                  </span>
                  <span className="font-mono-num text-[10.5px] text-[var(--ink-3)]">
                    {room.gamer.resolution || '1920×1080 · 240Hz'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-[8px] bg-[var(--surface-2)] border border-[var(--line)]">
                    <div className="text-[10px] text-[var(--ink-3)]">Sens &amp; eDPI</div>
                    <div className="font-mono-num text-[12.5px] font-bold text-[var(--ink)] truncate">
                      {room.gamer.sensitivity || '0.35 (280 eDPI)'}
                    </div>
                  </div>
                  <div className="p-2 rounded-[8px] bg-[var(--surface-2)] border border-[var(--line)]">
                    <div className="text-[10px] text-[var(--ink-3)]">Mouse DPI</div>
                    <div className="font-mono-num text-[12.5px] font-bold text-[var(--ink)]">
                      {room.gamer.dpi || 800} DPI · 4000Hz
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <code className="flex-1 min-w-0 truncate px-2 py-1 rounded-[7px] bg-[var(--surface-2)] border border-[var(--line)] font-mono-num text-[10.5px] text-[var(--ink-2)]">
                    {room.gamer.crosshairCode || '0;P;c;5;o;1;0l;4;0o;2;0a;1;0f;0;1b;0'}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyCrosshair}
                    className="h-7 px-2.5 rounded-[7px] gather-btn-primary text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedCrosshair ? <Check className="w-3 h-3" /> : <Crosshair className="w-3 h-3" />}
                    <span>{copiedCrosshair ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>
              </div>

              <div className="divide-y divide-[var(--line)]">
                {room.gamer.gearSpecs.map((spec) => (
                  <div key={spec.id} className="py-2.5 first:pt-0 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10.5px] font-mono-num text-[var(--ink-3)] flex items-center gap-1">
                        <Cpu className="w-3 h-3 text-[var(--cyan)]" strokeWidth={1.65} />
                        <span>{spec.category}</span>
                      </div>
                      <div className="text-[12.5px] font-semibold text-[var(--ink)] truncate">
                        {spec.label}
                      </div>
                    </div>
                    <span className="text-[12px] font-mono-num text-[var(--ink-2)] text-right shrink-0">
                      {spec.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {gamerSubTab === 'clips' && (
            <div className="space-y-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onQuickClipCapture(clipLabel);
                  setClipLabel('');
                }}
                className="flex gap-1.5"
              >
                <input
                  type="text"
                  value={clipLabel}
                  onChange={(e) => setClipLabel(e.target.value)}
                  placeholder="Title 30s clutch clip..."
                  className="flex-1 min-w-0 h-8 px-2.5 rounded-[8px] bg-[var(--fill)] border border-[var(--line-2)] text-[12px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--cyan)]"
                />
                <button
                  type="submit"
                  className="h-8 px-3 rounded-[8px] gather-btn-primary text-[11.5px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Clapperboard className="w-3.5 h-3.5" strokeWidth={1.65} />
                  <span>{clipSavedToast ? 'Saved!' : formatClock(elapsedSec)}</span>
                </button>
              </form>
              <div className="divide-y divide-[var(--line)]">
                {room.gamer.clips.map((c) => {
                  const upvoted = Boolean(clipUpvotes[c.id]);
                  const count = (c.upvotes || 12) + (upvoted ? 1 : 0);
                  return (
                    <div key={c.id} className="py-2.5 first:pt-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-semibold text-[var(--ink)] truncate">
                            {c.label}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-[var(--ink-3)]">
                            {c.category && (
                              <span className="font-mono-num text-[10px] font-semibold text-[var(--cyan)]">
                                {c.category}
                              </span>
                            )}
                            <span className="truncate">{c.createdBy}</span>
                            <span className="font-mono-num">· {formatClock(c.timestampSec)}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setClipUpvotes((prev) => ({ ...prev, [c.id]: !prev[c.id] }));
                            if (!upvoted) onAwardXp(10);
                          }}
                          className={`h-7 px-2 rounded-[7px] text-[11px] font-mono-num font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0 transition-colors ${
                            upvoted
                              ? 'bg-amber-500/18 border border-amber-500/40 text-amber-600 dark:text-amber-300'
                              : 'gather-liquid-pill text-[var(--ink-2)] hover:text-[var(--ink)]'
                          }`}
                        >
                          <Flame className="w-3 h-3 text-amber-500" />
                          <span>{count}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {gamerSubTab === 'poll' && (
            <div className="space-y-3">
              {activePoll ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-mono-num text-[var(--cyan)]">
                        {activePoll.isOpen ? 'Prediction Open' : 'Locked'} · {totalPollVotes} picks
                      </div>
                      <h3 className="font-display tracking-[-0.015em] text-[15px] font-semibold text-[var(--ink)] mt-0.5">
                        {activePoll.question}
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-mono-num text-[11px] font-bold shrink-0">
                      {arenaXp.toLocaleString()} XP
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[var(--ink-3)]">Wager:</span>
                    {[50, 100, 250, 500].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        disabled={votedPollId === activePoll.id || arenaXp < amt}
                        onClick={() => onChangeWagerStake(amt)}
                        className={`h-6 px-2 rounded-[6px] text-[10.5px] font-mono-num font-bold cursor-pointer disabled:opacity-40 ${
                          wagerStake === amt
                            ? 'gather-btn-primary text-white'
                            : 'bg-[var(--fill)] border border-[var(--line)] text-[var(--ink-2)]'
                        }`}
                      >
                        {amt}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    {activePoll.options.map((opt) => {
                      const pct =
                        totalPollVotes > 0 ? Math.round((opt.votes / totalPollVotes) * 100) : 50;
                      const odds = Number((100 / Math.max(15, pct)).toFixed(2));
                      const hasVoted = votedPollId === activePoll.id;
                      const isPicked =
                        activePrediction?.pollId === activePoll.id &&
                        activePrediction?.optionId === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={!activePoll.isOpen || hasVoted}
                          onClick={() =>
                            onLockPrediction(activePoll.id, opt.id, opt.label, odds)
                          }
                          className={`w-full relative h-10 px-3 rounded-[9px] overflow-hidden text-left cursor-pointer disabled:cursor-default border transition-colors ${
                            isPicked
                              ? 'bg-[var(--accent-soft)] border-[var(--accent-line)]'
                              : 'bg-[var(--fill)] border-[var(--line)] hover:border-[var(--accent-line)]'
                          }`}
                        >
                          <div
                            style={{ width: `${pct}%` }}
                            className="absolute inset-y-0 left-0 bg-[var(--accent-soft)] transition-all duration-500 ease-out"
                          />
                          <div className="relative flex items-center justify-between text-[12px]">
                            <span className="font-semibold text-[var(--ink)] truncate pr-2">
                              {isPicked ? `✓ ${opt.label}` : opt.label}
                            </span>
                            <span className="flex items-center gap-2 font-mono-num shrink-0">
                              <span className="text-[11px] text-[var(--ink-3)]">{odds}×</span>
                              <span className="font-bold text-[var(--accent-text)]">{pct}%</span>
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-[12px] text-[var(--ink-3)] py-6 text-center">
                  No active prediction right now.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isStandardMode && railTab === 'companion') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-3.5 border-b border-[var(--line)] flex items-center gap-4 text-[12px] shrink-0">
          {(
            [
              { id: 'agenda', label: `Agenda (${room.rundown.steps.length})` },
              { id: 'poll', label: 'Poll' },
              { id: 'clips', label: `Moments (${room.gamer.clips.length})` },
            ] as const
          ).map((sub) => {
            const active = programSubTab === sub.id;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => onChangeProgramSubTab(sub.id)}
                className={`py-2 -mb-px font-medium cursor-pointer transition-colors border-b whitespace-nowrap ${
                  active
                    ? 'text-[var(--ink)] border-[var(--cyan)]'
                    : 'text-[var(--ink-3)] hover:text-[var(--ink)] border-transparent'
                }`}
              >
                {sub.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 gather-scroll min-h-0">
          {programSubTab === 'agenda' && (
            <div className="divide-y divide-[var(--line)]">
              {room.rundown.steps.map((step, idx) => {
                const isActive = room.rundown.activeStepId === step.id;
                return (
                  <div
                    key={step.id}
                    className={`py-3 first:pt-1 space-y-1 px-2 rounded-[10px] transition-colors ${
                      isActive ? 'bg-[var(--accent-soft)]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono-num text-[var(--ink-3)]">
                      <span>
                        0{idx + 1} · {step.durationMin}m
                      </span>
                      <span className={isActive ? 'text-[var(--cyan)] font-medium' : ''}>
                        {isActive ? 'On Air' : step.completed ? 'Done' : 'Up Next'}
                      </span>
                    </div>
                    <h3 className="font-display tracking-[-0.015em] text-[14.5px] font-medium text-[var(--ink)] leading-snug">
                      {step.title}
                    </h3>
                    <p className="text-[11.5px] text-[var(--ink-2)] leading-snug">
                      {step.bannerSub || step.bannerTitle}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {programSubTab === 'poll' && (
            <div className="space-y-3">
              {activePoll ? (
                <>
                  <div>
                    <div className="text-[11px] font-mono-num text-[var(--cyan)]">
                      {activePoll.isOpen ? 'Live Poll' : 'Closed'} · {totalPollVotes} votes
                    </div>
                    <h3 className="font-display tracking-[-0.015em] text-[15px] font-semibold text-[var(--ink)] mt-0.5">
                      {activePoll.question}
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {activePoll.options.map((opt) => {
                      const pct =
                        totalPollVotes > 0 ? Math.round((opt.votes / totalPollVotes) * 100) : 0;
                      const hasVoted = votedPollId === activePoll.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={!activePoll.isOpen || hasVoted}
                          onClick={() => onVotePoll(opt.id, activePoll.id)}
                          className="w-full relative h-9 px-3 rounded-[9px] overflow-hidden bg-[var(--fill)] border border-[var(--line)] hover:border-[var(--accent-line)] text-left cursor-pointer disabled:cursor-default"
                        >
                          <div
                            style={{ width: `${pct}%` }}
                            className="absolute inset-y-0 left-0 bg-[var(--accent-soft)] transition-all duration-500 ease-out"
                          />
                          <div className="relative flex items-center justify-between text-[12px]">
                            <span className="font-medium text-[var(--ink)] truncate pr-2">
                              {opt.label}
                            </span>
                            <span className="font-mono-num font-bold text-[var(--accent-text)] shrink-0">
                              {pct}%
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-[12px] text-[var(--ink-3)] py-6 text-center">
                  No live poll open right now.
                </p>
              )}
            </div>
          )}

          {programSubTab === 'clips' && (
            <div className="space-y-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onQuickClipCapture(clipLabel);
                  setClipLabel('');
                }}
                className="flex gap-1.5"
              >
                <input
                  type="text"
                  value={clipLabel}
                  onChange={(e) => setClipLabel(e.target.value)}
                  placeholder="Name this 30s moment..."
                  className="flex-1 min-w-0 h-8 px-2.5 rounded-[8px] bg-[var(--fill)] border border-[var(--line-2)] text-[12px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--cyan)]"
                />
                <button
                  type="submit"
                  className="h-8 px-3 rounded-[8px] gather-btn-primary text-[11.5px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Clapperboard className="w-3.5 h-3.5" strokeWidth={1.65} />
                  <span>{clipSavedToast ? 'Saved!' : formatClock(elapsedSec)}</span>
                </button>
              </form>
              <div className="divide-y divide-[var(--line)]">
                {room.gamer.clips.map((c) => (
                  <div key={c.id} className="py-2.5 first:pt-0 space-y-0.5">
                    <div className="text-[12.5px] font-semibold text-[var(--ink)] truncate">
                      {c.label}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--ink-3)]">
                      <span className="truncate">{c.createdBy}</span>
                      <span className="font-mono-num text-[var(--cyan)]">
                        {formatClock(c.timestampSec)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto px-3.5 py-3 gather-scroll">
        {sortedQuestions.length === 0 ? (
          <p className="text-[12px] text-[var(--ink-3)] py-8 text-center">
            Ask the first question below — top-voted questions go to stage.
          </p>
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {sortedQuestions.map((q) => {
              const upvoted = Boolean(upvotedIds[q.id]);
              return (
                <div key={q.id} className="py-3 first:pt-1 space-y-2">
                  <p className="text-[12.5px] font-medium text-[var(--ink)] leading-snug">
                    {q.text}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-[var(--ink-3)]">
                    <span>{q.author}</span>
                    <button
                      type="button"
                      disabled={upvoted}
                      onClick={() => {
                        if (!upvoted) onUpvoteQuestion(q.id);
                      }}
                      className={`h-6 px-2.5 rounded-[6px] font-mono-num font-semibold inline-flex items-center gap-1 cursor-pointer ${
                        upvoted
                          ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                          : 'bg-[var(--fill)] text-[var(--ink-2)] hover:text-[var(--ink)]'
                      }`}
                    >
                      <ThumbsUp className="w-3 h-3" />
                      <span>{q.upvotes}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {canPostToChat ? (
        <form onSubmit={onSubmitQuestion} className="p-3 border-t border-[var(--line)] shrink-0">
          <div className="gather-composer">
            <input
              type="text"
              value={questionDraft}
              onChange={(e) => onChangeQuestionDraft(e.target.value)}
              placeholder="Ask a question for the stage..."
            />
            {questionDraft.length > 0 && (
              <button
                type="button"
                aria-label="Clear question input"
                title="Clear"
                onClick={(e) => {
                  onChangeQuestionDraft('');
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
              type="submit"
              aria-label="Submit question"
              className={`gather-send-btn ${questionDraft.trim() ? 'ready' : ''}`}
            >
              <ArrowUp className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </form>
      ) : (
        <div className="p-3 border-t border-[var(--line)] shrink-0">
          <button
            type="button"
            onClick={() => void onSignInWithGoogle?.()}
            className="w-full h-10 px-3 rounded-[11px] gather-liquid-pill text-[var(--ink)] font-semibold text-[12.5px] inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <GoogleMarkSvg />
            <span>Continue with Google to Ask</span>
          </button>
        </div>
      )}
    </div>
  );
};
