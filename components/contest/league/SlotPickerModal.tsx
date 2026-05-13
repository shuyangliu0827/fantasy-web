"use client";

// Tiny modal that appears when a player is eligible for more than one
// empty lineup slot. The user picks which slot to fill.

import { SLOT_LABELS } from "@/lib/basketball/contest-positions";
import { useLang } from "@/lib/lang";

export default function SlotPickerModal({
  playerName,
  eligibleSlots,
  onPick,
  onCancel,
}: {
  playerName: string;
  eligibleSlots: number[];
  onPick: (slot: number) => void;
  onCancel: () => void;
}) {
  const { t } = useLang();
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: 20,
          maxWidth: 360,
          width: "100%",
          boxShadow: "0 18px 40px rgba(15,23,42,0.18)",
        }}
      >
        <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {t("选择位置", "Pick a slot")}
        </div>
        <div style={{ fontSize: 17, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>
          {playerName}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          {eligibleSlots.map((slot) => (
            <button
              key={slot}
              onClick={() => onPick(slot)}
              style={{
                flex: "1 1 60px",
                padding: "10px 14px",
                border: "1px solid #1e3a8a",
                background: "#1e3a8a",
                color: "#fff",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              {SLOT_LABELS[slot] ?? `S${slot + 1}`}
            </button>
          ))}
        </div>
        <button
          onClick={onCancel}
          style={{
            marginTop: 14,
            background: "transparent",
            border: "none",
            color: "#64748b",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            padding: 6,
          }}
        >
          {t("取消", "Cancel")}
        </button>
      </div>
    </div>
  );
}
