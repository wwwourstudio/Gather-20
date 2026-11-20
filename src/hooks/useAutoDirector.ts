import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AIProducerAction,
  AudioChannelState,
  MediaAsset,
  RoomState,
} from '../types/studio';

export type AutoDirectorSensitivity = 'copilot' | 'balanced' | 'fast';

export interface AutoDirectorLogEntry {
  id: string;
  timestamp: number;
  reason: string;
  confidence: number;
  actions: AIProducerAction[];
  status: 'applied' | 'suggested' | 'undone' | 'dismissed';
}

interface UseAutoDirectorOptions {
  enabled: boolean;
  sensitivity: AutoDirectorSensitivity;
  room: RoomState;
  isHost: boolean;
  audioChannels: AudioChannelState[];
  activeMedia: MediaAsset | null;
  hasScreenShare: boolean;
  onApplyActions: (actions: AIProducerAction[]) => void;
  onUndoLast?: () => void;
  onNotify: (msg: string) => void;
}

export function useAutoDirector({
  enabled,
  sensitivity,
  room,
  isHost,
  audioChannels,
  activeMedia,
  hasScreenShare,
  onApplyActions,
  onNotify,
}: UseAutoDirectorOptions) {
  const [logs, setLogs] = useState<AutoDirectorLogEntry[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  const lastRunRef = useRef<number>(0);
  const lastSignatureRef = useRef<string>('');
  const roomRef = useRef(room);
  const channelsRef = useRef(audioChannels);
  roomRef.current = room;
  channelsRef.current = audioChannels;

  const approveSuggestion = useCallback(
    (entryId: string) => {
      setLogs((prev) =>
        prev.map((item) => {
          if (item.id !== entryId || item.status !== 'suggested') return item;
          onApplyActions(item.actions);
          onNotify(`Auto-Director applied: ${item.reason}`);
          return { ...item, status: 'applied' };
        })
      );
    },
    [onApplyActions, onNotify]
  );

  const dismissSuggestion = useCallback((entryId: string) => {
    setLogs((prev) =>
      prev.map((item) => (item.id === entryId ? { ...item, status: 'dismissed' } : item))
    );
  }, []);

  const runDirectorCycle = useCallback(async () => {
    if (!enabled || !isHost) return;
    const now = Date.now();
    const cooldownMs = sensitivity === 'fast' ? 9000 : sensitivity === 'balanced' ? 15000 : 18000;
    if (now - lastRunRef.current < cooldownMs) return;

    const currentRoom = roomRef.current;
    const recentMsgs = currentRoom.chatMessages.slice(-4).map((m) => `${m.author}: ${m.text}`);
    const caption = currentRoom.overlays.captionText || '';
    const activeChannels = channelsRef.current
      .filter((c) => !c.muted && c.level > 0.06)
      .map((c) => `${c.label}:${Math.round(c.level * 100)}`)
      .join(',');

    const signature = `${currentRoom.scene.templateId}|${caption.slice(-60)}|${recentMsgs.join(';')}|${hasScreenShare}|${activeMedia?.id || ''}|${activeChannels}`;
    if (signature === lastSignatureRef.current) return;

    lastRunRef.current = now;
    lastSignatureRef.current = signature;
    setAnalyzing(true);

    try {
      const resp = await fetch('/api/ai/auto-director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sensitivity,
          currentTemplateId: currentRoom.scene.templateId,
          watchMode: currentRoom.watchMode,
          bannerVisible: currentRoom.overlays.banner.visible,
          bannerTitle: currentRoom.overlays.banner.title,
          captionText: caption.slice(-240),
          recentChat: recentMsgs,
          hasScreenShare,
          hasActiveMedia: Boolean(activeMedia),
          activeMediaKind: activeMedia?.kind || null,
          pinnedProductId: currentRoom.commerce.pinnedProductId,
          products: currentRoom.commerce.products.map((p) => ({
            id: p.id,
            title: p.title,
            price: p.price,
          })),
          activeSpeakers: channelsRef.current.map((c) => ({
            id: c.id,
            label: c.label,
            level: Number(c.level.toFixed(2)),
            muted: c.muted,
          })),
        }),
      });
      if (!resp.ok) return;
      const data = (await resp.json()) as {
        shouldAct?: boolean;
        reason?: string;
        confidence?: number;
        actions?: AIProducerAction[];
      };

      if (data.shouldAct && Array.isArray(data.actions) && data.actions.length > 0) {
        const entry: AutoDirectorLogEntry = {
          id: `ad-${Date.now().toString(36)}`,
          timestamp: Date.now(),
          reason: data.reason || 'Auto-Director editorial cue',
          confidence: data.confidence ?? 0.8,
          actions: data.actions,
          status: sensitivity === 'copilot' ? 'suggested' : 'applied',
        };
        setLogs((prev) => [entry, ...prev].slice(0, 12));
        if (sensitivity !== 'copilot') {
          onApplyActions(data.actions);
          onNotify(`Auto-Director: ${entry.reason}`);
        }
      }
    } catch {
      // ignore transient director cycle failures
    } finally {
      setAnalyzing(false);
    }
  }, [enabled, isHost, sensitivity, hasScreenShare, activeMedia, onApplyActions, onNotify]);

  useEffect(() => {
    if (!enabled || !isHost) return;
    const interval = window.setInterval(() => {
      void runDirectorCycle();
    }, 6000);
    return () => window.clearInterval(interval);
  }, [enabled, isHost, runDirectorCycle]);

  return {
    logs,
    analyzing,
    approveSuggestion,
    dismissSuggestion,
    triggerNow: runDirectorCycle,
  };
}
