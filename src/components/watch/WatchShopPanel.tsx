import React from 'react';
import { ArrowLeft, Clock, Minus, PackageCheck, Plus, ShoppingBag, ThumbsUp } from 'lucide-react';
import { AudienceQuestion, FlashSaleState, ProductItem, RoomState } from '../../types/studio';
import {
  BagItem,
  CompletedReceipt,
  formatClock,
  formatMoney,
  GoogleMarkSvg,
  ShopPanelTab,
} from './watchTypes';

interface WatchShopPanelProps {
  room: RoomState;
  shopPanelTab: ShopPanelTab;
  onChangeTab: (tab: ShopPanelTab) => void;
  onSetBagOpen: (open: boolean) => void;
  bagTotalCount: number;
  bag: BagItem[];
  onUpdateBagQty: (idx: number, delta: number) => void;
  bagPricing: {
    lines: Array<{
      item: BagItem;
      unitPrice: number;
      retailTotal: number;
      lineTotal: number;
      savings: number;
      discountLabel?: string;
    }>;
    retailSubtotal: number;
    finalTotal: number;
    totalSavings: number;
  };
  activeFlashSale: FlashSaleState | null;
  activeDropProduct?: ProductItem;
  onSelectDropProduct: (id: string) => void;
  selectedVariants: Record<string, string>;
  onSelectVariant: (productId: string, variant: string) => void;
  addedFeedbackId: string | null;
  onAddToBag: (product: ProductItem, qty?: number, bundleLabel?: string, openDrawer?: boolean) => void;
  sortedQuestions: AudienceQuestion[];
  canPostToChat: boolean;
  questionDraft: string;
  onChangeQuestionDraft: (val: string) => void;
  onSubmitQuestion: (e: React.FormEvent) => void;
  upvotedIds: Record<string, boolean>;
  onUpvoteQuestion: (id: string) => void;
  onSignInWithGoogle?: () => Promise<void>;
  buyerFullName: string;
  onChangeBuyerName: (v: string) => void;
  buyerCity: string;
  onChangeBuyerCity: (v: string) => void;
  shippingAddress: string;
  onChangeShippingAddress: (v: string) => void;
  checkoutMethod: 'Apple Pay' | 'Google Pay' | 'Card' | 'PayPal';
  onChangeCheckoutMethod: (m: 'Apple Pay' | 'Google Pay' | 'Card' | 'PayPal') => void;
  onCompleteBagOrder: (e: React.FormEvent) => void;
  lastReceipt: CompletedReceipt | null;
  onClearReceipt: () => void;
  nowMs: number;
}

export const WatchShopPanel: React.FC<WatchShopPanelProps> = ({
  room,
  shopPanelTab,
  onChangeTab,
  onSetBagOpen,
  bagTotalCount,
  bag,
  onUpdateBagQty,
  bagPricing,
  activeFlashSale,
  activeDropProduct,
  onSelectDropProduct,
  selectedVariants,
  onSelectVariant,
  addedFeedbackId,
  onAddToBag,
  sortedQuestions,
  canPostToChat,
  questionDraft,
  onChangeQuestionDraft,
  onSubmitQuestion,
  upvotedIds,
  onUpvoteQuestion,
  onSignInWithGoogle,
  buyerFullName,
  onChangeBuyerName,
  buyerCity,
  onChangeBuyerCity,
  shippingAddress,
  onChangeShippingAddress,
  checkoutMethod,
  onChangeCheckoutMethod,
  onCompleteBagOrder,
  lastReceipt,
  onClearReceipt,
  nowMs,
}) => {
  const getProductSalePrice = (prod: ProductItem) => {
    if (activeFlashSale && activeFlashSale.productId === prod.id) {
      return Number((prod.price * (1 - activeFlashSale.discountPct / 100)).toFixed(2));
    }
    return prod.price;
  };

  return (
    <div className="gather-card-obsidian rounded-[18px] p-4 flex flex-col gap-2.5 shrink-0 max-h-[54%] overflow-hidden">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {shopPanelTab === 'bag' ? (
            <button
              type="button"
              onClick={() => {
                onChangeTab('drop');
                onSetBagOpen(false);
              }}
              className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[var(--ink)] hover:text-[var(--accent-text)] cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Express Bag</span>
            </button>
          ) : (
            <h2 className="font-display text-[16px] font-medium text-[var(--ink)] truncate">
              Shop the live drop
            </h2>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            const next = shopPanelTab === 'bag' ? 'drop' : 'bag';
            onChangeTab(next);
            onSetBagOpen(next === 'bag');
          }}
          className={`h-8 px-3 rounded-[9px] text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
            shopPanelTab === 'bag'
              ? 'gather-btn-primary text-white'
              : 'gather-liquid-pill text-[var(--ink)]'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span className="font-mono-num">Bag ({bagTotalCount})</span>
        </button>
      </div>

      {shopPanelTab !== 'bag' && (
        <div className="flex items-center gap-4 border-b border-[var(--line)] text-[11.5px] shrink-0 overflow-x-auto gather-scroll">
          {(
            [
              { id: 'drop', label: 'Featured' },
              { id: 'all', label: `Lookbook (${room.commerce.products.length})` },
              { id: 'claims', label: `Claims (${room.commerce.recentOrders.length})` },
              { id: 'qa', label: `Q&A (${sortedQuestions.length})` },
            ] as const
          ).map((tab) => {
            const active = shopPanelTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeTab(tab.id)}
                className={`pb-2 -mb-px font-medium cursor-pointer transition-colors border-b whitespace-nowrap ${
                  active
                    ? 'text-[var(--ink)] border-[var(--accent)]'
                    : 'text-[var(--ink-3)] hover:text-[var(--ink)] border-transparent'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto gather-scroll space-y-3 pr-0.5">
        {shopPanelTab === 'drop' && activeDropProduct && (
          <>
            {activeFlashSale && (
              <div className="rounded-[10px] bg-[var(--fill)] border border-[var(--line)] px-3 py-2 flex items-center justify-between gap-2 text-[11.5px]">
                <span className="font-semibold tracking-wider uppercase text-amber-600 dark:text-amber-400">
                  Flash sale · {activeFlashSale.discountPct}% off
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono-num font-semibold text-[var(--ink)]">
                  <Clock className="w-3.5 h-3.5 text-[var(--ink-3)]" />
                  {formatClock((activeFlashSale.endsAt - nowMs) / 1000)}
                </span>
              </div>
            )}

            <div className="flex items-start gap-3">
              <img
                src={activeDropProduct.imageUrl}
                alt={activeDropProduct.title}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-[11px] object-cover border border-[var(--line-2)] shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-0.5">
                <h3 className="text-[14.5px] font-medium text-[var(--ink)] leading-snug truncate">
                  {activeDropProduct.title}
                </h3>
                <p className="text-[11.5px] text-[var(--ink-3)] line-clamp-1">
                  {activeDropProduct.description || `${activeDropProduct.source} live exclusive`}
                </p>
                <div className="flex items-baseline gap-2 pt-0.5">
                  <span className="font-mono-num text-[16px] font-medium text-[var(--ink)]">
                    {formatMoney(getProductSalePrice(activeDropProduct))}
                  </span>
                  {getProductSalePrice(activeDropProduct) < activeDropProduct.price && (
                    <span className="font-mono-num text-[12px] line-through text-[var(--ink-3)]">
                      {formatMoney(activeDropProduct.price)}
                    </span>
                  )}
                  <span className="text-[10.5px] font-mono-num text-[var(--ink-3)]">
                    {activeDropProduct.currency || 'USD'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-[var(--ink)]">
                  {selectedVariants[activeDropProduct.id] || activeDropProduct.variants[0] || 'Standard edition'}
                </div>
                <div className="text-[11px] text-[var(--ink-3)]">
                  Instant in-stream claim · Free US shipping
                </div>
              </div>
              {activeDropProduct.variants.length > 1 && (
                <select
                  aria-label={`Select variant for ${activeDropProduct.title}`}
                  value={selectedVariants[activeDropProduct.id] || activeDropProduct.variants[0]}
                  onChange={(e) => onSelectVariant(activeDropProduct.id, e.target.value)}
                  className="h-8 px-2 rounded-[8px] bg-[var(--fill)] border border-[var(--line-2)] text-[11px] text-[var(--ink)] max-w-[42%]"
                >
                  {activeDropProduct.variants.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="text-[11.5px] font-semibold text-amber-600 dark:text-amber-400">
              {activeDropProduct.stock} of {activeFlashSale?.totalUnits || 15} drop units left
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={activeDropProduct.stock <= 0}
                onClick={() => onAddToBag(activeDropProduct, 1, undefined, true)}
                className="flex-1 h-10 rounded-[11px] gather-btn-primary text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>
                  {activeDropProduct.stock > 0
                    ? `Buy now · ${formatMoney(getProductSalePrice(activeDropProduct))}`
                    : 'Sold Out'}
                </span>
              </button>
              <button
                type="button"
                disabled={activeDropProduct.stock <= 0}
                onClick={() => onAddToBag(activeDropProduct, 1, undefined, false)}
                className="h-10 px-4 rounded-[11px] gather-liquid-pill text-[13px] font-semibold text-[var(--ink)] cursor-pointer whitespace-nowrap shrink-0"
              >
                {addedFeedbackId === activeDropProduct.id ? 'Added ✓' : 'Add to bag'}
              </button>
            </div>

            {room.commerce.products.length > 1 && (
              <div className="flex items-center gap-2 pt-1.5 border-t border-[var(--line)]">
                {room.commerce.products.map((prod) => {
                  const isSelected = activeDropProduct.id === prod.id;
                  return (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => onSelectDropProduct(prod.id)}
                      className={`flex-1 min-w-0 p-1.5 rounded-[9px] border flex items-center gap-2 text-left cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[var(--accent-soft)] border-[var(--accent-line)]'
                          : 'bg-[var(--fill)] border-[var(--line)] hover:border-[var(--line-2)]'
                      }`}
                    >
                      <img
                        src={prod.imageUrl}
                        alt={prod.title}
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 rounded-[6px] object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-semibold text-[var(--ink)] truncate">
                          {prod.title}
                        </div>
                        <div className="text-[10px] font-mono-num text-[var(--ink-3)]">
                          {formatMoney(getProductSalePrice(prod))}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {shopPanelTab === 'all' && (
          <div className="divide-y divide-[var(--line)]">
            {room.commerce.products.map((prod, idx) => {
              const displayPrice = getProductSalePrice(prod);
              return (
                <div key={prod.id} className="py-2.5 first:pt-0 last:pb-0 flex gap-3">
                  <img
                    src={prod.imageUrl}
                    alt={prod.title}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-[9px] object-cover shrink-0 border border-[var(--line)]"
                  />
                  <div className="min-w-0 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 text-[10px] font-mono-num text-[var(--ink-3)]">
                        <span>
                          0{idx + 1} · {prod.source}
                        </span>
                        <span>{prod.stock} left</span>
                      </div>
                      <h4 className="text-[13px] font-semibold text-[var(--ink)] truncate">
                        {prod.title}
                      </h4>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="font-mono-num text-[12.5px] font-bold text-[var(--ink)]">
                        {formatMoney(displayPrice)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={prod.stock <= 0}
                          onClick={() => onAddToBag(prod, 1, undefined, false)}
                          className="h-7 px-2.5 rounded-[7px] gather-liquid-pill text-[11px] font-semibold text-[var(--ink)] cursor-pointer whitespace-nowrap"
                        >
                          {addedFeedbackId === prod.id ? 'Added ✓' : '+ Bag'}
                        </button>
                        <button
                          type="button"
                          disabled={prod.stock <= 0}
                          onClick={() => onAddToBag(prod, 1, undefined, true)}
                          className="h-7 px-2.5 rounded-[7px] gather-btn-primary text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                        >
                          Buy
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {shopPanelTab === 'claims' && (
          <div className="divide-y divide-[var(--line)]">
            {room.commerce.recentOrders.length === 0 ? (
              <p className="text-[12px] text-[var(--ink-3)] py-6 text-center">
                Live claims appear here as shoppers reserve pieces in-stream.
              </p>
            ) : (
              room.commerce.recentOrders.map((ord) => (
                <div key={ord.id} className="py-2 first:pt-0 space-y-0.5">
                  <div className="flex items-center justify-between text-[11px] text-[var(--ok)] font-mono-num font-semibold">
                    <span>#{ord.orderNumber || 'Claimed'}</span>
                    <span>${ord.total.toFixed(2)}</span>
                  </div>
                  <div className="text-[12.5px] font-medium text-[var(--ink)] truncate">
                    {ord.buyerName} · {ord.quantity}× {ord.productTitle}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {shopPanelTab === 'qa' && (
          <div className="space-y-2.5">
            {canPostToChat ? (
              <form onSubmit={onSubmitQuestion} className="flex gap-1.5">
                <input
                  type="text"
                  value={questionDraft}
                  onChange={(e) => onChangeQuestionDraft(e.target.value)}
                  placeholder="Ask about sizing or materials..."
                  className="flex-1 min-w-0 h-8 px-2.5 rounded-[8px] bg-[var(--fill)] border border-[var(--line-2)] text-[12px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="submit"
                  className="h-8 px-3 rounded-[8px] gather-btn-primary text-[11.5px] font-semibold cursor-pointer shrink-0"
                >
                  Ask
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => void onSignInWithGoogle?.()}
                className="w-full h-9 px-3 rounded-[9px] gather-liquid-pill text-[var(--ink)] font-medium text-[12px] inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <GoogleMarkSvg />
                <span>Sign in with Google to Ask</span>
              </button>
            )}

            <div className="divide-y divide-[var(--line)]">
              {sortedQuestions.map((q) => {
                const upvoted = Boolean(upvotedIds[q.id]);
                return (
                  <div key={q.id} className="py-2 first:pt-0 space-y-1">
                    <p className="text-[12px] text-[var(--ink)] leading-snug">{q.text}</p>
                    <div className="flex items-center justify-between text-[11px] text-[var(--ink-3)]">
                      <span>{q.author}</span>
                      <button
                        type="button"
                        disabled={upvoted}
                        onClick={() => {
                          if (!upvoted) onUpvoteQuestion(q.id);
                        }}
                        className={`h-6 px-2 rounded-[6px] font-mono-num font-semibold inline-flex items-center gap-1 cursor-pointer ${
                          upvoted
                            ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                            : 'bg-[var(--fill)] text-[var(--ink-2)]'
                        }`}
                      >
                        <ThumbsUp className="w-3 h-3" />
                        <span>{q.upvotes}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {shopPanelTab === 'bag' && (
          <div className="space-y-3">
            {lastReceipt && bag.length === 0 ? (
              <div className="p-3 rounded-[12px] bg-[var(--fill)] border border-emerald-500/35 space-y-2.5 animate-gather-msg">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-[8px] bg-emerald-500/18 text-[var(--ok)] grid place-items-center shrink-0">
                      <PackageCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10.5px] font-mono-num font-semibold text-[var(--ok)]">
                        #{lastReceipt.orderNumber} Confirmed
                      </div>
                      <div className="text-[13px] font-semibold text-[var(--ink)]">
                        In-Stream Claim Placed
                      </div>
                    </div>
                  </div>
                  <span className="text-[12.5px] font-mono-num font-bold text-[var(--ink)]">
                    ${lastReceipt.total.toFixed(2)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClearReceipt();
                    onChangeTab('drop');
                    onSetBagOpen(false);
                  }}
                  className="w-full h-8 rounded-[9px] gather-btn-primary text-[12px] font-semibold cursor-pointer"
                >
                  Back to Live Drop
                </button>
              </div>
            ) : bag.length === 0 ? (
              <div className="py-5 text-center space-y-2.5">
                <p className="text-[12px] text-[var(--ink-3)]">
                  Your Express Bag is empty. Claim an item from the live drop with zero redirects.
                </p>
                {activeDropProduct && activeDropProduct.stock > 0 && (
                  <button
                    type="button"
                    onClick={() => onAddToBag(activeDropProduct, 1, undefined, true)}
                    className="h-8 px-3.5 rounded-[9px] gather-btn-primary text-[12px] font-semibold cursor-pointer"
                  >
                    + Add {activeDropProduct.title}
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="divide-y divide-[var(--line)]">
                  {bagPricing.lines.map(({ item, lineTotal, discountLabel }, idx) => (
                    <div
                      key={`${item.product.id}-${item.variant}`}
                      className="py-2 first:pt-0 flex items-center gap-2.5"
                    >
                      <img
                        src={item.product.imageUrl}
                        alt={item.product.title}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-[8px] object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-semibold text-[var(--ink)] truncate">
                          {item.product.title}
                        </div>
                        <div className="text-[10.5px] text-[var(--ink-3)] flex items-center gap-1.5">
                          <span className="truncate">{item.variant}</span>
                          {discountLabel && (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold shrink-0">
                              {discountLabel}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() => onUpdateBagQty(idx, -1)}
                          className="w-5 h-5 rounded bg-[var(--fill)] hover:bg-[var(--fill-hover)] grid place-items-center text-[var(--ink-2)] cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-[11px] font-mono-num w-4 text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() => onUpdateBagQty(idx, 1)}
                          className="w-5 h-5 rounded bg-[var(--fill)] hover:bg-[var(--fill-hover)] grid place-items-center text-[var(--ink-2)] cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <span className="font-mono-num text-[12px] font-bold text-[var(--ok)] ml-1">
                          {formatMoney(lineTotal)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <form
                  id="gather-shop-express-form"
                  onSubmit={onCompleteBagOrder}
                  className="space-y-2 pt-2 border-t border-[var(--line)]"
                >
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      required
                      value={buyerFullName}
                      onChange={(e) => onChangeBuyerName(e.target.value)}
                      placeholder="Full Name"
                      className="h-8 px-2.5 rounded-[8px] bg-[var(--fill)] border border-[var(--line-2)] text-[11.5px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--accent)]"
                    />
                    <input
                      type="text"
                      required
                      value={buyerCity}
                      onChange={(e) => onChangeBuyerCity(e.target.value)}
                      placeholder="City, State"
                      className="h-8 px-2.5 rounded-[8px] bg-[var(--fill)] border border-[var(--line-2)] text-[11.5px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <input
                    type="text"
                    required
                    value={shippingAddress}
                    onChange={(e) => onChangeShippingAddress(e.target.value)}
                    placeholder="Street Shipping Address"
                    className="w-full h-8 px-2.5 rounded-[8px] bg-[var(--fill)] border border-[var(--line-2)] text-[11.5px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--accent)]"
                  />
                  <div className="grid grid-cols-4 gap-1">
                    {(['Apple Pay', 'Google Pay', 'Card', 'PayPal'] as const).map((pm) => (
                      <button
                        key={pm}
                        type="button"
                        onClick={() => onChangeCheckoutMethod(pm)}
                        className={`h-7 rounded-[7px] text-[10px] font-semibold cursor-pointer whitespace-nowrap ${
                          checkoutMethod === pm
                            ? 'gather-btn-primary text-white'
                            : 'gather-liquid-pill text-[var(--ink-2)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {pm}
                      </button>
                    ))}
                  </div>
                  {bagPricing.totalSavings > 0 && (
                    <div className="flex items-center justify-between text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      <span>Flash &amp; bundle savings</span>
                      <span className="font-mono-num">-${bagPricing.totalSavings.toFixed(2)}</span>
                    </div>
                  )}
                  <button
                    type="submit"
                    className="w-full h-9 rounded-[10px] gather-btn-tip text-[12.5px] font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Pay with {checkoutMethod} · ${bagPricing.finalTotal.toFixed(2)}
                  </button>
                </form>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
