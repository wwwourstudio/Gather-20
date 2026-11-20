import http from 'http';
import { WebSocketServer } from 'ws';
import { verifyFirebaseIdToken } from '../auth.js';
import {
  advanceHypeTrain,
  broadcastRoomState,
  buildFlashBundles,
  createDefaultRoom,
  getInitials,
  hydrateRoomSnapshot,
  rooms,
  roomSockets,
  sendToClient,
} from '../roomStore.js';
import {
  ClientMeta,
  roomHydrateSchema,
  roomJoinSchema,
  ServerRoomState,
} from '../types.js';

function isAuthorizedHost(
  room: ServerRoomState,
  meta: ClientMeta | undefined,
  clientId: string
): boolean {
  if (!meta) return false;
  if (room.hostUid) {
    return Boolean(meta.verifiedUid && meta.verifiedUid === room.hostUid && meta.role === 'host');
  }
  return meta.role === 'host' || room.hostId === clientId;
}

export function attachWebSocketHub(server: http.Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    let joinedRoomCode: string | null = null;
    let joinedClientId: string | null = null;

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
        const type = String(msg.type || '');

        if (type === 'room:join') {
          const parsedJoin = roomJoinSchema.safeParse(msg);
          if (!parsedJoin.success) {
            ws.send(JSON.stringify({ type: 'room:error', error: 'Invalid join payload.' }));
            return;
          }
          const payload = parsedJoin.data;
          const roomCode =
            String(payload.roomCode || 'LIVE01')
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, '')
              .slice(0, 8) || 'LIVE01';
          const clientId = String(
            payload.clientId || `c-${Math.random().toString(36).slice(2, 9)}`
          );
          let role: 'host' | 'guest' | 'viewer' = payload.role || 'guest';
          const name = String(payload.name || (role === 'viewer' ? 'Viewer' : 'Guest')).slice(
            0,
            40
          );
          const avatarUrl = payload.avatarUrl;

          const verifiedIdentity = await verifyFirebaseIdToken(payload.authToken);
          const verifiedUid = verifiedIdentity?.uid;

          joinedRoomCode = roomCode;
          joinedClientId = clientId;

          let room = rooms.get(roomCode);
          if (!room) {
            const isViewerDemo =
              role === 'viewer' &&
              (roomCode === 'GAMER1' || roomCode === 'SHOP01' || roomCode === 'CAST01');
            const demoMode =
              roomCode === 'GAMER1' ? 'gamer' : roomCode === 'SHOP01' ? 'shop' : roomCode === 'CAST01' ? 'standard' : null;
            room = createDefaultRoom(
              roomCode,
              clientId,
              name,
              isViewerDemo && demoMode ? demoMode : payload.watchMode,
              isViewerDemo
            );
            if (!isViewerDemo && payload.title && payload.title.trim()) {
              room.title = payload.title.trim().slice(0, 80);
            }
            if (role === 'host') {
              if (verifiedUid) {
                room.hostUid = verifiedUid;
              } else if (payload.hostUid) {
                room.hostUid = payload.hostUid.slice(0, 128);
              }
            }
            if (payload.payouts && typeof payload.payouts === 'object') {
              const po = payload.payouts;
              room.commerce.payouts = {
                enabled: po.enabled !== false,
                paypalHandle:
                  typeof po.paypalHandle === 'string'
                    ? po.paypalHandle.slice(0, 60)
                    : room.commerce.payouts.paypalHandle,
                venmoHandle:
                  typeof po.venmoHandle === 'string'
                    ? po.venmoHandle.slice(0, 60)
                    : room.commerce.payouts.venmoHandle,
                cashappTag:
                  typeof po.cashappTag === 'string'
                    ? po.cashappTag.slice(0, 40)
                    : room.commerce.payouts.cashappTag,
                stripeUrl:
                  typeof po.stripeUrl === 'string'
                    ? po.stripeUrl.slice(0, 240)
                    : room.commerce.payouts.stripeUrl,
              };
            }
            rooms.set(roomCode, room);
          } else if (role === 'host') {
            if (room.hostUid) {
              if (verifiedUid && verifiedUid === room.hostUid) {
                room.hostId = clientId;
              } else {
                // Prevent host impersonation if the room is already owned by another verified UID
                role = 'guest';
                ws.send(
                  JSON.stringify({
                    type: 'room:auth_warning',
                    message: 'Joined as guest because this room is owned by another verified host.',
                  })
                );
              }
            } else if (verifiedUid) {
              room.hostUid = verifiedUid;
              room.hostId = clientId;
            }
          }

          if (!roomSockets.has(roomCode)) {
            roomSockets.set(roomCode, new Map());
          }
          roomSockets.get(roomCode)!.set(clientId, {
            ws,
            clientId,
            roomCode,
            role,
            name,
            avatarUrl,
            inWatchParty: payload.inWatchParty !== false,
            joinedAt: Date.now(),
            verifiedUid,
          });

          if (role === 'viewer') {
            ws.send(JSON.stringify({ type: 'room:joined', clientId, role: 'viewer' }));
            broadcastRoomState(roomCode);
            return;
          }

          const isHost = role === 'host' || room.hostId === clientId;
          if (!isHost && room.isLocked && !room.participants.some((p) => p.id === clientId)) {
            const existsLobby = room.lobby.some((l) => l.id === clientId);
            if (!existsLobby) {
              room.lobby.push({
                id: clientId,
                name,
                initials: getInitials(name),
                avatarUrl,
                requestedAt: Date.now(),
              });
            }
            ws.send(JSON.stringify({ type: 'room:knocking', clientId, roomCode }));
            broadcastRoomState(roomCode);
            return;
          }

          const existing = room.participants.find((p) => p.id === clientId);
          if (!existing && room.participants.length < 6) {
            room.participants.push({
              id: clientId,
              name,
              initials: getInitials(name),
              avatarUrl,
              role: isHost ? 'host' : 'guest',
              onStage: true,
              micOn: Boolean(payload.micOn ?? true),
              camOn: Boolean(payload.camOn ?? true),
              sharingScreen: false,
              joinedAt: Date.now(),
            });
          }

          ws.send(
            JSON.stringify({
              type: 'room:joined',
              clientId,
              role: isHost ? 'host' : 'guest',
              verifiedUid: verifiedUid || null,
            })
          );
          broadcastRoomState(roomCode);
          return;
        }

        if (!joinedRoomCode || !joinedClientId) return;
        const room = rooms.get(joinedRoomCode);
        if (!room) return;
        const clientMeta = roomSockets.get(joinedRoomCode)?.get(joinedClientId);
        const hostAllowed = isAuthorizedHost(room, clientMeta, joinedClientId);

        if (type === 'room:hydrate') {
          if (!hostAllowed) return;
          const parsed = roomHydrateSchema.safeParse(msg);
          if (!parsed.success) return;
          hydrateRoomSnapshot(room, parsed.data.snapshot);
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'room:admit') {
          if (!hostAllowed) return;
          const targetId = String(msg.targetId || '');
          const reqIdx = room.lobby.findIndex((l) => l.id === targetId);
          if (reqIdx !== -1 && room.participants.length < 6) {
            const [req] = room.lobby.splice(reqIdx, 1);
            if (!room.participants.some((p) => p.id === req.id)) {
              room.participants.push({
                id: req.id,
                name: req.name,
                initials: req.initials,
                avatarUrl: req.avatarUrl,
                role: 'guest',
                onStage: true,
                micOn: true,
                camOn: true,
                sharingScreen: false,
                joinedAt: Date.now(),
              });
            }
            sendToClient(joinedRoomCode, targetId, { type: 'room:admitted', clientId: targetId });
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'room:deny') {
          if (!hostAllowed) return;
          const targetId = String(msg.targetId || '');
          room.lobby = room.lobby.filter((l) => l.id !== targetId);
          sendToClient(joinedRoomCode, targetId, { type: 'room:denied', clientId: targetId });
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'room:kick') {
          if (!hostAllowed) return;
          const targetId = String(msg.targetId || '');
          room.participants = room.participants.filter((p) => p.id !== targetId);
          sendToClient(joinedRoomCode, targetId, { type: 'room:kicked' });
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'watcher:update') {
          if (!clientMeta) return;
          if (typeof msg.name === 'string' && msg.name.trim()) {
            clientMeta.name = msg.name.trim().slice(0, 40);
          }
          if (typeof msg.avatarUrl === 'string') {
            clientMeta.avatarUrl = msg.avatarUrl.slice(0, 400);
          }
          if (typeof msg.inWatchParty === 'boolean') {
            clientMeta.inWatchParty = msg.inWatchParty;
          }
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'watcher:promote') {
          if (!hostAllowed) return;
          const targetId = String(msg.watcherId || '');
          const clients = roomSockets.get(joinedRoomCode);
          const targetMeta = clients?.get(targetId);
          const watcherInfo = (room.watchers || []).find((w) => w.id === targetId);
          const wName = targetMeta?.name || watcherInfo?.name || 'Viewer';
          if (room.participants.length < 6 && !room.participants.some((p) => p.id === targetId)) {
            room.participants.push({
              id: targetId,
              name: wName,
              initials: getInitials(wName),
              avatarUrl: targetMeta?.avatarUrl || watcherInfo?.avatarUrl,
              role: 'guest',
              onStage: true,
              micOn: true,
              camOn: false,
              sharingScreen: false,
              joinedAt: Date.now(),
            });
          }
          sendToClient(joinedRoomCode, targetId, {
            type: 'stage:promoted',
            roomCode: joinedRoomCode,
          });
          room.chatMessages = [
            ...room.chatMessages.slice(-99),
            {
              id: `msg-wp-${Date.now()}`,
              author: 'Watch Party',
              role: 'system',
              source: 'studio',
              text: `${wName} was invited from the Watch Party onto the live stage.`,
              timestamp: Date.now(),
            },
          ];
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'watcher:kick') {
          if (!hostAllowed) return;
          const targetId = String(msg.watcherId || '');
          const clients = roomSockets.get(joinedRoomCode);
          const targetMeta = clients?.get(targetId);
          if (targetMeta) {
            sendToClient(joinedRoomCode, targetId, { type: 'room:kicked' });
            clients?.delete(targetId);
            try {
              targetMeta.ws.close();
            } catch {
              // ignore
            }
          } else {
            room.watchers = (room.watchers || []).filter((w) => w.id !== targetId);
          }
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'room:update_participant') {
          const targetId = String(msg.targetId || joinedClientId);
          if (targetId !== joinedClientId && !hostAllowed) return;
          const patch = (msg.patch as Record<string, unknown>) || {};
          const p = room.participants.find((item) => item.id === targetId);
          if (p) {
            if (typeof patch.name === 'string') {
              p.name = patch.name.slice(0, 40);
              p.initials = getInitials(p.name);
            }
            if (typeof patch.onStage === 'boolean' && hostAllowed) p.onStage = patch.onStage;
            if (typeof patch.micOn === 'boolean') p.micOn = patch.micOn;
            if (typeof patch.camOn === 'boolean') p.camOn = patch.camOn;
            if (typeof patch.sharingScreen === 'boolean') p.sharingScreen = patch.sharingScreen;
            if (typeof patch.mutedByHost === 'boolean' && hostAllowed) {
              p.mutedByHost = patch.mutedByHost;
              if (patch.mutedByHost) p.micOn = false;
            }
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'room:state_patch') {
          if (!hostAllowed) return;
          const patch = (msg.patch as Partial<ServerRoomState>) || {};
          if (typeof patch.title === 'string') room.title = patch.title.slice(0, 80);
          if (typeof patch.isLocked === 'boolean') room.isLocked = patch.isLocked;
          if (typeof patch.isLive === 'boolean') {
            room.isLive = patch.isLive;
            room.liveStartedAt = patch.isLive ? room.liveStartedAt ?? Date.now() : null;
          }
          if (patch.aspectRatio === '16:9' || patch.aspectRatio === '9:16') {
            room.aspectRatio = patch.aspectRatio;
          }
          if (
            patch.watchMode === 'standard' ||
            patch.watchMode === 'shop' ||
            patch.watchMode === 'gamer'
          ) {
            room.watchMode = patch.watchMode;
          }
          if (patch.scene) {
            room.scene = { ...room.scene, ...patch.scene };
          }
          if (patch.overlays) {
            room.overlays = {
              ...room.overlays,
              ...patch.overlays,
              banner: patch.overlays.banner
                ? { ...room.overlays.banner, ...patch.overlays.banner }
                : room.overlays.banner,
              ticker: patch.overlays.ticker
                ? { ...room.overlays.ticker, ...patch.overlays.ticker }
                : room.overlays.ticker,
            };
          }
          if (patch.brand) {
            room.brand = { ...room.brand, ...patch.brand };
          }
          if (patch.gamer) {
            room.gamer = { ...room.gamer, ...patch.gamer };
          }
          if (patch.rundown) {
            room.rundown = { ...room.rundown, ...patch.rundown };
          }
          if (patch.commerce) {
            room.commerce = { ...room.commerce, ...patch.commerce };
          }
          if ('upcomingStream' in patch) {
            room.upcomingStream = patch.upcomingStream ?? null;
          }
          if (typeof patch.hostUid === 'string' && clientMeta?.verifiedUid) {
            room.hostUid = clientMeta.verifiedUid;
          }
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'chat:send') {
          const text = String(msg.text || '').trim().slice(0, 400);
          if (!text) return;
          const author = String(msg.author || clientMeta?.name || 'Guest').slice(0, 40);
          const authorUid =
            clientMeta?.verifiedUid ||
            (typeof msg.authorUid === 'string' ? msg.authorUid.slice(0, 128) : undefined);
          const blocked = (room.blockedUsers || []).some(
            (b) =>
              (authorUid && b.uid && b.uid === authorUid) ||
              b.author.toLowerCase() === author.toLowerCase()
          );
          if (blocked) {
            sendToClient(joinedRoomCode, joinedClientId, {
              type: 'chat:blocked_notice',
              message: 'You have been blocked from posting in this room.',
            });
            return;
          }
          const avatarUrl = typeof msg.avatarUrl === 'string' ? msg.avatarUrl.slice(0, 500) : undefined;
          const rawReply = msg.replyTo as Record<string, unknown> | undefined;
          const replyTo =
            rawReply && typeof rawReply.id === 'string' && typeof rawReply.author === 'string'
              ? {
                  id: String(rawReply.id).slice(0, 80),
                  author: String(rawReply.author).slice(0, 40),
                  text: String(rawReply.text || '').slice(0, 140),
                }
              : undefined;
          const requestedRole = msg.role as ServerRoomState['chatMessages'][0]['role'];
          const safeRole: ServerRoomState['chatMessages'][0]['role'] =
            requestedRole === 'payment-card' && hostAllowed
              ? 'payment-card'
              : requestedRole === 'system' && hostAllowed
              ? 'system'
              : clientMeta?.role ?? 'viewer';

          const paymentCard =
            safeRole === 'payment-card' && msg.paymentCard && typeof msg.paymentCard === 'object'
              ? (msg.paymentCard as ServerRoomState['chatMessages'][0]['paymentCard'])
              : undefined;

          const requestedSource = msg.source;
          const safeSource: ServerRoomState['chatMessages'][0]['source'] =
            requestedSource === 'studio' ||
            requestedSource === 'watch' ||
            requestedSource === 'youtube' ||
            requestedSource === 'twitch'
              ? requestedSource
              : clientMeta?.role === 'viewer'
              ? 'watch'
              : 'studio';

          const safeAudience: 'public' | 'studio' =
            msg.audience === 'studio' && clientMeta?.role !== 'viewer' ? 'studio' : 'public';

          const chatMsg: ServerRoomState['chatMessages'][0] = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            author,
            authorUid,
            avatarUrl,
            role: safeRole,
            source: safeSource,
            audience: safeAudience,
            text,
            timestamp: Date.now(),
            replyTo,
            likes: 0,
            likedBy: [],
            reactions: {},
            ...(paymentCard ? { paymentCard } : {}),
          };
          room.chatMessages = [...room.chatMessages.slice(-99), chatMsg];
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'chat:share_public') {
          if (!hostAllowed && clientMeta?.role !== 'guest') return;
          const messageId = String(msg.messageId || '');
          const target = room.chatMessages.find((m) => m.id === messageId);
          if (target) {
            target.audience = 'public';
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'chat:toggle_reaction') {
          const messageId = String(msg.messageId || '');
          const rawEmoji = String(msg.emoji || '').trim();
          const allowedEmojis = new Set(['❤️', '🔥', '😮', '👏', '😂']);
          if (!messageId || !allowedEmojis.has(rawEmoji)) return;
          const actorId = String(msg.actorId || joinedClientId).slice(0, 128);
          const target = room.chatMessages.find((m) => m.id === messageId);
          if (target) {
            const nextReactions: Record<string, string[]> = { ...(target.reactions || {}) };
            const currentList = Array.isArray(nextReactions[rawEmoji])
              ? [...nextReactions[rawEmoji]]
              : [];
            const idx = currentList.indexOf(actorId);
            if (idx >= 0) {
              currentList.splice(idx, 1);
            } else if (currentList.length < 200) {
              currentList.push(actorId);
            }
            if (currentList.length > 0) {
              nextReactions[rawEmoji] = currentList;
            } else {
              delete nextReactions[rawEmoji];
            }
            target.reactions = nextReactions;
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'chat:toggle_like') {
          const messageId = String(msg.messageId || '');
          const actorId = String(msg.actorId || joinedClientId).slice(0, 128);
          const target = room.chatMessages.find((m) => m.id === messageId);
          if (target) {
            const list = Array.isArray(target.likedBy) ? [...target.likedBy] : [];
            const idx = list.indexOf(actorId);
            if (idx >= 0) {
              list.splice(idx, 1);
            } else {
              list.push(actorId);
            }
            target.likedBy = list;
            target.likes = list.length;
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'chat:pin') {
          if (!hostAllowed) return;
          const messageId = typeof msg.messageId === 'string' && msg.messageId ? msg.messageId : null;
          if (messageId && !room.chatMessages.some((m) => m.id === messageId)) return;
          room.pinnedChatId = room.pinnedChatId === messageId ? null : messageId;
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'chat:delete') {
          if (!hostAllowed) return;
          const messageId = String(msg.messageId || '');
          if (!messageId) return;
          room.chatMessages = room.chatMessages.filter((m) => m.id !== messageId);
          if (room.pinnedChatId === messageId) room.pinnedChatId = null;
          if (room.overlays.featuredChatId === messageId) room.overlays.featuredChatId = null;
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'chat:block_user') {
          if (!hostAllowed) return;
          const author = String(msg.author || '').trim().slice(0, 40);
          const uid =
            typeof msg.uid === 'string' && msg.uid.trim() ? msg.uid.trim().slice(0, 128) : undefined;
          if (!author && !uid) return;
          const existing = room.blockedUsers || [];
          const already = existing.some(
            (b) => (uid && b.uid === uid) || (author && b.author.toLowerCase() === author.toLowerCase())
          );
          if (!already) {
            room.blockedUsers = [
              ...existing,
              {
                id: `blk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
                author: author || 'User',
                uid,
                blockedAt: Date.now(),
              },
            ].slice(-50);
          }
          const purgedIds = new Set(
            room.chatMessages
              .filter(
                (m) =>
                  (uid && m.authorUid === uid) ||
                  (author && m.author.toLowerCase() === author.toLowerCase())
              )
              .map((m) => m.id)
          );
          room.chatMessages = room.chatMessages.filter((m) => !purgedIds.has(m.id));
          if (room.pinnedChatId && purgedIds.has(room.pinnedChatId)) room.pinnedChatId = null;
          if (room.overlays.featuredChatId && purgedIds.has(room.overlays.featuredChatId)) {
            room.overlays.featuredChatId = null;
          }
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'chat:unblock_user') {
          if (!hostAllowed) return;
          const blockId = String(msg.blockId || '');
          room.blockedUsers = (room.blockedUsers || []).filter((b) => b.id !== blockId);
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'scene:save_preset') {
          if (!hostAllowed) return;
          const rawPreset = msg.preset as Record<string, unknown> | undefined;
          if (!rawPreset || typeof rawPreset.id !== 'string' || typeof rawPreset.name !== 'string')
            return;
          const cleanName = rawPreset.name.trim().slice(0, 36);
          if (!cleanName) return;
          const preset = {
            ...rawPreset,
            id: rawPreset.id.slice(0, 80),
            name: cleanName,
            aspect: rawPreset.aspect === '9:16' ? ('9:16' as const) : ('16:9' as const),
            elements: Array.isArray(rawPreset.elements) ? rawPreset.elements.slice(0, 12) : [],
          };
          const prev = room.scene.savedPresets || [];
          const next = [preset, ...prev.filter((p) => p.id !== preset.id)].slice(0, 16);
          room.scene.savedPresets = next;
          room.scene.templateId = preset.id;
          room.scene.customElements = preset.elements;
          room.aspectRatio = preset.aspect;
          if (typeof rawPreset.backdrop === 'string') {
            room.brand.backdrop = rawPreset.backdrop;
          }
          if (typeof rawPreset.bannerTitle === 'string') {
            room.overlays.banner = {
              visible: Boolean(rawPreset.bannerVisible),
              title: String(rawPreset.bannerTitle).slice(0, 80),
              subtitle: String(rawPreset.bannerSubtitle || '').slice(0, 120),
              style: String(rawPreset.bannerStyle || 'glass'),
            };
          }
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'scene:apply_preset') {
          if (!hostAllowed) return;
          const presetId = String(msg.presetId || '');
          const preset = (room.scene.savedPresets || []).find((p) => p.id === presetId);
          if (!preset) return;
          room.scene.templateId = String(preset.id);
          room.scene.customElements = Array.isArray(preset.elements) ? preset.elements : [];
          if (preset.aspect === '9:16' || preset.aspect === '16:9') {
            room.aspectRatio = preset.aspect;
          }
          if (typeof preset.backdrop === 'string') {
            room.brand.backdrop = preset.backdrop;
          }
          if (typeof preset.bannerTitle === 'string') {
            room.overlays.banner = {
              visible: Boolean(preset.bannerVisible),
              title: String(preset.bannerTitle).slice(0, 80),
              subtitle: String(preset.bannerSubtitle || '').slice(0, 120),
              style: String(preset.bannerStyle || 'glass'),
            };
          }
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'scene:delete_preset') {
          if (!hostAllowed) return;
          const presetId = String(msg.presetId || '');
          room.scene.savedPresets = (room.scene.savedPresets || []).filter((p) => p.id !== presetId);
          if (room.scene.templateId === presetId) {
            room.scene.templateId = room.aspectRatio === '9:16' ? 'v-solo' : 'solo';
            room.scene.customElements = [];
          }
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'superchat:send') {
          const amount = Math.max(1, Math.min(500, Math.round(Number(msg.amount || 5))));
          const rawMethod = String(msg.method || 'card');
          const method: 'card' | 'paypal' | 'venmo' | 'cashapp' | 'stripe' =
            rawMethod === 'card' ||
            rawMethod === 'venmo' ||
            rawMethod === 'cashapp' ||
            rawMethod === 'stripe'
              ? rawMethod
              : 'paypal';
          const tier: 'blue' | 'emerald' | 'amber' | 'rose' =
            amount >= 50 ? 'rose' : amount >= 25 ? 'amber' : amount >= 10 ? 'emerald' : 'blue';
          const text =
            String(msg.text || '').trim().slice(0, 280) || `Sent a $${amount} Direct Tip!`;
          const author = String(msg.author || 'Viewer').trim().slice(0, 40) || 'Viewer';
          const avatarUrl = typeof msg.avatarUrl === 'string' ? msg.avatarUrl.slice(0, 500) : undefined;
          const scMsg = {
            id: `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            author,
            avatarUrl,
            role: 'superchat' as const,
            source: 'watch' as const,
            text,
            timestamp: Date.now(),
            likes: 0,
            likedBy: [],
            superChat: { amount, method, tier },
          };
          room.chatMessages = [...room.chatMessages.slice(-99), scMsg];
          room.gamer.hypeCount += Math.max(1, Math.floor(amount / 5));
          advanceHypeTrain(room, Math.max(15, amount * 2), author, `$${amount} Super Chat`);
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'qa:ask') {
          const text = String(msg.text || '').trim().slice(0, 220);
          const author = String(msg.author || 'Viewer').trim().slice(0, 40) || 'Viewer';
          if (text) {
            room.questions = [
              {
                id: `qa-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                author,
                text,
                upvotes: 1,
                answered: false,
                createdAt: Date.now(),
              },
              ...(room.questions || []).slice(0, 29),
            ];
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'qa:upvote') {
          const questionId = String(msg.questionId || '');
          const q = (room.questions || []).find((item) => item.id === questionId);
          if (q) {
            q.upvotes += 1;
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'qa:answer') {
          if (!hostAllowed) return;
          const questionId = String(msg.questionId || '');
          const q = (room.questions || []).find((item) => item.id === questionId);
          if (q) {
            q.answered = !q.answered;
            if (q.answered && room.overlays.featuredQuestionId === questionId) {
              room.overlays.featuredQuestionId = null;
            }
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'commerce:pin') {
          if (!hostAllowed) return;
          room.commerce.pinnedProductId = typeof msg.productId === 'string' ? msg.productId : null;
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'commerce:flash_start') {
          if (!hostAllowed) return;
          const productId = String(msg.productId || room.commerce.products[0]?.id || '');
          const prod = room.commerce.products.find((p) => p.id === productId);
          if (!prod) return;
          const discountPct = Math.max(5, Math.min(75, Math.round(Number(msg.discountPct || 20))));
          const totalUnits = Math.max(
            2,
            Math.min(200, Math.round(Number(msg.totalUnits || Math.max(5, prod.stock))))
          );
          const durationMin = Math.max(1, Math.min(60, Math.round(Number(msg.durationMin || 5))));
          const tagline =
            String(msg.tagline || 'LIVE TV FLASH SALE · VOLUME BUNDLE DISCOUNTS')
              .trim()
              .slice(0, 64) || 'LIVE TV FLASH SALE';
          room.commerce.activeFlashSale = {
            id: `flash-${Date.now().toString(36)}`,
            productId: prod.id,
            discountPct,
            totalUnits,
            soldUnits: 0,
            startedAt: Date.now(),
            endsAt: Date.now() + durationMin * 60 * 1000,
            tagline,
            bundles: buildFlashBundles(discountPct),
            active: true,
          };
          room.commerce.pinnedProductId = prod.id;
          room.watchMode = 'shop';
          room.chatMessages = [
            ...room.chatMessages.slice(-99),
            {
              id: `msg-flash-${Date.now()}`,
              author: 'Flash Drop',
              role: 'system',
              source: 'studio',
              text: `⚡ FLASH SALE LIVE: ${prod.title} — Up to ${Math.min(75, discountPct + 18)}% OFF volume bundles · Strictly ${totalUnits} units for ${durationMin}m!`,
              timestamp: Date.now(),
            },
          ];
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'commerce:flash_stop') {
          if (!hostAllowed) return;
          if (room.commerce.activeFlashSale) {
            room.commerce.activeFlashSale.active = false;
            room.commerce.activeFlashSale = null;
          }
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'commerce:order') {
          const buyerName =
            String(msg.buyerName || 'Watch Viewer').trim().slice(0, 40) || 'Watch Viewer';
          const buyerCity = String(msg.buyerCity || 'Austin, TX').trim().slice(0, 40) || 'Austin, TX';
          const paymentMethod = String(msg.paymentMethod || 'Express Pay').trim().slice(0, 30);
          const rawItems = Array.isArray(msg.items)
            ? (msg.items as Array<Record<string, unknown>>)
            : [
                {
                  productId: msg.productId,
                  quantity: msg.quantity,
                  variant: msg.variant,
                  bundleLabel: msg.bundleLabel,
                },
              ];

          let grandTotal = 0;
          let totalSavings = 0;
          let totalUnitsBought = 0;
          let primaryTitle = '';
          let primaryImage = '';
          let primarySource: 'shopify' | 'etsy' | 'custom' = 'shopify';
          let primaryRemaining = 0;
          let appliedBundleLabel = '';
          const orderNumber = `GTH-${Math.floor(1000 + Math.random() * 9000)}`;

          for (const rawItem of rawItems) {
            const productId = String(rawItem.productId || '');
            const qty = Math.max(1, Math.min(10, Math.round(Number(rawItem.quantity || 1))));
            const variant = typeof rawItem.variant === 'string' ? rawItem.variant.slice(0, 40) : undefined;
            const prod = room.commerce.products.find((p) => p.id === productId);
            if (!prod || prod.stock < 1) continue;

            const actualQty = Math.min(qty, prod.stock);
            prod.stock -= actualQty;

            let unitPrice = prod.price;
            let itemBundleLabel =
              typeof rawItem.bundleLabel === 'string' ? rawItem.bundleLabel.slice(0, 40) : '';
            const flash = room.commerce.activeFlashSale;
            if (
              flash &&
              flash.active &&
              flash.productId === prod.id &&
              flash.endsAt > Date.now() &&
              flash.soldUnits < flash.totalUnits
            ) {
              const matchedTier =
                [...flash.bundles]
                  .sort((a, b) => b.quantity - a.quantity)
                  .find((b) => actualQty >= b.quantity) || flash.bundles[0];
              const pct = matchedTier ? matchedTier.discountPct : flash.discountPct;
              unitPrice = Number((prod.price * (1 - pct / 100)).toFixed(2));
              if (!itemBundleLabel && matchedTier) {
                itemBundleLabel = matchedTier.label;
              }
              flash.soldUnits = Math.min(flash.totalUnits, flash.soldUnits + actualQty);
              if (flash.soldUnits >= flash.totalUnits) {
                flash.active = false;
              }
            }

            const lineTotal = Number((unitPrice * actualQty).toFixed(2));
            const lineSavings = Math.max(0, Number((prod.price * actualQty - lineTotal).toFixed(2)));
            grandTotal = Number((grandTotal + lineTotal).toFixed(2));
            totalSavings = Number((totalSavings + lineSavings).toFixed(2));
            totalUnitsBought += actualQty;

            if (!primaryTitle) {
              primaryTitle = prod.title;
              primaryImage = prod.imageUrl;
              primarySource = prod.source;
              primaryRemaining =
                flash && flash.productId === prod.id
                  ? Math.max(0, flash.totalUnits - flash.soldUnits)
                  : prod.stock;
              appliedBundleLabel = itemBundleLabel;
            }

            const orderRec = {
              id: `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
              orderNumber,
              productId: prod.id,
              productTitle: prod.title,
              variant,
              quantity: actualQty,
              bundleLabel: itemBundleLabel || undefined,
              total: lineTotal,
              buyerName,
              buyerCity,
              paymentMethod,
              source: prod.source,
              createdAt: Date.now(),
            };
            room.commerce.recentOrders = [orderRec, ...room.commerce.recentOrders.slice(0, 24)];
          }

          if (totalUnitsBought > 0) {
            const summaryTitle =
              rawItems.length > 1 ? `${primaryTitle} + ${rawItems.length - 1} more` : primaryTitle;
            room.commerce.latestSalePopup = {
              id: `popup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              orderNumber,
              buyerName,
              buyerCity,
              productTitle: summaryTitle,
              productImageUrl: primaryImage,
              source: primarySource,
              quantity: totalUnitsBought,
              bundleLabel: appliedBundleLabel || undefined,
              total: grandTotal,
              savingsAmount: totalSavings > 0 ? totalSavings : undefined,
              remainingStock: primaryRemaining,
              paymentMethod,
              createdAt: Date.now(),
            };

            advanceHypeTrain(
              room,
              Math.max(20, Math.round(grandTotal / 2)),
              buyerName,
              `Order ${orderNumber}`
            );

            room.chatMessages = [
              ...room.chatMessages.slice(-99),
              {
                id: `msg-ord-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                author: buyerName,
                role: 'order',
                source: 'watch',
                text: `Ordered ${totalUnitsBought}× ${summaryTitle}${
                  appliedBundleLabel ? ` (${appliedBundleLabel})` : ''
                } from ${buyerCity} · $${grandTotal.toFixed(2)}${
                  totalSavings > 0 ? ` (Saved $${totalSavings.toFixed(2)})` : ''
                }`,
                timestamp: Date.now(),
              },
            ];
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'stage:raise_hand') {
          const handName = String(msg.name || 'Viewer').trim().slice(0, 40) || 'Viewer';
          const topic =
            String(msg.topic || 'Wants to join the live conversation')
              .trim()
              .slice(0, 100) || 'Wants to join stage';
          const uid =
            clientMeta?.verifiedUid ||
            (typeof msg.uid === 'string' ? msg.uid.slice(0, 128) : undefined);
          const avatarUrl = typeof msg.avatarUrl === 'string' ? msg.avatarUrl.slice(0, 500) : undefined;
          const existingIdx = room.handRaiseQueue.findIndex(
            (h) => (uid && h.uid === uid) || h.id === joinedClientId
          );
          if (existingIdx === -1 && room.handRaiseQueue.length < 20) {
            room.handRaiseQueue.push({
              id: joinedClientId,
              uid,
              name: handName,
              initials: getInitials(handName),
              avatarUrl,
              topic,
              raisedAt: Date.now(),
            });
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'stage:lower_hand') {
          const targetId = String(msg.handId || joinedClientId);
          if (targetId !== joinedClientId && !hostAllowed) return;
          room.handRaiseQueue = room.handRaiseQueue.filter(
            (h) => h.id !== targetId && h.uid !== targetId
          );
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'stage:promote_hand') {
          if (!hostAllowed) return;
          const handId = String(msg.handId || '');
          const idx = room.handRaiseQueue.findIndex((h) => h.id === handId);
          if (idx !== -1 && room.participants.length < 6) {
            const [hand] = room.handRaiseQueue.splice(idx, 1);
            if (!room.participants.some((p) => p.id === hand.id)) {
              room.participants.push({
                id: hand.id,
                name: hand.name,
                initials: hand.initials,
                avatarUrl: hand.avatarUrl,
                role: 'guest',
                onStage: true,
                micOn: true,
                camOn: false,
                sharingScreen: false,
                joinedAt: Date.now(),
              });
            }
            sendToClient(joinedRoomCode, hand.id, { type: 'stage:promoted', roomCode: joinedRoomCode });
            room.chatMessages = [
              ...room.chatMessages.slice(-99),
              {
                id: `msg-hand-${Date.now()}`,
                author: 'Stage Call-In',
                role: 'system',
                source: 'studio',
                text: `${hand.name} was invited onto the live broadcast stage!`,
                timestamp: Date.now(),
              },
            ];
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'gamer:poll_launch') {
          if (!hostAllowed) return;
          const question = String(msg.question || '').trim().slice(0, 140);
          const rawOptions = Array.isArray(msg.options) ? msg.options : [];
          const options = rawOptions
            .map((label, idx) => ({
              id: `opt-${idx}-${Date.now().toString(36)}`,
              label: String(label).trim().slice(0, 60),
              votes: 0,
            }))
            .filter((o) => o.label.length > 0)
            .slice(0, 4);
          if (question && options.length >= 2) {
            room.gamer.activePoll = {
              id: `poll-${Date.now().toString(36)}`,
              question,
              options,
              isOpen: true,
              showOnStage: msg.showOnStage !== false,
              createdAt: Date.now(),
            };
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'gamer:poll_vote') {
          const optionId = String(msg.optionId || '');
          const poll = room.gamer.activePoll;
          if (poll && poll.isOpen) {
            const opt = poll.options.find((o) => o.id === optionId);
            if (opt) {
              opt.votes += 1;
              broadcastRoomState(joinedRoomCode);
            }
          }
          return;
        }

        if (type === 'gamer:poll_close') {
          if (!hostAllowed) return;
          if (room.gamer.activePoll) {
            room.gamer.activePoll.isOpen = false;
            if (msg.clear) room.gamer.activePoll = null;
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'gamer:clip') {
          const label = String(msg.label || 'Highlight Moment').slice(0, 80);
          const timestampSec = Math.max(0, Number(msg.timestampSec || 0));
          const createdBy = String(msg.createdBy || 'Viewer').slice(0, 40);
          room.gamer.clips = [
            {
              id: `clip-${Date.now().toString(36)}`,
              label,
              timestampSec,
              createdBy,
              createdAt: Date.now(),
            },
            ...room.gamer.clips.slice(0, 24),
          ];
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'gamer:queue_join') {
          const handle = String(msg.handle || '').trim().slice(0, 40);
          const platform = String(msg.platform || 'PC / Crossplay').slice(0, 30);
          const role =
            typeof msg.role === 'string' && msg.role.trim() ? msg.role.trim().slice(0, 24) : undefined;
          const rank =
            typeof msg.rank === 'string' && msg.rank.trim() ? msg.rank.trim().slice(0, 24) : undefined;
          const note = typeof msg.note === 'string' ? msg.note.slice(0, 80) : undefined;
          if (handle) {
            const exists = room.squadQueue.some(
              (q) => q.handle.toLowerCase() === handle.toLowerCase()
            );
            if (!exists) {
              room.squadQueue.push({
                id: `sq-${Date.now().toString(36)}`,
                handle,
                platform,
                role,
                rank,
                note,
                joinedAt: Date.now(),
              });
              broadcastRoomState(joinedRoomCode);
            }
          }
          return;
        }

        if (type === 'gamer:queue_remove') {
          if (!hostAllowed) return;
          const queueId = String(msg.queueId || '');
          room.squadQueue = room.squadQueue.filter((q) => q.id !== queueId);
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'gamer:hype') {
          room.gamer.hypeCount += 1;
          advanceHypeTrain(room, 6, String(msg.author || 'Viewer').slice(0, 30), 'Hype Combo');
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'webrtc:signal') {
          const targetId = String(msg.targetId || '');
          if (targetId) {
            sendToClient(joinedRoomCode, targetId, {
              type: 'webrtc:signal',
              fromId: joinedClientId,
              signal: msg.signal,
            });
          } else {
            sendToClient(joinedRoomCode, room.hostId, {
              type: 'webrtc:viewer_request',
              fromId: joinedClientId,
            });
          }
          return;
        }
      } catch (err) {
        console.error('WS message error:', err);
      }
    });

    ws.on('close', () => {
      if (!joinedRoomCode || !joinedClientId) return;
      const clients = roomSockets.get(joinedRoomCode);
      if (clients) {
        clients.delete(joinedClientId);
      }
      const room = rooms.get(joinedRoomCode);
      if (room) {
        room.participants = room.participants.filter((p) => p.id !== joinedClientId);
        room.lobby = room.lobby.filter((l) => l.id !== joinedClientId);
        broadcastRoomState(joinedRoomCode);
      }
    });
  });
}
