import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { RoomState } from '../types/studio';

const LOCAL_PREFIX = 'gather_room_snapshot_';

export interface PersistedRoomPayload {
  title: string;
  aspectRatio: RoomState['aspectRatio'];
  watchMode: RoomState['watchMode'];
  scene: RoomState['scene'];
  overlays: RoomState['overlays'];
  brand: RoomState['brand'];
  commerce: RoomState['commerce'];
  gamer: RoomState['gamer'];
  rundown: RoomState['rundown'];
  upcomingStream: RoomState['upcomingStream'];
}

export function extractRoomSnapshot(room: RoomState): PersistedRoomPayload {
  return {
    title: room.title,
    aspectRatio: room.aspectRatio,
    watchMode: room.watchMode,
    scene: room.scene,
    overlays: {
      ...room.overlays,
      featuredChatId: null,
      featuredQuestionId: null,
    },
    brand: room.brand,
    commerce: {
      ...room.commerce,
      latestSalePopup: null,
    },
    gamer: room.gamer,
    rundown: room.rundown,
    upcomingStream: room.upcomingStream,
  };
}

function normalizeRoomCode(roomCode: string): string {
  return roomCode
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

export async function loadRoomSnapshot(roomCode: string): Promise<PersistedRoomPayload | null> {
  const code = normalizeRoomCode(roomCode);
  if (code.length < 2) return null;

  const user = auth.currentUser;
  if (user && user.emailVerified) {
    try {
      const ref = doc(db, 'rooms', code);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as { snapshotJson?: string };
        if (typeof data.snapshotJson === 'string') {
          return JSON.parse(data.snapshotJson) as PersistedRoomPayload;
        }
      }
    } catch {
      // Fall back to local snapshot if Firestore is unreachable or owned by another UID
    }
  }

  try {
    const raw = localStorage.getItem(`${LOCAL_PREFIX}${code}`);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedRoomPayload;
  } catch {
    return null;
  }
}

export async function saveRoomSnapshot(room: RoomState): Promise<void> {
  const code = normalizeRoomCode(room.roomCode);
  if (code.length < 2) return;

  const snapshot = extractRoomSnapshot(room);
  const snapshotJson = JSON.stringify(snapshot);
  if (snapshotJson.length > 175000) return;

  try {
    localStorage.setItem(`${LOCAL_PREFIX}${code}`, snapshotJson);
  } catch {
    // ignore quota exceeded
  }

  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const ref = doc(db, 'rooms', code);
  try {
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, {
        roomCode: code,
        hostUid: user.uid,
        title: (room.title || 'Gather Studio').slice(0, 80),
        aspectRatio: room.aspectRatio,
        watchMode: room.watchMode,
        snapshotJson,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (existing.data()?.hostUid === user.uid) {
      await setDoc(
        ref,
        {
          title: (room.title || 'Gather Studio').slice(0, 80),
          aspectRatio: room.aspectRatio,
          watchMode: room.watchMode,
          snapshotJson,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `rooms/${code}`);
  }
}
