import { useCallback, useEffect, useRef, useState } from 'react';
import { CustomScenePreset, TransitionType } from '../types/studio';
import { audioEngine, MasterBeatTelemetry } from '../utils/audioEngine';
import {
  SmartTransitionRecommendation,
  SmartTransitionSource,
} from '../utils/smartTransition';

export interface PendingBeatSyncCue {
  id: string;
  targetTemplateId: string;
  targetName: string;
  fromTemplateId: string;
  transitionType: TransitionType;
  transitionMs: number;
  recommendation: SmartTransitionRecommendation;
  source: SmartTransitionSource;
  preset?: CustomScenePreset;
  armedAt: number;
  targetFireAt: number;
}

const DEFAULT_TELEMETRY: MasterBeatTelemetry = {
  bpm: 120,
  confidence: 0,
  beatIndex: 1,
  beatProgress: 0,
  barProgress: 0,
  msUntilDownbeat: 2000,
  signalDetected: false,
  lastBeatAt: 0,
  lastDownbeatAt: 0,
  masterEnergy: 0,
};

export function useBeatSync(params: {
  enabled: boolean;
  onExecuteCue: (cue: PendingBeatSyncCue) => void;
}) {
  const { enabled, onExecuteCue } = params;
  const [telemetry, setTelemetry] = useState<MasterBeatTelemetry>(DEFAULT_TELEMETRY);
  const [pendingCue, setPendingCue] = useState<PendingBeatSyncCue | null>(null);

  const pendingRef = useRef<PendingBeatSyncCue | null>(null);
  const onExecuteRef = useRef(onExecuteCue);
  onExecuteRef.current = onExecuteCue;

  const prevBarProgressRef = useRef(0);
  const lastUiSyncRef = useRef(0);

  useEffect(() => {
    pendingRef.current = pendingCue;
  }, [pendingCue]);

  useEffect(() => {
    if (!enabled) {
      pendingRef.current = null;
      setPendingCue(null);
      return;
    }

    let rafId = 0;

    const tick = () => {
      const snap = audioEngine.sampleMasterBeatTelemetry();
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const prevProg = prevBarProgressRef.current;
      prevBarProgressRef.current = snap.barProgress;

      const cue = pendingRef.current;
      if (cue) {
        const armedElapsed = now - cue.armedAt;
        const wrappedDownbeat =
          prevProg > 0.72 && snap.barProgress < 0.28 && armedElapsed >= 140;
        const freshStrongDownbeat =
          snap.lastDownbeatAt > cue.armedAt + 120 && snap.beatIndex === 1;
        const reachedFallbackTarget = now >= cue.targetFireAt;

        if (wrappedDownbeat || freshStrongDownbeat || reachedFallbackTarget) {
          pendingRef.current = null;
          setPendingCue(null);
          onExecuteRef.current(cue);
        }
      }

      if (now - lastUiSyncRef.current >= 55) {
        lastUiSyncRef.current = now;
        setTelemetry(snap);
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [enabled]);

  const armBeatCue = useCallback(
    (cueInput: Omit<PendingBeatSyncCue, 'id' | 'armedAt' | 'targetFireAt'>) => {
      audioEngine.ensureContext();
      const snap = audioEngine.sampleMasterBeatTelemetry();
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

      // Always quantize to the upcoming musical downbeat (Beat 1)
      const waitMs = Math.max(220, Math.min(3400, snap.msUntilDownbeat));
      const fullCue: PendingBeatSyncCue = {
        ...cueInput,
        id: `bs-${Date.now().toString(36)}`,
        armedAt: now,
        targetFireAt: now + waitMs,
      };
      pendingRef.current = fullCue;
      setPendingCue(fullCue);
      setTelemetry(snap);
    },
    []
  );

  const cancelCue = useCallback(() => {
    pendingRef.current = null;
    setPendingCue(null);
  }, []);

  const firePendingNow = useCallback(() => {
    const cue = pendingRef.current;
    if (!cue) return;
    pendingRef.current = null;
    setPendingCue(null);
    onExecuteRef.current(cue);
  }, []);

  return {
    telemetry,
    pendingCue,
    armBeatCue,
    cancelCue,
    firePendingNow,
  };
}
