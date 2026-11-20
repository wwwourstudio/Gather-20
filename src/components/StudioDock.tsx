import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clapperboard,
  Copy,
  FileText,
  Gamepad2,
  Hand,
  HelpCircle,
  History,
  Layers,
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  Move,
  Music2,
  Palette,
  Pencil,
  PhoneOff,
  Play,
  Plus,
  RotateCcw,
  Rss,
  ShoppingBag,
  Sliders,
  Smartphone,
  Sparkles,
  Square,
  ThumbsUp,
  Trash2,
  Unlock,
  UserMinus,
  Users,
  Video,
  Wrench,
  X,
} from 'lucide-react';
import { SCENE_TEMPLATES, VERTICAL_TEMPLATES } from '../constants/studioDefaults';
import { PendingBeatSyncCue } from '../hooks/useBeatSync';
import { CustomScenePreset, CustomStageElement, RoomState, TransitionType } from '../types/studio';
import { audioEngine, CustomStingerItem, MasterBeatTelemetry } from '../utils/audioEngine';
import {
  getSceneDisplayName,
  recommendSmartTransition,
  SmartTransitionHistoryEntry,
  SmartTransitionRecommendation,
} from '../utils/smartTransition';
import { ConsoleTab } from './RightConsole';
import { PRESET_STINGER_PADS } from './StingerDeckDrawer';

/* Authentic Gather v5 Miniature 16:9 Scene Preview Card (.sc-pv) */
const ScenePreviewThumb: React.FC<{
  id: string;
  elements?: CustomStageElement[];
  bannerVisible?: boolean;
}> = ({ id, elements, bannerVisible = true }) => {
  const slotCls = 'absolute rounded-[3px] gather-sc-slot';
  const mediaCls = 'absolute rounded-[3px] gather-sc-media';
  const bannerCls = 'absolute left-[7%] bottom-[8%] w-[46%] h-[9%] rounded-[2px] gather-sc-banner';

  if (elements && elements.length > 0) {
    return (
      <span className="gather-sc-pv" aria-hidden="true">
        {elements.slice(0, 8).map((el, i) => {
          const isMedia = el.kind === 'media';
          const isAccent = el.kind === 'clock' || el.kind === 'qr';
          const bg = isMedia ? 'gather-sc-media' : isAccent ? 'bg-[#34d399]/80' : 'gather-sc-slot';
          return (
            <i
              key={el.id || i}
              className={`absolute rounded-[2px] ${bg}`}
              style={{
                left: `${Math.max(2, Math.min(92, el.x * 100))}%`,
                top: `${Math.max(2, Math.min(92, el.y * 100))}%`,
                width: `${Math.max(8, Math.min(96, el.w * 100))}%`,
                height: `${Math.max(8, Math.min(96, el.h * 100))}%`,
              }}
            />
          );
        })}
        {bannerVisible && <i className={bannerCls} />}
      </span>
    );
  }

  return (
    <span className="gather-sc-pv" aria-hidden="true">
      {id === 'solo' || id === 'v-solo' ? (
        <i className={`${slotCls} inset-[9%]`} />
      ) : id === 'duo' || id === 'v-duo' ? (
        <>
          <i className={`${slotCls} left-[7%] top-[10%] w-[41%] h-[78%]`} />
          <i className={`${slotCls} right-[7%] top-[10%] w-[41%] h-[78%]`} />
        </>
      ) : id === 'spotlight' || id === 'trio' ? (
        <>
          <i className={`${slotCls} left-[7%] top-[10%] w-[50%] h-[78%]`} />
          <i className={`${slotCls} right-[7%] top-[10%] w-[33%] h-[36%]`} />
          <i className={`${slotCls} right-[7%] bottom-[12%] w-[33%] h-[36%]`} />
        </>
      ) : id === 'screen-cam' || id === 'slides-cam' || id === 'v-screen' ? (
        <>
          <i className={`${mediaCls} left-[7%] top-[10%] w-[58%] h-[78%]`} />
          <i className={`${slotCls} right-[7%] top-[24%] w-[25%] h-[50%]`} />
        </>
      ) : id === 'pip' ? (
        <>
          <i className={`${mediaCls} inset-[8%]`} />
          <i className={`${slotCls} right-[11%] bottom-[13%] w-[26%] h-[32%] shadow-md`} />
        </>
      ) : (
        <>
          <i className={`${slotCls} left-[7%] top-[10%] w-[41%] h-[36%]`} />
          <i className={`${slotCls} right-[7%] top-[10%] w-[41%] h-[36%]`} />
          <i className={`${slotCls} left-[7%] bottom-[12%] w-[41%] h-[36%]`} />
          <i className={`${slotCls} right-[7%] bottom-[12%] w-[41%] h-[36%]`} />
        </>
      )}
      <i className={bannerCls} />
    </span>
  );
};

interface SceneDeckProps {
  room: RoomState;
  localClientId: string;
  isHost: boolean;
  savedPresets?: CustomScenePreset[];
  hasActiveMedia?: boolean;
  smartTransitionEnabled?: boolean;
  beatSyncEnabled?: boolean;
  beatTelemetry?: MasterBeatTelemetry;
  pendingBeatCue?: PendingBeatSyncCue | null;
  lastSmartTransition?: SmartTransitionRecommendation | null;
  smartTransitionHistory?: SmartTransitionHistoryEntry[];
  onToggleSmartTransition?: (enabled: boolean) => void;
  onToggleBeatSync?: (enabled: boolean) => void;
  onCancelBeatCue?: () => void;
  onFireBeatCueNow?: () => void;
  onRevertSmartDecision?: (entry: SmartTransitionHistoryEntry) => void;
  onOverrideSmartDecision?: (entry: SmartTransitionHistoryEntry, nextType: TransitionType) => void;
  onClearSmartHistory?: () => void;
  onSelectScene: (
    templateId: string,
    smartOverride?: { transitionType: TransitionType; transitionMs: number }
  ) => void;
  onApplyCustomPreset?: (
    preset: CustomScenePreset,
    smartOverride?: { transitionType: TransitionType; transitionMs: number }
  ) => void;
  onSaveCustomPreset?: (name: string) => void;
  onRenameCustomPreset?: (presetId: string, nextName: string) => void;
  onDeleteCustomPreset?: (presetId: string) => void;
  onChangeTransition: (type: TransitionType, ms: number) => void;
  onToggleParticipantStage: (id: string, onStage: boolean) => void;
  onAskMuteParticipant: (id: string) => void;
  onKickParticipant: (id: string) => void;
  onAdmitGuest: (id: string) => void;
  onDenyGuest: (id: string) => void;
  onToggleLock: () => void;
  onRemoveSquadEntry: (id: string) => void;
  onFeatureQuestion?: (questionId: string | null) => void;
  onPromoteHand?: (handId: string) => void;
  onLowerHand?: (handId: string) => void;
  onOpenStingers?: () => void;
  onOpenInvite?: () => void;
  editMode?: boolean;
  onToggleEditMode?: () => void;
}

export const SceneDeck: React.FC<SceneDeckProps> = ({
  room,
  localClientId,
  isHost,
  savedPresets = [],
  hasActiveMedia = false,
  smartTransitionEnabled: controlledSmartEnabled,
  beatSyncEnabled = false,
  beatTelemetry,
  pendingBeatCue = null,
  lastSmartTransition: controlledLastSmart,
  smartTransitionHistory = [],
  onToggleSmartTransition,
  onToggleBeatSync,
  onCancelBeatCue,
  onFireBeatCueNow,
  onRevertSmartDecision,
  onOverrideSmartDecision,
  onClearSmartHistory,
  onSelectScene,
  onApplyCustomPreset,
  onSaveCustomPreset,
  onRenameCustomPreset,
  onDeleteCustomPreset,
  onChangeTransition,
  onToggleParticipantStage,
  onAskMuteParticipant,
  onKickParticipant,
  onAdmitGuest,
  onDenyGuest,
  onToggleLock,
  onRemoveSquadEntry,
  onFeatureQuestion,
  onPromoteHand,
  onLowerHand,
  onOpenStingers,
  onOpenInvite,
  editMode = false,
  onToggleEditMode,
}) => {
  const [deckTab, setDeckTab] = useState<
    'scenes' | 'history' | 'crew' | 'stingers' | 'qa' | 'callins' | 'lobby' | 'squad'
  >('scenes');
  const [collapsed, setCollapsed] = useState(false);
  const [creatingPreset, setCreatingPreset] = useState(false);
  const [presetNameDraft, setPresetNameDraft] = useState('');
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingPresetDraft, setEditingPresetDraft] = useState('');
  const [localSmartEnabled, setLocalSmartEnabled] = useState(true);
  const [hoveredSceneId, setHoveredSceneId] = useState<string | null>(null);
  const [localLastSmartCue, setLocalLastSmartCue] = useState<SmartTransitionRecommendation | null>(null);
  const smartTransitionEnabled =
    controlledSmartEnabled !== undefined ? controlledSmartEnabled : localSmartEnabled;
  const setSmartEnabled = (next: boolean) => {
    if (onToggleSmartTransition) {
      onToggleSmartTransition(next);
    } else {
      setLocalSmartEnabled(next);
    }
  };
  const lastSmartCue =
    controlledLastSmart !== undefined ? controlledLastSmart : localLastSmartCue;
  const [customStingers, setCustomStingers] = useState<CustomStingerItem[]>(() =>
    audioEngine.getCustomStingers()
  );
  const [activeAudioIds, setActiveAudioIds] = useState<string[]>(() =>
    audioEngine.getActiveIds()
  );

  useEffect(() => {
    return audioEngine.subscribe(() => {
      setCustomStingers(audioEngine.getCustomStingers());
      setActiveAudioIds(audioEngine.getActiveIds());
    });
  }, []);

  useEffect(() => {
    if (deckTab === 'squad' && room.watchMode !== 'gamer') {
      setDeckTab('scenes');
    }
  }, [deckTab, room.watchMode]);

  const [participantLevels, setParticipantLevels] = useState<
    Record<string, { peak: number; peakHold: number; clipped: boolean }>
  >({});

  useEffect(() => {
    if (collapsed || deckTab !== 'crew') return;
    const sampleParticipants = () => {
      const next: Record<string, { peak: number; peakHold: number; clipped: boolean }> = {};
      for (const p of room.participants) {
        const channelId = p.id === localClientId ? 'local-mic' : `peer-${p.id}`;
        const tel = audioEngine.sampleChannelTelemetry(channelId, !p.micOn);
        next[p.id] = {
          peak: p.micOn ? tel.peak : 0,
          peakHold: p.micOn ? tel.peakHold : 0,
          clipped: p.micOn ? tel.clipped : false,
        };
      }
      setParticipantLevels(next);
    };
    sampleParticipants();
    const timer = window.setInterval(sampleParticipants, 55);
    return () => window.clearInterval(timer);
  }, [collapsed, deckTab, room.participants, localClientId]);

  const templates = room.aspectRatio === '9:16' ? VERTICAL_TEMPLATES : SCENE_TEMPLATES;
  const sortedQuestions = [...(room.questions || [])].sort((a, b) => b.upvotes - a.upvotes);
  const mergedPresets = savedPresets.length > 0 ? savedPresets : room.scene.savedPresets || [];
  const onStageCount = room.participants.filter((p) => p.onStage).length;
  const stageHasMedia =
    hasActiveMedia ||
    room.participants.some((p) => p.sharingScreen) ||
    (room.scene.customElements || []).some((el) => el.kind === 'media');

  const getRecommendationForTarget = (targetId: string) =>
    recommendSmartTransition({
      fromTemplateId: room.scene.templateId,
      toTemplateId: targetId,
      savedPresets: mergedPresets,
      hasActiveMedia: stageHasMedia,
      onStageCount,
      customHasMedia: (room.scene.customElements || []).some((el) => el.kind === 'media'),
      beatSync: beatSyncEnabled,
      bpm: beatTelemetry?.bpm,
    });

  const activeSuggestion =
    hoveredSceneId && hoveredSceneId !== room.scene.templateId
      ? getRecommendationForTarget(hoveredSceneId)
      : lastSmartCue;

  const handleSceneTrigger = (targetId: string) => {
    if (smartTransitionEnabled || beatSyncEnabled) {
      const rec = getRecommendationForTarget(targetId);
      setLocalLastSmartCue(rec);
      onSelectScene(targetId, {
        transitionType: rec.transitionType,
        transitionMs: rec.transitionMs,
      });
      return;
    }
    onSelectScene(targetId);
  };

  const handlePresetTrigger = (preset: CustomScenePreset) => {
    const rec = smartTransitionEnabled || beatSyncEnabled ? getRecommendationForTarget(preset.id) : undefined;
    if (rec) setLocalLastSmartCue(rec);
    if (onApplyCustomPreset) {
      onApplyCustomPreset(
        preset,
        rec ? { transitionType: rec.transitionType, transitionMs: rec.transitionMs } : undefined
      );
    } else {
      onSelectScene(
        preset.id,
        rec ? { transitionType: rec.transitionType, transitionMs: rec.transitionMs } : undefined
      );
    }
  };

  const formatTimeShort = (ts: number) => {
    try {
      return new Date(ts).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '--:--';
    }
  };

  const deckTabBtn = (active: boolean, highlightClass = '') =>
    `gather-pill-tab inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] whitespace-nowrap shrink-0 cursor-pointer ${
      active
        ? 'is-active text-[var(--ink)] font-medium'
        : `font-normal ${highlightClass || 'text-[var(--ink-3)] hover:text-[var(--ink)]'}`
    }`;

  return (
    <div className="gather-deck px-3 sm:px-4 pt-2.5 pb-3 space-y-2.5 shrink-0 min-w-0">
      {/* Deck header: pill tabs left, transition controls right */}
      <div className="flex flex-wrap items-center justify-between gap-3 min-h-[32px]">
        <div
          className="gather-pill-tabs flex items-center gap-0.5 overflow-x-auto gather-scroll"
          role="tablist"
          aria-label="Studio deck"
        >
          <button
            type="button"
            role="tab"
            aria-selected={deckTab === 'scenes'}
            onClick={() => {
              setDeckTab('scenes');
              setCollapsed(false);
            }}
            className={deckTabBtn(deckTab === 'scenes')}
          >
            Scenes
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={deckTab === 'history'}
            onClick={() => {
              setDeckTab('history');
              setCollapsed(false);
            }}
            className={deckTabBtn(deckTab === 'history')}
          >
            <span>History</span>
            {smartTransitionHistory.length > 0 && (
              <span className="font-mono-num text-[11px] text-[var(--ink-3)]">
                {smartTransitionHistory.length}
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={deckTab === 'crew'}
            onClick={() => {
              setDeckTab('crew');
              setCollapsed(false);
            }}
            className={deckTabBtn(deckTab === 'crew')}
          >
            <span>People</span>
            <span className="font-mono-num text-[11px] text-[var(--ink-3)]">
              {room.participants.length}/6
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={deckTab === 'stingers'}
            onClick={() => {
              setDeckTab('stingers');
              setCollapsed(false);
            }}
            className={deckTabBtn(deckTab === 'stingers')}
          >
            <span>Stingers</span>
            <span className="font-mono-num text-[11px] text-[var(--ink-3)]">
              {PRESET_STINGER_PADS.length + customStingers.length}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={deckTab === 'qa'}
            onClick={() => {
              setDeckTab('qa');
              setCollapsed(false);
            }}
            className={deckTabBtn(deckTab === 'qa')}
          >
            <span>Q&amp;A</span>
            {sortedQuestions.length > 0 && (
              <span className="font-mono-num text-[11px] text-[var(--cyan)]">
                {sortedQuestions.length}
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={deckTab === 'callins'}
            onClick={() => {
              setDeckTab('callins');
              setCollapsed(false);
            }}
            className={deckTabBtn(
              deckTab === 'callins',
              (room.handRaiseQueue?.length || 0) > 0 ? 'text-[var(--cyan)]' : ''
            )}
          >
            <span>Call-Ins</span>
            {(room.handRaiseQueue?.length || 0) > 0 && (
              <span className="font-mono-num text-[11px] text-[var(--cyan)]">
                {room.handRaiseQueue?.length}
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={deckTab === 'lobby'}
            onClick={() => {
              setDeckTab('lobby');
              setCollapsed(false);
            }}
            className={deckTabBtn(
              deckTab === 'lobby',
              room.lobby.length > 0 ? 'text-[var(--warn)]' : ''
            )}
          >
            <span>Waiting</span>
            {room.lobby.length > 0 && (
              <span className="font-mono-num text-[11px] text-[var(--warn)]">
                {room.lobby.length}
              </span>
            )}
          </button>
          {room.watchMode === 'gamer' && (
            <button
              type="button"
              role="tab"
              aria-selected={deckTab === 'squad'}
              onClick={() => {
                setDeckTab('squad');
                setCollapsed(false);
              }}
              className={deckTabBtn(deckTab === 'squad')}
            >
              <span>Squad</span>
              {room.squadQueue.length > 0 && (
                <span className="font-mono-num text-[11px] text-[var(--ink-3)]">
                  {room.squadQueue.length}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs shrink-0">
          {deckTab === 'scenes' && isHost && onToggleEditMode && (
            <button
              type="button"
              role="switch"
              aria-checked={editMode}
              onClick={onToggleEditMode}
              title="Toggle Scene Editor to drag, resize, and arrange elements on the stage canvas"
              className={`h-7 px-2.5 rounded-full border text-[11.5px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all ${
                editMode
                  ? 'gather-btn-primary text-white border-transparent shadow-sm'
                  : 'bg-[var(--fill)] hover:bg-[var(--fill-hover)] border-[var(--line-2)] text-[var(--ink)]'
              }`}
            >
              <Move className="w-3 h-3 shrink-0" />
              <span>Scene Editor</span>
              <span
                aria-hidden="true"
                className={`relative w-6 h-3.5 rounded-full transition-colors ${
                  editMode ? 'bg-white/30' : 'bg-[var(--line-2)]'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transition-[left] duration-150 ${
                    editMode ? 'left-3' : 'left-0.5'
                  }`}
                />
              </span>
            </button>
          )}

          {deckTab === 'scenes' && isHost && !collapsed && (
            <div className="hidden sm:flex items-center gap-0.5 gather-pill-tabs">
              <button
                type="button"
                role="switch"
                aria-checked={smartTransitionEnabled}
                onClick={() => setSmartEnabled(!smartTransitionEnabled)}
                title="Smart Transition: selects Cut / Slide for participant re-ordering or Dissolve / Push for heavy media loads"
                className={`h-6 px-2 rounded-[5px] text-[11px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  smartTransitionEnabled
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                    : 'text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
                }`}
              >
                Smart
              </button>

              {onToggleBeatSync && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={beatSyncEnabled}
                  onClick={() => {
                    audioEngine.ensureContext();
                    onToggleBeatSync(!beatSyncEnabled);
                  }}
                  title="Beat-Sync: detects tempo from AudioMixer master output and triggers scene changes on Beat 1"
                  className={`h-6 px-2 rounded-[5px] text-[11px] font-medium whitespace-nowrap cursor-pointer transition-colors inline-flex items-center gap-1.5 ${
                    beatSyncEnabled
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
                  }`}
                >
                  <span>Beat-Sync</span>
                  {beatSyncEnabled && beatTelemetry && (
                    <span className="font-mono-num text-[10px] inline-flex items-center gap-1">
                      <span>{beatTelemetry.bpm}</span>
                      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
                        {[1, 2, 3, 4].map((step) => (
                          <i
                            key={step}
                            className={`w-1 rounded-[1px] transition-colors ${
                              beatTelemetry.beatIndex === step
                                ? step === 1
                                  ? 'h-2.5 bg-emerald-400'
                                  : 'h-2 bg-[var(--cyan)]'
                                : 'h-1 bg-white/25'
                            }`}
                          />
                        ))}
                      </span>
                    </span>
                  )}
                </button>
              )}

              <span className="h-3.5 w-px bg-[var(--line)] mx-1" aria-hidden="true" />
              {(['cut', 'dissolve', 'slide', 'push'] as TransitionType[]).map((t) => {
                const isActive = room.scene.transitionType === t;
                const isSuggested =
                  smartTransitionEnabled &&
                  hoveredSceneId !== null &&
                  hoveredSceneId !== room.scene.templateId &&
                  activeSuggestion?.transitionType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setSmartEnabled(false);
                      onChangeTransition(t, t === 'cut' ? 120 : room.scene.transitionMs || 320);
                    }}
                    className={`h-6 px-2 rounded-[5px] text-[11px] font-medium capitalize whitespace-nowrap cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[var(--fill-active)] text-[var(--ink)]'
                        : isSuggested
                        ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                        : 'text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
              {smartTransitionEnabled && activeSuggestion && (
                <span className="hidden 2xl:inline text-[11px] text-[var(--ink-3)] truncate max-w-[180px] ml-1">
                  · {activeSuggestion.label}
                </span>
              )}
            </div>
          )}

          {deckTab === 'history' && !collapsed && (
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-[var(--ink-3)]">
              <span>Last 5 Smart Transition decisions</span>
              {smartTransitionHistory.length > 0 && onClearSmartHistory && (
                <button
                  type="button"
                  onClick={onClearSmartHistory}
                  className="h-6 px-2 rounded-[5px] hover:bg-[var(--fill-hover)] text-[var(--ink-2)] hover:text-[var(--ink)] font-medium cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {deckTab === 'stingers' && !collapsed && onOpenStingers && (
            <button
              type="button"
              onClick={onOpenStingers}
              className="h-6 px-2.5 rounded-[5px] gather-btn-primary text-[11px] font-medium inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Audio FX</span>
            </button>
          )}

          {isHost && (
            <>
              <span className="h-3.5 w-px bg-[var(--line)] mx-0.5" aria-hidden="true" />
              <button
                type="button"
                onClick={onToggleLock}
                title={room.isLocked ? 'Unlock room' : 'Lock room for green-room screening'}
                className={`h-6 px-2 rounded-[5px] text-[11px] font-medium inline-flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors ${
                  room.isLocked
                    ? 'text-[var(--warn)] bg-[var(--warn)]/12'
                    : 'text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
                }`}
              >
                {room.isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                <span>{room.isLocked ? 'Locked' : 'Lock'}</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand deck' : 'Collapse deck'}
            className="h-6 w-6 grid place-items-center rounded-[5px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] cursor-pointer"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-150 ${
                collapsed ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Inline Armed Downbeat Bar when Beat-Sync waits for Beat 1 */}
      {!collapsed && pendingBeatCue && (
        <div className="px-3 py-1.5 rounded-[8px] bg-emerald-500/12 border border-emerald-400/35 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono-num font-medium text-emerald-400 whitespace-nowrap">
              BEAT-SYNC ARMED
            </span>
            <span className="text-[var(--ink)] font-medium truncate">
              → {pendingBeatCue.targetName}
            </span>
            <span className="text-[var(--ink-3)] font-mono-num whitespace-nowrap">
              ({pendingBeatCue.transitionType} on Beat 1 ·{' '}
              {beatTelemetry?.signalDetected
                ? `${beatTelemetry.bpm} BPM master lock`
                : 'master clock 120 BPM'}
              )
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onFireBeatCueNow && (
              <button
                type="button"
                onClick={onFireBeatCueNow}
                className="h-6 px-2.5 rounded-[6px] gather-btn-primary text-[11px] font-medium cursor-pointer whitespace-nowrap"
              >
                Trigger Now
              </button>
            )}
            {onCancelBeatCue && (
              <button
                type="button"
                onClick={onCancelBeatCue}
                className="h-6 px-2.5 rounded-[6px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[11px] font-medium text-[var(--ink-2)] cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Gather v5 Deck Body */}
      {!collapsed && (
        <div
          className={
            deckTab === 'history'
              ? 'min-h-[96px] max-h-[156px] overflow-y-auto overflow-x-hidden gather-scroll'
              : 'h-[108px] flex items-stretch overflow-x-auto overflow-y-hidden gather-scroll'
          }
        >
          {/* SMART TRANSITION HISTORY PANEL (Last 5 Smart Decisions) */}
          {deckTab === 'history' && (
            <div className="w-full">
              {smartTransitionHistory.length === 0 ? (
                <div className="h-[104px] flex flex-wrap items-center justify-between gap-3 px-2 text-xs text-[var(--ink-3)]">
                  <div className="flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
                    <span>
                      Smart Transition decisions appear here as scenes switch (including Beat-Sync downbeats).
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeckTab('scenes')}
                    className="h-7 px-3 rounded-[7px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line-2)] text-[11px] font-semibold text-[var(--ink)] cursor-pointer whitespace-nowrap"
                  >
                    Switch Scenes
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[var(--line)]">
                  {smartTransitionHistory.slice(0, 5).map((entry) => {
                    const activeType = entry.overriddenType || entry.chosenTransitionType;
                    return (
                      <div
                        key={entry.id}
                        className="py-1.5 px-1.5 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2.5 text-xs hover:bg-[var(--fill)] rounded-[6px] transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="font-mono-num text-[11px] text-[var(--ink-3)] whitespace-nowrap shrink-0">
                            {formatTimeShort(entry.timestamp)}
                          </span>
                          <span className="font-semibold text-[var(--ink)] truncate">
                            {entry.fromName || getSceneDisplayName(entry.fromTemplateId, mergedPresets)}{' '}
                            <span className="text-[var(--ink-3)]">→</span>{' '}
                            {entry.toName || getSceneDisplayName(entry.toTemplateId, mergedPresets)}
                          </span>
                          <span className="hidden md:inline text-[11px] text-[var(--ink-3)] truncate">
                            · {entry.chosenTransitionType.toUpperCase()} {entry.chosenTransitionMs}ms
                            {entry.beatSynced ? ` · Beat ${entry.bpm || 120} BPM` : ''}
                            {entry.overriddenType ? ` · Overridden` : ''}
                            {entry.reverted ? ` · Reverted` : ''}
                          </span>
                        </div>

                        {isHost && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div
                              className="inline-flex items-center gap-0.5 p-0.5 rounded-[6px] bg-[var(--fill)] border border-[var(--line)]"
                              role="group"
                              aria-label="Override transition type"
                            >
                              {(['cut', 'dissolve', 'slide', 'push'] as TransitionType[]).map((t) => {
                                const selected = activeType === t;
                                return (
                                  <button
                                    key={t}
                                    type="button"
                                    disabled={!onOverrideSmartDecision}
                                    onClick={() => onOverrideSmartDecision?.(entry, t)}
                                    title={`Manually override with ${t}`}
                                    className={`h-5 px-1.5 rounded-[4px] text-[10px] font-semibold capitalize cursor-pointer transition-colors whitespace-nowrap ${
                                      selected
                                        ? 'gather-btn-primary text-white'
                                        : 'text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
                                    }`}
                                  >
                                    {t === 'dissolve' ? 'Dis' : t}
                                  </button>
                                );
                              })}
                            </div>

                            <button
                              type="button"
                              disabled={!onRevertSmartDecision || entry.reverted}
                              onClick={() => onRevertSmartDecision?.(entry)}
                              title={`Revert to ${entry.fromName} (${entry.prevTransitionType})`}
                              className={`h-6 px-2 rounded-[6px] border text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap transition-colors ${
                                entry.reverted
                                  ? 'border-[var(--line)] text-[var(--ink-3)] opacity-50 cursor-default'
                                  : 'border-[var(--glass-border)] bg-[var(--surface-2)] hover:bg-[var(--fill-hover)] text-[var(--ink)] cursor-pointer'
                              }`}
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>{entry.reverted ? 'Reverted' : 'Revert'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SCENES LAYER (Built-in + Saved Custom Scene Presets) */}
          {deckTab === 'scenes' && (
            <div className="flex items-stretch gap-2">
              {templates.map((tpl, idx) => {
                const active = room.scene.templateId === tpl.id;
                const smartHint =
                  smartTransitionEnabled && !active ? getRecommendationForTarget(tpl.id) : null;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    disabled={!isHost}
                    onMouseEnter={() => setHoveredSceneId(tpl.id)}
                    onMouseLeave={() => setHoveredSceneId((prev) => (prev === tpl.id ? null : prev))}
                    onFocus={() => setHoveredSceneId(tpl.id)}
                    onBlur={() => setHoveredSceneId((prev) => (prev === tpl.id ? null : prev))}
                    onClick={() => handleSceneTrigger(tpl.id)}
                    title={smartHint ? `Smart: ${smartHint.reason}` : tpl.description}
                    className={`gather-scene-card shrink-0 w-[128px] p-1.5 rounded-[12px] border flex flex-col gap-1.5 text-left cursor-pointer ${
                      active
                        ? 'is-active text-[var(--ink)]'
                        : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <span className="relative block">
                      <ScenePreviewThumb id={tpl.id} />
                      {smartHint ? (
                        <span className="absolute top-1 right-1 px-1.5 h-4 rounded-full bg-black/55 backdrop-blur text-[9px] font-medium capitalize text-[#bfdbfe] inline-flex items-center">
                          {smartHint.transitionType}
                        </span>
                      ) : idx < 9 ? (
                        <span className="absolute top-1 right-1 w-4 h-4 rounded-[4px] bg-black/45 backdrop-blur text-[9px] font-mono-num text-white/80 grid place-items-center">
                          {idx + 1}
                        </span>
                      ) : null}
                      {active && (
                        <span className="absolute top-1 left-1 px-1.5 h-4 rounded-full bg-[#e11d48] text-[8.5px] font-semibold tracking-wider text-white inline-flex items-center">
                          LIVE
                        </span>
                      )}
                    </span>
                    <span className="block text-[11.5px] font-medium leading-tight truncate px-0.5" title={tpl.name}>
                      {tpl.name}
                    </span>
                  </button>
                );
              })}

              {mergedPresets
                .filter((p) => p.aspect === room.aspectRatio)
                .map((preset) => {
                  const active = room.scene.templateId === preset.id;
                  const isEditing = editingPresetId === preset.id;
                  const smartHint =
                    smartTransitionEnabled && !active ? getRecommendationForTarget(preset.id) : null;

                  const commitRename = () => {
                    const clean = editingPresetDraft.trim().slice(0, 36);
                    setEditingPresetId(null);
                    if (clean && clean !== preset.name && onRenameCustomPreset) {
                      onRenameCustomPreset(preset.id, clean);
                    }
                  };

                  return (
                    <div
                      key={preset.id}
                      onMouseEnter={() => setHoveredSceneId(preset.id)}
                      onMouseLeave={() =>
                        setHoveredSceneId((prev) => (prev === preset.id ? null : prev))
                      }
                      className={`gather-scene-card group relative shrink-0 w-[134px] p-1.5 rounded-[12px] border flex flex-col justify-between gap-1.5 text-left ${
                        active ? 'is-active text-[var(--ink)]' : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                      }`}
                    >
                      <button
                        type="button"
                        disabled={!isHost}
                        onFocus={() => setHoveredSceneId(preset.id)}
                        onBlur={() =>
                          setHoveredSceneId((prev) => (prev === preset.id ? null : prev))
                        }
                        onClick={() => handlePresetTrigger(preset)}
                        title={smartHint ? `Smart: ${smartHint.reason}` : preset.name}
                        className="w-full text-left flex flex-col cursor-pointer"
                      >
                        <ScenePreviewThumb
                          id={preset.id}
                          elements={preset.elements}
                          bannerVisible={preset.bannerVisible}
                        />
                      </button>

                      {isEditing ? (
                        <input
                          type="text"
                          autoFocus
                          maxLength={36}
                          value={editingPresetDraft}
                          aria-label={`Rename preset ${preset.name}`}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditingPresetDraft(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.currentTarget.blur();
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              setEditingPresetDraft(preset.name);
                              setEditingPresetId(null);
                            }
                          }}
                          className="w-full h-6 px-1.5 rounded-[5px] bg-[var(--bg)]/90 border border-[var(--accent)] text-[11.5px] font-semibold text-[var(--ink)] focus:outline-none"
                        />
                      ) : (
                        <div className="flex items-center justify-between gap-1 px-0.5 min-w-0">
                          <button
                            type="button"
                            disabled={!isHost}
                            onClick={() => handlePresetTrigger(preset)}
                            title={preset.name}
                            className="text-[12px] font-semibold truncate text-left flex-1 min-w-0 cursor-pointer"
                          >
                            {preset.name}
                          </button>
                          {isHost && onRenameCustomPreset && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingPresetId(preset.id);
                                setEditingPresetDraft(preset.name);
                              }}
                              aria-label={`Rename preset ${preset.name}`}
                              title="Rename preset"
                              className="h-5 w-5 rounded-[4px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-active)] grid place-items-center shrink-0 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-2.5 h-2.5" />
                            </button>
                          )}
                          <span className="text-[9px] font-mono-num capitalize text-[var(--cyan)] shrink-0">
                            {smartHint ? smartHint.transitionType : 'Saved'}
                          </span>
                        </div>
                      )}

                      {isHost && onDeleteCustomPreset && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteCustomPreset(preset.id);
                          }}
                          aria-label={`Delete preset ${preset.name}`}
                          className="absolute top-2 right-2 h-5 w-5 rounded-[5px] bg-black/75 text-white/80 hover:text-[var(--danger)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 grid place-items-center transition-opacity cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}

              {isHost && onSaveCustomPreset && (
                creatingPreset ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const clean = presetNameDraft.trim().slice(0, 36);
                      if (!clean) return;
                      onSaveCustomPreset(clean);
                      setPresetNameDraft('');
                      setCreatingPreset(false);
                    }}
                    className="shrink-0 w-[184px] p-2 rounded-[10px] border border-[var(--accent-line)] bg-[var(--fill-hover)] flex flex-col justify-between gap-1.5"
                  >
                    <input
                      type="text"
                      value={presetNameDraft}
                      onChange={(e) => setPresetNameDraft(e.target.value)}
                      placeholder="Preset name..."
                      maxLength={36}
                      autoFocus
                      className="w-full h-7 px-2 rounded-[6px] bg-[var(--bg)]/85 border border-[var(--glass-border)] text-xs text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--accent)]"
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        type="submit"
                        disabled={!presetNameDraft.trim()}
                        className="flex-1 h-7 rounded-[6px] gather-btn-primary text-[11px] font-semibold text-white cursor-pointer disabled:opacity-45"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCreatingPreset(false);
                          setPresetNameDraft('');
                        }}
                        aria-label="Cancel preset creation"
                        className="h-7 w-7 grid place-items-center rounded-[6px] bg-[var(--bg)]/70 border border-[var(--glass-border)] text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreatingPreset(true)}
                    className="shrink-0 w-[104px] rounded-[8px] border border-dashed border-[var(--line-2)] hover:border-[var(--accent)] flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                    <span>Save Preset</span>
                  </button>
                )
              )}

              {isHost && onToggleEditMode && (
                <button
                  type="button"
                  onClick={onToggleEditMode}
                  className={`shrink-0 w-[108px] rounded-[8px] border flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors cursor-pointer ${
                    editMode
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]'
                      : 'border-[var(--line-2)] bg-[var(--fill)]/50 hover:border-[var(--accent)] text-[var(--ink-2)] hover:text-[var(--ink)]'
                  }`}
                >
                  <Move className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  <span>{editMode ? 'Editing Stage' : 'Scene Editor'}</span>
                </button>
              )}
            </div>
          )}

          {/* PEOPLE LAYER (with Real-Time Audio Level Meters) */}
          {deckTab === 'crew' && (
            <div className="flex items-stretch gap-2.5">
              {room.participants.map((p) => {
                const lvl = participantLevels[p.id]?.peak ?? 0;
                const peakHold = participantLevels[p.id]?.peakHold ?? 0;
                const activeSegments = p.micOn ? Math.min(12, Math.round(lvl * 12)) : 0;
                const peakSegment = p.micOn && peakHold > 0.04 ? Math.min(11, Math.floor(peakHold * 12)) : -1;
                const isSpeaking = p.micOn && lvl > 0.08;

                return (
                  <div
                    key={p.id}
                    className={`group shrink-0 w-[148px] h-full p-1.5 rounded-[10px] border flex flex-col justify-between gap-1.5 transition-colors ${
                      p.onStage
                        ? isSpeaking
                          ? 'bg-[var(--fill)] border-[var(--ok)]/70'
                          : 'bg-[var(--fill)] border-[var(--live)]/50'
                        : isSpeaking
                        ? 'bg-[var(--fill)] border-[var(--ok)]/55 opacity-95'
                        : 'bg-[var(--fill)] border-[var(--glass-border)] opacity-85'
                    }`}
                  >
                    <div
                      onClick={() => {
                        if (!isHost) return;
                        if (smartTransitionEnabled) {
                          const nextOnStage = p.onStage
                            ? Math.max(0, onStageCount - 1)
                            : onStageCount + 1;
                          onChangeTransition(
                            nextOnStage <= 1 ? 'cut' : 'slide',
                            nextOnStage <= 1 ? 120 : 260
                          );
                        }
                        onToggleParticipantStage(p.id, !p.onStage);
                      }}
                      className={`relative flex-1 min-h-0 w-full rounded-[6px] overflow-hidden bg-[#101b3a] grid place-items-center ${
                        isHost ? 'cursor-pointer' : ''
                      }`}
                    >
                      {p.avatarUrl ? (
                        <img
                          src={p.avatarUrl}
                          alt={p.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="w-7 h-7 rounded-full gather-btn-primary text-xs font-display font-medium grid place-items-center">
                          {p.initials}
                        </span>
                      )}
                      <span className="absolute left-1.5 top-1.5 text-[9.5px] font-mono-num font-medium px-1.5 py-0.5 rounded bg-black/65 text-white">
                        {p.onStage ? 'Stage' : 'Backstage'}
                      </span>

                      {isHost && p.id !== localClientId && (
                        <div className="absolute right-1 bottom-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAskMuteParticipant(p.id);
                            }}
                            aria-label={`Mute ${p.name}`}
                            className="h-6 w-6 grid place-items-center rounded-[5px] bg-black/75 text-white hover:bg-[var(--accent)] cursor-pointer"
                          >
                            <MicOff className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onKickParticipant(p.id);
                            }}
                            aria-label={`Remove ${p.name}`}
                            className="h-6 w-6 grid place-items-center rounded-[5px] bg-black/75 text-[var(--danger)] hover:bg-[var(--live)] hover:text-white cursor-pointer"
                          >
                            <UserMinus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="px-0.5 space-y-1 shrink-0 min-w-0">
                      <div className="min-w-0 flex items-center justify-between gap-1">
                        <span className="text-[11.5px] font-medium text-[var(--ink)] truncate">
                          {p.name}
                        </span>
                        {!p.micOn ? (
                          <MicOff className="w-3 h-3 text-[var(--danger)] shrink-0" aria-label="Muted" />
                        ) : (
                          <Mic
                            className={`w-3 h-3 shrink-0 transition-colors ${
                              isSpeaking ? 'text-[var(--ok)]' : 'text-[var(--ink-3)]'
                            }`}
                            aria-label={isSpeaking ? 'Speaking' : 'Mic active'}
                          />
                        )}
                      </div>

                      {/* Real-time 12-segment VU audio volume level meter */}
                      <div
                        role="meter"
                        aria-label={`${p.name} audio input level`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(lvl * 100)}
                        className="w-full h-1.5 flex items-center gap-[1.5px]"
                      >
                        {Array.from({ length: 12 }).map((_, idx) => {
                          const lit = idx < activeSegments;
                          const isPeak = idx === peakSegment && peakSegment >= activeSegments;
                          const tone =
                            idx >= 10
                              ? 'bg-[var(--live)]'
                              : idx >= 7
                              ? 'bg-[var(--warn)]'
                              : 'bg-[var(--ok)]';
                          return (
                            <span
                              key={idx}
                              className={`flex-1 h-full rounded-[1px] transition-colors duration-75 ${
                                !p.micOn
                                  ? 'bg-[var(--danger)]/20'
                                  : lit
                                  ? tone
                                  : isPeak
                                  ? 'bg-[var(--ink-2)]/70'
                                  : 'bg-[var(--fill-active)]'
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}

              {onOpenInvite && room.participants.length < 6 && (
                <button
                  type="button"
                  onClick={onOpenInvite}
                  className="shrink-0 w-[132px] rounded-[10px] border border-dashed border-[var(--line-2)] hover:border-[var(--accent)] flex flex-col items-center justify-center gap-1.5 text-xs font-medium text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Invite guest</span>
                </button>
              )}
            </div>
          )}

          {/* STINGERS LAYER */}
          {deckTab === 'stingers' && (
            <div className="flex items-stretch gap-2">
              {customStingers.map((item) => {
                const isPlaying = activeAudioIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => audioEngine.playCustomStinger(item.id)}
                    className={`shrink-0 w-[148px] p-2.5 rounded-[10px] border flex flex-col justify-between text-left transition-all cursor-pointer gather-card-hover ${
                      isPlaying
                        ? 'bg-[var(--accent-soft)] border-[var(--accent-line)] text-[var(--ink)]'
                        : 'bg-[var(--fill)] hover:bg-[var(--fill-hover)] border-[var(--accent-line)] text-[var(--ink)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono-num text-[var(--accent-text)] font-semibold">
                        CUSTOM · {item.durationSec}s
                      </span>
                      {isPlaying ? (
                        <Square className="w-3 h-3 text-[var(--accent-text)] fill-current" />
                      ) : (
                        <Play className="w-3 h-3 text-[var(--accent-text)] fill-current" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold truncate">{item.name}</div>
                      <div className="text-[11px] text-[var(--ink-3)]">
                        {item.loop ? 'Loop · Master Bus' : 'Master Audio Bus'}
                      </div>
                    </div>
                  </button>
                );
              })}

              {PRESET_STINGER_PADS.map((pad) => {
                const isPlaying = activeAudioIds.includes(`pad:${pad.id}`);
                return (
                  <button
                    key={pad.id}
                    type="button"
                    onClick={() => audioEngine.playStinger(pad.id)}
                    className={`shrink-0 w-[142px] p-2.5 rounded-[10px] border flex flex-col justify-between text-left transition-all cursor-pointer gather-card-hover ${
                      isPlaying
                        ? 'bg-[var(--accent-soft)] border-[var(--accent-line)] text-[var(--ink)]'
                        : 'bg-[var(--fill)] hover:bg-[var(--fill-hover)] border-[var(--glass-border)] text-[var(--ink)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono-num text-[var(--ink-3)]">
                        {pad.durationLabel}
                      </span>
                      {isPlaying ? (
                        <Square className="w-3 h-3 text-[var(--accent-text)] fill-current" />
                      ) : (
                        <Play className="w-3 h-3 text-[var(--ink-2)] fill-current" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold truncate">{pad.label}</div>
                      <div className="text-[11px] text-[var(--ink-3)] truncate">{pad.hint}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* AUDIENCE Q&A STAGE SPOTLIGHT LAYER */}
          {deckTab === 'qa' && (
            <div className="flex items-stretch gap-2.5">
              {sortedQuestions.length === 0 ? (
                <div className="text-xs text-[var(--ink-3)] flex items-center gap-2">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Audience questions from the Watch Page appear here sorted by upvotes.</span>
                </div>
              ) : (
                sortedQuestions.map((q) => {
                  const isFeatured = room.overlays.featuredQuestionId === q.id;
                  return (
                    <div
                      key={q.id}
                      className={`shrink-0 w-[260px] p-2.5 rounded-[10px] border flex flex-col justify-between gap-1.5 ${
                        isFeatured
                          ? 'bg-[var(--accent-soft)] border-[var(--accent-line)]'
                          : 'bg-[var(--fill)] border-[var(--glass-border)]'
                      }`}
                    >
                      <p className="text-xs text-[var(--ink)] line-clamp-2 leading-snug">{q.text}</p>
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-[var(--ink-3)] inline-flex items-center gap-1 truncate">
                          <ThumbsUp className="w-3 h-3 text-[var(--cyan)] shrink-0" />
                          <span className="font-mono-num font-bold text-[var(--ink)]">{q.upvotes}</span>
                          <span className="truncate">· {q.author}</span>
                        </span>
                        {isHost && onFeatureQuestion && (
                          <button
                            type="button"
                            onClick={() => onFeatureQuestion(isFeatured ? null : q.id)}
                            className={`h-6 px-2.5 rounded-[6px] text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                              isFeatured
                                ? 'gather-btn-primary text-white'
                                : 'bg-[var(--bg)]/70 border border-[var(--glass-border)] text-[var(--ink-2)] hover:text-[var(--ink)]'
                            }`}
                          >
                            {isFeatured ? 'On Stage' : 'Stage Q&A'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* DISCORD-STYLE AUDIENCE RAISE-HAND STAGE CALL-INS */}
          {deckTab === 'callins' && (
            <div className="flex items-stretch gap-2.5">
              {(room.handRaiseQueue || []).length === 0 ? (
                <div className="text-xs text-[var(--ink-3)] flex items-center gap-2">
                  <Hand className="w-3.5 h-3.5 text-[var(--cyan)]" />
                  <span>
                    Viewers who raise their hand on the Watch Page appear here for 1-click stage call-ins.
                  </span>
                </div>
              ) : (
                (room.handRaiseQueue || []).map((entry) => (
                  <div
                    key={entry.id}
                    className="shrink-0 w-[264px] p-2.5 rounded-[10px] bg-[var(--fill)] border border-[var(--cyan)]/40 flex flex-col justify-between gap-1.5"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--ink)] truncate">
                        {entry.name}
                      </div>
                      <p className="text-[11px] text-[var(--ink-3)] truncate">{entry.topic}</p>
                    </div>
                    <div className="flex items-center justify-end gap-1.5">
                      {isHost && onPromoteHand && (
                        <button
                          type="button"
                          onClick={() => onPromoteHand(entry.id)}
                          className="h-6 px-2.5 rounded-[6px] gather-btn-primary text-white text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0"
                        >
                          Invite to Stage
                        </button>
                      )}
                      {isHost && onLowerHand && (
                        <button
                          type="button"
                          onClick={() => onLowerHand(entry.id)}
                          aria-label="Dismiss hand raise"
                          className="h-6 w-6 grid place-items-center rounded-[6px] bg-[var(--surface-2)] text-[var(--ink-3)] hover:text-[var(--danger)] cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* WAITING LOBBY LAYER */}
          {deckTab === 'lobby' && (
            <div className="flex items-center gap-3">
              {room.lobby.length === 0 ? (
                <div className="text-xs text-[var(--ink-3)] flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" />
                  <span>No guests waiting. Lock the room to screen guests in the Green Room.</span>
                </div>
              ) : (
                room.lobby.map((req) => (
                  <div
                    key={req.id}
                    className="shrink-0 w-[240px] p-3 rounded-[10px] bg-[var(--fill)] border border-[var(--warn)]/45 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--ink)] truncate">
                        {req.name}
                      </div>
                      <div className="text-[11px] text-[var(--ink-3)]">Knocking to join</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onAdmitGuest(req.id)}
                        className="h-7 px-2.5 rounded-[6px] gather-btn-tip text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        <span>Admit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDenyGuest(req.id)}
                        aria-label="Deny"
                        className="h-7 w-7 grid place-items-center rounded-[6px] bg-[var(--surface-2)] text-[var(--danger)] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* SQUAD QUEUE LAYER (Strictly Only When watchMode === 'gamer') */}
          {deckTab === 'squad' && room.watchMode === 'gamer' && (
            <div className="flex items-center gap-3">
              {room.squadQueue.length === 0 ? (
                <div className="text-xs text-[var(--ink-3)] flex items-center gap-2">
                  <Gamepad2 className="w-3.5 h-3.5" />
                  <span>Viewers in Gaming Arena can submit gamertags to join your Squad Queue.</span>
                </div>
              ) : (
                room.squadQueue.map((sq) => (
                  <div
                    key={sq.id}
                    className="shrink-0 px-3.5 py-2.5 rounded-[10px] bg-[var(--fill)] border border-[var(--glass-border)] flex items-center gap-3"
                  >
                    <div>
                      <div className="text-xs font-semibold text-[var(--ink)]">{sq.handle}</div>
                      <div className="text-[11px] text-[var(--ink-3)]">{sq.platform}</div>
                    </div>
                    {isHost && (
                      <button
                        type="button"
                        onClick={() => onRemoveSquadEntry(sq.id)}
                        aria-label="Remove from queue"
                        className="h-7 w-7 grid place-items-center rounded-[6px] bg-[var(--surface-2)] text-[var(--ink-3)] hover:text-[var(--danger)] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ----------------------------------------------------------------
   Gather v5 76px Vertical Icon Rail
   ---------------------------------------------------------------- */
interface RightRailProps {
  activeTab: ConsoleTab;
  panelOpen: boolean;
  aiBusy?: boolean;
  onSelectTab: (tab: ConsoleTab) => void;
  onTogglePanel: () => void;
}

export const RightRail: React.FC<RightRailProps> = ({
  activeTab,
  panelOpen,
  aiBusy = false,
  onSelectTab,
  onTogglePanel,
}) => {
  const railItems: Array<{ id: ConsoleTab; label: string; icon: React.ReactNode }> = [
    { id: 'chat', label: 'Chat', icon: <MessageSquare className="w-[18px] h-[18px]" /> },
    {
      id: 'ai',
      label: 'Cue AI',
      icon: <span className={`gather-orb ${aiBusy ? 'busy' : ''}`} />,
    },
    { id: 'show', label: 'Show', icon: <Layers className="w-[18px] h-[18px]" /> },
    { id: 'shop', label: 'Payouts', icon: <ShoppingBag className="w-[18px] h-[18px]" /> },
    { id: 'look', label: 'Look', icon: <Palette className="w-[18px] h-[18px]" /> },
  ];

  return (
    <nav
      aria-label="Studio panels"
      className="hidden lg:flex w-full min-w-0 flex-col items-stretch gap-1.5 py-3 px-1.5 border-l border-[var(--line)] gather-rail"
    >
      {railItems.map((item) => {
        const active = panelOpen && activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTab(item.id)}
            className={`gather-rail-btn w-full py-2.5 px-1 rounded-[11px] flex flex-col items-center justify-center gap-1 cursor-pointer ${
              active
                ? 'is-active text-[var(--ink)]'
                : 'text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
            }`}
          >
            <span className={active ? 'text-[var(--accent-text)]' : ''}>{item.icon}</span>
            <span className="text-[10.5px] font-medium whitespace-nowrap truncate max-w-full">
              {item.label}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={onTogglePanel}
        aria-label={panelOpen ? 'Hide side panel' : 'Show side panel'}
        className="mt-auto w-full py-2 px-1 rounded-[7px] flex flex-col items-center justify-center gap-1 text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] transition-colors cursor-pointer"
      >
        {panelOpen ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
        <span className="text-[10.5px] font-medium whitespace-nowrap truncate max-w-full">
          {panelOpen ? 'Hide' : 'Open'}
        </span>
      </button>
    </nav>
  );
};

/* ----------------------------------------------------------------
   Gather v5 Architectural 3-Zone Transport Console
   ---------------------------------------------------------------- */
interface BottomDockProps {
  roomCode: string;
  isHost: boolean;
  micOn: boolean;
  camOn: boolean;
  sharingScreen: boolean;
  isRecording: boolean;
  mixerOpen: boolean;
  stingersOpen: boolean;
  editMode: boolean;
  cmdBarOpen: boolean;
  teleprompterOpen?: boolean;
  safeZone916?: boolean;
  aiBusy?: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreen: () => void;
  onPickMediaFile: () => void;
  onToggleRecord: () => void;
  onSaveReplayClip: () => void;
  onToggleMixer: () => void;
  onToggleStingers: () => void;
  onToggleEditMode: () => void;
  onToggleCmdBar: () => void;
  onOpenAiMedia?: () => void;
  onToggleTeleprompter?: () => void;
  onOpenPodcastHub?: () => void;
  onToggleSafeZone916?: () => void;
  onLeaveStudio: () => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  roomCode,
  isHost,
  micOn,
  camOn,
  sharingScreen,
  isRecording,
  mixerOpen,
  stingersOpen,
  editMode,
  cmdBarOpen,
  teleprompterOpen = false,
  safeZone916 = false,
  aiBusy = false,
  onToggleMic,
  onToggleCam,
  onToggleScreen,
  onPickMediaFile,
  onToggleRecord,
  onSaveReplayClip,
  onToggleMixer,
  onToggleStingers,
  onToggleEditMode,
  onToggleCmdBar,
  onOpenAiMedia,
  onToggleTeleprompter,
  onOpenPodcastHub,
  onToggleSafeZone916,
  onLeaveStudio,
}) => {
  const [presentMenuOpen, setPresentMenuOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [playingCount, setPlayingCount] = useState(() => audioEngine.getActiveIds().length);
  const presentWrapRef = useRef<HTMLDivElement | null>(null);
  const toolsWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return audioEngine.subscribe(() => {
      setPlayingCount(audioEngine.getActiveIds().length);
    });
  }, []);

  useEffect(() => {
    if (!presentMenuOpen && !toolsMenuOpen) return;
    const onPointerDown = (ev: MouseEvent) => {
      const target = ev.target as Node;
      if (presentWrapRef.current && !presentWrapRef.current.contains(target)) {
        setPresentMenuOpen(false);
      }
      if (toolsWrapRef.current && !toolsWrapRef.current.contains(target)) {
        setToolsMenuOpen(false);
      }
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setPresentMenuOpen(false);
        setToolsMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [presentMenuOpen, toolsMenuOpen]);

  const activeToolsCount =
    (editMode ? 1 : 0) + (teleprompterOpen ? 1 : 0) + (safeZone916 ? 1 : 0);

  const dockBtn =
    'relative h-9 px-2 sm:px-3 rounded-full inline-flex items-center justify-center gap-1.5 text-[12px] font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';

  return (
    <footer className="gather-dock relative shrink-0 h-[60px] sm:h-[58px] px-1.5 sm:px-4 flex items-center justify-between gap-1 sm:gap-3 pb-[env(safe-area-inset-bottom)]">
      {/* Zone 1: AV Inputs & Stage Presenting */}
      <div className="gather-dock-group flex items-center gap-0.5 min-w-0">
        <button
          type="button"
          onClick={onToggleMic}
          title="Toggle Microphone (M)"
          aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
          className={`${dockBtn} ${
            micOn
              ? 'text-[var(--ink)] hover:bg-[var(--fill-hover)]'
              : 'gather-btn-live'
          }`}
        >
          {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          <span className="hidden md:inline">{micOn ? 'Mic' : 'Muted'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleCam}
          title="Toggle Camera (V)"
          aria-label={camOn ? 'Turn camera off' : 'Turn camera on'}
          className={`${dockBtn} ${
            camOn
              ? 'text-[var(--ink)] hover:bg-[var(--fill-hover)]'
              : 'gather-btn-live'
          }`}
        >
          {camOn ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
          <span className="hidden md:inline">{camOn ? 'Camera' : 'Cam off'}</span>
        </button>

        <div ref={presentWrapRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setToolsMenuOpen(false);
              setPresentMenuOpen((v) => !v);
            }}
            aria-label="Present screen, slides or media"
            aria-expanded={presentMenuOpen}
            className={`${dockBtn} ${
              sharingScreen || presentMenuOpen
                ? 'bg-[var(--accent-soft)] text-[var(--ink)]'
                : 'text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
            }`}
          >
            <MonitorUp className="w-4 h-4" />
            <span className="hidden md:inline">{sharingScreen ? 'Sharing' : 'Present'}</span>
          </button>

          {presentMenuOpen && (
            <div className="absolute bottom-11 left-0 z-50 w-64 p-1.5 rounded-[13px] gather-dropdown-surface divide-y divide-[var(--line)] animate-gather-modal">
              <button
                type="button"
                onClick={() => {
                  setPresentMenuOpen(false);
                  onToggleScreen();
                }}
                className="w-full p-2.5 rounded-[7px] hover:bg-[var(--fill-hover)] text-left flex items-start gap-2.5 cursor-pointer"
              >
                <MonitorUp className="w-4 h-4 text-[var(--accent-text)] mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-medium text-[var(--ink)]">
                    {sharingScreen ? 'Stop screen share' : 'Share screen'}
                  </div>
                  <div className="text-[11px] text-[var(--ink-3)]">
                    Window, game, or browser tab
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPresentMenuOpen(false);
                  onPickMediaFile();
                }}
                className="w-full p-2.5 rounded-[7px] hover:bg-[var(--fill-hover)] text-left flex items-start gap-2.5 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-[var(--accent-text)] mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-medium text-[var(--ink)]">Present slides / PDF</div>
                  <div className="text-[11px] text-[var(--ink-3)]">Page-by-page PDF deck</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPresentMenuOpen(false);
                  onPickMediaFile();
                }}
                className="w-full p-2.5 rounded-[7px] hover:bg-[var(--fill-hover)] text-left flex items-start gap-2.5 cursor-pointer"
              >
                <Video className="w-4 h-4 text-[var(--accent-text)] mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-medium text-[var(--ink)]">Play video or image</div>
                  <div className="text-[11px] text-[var(--ink-3)]">MP4, WebM, PNG, or JPG</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Zone 2: Core Production & Capture Controls */}
      <div className="gather-dock-group flex items-center gap-0.5 min-w-0">
        <button
          type="button"
          onClick={onToggleMixer}
          title="Pro Audio Mix Bus & Auto-Ducker"
          className={`${dockBtn} ${
            mixerOpen
              ? 'bg-[var(--accent-soft)] text-[var(--ink)]'
              : 'text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Mixer</span>
        </button>

        <button
          type="button"
          onClick={onToggleStingers}
          title="Custom Stingers & Broadcast Audio FX (S)"
          className={`${dockBtn} ${
            stingersOpen || playingCount > 0
              ? 'bg-[var(--accent-soft)] text-[var(--ink)]'
              : 'text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
          }`}
        >
          <Music2 className="w-3.5 h-3.5 text-[var(--accent-text)]" />
          <span className="hidden sm:inline font-mono-num">
            {playingCount > 0 ? `FX (${playingCount})` : 'Stingers'}
          </span>
        </button>

        <span className="hidden sm:block h-4 w-px bg-[var(--line)] mx-1 shrink-0" aria-hidden="true" />

        <button
          type="button"
          onClick={onToggleRecord}
          className={`${dockBtn} ${
            isRecording
              ? 'gather-btn-live'
              : 'text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
          }`}
        >
          {isRecording ? (
            <Square className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Circle className="w-3.5 h-3.5 fill-[var(--live)] text-[var(--live)]" />
          )}
          <span className="hidden sm:inline">{isRecording ? 'Stop rec' : 'Record'}</span>
        </button>

        <button
          type="button"
          onClick={onSaveReplayClip}
          title="Save last 30s Replay Clip"
          className={`${dockBtn} text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]`}
        >
          <Clapperboard className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Clip 30s</span>
        </button>

        <button
          type="button"
          onClick={onToggleCmdBar}
          title="Cue AI Producer (/)"
          className={`${dockBtn} ${
            cmdBarOpen
              ? 'bg-[var(--accent-soft)] text-[var(--ink)]'
              : 'text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
          }`}
        >
          <span className={`gather-orb !w-3.5 !h-3.5 ${aiBusy ? 'busy' : ''}`} />
          <span className="hidden sm:inline">AI Cue</span>
        </button>

        {/* Consolidated Production Tools Popover */}
        <div ref={toolsWrapRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setPresentMenuOpen(false);
              setToolsMenuOpen((v) => !v);
            }}
            title="Production Tools: Prompter, Layout Designer, 9:16 Safe, AI Media, Podcast"
            className={`${dockBtn} ${
              toolsMenuOpen || activeToolsCount > 0
                ? 'bg-[var(--accent-soft)] text-[var(--ink)]'
                : 'text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Tools</span>
            {activeToolsCount > 0 && (
              <span className="font-mono-num text-[10px] text-[var(--accent-text)]">
                {activeToolsCount}
              </span>
            )}
          </button>

          {toolsMenuOpen && (
            <div className="absolute bottom-11 right-0 z-50 w-64 p-1.5 rounded-[13px] gather-dropdown-surface space-y-0.5 animate-gather-modal">
              {onToggleTeleprompter && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleTeleprompter();
                    setToolsMenuOpen(false);
                  }}
                  className="w-full p-2 rounded-[7px] hover:bg-[var(--fill-hover)] text-left flex items-center justify-between gap-2.5 cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2.5 text-xs font-medium text-[var(--ink)]">
                    <FileText className="w-3.5 h-3.5 text-[var(--ink-2)]" />
                    <span>Teleprompter</span>
                  </span>
                  <span className="text-[10.5px] font-mono-num text-[var(--accent-text)]">
                    {teleprompterOpen ? 'On' : ''}
                  </span>
                </button>
              )}

              {isHost && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleEditMode();
                    setToolsMenuOpen(false);
                  }}
                  className="w-full p-2 rounded-[7px] hover:bg-[var(--fill-hover)] text-left flex items-center justify-between gap-2.5 cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2.5 text-xs font-medium text-[var(--ink)]">
                    <Move className="w-3.5 h-3.5 text-[var(--ink-2)]" />
                    <span>Stage Designer</span>
                  </span>
                  <span className="text-[10.5px] font-mono-num text-[var(--accent-text)]">
                    {editMode ? 'Editing' : ''}
                  </span>
                </button>
              )}

              {isHost && onToggleSafeZone916 && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleSafeZone916();
                    setToolsMenuOpen(false);
                  }}
                  className="w-full p-2 rounded-[7px] hover:bg-[var(--fill-hover)] text-left flex items-center justify-between gap-2.5 cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2.5 text-xs font-medium text-[var(--ink)]">
                    <Smartphone className="w-3.5 h-3.5 text-[var(--ink-2)]" />
                    <span>9:16 Safe Frame</span>
                  </span>
                  <span className="text-[10.5px] font-mono-num text-[var(--accent-text)]">
                    {safeZone916 ? 'On' : ''}
                  </span>
                </button>
              )}

              {onOpenAiMedia && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenAiMedia();
                    setToolsMenuOpen(false);
                  }}
                  className="w-full p-2 rounded-[7px] hover:bg-[var(--fill-hover)] text-left flex items-center gap-2.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  <span className="text-xs font-medium text-[var(--ink)]">
                    AI Media &amp; Magic Clips
                  </span>
                </button>
              )}

              {onOpenPodcastHub && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenPodcastHub();
                    setToolsMenuOpen(false);
                  }}
                  className="w-full p-2 rounded-[7px] hover:bg-[var(--fill-hover)] text-left flex items-center gap-2.5 cursor-pointer"
                >
                  <Rss className="w-3.5 h-3.5 text-[var(--ok)]" />
                  <span className="text-xs font-medium text-[var(--ink)]">
                    Podcast Audio &amp; RSS
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Zone 3: Room Code & Leave */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden lg:flex items-center gap-1.5 text-[11.5px] text-[var(--ink-3)] font-mono-num">
          <span>{roomCode}</span>
          <span>·</span>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(`${window.location.origin}/?join=${roomCode}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
            className="inline-flex items-center gap-1 text-[var(--ink-2)] hover:text-[var(--ink)] whitespace-nowrap cursor-pointer transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-[var(--ok)]" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy invite'}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onLeaveStudio}
          aria-label="Leave studio"
          className="h-8 px-3 rounded-[7px] text-[12px] font-medium text-[var(--ink-2)] hover:bg-[var(--live)] hover:text-white inline-flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
        >
          <PhoneOff className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Leave</span>
        </button>
      </div>
    </footer>
  );
};
