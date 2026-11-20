import React, { useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Award,
  Camera,
  Check,
  Clock,
  Copy,
  Eye,
  EyeOff,
  FolderHeart,
  Gamepad2,
  Layers,
  Loader2,
  Lock,
  MessageSquare,
  Monitor,
  Move,
  QrCode,
  RotateCcw,
  Save,
  Sparkles,
  Square,
  Trash2,
  Type,
  Unlock,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import {
  ACCENT_SWATCHES,
  BACKDROP_PRESETS,
  DEFAULT_SPONSORS,
  STAGE_FONTS,
} from '../../constants/studioDefaults';
import {
  BackdropId,
  BrandBannerPreset,
  BrandKit,
  buildBoxesForTemplate,
  CustomStageElement,
  FrameStyle,
  GearSpec,
  NameTagStyle,
  OverlayGenMode,
  RoomState,
  SponsorBanner,
  StageFont,
  StageFontPreset,
  StageFrameStyle,
  WatchMode,
} from '../../types/studio';
import { sanitizeSvg, svgToCompactDataUrl } from '../../utils/aiGraphicRenderer';
import { CONSOLE_INPUT_CLS } from './consoleTypes';

interface LookTabProps {
  room: RoomState;
  onPatchRoom: (patch: Record<string, unknown>) => void;
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

const LOOK_VIBE_PRESETS: Array<{ label: string; mode: OverlayGenMode; prompt: string }> = [
  {
    label: 'Esports Tactical',
    mode: 'hud-frame',
    prompt: 'Sharp carbon tactical FPS HUD perimeter bezel with glowing corner brackets',
  },
  {
    label: 'Neon Arcade',
    mode: 'webcam-frame',
    prompt: 'Cyber neon webcam bezel frame with angled holographic corners',
  },
  {
    label: 'Cozy Lo-Fi',
    mode: 'backdrop',
    prompt: 'Warm twilight studio loft gradient with subtle architectural light beams',
  },
  {
    label: 'Executive',
    mode: 'logo',
    prompt: 'Minimalist geometric broadcast emblem monogram with clean circular ring',
  },
];

function mapFontToPreset(font: StageFont): StageFontPreset {
  if (font === 'DM Serif Display') return 'Instrument Serif';
  if (font === 'Bebas Neue') return 'Oswald';
  if (font === 'JetBrains Mono' || font === 'Playfair Display' || font === 'Plus Jakarta Sans') {
    return font;
  }
  return 'Plus Jakarta Sans';
}

function mapFrameToPreset(frame: FrameStyle): StageFrameStyle {
  if (frame === 'none') return 'none';
  if (frame === 'border') return 'rounded';
  if (frame === 'corners') return 'floating';
  return 'cinema';
}

function mapBannerToPreset(style: RoomState['overlays']['banner']['style']): BrandBannerPreset {
  if (style === 'broadcast' || style === 'block') return 'breaking';
  if (style === 'minimal') return 'minimal';
  if (style === 'glass') return 'ticker';
  return 'classic';
}

function getKindIcon(kind: CustomStageElement['kind']) {
  switch (kind) {
    case 'participant':
      return <Camera className="w-3.5 h-3.5 text-[var(--accent-text)]" />;
    case 'media':
    case 'image':
      return <Monitor className="w-3.5 h-3.5 text-[var(--cyan)]" />;
    case 'ai':
      return <Sparkles className="w-3.5 h-3.5 text-sky-400" />;
    case 'chat':
      return <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />;
    case 'clock':
      return <Clock className="w-3.5 h-3.5 text-amber-400" />;
    case 'qr':
      return <QrCode className="w-3.5 h-3.5 text-[var(--ink-2)]" />;
    case 'text':
      return <Type className="w-3.5 h-3.5 text-[var(--ink)]" />;
    default:
      return <Square className="w-3.5 h-3.5 text-[var(--ink-3)]" />;
  }
}

export const LookTab: React.FC<LookTabProps> = ({
  room,
  onPatchRoom,
  onSelectBrandFile,
  brandKits = [],
  onApplyBrandKit,
  onSaveBrandKit,
  onOpenAiStudio,
  onNotify,
  lookSubTab: controlledSubTab,
  onChangeLookSubTab,
  editMode = false,
  onToggleEditMode,
  selectedStageElId = null,
  onSelectStageEl,
  snapToGrid = true,
  onToggleSnapToGrid,
  onResetCustomElements,
  onSaveScenePreset,
  onApplyScenePreset,
  onDeleteScenePreset,
}) => {
  const [internalSubTab, setInternalSubTab] = useState<'layout' | 'brand'>('layout');
  const subTab = controlledSubTab ?? internalSubTab;
  const setSubTab = (sub: 'layout' | 'brand') => {
    if (onChangeLookSubTab) onChangeLookSubTab(sub);
    else setInternalSubTab(sub);
  };

  const [presetNameDraft, setPresetNameDraft] = useState('');
  const [sponsorDraft, setSponsorDraft] = useState('');
  const [gearLabel, setGearLabel] = useState('');
  const [gearValue, setGearValue] = useState('');

  const [aiMode, setAiMode] = useState<OverlayGenMode>('hud-frame');
  const [aiPrompt, setAiPrompt] = useState(LOOK_VIBE_PRESETS[0].prompt);
  const [aiRefinePrompt, setAiRefinePrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSvg, setAiSvg] = useState<string>('');
  const [aiTitle, setAiTitle] = useState<string>('');
  const [savingKit, setSavingKit] = useState(false);

  const sponsorsList = room.brand.sponsors || DEFAULT_SPONSORS;
  const elements = room.scene.customElements || [];
  const onStageList = room.participants.filter((p) => p.onStage);
  const selectedEl = elements.find((e) => e.id === selectedStageElId) || null;

  const ensureCustomElements = (): CustomStageElement[] => {
    if (
      elements.length > 0 &&
      (room.scene.templateId === 'custom' || room.scene.templateId.startsWith('custom-'))
    ) {
      return elements;
    }
    return buildBoxesForTemplate(
      room.scene.templateId,
      room.aspectRatio,
      room.participants
    );
  };

  const commitElements = (nextEls: CustomStageElement[]) => {
    onPatchRoom({
      scene: {
        ...room.scene,
        templateId: room.scene.templateId.startsWith('custom-')
          ? room.scene.templateId
          : 'custom',
        customElements: nextEls,
      },
    });
  };

  const handleAddElement = (
    kind: CustomStageElement['kind'],
    label: string,
    w: number,
    h: number,
    extra?: Partial<CustomStageElement>
  ) => {
    const base = ensureCustomElements();
    const defaultP = onStageList[0] || room.participants[0];
    const nextEl: CustomStageElement = {
      id: `el-${kind}-${Date.now().toString(36)}`,
      kind,
      label,
      participantId: kind === 'participant' ? defaultP?.id : undefined,
      x: Math.min(0.92 - w, 0.06 + (base.length % 4) * 0.04),
      y: Math.min(0.92 - h, 0.1 + (base.length % 4) * 0.04),
      w,
      h,
      ...extra,
    };
    commitElements([...base, nextEl]);
    onSelectStageEl?.(nextEl.id);
    if (!editMode && onToggleEditMode) onToggleEditMode();
  };

  const handleApplyStarter = (tplId: string) => {
    const p0 = onStageList[0] || room.participants[0];
    const p1 = onStageList[1] || room.participants[1] || p0;
    let nextEls: CustomStageElement[];
    if (tplId === 'news-desk') {
      nextEls = [
        { id: 'tpl-cam', kind: 'participant', label: p0?.name || 'Host', participantId: p0?.id, x: 0.04, y: 0.07, w: 0.62, h: 0.72 },
        { id: 'tpl-media', kind: 'media', label: 'Headline Deck', x: 0.68, y: 0.07, w: 0.28, h: 0.44 },
        { id: 'tpl-qr', kind: 'qr', label: 'Watch QR', x: 0.68, y: 0.54, w: 0.14, h: 0.25 },
        { id: 'tpl-clock', kind: 'clock', label: 'Clock', x: 0.83, y: 0.54, w: 0.13, h: 0.12 },
        { id: 'tpl-bar', kind: 'text', label: 'Ticker', text: 'LIVE COVERAGE · JOIN THE CONVERSATION', x: 0.04, y: 0.82, w: 0.92, h: 0.12 },
      ];
    } else if (tplId === 'screen-qr') {
      nextEls = [
        { id: 'tpl-media', kind: 'media', label: 'Screen / Media', x: 0.03, y: 0.05, w: 0.94, h: 0.9 },
        { id: 'tpl-cam', kind: 'participant', label: p0?.name || 'Host PIP', participantId: p0?.id, x: 0.72, y: 0.62, w: 0.23, h: 0.3, stack: true },
        { id: 'tpl-qr', kind: 'qr', label: 'Watch QR', x: 0.05, y: 0.68, w: 0.13, h: 0.23, stack: true },
      ];
    } else if (tplId === 'podcast-duo') {
      nextEls = [
        { id: 'tpl-p0', kind: 'participant', label: p0?.name || 'Host', participantId: p0?.id, x: 0.04, y: 0.09, w: 0.44, h: 0.68 },
        { id: 'tpl-p1', kind: 'participant', label: p1?.name || 'Guest', participantId: p1?.id, x: 0.52, y: 0.09, w: 0.44, h: 0.68 },
        { id: 'tpl-title', kind: 'text', label: 'Show Title', text: room.title || 'Live Podcast', x: 0.04, y: 0.81, w: 0.68, h: 0.12 },
        { id: 'tpl-clk', kind: 'clock', label: 'Live Clock', x: 0.74, y: 0.81, w: 0.22, h: 0.12 },
      ];
    } else {
      nextEls = buildBoxesForTemplate(tplId, room.aspectRatio, room.participants);
    }
    commitElements(nextEls);
    onSelectStageEl?.(null);
  };

  const updateSelected = (patch: Partial<CustomStageElement>) => {
    if (!selectedEl) return;
    commitElements(
      elements.map((item) => (item.id === selectedEl.id ? { ...item, ...patch } : item))
    );
  };

  const updateElById = (id: string, patch: Partial<CustomStageElement>) => {
    commitElements(elements.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const moveLayer = (id: string, delta: -1 | 1) => {
    const idx = elements.findIndex((i) => i.id === id);
    const nextIdx = idx + delta;
    if (idx < 0 || nextIdx < 0 || nextIdx >= elements.length) return;
    const copy = [...elements];
    const [removed] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, removed);
    commitElements(copy);
  };

  const handleGenerateOverlay = async () => {
    if (!aiPrompt.trim()) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await fetch('/api/ai/overlay-svg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: aiMode,
          prompt: aiPrompt.trim(),
          showTitle: room.title,
          primaryHex: room.brand.accent,
          secondaryHex: '#22d3ee',
          aspectRatio: room.scene.templateId.startsWith('v-') ? '9:16' : '16:9',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI design request failed.');
      const w = aiMode === 'logo' ? 512 : 1920;
      const h = aiMode === 'logo' ? 512 : 1080;
      const clean = sanitizeSvg(String(data.svg || ''), w, h);
      if (!clean) throw new Error('Gemini returned empty SVG markup.');
      setAiSvg(clean);
      setAiTitle(String(data.title || 'AI Stage Graphic'));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to generate overlay');
    } finally {
      setAiBusy(false);
    }
  };

  const handleRefineOverlay = async () => {
    if (!aiSvg || !aiRefinePrompt.trim()) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await fetch('/api/ai/overlay-refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existingSvg: aiSvg,
          instruction: aiRefinePrompt.trim(),
          mode: aiMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refine failed.');
      const w = aiMode === 'logo' ? 512 : 1920;
      const h = aiMode === 'logo' ? 512 : 1080;
      const clean = sanitizeSvg(String(data.svg || ''), w, h);
      if (!clean) throw new Error('Refined SVG was empty.');
      setAiSvg(clean);
      setAiRefinePrompt('');
      onNotify?.('Refined stage graphic.');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to refine graphic');
    } finally {
      setAiBusy(false);
    }
  };

  const handleApplyGenerated = () => {
    if (!aiSvg) return;
    const dataUrl = svgToCompactDataUrl(aiSvg);
    if (aiMode === 'backdrop') {
      onPatchRoom({ brand: { ...room.brand, customBackdropUrl: dataUrl } });
    } else if (aiMode === 'logo') {
      onPatchRoom({ brand: { ...room.brand, logoUrl: dataUrl } });
    } else {
      onPatchRoom({ brand: { ...room.brand, customOverlayUrl: dataUrl } });
    }
    onNotify?.(`Applied ${aiTitle || 'AI graphic'} to stage.`);
  };

  const handleSaveCurrentAsKit = async () => {
    if (!onSaveBrandKit) return;
    setSavingKit(true);
    try {
      const dataUrl = aiSvg ? svgToCompactDataUrl(aiSvg) : '';
      const kit: BrandKit = {
        id: `kit-${Date.now().toString(36)}`,
        name: aiTitle || `${room.title} Brand`,
        storeName: room.commerce.storeLabel || room.title,
        storeTagline: room.overlays.banner.subtitle || room.title,
        niche:
          room.watchMode === 'gamer'
            ? 'gaming'
            : room.watchMode === 'shop'
              ? 'commerce'
              : 'podcast',
        accentHex: room.brand.accent,
        secondaryHex: '#22d3ee',
        backdropPreset: room.brand.backdrop,
        stageFont: mapFontToPreset(room.brand.font),
        frameStyle: mapFrameToPreset(room.brand.frame),
        nameTagStyle: room.brand.nameTagStyle || 'glass',
        bannerStyle: mapBannerToPreset(room.overlays.banner.style),
        bannerTitle: room.overlays.banner.title,
        bannerSubtitle: room.overlays.banner.subtitle,
        overlayUrl: (aiMode !== 'backdrop' && aiMode !== 'logo' ? dataUrl : '') || room.brand.customOverlayUrl || '',
        backdropUrl: (aiMode === 'backdrop' ? dataUrl : '') || room.brand.customBackdropUrl || '',
        logoUrl: (aiMode === 'logo' ? dataUrl : '') || room.brand.logoUrl || '',
        products: [],
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      };
      await onSaveBrandKit(kit);
    } finally {
      setSavingKit(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Segmented Sub-Tab: Layout | Brand */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-[9px] bg-[var(--fill)] border border-[var(--line)]">
        <button
          type="button"
          onClick={() => setSubTab('layout')}
          className={`h-7 rounded-[6px] text-xs font-semibold cursor-pointer transition-colors ${
            subTab === 'layout'
              ? 'gather-btn-primary text-white'
              : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
          }`}
        >
          Layout
        </button>
        <button
          type="button"
          onClick={() => setSubTab('brand')}
          className={`h-7 rounded-[6px] text-xs font-semibold cursor-pointer transition-colors ${
            subTab === 'brand'
              ? 'gather-btn-primary text-white'
              : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
          }`}
        >
          Brand
        </button>
      </div>

      {/* ================================================================
          STAGE LAYOUT DESIGNER (Gather clean panel workflow)
          ================================================================ */}
      {subTab === 'layout' && (
        <div className="divide-y divide-[var(--line)] space-y-4">
          {/* Edit on Stage & Controls */}
          <section className="space-y-2">
            <div className="flex items-center gap-1.5">
              {onToggleEditMode && (
                <button
                  type="button"
                  onClick={() => {
                    if (!editMode && elements.length === 0) {
                      commitElements(
                        buildBoxesForTemplate(
                          room.scene.templateId,
                          room.aspectRatio,
                          room.participants
                        )
                      );
                    }
                    onToggleEditMode();
                  }}
                  className={`flex-1 h-8 px-3 rounded-[8px] text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    editMode
                      ? 'gather-btn-primary text-white'
                      : 'bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line-2)] text-[var(--ink)]'
                  }`}
                >
                  <Move className="w-3.5 h-3.5" />
                  <span>{editMode ? 'Editing Stage' : 'Edit on stage'}</span>
                </button>
              )}

              {onToggleSnapToGrid && (
                <button
                  type="button"
                  onClick={onToggleSnapToGrid}
                  className={`h-8 px-2.5 rounded-[8px] border text-[11px] font-medium cursor-pointer ${
                    snapToGrid
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-line)] text-[var(--ink)]'
                      : 'bg-[var(--fill)] border-[var(--line)] text-[var(--ink-3)]'
                  }`}
                >
                  Snap
                </button>
              )}

              {onResetCustomElements && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectStageEl?.(null);
                    onResetCustomElements();
                  }}
                  title="Reset custom layout"
                  className="h-8 w-8 rounded-[8px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line)] grid place-items-center text-[var(--ink-2)] cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </section>

          {/* Starter Templates */}
          <section className="pt-3.5 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-[var(--ink)]">Starter layouts</span>
              <span className="text-[var(--ink-3)] font-mono-num">{room.aspectRatio}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'solo', label: 'Solo' },
                  { id: 'duo', label: 'Duo' },
                  { id: 'spotlight', label: 'Spotlight' },
                  { id: 'grid-4', label: '2×2 Grid' },
                  { id: 'slides-cam', label: 'Slides' },
                  { id: 'pip-br', label: 'PiP' },
                  { id: 'news-desk', label: 'News Desk' },
                  { id: 'screen-qr', label: 'Screen + QR' },
                  { id: 'podcast-duo', label: 'Podcast' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleApplyStarter(t.id)}
                  className="h-7 px-2 rounded-[7px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line)] hover:border-[var(--accent-line)] text-[11px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] truncate cursor-pointer"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </section>

          {/* Add Stage Elements */}
          <section className="pt-3.5 space-y-2">
            <h3 className="text-[11px] font-semibold text-[var(--ink)]">Add to stage</h3>
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  { kind: 'participant', label: 'Camera', w: 0.34, h: 0.38, icon: Camera },
                  { kind: 'media', label: 'Media', w: 0.5, h: 0.52, icon: Monitor },
                  { kind: 'text', label: 'Text', w: 0.36, h: 0.12, icon: Type, extra: { text: 'Live Broadcast' } },
                  { kind: 'clock', label: 'Clock', w: 0.18, h: 0.12, icon: Clock },
                  { kind: 'chat', label: 'Chat', w: 0.28, h: 0.44, icon: MessageSquare },
                  { kind: 'ai', label: 'Cue AI', w: 0.34, h: 0.18, icon: Sparkles, extra: { text: 'Key takeaway synced from Cue AI' } },
                  { kind: 'qr', label: 'Watch QR', w: 0.15, h: 0.25, icon: QrCode },
                  { kind: 'block', label: 'Block', w: 0.28, h: 0.18, icon: Square },
                ] as Array<{
                  kind: CustomStageElement['kind'];
                  label: string;
                  w: number;
                  h: number;
                  icon: React.ComponentType<{ className?: string }>;
                  extra?: Partial<CustomStageElement>;
                }>
              ).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.kind}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        'application/x-gather-element',
                        JSON.stringify({
                          kind: item.kind,
                          label: item.label,
                          w: item.w,
                          h: item.h,
                          extra: item.extra,
                        })
                      );
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => handleAddElement(item.kind, item.label, item.w, item.h, item.extra)}
                    title={`Click or drag ${item.label} onto the stage`}
                    className="h-12 px-1.5 rounded-[8px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line)] hover:border-[var(--accent-line)] flex flex-col items-center justify-center gap-1 text-[10.5px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] cursor-grab active:cursor-grabbing transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                    <span className="truncate max-w-full">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Layers List */}
          <section className="pt-3.5 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-[var(--ink)]">
                Layers ({elements.length})
              </span>
              {elements.length > 0 && (
                <span className="text-[var(--ink-3)]">Front to back</span>
              )}
            </div>

            {elements.length === 0 ? (
              <p className="text-[11px] text-[var(--ink-3)] py-2">
                Pick a starter layout or add an element above to customize stage positions.
              </p>
            ) : (
              <div className="space-y-1">
                {[...elements].reverse().map((el) => {
                  const isSel = el.id === selectedStageElId;
                  return (
                    <div
                      key={el.id}
                      onClick={() => onSelectStageEl?.(el.id)}
                      className={`px-2 py-1.5 rounded-[7px] border flex items-center justify-between gap-1.5 cursor-pointer transition-colors ${
                        isSel
                          ? 'bg-[var(--accent-soft)] border-[var(--accent-line)]'
                          : 'bg-[var(--fill)] border-[var(--line)] hover:border-[var(--line-2)]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {getKindIcon(el.kind)}
                        <span
                          className={`text-[11.5px] font-medium truncate ${
                            el.hidden ? 'line-through text-[var(--ink-3)]' : 'text-[var(--ink)]'
                          }`}
                        >
                          {el.label}
                        </span>
                        {el.stack && (
                          <span className="text-[9.5px] font-mono-num text-[var(--cyan)] shrink-0">
                            Stack
                          </span>
                        )}
                      </div>

                      <div
                        className="flex items-center gap-0.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          title={el.hidden ? 'Show layer' : 'Hide layer'}
                          onClick={() => updateElById(el.id, { hidden: !el.hidden })}
                          className="w-6 h-6 rounded hover:bg-[var(--fill-hover)] grid place-items-center text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
                        >
                          {el.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                        <button
                          type="button"
                          title={el.locked ? 'Unlock layer' : 'Lock layer'}
                          onClick={() => updateElById(el.id, { locked: !el.locked })}
                          className={`w-6 h-6 rounded hover:bg-[var(--fill-hover)] grid place-items-center cursor-pointer ${
                            el.locked ? 'text-amber-400' : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                          }`}
                        >
                          {el.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        </button>
                        <button
                          type="button"
                          title="Move forward"
                          onClick={() => moveLayer(el.id, 1)}
                          className="w-6 h-6 rounded hover:bg-[var(--fill-hover)] grid place-items-center text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          title="Move backward"
                          onClick={() => moveLayer(el.id, -1)}
                          className="w-6 h-6 rounded hover:bg-[var(--fill-hover)] grid place-items-center text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          title="Remove layer"
                          onClick={() => {
                            if (selectedStageElId === el.id) onSelectStageEl?.(null);
                            commitElements(elements.filter((item) => item.id !== el.id));
                          }}
                          className="w-6 h-6 rounded hover:bg-[var(--live)]/15 grid place-items-center text-[var(--ink-3)] hover:text-[var(--danger)] cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Selected Element Properties Inspector */}
          {selectedEl && (
            <section className="pt-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[var(--ink)]">
                  Selected · {selectedEl.label}
                </span>
                <label className="inline-flex items-center gap-1.5 text-[var(--ink-2)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedEl.stack)}
                    onChange={(e) => updateSelected({ stack: e.target.checked })}
                    className="accent-[var(--accent)]"
                  />
                  <span>Overlap</span>
                </label>
              </div>

              <input
                type="text"
                value={
                  selectedEl.kind === 'text' || selectedEl.kind === 'ai'
                    ? (selectedEl.text ?? selectedEl.label)
                    : selectedEl.label
                }
                onChange={(e) =>
                  selectedEl.kind === 'text' || selectedEl.kind === 'ai'
                    ? updateSelected({
                        text: e.target.value,
                        label: e.target.value.slice(0, 22) || selectedEl.kind.toUpperCase(),
                      })
                    : updateSelected({ label: e.target.value })
                }
                placeholder={
                  selectedEl.kind === 'text' || selectedEl.kind === 'ai'
                    ? 'Overlay text…'
                    : 'Layer label…'
                }
                className={`w-full ${CONSOLE_INPUT_CLS}`}
              />

              {selectedEl.kind === 'participant' && room.participants.length > 0 && (
                <select
                  value={selectedEl.participantId || room.participants[0]?.id || ''}
                  onChange={(e) => {
                    const p = room.participants.find((item) => item.id === e.target.value);
                    updateSelected({
                      participantId: e.target.value,
                      label: p?.name || selectedEl.label,
                    });
                  }}
                  className={`w-full ${CONSOLE_INPUT_CLS}`}
                >
                  {room.participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.onStage ? 'Stage' : 'Backstage'})
                    </option>
                  ))}
                </select>
              )}

              {(selectedEl.kind === 'text' || selectedEl.kind === 'ai') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-[6px] bg-[var(--fill)] border border-[var(--line)]">
                      {(
                        [
                          { id: 'left', icon: AlignLeft },
                          { id: 'center', icon: AlignCenter },
                          { id: 'right', icon: AlignRight },
                        ] as const
                      ).map((a) => {
                        const Icon = a.icon;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => updateSelected({ align: a.id })}
                            className={`w-6 h-6 rounded-[4px] grid place-items-center cursor-pointer ${
                              (selectedEl.align || 'center') === a.id
                                ? 'gather-btn-primary text-white'
                                : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                            }`}
                          >
                            <Icon className="w-3 h-3" />
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => updateSelected({ bold: selectedEl.bold === false ? true : false })}
                      className={`h-7 px-2.5 rounded-[6px] border text-[11px] font-bold cursor-pointer ${
                        selectedEl.bold !== false
                          ? 'bg-[var(--accent-soft)] border-[var(--accent-line)] text-[var(--ink)]'
                          : 'bg-[var(--fill)] border-[var(--line)] text-[var(--ink-3)]'
                      }`}
                    >
                      Bold
                    </button>

                    <div className="flex items-center gap-1.5 flex-1">
                      <span className="text-[10.5px] font-mono-num text-[var(--ink-3)]">
                        {selectedEl.fontSize || 22}px
                      </span>
                      <input
                        type="range"
                        min={12}
                        max={44}
                        value={selectedEl.fontSize || 22}
                        onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })}
                        className="gather-range flex-1"
                      />
                    </div>
                  </div>
                </div>
              )}

              {selectedEl.kind === 'clock' && (
                <div className="flex items-center gap-1">
                  <span className="text-[10.5px] text-[var(--ink-3)] mr-1">Timer:</span>
                  {[0, 1, 3, 5, 10].map((min) => (
                    <button
                      key={min}
                      type="button"
                      onClick={() =>
                        updateSelected({
                          countdownEndAt: min > 0 ? Date.now() + min * 60_000 : undefined,
                        })
                      }
                      className="h-6 px-2 rounded-[5px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[10.5px] font-mono-num text-[var(--ink-2)] cursor-pointer"
                    >
                      {min === 0 ? 'Clock' : `${min}m`}
                    </button>
                  ))}
                </div>
              )}

              {(selectedEl.kind === 'text' ||
                selectedEl.kind === 'block' ||
                selectedEl.kind === 'clock' ||
                selectedEl.kind === 'chat' ||
                selectedEl.kind === 'ai') && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10.5px] text-[var(--ink-3)]">Card fill</span>
                  <div className="flex items-center gap-1.5">
                    {[
                      { label: 'Clear', val: 'transparent' },
                      { label: 'Obsidian', val: 'rgba(8, 12, 22, 0.84)' },
                      { label: 'Blue', val: '#1e3a8a' },
                      { label: 'Violet', val: '#4c1d95' },
                      { label: 'Emerald', val: '#064e3b' },
                      { label: 'Crimson', val: '#881337' },
                    ].map((sw) => (
                      <button
                        key={sw.val}
                        type="button"
                        title={sw.label}
                        onClick={() => updateSelected({ bg: sw.val })}
                        className={`w-5 h-5 rounded-full border cursor-pointer ${
                          selectedEl.bg === sw.val ? 'border-white scale-110' : 'border-white/25'
                        }`}
                        style={{
                          background:
                            sw.val === 'transparent'
                              ? 'linear-gradient(135deg, rgba(255,255,255,0.12) 45%, #ef4444 48%, rgba(255,255,255,0.12) 52%)'
                              : sw.val,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const copy: CustomStageElement = {
                      ...selectedEl,
                      id: `el-${selectedEl.kind}-${Date.now().toString(36)}`,
                      label: `${selectedEl.label} copy`,
                      x: Math.min(0.88 - selectedEl.w, selectedEl.x + 0.04),
                      y: Math.min(0.88 - selectedEl.h, selectedEl.y + 0.04),
                      stack: true,
                    };
                    commitElements([...elements, copy]);
                    onSelectStageEl?.(copy.id);
                  }}
                  className="h-7 px-2.5 rounded-[6px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[11px] font-medium text-[var(--ink-2)] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Duplicate</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectStageEl?.(null);
                    commitElements(elements.filter((item) => item.id !== selectedEl.id));
                  }}
                  className="h-7 px-2.5 rounded-[6px] bg-[var(--live-soft)] hover:bg-[var(--live)] text-[var(--danger)] hover:text-white text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete</span>
                </button>
              </div>
            </section>
          )}

          {/* Saved Custom Scenes */}
          {onSaveScenePreset && (
            <section className="pt-3.5 space-y-2">
              <h3 className="text-[11px] font-semibold text-[var(--ink)]">Saved scenes</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!presetNameDraft.trim()) return;
                  onSaveScenePreset(presetNameDraft.trim());
                  setPresetNameDraft('');
                }}
                className="flex gap-1.5"
              >
                <input
                  type="text"
                  value={presetNameDraft}
                  onChange={(e) => setPresetNameDraft(e.target.value)}
                  placeholder="Scene name…"
                  className={`flex-1 min-w-0 ${CONSOLE_INPUT_CLS}`}
                />
                <button
                  type="submit"
                  disabled={!presetNameDraft.trim()}
                  className="h-8 px-2.5 rounded-[7px] gather-btn-primary text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-45 shrink-0"
                >
                  <Save className="w-3 h-3" />
                  <span>Save</span>
                </button>
              </form>

              {(room.scene.savedPresets || []).length > 0 && (
                <div className="space-y-1">
                  {(room.scene.savedPresets || []).map((preset) => {
                    const active = room.scene.templateId === preset.id;
                    return (
                      <div
                        key={preset.id}
                        className={`px-2.5 py-1.5 rounded-[7px] border flex items-center justify-between gap-2 text-xs ${
                          active
                            ? 'bg-[var(--accent-soft)] border-[var(--accent-line)]'
                            : 'bg-[var(--fill)] border-[var(--line)]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onApplyScenePreset?.(preset.id)}
                          className="min-w-0 flex-1 text-left font-medium text-[var(--ink)] truncate cursor-pointer"
                        >
                          {preset.name}
                        </button>
                        {onDeleteScenePreset && (
                          <button
                            type="button"
                            aria-label={`Delete ${preset.name}`}
                            onClick={() => onDeleteScenePreset(preset.id)}
                            className="text-[var(--ink-3)] hover:text-[var(--danger)] cursor-pointer p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* ================================================================
          BRAND & VISUAL OVERLAYS SUB-TAB
          ================================================================ */}
      {subTab === 'brand' && (
        <div className="divide-y divide-[var(--line)] space-y-4">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[var(--ink)]">Stream Format</h3>
              <span className="text-[10.5px] text-[var(--ink-3)]">Watch UI</span>
            </div>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-[8px] bg-[var(--fill)] border border-[var(--glass-border)]">
              {(
                [
                  { id: 'standard', label: 'Broadcast' },
                  { id: 'shop', label: 'Live Shop' },
                  { id: 'gamer', label: 'Gaming' },
                ] as Array<{ id: WatchMode; label: string }>
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onPatchRoom({ watchMode: m.id })}
                  className={`h-7 rounded-[6px] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    room.watchMode === m.id
                      ? 'gather-btn-primary text-white'
                      : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </section>

          <section className="pt-3.5 space-y-2">
            <h3 className="text-xs font-semibold text-[var(--ink)]">Accent Colour</h3>
            <div className="flex items-center gap-2">
              {ACCENT_SWATCHES.map((sw) => (
                <button
                  key={sw.value}
                  type="button"
                  aria-label={sw.label}
                  onClick={() => onPatchRoom({ brand: { ...room.brand, accent: sw.value } })}
                  style={{ backgroundColor: sw.value }}
                  className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                    room.brand.accent === sw.value
                      ? 'ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--bg)] scale-110'
                      : ''
                  }`}
                />
              ))}
              <input
                type="color"
                value={room.brand.accent}
                onChange={(e) => onPatchRoom({ brand: { ...room.brand, accent: e.target.value } })}
                aria-label="Custom accent colour"
                className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
              />
            </div>
          </section>

          <section className="pt-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[var(--ink)]">Backdrop &amp; Overlay</h3>
              {(room.brand.customBackdropUrl || room.brand.customOverlayUrl) && (
                <button
                  type="button"
                  onClick={() =>
                    onPatchRoom({
                      brand: {
                        ...room.brand,
                        customBackdropUrl: undefined,
                        customOverlayUrl: undefined,
                      },
                    })
                  }
                  className="text-[11px] text-[var(--danger)] cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {(Object.keys(BACKDROP_PRESETS) as BackdropId[]).map((id) => {
                const p = BACKDROP_PRESETS[id];
                const active = room.brand.backdrop === id && !room.brand.customBackdropUrl;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      onPatchRoom({
                        brand: { ...room.brand, backdrop: id, customBackdropUrl: undefined },
                      })
                    }
                    style={{
                      background: `linear-gradient(135deg, ${p.gradient[0]}, ${p.gradient[1]})`,
                    }}
                    className={`h-9 rounded-[7px] border text-[10px] font-semibold flex items-end p-1.5 cursor-pointer ${
                      id === 'paper' ? 'text-slate-900' : 'text-white'
                    } ${active ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]' : 'border-white/10'}`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <label className="h-8 px-2.5 rounded-[7px] bg-[var(--fill)] border border-[var(--glass-border)] text-[11px] font-medium text-[var(--ink-2)] inline-flex items-center justify-center gap-1.5 cursor-pointer hover:text-[var(--ink)] whitespace-nowrap">
                <Upload className="w-3.5 h-3.5" />
                <span>Backdrop</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onSelectBrandFile('backdrop', f);
                  }}
                />
              </label>
              <label className="h-8 px-2.5 rounded-[7px] bg-[var(--fill)] border border-[var(--glass-border)] text-[11px] font-medium text-[var(--accent-text)] inline-flex items-center justify-center gap-1.5 cursor-pointer hover:brightness-110 whitespace-nowrap">
                <Layers className="w-3.5 h-3.5" />
                <span>{room.brand.customOverlayUrl ? 'Change PNG' : '+ PNG Frame'}</span>
                <input
                  type="file"
                  accept="image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onSelectBrandFile('overlay', f);
                  }}
                />
              </label>
            </div>
          </section>

          <section className="pt-3.5 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[11px] text-[var(--ink-3)] block">Stage Font</span>
                <select
                  value={room.brand.font}
                  onChange={(e) =>
                    onPatchRoom({ brand: { ...room.brand, font: e.target.value as StageFont } })
                  }
                  className={`w-full ${CONSOLE_INPUT_CLS}`}
                >
                  {STAGE_FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[11px] text-[var(--ink-3)] block">Stage Frame</span>
                <select
                  value={room.brand.frame}
                  onChange={(e) =>
                    onPatchRoom({ brand: { ...room.brand, frame: e.target.value as FrameStyle } })
                  }
                  className={`w-full ${CONSOLE_INPUT_CLS}`}
                >
                  <option value="none">None</option>
                  <option value="border">Accent Border</option>
                  <option value="corners">Viewfinder Corners</option>
                  <option value="vignette">Studio Vignette</option>
                </select>
              </label>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] text-[var(--ink-3)]">Name Tags</span>
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-[var(--ink-2)]">
                  <input
                    type="checkbox"
                    checked={room.brand.showNames}
                    onChange={(e) =>
                      onPatchRoom({ brand: { ...room.brand, showNames: e.target.checked } })
                    }
                    className="accent-[var(--accent)]"
                  />
                  <span>Show names</span>
                </label>
              </div>
              <div className="grid grid-cols-4 gap-1 p-1 rounded-[7px] bg-[var(--fill)] border border-[var(--glass-border)]">
                {(['glass', 'solid', 'outline', 'minimal'] as NameTagStyle[]).map((ns) => (
                  <button
                    key={ns}
                    type="button"
                    onClick={() => onPatchRoom({ brand: { ...room.brand, nameTagStyle: ns } })}
                    className={`h-6 rounded-[5px] text-[11px] font-semibold capitalize cursor-pointer ${
                      (room.brand.nameTagStyle || 'glass') === ns
                        ? 'gather-btn-primary text-white'
                        : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {ns}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-0.5">
              <span className="text-[var(--ink-2)]">Watermark Logo</span>
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-[var(--accent-text)] hover:underline cursor-pointer">
                  <span>{room.brand.logoUrl ? 'Change' : '+ Upload'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onSelectBrandFile('logo', f);
                    }}
                  />
                </label>
                {room.brand.logoUrl && (
                  <button
                    type="button"
                    onClick={() => onPatchRoom({ brand: { ...room.brand, logoUrl: undefined } })}
                    aria-label="Clear logo"
                    className="text-[var(--danger)] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* AI Graphics & Brand Kits */}
          <section className="pt-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--ink)] inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                <span>AI Graphics &amp; Kits</span>
              </span>
              {onOpenAiStudio && (
                <button
                  type="button"
                  onClick={() => onOpenAiStudio('graphics')}
                  className="text-[11px] font-medium text-[var(--accent-text)] hover:text-[var(--ink)] cursor-pointer"
                >
                  Open AI Studio →
                </button>
              )}
            </div>

            {brandKits.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto gather-scroll pb-0.5">
                {brandKits.slice(0, 8).map((kit) => (
                  <button
                    key={kit.id}
                    type="button"
                    onClick={() => onApplyBrandKit?.(kit)}
                    className="h-7 px-2.5 rounded-[7px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[11px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: kit.accentHex }}
                    />
                    <span className="max-w-[116px] truncate">{kit.name}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-4 gap-1 p-1 rounded-[8px] bg-[var(--fill)] border border-[var(--line)]">
              {(
                [
                  { id: 'hud-frame', label: 'HUD' },
                  { id: 'webcam-frame', label: 'Cam' },
                  { id: 'backdrop', label: 'BG' },
                  { id: 'logo', label: 'Logo' },
                ] as Array<{ id: OverlayGenMode; label: string }>
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setAiMode(m.id)}
                  className={`h-6 rounded-[5px] text-[10.5px] font-medium cursor-pointer transition-colors ${
                    aiMode === m.id
                      ? 'gather-btn-primary text-white'
                      : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="flex gap-1.5">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Describe stage graphic..."
                className={`flex-1 min-w-0 ${CONSOLE_INPUT_CLS}`}
              />
              <button
                type="button"
                disabled={aiBusy || !aiPrompt.trim()}
                onClick={() => void handleGenerateOverlay()}
                className="h-8 px-3 rounded-[7px] gather-btn-primary text-[11px] font-medium inline-flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
              >
                {aiBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                <span>{aiBusy ? 'Designing' : 'Create'}</span>
              </button>
            </div>

            {aiError && (
              <div className="p-2 rounded-[7px] border border-[var(--danger)]/35 bg-[var(--danger)]/10 text-[11px] text-[var(--danger)]">
                {aiError}
              </div>
            )}

            {aiSvg && (
              <div className="p-2.5 rounded-[10px] bg-[var(--fill)] border border-[var(--line)] space-y-2">
                <div className="rounded-[8px] border border-[var(--line)] overflow-hidden flex items-center justify-center p-2 bg-[#080d1b]">
                  <img
                    src={svgToCompactDataUrl(aiSvg)}
                    alt={aiTitle || 'AI stage graphic'}
                    className={aiMode === 'logo' ? 'h-20 w-20 object-contain' : 'w-full max-h-28 object-contain'}
                  />
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={aiRefinePrompt}
                    onChange={(e) => setAiRefinePrompt(e.target.value)}
                    placeholder="Refine graphic..."
                    className={`flex-1 min-w-0 h-7 ${CONSOLE_INPUT_CLS}`}
                  />
                  <button
                    type="button"
                    disabled={aiBusy || !aiRefinePrompt.trim()}
                    onClick={() => void handleRefineOverlay()}
                    className="h-7 px-2.5 rounded-[6px] bg-[var(--surface-2)] border border-[var(--line)] text-[11px] font-medium text-[var(--ink)] shrink-0 cursor-pointer disabled:opacity-45"
                  >
                    Refine
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  {onSaveBrandKit && (
                    <button
                      type="button"
                      disabled={savingKit}
                      onClick={() => void handleSaveCurrentAsKit()}
                      className="h-7 px-2.5 rounded-[7px] bg-[var(--surface-2)] border border-[var(--line)] text-[11px] font-medium text-[var(--ink-2)] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <FolderHeart className="w-3 h-3" />
                      <span>{savingKit ? 'Saving…' : 'Save Kit'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleApplyGenerated}
                    className="h-7 px-3 rounded-[7px] gather-btn-tip text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer ml-auto"
                  >
                    <Check className="w-3 h-3" />
                    <span>Apply</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {room.watchMode === 'gamer' && (
            <section className="pt-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--ink)] inline-flex items-center gap-1.5">
                  <Gamepad2 className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  <span>Gaming HUD</span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  value={room.gamer.gameTitle}
                  onChange={(e) => onPatchRoom({ gamer: { ...room.gamer, gameTitle: e.target.value } })}
                  placeholder="Game"
                  className={CONSOLE_INPUT_CLS}
                />
                <input
                  type="text"
                  value={room.gamer.currentMap || ''}
                  onChange={(e) => onPatchRoom({ gamer: { ...room.gamer, currentMap: e.target.value } })}
                  placeholder="Map"
                  className={CONSOLE_INPUT_CLS}
                />
                <input
                  type="text"
                  value={room.gamer.teamAName ?? 'GATHER'}
                  onChange={(e) => onPatchRoom({ gamer: { ...room.gamer, teamAName: e.target.value } })}
                  placeholder="Team A"
                  className={CONSOLE_INPUT_CLS}
                />
                <input
                  type="text"
                  value={room.gamer.teamBName ?? 'APEX'}
                  onChange={(e) => onPatchRoom({ gamer: { ...room.gamer, teamBName: e.target.value } })}
                  placeholder="Team B"
                  className={CONSOLE_INPUT_CLS}
                />
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={gearLabel}
                  onChange={(e) => setGearLabel(e.target.value)}
                  placeholder="Gear"
                  className={`w-[28%] h-7 px-2 ${CONSOLE_INPUT_CLS}`}
                />
                <input
                  type="text"
                  value={gearValue}
                  onChange={(e) => setGearValue(e.target.value)}
                  placeholder="Model spec"
                  className={`flex-1 h-7 px-2 ${CONSOLE_INPUT_CLS}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!gearLabel.trim() || !gearValue.trim()) return;
                    const spec: GearSpec = {
                      id: `gear-${Date.now()}`,
                      category: gearLabel.trim(),
                      label: gearLabel.trim(),
                      value: gearValue.trim(),
                    };
                    onPatchRoom({
                      gamer: { ...room.gamer, gearSpecs: [...room.gamer.gearSpecs, spec] },
                    });
                    setGearLabel('');
                    setGearValue('');
                  }}
                  className="h-7 px-2.5 rounded-[6px] bg-[var(--fill)] border border-[var(--glass-border)] text-[11px] font-semibold text-[var(--ink)] cursor-pointer"
                >
                  +
                </button>
              </div>
            </section>
          )}

          {/* Sponsor Banner Rotator */}
          <section className="pt-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[var(--ink)] inline-flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[var(--cyan)]" />
                <span>Sponsors</span>
              </h3>
              <button
                type="button"
                onClick={() =>
                  onPatchRoom({
                    brand: {
                      ...room.brand,
                      sponsorsEnabled: !room.brand.sponsorsEnabled,
                      sponsors: sponsorsList,
                    },
                  })
                }
                className={`h-6 px-2.5 rounded-[6px] text-[11px] font-semibold cursor-pointer ${
                  room.brand.sponsorsEnabled
                    ? 'gather-btn-primary text-white'
                    : 'bg-[var(--fill)] border border-[var(--glass-border)] text-[var(--ink-2)]'
                }`}
              >
                {room.brand.sponsorsEnabled ? 'On Stage' : 'Off'}
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={sponsorDraft}
                onChange={(e) => setSponsorDraft(e.target.value)}
                placeholder="Add sponsor..."
                className={`flex-1 h-7 ${CONSOLE_INPUT_CLS}`}
              />
              <button
                type="button"
                onClick={() => {
                  if (!sponsorDraft.trim()) return;
                  const next: SponsorBanner[] = [
                    ...sponsorsList,
                    { id: `sp-${Date.now()}`, label: sponsorDraft.trim() },
                  ];
                  onPatchRoom({
                    brand: { ...room.brand, sponsors: next, sponsorsEnabled: true },
                  });
                  setSponsorDraft('');
                }}
                className="h-7 px-2.5 rounded-[6px] gather-btn-primary text-[11px] font-semibold cursor-pointer"
              >
                +
              </button>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {sponsorsList.map((sp) => (
                <div key={sp.id} className="py-1 flex items-center justify-between text-xs">
                  <span className="text-[var(--ink-2)] truncate">{sp.label}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${sp.label}`}
                    onClick={() =>
                      onPatchRoom({
                        brand: {
                          ...room.brand,
                          sponsors: sponsorsList.filter((item) => item.id !== sp.id),
                        },
                      })
                    }
                    className="text-[var(--ink-3)] hover:text-[var(--danger)] cursor-pointer p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
