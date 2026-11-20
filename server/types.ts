import type { WebSocket } from 'ws';
import { z } from 'zod';

export interface ClientMeta {
  ws: WebSocket;
  clientId: string;
  roomCode: string;
  role: 'host' | 'guest' | 'viewer';
  name: string;
  avatarUrl?: string;
  inWatchParty?: boolean;
  joinedAt?: number;
  verifiedUid?: string;
}

export interface ServerFlashSale {
  id: string;
  productId: string;
  discountPct: number;
  totalUnits: number;
  soldUnits: number;
  startedAt: number;
  endsAt: number;
  tagline: string;
  bundles: Array<{
    id: string;
    quantity: number;
    label: string;
    discountPct: number;
    badge?: string;
  }>;
  active: boolean;
}

export interface ServerRoomState {
  roomCode: string;
  title: string;
  hostId: string;
  hostUid?: string;
  isLocked: boolean;
  isLive: boolean;
  liveStartedAt: number | null;
  aspectRatio: '16:9' | '9:16';
  watchMode: 'standard' | 'shop' | 'gamer';
  viewerCount: number;
  watchers: Array<{
    id: string;
    name: string;
    initials: string;
    avatarUrl?: string;
    uid?: string;
    inWatchParty?: boolean;
    joinedAt: number;
  }>;
  participants: Array<{
    id: string;
    name: string;
    initials: string;
    avatarUrl?: string;
    role: 'host' | 'guest';
    onStage: boolean;
    micOn: boolean;
    camOn: boolean;
    sharingScreen: boolean;
    mutedByHost?: boolean;
    joinedAt: number;
  }>;
  lobby: Array<{
    id: string;
    name: string;
    initials: string;
    avatarUrl?: string;
    requestedAt: number;
  }>;
  squadQueue: Array<{
    id: string;
    handle: string;
    platform: string;
    role?: string;
    rank?: string;
    note?: string;
    joinedAt: number;
  }>;
  questions: Array<{
    id: string;
    author: string;
    text: string;
    upvotes: number;
    answered?: boolean;
    createdAt: number;
  }>;
  scene: {
    templateId: string;
    transitionType: 'cut' | 'dissolve' | 'slide' | 'push';
    transitionMs: number;
    customElements: unknown[];
    savedPresets?: Array<Record<string, unknown>>;
  };
  overlays: {
    banner: { visible: boolean; title: string; subtitle: string; style: string };
    ticker: { visible: boolean; text: string };
    featuredChatId: string | null;
    featuredQuestionId?: string | null;
    chatOverlayOnStage?: boolean;
    showSupportQrOnStage?: boolean;
    captionsEnabled: boolean;
    captionText: string;
    captionLang: string;
    captionStyle?: 'glass' | 'bar' | 'minimal';
    countdownEndAt?: number | null;
    countdownLabel?: string;
    countdownConfig?: Record<string, unknown>;
  };
  brand: Record<string, unknown>;
  commerce: {
    storeLabel: string;
    shopifyDomain?: string;
    etsyShopName?: string;
    products: Array<{
      id: string;
      source: 'shopify' | 'etsy' | 'custom';
      title: string;
      price: number;
      currency: string;
      imageUrl: string;
      url: string;
      stock: number;
      variants: string[];
      description?: string;
    }>;
    pinnedProductId: string | null;
    recentOrders: Array<{
      id: string;
      orderNumber?: string;
      productId: string;
      productTitle: string;
      variant?: string;
      quantity: number;
      bundleLabel?: string;
      total: number;
      buyerName: string;
      buyerCity?: string;
      paymentMethod?: string;
      source?: 'shopify' | 'etsy' | 'custom';
      createdAt: number;
    }>;
    payouts: {
      enabled: boolean;
      paypalHandle?: string;
      venmoHandle?: string;
      cashappTag?: string;
      stripeUrl?: string;
    };
    activeFlashSale?: ServerFlashSale | null;
    latestSalePopup?: Record<string, unknown> | null;
  };
  gamer: {
    gameTitle: string;
    modeOrRank: string;
    seriesScore?: string;
    currentMap?: string;
    lobbyCode: string;
    gearSpecs: unknown[];
    activePoll: {
      id: string;
      question: string;
      options: Array<{ id: string; label: string; votes: number }>;
      isOpen: boolean;
      showOnStage: boolean;
      createdAt: number;
    } | null;
    clips: Array<{
      id: string;
      label: string;
      timestampSec: number;
      createdBy: string;
      createdAt: number;
    }>;
    hypeCount: number;
    slowModeSec: number;
  };
  rundown: {
    steps: unknown[];
    activeStepId: string | null;
  };
  chatMessages: Array<{
    id: string;
    author: string;
    authorUid?: string;
    avatarUrl?: string;
    role: 'host' | 'guest' | 'viewer' | 'order' | 'superchat' | 'payment-card' | 'system';
    source: 'studio' | 'watch' | 'youtube' | 'twitch';
    audience?: 'public' | 'studio';
    text: string;
    timestamp: number;
    replyTo?: {
      id: string;
      author: string;
      text: string;
    };
    likes?: number;
    likedBy?: string[];
    reactions?: Record<string, string[]>;
    superChat?: {
      amount: number;
      method: 'card' | 'paypal' | 'venmo' | 'cashapp' | 'stripe';
      tier: 'blue' | 'emerald' | 'amber' | 'rose';
    };
    paymentCard?: {
      headline: string;
      note?: string;
      suggestedAmounts?: number[];
    };
  }>;
  pinnedChatId?: string | null;
  blockedUsers?: Array<{
    id: string;
    author: string;
    uid?: string;
    blockedAt: number;
  }>;
  handRaiseQueue: Array<{
    id: string;
    uid?: string;
    name: string;
    initials: string;
    avatarUrl?: string;
    topic: string;
    raisedAt: number;
  }>;
  hypeTrain: {
    active: boolean;
    level: number;
    points: number;
    goalPoints: number;
    endsAt: number;
    lastContributor?: string;
    lastReason?: string;
  };
  upcomingStream: {
    title: string;
    scheduledIso: string;
    description?: string;
    hostName?: string;
  } | null;
}

export interface ServerPodcastEpisode {
  id: string;
  title: string;
  summary: string;
  durationSec: number;
  publishedAt: string;
  audioUrl: string;
  audioFormat: 'audio/wav' | 'audio/webm';
  fileSizeBytes: number;
  seasonNumber?: number;
  episodeNumber?: number;
  chapters?: string[];
}

export interface ServerPodcastShow {
  slug: string;
  title: string;
  author: string;
  email: string;
  description: string;
  category: string;
  language: string;
  coverArtUrl: string;
  directories: Array<{
    platform: 'spotify' | 'apple' | 'amazon' | 'youtube';
    connected: boolean;
    directoryUrl?: string;
  }>;
  episodes: ServerPodcastEpisode[];
}

export const roomJoinSchema = z.object({
  type: z.literal('room:join'),
  roomCode: z.string().optional(),
  clientId: z.string().optional(),
  role: z.enum(['host', 'guest', 'viewer']).optional(),
  name: z.string().optional(),
  avatarUrl: z.string().optional(),
  inWatchParty: z.boolean().optional(),
  hostUid: z.string().optional(),
  authToken: z.string().optional(),
  title: z.string().optional(),
  watchMode: z.enum(['standard', 'shop', 'gamer']).optional(),
  payouts: z.record(z.string(), z.unknown()).optional(),
  micOn: z.boolean().optional(),
  camOn: z.boolean().optional(),
});

export const roomHydrateSchema = z.object({
  type: z.literal('room:hydrate'),
  snapshot: z.record(z.string(), z.unknown()),
});
