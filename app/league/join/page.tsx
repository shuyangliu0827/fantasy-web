"use client";

import Link from "next/link";
import { useState } from "react";
import { getSessionUser } from "@/lib/store";

const publicLeagues = [
  { id: "1", name: "Casual Ballers", members: 8, max: 12, format: "H2H Categories" },
  { id: "2", name: "Pro League 2024", members: 10, max: 10, format: "Rotisserie" },
  { id: "3", name: "Beginners Welcome", members: 5, max: 14, format: "Points" },
  { id: "4", name: "Dynasty Startup", members: 6, max: 12, format: "H2H Points" },
  { id: "5", name: "Auction Masters", members: 9, max: 12, format: "Auction" },
];

export default function JoinLeaguePage() {
  const user = getSessionUser();
  const [search, setSearch] = useState("");
  const [joining, setJoining] = useState<string | null>(null);

  const filteredLeagues = publicLeagues.filter(l => 
    l.name.toLowerCase().includes(search.toLowerCase()) && l.members < l.max
  );

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Login Required</h1>
            <p>Please sign in to join a league</p>
          </div>
          <Link href="/auth/login" className="form-submit" style={{ display: "block", textAlign: "center" }}>
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const handleJoin = (leagueId: string) => {
    setJoining(leagueId);
    setTimeout(() => {
      alert("Successfully joined the league!");
      window.location.href = "/";
    }, 1000);
  };

  return (
    <div className="auth-page" style={{ alignItems: "flex-start", paddingTop: 60 }}>
      <div style={{ width: "100%", maxWidth: 700 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ display: "inline-block", marginBottom: 24 }}>
            <svg viewBox="0 0 40 40" fill="none" style={{ width: 50, height: 50, color: "#f59e0b" }}>
              <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2.5"/>
              <path d="M20 4 C20 4, 8 16, 20 20 C32 24, 20 36, 20 36" stroke="currentColor" strokeWidth="2.5" fill="none"/>
              <path d="M4 20 H36" stroke="currentColor" strokeWidth="2.5"/>
            </svg>
          </Link>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Join Public League</h1>
          <p style={{ color: "#64748b" }}>Find and join an open league</p>
        </div>

        <div style={{ marginBottom: 24 }}>
          <input
            className="form-input"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leagues..."
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {filteredLeagues.map(league => (
            <div 
              key={league.id}
              className="auth-card"
              style={{ 
                padding: 20, 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center" 
              }}
            >
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{league.name}</h3>
                <p style={{ color: "#64748b", fontSize: 13 }}>
                  {league.format} • {league.members}/{league.max} teams
                </p>
              </div>
              <button
                className="form-submit"
                style={{ width: "auto", padding: "10px 24px" }}
                onClick={() => handleJoin(league.id)}
                disabled={joining === league.id}
              >
                {joining === league.id ? "Joining..." : "Join"}
              </button>
            </div>
          ))}
          
          {filteredLeagues.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
              No leagues found. Try a different search.
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 32 }}>
          <Link href="/" style={{ color: "#f59e0b", fontWeight: 600 }}>← Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
