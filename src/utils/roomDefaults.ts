import {
  DEFAULT_GEAR_SPECS,
  DEFAULT_PRODUCTS,
  DEFAULT_RUNDOWN,
  DEFAULT_SPONSORS,
} from '../constants/studioDefaults';
import { RoomState, WatchMode } from '../types/studio';

export function parseRoomCodeFromInput(raw: string): string {
  const trimmed = raw.trim();
  try {
    if (trimmed.includes('://') || trimmed.includes('?')) {
      const u = new URL(trimmed.startsWith('http') ? trimmed : `https://gather.app/${trimmed}`);
      const code = u.searchParams.get('join') || u.searchParams.get('watch');
      if (code) return code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    }
  } catch {
    // ignore URL parse error
  }
  return trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'CAST01';
}

export function sanitizeHostKey(raw: string): string {
  const clean = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 56);
  return clean || 'GATHERLIVE';
}

export function makeFallbackRoom(roomCode: string, watchMode: WatchMode = 'standard'): RoomState {
  const isGamer = watchMode === 'gamer';
  const isShop = watchMode === 'shop';
  return {
    roomCode,
    title: isGamer
      ? 'Ranked Squad Co-Stream'
      : isShop
      ? 'Studio Objects Live Drop'
      : 'Design Systems & Live Q&A',
    hostId: 'demo-host',
    isLocked: false,
    isLive: true,
    liveStartedAt: Date.now(),
    aspectRatio: '16:9',
    watchMode,
    viewerCount: 248,
    participants: [
      {
        id: 'demo-host',
        name: 'Maya Chen',
        initials: 'MC',
        avatarUrl: '/src/assets/images/host_maya_studio_1794840297410.jpg',
        role: 'host',
        onStage: true,
        micOn: true,
        camOn: false,
        sharingScreen: false,
        joinedAt: Date.now(),
      },
      {
        id: 'demo-guest',
        name: 'Jordan Lee',
        initials: 'JL',
        avatarUrl: '/src/assets/images/host_jordan_studio_1794840296850.jpg',
        role: 'guest',
        onStage: true,
        micOn: true,
        camOn: false,
        sharingScreen: false,
        joinedAt: Date.now(),
      },
    ],
    lobby: [],
    squadQueue: isGamer
      ? [
          {
            id: 'sq-demo-1',
            handle: 'Kuro#NA1',
            platform: 'PC · Discord',
            role: 'Sentinel / IGL',
            rank: 'Ascendant II',
            note: 'Controller / Sentinel',
            joinedAt: Date.now() - 120000,
          },
          {
            id: 'sq-demo-2',
            handle: 'NovaPulse',
            platform: 'PlayStation',
            role: 'Duelist',
            rank: 'Diamond III',
            note: 'Ready for next lobby',
            joinedAt: Date.now() - 45000,
          },
        ]
      : [],
    questions: [
      {
        id: 'q-demo-1',
        author: 'Elena V.',
        text: 'How are you routing multi-track browser audio without local OBS plugins?',
        upvotes: 14,
        answered: false,
        createdAt: Date.now() - 180000,
      },
      {
        id: 'q-demo-2',
        author: 'Marcus T.',
        text: 'Can guests join from mobile Safari and still share slides?',
        upvotes: 9,
        answered: false,
        createdAt: Date.now() - 95000,
      },
    ],
    handRaiseQueue: [
      {
        id: 'hand-demo-1',
        name: 'Sasha K.',
        initials: 'SK',
        topic: 'Question on zero-latency audio routing & podcast RSS',
        raisedAt: Date.now() - 75000,
      },
    ],
    hypeTrain: {
      active: true,
      level: 2,
      points: 145,
      goalPoints: 200,
      endsAt: Date.now() + 4 * 60 * 1000,
      lastContributor: 'Devon R.',
      lastReason: '$25 Super Chat',
    },
    upcomingStream: {
      title: 'Creator Commerce & Zero-Fee Audio Deep Dive',
      scheduledIso: '2026-11-20T18:00:00',
    },
    pinnedChatId: null,
    blockedUsers: [],
    scene: {
      templateId: 'duo',
      transitionType: 'dissolve',
      transitionMs: 320,
      customElements: [],
      savedPresets: [],
    },
    overlays: {
      banner: {
        visible: true,
        title: isGamer
          ? 'Ranked Squad Co-Stream'
          : isShop
          ? 'Studio Objects Live Drop'
          : 'Design Systems & Live Q&A',
        subtitle: isGamer
          ? 'Vote in the live prediction poll & join the squad queue'
          : isShop
          ? 'Shop Shopify & Etsy volume bundles right inside Gather'
          : 'Ask questions in Q&A & tip creators directly inside chat',
        style: 'editorial',
      },
      ticker: {
        visible: false,
        text: 'Welcome to gather. — 100% Free browser broadcast studio · 0% creator fees',
      },
      featuredChatId: null,
      featuredQuestionId: null,
      chatOverlayOnStage: false,
      showSupportQrOnStage: false,
      captionsEnabled: false,
      captionText: '',
      captionLang: 'en-US',
      captionStyle: 'glass',
    },
    brand: {
      accent: '#2f6bf0',
      backdrop: 'dusk',
      backdropDim: 35,
      font: 'Outfit',
      frame: 'none',
      showNames: true,
      nameTagStyle: 'glass',
      logoPosition: 'tr',
      logoSize: 44,
      sponsorsEnabled: false,
      sponsorIntervalSec: 15,
      sponsors: DEFAULT_SPONSORS,
    },
    commerce: {
      storeLabel: 'Gather Studio Store · Shopify & Etsy Sync',
      products: DEFAULT_PRODUCTS,
      pinnedProductId: isShop ? DEFAULT_PRODUCTS[0].id : null,
      recentOrders: [],
      activeFlashSale: isShop
        ? {
            id: 'flash-demo-1',
            productId: DEFAULT_PRODUCTS[0].id,
            active: true,
            discountPct: 20,
            totalUnits: 15,
            soldUnits: 7,
            startedAt: Date.now() - 60000,
            endsAt: Date.now() + 9 * 60 * 1000,
            tagline: 'TV LIVE FLASH · VOLUME BUNDLES ACTIVE',
            bundles: [
              { id: 'b1', quantity: 1, label: '1× Single', discountPct: 20 },
              { id: 'b2', quantity: 2, label: '2× Duo Bundle', discountPct: 30, badge: 'Popular' },
              { id: 'b3', quantity: 3, label: '3× VIP Pack', discountPct: 38, badge: 'Best Value' },
            ],
          }
        : null,
      latestSalePopup: null,
      payouts: {
        enabled: true,
        paypalHandle: 'gatherstudio',
        venmoHandle: 'gather-live',
        cashappTag: 'GatherLive',
      },
    },
    gamer: {
      gameTitle: 'Valorant · Champions Co-Stream',
      modeOrRank: 'Radiant Lobby · NA West',
      seriesScore: 'BO3 · 1–0',
      currentMap: 'Ascent',
      roundLabel: 'Round 21 · Buy Phase',
      teamAName: 'GATHER',
      teamBName: 'APEX',
      teamAScore: 11,
      teamBScore: 9,
      crosshairCode: '0;P;c;5;o;1;0l;4;0o;2;0a;1;0f;0;1b;0',
      sensitivity: '0.35 (280 eDPI)',
      dpi: 800,
      resolution: '1920×1080 · 240Hz',
      lobbyCode: `GTH-${roomCode}`,
      gearSpecs: DEFAULT_GEAR_SPECS,
      activePoll: {
        id: 'poll-demo',
        question: isGamer
          ? 'Who takes Round 21 & closes Ascent?'
          : 'Which topic should we deep-dive next?',
        options: isGamer
          ? [
              { id: 'o1', label: 'Gather Win · A Execute', votes: 68 },
              { id: 'o2', label: 'Apex Clutch · Retake', votes: 34 },
            ]
          : [
              { id: 'o1', label: 'WebRTC Low-Latency Mixing', votes: 24 },
              { id: 'o2', label: 'Zero-Fee Creator Monetization', votes: 31 },
            ],
        isOpen: true,
        showOnStage: isGamer,
        createdAt: Date.now(),
      },
      clips: isGamer
        ? [
            {
              id: 'clip-demo-1',
              label: '4K Sheriff Clutch on Ascent B Main',
              timestampSec: 142,
              createdBy: 'Maya Chen',
              createdAt: Date.now() - 180000,
              upvotes: 42,
              category: '4K Clutch',
            },
            {
              id: 'clip-demo-2',
              label: '0.4s Ninja Defuse Through Viper Smoke',
              timestampSec: 89,
              createdBy: 'Kuro#NA1',
              createdAt: Date.now() - 95000,
              upvotes: 29,
              category: 'IQ Play',
            },
          ]
        : [
            {
              id: 'clip-demo-1',
              label: 'Live Audio Bus Architecture Breakdown',
              timestampSec: 142,
              createdBy: 'Maya Chen',
              createdAt: Date.now() - 180000,
            },
          ],
      hypeCount: 128,
      slowModeSec: 0,
    },
    rundown: { steps: DEFAULT_RUNDOWN, activeStepId: DEFAULT_RUNDOWN[0].id },
    chatMessages: [
      {
        id: 'm1',
        author: 'Maya Chen',
        avatarUrl: '/src/assets/images/host_maya_studio_1794840297410.jpg',
        role: 'host',
        source: 'studio',
        text: isGamer
          ? 'Welcome in! Vote in the prediction poll or drop your tag for next lobby.'
          : isShop
          ? 'Welcome in! Flash volume bundles are live — check out right inside Express Bag.'
          : 'Welcome to the live broadcast! Drop questions in Q&A or click $ Support in chat.',
        timestamp: Date.now() - 90000,
        likes: 6,
        likedBy: ['v1', 'v2', 'v3'],
        reactions: { '❤️': ['v1', 'v2'], '🔥': ['v3'] },
      },
      {
        id: 'm2',
        author: 'Elena V.',
        role: 'viewer',
        source: 'watch',
        text: isGamer
          ? 'That mid lurk timing on Ascent was insane.'
          : isShop
          ? 'Does the cobalt ceramic mug ship internationally?'
          : 'Audio routing sounds super clean on AirPods.',
        timestamp: Date.now() - 62000,
        replyTo: {
          id: 'm1',
          author: 'Maya Chen',
          text: isGamer
            ? 'Welcome in! Vote in the prediction poll or drop your tag for next lobby.'
            : isShop
            ? 'Welcome in! Flash volume bundles are live — check out right inside Express Bag.'
            : 'Welcome to the live broadcast! Drop questions in Q&A or click $ Support in chat.',
        },
        likes: 3,
        likedBy: ['v2'],
      },
      {
        id: 'sc-demo-1',
        author: 'Devon R.',
        role: 'superchat',
        source: 'watch',
        text: isGamer
          ? 'Run Sheriff-only on Ascent! Huge clutch earlier.'
          : isShop
          ? 'Grabbed the 2× Duo Cobalt Mug bundle — love the live glaze demo!'
          : 'Thank you for making a zero-fee studio that keeps everything right in chat!',
        timestamp: Date.now() - 35000,
        likes: 9,
        likedBy: ['v1', 'v3'],
        superChat: {
          amount: 25,
          method: 'card',
          tier: 'amber',
        },
      },
    ],
  };
}
