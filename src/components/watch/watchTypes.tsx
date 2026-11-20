import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, CreditCard, DollarSign, QrCode, ShieldCheck, X, Zap } from 'lucide-react';
import {
  ChatReplyRef,
  FlashSaleState,
  MediaAsset,
  PayoutSettings,
  ProductItem,
  RoomState,
  SuperChatMethod,
  VideoFxSettings,
  WatchMode,
} from '../../types/studio';

export interface BagItem {
  product: ProductItem;
  variant: string;
  quantity: number;
  bundleLabel?: string;
}

export interface CompletedReceipt {
  orderNumber: string;
  buyerName: string;
  buyerCity: string;
  shippingAddress: string;
  paymentMethod: string;
  items: Array<{
    title: string;
    source: string;
    variant: string;
    quantity: number;
    lineTotal: number;
    bundleLabel?: string;
  }>;
  subtotal: number;
  savings: number;
  total: number;
  createdAt: number;
}

export interface FloatingHypeParticle {
  id: string;
  leftPct: number;
  kind: 'flame' | 'zap' | 'heart' | 'spark';
}

export interface WatchViewerUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface WatchPageViewProps {
  room: RoomState;
  clientId?: string;
  isHost?: boolean;
  user?: WatchViewerUser | null;
  onSignInWithGoogle?: () => Promise<void>;
  isSubscribed?: boolean;
  subscribing?: boolean;
  onToggleSubscribe?: () => Promise<void>;
  onRaiseHand?: (topic: string) => void;
  onLowerHand?: () => void;
  broadcastStream: MediaStream | null;
  localPreviewCanvas?: HTMLCanvasElement | null;
  localStream?: MediaStream | null;
  screenStream?: MediaStream | null;
  remoteStreams?: Record<string, MediaStream>;
  activeMedia?: MediaAsset | null;
  videoFx?: VideoFxSettings;
  elapsedSec: number;
  isPreviewMode: boolean;
  bagOpen: boolean;
  onSetBagOpen: (open: boolean) => void;
  onBagCountChange: (count: number) => void;
  onSwitchWatchMode?: (mode: WatchMode) => void;
  onSendChat: (text: string, author: string, replyTo?: ChatReplyRef) => void;
  onToggleChatLike?: (messageId: string) => void;
  onToggleChatReaction?: (messageId: string, emoji: string) => void;
  onPinChatMessage?: (messageId: string | null) => void;
  onDeleteChatMessage?: (messageId: string) => void;
  onBlockChatUser?: (author: string, uid?: string) => void;
  onUnblockChatUser?: (blockId: string) => void;
  onAskQuestion?: (text: string, author: string) => void;
  onUpvoteQuestion?: (questionId: string) => void;
  onPlaceOrder: (payload: {
    productId?: string;
    quantity?: number;
    buyerName: string;
    buyerCity?: string;
    paymentMethod?: string;
    variant?: string;
    bundleLabel?: string;
    items?: Array<{
      productId: string;
      quantity: number;
      variant?: string;
      bundleLabel?: string;
    }>;
  }) => void;
  onVotePoll: (optionId: string) => void;
  onCreateClip: (label: string, timestampSec: number, createdBy: string) => void;
  onJoinSquadQueue: (
    handle: string,
    platform: string,
    note?: string,
    role?: string,
    rank?: string
  ) => void;
  onSendSuperChat: (payload: {
    amount: number;
    method: SuperChatMethod;
    author: string;
    text: string;
  }) => void;
  onSendHype: () => void;
  onExitPreview?: () => void;
  onLeaveWatch?: () => void;
}

export type ShopPanelTab = 'drop' | 'all' | 'claims' | 'qa' | 'bag';
export type GamerSubTab = 'squad' | 'rig' | 'clips' | 'poll';
export type ProgramSubTab = 'agenda' | 'poll' | 'clips';
export type RailTab = 'chat' | 'companion' | 'qa' | 'bag';

const WATCH_AVATAR_TONES = [
  'bg-sky-500/14 text-sky-700 dark:text-sky-200 border-sky-500/25',
  'bg-indigo-500/14 text-indigo-700 dark:text-indigo-200 border-indigo-500/25',
  'bg-emerald-500/14 text-emerald-700 dark:text-emerald-200 border-emerald-500/25',
  'bg-amber-500/14 text-amber-700 dark:text-amber-200 border-amber-500/25',
  'bg-rose-500/14 text-rose-700 dark:text-rose-200 border-rose-500/25',
  'bg-cyan-500/14 text-cyan-700 dark:text-cyan-200 border-cyan-500/25',
];

export function getWatchAvatar(name: string): { initials: string; cls: string } {
  const clean = name.trim() || 'G';
  const initials =
    clean
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || '')
      .join('') || 'G';
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
  }
  return { initials, cls: WATCH_AVATAR_TONES[hash % WATCH_AVATAR_TONES.length] };
}

export function formatClock(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const rem = Math.floor(safe % 60);
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function formatMoney(amount: number): string {
  const rounded = Math.round(amount);
  if (Math.abs(amount - rounded) < 0.005) {
    return `$${rounded}`;
  }
  return `$${amount.toFixed(2)}`;
}

export function computeBagLinePricing(
  item: BagItem,
  flashSale: FlashSaleState | null | undefined,
  nowMs: number
): { unitPrice: number; retailTotal: number; lineTotal: number; savings: number; discountLabel?: string } {
  const retailTotal = item.product.price * item.quantity;
  const flashActive =
    Boolean(flashSale?.active) &&
    flashSale!.productId === item.product.id &&
    flashSale!.endsAt > nowMs &&
    flashSale!.soldUnits < flashSale!.totalUnits;

  let pct = 0;
  let discountLabel: string | undefined;

  if (flashActive && flashSale) {
    const trioTier = flashSale.bundles?.find((b) => b.quantity >= 3);
    const duoTier = flashSale.bundles?.find((b) => b.quantity === 2);
    if (item.quantity >= 3) {
      pct = trioTier?.discountPct || Math.min(60, flashSale.discountPct + 18);
      discountLabel = `3× VIP Flash (-${pct}%)`;
    } else if (item.quantity === 2) {
      pct = duoTier?.discountPct || Math.min(50, flashSale.discountPct + 10);
      discountLabel = `2× Duo Flash (-${pct}%)`;
    } else {
      pct = flashSale.discountPct;
      discountLabel = `Flash Drop (-${pct}%)`;
    }
  } else if (item.quantity >= 3) {
    pct = 15;
    discountLabel = '3+ Bundle (-15%)';
  } else if (item.quantity === 2) {
    pct = 10;
    discountLabel = '2× Bundle (-10%)';
  }

  const unitPrice = Number((item.product.price * (1 - pct / 100)).toFixed(2));
  const lineTotal = Number((unitPrice * item.quantity).toFixed(2));
  const savings = Math.max(0, Number((retailTotal - lineTotal).toFixed(2)));
  return { unitPrice, retailTotal, lineTotal, savings, discountLabel };
}

export const GoogleMarkSvg: React.FC = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
    />
  </svg>
);

interface InChatPaymentCardProps {
  headline: string;
  subline?: string;
  suggestedAmounts?: number[];
  initialAmount?: number;
  payouts: PayoutSettings;
  viewerName: string;
  compact?: boolean;
  onClose?: () => void;
  onSubmitTip: (payload: {
    amount: number;
    method: SuperChatMethod;
    author: string;
    text: string;
  }) => void;
}

export const InChatPaymentWidget: React.FC<InChatPaymentCardProps> = ({
  headline,
  subline,
  suggestedAmounts = [5, 10, 25, 50],
  initialAmount = 10,
  payouts,
  viewerName,
  compact = false,
  onClose,
  onSubmitTip,
}) => {
  const availableMethods = useMemo<SuperChatMethod[]>(() => {
    const list: SuperChatMethod[] = ['card'];
    if (payouts.venmoHandle) list.push('venmo');
    if (payouts.paypalHandle) list.push('paypal');
    if (payouts.cashappTag) list.push('cashapp');
    if (payouts.stripeUrl) list.push('stripe');
    return list;
  }, [payouts]);

  const [amount, setAmount] = useState<number>(initialAmount);
  const [method, setMethod] = useState<SuperChatMethod>('card');
  const [note, setNote] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedHandle, setCopiedHandle] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [sentReceipt, setSentReceipt] = useState<number | null>(null);
  const [showInlineFrame, setShowInlineFrame] = useState(false);

  useEffect(() => {
    setAmount(initialAmount);
  }, [initialAmount]);

  const handleInfo = useMemo(() => {
    if (method === 'venmo' && payouts.venmoHandle) {
      const h = payouts.venmoHandle.replace(/^@/, '');
      return {
        label: 'Venmo',
        handle: `@${h}`,
        qrPayload: `https://venmo.com/${encodeURIComponent(h)}?txn=pay&amount=${amount}`,
      };
    }
    if (method === 'paypal' && payouts.paypalHandle) {
      const h = payouts.paypalHandle.replace(/^@/, '');
      return {
        label: 'PayPal',
        handle: `paypal.me/${h}`,
        qrPayload: `https://paypal.me/${encodeURIComponent(h)}/${amount}`,
      };
    }
    if (method === 'cashapp' && payouts.cashappTag) {
      const h = payouts.cashappTag.replace(/^\$/, '');
      return {
        label: 'Cash App',
        handle: `$${h}`,
        qrPayload: `https://cash.app/$${encodeURIComponent(h)}/${amount}`,
      };
    }
    if (method === 'stripe' && payouts.stripeUrl) {
      return {
        label: 'Creator Link',
        handle: payouts.stripeUrl.replace(/^https?:\/\//, '').slice(0, 28),
        qrPayload: payouts.stripeUrl,
      };
    }
    return null;
  }, [method, payouts, amount]);

  useEffect(() => {
    if (!handleInfo?.qrPayload) {
      setQrDataUrl('');
      return;
    }
    let active = true;
    void QRCode.toDataURL(handleInfo.qrPayload, {
      width: 112,
      margin: 1,
      color: { dark: '#071024', light: '#ffffff' },
    }).then((url) => {
      if (active) setQrDataUrl(url);
    });
    return () => {
      active = false;
    };
  }, [handleInfo?.qrPayload]);

  const handleCompleteInChat = () => {
    if (processing) return;
    setProcessing(true);
    window.setTimeout(() => {
      onSubmitTip({
        amount: Math.max(1, Math.min(500, Math.round(amount || 5))),
        method,
        author: viewerName.trim() || 'Viewer',
        text: note.trim() || `Supported the stream directly in chat ($${amount})!`,
      });
      setProcessing(false);
      setSentReceipt(amount);
      setNote('');
      window.setTimeout(() => {
        setSentReceipt(null);
        onClose?.();
      }, 1500);
    }, 200);
  };

  return (
    <div className={`gather-pay-card rounded-[16px] ${compact ? 'p-3' : 'p-3.5'} space-y-2.5 animate-gather-msg`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--ink)]">
            <DollarSign className="w-3.5 h-3.5 text-[var(--ok)] shrink-0" strokeWidth={1.75} />
            <span className="truncate">{headline}</span>
          </div>
          <p className="text-[11px] text-[var(--ink-2)] mt-0.5 leading-snug">
            {subline || '0% platform fee · Instant checkout inside chat'}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment drawer"
            className="w-6 h-6 rounded-[7px] hover:bg-[var(--fill-hover)] text-[var(--ink-3)] hover:text-[var(--ink)] grid place-items-center cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {suggestedAmounts.slice(0, 4).map((preset) => {
          const active = amount === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(preset)}
              className={`h-8 rounded-[8px] text-[12px] font-mono-num font-semibold cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                active
                  ? 'gather-btn-primary text-white'
                  : 'gather-liquid-pill text-[var(--ink-2)] hover:text-[var(--ink)]'
              }`}
            >
              ${preset}
            </button>
          );
        })}
        <div className="relative flex items-center">
          <span className="absolute left-2 text-[11px] font-mono-num text-[var(--ink-3)] pointer-events-none">
            $
          </span>
          <input
            type="number"
            min={1}
            max={500}
            value={amount}
            aria-label="Custom tip amount"
            onChange={(e) => setAmount(Math.max(1, Math.min(500, Number(e.target.value || 1))))}
            className="w-full h-8 pl-5 pr-1.5 rounded-[8px] bg-[var(--fill)] border border-[var(--line-2)] text-[12px] font-mono-num font-semibold text-[var(--ink)] focus:outline-none focus:border-[var(--cyan)]"
          />
        </div>
      </div>

      <div className="gather-seg w-full overflow-x-auto gather-scroll">
        {availableMethods.map((m) => {
          const active = method === m;
          const label =
            m === 'card'
              ? 'Instant Pay'
              : m === 'venmo'
              ? 'Venmo'
              : m === 'paypal'
              ? 'PayPal'
              : m === 'cashapp'
              ? 'Cash App'
              : 'Sheet';
          return (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMethod(m);
                setShowInlineFrame(false);
              }}
              className={`gather-seg-btn flex-1 ${active ? 'active' : ''}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {method === 'card' ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-[10px] bg-[var(--fill)] border border-[var(--line)]">
          <div className="flex items-center gap-2 min-w-0">
            <CreditCard className="w-3.5 h-3.5 text-[var(--cyan)] shrink-0" strokeWidth={1.65} />
            <span className="text-[11.5px] text-[var(--ink-2)] truncate">
              Apple Pay · Google Pay · Card
            </span>
          </div>
          <span className="text-[10.5px] font-mono-num text-[var(--ok)] whitespace-nowrap shrink-0 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.65} />
            Direct
          </span>
        </div>
      ) : method === 'stripe' && payouts.stripeUrl ? (
        <div className="rounded-[10px] bg-[var(--fill)] border border-[var(--line)] p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] text-[var(--ink-2)] truncate">
              Inline Checkout ({handleInfo?.handle})
            </span>
            <button
              type="button"
              onClick={() => setShowInlineFrame((v) => !v)}
              className="h-6 px-2.5 rounded-[6px] bg-[var(--accent-soft)] border border-[var(--accent-line)] text-[11px] font-semibold text-[var(--accent-text)] cursor-pointer whitespace-nowrap shrink-0"
            >
              {showInlineFrame ? 'Hide' : 'Open'}
            </button>
          </div>
          {showInlineFrame && (
            <iframe
              src={payouts.stripeUrl}
              title="In-Chat Creator Payment Sheet"
              className="w-full h-44 rounded-[8px] border border-[var(--line)] bg-white"
              sandbox="allow-scripts allow-forms allow-same-origin"
            />
          )}
        </div>
      ) : (
        handleInfo && (
          <div className="flex items-center gap-3 p-2.5 rounded-[10px] bg-[var(--fill)] border border-[var(--line)]">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt={`Scan ${handleInfo.label} QR`}
                referrerPolicy="no-referrer"
                className="w-13 h-13 rounded-[7px] bg-white p-1 shrink-0"
              />
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-mono-num font-bold text-[var(--ink)] truncate">
                  {handleInfo.handle}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(handleInfo.handle);
                    setCopiedHandle(true);
                    window.setTimeout(() => setCopiedHandle(false), 1600);
                  }}
                  className="h-6 px-2 rounded-[6px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[11px] font-semibold text-[var(--accent-text)] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copiedHandle ? <Check className="w-3 h-3 text-[var(--ok)]" /> : <Copy className="w-3 h-3" />}
                  {copiedHandle ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-[11px] text-[var(--ink-3)] leading-tight flex items-center gap-1">
                <QrCode className="w-3 h-3 text-[var(--cyan)] shrink-0" />
                <span>Scan or copy handle</span>
              </p>
            </div>
          </div>
        )
      )}

      {sentReceipt !== null ? (
        <div className="h-9 rounded-[9px] bg-[var(--ok)]/16 border border-[var(--ok)]/35 px-3 flex items-center justify-center gap-2 text-[12px] font-semibold text-[var(--ok)]">
          <Check className="w-4 h-4" />
          <span>${sentReceipt} Tip Sent Live</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCompleteInChat();
              }
            }}
            placeholder="Add a shoutout note..."
            className="flex-1 min-w-0 h-9 px-3 rounded-[9px] bg-[var(--fill)] border border-[var(--line-2)] text-[12px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--cyan)]"
          />
          <button
            type="button"
            disabled={processing}
            onClick={handleCompleteInChat}
            className="h-9 px-3.5 rounded-[9px] gather-btn-tip text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Zap className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>{processing ? 'Sending...' : `Send $${amount}`}</span>
          </button>
        </div>
      )}
    </div>
  );
};
