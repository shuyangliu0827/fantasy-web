"use client";

import { useLang } from "@/lib/lang";

export default function PendingAccessNotice() {
  const { t } = useLang();
  return (
    <div
      style={{
        background: "#fef3c7",
        color: "#92400e",
        border: "1px solid #fde68a",
        borderRadius: 12,
        padding: "12px 16px",
        fontSize: 14,
        fontWeight: 700,
        margin: "16px 0",
      }}
    >
      {t(
        "你的访问申请正在审核中。",
        "Your access request is pending review.",
      )}
    </div>
  );
}
