import React, { useState } from 'react';
import {
  Check,
  DollarSign,
  FolderHeart,
  Loader2,
  Pin,
  Plus,
  Sparkles,
  Store,
  Trash2,
  Wand2,
  Zap,
} from 'lucide-react';
import {
  BrandBannerPreset,
  BrandKit,
  BrandKitProductDraft,
  NameTagStyle,
  ProductItem,
  ProductSource,
  RoomState,
  StageFontPreset,
  StageFrameStyle,
} from '../../types/studio';
import { sanitizeSvg, svgToCompactDataUrl } from '../../utils/aiGraphicRenderer';
import { CONSOLE_INPUT_CLS } from './consoleTypes';

interface ShopTabProps {
  room: RoomState;
  onPatchRoom: (patch: Record<string, unknown>) => void;
  onPinProduct: (id: string | null) => void;
  onStartFlashSale?: (payload: {
    productId: string;
    discountPct: number;
    totalUnits: number;
    durationMin: number;
    tagline?: string;
  }) => void;
  onStopFlashSale?: () => void;
  brandKits?: BrandKit[];
  onApplyBrandKit?: (kit: BrandKit, options?: { openShop?: boolean }) => void;
  onSaveBrandKit?: (kit: BrandKit) => Promise<void> | void;
  onOpenAiStudio?: (tab?: 'pdf' | 'graphics' | 'kits' | 'audio' | 'bumper' | 'clips' | 'podcast') => void;
  onNotify?: (msg: string) => void;
}

const SHOP_NICHE_CHIPS: Array<{
  label: string;
  niche: BrandKit['niche'];
  prompt: string;
}> = [
  {
    label: 'Streetwear Drop',
    niche: 'commerce',
    prompt: 'Architectural monochrome streetwear capsule collection with heavy-weight hoodie and metallic cap',
  },
  {
    label: 'Esports Merch',
    niche: 'gaming',
    prompt: 'Pro esports team jersey, glass mousepad, and custom coiled aviator cable drop',
  },
  {
    label: 'Studio Gear',
    niche: 'creator',
    prompt: 'Creator desk hardware suite with XLR dynamic mic, keylight diffuser, and ceramic pour-over mug',
  },
  {
    label: 'Beauty & Glow',
    niche: 'commerce',
    prompt: 'Minimalist botanical serum dropper, silk sleep mask, and sculpted facial roller',
  },
];

export const ShopTab: React.FC<ShopTabProps> = ({
  room,
  onPatchRoom,
  onPinProduct,
  onStartFlashSale,
  onStopFlashSale,
  brandKits = [],
  onApplyBrandKit,
  onSaveBrandKit,
  onOpenAiStudio,
  onNotify,
}) => {
  const [shopifyUrl, setShopifyUrl] = useState('');
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [shopifyErr, setShopifyErr] = useState('');
  const [newProdSource, setNewProdSource] = useState<ProductSource>('etsy');
  const [newProdTitle, setNewProdTitle] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('34.00');
  const [newProdUrl, setNewProdUrl] = useState('');
  const [newProdStock, setNewProdStock] = useState('10');

  const [flashProdId, setFlashProdId] = useState(
    room.commerce.pinnedProductId || room.commerce.products[0]?.id || ''
  );
  const [flashDiscount, setFlashDiscount] = useState('20');
  const [flashUnits, setFlashUnits] = useState('15');
  const [flashMinutes, setFlashMinutes] = useState('10');
  const [flashTagline, setFlashTagline] = useState('TV Flash Drop · Volume Bundles Live!');

  const [kitNiche, setKitNiche] = useState<BrandKit['niche']>('commerce');
  const [kitPrompt, setKitPrompt] = useState(SHOP_NICHE_CHIPS[0].prompt);
  const [kitLoading, setKitLoading] = useState(false);
  const [kitError, setKitError] = useState<string | null>(null);
  const [draftKit, setDraftKit] = useState<BrandKit | null>(null);
  const [savingKit, setSavingKit] = useState(false);

  const handleGenerateBrandKit = async () => {
    if (!kitPrompt.trim()) return;
    setKitLoading(true);
    setKitError(null);
    try {
      const res = await fetch('/api/ai/brand-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: kitPrompt.trim(),
          niche: kitNiche,
          showTitle: room.title,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate AI Store Brand Kit.');

      const logoUrl = svgToCompactDataUrl(sanitizeSvg(String(data.logoSvg || ''), 512, 512));
      const backdropUrl = svgToCompactDataUrl(sanitizeSvg(String(data.backdropSvg || ''), 1920, 1080));
      const overlayUrl = svgToCompactDataUrl(sanitizeSvg(String(data.overlaySvg || ''), 1920, 1080));
      const rawProducts = Array.isArray(data.products) ? data.products : [];
      const products: BrandKitProductDraft[] = rawProducts.slice(0, 3).map((item: Record<string, unknown>, idx: number) => {
        const cleanSvg = sanitizeSvg(String(item.productSvg || ''), 512, 512);
        return {
          id: `ai-prod-${Date.now().toString(36)}-${idx + 1}`,
          title: String(item.title || `Featured Drop #${idx + 1}`),
          price: Math.max(1, Number(item.price || 48)),
          category: String(item.category || 'Limited Drop'),
          description: String(item.description || 'AI-curated studio drop item.'),
          variants: Array.isArray(item.variants)
            ? item.variants.slice(0, 4).map((v) => String(v))
            : ['Standard'],
          imageUrl: svgToCompactDataUrl(cleanSvg),
          svg: cleanSvg,
        };
      });

      const nextKit: BrandKit = {
        id: `kit-${Date.now().toString(36)}`,
        name: String(data.name || 'AI Brand Kit'),
        niche: kitNiche,
        storeName: String(data.storeName || room.title || 'Gather Store'),
        storeTagline: String(data.storeTagline || 'Curated live broadcast drop'),
        accentHex: String(data.accentHex || room.brand.accent),
        secondaryHex: String(data.secondaryHex || '#38BDF8'),
        backdropPreset: (String(data.backdropPreset || 'dusk') as BrandKit['backdropPreset']),
        stageFont: (String(data.stageFont || 'Plus Jakarta Sans') as StageFontPreset),
        frameStyle: (String(data.frameStyle || 'rounded') as StageFrameStyle),
        nameTagStyle: (String(data.nameTagStyle || 'glass') as NameTagStyle),
        bannerStyle: (String(data.bannerStyle || 'classic') as BrandBannerPreset),
        bannerTitle: String(data.bannerTitle || data.storeName || room.title),
        bannerSubtitle: String(data.bannerSubtitle || data.storeTagline || 'Live on Gather'),
        logoUrl,
        backdropUrl,
        overlayUrl,
        gamerHud: data.gamerHud,
        products,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      };
      setDraftKit(nextKit);
    } catch (err) {
      setKitError(err instanceof Error ? err.message : 'Unable to generate AI brand kit.');
    } finally {
      setKitLoading(false);
    }
  };

  const handleLaunchKit = (kit: BrandKit) => {
    if (onApplyBrandKit) {
      onApplyBrandKit(kit, { openShop: true });
      return;
    }
    const storeProducts: ProductItem[] = kit.products.map((p) => ({
      id: p.id,
      source: 'custom',
      title: p.title,
      price: p.price,
      currency: 'USD',
      imageUrl: p.imageUrl,
      url: 'https://gather.live',
      stock: 25,
      variants: p.variants.length > 0 ? p.variants : ['Standard'],
      description: p.description,
    }));
    onPatchRoom({
      watchMode: 'shop',
      brand: {
        ...room.brand,
        accent: kit.accentHex,
        backdrop: kit.backdropPreset,
        logoUrl: kit.logoUrl || room.brand.logoUrl,
        customBackdropUrl: kit.backdropUrl || room.brand.customBackdropUrl,
        customOverlayUrl: kit.overlayUrl || room.brand.customOverlayUrl,
      },
      commerce: {
        ...room.commerce,
        storeLabel: kit.storeName,
        products: [...storeProducts, ...room.commerce.products].slice(0, 20),
        pinnedProductId: storeProducts[0]?.id || room.commerce.pinnedProductId,
      },
    });
    onNotify?.(`Launched AI Store "${kit.storeName}" onto stage.`);
  };

  const handleShopifyImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopifyUrl.trim()) return;
    setShopifyLoading(true);
    setShopifyErr('');
    try {
      const res = await fetch('/api/commerce/shopify-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeUrl: shopifyUrl.trim() }),
      });
      const data = (await res.json()) as {
        error?: string;
        storeOrigin?: string;
        products?: ProductItem[];
      };
      if (!res.ok || data.error) {
        setShopifyErr(data.error || 'Unable to import from Shopify store.');
      } else if (data.products && data.products.length > 0) {
        const merged = [...data.products, ...room.commerce.products].slice(0, 20);
        onPatchRoom({
          watchMode: 'shop',
          commerce: {
            ...room.commerce,
            shopifyDomain: data.storeOrigin,
            products: merged,
            pinnedProductId: data.products[0].id,
          },
        });
        setShopifyUrl('');
      } else {
        setShopifyErr('No public products found on that Shopify storefront.');
      }
    } catch {
      setShopifyErr('Network error contacting Shopify import proxy.');
    } finally {
      setShopifyLoading(false);
    }
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdTitle.trim()) return;
    const item: ProductItem = {
      id: `prod-${Date.now().toString(36)}`,
      source: newProdSource,
      title: newProdTitle.trim(),
      price: Math.max(1, Number(newProdPrice) || 25),
      currency: 'USD',
      imageUrl: '/src/assets/images/product_ceramic_mug_1794839256911.jpg',
      url:
        newProdUrl.trim() ||
        (newProdSource === 'etsy' ? 'https://www.etsy.com' : 'https://www.shopify.com'),
      stock: Math.max(1, Number(newProdStock) || 10),
      variants: ['Standard'],
    };
    onPatchRoom({
      commerce: {
        ...room.commerce,
        products: [item, ...room.commerce.products],
        pinnedProductId: item.id,
      },
    });
    setNewProdTitle('');
    setNewProdUrl('');
  };

  return (
    <div className="divide-y divide-[var(--line)] space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[var(--ink)] inline-flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-[var(--ok)]" />
            <span>Creator Payouts</span>
          </span>
          <span className="text-[11px] text-[var(--ok)] font-mono-num">0% fee · $ Support</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <input
            type="text"
            value={room.commerce.payouts?.venmoHandle || ''}
            onChange={(e) =>
              onPatchRoom({
                commerce: {
                  ...room.commerce,
                  payouts: {
                    ...room.commerce.payouts,
                    enabled: true,
                    venmoHandle: e.target.value.replace(/^@/, ''),
                  },
                },
              })
            }
            placeholder="Venmo @handle"
            className={CONSOLE_INPUT_CLS}
          />
          <input
            type="text"
            value={room.commerce.payouts?.paypalHandle || ''}
            onChange={(e) =>
              onPatchRoom({
                commerce: {
                  ...room.commerce,
                  payouts: {
                    ...room.commerce.payouts,
                    enabled: true,
                    paypalHandle: e.target.value.replace(/^@/, ''),
                  },
                },
              })
            }
            placeholder="PayPal.me handle"
            className={CONSOLE_INPUT_CLS}
          />
          <input
            type="text"
            value={room.commerce.payouts?.cashappTag || ''}
            onChange={(e) =>
              onPatchRoom({
                commerce: {
                  ...room.commerce,
                  payouts: {
                    ...room.commerce.payouts,
                    enabled: true,
                    cashappTag: e.target.value.replace(/^\$/, ''),
                  },
                },
              })
            }
            placeholder="Cash App $tag"
            className={CONSOLE_INPUT_CLS}
          />
          <input
            type="url"
            value={room.commerce.payouts?.stripeUrl || ''}
            onChange={(e) =>
              onPatchRoom({
                commerce: {
                  ...room.commerce,
                  payouts: {
                    ...room.commerce.payouts,
                    enabled: true,
                    stripeUrl: e.target.value,
                  },
                },
              })
            }
            placeholder="Inline Stripe URL"
            className={CONSOLE_INPUT_CLS}
          />
        </div>
      </div>

      <div className="pt-3.5 flex items-center justify-between gap-2">
        <div>
          <span className="text-xs font-semibold text-[var(--ink)] block">Live Shop Mode</span>
          <span className="text-[11px] text-[var(--ink-3)]">Shelf &amp; express bag on Watch</span>
        </div>
        <button
          type="button"
          onClick={() =>
            onPatchRoom({
              watchMode: room.watchMode === 'shop' ? 'standard' : 'shop',
            })
          }
          className={`px-2.5 py-1.5 rounded-[6px] text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
            room.watchMode === 'shop'
              ? 'gather-btn-primary text-white'
              : 'bg-[var(--fill)] border border-[var(--glass-border)] text-[var(--ink-2)]'
          }`}
        >
          {room.watchMode === 'shop' ? 'Enabled' : 'Hidden'}
        </button>
      </div>

      {/* AI Store Brand & Drop Generator */}
      <div className="pt-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[var(--ink)] inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)]" />
            <span>AI Store Brand &amp; Drop Builder</span>
          </span>
          {onOpenAiStudio && (
            <button
              type="button"
              onClick={() => onOpenAiStudio('kits')}
              className="text-[11px] font-medium text-[var(--accent-text)] hover:text-[var(--ink)] whitespace-nowrap cursor-pointer"
            >
              All Brand Kits →
            </button>
          )}
        </div>

        {brandKits.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto gather-scroll pb-0.5">
            {brandKits.slice(0, 6).map((kit) => (
              <button
                key={kit.id}
                type="button"
                onClick={() => handleLaunchKit(kit)}
                className="h-7 px-2.5 rounded-[7px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[11px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: kit.accentHex }}
                />
                <span className="max-w-[120px] truncate">{kit.storeName}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {SHOP_NICHE_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => {
                setKitNiche(chip.niche);
                setKitPrompt(chip.prompt);
              }}
              className="h-6 px-2 rounded-[6px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[10.5px] text-[var(--ink-2)] hover:text-[var(--ink)] whitespace-nowrap cursor-pointer"
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5">
          <input
            type="text"
            value={kitPrompt}
            onChange={(e) => setKitPrompt(e.target.value)}
            placeholder="Describe your brand, vibe, and products..."
            className={`flex-1 min-w-0 ${CONSOLE_INPUT_CLS}`}
          />
          <button
            type="button"
            disabled={kitLoading || !kitPrompt.trim()}
            onClick={() => void handleGenerateBrandKit()}
            className="h-8 px-3 rounded-[7px] gather-btn-primary text-[11px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            {kitLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5" />
            )}
            <span>{kitLoading ? 'Creating' : 'Build Kit'}</span>
          </button>
        </div>

        {kitError && (
          <div className="p-2.5 rounded-[8px] border border-[var(--danger)]/35 bg-[var(--danger)]/10 text-[11px] text-[var(--danger)]">
            {kitError}
          </div>
        )}

        {draftKit && (
          <div className="p-3 rounded-[10px] bg-[var(--fill)] border border-[var(--line)] space-y-2.5">
            <div className="flex items-center gap-2.5">
              {draftKit.logoUrl && (
                <img
                  src={draftKit.logoUrl}
                  alt={draftKit.storeName}
                  className="w-10 h-10 rounded-[8px] object-contain bg-[var(--bg)] border border-[var(--line)] p-1 shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-[var(--ink)] truncate">
                  {draftKit.storeName}
                </div>
                <div className="text-[11px] text-[var(--ink-3)] truncate">
                  {draftKit.storeTagline}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span
                  className="w-3.5 h-3.5 rounded-full border border-white/20"
                  style={{ backgroundColor: draftKit.accentHex }}
                />
                <span
                  className="w-3.5 h-3.5 rounded-full border border-white/20"
                  style={{ backgroundColor: draftKit.secondaryHex }}
                />
              </div>
            </div>

            {draftKit.products.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5">
                {draftKit.products.map((prod) => (
                  <div
                    key={prod.id}
                    className="p-1.5 rounded-[8px] bg-[var(--bg)]/60 border border-[var(--line)] space-y-1 min-w-0"
                  >
                    <img
                      src={prod.imageUrl}
                      alt={prod.title}
                      className="w-full h-12 object-contain rounded-[5px] bg-[var(--surface)]"
                    />
                    <div className="text-[10.5px] font-medium text-[var(--ink)] truncate">
                      {prod.title}
                    </div>
                    <div className="text-[10px] font-mono-num text-[var(--accent-text)]">
                      ${prod.price.toFixed(0)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-0.5">
              {onSaveBrandKit && (
                <button
                  type="button"
                  disabled={savingKit}
                  onClick={async () => {
                    setSavingKit(true);
                    try {
                      await onSaveBrandKit(draftKit);
                    } finally {
                      setSavingKit(false);
                    }
                  }}
                  className="h-7 px-2.5 rounded-[7px] bg-[var(--surface-2)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[11px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FolderHeart className="w-3 h-3" />
                  <span>{savingKit ? 'Saving…' : 'Save Kit to Cloud'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleLaunchKit(draftKit)}
                className="h-7 px-3 rounded-[7px] gather-btn-tip text-[11px] font-medium inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ml-auto"
              >
                <Check className="w-3 h-3" />
                <span>Launch AI Store</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="pt-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--ink)] inline-flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[var(--warn)]" />
            <span>TV Volume Flash Sale</span>
          </span>
          {room.commerce.activeFlashSale?.active &&
            room.commerce.activeFlashSale.endsAt > Date.now() &&
            onStopFlashSale && (
              <button
                type="button"
                onClick={onStopFlashSale}
                className="text-[11px] font-semibold text-[var(--live)] hover:underline cursor-pointer"
              >
                End Flash Sale
              </button>
            )}
        </div>

        {room.commerce.activeFlashSale?.active &&
        room.commerce.activeFlashSale.endsAt > Date.now() ? (
          <div className="p-3 rounded-[9px] bg-[var(--warn)]/12 border border-[var(--warn)]/40 space-y-1.5 text-xs">
            <div className="flex items-center justify-between font-mono-num">
              <span className="font-semibold text-[var(--warn)]">
                LIVE · -{room.commerce.activeFlashSale.discountPct}% Base / -38% 3× VIP
              </span>
              <span className="text-[var(--ink)] font-bold">
                {room.commerce.activeFlashSale.soldUnits}/{room.commerce.activeFlashSale.totalUnits}{' '}
                sold
              </span>
            </div>
            <p className="text-[11px] text-[var(--ink-2)]">
              {room.commerce.activeFlashSale.tagline}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <select
              value={flashProdId || room.commerce.products[0]?.id || ''}
              onChange={(e) => setFlashProdId(e.target.value)}
              aria-label="Flash sale product"
              className={`w-full ${CONSOLE_INPUT_CLS}`}
            >
              {room.commerce.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} (${p.price.toFixed(2)})
                </option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-1.5">
              <label className="space-y-0.5">
                <span className="text-[10px] text-[var(--ink-3)] block">% Off</span>
                <input
                  type="number"
                  min={5}
                  max={75}
                  value={flashDiscount}
                  onChange={(e) => setFlashDiscount(e.target.value)}
                  className={`w-full ${CONSOLE_INPUT_CLS} font-mono-num`}
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-[10px] text-[var(--ink-3)] block">Unit Cap</span>
                <input
                  type="number"
                  min={2}
                  max={200}
                  value={flashUnits}
                  onChange={(e) => setFlashUnits(e.target.value)}
                  className={`w-full ${CONSOLE_INPUT_CLS} font-mono-num`}
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-[10px] text-[var(--ink-3)] block">Minutes</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={flashMinutes}
                  onChange={(e) => setFlashMinutes(e.target.value)}
                  className={`w-full ${CONSOLE_INPUT_CLS} font-mono-num`}
                />
              </label>
            </div>
            <input
              type="text"
              value={flashTagline}
              onChange={(e) => setFlashTagline(e.target.value)}
              placeholder="TV urgency headline..."
              className={`w-full ${CONSOLE_INPUT_CLS}`}
            />
            {onStartFlashSale && room.commerce.products.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const targetId = flashProdId || room.commerce.products[0].id;
                  onPatchRoom({ watchMode: 'shop' });
                  onStartFlashSale({
                    productId: targetId,
                    discountPct: Math.max(5, Math.min(75, Number(flashDiscount) || 20)),
                    totalUnits: Math.max(2, Number(flashUnits) || 15),
                    durationMin: Math.max(1, Number(flashMinutes) || 10),
                    tagline: flashTagline.trim() || 'TV Flash Deal · Limited Units!',
                  });
                }}
                className="w-full h-8 rounded-[7px] bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                Launch Live TV Flash Sale (1× / 2× / 3× Bundles)
              </button>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleShopifyImport} className="pt-4 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
          <Store className="w-3.5 h-3.5 text-[var(--accent-text)]" />
          <span>Import Shopify Storefront</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={shopifyUrl}
            onChange={(e) => setShopifyUrl(e.target.value)}
            placeholder="yourstore.myshopify.com"
            className={`flex-1 ${CONSOLE_INPUT_CLS}`}
          />
          <button
            type="submit"
            disabled={shopifyLoading}
            className="h-8 px-3 rounded-[7px] gather-btn-primary text-xs font-semibold cursor-pointer disabled:opacity-60"
          >
            {shopifyLoading ? 'Pulling…' : 'Import'}
          </button>
        </div>
        {shopifyErr && <p className="text-[11px] text-[var(--danger)]">{shopifyErr}</p>}
      </form>

      <form onSubmit={handleAddProduct} className="pt-4 space-y-2">
        <div className="text-xs font-semibold text-[var(--ink)]">Add Drop Item</div>
        <div className="grid grid-cols-3 gap-2">
          <select
            value={newProdSource}
            onChange={(e) => setNewProdSource(e.target.value as ProductSource)}
            className={CONSOLE_INPUT_CLS}
          >
            <option value="etsy">Etsy</option>
            <option value="shopify">Shopify</option>
            <option value="custom">Custom</option>
          </select>
          <input
            type="number"
            step="0.01"
            value={newProdPrice}
            onChange={(e) => setNewProdPrice(e.target.value)}
            placeholder="Price"
            className={`${CONSOLE_INPUT_CLS} font-mono-num`}
          />
          <input
            type="number"
            value={newProdStock}
            onChange={(e) => setNewProdStock(e.target.value)}
            placeholder="Stock"
            className={`${CONSOLE_INPUT_CLS} font-mono-num`}
          />
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newProdTitle}
            onChange={(e) => setNewProdTitle(e.target.value)}
            placeholder="Product title"
            className={`flex-1 ${CONSOLE_INPUT_CLS}`}
          />
          <button
            type="submit"
            className="h-8 px-3 rounded-[7px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--glass-border)] text-xs font-semibold text-[var(--ink)] inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>
      </form>

      <div className="pt-4 divide-y divide-[var(--line)]">
        {room.commerce.products.map((prod) => {
          const isPinned = room.commerce.pinnedProductId === prod.id;
          return (
            <div
              key={prod.id}
              className={`py-2.5 flex items-center gap-3 ${
                isPinned ? 'bg-[var(--accent-soft)] -mx-2 px-2 rounded-[6px]' : ''
              }`}
            >
              <img
                src={prod.imageUrl}
                alt={prod.title}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-[6px] object-cover bg-[var(--bg)] shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-[var(--ink)] truncate">{prod.title}</div>
                <div className="text-[11px] font-mono-num text-[var(--ink-3)]">
                  ${prod.price.toFixed(2)} · {prod.stock} left
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onPinProduct(isPinned ? null : prod.id)}
                  className={`h-7 px-2.5 rounded-[6px] text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer ${
                    isPinned
                      ? 'gather-btn-primary text-white'
                      : 'bg-[var(--fill)] border border-[var(--glass-border)] text-[var(--ink)]'
                  }`}
                >
                  <Pin className="w-3 h-3" />
                  <span>{isPinned ? 'Pinned' : 'Pin'}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onPatchRoom({
                      commerce: {
                        ...room.commerce,
                        products: room.commerce.products.filter((p) => p.id !== prod.id),
                      },
                    })
                  }
                  aria-label="Remove product"
                  className="h-7 w-7 grid place-items-center rounded text-[var(--ink-3)] hover:text-[var(--danger)] cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {room.commerce.recentOrders.length > 0 && (
        <div className="pt-4 space-y-2">
          <div className="text-xs font-semibold text-[var(--ink)]">
            Live In-Stream Orders ({room.commerce.recentOrders.length})
          </div>
          <div className="divide-y divide-[var(--line)]">
            {room.commerce.recentOrders.slice(0, 6).map((ord) => (
              <div key={ord.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="font-semibold text-[var(--ink)] truncate">
                    {ord.buyerName}
                    {ord.buyerCity ? ` · ${ord.buyerCity}` : ''}
                  </div>
                  <div className="text-[11px] text-[var(--ink-3)] truncate">
                    {ord.orderNumber ? `${ord.orderNumber} · ` : ''}
                    {ord.quantity}× {ord.productTitle}
                  </div>
                </div>
                <span className="font-mono-num font-bold text-[var(--ok)] shrink-0">
                  ${ord.total.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
