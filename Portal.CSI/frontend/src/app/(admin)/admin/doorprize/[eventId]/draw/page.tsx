"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  fetchDrawState,
  executeDraw,
  resetDrawResult,
} from "@/lib/doorprize-api";
import type {
  DrawState,
  DrawResponse,
  DoorprizeGift,
  DoorprizeParticipant,
} from "@/types/doorprize";
import SpinWheel from "../../components/SpinWheel";
import RouletteWheel from "../../components/RouletteWheel";
import SlotMachine from "../../components/SlotMachine";
import WinnerDisplay from "../../components/WinnerDisplay";
import s from "./draw.module.css";

// ── Settings types ──
interface DrawSettings {
  background: "event-image" | "dark-gradient";
  soundEnabled: boolean;
  speedMs: number; // 1000-10000 ms
  animationType: "roulette" | "swiper" | "slot";
}

const SETTINGS_KEY = "doorprize-draw-settings";

function loadSettings(): DrawSettings {
  if (typeof window === "undefined") {
    return { background: "dark-gradient", soundEnabled: true, speedMs: 4000, animationType: "roulette" };
  }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate old speedOverride format
      if (parsed.speedOverride && !parsed.speedMs) {
        const map: Record<string, number> = { fast: 2000, normal: 4000, slow: 8000, none: 0 };
        parsed.speedMs = map[parsed.speedOverride] || 0;
        delete parsed.speedOverride;
      }
      return parsed as DrawSettings;
    }
  } catch { /* ignore */ }
  return { background: "dark-gradient", soundEnabled: true, speedMs: 4000, animationType: "roulette" };
}

function saveSettings(settings: DrawSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

/**
 * Fullscreen Doorprize Draw Page — Legacy-style Swiper coverflow experience.
 *
 * Flow:
 * 1. Load draw state (gifts, participants, results)
 * 2. Show current gift card with PREV/NEXT navigation
 * 3. DRAW button: call executeDraw API → start Swiper animation → show winner popup
 * 4. Winner popup: Save (confirm) or Cancel (reset/delete result from DB)
 */
export default function DrawPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const router = useRouter();

  // Data state
  const [drawState, setDrawState] = useState<DrawState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Gift navigation
  const [currentGiftIndex, setCurrentGiftIndex] = useState(0);

  // Draw interaction state
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<DoorprizeParticipant | null>(null);
  const [winnerGift, setWinnerGift] = useState<DoorprizeGift | null>(null);
  const [lastResultId, setLastResultId] = useState<number | null>(null);
  const [showWinnerPopup, setShowWinnerPopup] = useState(false);
  const [showSwiper, setShowSwiper] = useState(false);
  // Incremented on each draw so animation components are fully unmounted/remounted,
  // guaranteeing all internal refs and state start fresh every draw.
  const [drawKey, setDrawKey] = useState(0);

  // Audio refs
  const spinAudioRef = useRef<HTMLAudioElement>(null);
  const winAudioRef = useRef<HTMLAudioElement>(null);

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Settings panel
  const [settings, setSettings] = useState<DrawSettings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);

  // ── Load draw state ──
  const loadDrawState = useCallback(async () => {
    setLoading(true);
    setError("");

    const result = await fetchDrawState(eventId);

    if (!result.success) {
      setError(result.message);
      setDrawState(null);
    } else {
      setDrawState(result.data);
    }

    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDrawState();
  }, [loadDrawState]);

  // ── Fullscreen toggle ──
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ── Settings helpers ──
  function updateSettings(patch: Partial<DrawSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }

  // ── Derived values ──
  const gifts = drawState?.gifts ?? [];
  const currentGift = gifts[currentGiftIndex] ?? null;
  const noQuota = currentGift ? currentGift.quotaRemaining <= 0 : true;
  const eligibleParticipants = drawState?.eligibleParticipants ?? [];
  const canDraw = !spinning && !noQuota && eligibleParticipants.length > 0;

  // ── Parse spinDuration from settings slider or gift.drawTime ──
  const spinDuration = (() => {
    // Settings slider takes priority when set (> 0)
    if (settings.speedMs > 0) {
      return settings.speedMs;
    }
    // Then try gift drawTime
    if (!currentGift?.drawTime) return 4000;
    const parsed = Number(currentGift.drawTime);
    return !isNaN(parsed) && parsed > 500 ? parsed : 4000;
  })();

  // ── Gift navigation ──
  function handlePrev() {
    if (currentGiftIndex > 0) {
      setCurrentGiftIndex(currentGiftIndex - 1);
      setShowSwiper(false);
    }
  }

  function handleNext() {
    if (currentGiftIndex < gifts.length - 1) {
      setCurrentGiftIndex(currentGiftIndex + 1);
      setShowSwiper(false);
    }
  }

  // ── Draw handler ──
  async function handleDraw() {
    if (!canDraw || !currentGift) return;

    // Call API immediately (server picks winner)
    const result = await executeDraw(eventId, currentGift.doorprizeGiftId);

    if (!result.success) {
      alert(result.message);
      return;
    }

    const drawResponse = result.data as DrawResponse;

    // Store result ID for potential cancel/reset
    setLastResultId(drawResponse.result.doorprizeResultId);

    // Set winner & gift BEFORE starting animation so RouletteWheel/SpinWheel/SlotMachine
    // receives the winner on first render and drives spin via drawDuration internally.
    // The old pattern (setWinner via setTimeout 1500ms) caused a race condition:
    // React re-renders in the 0-1500ms window triggered useEffect cleanup inside the
    // animation components, clearing their internal spinTimer -> onAnimationEnd never
    // fired -> spinning state stuck at true -> button showed "Drawing..." forever.
    setWinnerGift(drawResponse.gift);
    setWinner(drawResponse.winner);
    setDrawKey((k) => k + 1);
    setShowSwiper(true);
    setSpinning(true);

    if (settings.soundEnabled && spinAudioRef.current) {
      spinAudioRef.current.loop = true;
      spinAudioRef.current.volume = 0.3;
      spinAudioRef.current.currentTime = 0;
      spinAudioRef.current.play().catch(() => {});
    }
  }

  // ── Animation end handler (Swiper stopped on winner) ──
  const handleAnimationEnd = useCallback(() => {
    setSpinning(false);
    setShowWinnerPopup(true);

    // Stop spin sound, play win sound
    if (spinAudioRef.current) {
      spinAudioRef.current.pause();
      spinAudioRef.current.loop = false;
    }
    if (settings.soundEnabled && winAudioRef.current) {
      winAudioRef.current.volume = 0.4;
      winAudioRef.current.currentTime = 0;
      winAudioRef.current.play().catch(() => {});
    }
  }, [settings.soundEnabled]);

  // ── Save winner (confirm the result) ──
  async function handleSaveWinner() {
    setShowWinnerPopup(false);
    setShowSwiper(false);
    setWinner(null);
    setWinnerGift(null);
    setLastResultId(null);
    // Refresh draw state to reflect new result and updated quotas
    await loadDrawState();
  }

  // ── Cancel = undo the draw (delete result from DB) ──
  async function handleCancelDraw() {
    if (lastResultId) {
      await resetDrawResult(lastResultId);
    }
    setShowWinnerPopup(false);
    setShowSwiper(false);
    setWinner(null);
    setWinnerGift(null);
    setLastResultId(null);
    // Reload state to reflect the reset
    await loadDrawState();
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className={s.loadingWrap}>
        <div className={s.spinner} />
        <span className={s.loadingText}>Memuat status undian...</span>
      </div>
    );
  }

  // ── Error state ──
  if (error || !drawState) {
    return (
      <div className={s.errorWrap}>
        <p className={s.errorText}>⚠️ {error || "Gagal memuat data"}</p>
        <button
          type="button"
          className={s.errorBackBtn}
          onClick={() => router.push(`/admin/doorprize/${eventId}`)}
        >
          ← Kembali ke Detail Event
        </button>
      </div>
    );
  }

  // ── Build background style ──
  const useEventBg = settings.background === "event-image" && drawState.event.imageUrl;
  const bgStyle: React.CSSProperties = useEventBg
    ? { backgroundImage: `url(${drawState.event.imageUrl})` }
    : {};

  const containerClass = useEventBg
    ? `${s.fullscreen} ${s.fullscreenWithBg}`
    : s.fullscreen;

  // ── Main render ──
  return (
  <>
    <div className={containerClass} style={bgStyle}>
      {/* Back button */}
      <button
        type="button"
        className={s.backBtn}
        onClick={() => router.push(`/admin/doorprize/${eventId}`)}
      >
        ← Kembali
      </button>

      {/* Top-right controls */}
      <div className={s.topRightControls}>
        {/* Settings button */}
        <button
          type="button"
          className={s.settingsBtn}
          onClick={() => setShowSettings(!showSettings)}
          aria-label="Pengaturan"
        >
          ⚙
        </button>

        {/* Fullscreen toggle */}
        <button
          type="button"
          className={s.fullscreenBtn}
          onClick={toggleFullscreen}
        >
          {isFullscreen ? "⛶ Exit" : "⛶ Fullscreen"}
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <>
          <div className={s.settingsOverlay} onClick={() => setShowSettings(false)} />
          <div className={s.settingsPanel}>
          <h3 className={s.settingsTitle}>Pengaturan</h3>

          {/* Background */}
          <div className={s.settingsRow}>
            <label className={s.settingsLabel} htmlFor="bg-select">Background</label>
            <select
              id="bg-select"
              className={s.settingsSelect}
              value={settings.background}
              onChange={(e) => updateSettings({ background: e.target.value as DrawSettings["background"] })}
            >
              <option value="dark-gradient">Dark Gradient</option>
              {drawState.event.imageUrl && (
                <option value="event-image">Event Image</option>
              )}
            </select>
          </div>

          {/* Sound */}
          <div className={s.settingsRow}>
            <label className={s.settingsLabel} htmlFor="sound-toggle">Sound</label>
            <button
              id="sound-toggle"
              type="button"
              className={`${s.settingsToggle} ${settings.soundEnabled ? s.settingsToggleOn : ""}`}
              onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
              aria-pressed={settings.soundEnabled}
            >
              {settings.soundEnabled ? "ON" : "OFF"}
            </button>
          </div>

          {/* Draw speed — slider */}
          <div className={s.settingsRow}>
            <label className={s.settingsLabel} htmlFor="speed-slider">Draw Speed</label>
            <div className={s.sliderWrap}>
              <input
                id="speed-slider"
                type="range"
                className={s.settingsSlider}
                min={1}
                max={10}
                step={1}
                value={Math.round((settings.speedMs || 4000) / 1000)}
                onChange={(e) => updateSettings({ speedMs: Number(e.target.value) * 1000 })}
              />
              <span className={s.sliderValue}>{Math.round((settings.speedMs || 4000) / 1000)}s</span>
            </div>
          </div>

          {/* Animation type */}
          <div className={s.settingsRow}>
            <label className={s.settingsLabel} htmlFor="anim-select">Tipe Animasi</label>
            <select
              id="anim-select"
              className={s.settingsSelect}
              value={settings.animationType}
              onChange={(e) => updateSettings({ animationType: e.target.value as DrawSettings["animationType"] })}
            >
              <option value="roulette">Roulette Wheel</option>
              <option value="swiper">Swiper Coverflow</option>
              <option value="slot">Slot Machine</option>
            </select>
          </div>

          {/* Panel actions */}
          <div className={s.settingsPanelActions}>
            <button
              type="button"
              className={s.settingsBtnClose}
              onClick={() => setShowSettings(false)}
            >
              Tutup
            </button>
          </div>
        </div>
        </>
      )}

      {/* Event title */}
      <span className={s.eventTitle}>{drawState.event.name}</span>

      {/* Gift card */}
      {currentGift && (
        <div className={s.giftCard}>
          {currentGift.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentGift.imageUrl}
              alt={currentGift.name}
              className={s.giftImage}
            />
          ) : (
            <div className={s.giftImagePlaceholder} aria-hidden="true">
              🎁
            </div>
          )}
          <div className={s.giftInfo}>
            <h2 className={s.giftName}>{currentGift.name}</h2>
            <p className={s.giftQuota}>
              Sisa kuota: {currentGift.quotaRemaining} / {currentGift.quota}
            </p>
          </div>
        </div>
      )}

      {/* No quota message */}
      {noQuota && currentGift && (
        <p className={s.noQuotaMsg}>Kuota hadiah ini sudah habis</p>
      )}

      {/* PREV / DRAW / NEXT buttons */}
      <div className={s.controls}>
        {currentGiftIndex > 0 && (
          <button
            type="button"
            className={s.btnPrev}
            onClick={handlePrev}
            disabled={spinning}
          >
            PREV
          </button>
        )}

        <button
          type="button"
          className={s.btnDraw}
          onClick={handleDraw}
          disabled={!canDraw}
        >
          {spinning ? "Drawing..." : "DRAW"}
        </button>

        <button
          type="button"
          className={s.btnNext}
          onClick={handleNext}
          disabled={spinning || currentGiftIndex >= gifts.length - 1}
        >
          {currentGiftIndex === gifts.length - 1 ? "Finish" : "NEXT"}
        </button>
      </div>

      {/* Animation area */}
      {showSwiper && eligibleParticipants.length > 0 && (
        <div className={s.swiperArea}>
          {settings.animationType === "roulette" && (
            <RouletteWheel
              key={drawKey}
              participants={eligibleParticipants}
              spinning={spinning}
              winner={winner}
              drawDuration={spinDuration}
              onAnimationEnd={handleAnimationEnd}
            />
          )}
          {settings.animationType === "swiper" && (
            <SpinWheel
              key={drawKey}
              participants={eligibleParticipants}
              spinning={spinning}
              winner={winner}
              drawDuration={spinDuration}
              onAnimationEnd={handleAnimationEnd}
            />
          )}
          {settings.animationType === "slot" && (
            <SlotMachine
              key={drawKey}
              participants={eligibleParticipants}
              spinning={spinning}
              winner={winner}
              drawDuration={spinDuration}
              onAnimationEnd={handleAnimationEnd}
            />
          )}
        </div>
      )}

      {/* Sound effects */}
      <audio ref={spinAudioRef} src="/sounds/spin-sound.wav" preload="auto" />
      <audio ref={winAudioRef} src="/sounds/win-sound.wav" preload="auto" />
    </div>

    {/* Winner popup — rendered OUTSIDE fullscreen container to avoid z-index stacking issues */}
    {showWinnerPopup && winner && winnerGift && (
      <WinnerDisplay
        winner={winner}
        gift={winnerGift}
        onSave={handleSaveWinner}
        onCancel={handleCancelDraw}
      />
    )}
  </>
  );
}
