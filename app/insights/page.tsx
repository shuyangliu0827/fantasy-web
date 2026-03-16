"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createInsight, getSessionUser, listLeagues, type League } from "@/lib/store";

type LeagueOption = { slug: string; name: string };

export default function NewInsightPage() {
  const router = useRouter();
  const user = getSessionUser();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const [leagueSlug, setLeagueSlug] = useState<string>(""); // "" means no league selected
  const [leagues, setLeagues] = useState<LeagueOption[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState<boolean>(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Fix: listLeagues is async, so we await it.
  useEffect(() => {
    (async () => {
      try {
        setLoadingLeagues(true);
        const data: League[] = await listLeagues();
        setLeagues(data.map((l) => ({ slug: l.slug, name: l.name })));
      } catch (e) {
        console.error(e);
        setLeagues([]);
      } finally {
        setLoadingLeagues(false);
      }
    })();
  }, []);

  const leagueSelectDisabled = useMemo(
    () => submitting || loadingLeagues || leagues.length === 0,
    [submitting, loadingLeagues, leagues.length]
  );

  async function onSubmit() {
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

    const res = await createInsight({
      title,
      body,
      league_slug: leagueSlug ? leagueSlug : undefined,
    });

    if (!res.ok) {
      setSubmitting(false);
      setError(res.error ?? "Failed to create insight.");
      return;
    }

    router.push("/");
  }

  function onCancel() {
    router.push("/");
  }

  return (
    <main className="bpfx-main">
      <div className="bpfx-wrap">
        <div className="bpfx-panel" style={{ maxWidth: 720, margin: "80px auto" }}>
          <h2 className="bpfx-panelTitle">New Insight</h2>
          <p className="bpfx-panelText">
            Write a clear judgment. You can optionally bind it to a league now.
          </p>

          <div className="bpfx-stack" style={{ marginTop: 16 }}>
            {/* League selector (optional) */}
            <div>
              <label style={{ display: "block", marginBottom: 8, opacity: 0.9 }}>
                League (optional)
              </label>
              <select
                className="bpfx-input"
                value={leagueSlug}
                onChange={(e) => setLeagueSlug(e.target.value)}
                disabled={leagueSelectDisabled}
              >
                <option value="">
                  {loadingLeagues
                    ? "Loading leagues..."
                    : leagues.length === 0
                    ? "No leagues found"
                    : "No league (post globally)"}
                </option>
                {leagues.map((l) => (
                  <option key={l.slug} value={l.slug}>
                    {l.name}
                  </option>
                ))}
              </select>
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                If you don’t select a league, the insight will be posted without a league tag.
              </div>
            </div>

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

          {error && <div style={{ color: "#d33", marginTop: 12 }}>{error}</div>}

          <div className="bpfx-row" style={{ justifyContent: "flex-end", marginTop: 24 }}>
            <button className="bpfx-btn bpfx-btnGhost" onClick={onCancel} disabled={submitting}>
              Cancel
            </button>
            <button className="bpfx-btn bpfx-btnPrimary" onClick={onSubmit} disabled={submitting}>
              {submitting ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
