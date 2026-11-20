import React, { useState } from 'react';
import {
  ArrowUp,
  Ban,
  CornerUpLeft,
  Globe,
  Heart,
  HelpCircle,
  Lock,
  Pin,
  Share2,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import { ChatReplyRef, RoomState } from '../../types/studio';
import { HoverReactionMenu, ReactionBadgeRow } from '../ChatReactions';
import { getConsoleAvatarStyle } from './consoleTypes';

interface ChatTabProps {
  room: RoomState;
  isHost: boolean;
  actorId: string;
  onSendChat: (text: string, replyTo?: ChatReplyRef, audience?: 'public' | 'studio') => void;
  onShareChatToPublic?: (messageId: string) => void;
  onToggleChatLike?: (messageId: string) => void;
  onToggleChatReaction?: (messageId: string, emoji: string) => void;
  onPinChatMessage?: (messageId: string | null) => void;
  onDeleteChatMessage?: (messageId: string) => void;
  onBlockChatUser?: (author: string, uid?: string) => void;
  onUnblockChatUser?: (blockId: string) => void;
  onFeatureChat: (id: string | null) => void;
  onFeatureQuestion?: (id: string | null) => void;
}

type ChatFilter = 'all' | 'public' | 'studio' | 'qa' | 'super';

export const ChatTab: React.FC<ChatTabProps> = ({
  room,
  isHost,
  actorId,
  onSendChat,
  onShareChatToPublic,
  onToggleChatLike,
  onToggleChatReaction,
  onPinChatMessage,
  onDeleteChatMessage,
  onBlockChatUser,
  onUnblockChatUser,
  onFeatureChat,
  onFeatureQuestion,
}) => {
  const [filter, setFilter] = useState<ChatFilter>('all');
  const [audience, setAudience] = useState<'public' | 'studio'>('public');
  const [chatDraft, setChatDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatReplyRef | null>(null);

  const sortedQuestions = [...(room.questions || [])].sort((a, b) => b.upvotes - a.upvotes);
  const pinnedMsg = room.pinnedChatId
    ? room.chatMessages.find((m) => m.id === room.pinnedChatId)
    : null;

  const visibleMessages = room.chatMessages.filter((msg) => {
    if (msg.role === 'payment-card') return false;
    if (filter === 'public') return msg.audience !== 'studio';
    if (filter === 'studio') return msg.audience === 'studio';
    if (filter === 'super') return Boolean(msg.superChat) || msg.role === 'superchat';
    return true;
  });

  const studioCount = room.chatMessages.filter(
    (m) => m.role !== 'payment-card' && m.audience === 'studio'
  ).length;

  return (
    <div className="flex flex-col h-full min-h-[380px] justify-between gap-2.5">
      {/* Clean Single-Row Filter Strip */}
      <div className="flex items-center justify-between gap-1.5 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto gather-scroll">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'public', label: 'Public' },
              { id: 'studio', label: studioCount > 0 ? `Studio ${studioCount}` : 'Studio' },
              { id: 'qa', label: `Q&A ${sortedQuestions.length}` },
              { id: 'super', label: 'Super' },
            ] as const
          ).map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`h-6 px-2 rounded-[6px] text-[11px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  active
                    ? 'bg-[var(--accent-soft)] text-[var(--ink)] border border-[var(--accent-line)]'
                    : 'text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] border border-transparent'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {filter === 'qa' ? (
        <div className="divide-y divide-[var(--line)] flex-1 overflow-y-auto gather-scroll pr-1">
          {sortedQuestions.length === 0 ? (
            <div className="py-10 text-center space-y-1.5">
              <HelpCircle className="w-5 h-5 text-[var(--ink-3)] mx-auto" />
              <p className="text-xs text-[var(--ink-3)]">No audience questions yet.</p>
            </div>
          ) : (
            sortedQuestions.map((q) => {
              const isFeatured = room.overlays.featuredQuestionId === q.id;
              return (
                <div key={q.id} className="py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-semibold text-[var(--ink)] inline-flex items-center gap-1.5">
                      <ThumbsUp className="w-3 h-3 text-[var(--cyan)]" />
                      <span className="font-mono-num">{q.upvotes}</span>
                      <span>· {q.author}</span>
                    </span>
                    {onFeatureQuestion && (
                      <button
                        type="button"
                        onClick={() => onFeatureQuestion(isFeatured ? null : q.id)}
                        className={`h-6 px-2 rounded-[6px] text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                          isFeatured
                            ? 'gather-btn-primary text-white'
                            : 'bg-[var(--fill)] border border-[var(--glass-border)] text-[var(--ink-2)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {isFeatured ? 'On Stage' : 'Show on Stage'}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-[var(--ink-2)] leading-relaxed">{q.text}</p>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <>
          <div className="divide-y divide-[var(--line)] flex-1 overflow-y-auto gather-scroll pt-2 pr-1">
            {room.overlays.featuredChatId && (
              <div className="mb-2 p-2 rounded-[7px] bg-[var(--accent-soft)] flex items-center justify-between text-xs">
                <span className="font-medium text-[var(--ink)]">Featured on stage</span>
                <button
                  type="button"
                  onClick={() => onFeatureChat(null)}
                  className="text-[var(--accent-text)] hover:underline cursor-pointer"
                >
                  Hide
                </button>
              </div>
            )}

            {pinnedMsg && (
              <div className="mb-2 p-2.5 rounded-[8px] bg-[var(--fill)] border border-[var(--accent-line)] flex items-start justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold text-[var(--cyan)] flex items-center gap-1">
                    <Pin className="w-3 h-3" />
                    <span>Pinned · {pinnedMsg.author}</span>
                  </div>
                  <p className="text-[11px] text-[var(--ink)] truncate mt-0.5">{pinnedMsg.text}</p>
                </div>
                {onPinChatMessage && (
                  <button
                    type="button"
                    onClick={() => onPinChatMessage(null)}
                    className="text-[11px] text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer shrink-0"
                  >
                    Unpin
                  </button>
                )}
              </div>
            )}

            {visibleMessages.length === 0 ? (
              <p className="text-xs text-[var(--ink-3)] py-10 text-center">
                {filter === 'studio'
                  ? 'No studio-only notes yet.'
                  : filter === 'super'
                  ? 'No super chats yet.'
                  : 'Chat messages appear here.'}
              </p>
            ) : (
              visibleMessages.map((msg) => {
                const isFeatured = room.overlays.featuredChatId === msg.id;
                const isPinned = room.pinnedChatId === msg.id;
                const isStudioOnly = msg.audience === 'studio';
                const likedByMe = Boolean(msg.likedBy?.includes(actorId));
                const likeCount = msg.likes ?? msg.likedBy?.length ?? 0;
                const av = getConsoleAvatarStyle(msg.author);
                const sc = msg.superChat;
                const scClasses = sc
                  ? sc.tier === 'rose'
                    ? 'bg-rose-500/15 border border-rose-400/40'
                    : sc.tier === 'amber'
                      ? 'bg-amber-500/15 border border-amber-400/40'
                      : sc.tier === 'emerald'
                        ? 'bg-emerald-500/15 border border-emerald-400/40'
                        : 'bg-sky-500/15 border border-sky-400/40'
                  : '';
                const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={msg.id}
                    className={`group relative ${
                      sc
                        ? `my-1.5 p-2.5 rounded-[9px] space-y-1.5 ${scClasses}`
                        : isStudioOnly
                        ? 'my-1 p-2 rounded-[8px] bg-amber-500/[0.08] border border-amber-400/25 space-y-1.5'
                        : `py-2.5 space-y-1.5 ${
                            msg.role === 'order' ? 'bg-[var(--ok)]/10 px-2 -mx-2 rounded-[6px]' : ''
                          }`
                    }`}
                  >
                    {msg.role !== 'system' && onToggleChatReaction && (
                      <HoverReactionMenu
                        reactions={msg.reactions}
                        actorId={actorId}
                        onSelect={(emoji) => onToggleChatReaction(msg.id, emoji)}
                        className="right-14 -top-3"
                      />
                    )}
                    <div className="flex items-start gap-2.5">
                      {msg.avatarUrl ? (
                        <img
                          src={msg.avatarUrl}
                          alt={msg.author}
                          referrerPolicy="no-referrer"
                          className="w-7 h-7 rounded-full object-cover border border-[var(--line-2)] shrink-0 mt-0.5"
                        />
                      ) : (
                        <span
                          className={`w-7 h-7 rounded-full border text-[10px] font-display font-bold grid place-items-center shrink-0 mt-0.5 ${av.cls}`}
                        >
                          {av.initials}
                        </span>
                      )}

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-semibold text-[var(--ink)] flex items-center gap-1.5 min-w-0 truncate">
                            {sc && (
                              <span className="font-mono-num font-bold uppercase text-[var(--ok)]">
                                ${sc.amount.toFixed(0)} · {sc.method}
                              </span>
                            )}
                            <span className="truncate">{msg.author}</span>
                            {isStudioOnly && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-mono-num text-amber-500 dark:text-amber-300">
                                <Lock className="w-2.5 h-2.5" />
                                Studio
                              </span>
                            )}
                            <span className="font-normal text-[var(--ink-3)] font-mono-num">
                              · {timeStr}
                            </span>
                          </span>

                          {msg.role !== 'system' && !isStudioOnly && (
                            <button
                              type="button"
                              onClick={() => onFeatureChat(isFeatured ? null : msg.id)}
                              className={`text-[11px] font-medium cursor-pointer shrink-0 ${
                                isFeatured
                                  ? 'text-[var(--accent-text)]'
                                  : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                              }`}
                            >
                              {isFeatured ? 'On stage' : 'Feature'}
                            </button>
                          )}
                        </div>

                        {msg.replyTo && (
                          <div className="pl-2 border-l-2 border-[var(--accent)]/60 text-[11px] text-[var(--ink-3)] truncate">
                            <span className="font-semibold text-[var(--ink-2)]">
                              @{msg.replyTo.author}:
                            </span>{' '}
                            {msg.replyTo.text}
                          </div>
                        )}

                        <p className="text-xs text-[var(--ink-2)] leading-relaxed break-words">
                          {msg.text}
                        </p>

                        {msg.role !== 'system' && (
                          <ReactionBadgeRow
                            reactions={msg.reactions}
                            actorId={actorId}
                            onToggle={
                              onToggleChatReaction
                                ? (emoji) => onToggleChatReaction(msg.id, emoji)
                                : undefined
                            }
                          />
                        )}

                        {msg.role !== 'system' && (
                          <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[11px] text-[var(--ink-3)]">
                            {isStudioOnly && onShareChatToPublic && (
                              <button
                                type="button"
                                onClick={() => onShareChatToPublic(msg.id)}
                                className="inline-flex items-center gap-1 text-[var(--accent-text)] hover:underline font-medium cursor-pointer"
                              >
                                <Share2 className="w-3 h-3" />
                                <span>Share to public</span>
                              </button>
                            )}

                            {onToggleChatLike && (
                              <button
                                type="button"
                                onClick={() => onToggleChatLike(msg.id)}
                                className={`inline-flex items-center gap-1 cursor-pointer transition-colors ${
                                  likedByMe
                                    ? 'text-[var(--live)] font-semibold'
                                    : 'hover:text-[var(--ink)]'
                                }`}
                              >
                                <Heart className={`w-3 h-3 ${likedByMe ? 'fill-current' : ''}`} />
                                <span className="font-mono-num">{likeCount}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                setReplyingTo({
                                  id: msg.id,
                                  author: msg.author,
                                  text: msg.text.slice(0, 120),
                                })
                              }
                              className="inline-flex items-center gap-1 hover:text-[var(--ink)] cursor-pointer"
                            >
                              <CornerUpLeft className="w-3 h-3" />
                              <span>Reply</span>
                            </button>

                            {isHost && onPinChatMessage && !isStudioOnly && (
                              <button
                                type="button"
                                onClick={() => onPinChatMessage(isPinned ? null : msg.id)}
                                className={`inline-flex items-center gap-1 cursor-pointer ${
                                  isPinned ? 'text-[var(--cyan)] font-semibold' : 'hover:text-[var(--ink)]'
                                }`}
                              >
                                <Pin className="w-3 h-3" />
                                <span>{isPinned ? 'Pinned' : 'Pin'}</span>
                              </button>
                            )}

                            {isHost && onDeleteChatMessage && (
                              <button
                                type="button"
                                onClick={() => onDeleteChatMessage(msg.id)}
                                aria-label="Delete message"
                                className="inline-flex items-center gap-1 hover:text-[var(--danger)] cursor-pointer opacity-80 group-hover:opacity-100"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}

                            {isHost && onBlockChatUser && msg.role !== 'host' && (
                              <button
                                type="button"
                                onClick={() => onBlockChatUser(msg.author, msg.authorUid)}
                                aria-label={`Block ${msg.author}`}
                                className="inline-flex items-center gap-1 hover:text-[var(--danger)] cursor-pointer opacity-80 group-hover:opacity-100"
                              >
                                <Ban className="w-3 h-3" />
                                <span>Block</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {(room.blockedUsers?.length || 0) > 0 && isHost && onUnblockChatUser && (
            <div className="px-2.5 py-2 rounded-[8px] bg-[var(--fill)] border border-[var(--glass-border)] flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-[var(--ink-3)] font-medium">Blocked:</span>
              {(room.blockedUsers || []).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onUnblockChatUser(b.id)}
                  className="px-2 py-0.5 rounded-[5px] bg-[var(--bg)]/80 border border-[var(--line-2)] text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>{b.author}</span>
                  <X className="w-2.5 h-2.5" />
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!chatDraft.trim()) return;
              onSendChat(chatDraft.trim(), replyingTo || undefined, audience);
              setChatDraft('');
              setReplyingTo(null);
            }}
            className="pt-2.5 border-t border-[var(--line)] space-y-2 shrink-0"
          >
            {/* Audience Switcher: Studio Guests Only vs Public Chat */}
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <div className="inline-flex items-center p-0.5 rounded-[7px] bg-[var(--fill)] border border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setAudience('public')}
                  className={`h-6 px-2 rounded-[5px] inline-flex items-center gap-1 font-medium cursor-pointer transition-colors ${
                    audience === 'public'
                      ? 'bg-[var(--bg-2)] text-[var(--ink)] shadow-sm'
                      : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                  }`}
                >
                  <Globe className="w-3 h-3 text-[var(--cyan)]" />
                  <span>Public chat</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAudience('studio')}
                  className={`h-6 px-2 rounded-[5px] inline-flex items-center gap-1 font-medium cursor-pointer transition-colors ${
                    audience === 'studio'
                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                      : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                  }`}
                >
                  <Lock className="w-3 h-3" />
                  <span>Studio guests</span>
                </button>
              </div>
              <span className="text-[10.5px] text-[var(--ink-3)] truncate">
                {audience === 'studio' ? 'Backstage only' : 'Watch & studio'}
              </span>
            </div>

            {replyingTo && (
              <div className="px-2.5 py-1.5 rounded-[7px] bg-[var(--accent-soft)] border border-[var(--accent-line)] flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate text-[var(--ink-2)]">
                  Replying to <strong className="text-[var(--ink)]">@{replyingTo.author}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  aria-label="Cancel reply"
                  className="text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <div className="gather-composer">
              <input
                type="text"
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                placeholder={
                  replyingTo
                    ? `Reply to ${replyingTo.author}…`
                    : audience === 'studio'
                    ? 'Private note for studio guests…'
                    : 'Message studio & public viewers…'
                }
              />
              {chatDraft.length > 0 && (
                <button
                  type="button"
                  aria-label="Clear chat input"
                  title="Clear"
                  onClick={(e) => {
                    setChatDraft('');
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
                aria-label="Send chat message"
                disabled={!chatDraft.trim()}
                className={`gather-send-btn ${chatDraft.trim() ? 'ready' : ''}`}
              >
                <ArrowUp className="w-4 h-4 stroke-[2.25]" />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};
