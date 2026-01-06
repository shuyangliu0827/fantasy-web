"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { listInsights, Insight } from "@/lib/store";

export default function InsightDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const all = listInsights();
    const found = all.find(i => i.id === id) ?? null;

    setInsight(found);
    setLoading(false);
  }, [id]);

  if (loading) {
    return (
      <div className="bpfx-bg">
        <main className="bpfx-main">
          <div className="bpfx-wrap">Loading…</div>
        </main>
      </div>
    );
  }

  if (!insight) {
    return (
      <div className="bpfx-bg">
        <main className="bpfx-main">
          <div className="bpfx-wrap">
            <div className="bpfx-panel" style={{ maxWidth: 640, margin: "0 auto" }}>
              <h2 className="bpfx-panelTitle">Insight not found</h2>
              <p className="bpfx-panelText">
                This insight may have been deleted or does not exist.
              </p>

              <button
                className="bpfx-btn bpfx-btnPrimary"
                onClick={() => router.push("/")}
              >
                Back to Home
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bpfx-bg">
      <main className="bpfx-main">
        <div className="bpfx-wrap">
          <div className="bpfx-panel" style={{ maxWidth: 720, margin: "0 auto" }}>
            <h1 className="bpfx-panelTitle">{insight.title}</h1>

            <div className="bpfx-meta" style={{ marginBottom: 16 }}>
              <span>by {insight.author}</span>
              <span>•</span>
              <span>{new Date(insight.createdAt).toLocaleString()}</span>
              <span>•</span>
              <span>🔥 {insight.heat}</span>
            </div>

            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
              {insight.body}
            </div>

            <div className="bpfx-divider" />

            <div className="bpfx-row">
              <button
                className="bpfx-btn bpfx-btnGhost"
                onClick={() => router.back()}
              >
                ← Back
              </button>

              <button
                className="bpfx-btn"
                onClick={() => router.push("/")}
              >
                Home
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
