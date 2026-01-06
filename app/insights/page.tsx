/* app/insights/new/page.tsx */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createInsight, getSessionUser } from "@/lib/store";

export default function NewInsightPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = getSessionUser();

  function onSubmit() {
    if (!user) {
      alert("Login required to post an insight.");
      router.push("/auth/login");
      return;
    }

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    if (!body.trim()) {
      setError("Content cannot be empty.");
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
      setError(res.error ?? "Failed to create insight.");
      return;
    }

    // ✅ Step C: go back home for now
    router.push("/");
  }

  function onCancel() {
    router.push("/");
  }

  return (
    <main className="bpfx-main">
      <div className="bpfx-wrap">
        <div
          className="bpfx-panel"
          style={{ maxWidth: 720, margin: "80px auto" }}
        >
          <h2 className="bpfx-panelTitle">New Insight</h2>
          <p className="bpfx-panelText">
            Write a clear judgment. You can bind it to a league later.
          </p>

          <div className="bpfx-stack" style={{ marginTop: 16 }}>
            <input
              className="bpfx-input"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
            />

            <textarea
              className="bpfx-textarea"
              placeholder="Write your judgment..."
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={submitting}
            />
          </div>

          {error && (
            <div style={{ color: "#d33", marginTop: 12 }}>{error}</div>
          )}

          <div
            className="bpfx-row"
            style={{ justifyContent: "flex-end", marginTop: 24 }}
          >
            <button
              className="bpfx-btn bpfx-btnGhost"
              onClick={onCancel}
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
    </main>
  );
}
