"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createInsight } from "@/lib/store";

export default function NewInsightPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = () => {
    if (!title.trim() || !body.trim()) {
      setError("Title and body are required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = createInsight({
      title,
      body,
    });

    if (!res.ok) {
      setSubmitting(false);
      setError(res.error ?? "Failed to create insight");
      return;
    }

    // ✅ 核心：拿到真实 id，跳转详情页
    router.push(`/insights/${res.insight.id}`);
  };

  return (
    <div className="bpfx-bg">
      <main className="bpfx-main">
        <div className="bpfx-wrap">
          <div className="bpfx-panel" style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2 className="bpfx-panelTitle">New Insight</h2>
            <p className="bpfx-panelText">
              Write a clear judgment. You can bind it to a league later.
            </p>

            <div className="bpfx-stack">
              <input
                className="bpfx-input"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <textarea
                className="bpfx-textarea"
                placeholder="Write your judgment..."
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />

              {error && (
                <div style={{ color: "#d33", fontSize: 14 }}>{error}</div>
              )}

              <div className="bpfx-row" style={{ justifyContent: "flex-end" }}>
                <button
                  className="bpfx-btn bpfx-btnGhost"
                  onClick={() => router.back()}
                  disabled={submitting}
                >
                  Cancel
                </button>

                <button
                  className="bpfx-btn bpfx-btnPrimary"
                  onClick={onSubmit}
                  disabled={submitting}
                >
                  {submitting ? "Posting..." : "Post"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
