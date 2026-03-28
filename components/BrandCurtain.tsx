"use client";

import { useEffect, useState } from "react";

/**
 * BrandCurtain — premium brand opening sequence for the homepage.
 *
 * First visit in session  → full cinematic curtain (text reveal → hold → slide up)
 * In-session return       → instant dismiss (no curtain shown)
 *
 * Tuneable constants are grouped at the top for easy adjustments.
 */

// ── Timing (ms) ──────────────────────────────────────────────────
const TEXT_IN_DURATION    = 780;   // text blur→clear animation
const HOLD_DURATION       = 480;   // pause after text settles
const CURTAIN_UP_DURATION = 1100;  // slide-up exit animation
const TOTAL_HOLD          = TEXT_IN_DURATION + HOLD_DURATION;       // 1260 ms
const TOTAL               = TOTAL_HOLD + CURTAIN_UP_DURATION + 40;  // 2400 ms

// ── Brand colour ─────────────────────────────────────────────────
// Deep premium navy — ties to the existing --gradient-hero in globals.css
const BG = "linear-gradient(160deg, #0a1628 0%, #0f2252 52%, #0c1e42 100%)";

// ── Easing ───────────────────────────────────────────────────────
// expo-out: starts fast, decelerates smoothly — like a curtain being pulled
const CURTAIN_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

type Phase = "text-in" | "holding" | "exiting" | "done";

export default function BrandCurtain() {
  const [phase, setPhase] = useState<Phase>("text-in");

  useEffect(() => {
    const key = "bp_intro_v1";
    const isFirstVisit = !sessionStorage.getItem(key);

    if (!isFirstVisit) {
      // In-session navigation: skip curtain entirely
      setPhase("done");
      return;
    }

    sessionStorage.setItem(key, "1");

    const t1 = setTimeout(() => setPhase("holding"),  TEXT_IN_DURATION);
    const t2 = setTimeout(() => setPhase("exiting"),  TOTAL_HOLD);
    const t3 = setTimeout(() => setPhase("done"),     TOTAL);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  if (phase === "done") return null;

  const isExiting = phase === "exiting";

  return (
    <div
      aria-hidden="true"
      style={{
        position:       "fixed",
        inset:          0,
        zIndex:         9999,
        background:     BG,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        // Curtain slides up — the page content is revealed beneath
        transform:      isExiting ? "translateY(-100%)" : "translateY(0)",
        transition:     isExiting
          ? `transform ${CURTAIN_UP_DURATION}ms ${CURTAIN_EASE}`
          : "none",
        // Shadow creates depth as the curtain lifts off the page content
        boxShadow:      isExiting
          ? "0 36px 100px rgba(0, 0, 0, 0.5)"
          : "none",
        willChange:     "transform",
        // Allow clicks through while exiting so the page is responsive immediately
        pointerEvents:  isExiting ? "none" : "auto",
      }}
    >
      {/* Radial brand-blue glow — ties to accent-blue var */}
      <div
        style={{
          position:      "absolute",
          inset:         0,
          background:    "radial-gradient(ellipse 58% 48% at 50% 46%, rgba(37,99,235,0.22) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Brand text block */}
      <div
        style={{
          position:   "relative",
          zIndex:     1,
          textAlign:  "center",
          userSelect: "none",
        }}
      >
        {/* "BLUEPRINT" — primary logotype */}
        <div
          className={
            phase === "text-in" ? "bp-text-reveal"
            : phase === "holding" ? "bp-text-breathe"
            : undefined
          }
          style={{
            fontSize:      "clamp(52px, 10vw, 96px)",
            fontWeight:    600,
            color:         "#ffffff",
            letterSpacing: "0.22em",
            fontFamily:    "'Oswald', sans-serif",
            lineHeight:    1,
            textTransform: "uppercase",
          }}
        >
          Blueprint
        </div>

        {/* Accent hairline */}
        <div
          className={phase === "text-in" ? "bp-line-reveal" : undefined}
          style={{
            width:        48,
            height:       1,
            background:   "rgba(255, 255, 255, 0.35)",
            margin:       "18px auto",
            borderRadius: 1,
            opacity:      phase === "text-in" ? 0 : 1,
          }}
        />

        {/* "FANTASY BASKETBALL" — subtitle */}
        <div
          className={phase === "text-in" ? "bp-line-reveal" : undefined}
          style={{
            fontSize:      "clamp(11px, 1.6vw, 15px)",
            fontWeight:    300,
            color:         "rgba(255, 255, 255, 0.62)",
            letterSpacing: "0.42em",
            fontFamily:    "'Oswald', sans-serif",
            textTransform: "uppercase",
            opacity:       phase === "text-in" ? 0 : 1,
          }}
        >
          Fantasy Basketball
        </div>
      </div>
    </div>
  );
}
