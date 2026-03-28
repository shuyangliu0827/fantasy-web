"use client";

import { useEffect, useState } from "react";

// ── Timing (ms) ──────────────────────────────────────────────────
const SHOW_DURATION  = 1600;  // spinner visible before curtain lifts
const SLIDE_DURATION = 950;   // curtain slide-up
const TOTAL          = SHOW_DURATION + SLIDE_DURATION + 30;

// ── Brand colour ─────────────────────────────────────────────────
const BG = "linear-gradient(160deg, #0a1628 0%, #0f2252 52%, #0c1e42 100%)";

// ── Easing ───────────────────────────────────────────────────────
const CURTAIN_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

// Circumference of the ring (r=58): 2π×58 ≈ 364
// Arc length 100 → ~27% of circle; gap 265 → ~73%
const RING_R    = 58;
const ARC_LEN   = 100;
const GAP_LEN   = Math.round(2 * Math.PI * RING_R) - ARC_LEN;

type Phase = "showing" | "exiting" | "done";

export default function BrandCurtain() {
  const [phase, setPhase] = useState<Phase>("showing");

  useEffect(() => {
    const key = "bp_intro_v2";
    const isFirst = !sessionStorage.getItem(key);

    if (!isFirst) {
      setPhase("done");
      return;
    }

    sessionStorage.setItem(key, "1");

    const t1 = setTimeout(() => setPhase("exiting"), SHOW_DURATION);
    const t2 = setTimeout(() => setPhase("done"),    TOTAL);

    return () => { clearTimeout(t1); clearTimeout(t2); };
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
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        transform:      isExiting ? "translateY(-100%)" : "translateY(0)",
        transition:     isExiting
          ? `transform ${SLIDE_DURATION}ms ${CURTAIN_EASE}`
          : "none",
        boxShadow:      isExiting ? "0 36px 100px rgba(0,0,0,0.5)" : "none",
        willChange:     "transform",
        pointerEvents:  isExiting ? "none" : "auto",
      }}
    >
      {/* Center radial glow */}
      <div style={{
        position:      "absolute",
        inset:         0,
        background:    "radial-gradient(ellipse 58% 48% at 50% 46%, rgba(37,99,235,0.22) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* ── BF Spinner ────────────────────────────────────────────── */}
      {/*
          A ring where B sits at the top (12 o'clock) and F at the
          bottom (6 o'clock). The whole assembly rotates so the ring
          itself is "formed" by the two letters orbiting the center.
          A bright arc segment riding the ring gives the loading feel.
      */}
      <div
        className="bp-spin"
        style={{ position: "relative", zIndex: 1, userSelect: "none" }}
      >
        <svg
          viewBox="0 0 140 140"
          width="140"
          height="140"
          overflow="visible"
        >
          {/* Subtle full ring — the circular track */}
          <circle
            cx="70" cy="70" r={RING_R}
            fill="none"
            stroke="rgba(255,255,255,0.13)"
            strokeWidth="2"
          />

          {/* Bright arc that rides the ring — the loading indicator */}
          <circle
            cx="70" cy="70" r={RING_R}
            fill="none"
            stroke="rgba(255,255,255,0.82)"
            strokeWidth="3"
            strokeDasharray={`${ARC_LEN} ${GAP_LEN}`}
            strokeLinecap="round"
          />

          {/* ── B — top of ring (12 o'clock) ── */}
          <text
            x="70" y="12"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="'Barlow Condensed', sans-serif"
            fontWeight="800"
            fontStyle="italic"
            fontSize="28"
            fill="white"
          >
            B
          </text>

          {/* ── F — bottom of ring (6 o'clock) ── */}
          <text
            x="70" y="128"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="'Barlow Condensed', sans-serif"
            fontWeight="800"
            fontStyle="italic"
            fontSize="28"
            fill="white"
          >
            F
          </text>
        </svg>
      </div>

      {/* ── "LOAD BLUEPRINT FANTASY" ──────────────────────────────── */}
      <div
        style={{
          position:      "relative",
          zIndex:        1,
          marginTop:     40,
          fontFamily:    "'Barlow Condensed', sans-serif",
          fontWeight:    700,
          fontStyle:     "italic",
          fontSize:      "clamp(12px, 1.8vw, 15px)",
          color:         "rgba(191,219,254,0.72)",
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          userSelect:    "none",
        }}
      >
        Load Blueprint Fantasy
      </div>
    </div>
  );
}
