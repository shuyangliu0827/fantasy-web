"use client";

import { useEffect, useState } from "react";

// ── Tuneable constants ────────────────────────────────────────────
const TEXT_IN_DURATION    = 780;
const HOLD_DURATION       = 520;
const CURTAIN_UP_DURATION = 1100;
const TOTAL_HOLD = TEXT_IN_DURATION + HOLD_DURATION;
const TOTAL      = TOTAL_HOLD + CURTAIN_UP_DURATION + 40;

const BG           = "linear-gradient(160deg, #0a1628 0%, #0f2252 52%, #0c1e42 100%)";
const CURTAIN_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const FONT         = "'Barlow Condensed', sans-serif";

// Module-level flag:
//   • resets to false on every hard refresh (module re-initialises)
//   • stays true across client-side SPA navigations
// → curtain plays on refresh, skips on in-session nav back to home
let hasPlayedThisSession = false;

type Phase = "text-in" | "holding" | "exiting" | "done";

export default function BrandCurtain() {
  const [phase, setPhase] = useState<Phase>("text-in");

  useEffect(() => {
    if (hasPlayedThisSession) { setPhase("done"); return; }
    hasPlayedThisSession = true;

    const t1 = setTimeout(() => setPhase("holding"),  TEXT_IN_DURATION);
    const t2 = setTimeout(() => setPhase("exiting"),  TOTAL_HOLD);
    const t3 = setTimeout(() => setPhase("done"),     TOTAL);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
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
        transform:  isExiting ? "translateY(-100%)" : "translateY(0)",
        transition: isExiting ? `transform ${CURTAIN_UP_DURATION}ms ${CURTAIN_EASE}` : "none",
        boxShadow:  isExiting ? "0 36px 100px rgba(0,0,0,0.5)" : "none",
        willChange:     "transform",
        pointerEvents:  isExiting ? "none" : "auto",
      }}
    >
      {/* Radial centre glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 58% 48% at 50% 46%, rgba(37,99,235,0.2) 0%, transparent 70%)",
      }} />

      {/* ── Brand text block ─────────────────────────────────────── */}
      <div
        style={{
          position:  "relative",
          zIndex:    1,
          textAlign: "center",
          userSelect: "none",
        }}
      >
        {/* BLUEPRINT FANTASY */}
        <div
          className={
            phase === "text-in"  ? "bp-text-reveal"  :
            phase === "holding"  ? "bp-text-breathe" : undefined
          }
          style={{
            fontFamily:    FONT,
            fontWeight:    700,
            fontStyle:     "italic",
            fontSize:      "clamp(28px, 6vw, 56px)",
            color:         "#ffffff",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            lineHeight:    1,
          }}
        >
          Blueprint Fantasy
        </div>

        {/* Hairline divider */}
        <div
          className={phase === "text-in" ? "bp-line-reveal" : undefined}
          style={{
            width:        72,
            height:       1,
            background:   "rgba(255,255,255,0.35)",
            margin:       "20px auto 18px",
            borderRadius: 1,
            opacity:      phase === "text-in" ? 0 : 1,
          }}
        />

        {/* Load */}
        <div
          className={phase === "text-in" ? "bp-line-reveal" : undefined}
          style={{
            fontFamily:    FONT,
            fontWeight:    400,
            fontStyle:     "italic",
            fontSize:      "clamp(11px, 1.6vw, 14px)",
            color:         "rgba(191,219,254,0.58)",
            letterSpacing: "0.42em",
            textTransform: "uppercase",
            opacity:       phase === "text-in" ? 0 : 1,
          }}
        >
          Load
        </div>
      </div>
    </div>
  );
}
