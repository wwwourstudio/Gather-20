import { SCENE_TEMPLATES, VERTICAL_TEMPLATES } from '../constants/studioDefaults';
import { CustomScenePreset, TransitionType } from '../types/studio';

export type SmartTransitionCategory = 'heavy-media' | 'participant-reorder' | 'steady';
export type SmartTransitionSource = 'deck' | 'shortcut' | 'ai' | 'rundown' | 'media';

export interface SmartTransitionRecommendation {
  transitionType: TransitionType;
  transitionMs: number;
  category: SmartTransitionCategory;
  beatSynced?: boolean;
  bpm?: number;
  label: string;
  reason: string;
}

export interface SmartTransitionHistoryEntry {
  id: string;
  timestamp: number;
  fromTemplateId: string;
  fromName: string;
  toTemplateId: string;
  toName: string;
  prevTransitionType: TransitionType;
  prevTransitionMs: number;
  chosenTransitionType: TransitionType;
  chosenTransitionMs: number;
  category: SmartTransitionCategory;
  beatSynced: boolean;
  bpm?: number;
  reason: string;
  source: SmartTransitionSource;
  reverted?: boolean;
  overriddenType?: TransitionType;
}

const HEAVY_MEDIA_TEMPLATES = new Set([
  'screen-cam',
  'slides-cam',
  'pip',
  'full-media',
  'v-screen',
  'v-slides',
]);

const FULL_MEDIA_TEMPLATES = new Set(['pip', 'full-media', 'v-slides']);

const MULTI_PARTICIPANT_TEMPLATES = new Set([
  'duo',
  'spotlight',
  'trio',
  'grid4',
  'grid6',
  'v-duo',
]);

export function getSceneDisplayName(
  templateId: string,
  savedPresets: CustomScenePreset[] = []
): string {
  const custom = savedPresets.find((p) => p.id === templateId);
  if (custom) return custom.name;
  const tpl =
    SCENE_TEMPLATES.find((t) => t.id === templateId) ||
    VERTICAL_TEMPLATES.find((t) => t.id === templateId);
  if (tpl) return tpl.name;
  if (templateId === 'custom') return 'Custom Scene';
  return templateId;
}

function isMediaHeavyScene(
  templateId: string,
  presets: CustomScenePreset[],
  activeCustomHasMedia: boolean
): boolean {
  if (HEAVY_MEDIA_TEMPLATES.has(templateId)) return true;
  const preset = presets.find((p) => p.id === templateId);
  if (preset) {
    return (
      HEAVY_MEDIA_TEMPLATES.has(preset.baseTemplateId) ||
      preset.elements.some((el) => el.kind === 'media')
    );
  }
  return activeCustomHasMedia;
}

function withBeatTiming(
  base: SmartTransitionRecommendation,
  beatSync: boolean,
  bpm: number
): SmartTransitionRecommendation {
  if (!beatSync) return base;
  const safeBpm = Math.max(60, Math.min(180, Math.round(bpm || 120)));
  const beatMs = 60000 / safeBpm;
  const alignedMs =
    base.transitionType === 'cut'
      ? 120
      : Math.max(160, Math.min(420, Math.round(beatMs * 0.55)));
  return {
    ...base,
    transitionMs: alignedMs,
    beatSynced: true,
    bpm: safeBpm,
    label: `Beat-Sync · ${safeBpm} BPM (${base.transitionType})`,
    reason: `${base.reason} · locked to ${safeBpm} BPM downbeat`,
  };
}

export function recommendSmartTransition(params: {
  fromTemplateId: string;
  toTemplateId: string;
  savedPresets?: CustomScenePreset[];
  hasActiveMedia?: boolean;
  onStageCount?: number;
  customHasMedia?: boolean;
  beatSync?: boolean;
  bpm?: number;
}): SmartTransitionRecommendation {
  const {
    fromTemplateId,
    toTemplateId,
    savedPresets = [],
    hasActiveMedia = false,
    onStageCount = 1,
    customHasMedia = false,
    beatSync = false,
    bpm = 120,
  } = params;

  if (fromTemplateId === toTemplateId) {
    return withBeatTiming(
      {
        transitionType: 'cut',
        transitionMs: 120,
        category: 'steady',
        label: 'Cut',
        reason: 'Active layout already framed',
      },
      beatSync,
      bpm
    );
  }

  const fromHeavy = isMediaHeavyScene(fromTemplateId, savedPresets, customHasMedia);
  const toHeavy = isMediaHeavyScene(toTemplateId, savedPresets, customHasMedia);

  // 1. Heavy media transitions (entering, leaving, or swapping screen share / deck / full-stage video)
  if (fromHeavy || toHeavy) {
    const switchingBetweenTwoMediaScenes = fromHeavy && toHeavy;
    if (
      switchingBetweenTwoMediaScenes &&
      (FULL_MEDIA_TEMPLATES.has(toTemplateId) || FULL_MEDIA_TEMPLATES.has(fromTemplateId))
    ) {
      return withBeatTiming(
        {
          transitionType: 'push',
          transitionMs: 360,
          category: 'heavy-media',
          label: 'Push · 360ms',
          reason: 'Heavy media swap — smooth vertical stage push',
        },
        beatSync,
        bpm
      );
    }

    if (!fromHeavy && toHeavy && hasActiveMedia) {
      return withBeatTiming(
        {
          transitionType: 'dissolve',
          transitionMs: 360,
          category: 'heavy-media',
          label: 'Dissolve · 360ms',
          reason: 'Heavy media load — crossfade frames cleanly',
        },
        beatSync,
        bpm
      );
    }

    return withBeatTiming(
      {
        transitionType: 'dissolve',
        transitionMs: 320,
        category: 'heavy-media',
        label: 'Dissolve · 320ms',
        reason: 'Media layer load — soft optical dissolve',
      },
      beatSync,
      bpm
    );
  }

  // 2. Participant re-ordering & camera geometry adjustments
  const toSingleSpeaker = toTemplateId === 'solo' || toTemplateId === 'v-solo';
  const fromMulti = MULTI_PARTICIPANT_TEMPLATES.has(fromTemplateId);
  const toMulti = MULTI_PARTICIPANT_TEMPLATES.has(toTemplateId);

  if (toSingleSpeaker && fromMulti) {
    return withBeatTiming(
      {
        transitionType: 'cut',
        transitionMs: 120,
        category: 'participant-reorder',
        label: 'Cut · Instant',
        reason: 'Participant punch-in — crisp live camera cut',
      },
      beatSync,
      bpm
    );
  }

  if (toMulti || onStageCount > 1) {
    return withBeatTiming(
      {
        transitionType: 'slide',
        transitionMs: 260,
        category: 'participant-reorder',
        label: 'Slide · 260ms',
        reason: 'Participant re-order — spatial seat glide',
      },
      beatSync,
      bpm
    );
  }

  return withBeatTiming(
    {
      transitionType: 'cut',
      transitionMs: 120,
      category: 'participant-reorder',
      label: 'Cut · Instant',
      reason: 'Direct camera re-framing',
    },
    beatSync,
    bpm
  );
}
