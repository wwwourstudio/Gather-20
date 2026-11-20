import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Gamepad2, HelpCircle, ListChecks, MessageSquare } from 'lucide-react';
import { AudienceQuestion, ProductItem } from '../types/studio';
import { WatchChatRail } from './watch/WatchChatRail';
import { WatchCompanionPanel } from './watch/WatchCompanionPanel';
import { WatchShopPanel } from './watch/WatchShopPanel';
import { WatchStageSection } from './watch/WatchStageSection';
import {
  BagItem,
  CompletedReceipt,
  computeBagLinePricing,
  GamerSubTab,
  ProgramSubTab,
  RailTab,
  ShopPanelTab,
  WatchPageViewProps,
} from './watch/watchTypes';

export type { WatchViewerUser } from './watch/watchTypes';

export const WatchPageView: React.FC<WatchPageViewProps> = ({
  room,
  clientId,
  isHost = false,
  user,
  onSignInWithGoogle,
  isSubscribed = false,
  subscribing = false,
  onToggleSubscribe,
  onRaiseHand,
  onLowerHand,
  broadcastStream,
  localPreviewCanvas,
  localStream,
  screenStream,
  remoteStreams,
  activeMedia,
  videoFx,
  elapsedSec,
  isPreviewMode,
  bagOpen,
  onSetBagOpen,
  onBagCountChange,
  onSwitchWatchMode,
  onSendChat,
  onToggleChatLike,
  onToggleChatReaction,
  onPinChatMessage,
  onDeleteChatMessage,
  onBlockChatUser,
  onUnblockChatUser,
  onAskQuestion,
  onUpvoteQuestion,
  onPlaceOrder,
  onVotePoll,
  onCreateClip,
  onJoinSquadQueue,
  onSendSuperChat,
  onSendHype,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mirrorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hypeStreakTimerRef = useRef<number | null>(null);

  const isShopMode = room.watchMode === 'shop';
  const isGamerMode = room.watchMode === 'gamer';
  const isStandardMode = room.watchMode === 'standard';

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [railTab, setRailTab] = useState<RailTab>('chat');
  const [shopPanelTab, setShopPanelTab] = useState<ShopPanelTab>('drop');
  const [gamerSubTab, setGamerSubTab] = useState<GamerSubTab>('squad');
  const [programSubTab, setProgramSubTab] = useState<ProgramSubTab>('agenda');
  const [viewerCaptionsOn, setViewerCaptionsOn] = useState(true);
  const [stageSoundOn, setStageSoundOn] = useState(false);
  const [pinnedOverlayDismissed, setPinnedOverlayDismissed] = useState(false);
  const [selectedDropProductId, setSelectedDropProductId] = useState<string | null>(null);
  const [addedFeedbackId, setAddedFeedbackId] = useState<string | null>(null);

  const [viewerName, setViewerName] = useState('Alex');
  const [questionDraft, setQuestionDraft] = useState('');
  const [upvotedIds, setUpvotedIds] = useState<Record<string, boolean>>({});

  const [bag, setBag] = useState<BagItem[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [buyerFullName, setBuyerFullName] = useState('');
  const [buyerCity, setBuyerCity] = useState('Austin, TX');
  const [shippingAddress, setShippingAddress] = useState('410 Congress Ave');
  const [checkoutMethod, setCheckoutMethod] = useState<'Apple Pay' | 'Google Pay' | 'Card' | 'PayPal'>('Apple Pay');
  const [lastReceipt, setLastReceipt] = useState<CompletedReceipt | null>(null);

  const [votedPollId, setVotedPollId] = useState<string | null>(null);
  const [arenaXp, setArenaXp] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('gather:arena_xp');
      if (saved) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed) && parsed >= 0) return parsed;
      }
    } catch {
      // ignore
    }
    return 1250;
  });
  const [wagerStake, setWagerStake] = useState<number>(100);
  const [activePrediction, setActivePrediction] = useState<{
    pollId: string;
    optionId: string;
    optionLabel: string;
    stake: number;
    odds: number;
  } | null>(null);
  const [hypeStreak, setHypeStreak] = useState(0);
  const [theaterMode, setTheaterMode] = useState(false);
  const [activePov, setActivePov] = useState<'main' | 'host' | 'tac'>('main');
  const [clipSavedToast, setClipSavedToast] = useState(false);

  useEffect(() => {
    setPinnedOverlayDismissed(false);
    setSelectedDropProductId(null);
  }, [room.roomCode]);

  useEffect(() => {
    if (!isShopMode && railTab === 'bag') {
      setRailTab('chat');
      onSetBagOpen(false);
    }
    if (isShopMode && railTab === 'qa') {
      setRailTab('chat');
      setShopPanelTab('qa');
    }
  }, [isShopMode, railTab, onSetBagOpen]);

  useEffect(() => {
    try {
      localStorage.setItem('gather:arena_xp', String(arenaXp));
    } catch {
      // ignore
    }
  }, [arenaXp]);

  useEffect(() => {
    if (!isGamerMode && theaterMode) {
      setTheaterMode(false);
    }
  }, [isGamerMode, theaterMode]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (user?.displayName) {
      setViewerName(user.displayName);
      setBuyerFullName((prev) => prev || user.displayName || '');
    } else if (user?.email) {
      const localPart = user.email.split('@')[0];
      setViewerName(localPart);
      setBuyerFullName((prev) => prev || localPart);
    }
  }, [user?.displayName, user?.email]);

  const effectiveViewerName = useMemo(() => {
    if (user?.displayName) return user.displayName;
    if (user?.email) return user.email.split('@')[0];
    return viewerName.trim() || 'Viewer';
  }, [user, viewerName]);

  const canPostToChat = Boolean(user) || isPreviewMode;

  useEffect(() => {
    if (bagOpen && isShopMode) {
      setRailTab('bag');
      setShopPanelTab('bag');
    }
  }, [bagOpen, isShopMode]);

  useEffect(() => {
    const count = isShopMode ? bag.reduce((sum, item) => sum + item.quantity, 0) : 0;
    onBagCountChange(count);
  }, [bag, isShopMode, onBagCountChange]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = !stageSoundOn;
    }
  }, [stageSoundOn]);

  useEffect(() => {
    if (videoRef.current && broadcastStream) {
      videoRef.current.srcObject = broadcastStream;
      void videoRef.current.play().catch(() => {});
    }
  }, [broadcastStream]);

  useEffect(() => {
    if (!isPreviewMode || !localPreviewCanvas || !mirrorCanvasRef.current) return;
    let raf = 0;
    const dst = mirrorCanvasRef.current;
    const ctx = dst.getContext('2d');
    const copyFrame = () => {
      if (ctx && localPreviewCanvas.width > 0 && localPreviewCanvas.height > 0) {
        if (dst.width !== localPreviewCanvas.width || dst.height !== localPreviewCanvas.height) {
          dst.width = localPreviewCanvas.width;
          dst.height = localPreviewCanvas.height;
        }
        ctx.drawImage(localPreviewCanvas, 0, 0);
      }
      raf = requestAnimationFrame(copyFrame);
    };
    raf = requestAnimationFrame(copyFrame);
    return () => cancelAnimationFrame(raf);
  }, [isPreviewMode, localPreviewCanvas]);

  const pinnedProduct = useMemo(
    () =>
      isShopMode
        ? room.commerce.products.find((p) => p.id === room.commerce.pinnedProductId) ||
          room.commerce.products[0]
        : undefined,
    [isShopMode, room.commerce.products, room.commerce.pinnedProductId]
  );

  const activeFlashSale = useMemo(() => {
    const fs = room.commerce.activeFlashSale;
    if (!isShopMode || !fs || !fs.active || fs.endsAt <= nowMs) return null;
    return fs;
  }, [isShopMode, room.commerce.activeFlashSale, nowMs]);

  const sortedQuestions = useMemo<AudienceQuestion[]>(() => {
    return [...(room.questions || [])].sort((a, b) => b.upvotes - a.upvotes);
  }, [room.questions]);

  const activeDropProduct = useMemo(() => {
    if (!isShopMode) return undefined;
    if (selectedDropProductId) {
      const found = room.commerce.products.find((p) => p.id === selectedDropProductId);
      if (found) return found;
    }
    return pinnedProduct;
  }, [isShopMode, selectedDropProductId, room.commerce.products, pinnedProduct]);

  const bagPricing = useMemo(() => {
    let retailSubtotal = 0;
    let finalTotal = 0;
    let totalSavings = 0;
    const lines = bag.map((item) => {
      const calc = computeBagLinePricing(item, activeFlashSale, nowMs);
      retailSubtotal += calc.retailTotal;
      finalTotal += calc.lineTotal;
      totalSavings += calc.savings;
      return { item, ...calc };
    });
    return {
      lines,
      retailSubtotal: Number(retailSubtotal.toFixed(2)),
      finalTotal: Number(finalTotal.toFixed(2)),
      totalSavings: Number(totalSavings.toFixed(2)),
    };
  }, [bag, activeFlashSale, nowMs]);

  const addToBag = (product: ProductItem, quantityToAdd = 1, bundleLabel?: string, openDrawer = true) => {
    const variant = selectedVariants[product.id] || product.variants[0] || 'Standard';
    setLastReceipt(null);
    setBag((prev) => {
      const existingIdx = prev.findIndex(
        (i) => i.product.id === product.id && i.variant === variant
      );
      if (existingIdx >= 0) {
        return prev.map((item, idx) =>
          idx === existingIdx
            ? {
                ...item,
                quantity: Math.min(product.stock, Math.max(item.quantity + quantityToAdd, quantityToAdd)),
                bundleLabel: bundleLabel || item.bundleLabel,
              }
            : item
        );
      }
      return [
        ...prev,
        {
          product,
          variant,
          quantity: Math.min(product.stock, Math.max(1, quantityToAdd)),
          bundleLabel,
        },
      ];
    });
    setAddedFeedbackId(product.id);
    window.setTimeout(() => {
      setAddedFeedbackId((curr) => (curr === product.id ? null : curr));
    }, 1500);
    if (openDrawer) {
      setRailTab('bag');
      setShopPanelTab('bag');
      onSetBagOpen(true);
    }
  };

  const handleCompleteBagOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (bag.length === 0) return;
    const buyer = (buyerFullName || effectiveViewerName).trim() || 'Live Shopper';
    const city = buyerCity.trim() || 'Austin, TX';
    const addr = shippingAddress.trim() || 'Express In-Stream Delivery';
    const orderNumber = `GTH-${Math.floor(1000 + Math.random() * 9000)}`;

    const itemsPayload = bagPricing.lines.map(({ item, discountLabel }) => ({
      productId: item.product.id,
      quantity: item.quantity,
      variant: item.variant,
      bundleLabel: discountLabel || item.bundleLabel,
    }));

    onPlaceOrder({
      buyerName: buyer,
      buyerCity: city,
      paymentMethod: checkoutMethod,
      items: itemsPayload,
    });

    setLastReceipt({
      orderNumber,
      buyerName: buyer,
      buyerCity: city,
      shippingAddress: addr,
      paymentMethod: checkoutMethod,
      items: bagPricing.lines.map(({ item, lineTotal, discountLabel }) => ({
        title: item.product.title,
        source: item.product.source,
        variant: item.variant,
        quantity: item.quantity,
        lineTotal,
        bundleLabel: discountLabel || item.bundleLabel,
      })),
      subtotal: bagPricing.retailSubtotal,
      savings: bagPricing.totalSavings,
      total: bagPricing.finalTotal,
      createdAt: Date.now(),
    });
    setBag([]);
  };

  const triggerHypeBurst = () => {
    onSendHype();
    if (isGamerMode) {
      setHypeStreak((prev) => Math.min(25, prev + 1));
      setArenaXp((xp) => xp + 5);
      if (hypeStreakTimerRef.current) window.clearTimeout(hypeStreakTimerRef.current);
      hypeStreakTimerRef.current = window.setTimeout(() => setHypeStreak(0), 2600);
    }
  };

  const handleQuickClipCapture = (customTitle?: string) => {
    const title = customTitle?.trim() || `${effectiveViewerName}'s Highlight`;
    onCreateClip(title, elapsedSec, effectiveViewerName);
    setClipSavedToast(true);
    setArenaXp((xp) => xp + 25);
    window.setTimeout(() => setClipSavedToast(false), 2000);
  };

  const handleLockPrediction = (pollId: string, optionId: string, optionLabel: string, odds: number) => {
    const stake = Math.min(arenaXp, wagerStake);
    onVotePoll(optionId);
    setVotedPollId(pollId);
    if (stake > 0) {
      setArenaXp((xp) => Math.max(0, xp - stake));
    }
    setActivePrediction({
      pollId,
      optionId,
      optionLabel,
      stake,
      odds,
    });
  };

  const handleSubmitQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPostToChat || !questionDraft.trim()) return;
    if (onAskQuestion) {
      onAskQuestion(questionDraft.trim(), effectiveViewerName);
    } else {
      onSendChat(`Q: ${questionDraft.trim()}`, effectiveViewerName);
    }
    setQuestionDraft('');
  };

  const myHandEntry = useMemo(() => {
    const queue = room.handRaiseQueue || [];
    return queue.find(
      (h) => (clientId && h.id === clientId) || (user?.uid && h.uid === user.uid)
    );
  }, [room.handRaiseQueue, clientId, user?.uid]);

  const myHandPosition = useMemo(() => {
    if (!myHandEntry) return 0;
    return (room.handRaiseQueue || []).findIndex((h) => h.id === myHandEntry.id) + 1;
  }, [room.handRaiseQueue, myHandEntry]);

  const onStageSpeakers = room.participants.filter((p) => p.onStage);
  const bagTotalCount = bag.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="flex-1 lg:flex-none lg:my-auto min-h-0 w-full lg:w-[min(96vw,calc(min(calc(100dvh-76px),840px)*1.66))] lg:max-w-[1440px] lg:h-[min(calc(100dvh-76px),840px)] lg:max-h-[calc(100dvh-76px)] mx-auto flex flex-col lg:overflow-hidden">
      {/* 100% Percentage Grid: 68% Stage / 32% Companion Rail on lg, 70% / 30% on xl */}
      <div
        className={`flex-1 min-h-0 w-full px-[1.2%] pb-3 pt-1 grid grid-cols-1 content-start lg:content-stretch gap-3.5 overflow-y-auto lg:overflow-hidden ${
          isGamerMode && theaterMode
            ? 'lg:grid-cols-1'
            : 'lg:grid-cols-[68%_32%] xl:grid-cols-[70%_30%]'
        }`}
      >
        <WatchStageSection
          room={room}
          isPreviewMode={isPreviewMode}
          localPreviewCanvas={localPreviewCanvas}
          localStream={localStream}
          screenStream={screenStream}
          remoteStreams={remoteStreams}
          activeMedia={activeMedia}
          videoFx={videoFx}
          broadcastStream={broadcastStream}
          videoRef={videoRef}
          mirrorCanvasRef={mirrorCanvasRef}
          elapsedSec={elapsedSec}
          nowMs={nowMs}
          stageSoundOn={stageSoundOn}
          onToggleStageSound={() => setStageSoundOn((v) => !v)}
          viewerCaptionsOn={viewerCaptionsOn}
          onToggleViewerCaptions={() => setViewerCaptionsOn((v) => !v)}
          theaterMode={theaterMode}
          onToggleTheaterMode={() => setTheaterMode((v) => !v)}
          activePov={activePov}
          onChangePov={setActivePov}
          pinnedProduct={pinnedProduct}
          pinnedOverlayDismissed={pinnedOverlayDismissed}
          onDismissPinnedOverlay={setPinnedOverlayDismissed}
          activeFlashSale={activeFlashSale}
          onJumpToShopDrop={() => setShopPanelTab('drop')}
          onAddToBag={addToBag}
          onSwitchWatchMode={onSwitchWatchMode}
          isSubscribed={isSubscribed}
          subscribing={subscribing}
          onToggleSubscribe={onToggleSubscribe}
          onRaiseHand={onRaiseHand}
          onLowerHand={onLowerHand}
          myHandPosition={myHandPosition}
          hasRaisedHand={Boolean(myHandEntry)}
          onTriggerHype={triggerHypeBurst}
          hypeStreak={hypeStreak}
          onQuickClipCapture={handleQuickClipCapture}
          clipSavedToast={clipSavedToast}
          arenaXp={arenaXp}
          wagerStake={wagerStake}
          onChangeWagerStake={setWagerStake}
          votedPollId={votedPollId}
          activePrediction={activePrediction}
          onLockPrediction={handleLockPrediction}
          onOpenArenaTab={(rail, sub) => {
            setRailTab(rail);
            setGamerSubTab(sub);
            if (theaterMode) setTheaterMode(false);
          }}
        />

        {!(isGamerMode && theaterMode) && (
          <aside className="flex flex-col gap-3 min-h-[540px] lg:min-h-0 lg:h-full w-full overflow-hidden">
            {isShopMode && (
              <WatchShopPanel
                room={room}
                shopPanelTab={shopPanelTab}
                onChangeTab={setShopPanelTab}
                onSetBagOpen={onSetBagOpen}
                bagTotalCount={bagTotalCount}
                bag={bag}
                onUpdateBagQty={(idx, delta) =>
                  setBag((prev) =>
                    prev
                      .map((b, i) =>
                        i === idx
                          ? { ...b, quantity: Math.min(b.product.stock, b.quantity + delta) }
                          : b
                      )
                      .filter((b) => b.quantity > 0)
                  )
                }
                bagPricing={bagPricing}
                activeFlashSale={activeFlashSale}
                activeDropProduct={activeDropProduct}
                onSelectDropProduct={setSelectedDropProductId}
                selectedVariants={selectedVariants}
                onSelectVariant={(productId, variant) =>
                  setSelectedVariants((prev) => ({ ...prev, [productId]: variant }))
                }
                addedFeedbackId={addedFeedbackId}
                onAddToBag={addToBag}
                sortedQuestions={sortedQuestions}
                canPostToChat={canPostToChat}
                questionDraft={questionDraft}
                onChangeQuestionDraft={setQuestionDraft}
                onSubmitQuestion={handleSubmitQuestion}
                upvotedIds={upvotedIds}
                onUpvoteQuestion={(id) => {
                  setUpvotedIds((prev) => ({ ...prev, [id]: true }));
                  onUpvoteQuestion?.(id);
                }}
                onSignInWithGoogle={onSignInWithGoogle}
                buyerFullName={buyerFullName}
                onChangeBuyerName={setBuyerFullName}
                buyerCity={buyerCity}
                onChangeBuyerCity={setBuyerCity}
                shippingAddress={shippingAddress}
                onChangeShippingAddress={setShippingAddress}
                checkoutMethod={checkoutMethod}
                onChangeCheckoutMethod={setCheckoutMethod}
                onCompleteBagOrder={handleCompleteBagOrder}
                lastReceipt={lastReceipt}
                onClearReceipt={() => setLastReceipt(null)}
                nowMs={nowMs}
              />
            )}

            <div className="gather-card-obsidian rounded-[18px] flex flex-col flex-1 min-h-[340px] lg:min-h-0 w-full overflow-hidden">
              {isShopMode ? (
                <div className="px-4 py-3 border-b border-[var(--line)] flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-3">
                    <h2 className="font-display text-[15px] font-medium text-[var(--ink)]">Live chat</h2>
                    <span className="text-[12px] text-[var(--ink-3)]">
                      Party ({Math.max(4, onStageSpeakers.length + 2)})
                    </span>
                  </div>
                  <span className="text-[12px] font-mono-num text-[var(--ink-3)]">
                    {room.viewerCount >= 1000
                      ? `${(room.viewerCount / 1000).toFixed(1).replace(/\.0$/, '')}K`
                      : room.viewerCount}
                  </span>
                </div>
              ) : (
                <div
                  className="px-3.5 border-b border-[var(--line)] flex items-center gap-1 shrink-0"
                  role="tablist"
                  aria-label="Stream Companion"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={railTab === 'chat'}
                    onClick={() => {
                      setRailTab('chat');
                      onSetBagOpen(false);
                    }}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 h-10 px-2 border-b -mb-px text-[12.5px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                      railTab === 'chat'
                        ? 'border-[var(--accent)] text-[var(--ink)]'
                        : 'border-transparent text-[var(--ink-3)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.65} />
                    <span>{isGamerMode ? 'Chat' : 'Live Chat'}</span>
                  </button>

                  {isGamerMode && (
                    <>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={railTab === 'companion'}
                        onClick={() => setRailTab('companion')}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 h-10 px-2 border-b -mb-px text-[12.5px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                          railTab === 'companion'
                            ? 'border-[var(--accent)] text-[var(--ink)]'
                            : 'border-transparent text-[var(--ink-3)] hover:text-[var(--ink)]'
                        }`}
                      >
                        <Gamepad2 className="w-3.5 h-3.5" strokeWidth={1.65} />
                        <span>Arena</span>
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={railTab === 'qa'}
                        onClick={() => setRailTab('qa')}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 h-10 px-2 border-b -mb-px text-[12.5px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                          railTab === 'qa'
                            ? 'border-[var(--accent)] text-[var(--ink)]'
                            : 'border-transparent text-[var(--ink-3)] hover:text-[var(--ink)]'
                        }`}
                      >
                        <HelpCircle className="w-3.5 h-3.5" strokeWidth={1.65} />
                        <span>Q&amp;A ({sortedQuestions.length})</span>
                      </button>
                    </>
                  )}

                  {isStandardMode && (
                    <>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={railTab === 'qa'}
                        onClick={() => setRailTab('qa')}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 h-10 px-2 border-b -mb-px text-[12.5px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                          railTab === 'qa'
                            ? 'border-[var(--accent)] text-[var(--ink)]'
                            : 'border-transparent text-[var(--ink-3)] hover:text-[var(--ink)]'
                        }`}
                      >
                        <HelpCircle className="w-3.5 h-3.5" strokeWidth={1.65} />
                        <span>Q&amp;A ({sortedQuestions.length})</span>
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={railTab === 'companion'}
                        onClick={() => setRailTab('companion')}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 h-10 px-2 border-b -mb-px text-[12.5px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                          railTab === 'companion'
                            ? 'border-[var(--accent)] text-[var(--ink)]'
                            : 'border-transparent text-[var(--ink-3)] hover:text-[var(--ink)]'
                        }`}
                      >
                        <ListChecks className="w-3.5 h-3.5" strokeWidth={1.65} />
                        <span>Program</span>
                      </button>
                    </>
                  )}
                </div>
              )}

              {isShopMode || railTab === 'chat' ? (
                <WatchChatRail
                  room={room}
                  isHost={isHost}
                  clientId={clientId}
                  user={user}
                  effectiveViewerName={effectiveViewerName}
                  canPostToChat={canPostToChat}
                  isSubscribed={isSubscribed}
                  subscribing={subscribing}
                  nowMs={nowMs}
                  onToggleSubscribe={onToggleSubscribe}
                  onSignInWithGoogle={onSignInWithGoogle}
                  onSendChat={onSendChat}
                  onToggleChatLike={onToggleChatLike}
                  onToggleChatReaction={onToggleChatReaction}
                  onPinChatMessage={onPinChatMessage}
                  onDeleteChatMessage={onDeleteChatMessage}
                  onBlockChatUser={onBlockChatUser}
                  onUnblockChatUser={onUnblockChatUser}
                  onSendSuperChat={onSendSuperChat}
                />
              ) : (
                <WatchCompanionPanel
                  room={room}
                  railTab={railTab}
                  gamerSubTab={gamerSubTab}
                  onChangeGamerSubTab={setGamerSubTab}
                  programSubTab={programSubTab}
                  onChangeProgramSubTab={setProgramSubTab}
                  elapsedSec={elapsedSec}
                  arenaXp={arenaXp}
                  onAwardXp={(delta) => setArenaXp((xp) => xp + delta)}
                  wagerStake={wagerStake}
                  onChangeWagerStake={setWagerStake}
                  votedPollId={votedPollId}
                  activePrediction={activePrediction}
                  onVotePoll={(optionId, pollId) => {
                    onVotePoll(optionId);
                    setVotedPollId(pollId);
                  }}
                  onLockPrediction={handleLockPrediction}
                  onJoinSquadQueue={onJoinSquadQueue}
                  onQuickClipCapture={handleQuickClipCapture}
                  clipSavedToast={clipSavedToast}
                  sortedQuestions={sortedQuestions}
                  canPostToChat={canPostToChat}
                  questionDraft={questionDraft}
                  onChangeQuestionDraft={setQuestionDraft}
                  onSubmitQuestion={handleSubmitQuestion}
                  upvotedIds={upvotedIds}
                  onUpvoteQuestion={(id) => {
                    setUpvotedIds((prev) => ({ ...prev, [id]: true }));
                    onUpvoteQuestion?.(id);
                  }}
                  onSignInWithGoogle={onSignInWithGoogle}
                />
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
