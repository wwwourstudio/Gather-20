import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { BrandKit } from '../types/studio';

const LOCAL_KITS_KEY = 'gather:brand-kits:v1';

function clampString(val: string | undefined, max: number, fallback = ''): string {
  return String(val ?? fallback).slice(0, max);
}

function readLocalKits(): BrandKit[] {
  try {
    const raw = localStorage.getItem(LOCAL_KITS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BrandKit[]) : [];
  } catch {
    return [];
  }
}

function writeLocalKits(kits: BrandKit[]): void {
  try {
    localStorage.setItem(LOCAL_KITS_KEY, JSON.stringify(kits.slice(0, 12)));
  } catch {
    // ignore storage quota errors
  }
}

function sanitizeKitFields(kit: BrandKit) {
  const validPresets = ['dusk', 'graphite', 'ember', 'forest', 'paper'];
  const validFonts = ['Plus Jakarta Sans', 'Instrument Serif', 'JetBrains Mono', 'Oswald', 'Playfair Display'];
  const validFrames = ['none', 'rounded', 'sharp', 'floating', 'cinema'];
  const validTags = ['glass', 'solid', 'outline', 'minimal'];
  const validBanners = ['breaking', 'classic', 'minimal', 'ticker'];

  return {
    name: clampString(kit.name, 64, 'Brand Kit') || 'Brand Kit',
    niche: ['gaming', 'commerce', 'podcast', 'creator'].includes(kit.niche) ? kit.niche : 'creator',
    storeName: clampString(kit.storeName, 64, 'Gather Studio') || 'Gather Studio',
    storeTagline: clampString(kit.storeTagline, 128),
    accentHex: clampString(kit.accentHex, 16, '#3B82F6'),
    secondaryHex: clampString(kit.secondaryHex, 16, '#38BDF8'),
    backdropPreset: validPresets.includes(kit.backdropPreset) ? kit.backdropPreset : 'dusk',
    stageFont: validFonts.includes(kit.stageFont) ? kit.stageFont : 'Plus Jakarta Sans',
    frameStyle: validFrames.includes(kit.frameStyle) ? kit.frameStyle : 'rounded',
    nameTagStyle: validTags.includes(kit.nameTagStyle) ? kit.nameTagStyle : 'glass',
    bannerStyle: validBanners.includes(kit.bannerStyle) ? kit.bannerStyle : 'classic',
    bannerTitle: clampString(kit.bannerTitle, 80),
    bannerSubtitle: clampString(kit.bannerSubtitle, 120),
    logoUrl: clampString(kit.logoUrl, 48000),
    backdropUrl: clampString(kit.backdropUrl, 48000),
    overlayUrl: clampString(kit.overlayUrl, 48000),
    products: (kit.products || []).slice(0, 4).map((p, idx) => ({
      id: clampString(p.id || `prod-${idx + 1}`, 48),
      title: clampString(p.title, 72, `Product ${idx + 1}`),
      price: Math.max(0, Number(p.price || 0)),
      category: clampString(p.category, 36, 'Featured'),
      description: clampString(p.description, 220),
      variants: (p.variants || []).slice(0, 4).map((v) => clampString(v, 28)),
      imageUrl: clampString(p.imageUrl, 36000),
    })),
    updatedAt: serverTimestamp(),
  };
}

export async function loadBrandKits(): Promise<BrandKit[]> {
  const local = readLocalKits();
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return local;
  }

  try {
    const q = query(collection(db, 'brandKits'), where('ownerUid', '==', user.uid));
    const snap = await getDocs(q);
    const remote: BrandKit[] = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: String(data.id || d.id),
        ownerUid: String(data.ownerUid || user.uid),
        name: String(data.name || 'Saved Brand Kit'),
        niche: (['gaming', 'commerce', 'podcast', 'creator'].includes(String(data.niche))
          ? String(data.niche)
          : 'creator') as BrandKit['niche'],
        storeName: String(data.storeName || 'Gather Studio'),
        storeTagline: String(data.storeTagline || ''),
        accentHex: String(data.accentHex || '#3B82F6'),
        secondaryHex: String(data.secondaryHex || '#38BDF8'),
        backdropPreset: (String(data.backdropPreset || 'dusk') as BrandKit['backdropPreset']),
        stageFont: (String(data.stageFont || 'Plus Jakarta Sans') as BrandKit['stageFont']),
        frameStyle: (String(data.frameStyle || 'rounded') as BrandKit['frameStyle']),
        nameTagStyle: (String(data.nameTagStyle || 'glass') as BrandKit['nameTagStyle']),
        bannerStyle: (String(data.bannerStyle || 'classic') as BrandKit['bannerStyle']),
        bannerTitle: String(data.bannerTitle || ''),
        bannerSubtitle: String(data.bannerSubtitle || ''),
        logoUrl: String(data.logoUrl || ''),
        backdropUrl: String(data.backdropUrl || ''),
        overlayUrl: String(data.overlayUrl || ''),
        products: Array.isArray(data.products) ? (data.products as BrandKit['products']) : [],
        createdAtMs: Number(data.createdAtMs || Date.now()),
        updatedAtMs: Date.now(),
      };
    });

    const merged = [...remote];
    local.forEach((lk) => {
      if (!merged.some((rk) => rk.id === lk.id)) merged.push(lk);
    });
    merged.sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));
    writeLocalKits(merged);
    return merged;
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.LIST, 'brandKits');
    } catch {
      // Fallback safely to local kits if offline or permission pending
    }
    return local;
  }
}

export async function saveBrandKit(kit: BrandKit): Promise<BrandKit> {
  const safeId = (kit.id || `kit-${Date.now().toString(36)}`).replace(/[^A-Za-z0-9_-]/g, '');
  const normalized: BrandKit = {
    ...kit,
    id: safeId,
    updatedAtMs: Date.now(),
    createdAtMs: kit.createdAtMs || Date.now(),
  };

  const current = readLocalKits().filter((k) => k.id !== safeId);
  writeLocalKits([normalized, ...current]);

  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return normalized;
  }

  const ref = doc(db, 'brandKits', safeId);
  const fields = sanitizeKitFields(normalized);
  try {
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, {
        id: safeId,
        ownerUid: user.uid,
        ...fields,
        createdAt: serverTimestamp(),
      });
    } else if (existing.data()?.ownerUid === user.uid) {
      await setDoc(ref, fields, { merge: true });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `brandKits/${safeId}`);
  }
  return { ...normalized, ownerUid: user.uid };
}

export async function deleteBrandKit(kitId: string): Promise<void> {
  const safeId = kitId.replace(/[^A-Za-z0-9_-]/g, '');
  writeLocalKits(readLocalKits().filter((k) => k.id !== safeId));

  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  try {
    await deleteDoc(doc(db, 'brandKits', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `brandKits/${safeId}`);
  }
}
