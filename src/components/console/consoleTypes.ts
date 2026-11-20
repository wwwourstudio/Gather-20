import {
  AutoDirectorLogEntry,
  AutoDirectorSensitivity,
} from '../../hooks/useAutoDirector';
import {
  AILogEntry,
  BrandKit,
  ChatReplyRef,
  RoomState,
  RundownStep,
} from '../../types/studio';

export type ConsoleTab = 'show' | 'chat' | 'shop' | 'ai' | 'look';

export interface RightConsoleProps {
  room: RoomState;
  isHost: boolean;
  actorId?: string;
  open: boolean;
  activeTab: ConsoleTab;
  aiLogs: AILogEntry[];
  aiBusy: boolean;
  aiVoiceReadout: boolean;
  autoDirectorEnabled?: boolean;
  autoDirectorSensitivity?: AutoDirectorSensitivity;
  autoDirectorAnalyzing?: boolean;
  autoDirectorLogs?: AutoDirectorLogEntry[];
  onToggleAutoDirector?: () => void;
  onChangeAutoDirectorSensitivity?: (sensitivity: AutoDirectorSensitivity) => void;
  onTriggerAutoDirector?: () => void;
  onApproveAutoSuggestion?: (entryId: string) => void;
  onDismissAutoSuggestion?: (entryId: string) => void;
  onToggleAiVoiceReadout: () => void;
  onAskAi: (prompt: string) => void;
  onPushAiToStage: (entry: AILogEntry) => void;
  onGenerateShowNotes: () => void;
  onPatchRoom: (patch: Record<string, unknown>) => void;
  onSendChat: (text: string, replyTo?: ChatReplyRef, audience?: 'public' | 'studio') => void;
  onShareChatToPublic?: (messageId: string) => void;
  onToggleChatLike?: (messageId: string) => void;
  onToggleChatReaction?: (messageId: string, emoji: string) => void;
  onPinChatMessage?: (messageId: string | null) => void;
  onDeleteChatMessage?: (messageId: string) => void;
  onBlockChatUser?: (author: string, uid?: string) => void;
  onUnblockChatUser?: (blockId: string) => void;
  onFeatureChat: (id: string | null) => void;
  onFeatureQuestion?: (id: string | null) => void;
  onPinProduct: (id: string | null) => void;
  onStartFlashSale?: (payload: {
    productId: string;
    discountPct: number;
    totalUnits: number;
    durationMin: number;
    tagline?: string;
  }) => void;
  onStopFlashSale?: () => void;
  onLaunchPoll: (question: string, options: string[], showOnStage: boolean) => void;
  onClosePoll: (clear?: boolean) => void;
  onRunRundownStep: (step: RundownStep) => void;
  onToggleCaptions: () => void;
  onSelectBrandFile: (kind: 'backdrop' | 'logo' | 'overlay', file: File) => void;
  brandKits?: BrandKit[];
  onApplyBrandKit?: (kit: BrandKit, options?: { openShop?: boolean }) => void;
  onSaveBrandKit?: (kit: BrandKit) => Promise<void> | void;
  onOpenAiStudio?: (tab?: 'pdf' | 'graphics' | 'kits' | 'audio' | 'bumper' | 'clips' | 'podcast') => void;
  onNotify?: (msg: string) => void;
  lookSubTab?: 'layout' | 'brand';
  onChangeLookSubTab?: (sub: 'layout' | 'brand') => void;
  editMode?: boolean;
  onToggleEditMode?: () => void;
  selectedStageElId?: string | null;
  onSelectStageEl?: (id: string | null) => void;
  snapToGrid?: boolean;
  onToggleSnapToGrid?: () => void;
  onResetCustomElements?: () => void;
  onSaveScenePreset?: (name: string) => void;
  onApplyScenePreset?: (presetId: string) => void;
  onDeleteScenePreset?: (presetId: string) => void;
}

export const CONSOLE_INPUT_CLS =
  'h-8 px-2.5 rounded-[7px] bg-[var(--bg)]/80 border border-[var(--glass-border)] text-xs text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--accent)]';

const AVATAR_TONES = [
  'bg-sky-500/20 text-sky-600 dark:text-sky-300 border-sky-400/35',
  'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border-indigo-400/35',
  'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-400/35',
  'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-400/35',
  'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-400/35',
  'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border-cyan-400/35',
];

export function getConsoleAvatarStyle(name: string): { initials: string; cls: string } {
  const clean = name.trim() || 'G';
  const initials =
    clean
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || '')
      .join('') || 'G';
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
  }
  return { initials, cls: AVATAR_TONES[hash % AVATAR_TONES.length] };
}
