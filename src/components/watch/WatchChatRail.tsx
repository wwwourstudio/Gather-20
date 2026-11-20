import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Ban,
  Bell,
  Check,
  CornerUpLeft,
  DollarSign,
  EyeOff,
  Flame,
  Heart,
  Lock,
  Pin,
  Trash2,
  X,
} from 'lucide-react';
import { ChatReplyRef, RoomState, SuperChatMethod } from '../../types/studio';
import { HoverReactionMenu, ReactionBadgeRow } from '../ChatReactions';
import {
  formatClock,
  getWatchAvatar,
  GoogleMarkSvg,
  InChatPaymentWidget,
  WatchViewerUser,
} from './watchTypes';

interface WatchChatRailProps {
  room: RoomState;
  isHost: boolean;
  clientId?: string;
  user?: WatchViewerUser | null;
  effectiveViewerName: string;
  canPostToChat: boolean;
  isSubscribed: boolean;
  subscribing: boolean;
  nowMs: number;
  onToggleSubscribe?: () => Promise<void>;
  onSignInWithGoogle?: () => Promise<void>;
  onSendChat: (text: string, author: string, replyTo?: ChatReplyRef) => void;
  onToggleChatLike?: (messageId: string) => void;
  onToggleChatReaction?: (messageId: string, emoji: string) => void;
  onPinChatMessage?: (messageId: string | null) => void;
  onDeleteChatMessage?: (messageId: string) => void;
  onBlockChatUser?: (author: string, uid?: string) => void;
  onUnblockChatUser?: (blockId: string) => void;
  onSendSuperChat: (payload: {
    amount: number;
    method: SuperChatMethod;
    author: string;
    text: string;
  }) => void;
}

export const WatchChatRail: React.FC<WatchChatRailProps> = ({
  room,
  isHost,
  clientId,
  user,
  effectiveViewerName,
  canPostToChat,
  isSubscribed,
  subscribing,
  nowMs,
  onToggleSubscribe,
  onSignInWithGoogle,
  onSendChat,
  onToggleChatLike,
  onToggleChatReaction,
  onPinChatMessage,
  onDeleteChatMessage,
  onBlockChatUser,
  onUnblockChatUser,
  onSendSuperChat,
}) => {
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const [chatText, setChatText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatReplyRef | null>(null);
  const [locallyBlocked, setLocallyBlocked] = useState<string[]>([]);
  const [tipDrawerOpen, setTipDrawerOpen] = useState(false);

  const isShopMode = room.watchMode === 'shop';
  const isGamerMode = room.watchMode === 'gamer';

  useEffect(() => {
    setTipDrawerOpen(false);
  }, [room.roomCode]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [room.chatMessages.length, tipDrawerOpen]);

  const activeHypeTrain =
    room.hypeTrain && room.hypeTrain.active && room.hypeTrain.endsAt > nowMs
      ? room.hypeTrain
      : null;

  const pinned = room.pinnedChatId
    ? room.chatMessages.find((m) => m.id === room.pinnedChatId && m.audience !== 'studio')
    : null;

  const handleSubmitChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPostToChat || !chatText.trim()) return;
    onSendChat(chatText.trim(), effectiveViewerName, replyingTo || undefined);
    setChatText('');
    setReplyingTo(null);
  };

  return (
    <>
      {activeHypeTrain && (
        <div className="px-3.5 py-2 border-b border-[var(--line)] shrink-0 space-y-1">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="flex items-center gap-1.5 font-semibold text-[var(--ink)]">
              <Flame className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" strokeWidth={1.65} />
              <span>Hype Train · Lv.{activeHypeTrain.level}</span>
            </span>
            <span className="font-mono-num text-[var(--ink-3)]">
              {Math.round((activeHypeTrain.points / Math.max(1, activeHypeTrain.goalPoints)) * 100)}
              % · {formatClock((activeHypeTrain.endsAt - nowMs) / 1000)}
            </span>
          </div>
          <div className="h-1 rounded-full bg-[var(--fill-active)] overflow-hidden">
            <div
              style={{
                width: `${Math.min(
                  100,
                  Math.round(
                    (activeHypeTrain.points / Math.max(1, activeHypeTrain.goalPoints)) * 100
                  )
                )}%`,
              }}
              className="h-full bg-gradient-to-r from-[#7dd3fc] via-[#3b82f6] to-[#10b981] transition-all duration-300"
            />
          </div>
        </div>
      )}

      {pinned && (
        <div className="px-3.5 py-2 border-b border-[var(--line)] bg-[var(--accent-soft)] flex items-center justify-between gap-2 text-[11.5px] shrink-0">
          <div className="min-w-0 truncate">
            <Pin className="w-3 h-3 text-[var(--cyan)] inline mr-1.5" strokeWidth={1.65} />
            <span className="font-semibold text-[var(--ink)]">{pinned.author}: </span>
            <span className="text-[var(--ink-2)]">{pinned.text}</span>
          </div>
          {isHost && onPinChatMessage && (
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

      <div
        ref={chatScrollRef}
        className="flex-1 overflow-y-auto px-2.5 pt-3 pb-2 space-y-1 gather-scroll min-h-0"
      >
        {isShopMode && (
          <div className="px-2.5 pb-2.5 mb-1 border-b border-[var(--line)]">
            <div className="text-[12px] font-semibold text-[var(--ink)]">
              Welcome to the live chat
            </div>
            <p className="text-[11px] text-[var(--ink-3)] mt-0.5">
              Be kind, curious, and keep it constructive.
            </p>
          </div>
        )}

        {room.chatMessages
          .filter((msg) => {
            if (msg.role === 'payment-card') return false;
            if (msg.audience === 'studio') return false;
            if (locallyBlocked.includes(msg.author.toLowerCase())) return false;
            return true;
          })
          .map((msg) => {
            const actorKey = user?.uid || clientId || effectiveViewerName;
            const likedByMe = Boolean(msg.likedBy?.includes(actorKey));
            const likeCount = msg.likes ?? msg.likedBy?.length ?? 0;
            const isPinned = room.pinnedChatId === msg.id;
            const isOwn =
              (user?.uid && msg.authorUid === user.uid) ||
              msg.author.toLowerCase() === effectiveViewerName.toLowerCase();
            const av = getWatchAvatar(msg.author);
            const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            if (msg.role === 'superchat' && msg.superChat) {
              const tierStyles =
                msg.superChat.tier === 'rose'
                  ? 'border-rose-400/35 bg-gradient-to-br from-rose-500/18 via-fuchsia-500/8 to-transparent'
                  : msg.superChat.tier === 'amber'
                  ? 'border-amber-400/35 bg-gradient-to-br from-amber-500/18 via-orange-500/8 to-transparent'
                  : msg.superChat.tier === 'emerald'
                  ? 'border-emerald-400/35 bg-gradient-to-br from-emerald-500/18 via-teal-500/8 to-transparent'
                  : 'border-sky-400/35 bg-gradient-to-br from-sky-500/18 via-blue-500/8 to-transparent';
              return (
                <div
                  key={msg.id}
                  className={`group relative my-1.5 p-3 rounded-[14px] border gather-superchat-sheen animate-gather-msg space-y-1.5 ${tierStyles}`}
                >
                  {onToggleChatReaction && (
                    <HoverReactionMenu
                      reactions={msg.reactions}
                      actorId={actorKey}
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
                        className="w-7 h-7 rounded-full object-cover border border-[var(--line-2)] shrink-0"
                      />
                    ) : (
                      <span
                        className={`w-7 h-7 rounded-full border text-[10px] font-semibold grid place-items-center shrink-0 ${av.cls}`}
                      >
                        {av.initials}
                      </span>
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-semibold text-[var(--ink)] truncate">
                          {msg.author}{' '}
                          <span className="font-mono-num font-normal text-[var(--ink-3)]">
                            · {timeStr}
                          </span>
                        </span>
                        <span className="font-mono-num font-bold text-[12px] text-[var(--ink)] shrink-0">
                          ${msg.superChat.amount}
                        </span>
                      </div>
                      <p className="text-[12.5px] font-medium text-[var(--ink)] leading-snug">
                        {msg.text}
                      </p>
                      <ReactionBadgeRow
                        reactions={msg.reactions}
                        actorId={actorKey}
                        onToggle={
                          onToggleChatReaction
                            ? (emoji) => onToggleChatReaction(msg.id, emoji)
                            : undefined
                        }
                      />
                      <div className="flex items-center gap-3 pt-0.5 text-[11px] text-[var(--ink-3)]">
                        {onToggleChatLike && (
                          <button
                            type="button"
                            onClick={() => onToggleChatLike(msg.id)}
                            className={`inline-flex items-center gap-1 cursor-pointer ${
                              likedByMe ? 'text-rose-500 dark:text-rose-400 font-semibold' : 'hover:text-[var(--ink)]'
                            }`}
                          >
                            <Heart className={`w-3 h-3 ${likedByMe ? 'fill-current' : ''}`} />
                            {likeCount > 0 && <span className="font-mono-num">{likeCount}</span>}
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
                          className="inline-flex items-center gap-1 hover:text-[var(--ink)] cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                        >
                          <CornerUpLeft className="w-3 h-3" />
                          <span>Reply</span>
                        </button>
                        {isHost && onPinChatMessage && (
                          <button
                            type="button"
                            onClick={() => onPinChatMessage(isPinned ? null : msg.id)}
                            className={`inline-flex items-center gap-1 cursor-pointer transition-opacity ${
                              isPinned
                                ? 'text-[var(--cyan)] font-semibold opacity-100'
                                : 'hover:text-[var(--ink)] opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            <Pin className="w-3 h-3" />
                            <span>{isPinned ? 'Pinned' : 'Pin'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            if (msg.role === 'order') {
              if (!isShopMode) return null;
              return (
                <div
                  key={msg.id}
                  className="my-1 px-3 py-2 rounded-[11px] bg-[var(--ok)]/10 border border-[var(--ok)]/25 text-[12px] space-y-0.5 animate-gather-msg"
                >
                  <span className="text-[10.5px] font-mono-num font-semibold text-[var(--ok)]">
                    In-Stream Claim
                  </span>
                  <p className="text-[var(--ink)] font-medium">{msg.text}</p>
                </div>
              );
            }

            if (msg.role === 'system') {
              return (
                <div key={msg.id} className="text-[11px] text-[var(--ink-3)] px-2 py-1">
                  {msg.text}
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className="group relative px-2.5 py-2 rounded-[11px] hover:bg-[var(--fill)] transition-colors text-[12.5px] animate-gather-msg"
              >
                {onToggleChatReaction && (
                  <HoverReactionMenu
                    reactions={msg.reactions}
                    actorId={actorKey}
                    onSelect={(emoji) => onToggleChatReaction(msg.id, emoji)}
                    className="right-14 -top-2.5"
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
                      className={`w-7 h-7 rounded-full border text-[10px] font-semibold grid place-items-center shrink-0 mt-0.5 ${av.cls}`}
                    >
                      {av.initials}
                    </span>
                  )}

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate">
                        <span
                          className={`font-semibold ${
                            msg.role === 'host' ? 'text-[var(--accent-text)]' : 'text-[var(--ink)]'
                          }`}
                        >
                          {msg.author}
                        </span>
                        {msg.role === 'host' && (
                          <span className="text-[var(--cyan)] font-medium"> · Host</span>
                        )}
                        {msg.role === 'guest' && (
                          <span className="text-[var(--ink-3)] font-medium"> · Stage</span>
                        )}
                      </span>
                      <span className="font-mono-num text-[10.5px] text-[var(--ink-3)] shrink-0">
                        {timeStr}
                      </span>
                    </div>

                    {msg.replyTo && (
                      <div className="pl-2.5 py-0.5 rounded-r-[6px] bg-[var(--fill)] text-[11px] text-[var(--ink-3)] truncate">
                        <span className="font-semibold text-[var(--ink-2)]">
                          @{msg.replyTo.author}:
                        </span>{' '}
                        {msg.replyTo.text}
                      </div>
                    )}

                    <p className="text-[12.5px] text-[var(--ink-2)] leading-snug break-words">
                      {msg.text}
                    </p>

                    <ReactionBadgeRow
                      reactions={msg.reactions}
                      actorId={actorKey}
                      onToggle={
                        onToggleChatReaction
                          ? (emoji) => onToggleChatReaction(msg.id, emoji)
                          : undefined
                      }
                    />

                    <div className="flex items-center gap-3 pt-0.5 text-[11px] text-[var(--ink-3)]">
                      {onToggleChatLike && (
                        <button
                          type="button"
                          onClick={() => onToggleChatLike(msg.id)}
                          className={`inline-flex items-center gap-1 cursor-pointer transition-all ${
                            likedByMe
                              ? 'text-rose-500 dark:text-rose-400 font-semibold opacity-100'
                              : likeCount > 0
                              ? 'opacity-80 hover:opacity-100 hover:text-[var(--ink)]'
                              : 'opacity-0 group-hover:opacity-100 hover:text-[var(--ink)]'
                          }`}
                        >
                          <Heart className={`w-3 h-3 ${likedByMe ? 'fill-current' : ''}`} />
                          {likeCount > 0 && <span className="font-mono-num">{likeCount}</span>}
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
                        className="inline-flex items-center gap-1 hover:text-[var(--ink)] cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      >
                        <CornerUpLeft className="w-3 h-3" />
                        <span>Reply</span>
                      </button>

                      {isHost && onPinChatMessage && (
                        <button
                          type="button"
                          onClick={() => onPinChatMessage(isPinned ? null : msg.id)}
                          className={`inline-flex items-center gap-1 cursor-pointer transition-opacity ${
                            isPinned
                              ? 'text-[var(--cyan)] font-semibold opacity-100'
                              : 'hover:text-[var(--ink)] opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <Pin className="w-3 h-3" />
                          <span>{isPinned ? 'Pinned' : 'Pin'}</span>
                        </button>
                      )}

                      {(isHost || isOwn) && onDeleteChatMessage && (
                        <button
                          type="button"
                          onClick={() => onDeleteChatMessage(msg.id)}
                          aria-label="Delete message"
                          className="inline-flex items-center gap-1 hover:text-[var(--danger)] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}

                      {msg.role !== 'host' && !isOwn && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isHost && onBlockChatUser) {
                              onBlockChatUser(msg.author, msg.authorUid);
                            } else {
                              setLocallyBlocked((prev) =>
                                prev.includes(msg.author.toLowerCase())
                                  ? prev
                                  : [...prev, msg.author.toLowerCase()]
                              );
                            }
                          }}
                          aria-label={isHost ? `Block ${msg.author}` : `Hide ${msg.author}`}
                          title={isHost ? `Block ${msg.author} from room` : `Hide ${msg.author}`}
                          className="inline-flex items-center gap-1 hover:text-[var(--danger)] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {isHost ? <Ban className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {(locallyBlocked.length > 0 || (isHost && (room.blockedUsers?.length || 0) > 0)) && (
        <div className="mx-3 mb-2 px-2.5 py-1.5 rounded-[9px] bg-[var(--fill)] border border-[var(--line)] flex flex-wrap items-center gap-1.5 text-[11px] shrink-0">
          <span className="text-[var(--ink-3)]">Hidden:</span>
          {locallyBlocked.map((name) => (
            <button
              key={`loc-${name}`}
              type="button"
              onClick={() => setLocallyBlocked((prev) => prev.filter((n) => n !== name))}
              className="px-1.5 py-0.5 rounded bg-[var(--fill-hover)] text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1 cursor-pointer"
            >
              <span>{name}</span>
              <X className="w-2.5 h-2.5" />
            </button>
          ))}
          {isHost &&
            onUnblockChatUser &&
            (room.blockedUsers || []).map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onUnblockChatUser(b.id)}
                className="px-1.5 py-0.5 rounded bg-[var(--fill-hover)] text-[var(--danger)] hover:text-[var(--ink)] inline-flex items-center gap-1 cursor-pointer"
              >
                <span>{b.author}</span>
                <X className="w-2.5 h-2.5" />
              </button>
            ))}
        </div>
      )}

      {tipDrawerOpen && room.commerce.payouts.enabled && (
        <div className="px-3 pb-2 shrink-0 animate-gather-drawer">
          <InChatPaymentWidget
            headline="Direct Creator Tip · 0% Fee"
            subline="100% goes to the creator — checkout inside chat"
            initialAmount={10}
            payouts={room.commerce.payouts}
            viewerName={effectiveViewerName}
            compact
            onClose={() => setTipDrawerOpen(false)}
            onSubmitTip={onSendSuperChat}
          />
        </div>
      )}

      {!canPostToChat ? (
        <div className="p-3 border-t border-[var(--line)] space-y-2 shrink-0">
          <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--ink-3)] px-0.5">
            <Lock className="w-3.5 h-3.5 text-[var(--cyan)] shrink-0" strokeWidth={1.65} />
            <span>Sign in to chat &amp; react</span>
          </div>
          <button
            type="button"
            onClick={() => void onSignInWithGoogle?.()}
            className="w-full h-10 px-3 rounded-[11px] gather-liquid-pill text-[var(--ink)] font-semibold text-[12.5px] inline-flex items-center justify-center gap-2.5 cursor-pointer whitespace-nowrap"
          >
            <GoogleMarkSvg />
            <span>Continue with Google</span>
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmitChat} className="p-3 border-t border-[var(--line)] space-y-2 shrink-0">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--ink-3)] min-w-0">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={effectiveViewerName}
                  referrerPolicy="no-referrer"
                  className="w-4 h-4 rounded-full object-cover shrink-0"
                />
              ) : (
                <span className="w-4 h-4 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] text-[9px] font-bold grid place-items-center shrink-0">
                  {getWatchAvatar(effectiveViewerName).initials}
                </span>
              )}
              <span className="truncate font-semibold text-[var(--ink)]">{effectiveViewerName}</span>
            </div>

            {user && onToggleSubscribe && (
              <button
                type="button"
                disabled={subscribing}
                onClick={() => void onToggleSubscribe()}
                className={`text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                  isSubscribed ? 'text-[var(--ok)]' : 'text-[var(--accent-text)] hover:underline'
                }`}
              >
                {isSubscribed ? <Check className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
                <span>{isSubscribed ? 'Subscribed' : 'Subscribe'}</span>
              </button>
            )}
          </div>

          {replyingTo && (
            <div className="px-2.5 py-1.5 rounded-[8px] bg-[var(--accent-soft)] flex items-center justify-between gap-2 text-[11px]">
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
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder={
                replyingTo
                  ? `Reply to @${replyingTo.author}...`
                  : isGamerMode
                  ? 'Drop hype or callouts...'
                  : 'Message live chat...'
              }
            />
            {chatText.length > 0 && (
              <button
                type="button"
                aria-label="Clear chat input"
                title="Clear"
                onClick={(e) => {
                  setChatText('');
                  (
                    e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement | null
                  )?.focus();
                }}
                className="h-6 w-6 shrink-0 grid place-items-center rounded-full bg-[var(--fill)] hover:bg-[var(--fill-active)] text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer transition-colors"
              >
                <X className="w-3 h-3" strokeWidth={2} />
              </button>
            )}
            {room.commerce.payouts.enabled && (
              <button
                type="button"
                onClick={() => setTipDrawerOpen((v) => !v)}
                aria-label="Tip creator directly in chat"
                title="Tip creator directly in chat"
                className={`h-8 w-8 rounded-[8px] grid place-items-center shrink-0 cursor-pointer transition-colors ${
                  tipDrawerOpen
                    ? 'gather-btn-tip'
                    : 'bg-[var(--ok)]/14 hover:bg-[var(--ok)]/24 text-[var(--ok)]'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            )}
            <button
              type="submit"
              aria-label="Send message"
              className={`gather-send-btn ${chatText.trim() ? 'ready' : ''}`}
            >
              <ArrowUp className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </form>
      )}
    </>
  );
};
