import { WebSocket } from 'ws';
import { ClientMeta, ServerFlashSale, ServerRoomState } from './types.js';

export const rooms = new Map<string, ServerRoomState>();
export const roomSockets = new Map<string, Map<string, ClientMeta>>();

export function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || '')
      .join('') || 'G'
  );
}

export function buildFlashBundles(discountPct: number): ServerFlashSale['bundles'] {
  const base = Math.max(5, Math.min(60, Math.round(discountPct)));
  const duo = Math.min(70, base + 10);
  const trio = Math.min(75, base + 18);
  return [
    { id: 'tier-1', quantity: 1, label: '1× Single', discountPct: base, badge: `${base}% OFF` },
    {
      id: 'tier-2',
      quantity: 2,
      label: '2× Duo Bundle',
      discountPct: duo,
      badge: `POPULAR · ${duo}% OFF`,
    },
    {
      id: 'tier-3',
      quantity: 3,
      label: '3× VIP Pack',
      discountPct: trio,
      badge: `BEST VALUE · ${trio}% OFF`,
    },
  ];
}

export function advanceHypeTrain(
  room: ServerRoomState,
  pointsAdded: number,
  contributor: string,
  reason: string
) {
  const now = Date.now();
  if (!room.hypeTrain || (room.hypeTrain.active && room.hypeTrain.endsAt < now)) {
    room.hypeTrain = {
      active: false,
      level: 1,
      points: 0,
      goalPoints: 100,
      endsAt: 0,
    };
  }
  const ht = room.hypeTrain;
  ht.points += pointsAdded;
  ht.lastContributor = contributor;
  ht.lastReason = reason;

  if (!ht.active && ht.points >= 25) {
    ht.active = true;
    ht.endsAt = now + 3 * 60 * 1000;
  } else if (ht.active) {
    ht.endsAt = Math.max(ht.endsAt, now + 90 * 1000);
  }

  while (ht.points >= ht.goalPoints && ht.level < 5) {
    ht.points -= ht.goalPoints;
    ht.level += 1;
    ht.goalPoints = Math.round(ht.goalPoints * 1.35);
    ht.endsAt = now + 3 * 60 * 1000;
  }
}

export function createDefaultRoom(
  roomCode: string,
  hostId: string,
  hostName: string,
  initialMode?: 'standard' | 'shop' | 'gamer',
  isViewerDemo = false
): ServerRoomState {
  const watchMode: 'standard' | 'shop' | 'gamer' =
    initialMode ||
    (roomCode.startsWith('GAMER') ? 'gamer' : roomCode.startsWith('SHOP') ? 'shop' : 'standard');
  const isGamer = watchMode === 'gamer';
  const isShop = watchMode === 'shop';

  return {
    roomCode,
    title: isGamer
      ? 'Ranked Squad Co-Stream'
      : isShop
      ? 'Studio Ceramic & Audio Live Drop'
      : 'Gather Keynote & Founder Town Hall',
    hostId,
    isLocked: false,
    isLive: isViewerDemo,
    liveStartedAt: isViewerDemo ? Date.now() - 240000 : null,
    aspectRatio: '16:9',
    watchMode,
    viewerCount: isViewerDemo ? 4 : 0,
    watchers: isViewerDemo
      ? [
          { id: 'demo-w-1', name: 'Yuki M.', initials: 'YM', inWatchParty: true, joinedAt: Date.now() - 300000 },
          { id: 'demo-w-2', name: 'Maya C.', initials: 'MC', inWatchParty: true, joinedAt: Date.now() - 240000 },
          { id: 'demo-w-3', name: 'Jordan B.', initials: 'JB', inWatchParty: true, joinedAt: Date.now() - 180000 },
          { id: 'demo-w-4', name: 'Nina K.', initials: 'NK', inWatchParty: true, joinedAt: Date.now() - 120000 },
        ]
      : [],
    participants: isViewerDemo
      ? [
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
        ]
      : [],
    lobby: [],
    squadQueue:
      isGamer && isViewerDemo
        ? [
            {
              id: 'sq-demo-1',
              handle: 'Kuro#NA1',
              platform: 'PC · Discord',
              role: 'Sentinel',
              rank: 'Immortal II',
              note: 'Controller / Sentinel',
              joinedAt: Date.now() - 120000,
            },
            {
              id: 'sq-demo-2',
              handle: 'NovaPulse',
              platform: 'PlayStation',
              role: 'IGL',
              rank: 'Ascendant III',
              note: 'Ready for next lobby',
              joinedAt: Date.now() - 45000,
            },
          ]
        : [],
    questions: [
      {
        id: 'qa-demo-1',
        author: 'Elena V.',
        text: 'How are you running 8-platform simulcast + WebRTC audio mixing with zero monthly fees?',
        upvotes: 14,
        answered: false,
        createdAt: Date.now() - 180000,
      },
      {
        id: 'qa-demo-2',
        author: 'Marcus T.',
        text: 'Can guests join from mobile Safari with isolated audio channels and custom stingers?',
        upvotes: 9,
        answered: false,
        createdAt: Date.now() - 95000,
      },
    ],
    scene: {
      templateId: isViewerDemo ? 'duo' : 'solo',
      transitionType: 'dissolve',
      transitionMs: 320,
      customElements: [],
      savedPresets: [],
    },
    overlays: {
      banner: {
        visible: isViewerDemo,
        title: isGamer
          ? 'Ranked Squad Co-Stream'
          : isShop
          ? 'Live Studio Drop · Limited Batch'
          : 'Episode 12: Zero-Fee Broadcast Architecture',
        subtitle: isGamer
          ? 'Vote in the live prediction poll & join the squad queue'
          : isShop
          ? 'Add directly to your Express Bag without leaving the stream'
          : 'Upvote live questions in Q&A or tip directly inside chat',
        style: 'glass',
      },
      ticker: {
        visible: false,
        text: 'Welcome to gather. — 100% Free Studio · Direct in-chat creator support with 0% platform cut',
      },
      featuredChatId: null,
      featuredQuestionId: null,
      chatOverlayOnStage: false,
      showSupportQrOnStage: false,
      captionsEnabled: false,
      captionText: '',
      captionLang: 'en-US',
      captionStyle: 'glass',
      countdownEndAt: null,
      countdownLabel: 'Starting Soon',
      countdownConfig: {
        mode: 'takeover',
        animationStyle: 'aurora-rings',
        typography: 'mono',
        eyebrow: 'STARTING SOON',
        headline: isGamer ? 'Ranked Squad Lobby' : isShop ? 'Live Studio Drop' : 'Broadcast Doors Open',
        subtitle: 'Grab a seat in chat — stream begins shortly',
        agendaItems: ['Soundcheck & Lobby', 'Main Keynote & Demo', 'Live Q&A + Audience Drop'],
        primaryHex: '#3b82f6',
        secondaryHex: '#22d3ee',
        surfaceHex: '#070b16',
        particleDensity: 65,
        blurBackdrop: true,
        showQr: true,
        autoGoLive: false,
        durationSec: 180,
        pausedRemainingSec: null,
      },
    },
    brand: {
      accent: '#2f6bf0',
      backdrop: 'dusk',
      backdropDim: 35,
      font: 'Plus Jakarta Sans',
      frame: 'none',
      nameTagStyle: 'glass',
      showNames: true,
      logoPosition: 'tr',
      logoSize: 44,
      sponsorsEnabled: false,
      sponsorIntervalSec: 15,
      sponsors: [
        {
          id: 'spon-1',
          label: 'Gather Studio',
          tagline: '100% Free Broadcast Studio · Made in Texas',
        },
        {
          id: 'spon-2',
          label: 'Direct Creator Pay',
          tagline: '0% Platform Fees · Instant In-Chat Tips',
        },
      ],
    },
    commerce: {
      storeLabel: 'Studio Merch & Curated Drops',
      products: [
        {
          id: 'prod-mug',
          source: 'etsy',
          title: 'Cobalt Glaze Pour-Over Mug',
          price: 38.0,
          currency: 'USD',
          imageUrl: '/src/assets/images/product_ceramic_mug_1794839256911.jpg',
          url: 'https://www.etsy.com',
          stock: 18,
          variants: ['12oz Matte Slate', '16oz Cobalt Drip'],
          description: 'Hand-thrown stoneware mug fired with deep cobalt ash glaze.',
        },
        {
          id: 'prod-mic',
          source: 'shopify',
          title: 'Studio Dynamic XLR Broadcast Mic',
          price: 189.0,
          currency: 'USD',
          imageUrl: '/src/assets/images/product_broadcast_mic_1794839257210.jpg',
          url: 'https://www.shopify.com',
          stock: 14,
          variants: ['Obsidian + Boom Arm', 'Mic Only'],
          description: 'Cardioid dynamic vocal microphone tuned for low-noise live broadcasts.',
        },
        {
          id: 'prod-kb',
          source: 'shopify',
          title: 'Gather 65% Cobalt Mechanical Board',
          price: 145.0,
          currency: 'USD',
          imageUrl: '/src/assets/images/product_gaming_keyboard_1794839258672.jpg',
          url: 'https://www.shopify.com',
          stock: 6,
          variants: ['Linear Tactile · Navy', 'Silent Red · Cobalt'],
          description: 'Gasket-mounted anodized 65% board with coiled aviator cable.',
        },
      ],
      pinnedProductId: isShop ? 'prod-mug' : null,
      recentOrders: [],
      payouts: {
        enabled: true,
        paypalHandle: 'gatherstudio',
        venmoHandle: 'gather-live',
        cashappTag: 'GatherLive',
        stripeUrl: '',
      },
      activeFlashSale: isShop
        ? {
            id: `flash-init-${roomCode}`,
            productId: 'prod-mug',
            discountPct: 20,
            totalUnits: 15,
            soldUnits: 7,
            startedAt: Date.now() - 90000,
            endsAt: Date.now() + 9 * 60 * 1000,
            tagline: 'TV FLASH DROP · VOLUME BUNDLE PRICING',
            bundles: buildFlashBundles(20),
            active: true,
          }
        : null,
      latestSalePopup: null,
    },
    gamer: {
      gameTitle: 'Valorant · Ranked Co-Stream',
      modeOrRank: 'Ascendant II · NA West',
      seriesScore: 'BO3 · 1–0',
      currentMap: 'Ascent',
      lobbyCode: `GTH-${roomCode}`,
      gearSpecs: [
        { id: 'gear-1', category: 'Mic', label: 'Primary Voice', value: 'Studio Dynamic XLR', productId: 'prod-mic' },
        { id: 'gear-2', category: 'Board', label: 'Keyboard', value: 'Gather 65% Cobalt', productId: 'prod-kb' },
        { id: 'gear-3', category: 'Display', label: 'Capture', value: '1440p 120Hz Low-Latency' },
      ],
      activePoll: isGamer
        ? {
            id: 'poll-demo',
            question: 'Next map challenge?',
            options: [
              { id: 'opt-1', label: 'Ascent · Sheriff Only', votes: 18 },
              { id: 'opt-2', label: 'Bind · Rush A Site', votes: 11 },
            ],
            isOpen: true,
            showOnStage: true,
            createdAt: Date.now(),
          }
        : isViewerDemo
        ? {
            id: 'poll-talk',
            question: 'Which segment should we dive deeper into next?',
            options: [
              { id: 'opt-a', label: 'WebRTC Sub-Second Audio Bus', votes: 24 },
              { id: 'opt-b', label: '0%-Fee Direct Creator Tipping', votes: 31 },
            ],
            isOpen: true,
            showOnStage: false,
            createdAt: Date.now(),
          }
        : null,
      clips: isViewerDemo
        ? [
            {
              id: 'clip-demo-1',
              label: isGamer ? '4K Clutch on Ascent B' : 'Live Architecture Breakdown',
              timestampSec: 142,
              createdBy: 'Maya Chen',
              createdAt: Date.now() - 180000,
            },
            {
              id: 'clip-demo-2',
              label: isGamer ? 'Wallbang Operator Pick · Mid' : 'Zero-Fee Creator Payouts Demo',
              timestampSec: 255,
              createdBy: 'Jordan Lee',
              createdAt: Date.now() - 60000,
            },
          ]
        : [],
      hypeCount: isViewerDemo ? 128 : isGamer ? 24 : 0,
      slowModeSec: 0,
    },
    rundown: {
      steps: [
        {
          id: 'step-1',
          title: 'Cold Open & Guest Intros',
          durationMin: 4,
          sceneId: 'duo',
          bannerTitle: 'Welcome to Gather Live',
          bannerSub: 'Say hello in Watch Chat — show begins now',
          completed: true,
        },
        {
          id: 'step-2',
          title: isShop ? 'Featured Drop Walkthrough' : 'Deep Dive & Live Demo',
          durationMin: 10,
          sceneId: 'spotlight',
          bannerTitle: isShop ? 'Live Drop: Cobalt Pour-Over Mug' : 'Zero-Fee Studio Walkthrough',
          bannerSub: isShop
            ? 'Tap Express Checkout right inside the Watch Page'
            : 'Drop your questions in the Audience Q&A tab',
          productId: isShop ? 'prod-mug' : undefined,
          completed: false,
        },
        {
          id: 'step-3',
          title: 'Upvoted Audience Q&A & Closing',
          durationMin: 8,
          sceneId: 'screen-cam',
          bannerTitle: 'Live Audience Q&A',
          bannerSub: 'Featuring top-voted questions directly on stage',
          completed: false,
        },
      ],
      activeStepId: 'step-2',
    },
    chatMessages: [
      {
        id: `host-${roomCode}-welcome`,
        author: isViewerDemo ? 'Maya Chen' : hostName || 'Studio',
        avatarUrl: isViewerDemo ? '/src/assets/images/host_maya_studio_1794840297410.jpg' : undefined,
        role: isViewerDemo ? 'host' : 'system',
        source: 'studio',
        text: isViewerDemo
          ? isGamer
            ? 'Welcome in! Vote in the prediction poll or drop your tag for next lobby.'
            : isShop
            ? 'Welcome to the live drop! Claim a piece from the lookbook or tap $ Support in the composer.'
            : 'Welcome to the broadcast! Upvote questions in Q&A or tap $ Support in the composer.'
          : `Studio ${roomCode} initialized by ${hostName}. Share the invite or Watch Link when ready.`,
        timestamp: Date.now() - 90000,
        likes: isViewerDemo ? 6 : 0,
        likedBy: [],
        reactions: isViewerDemo ? { '❤️': ['v1', 'v2'], '🔥': ['v3'] } : {},
      },
      ...(isViewerDemo
        ? [
            {
              id: 'sc-demo-1',
              author: 'Devon R.',
              role: 'superchat' as const,
              source: 'watch' as const,
              text: isGamer
                ? 'Run Sheriff-only on Ascent! Huge clutch earlier.'
                : isShop
                ? 'Grabbed the 16oz Cobalt Drip mug — love the live glaze demo!'
                : 'Switched our weekly podcast from StreamYard to Gather — zero fees is insane!',
              timestamp: Date.now() - 48000,
              likes: 4,
              likedBy: [],
              superChat: {
                amount: 25,
                method: 'card' as const,
                tier: 'amber' as const,
              },
            },
            {
              id: 'reply-demo-1',
              author: 'Jordan Lee',
              avatarUrl: '/src/assets/images/host_jordan_studio_1794840296850.jpg',
              role: 'guest' as const,
              source: 'studio' as const,
              text: isGamer
                ? 'Locked in — Sheriff round coming right after this buy phase.'
                : isShop
                ? 'Appreciate you Devon! Packaging batch #07 live on camera next.'
                : 'Wait until you hear the uncompressed isolated WAV stem export too.',
              timestamp: Date.now() - 25000,
              replyTo: {
                id: 'sc-demo-1',
                author: 'Devon R.',
                text: isGamer
                  ? 'Run Sheriff-only on Ascent! Huge clutch earlier.'
                  : isShop
                  ? 'Grabbed the 16oz Cobalt Drip mug — love the live glaze demo!'
                  : 'Switched our weekly podcast from StreamYard to Gather — zero fees is insane!',
              },
              likes: 3,
              likedBy: [],
            },
          ]
        : []),
    ],
    pinnedChatId: null,
    blockedUsers: [],
    handRaiseQueue:
      isViewerDemo && !isShop
        ? [
            {
              id: 'hr-demo-1',
              name: 'Samira K.',
              initials: 'SK',
              topic: 'How are you routing DAW stingers + podcast WAV in real time?',
              raisedAt: Date.now() - 70000,
            },
          ]
        : [],
    hypeTrain: {
      active: isViewerDemo,
      level: isViewerDemo ? 2 : 1,
      points: isViewerDemo ? 68 : 0,
      goalPoints: isViewerDemo ? 135 : 100,
      endsAt: isViewerDemo ? Date.now() + 165000 : 0,
      lastContributor: isViewerDemo ? 'Devon R.' : undefined,
      lastReason: isViewerDemo ? '$25 Super Chat' : undefined,
    },
    upcomingStream: {
      title: isShop
        ? 'Friday Ceramics & Synth Hardware Flash Show'
        : 'Next Live Episode · Creator Town Hall & Q&A',
      scheduledIso: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      description: 'Subscribe with 1 click to get an email reminder 15 minutes before we go live.',
      hostName: isViewerDemo ? 'Maya Chen' : hostName || 'Gather Host',
    },
  };
}

export function hydrateRoomSnapshot(room: ServerRoomState, snapshot: Record<string, unknown>) {
  if (typeof snapshot.title === 'string' && snapshot.title.trim()) {
    room.title = snapshot.title.trim().slice(0, 80);
  }
  if (snapshot.aspectRatio === '16:9' || snapshot.aspectRatio === '9:16') {
    room.aspectRatio = snapshot.aspectRatio;
  }
  if (
    snapshot.watchMode === 'standard' ||
    snapshot.watchMode === 'shop' ||
    snapshot.watchMode === 'gamer'
  ) {
    room.watchMode = snapshot.watchMode;
  }
  if (snapshot.scene && typeof snapshot.scene === 'object') {
    room.scene = { ...room.scene, ...(snapshot.scene as Partial<ServerRoomState['scene']>) };
  }
  if (snapshot.overlays && typeof snapshot.overlays === 'object') {
    const ov = snapshot.overlays as Partial<ServerRoomState['overlays']>;
    room.overlays = {
      ...room.overlays,
      ...ov,
      banner: ov.banner ? { ...room.overlays.banner, ...ov.banner } : room.overlays.banner,
      ticker: ov.ticker ? { ...room.overlays.ticker, ...ov.ticker } : room.overlays.ticker,
    };
  }
  if (snapshot.brand && typeof snapshot.brand === 'object') {
    room.brand = { ...room.brand, ...(snapshot.brand as Record<string, unknown>) };
  }
  if (snapshot.commerce && typeof snapshot.commerce === 'object') {
    room.commerce = {
      ...room.commerce,
      ...(snapshot.commerce as Partial<ServerRoomState['commerce']>),
    };
  }
  if (snapshot.gamer && typeof snapshot.gamer === 'object') {
    room.gamer = { ...room.gamer, ...(snapshot.gamer as Partial<ServerRoomState['gamer']>) };
  }
  if (snapshot.rundown && typeof snapshot.rundown === 'object') {
    room.rundown = {
      ...room.rundown,
      ...(snapshot.rundown as Partial<ServerRoomState['rundown']>),
    };
  }
  if (snapshot.upcomingStream && typeof snapshot.upcomingStream === 'object') {
    room.upcomingStream = snapshot.upcomingStream as ServerRoomState['upcomingStream'];
  }
}

export function broadcastRoomState(roomCode: string) {
  const room = rooms.get(roomCode);
  const clients = roomSockets.get(roomCode);
  if (!room || !clients) return;

  const demoWatchers = (room.watchers || []).filter((w) => w.id.startsWith('demo-'));
  const liveWatchers: ServerRoomState['watchers'] = [...demoWatchers];
  let viewers = demoWatchers.length;
  for (const meta of clients.values()) {
    if (meta.role === 'viewer') {
      viewers++;
      liveWatchers.push({
        id: meta.clientId,
        name: meta.name || 'Viewer',
        initials: getInitials(meta.name || 'Viewer'),
        avatarUrl: meta.avatarUrl,
        uid: meta.verifiedUid,
        inWatchParty: meta.inWatchParty !== false,
        joinedAt: meta.joinedAt || Date.now(),
      });
    }
  }
  room.watchers = liveWatchers;
  room.viewerCount = viewers;

  if (room.commerce.activeFlashSale?.active && room.commerce.activeFlashSale.endsAt <= Date.now()) {
    room.commerce.activeFlashSale.active = false;
  }
  if (room.hypeTrain?.active && room.hypeTrain.endsAt <= Date.now()) {
    room.hypeTrain.active = false;
  }

  const payload = JSON.stringify({ type: 'room:state', state: room });
  for (const meta of clients.values()) {
    if (meta.ws.readyState === WebSocket.OPEN) {
      meta.ws.send(payload);
    }
  }
}

export function sendToClient(roomCode: string, targetId: string, payload: unknown) {
  const clients = roomSockets.get(roomCode);
  const target = clients?.get(targetId);
  if (target && target.ws.readyState === WebSocket.OPEN) {
    target.ws.send(JSON.stringify(payload));
  }
}
