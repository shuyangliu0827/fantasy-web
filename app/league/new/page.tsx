"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LightHeader from "@/components/LightHeader";
import { createLeague } from "@/lib/shared/store";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

export default function NewLeaguePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setError("请输入联赛名称");
      return;
    }

    if (name.trim().length < 2) {
      setError("联赛名称至少 2 个字符");
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await createLeague({ name, visibility });

    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    router.push(`/league/${result.league.slug}`);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: FONT }}>
      <LightHeader activeHref="/league" />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 64px)", padding: "32px 16px" }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "40px 36px", width: "100%", maxWidth: 460, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}></div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111827", margin: "0 0 8px 0" }}>
              创建联赛
            </h1>
            <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
              创建你的 Fantasy 篮球联赛
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* League name */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                联赛名称
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={`例如：${new Date().getFullYear()} Fantasy 联赛`}
                maxLength={50}
                disabled={submitting}
                style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, color: "#111827", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: FONT, background: "#fff" }}
                onFocus={e => (e.currentTarget.style.borderColor = "#1e3a8a")}
                onBlur={e => (e.currentTarget.style.borderColor = "#e5e7eb")}
              />
              <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "right", marginTop: 4 }}>
                {name.length}/50
              </div>
            </div>

            {/* Visibility */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                可见性
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setVisibility("public")}
                  disabled={submitting}
                  style={{ flex: 1, padding: "11px", background: visibility === "public" ? "#eff6ff" : "#fff", border: `1.5px solid ${visibility === "public" ? "#1e3a8a" : "#e5e7eb"}`, borderRadius: 10, color: visibility === "public" ? "#1e3a8a" : "#6b7280", fontSize: 14, fontWeight: visibility === "public" ? 700 : 400, cursor: "pointer", fontFamily: FONT }}
                >
                   公开
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility("private")}
                  disabled={submitting}
                  style={{ flex: 1, padding: "11px", background: visibility === "private" ? "#eff6ff" : "#fff", border: `1.5px solid ${visibility === "private" ? "#1e3a8a" : "#e5e7eb"}`, borderRadius: 10, color: visibility === "private" ? "#1e3a8a" : "#6b7280", fontSize: 14, fontWeight: visibility === "private" ? 700 : 400, cursor: "pointer", fontFamily: FONT }}
                >
                   私密
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ padding: "11px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#dc2626", fontSize: 14, marginBottom: 20 }}>
                {error}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => router.back()}
                disabled={submitting}
                style={{ flex: 1, padding: "12px", background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 10, color: "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting || !name.trim()}
                style={{ flex: 2, padding: "12px", background: submitting || !name.trim() ? "#e5e7eb" : "#1e3a8a", border: "none", borderRadius: 10, color: submitting || !name.trim() ? "#9ca3af" : "#fff", fontSize: 14, fontWeight: 700, cursor: submitting || !name.trim() ? "not-allowed" : "pointer", fontFamily: FONT }}
              >
                {submitting ? "创建中..." : "创建联赛"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
