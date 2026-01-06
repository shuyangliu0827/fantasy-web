"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionUser, createLeague } from "@/lib/store";

export default function CreateLeaguePage() {
  const router = useRouter();
  const user = getSessionUser();
  
  const [name, setName] = useState("");
  const [teams, setTeams] = useState("12");
  const [format, setFormat] = useState("h2h");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Login Required</h1>
            <p>Please sign in to create a league</p>
          </div>
          <Link href="/auth/login" className="form-submit" style={{ display: "block", textAlign: "center" }}>
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("League name is required");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    const res = createLeague({ name, visibility });
    
    if (!res.ok) {
      setError(res.error || "Failed to create league");
      setLoading(false);
      return;
    }
    
    router.push(`/league/${res.league?.slug || "new"}`);
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 500 }}>
        <div className="auth-header">
          <Link href="/" style={{ display: "inline-block", marginBottom: 24 }}>
            <svg viewBox="0 0 40 40" fill="none" style={{ width: 50, height: 50, color: "#f59e0b" }}>
              <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2.5"/>
              <path d="M20 4 C20 4, 8 16, 20 20 C32 24, 20 36, 20 36" stroke="currentColor" strokeWidth="2.5" fill="none"/>
              <path d="M4 20 H36" stroke="currentColor" strokeWidth="2.5"/>
            </svg>
          </Link>
          <h1>Create a League</h1>
          <p>Set up your fantasy basketball league</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">League Name</label>
            <input
              className="form-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome League"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Number of Teams</label>
            <select 
              className="form-input" 
              value={teams}
              onChange={(e) => setTeams(e.target.value)}
            >
              <option value="8">8 Teams</option>
              <option value="10">10 Teams</option>
              <option value="12">12 Teams</option>
              <option value="14">14 Teams</option>
              <option value="16">16 Teams</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">League Format</label>
            <select 
              className="form-input" 
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              <option value="h2h">Head-to-Head Categories</option>
              <option value="h2h-points">Head-to-Head Points</option>
              <option value="roto">Rotisserie</option>
              <option value="points">Points League</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Visibility</label>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                className="form-input"
                style={{ 
                  flex: 1, 
                  cursor: "pointer",
                  background: visibility === "public" ? "rgba(245, 158, 11, 0.15)" : undefined,
                  borderColor: visibility === "public" ? "#f59e0b" : undefined,
                  color: visibility === "public" ? "#f59e0b" : undefined
                }}
                onClick={() => setVisibility("public")}
              >
                Public
              </button>
              <button
                type="button"
                className="form-input"
                style={{ 
                  flex: 1, 
                  cursor: "pointer",
                  background: visibility === "private" ? "rgba(245, 158, 11, 0.15)" : undefined,
                  borderColor: visibility === "private" ? "#f59e0b" : undefined,
                  color: visibility === "private" ? "#f59e0b" : undefined
                }}
                onClick={() => setVisibility("private")}
              >
                Private
              </button>
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <button
            className="form-submit"
            type="submit"
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            {loading ? "Creating..." : "Create League"}
          </button>
        </form>

        <div className="auth-footer">
          <Link href="/">← Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
