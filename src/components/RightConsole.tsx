import React from 'react';
import { FileText, Volume2 } from 'lucide-react';
import { AiCueTab } from './console/AiCueTab';
import { ChatTab } from './console/ChatTab';
import { ConsoleTab, RightConsoleProps } from './console/consoleTypes';
import { LookTab } from './console/LookTab';
import { ShopTab } from './console/ShopTab';
import { ShowTab } from './console/ShowTab';

export type { ConsoleTab, RightConsoleProps };

const PANEL_HEADERS: Record<ConsoleTab, { title: string; subtitle: string }> = {
  chat: { title: 'Chat', subtitle: 'Public viewers, studio crew & Q&A' },
  ai: { title: 'Cue AI', subtitle: 'Showrunner, cues & Auto-Director' },
  show: { title: 'Show', subtitle: 'Banners, captions & rundown' },
  shop: { title: 'Payouts', subtitle: 'Tips & live catalog drops' },
  look: { title: 'Look', subtitle: 'Stage layout, overlays & brand' },
};

export const RightConsole: React.FC<RightConsoleProps> = ({
  room,
  isHost,
  actorId = 'studio-host',
  open,
  activeTab,
  aiLogs,
  aiBusy,
  aiVoiceReadout,
  autoDirectorEnabled,
  autoDirectorSensitivity,
  autoDirectorAnalyzing,
  autoDirectorLogs,
  onToggleAutoDirector,
  onChangeAutoDirectorSensitivity,
  onTriggerAutoDirector,
  onApproveAutoSuggestion,
  onDismissAutoSuggestion,
  onToggleAiVoiceReadout,
  onAskAi,
  onPushAiToStage,
  onGenerateShowNotes,
  onPatchRoom,
  onSendChat,
  onShareChatToPublic,
  onToggleChatLike,
  onToggleChatReaction,
  onPinChatMessage,
  onDeleteChatMessage,
  onBlockChatUser,
  onUnblockChatUser,
  onFeatureChat,
  onFeatureQuestion,
  onPinProduct,
  onStartFlashSale,
  onStopFlashSale,
  onLaunchPoll,
  onClosePoll,
  onRunRundownStep,
  onToggleCaptions,
  onSelectBrandFile,
  brandKits,
  onApplyBrandKit,
  onSaveBrandKit,
  onOpenAiStudio,
  onNotify,
  lookSubTab,
  onChangeLookSubTab,
  editMode,
  onToggleEditMode,
  selectedStageElId,
  onSelectStageEl,
  snapToGrid,
  onToggleSnapToGrid,
  onResetCustomElements,
  onSaveScenePreset,
  onApplyScenePreset,
  onDeleteScenePreset,
}) => {
  if (!open) return null;

  const header = PANEL_HEADERS[activeTab];

  return (
    <aside className="w-full h-full min-w-0 min-h-0 flex flex-col overflow-hidden bg-transparent">
      <header className="px-4 py-3 border-b border-[var(--line)] shrink-0 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[14.5px] font-medium text-[var(--ink)] leading-tight tracking-[-0.015em]">
            {header.title}
          </h2>
          <p className="text-[11px] text-[var(--ink-3)] mt-0.5 truncate">{header.subtitle}</p>
        </div>
        {activeTab === 'ai' && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onToggleAiVoiceReadout}
              title="Speak AI replies aloud"
              className={`h-7 px-2 rounded-[6px] text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                aiVoiceReadout
                  ? 'gather-btn-primary text-white'
                  : 'bg-[var(--fill)] text-[var(--ink-3)] hover:text-[var(--ink)]'
              }`}
            >
              <Volume2 className="w-3 h-3" />
              <span>Voice</span>
            </button>
            <button
              type="button"
              onClick={onGenerateShowNotes}
              title="Export Markdown Show Notes"
              className="h-7 px-2 rounded-[6px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] text-[11px] font-medium text-[var(--ink-2)] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <FileText className="w-3 h-3" />
              <span>Notes</span>
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto gather-scroll p-3.5 pb-8 space-y-4">
        {activeTab === 'show' && (
          <ShowTab
            room={room}
            isHost={isHost}
            onPatchRoom={onPatchRoom}
            onLaunchPoll={onLaunchPoll}
            onClosePoll={onClosePoll}
            onRunRundownStep={onRunRundownStep}
            onToggleCaptions={onToggleCaptions}
          />
        )}

        {activeTab === 'chat' && (
          <ChatTab
            room={room}
            isHost={isHost}
            actorId={actorId}
            onSendChat={onSendChat}
            onShareChatToPublic={onShareChatToPublic}
            onToggleChatLike={onToggleChatLike}
            onToggleChatReaction={onToggleChatReaction}
            onPinChatMessage={onPinChatMessage}
            onDeleteChatMessage={onDeleteChatMessage}
            onBlockChatUser={onBlockChatUser}
            onUnblockChatUser={onUnblockChatUser}
            onFeatureChat={onFeatureChat}
            onFeatureQuestion={onFeatureQuestion}
          />
        )}

        {activeTab === 'shop' && (
          <ShopTab
            room={room}
            onPatchRoom={onPatchRoom}
            onPinProduct={onPinProduct}
            onStartFlashSale={onStartFlashSale}
            onStopFlashSale={onStopFlashSale}
            brandKits={brandKits}
            onApplyBrandKit={onApplyBrandKit}
            onSaveBrandKit={onSaveBrandKit}
            onOpenAiStudio={onOpenAiStudio}
            onNotify={onNotify}
          />
        )}

        {activeTab === 'ai' && (
          <AiCueTab
            room={room}
            isHost={isHost}
            aiLogs={aiLogs}
            aiBusy={aiBusy}
            autoDirectorEnabled={autoDirectorEnabled}
            autoDirectorSensitivity={autoDirectorSensitivity}
            autoDirectorAnalyzing={autoDirectorAnalyzing}
            autoDirectorLogs={autoDirectorLogs}
            onToggleAutoDirector={onToggleAutoDirector}
            onChangeAutoDirectorSensitivity={onChangeAutoDirectorSensitivity}
            onTriggerAutoDirector={onTriggerAutoDirector}
            onApproveAutoSuggestion={onApproveAutoSuggestion}
            onDismissAutoSuggestion={onDismissAutoSuggestion}
            onAskAi={onAskAi}
            onPushAiToStage={onPushAiToStage}
          />
        )}

        {activeTab === 'look' && (
          <LookTab
            room={room}
            onPatchRoom={onPatchRoom}
            onSelectBrandFile={onSelectBrandFile}
            brandKits={brandKits}
            onApplyBrandKit={onApplyBrandKit}
            onSaveBrandKit={onSaveBrandKit}
            onOpenAiStudio={onOpenAiStudio}
            onNotify={onNotify}
            lookSubTab={lookSubTab}
            onChangeLookSubTab={onChangeLookSubTab}
            editMode={editMode}
            onToggleEditMode={onToggleEditMode}
            selectedStageElId={selectedStageElId}
            onSelectStageEl={onSelectStageEl}
            snapToGrid={snapToGrid}
            onToggleSnapToGrid={onToggleSnapToGrid}
            onResetCustomElements={onResetCustomElements}
            onSaveScenePreset={onSaveScenePreset}
            onApplyScenePreset={onApplyScenePreset}
            onDeleteScenePreset={onDeleteScenePreset}
          />
        )}
      </div>
    </aside>
  );
};
