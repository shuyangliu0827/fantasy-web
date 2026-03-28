"use client";

import { useEffect, useState } from "react";

// ── Timing (ms) ──────────────────────────────────────────────────
const SHOW_DURATION  = 1700;
const SLIDE_DURATION = 950;
const TOTAL          = SHOW_DURATION + SLIDE_DURATION + 30;

const BG          = "linear-gradient(160deg, #0a1628 0%, #0f2252 52%, #0c1e42 100%)";
const CURTAIN_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

type Phase = "showing" | "exiting" | "done";

export default function BrandCurtain() {
  const [phase, setPhase] = useState<Phase>("showing");

  useEffect(() => {
    const key = "bp_intro_v3";
    const isFirst = !sessionStorage.getItem(key);

    if (!isFirst) { setPhase("done"); return; }
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
        transform:  isExiting ? "translateY(-100%)" : "translateY(0)",
        transition: isExiting ? `transform ${SLIDE_DURATION}ms ${CURTAIN_EASE}` : "none",
        boxShadow:  isExiting ? "0 36px 100px rgba(0,0,0,0.5)" : "none",
        willChange:     "transform",
        pointerEvents:  isExiting ? "none" : "auto",
      }}
    >
      {/* Radial glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 58% 48% at 50% 46%, rgba(37,99,235,0.22) 0%, transparent 70%)",
      }} />

      {/* ── BF logo spinner ────────────────────────────────────────
          Hand-crafted SVG that imitates the circular bf logo:
          • outer ring
          • lowercase b  — tall stem with top curl, leaf, D-bowl
          • lowercase f  — sweeping hook touching the ring, crossbar
          • three leaf accents (top-of-b, f-hook junction, bottom-right)
          The whole SVG rotates via .bp-spin.
      ──────────────────────────────────────────────────────────── */}
      <div
        className="bp-spin"
        style={{ position: "relative", zIndex: 1, userSelect: "none" }}
      >
        <svg
          viewBox="0 0 120 120"
          width="160"
          height="160"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* ── Outer ring ────────────────────────────── */}
          <circle
            cx="60" cy="60" r="50"
            stroke="white" strokeWidth="2.8"
          />

          {/* ── "b" stem ──────────────────────────────── */}
          {/*   Runs from bottom up; curves at the top     */}
          {/*   into the leaf curl (right-hand curl)       */}
          <path
            d="M 43 84
               C 43 70 42 50 42 35
               C 42 26 45 21 49 19
               C 52 17.5 55 18 57 21"
            stroke="white" strokeWidth="3.5"
            strokeLinecap="round" strokeLinejoin="round"
          />

          {/* ── "b" bowl ──────────────────────────────── */}
          {/*   D-shaped loop from stem mid to stem lower  */}
          <path
            d="M 42 51
               C 51 46 68 48 68 60
               C 68 73 53 81 42 78"
            stroke="white" strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* ── "f" vertical stem ─────────────────────── */}
          <line
            x1="70" y1="26" x2="70" y2="84"
            stroke="white" strokeWidth="3.5" strokeLinecap="round"
          />

          {/* ── "f" hook ──────────────────────────────── */}
          {/*   Sweeps from stem top rightward, arching    */}
          {/*   toward the outer ring (upper-right area)   */}
          <path
            d="M 70 28
               C 70 17 80 11 87 18
               C 92 23 91 33 83 36"
            stroke="white" strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* ── "f" crossbar ──────────────────────────── */}
          {/*   Horizontal bar at the same level as the   */}
          {/*   b bowl's upper edge, creating unity        */}
          <line
            x1="57" y1="52" x2="82" y2="52"
            stroke="white" strokeWidth="3.5" strokeLinecap="round"
          />

          {/* ── Leaf: top of b curl ───────────────────── */}
          <path
            d="M 57 21 C 61 12 68 14 64 22 C 62 27 56 25 57 21 Z"
            fill="white"
          />

          {/* ── Leaf: f hook junction with ring ──────── */}
          {/*   Sits where the hook arc meets the circle  */}
          <path
            d="M 87 18 C 93 10 100 15 95 23 C 92 28 85 24 87 18 Z"
            fill="white"
          />

          {/* ── Leaf: lower-right decorative accent ──── */}
          {/*   Matches the bottom leaf in the reference  */}
          <path
            d="M 90 75 C 96 68 102 73 96 81 C 93 85 87 80 90 75 Z"
            fill="white"
          />
        </svg>
      </div>

      {/* ── "LOAD BLUEPRINT FANTASY" ────────────────────────────── */}
      <div
        style={{
          position:      "relative",
          zIndex:        1,
          marginTop:     36,
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
