// lib/store.ts
/* =========================================================
import { ALL_PLAYERS } from "./players-data";
   Blueprint Fantasy — Domain Store (STEP 1)
   - User / Session（原样保留）
   - Insight / Comment（原样可用）
   - ✅ NEW: League Domain（不破坏旧逻辑）
   ========================================================= */

export type User = {
  id: string;
  name: string;
  email: string;
  username: string;
};

export type League = {
  id: string;
  slug: string;
  name: string;
  ownerId: string;
  visibility: "public" | "private";
  createdAt: number;
};

export type Insight = {
  id: string;
  title: string;
  body: string;
  leagueSlug?: string; // legacy-compatible
  author: string;
  createdAt: number;
  heat: number;
};

export type Comment = {
  id: string;
  insightId: string;
  author: string;
  body: string;
  createdAt: number;
};

export type Player = {
  id: string;
  name: string;
  team: string;
  position: string;
  age: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  fg: number;
  ft: number;
  tov: number;
  gp: number;
  adp: number;
  rank: number;
  trend: "up" | "down" | "same";
  injury?: string;
};

export type DraftPick = {
  id: string;
  odraftId: string;
  round: number;
  pick: number;
  playerId: string;
  teamId: string;
  timestamp: number;
};

export type DraftTeam = {
  id: string;
  draftId: string;
  name: string;
  isUser: boolean;
  picks: string[]; // player IDs
};

export type Draft = {
  id: string;
  name: string;
  userId: string;
  leagueId?: string;
  type: "snake" | "linear" | "auction";
  teams: number;
  rounds: number;
  userPosition: number;
  status: "setup" | "active" | "completed";
  currentRound: number;
  currentPick: number;
  createdAt: number;
  completedAt?: number;
};

export type MyTeam = {
  id: string;
  leagueId: string;
  userId: string;
  name: string;
  players: string[]; // player IDs
  createdAt: number;
};

export type WatchlistItem = {
  playerId: string;
  userId: string;
  addedAt: number;
  notes?: string;
};

const KEYS = {
  users: "bp_users",
  session: "bp_session",
  leagues: "bp_leagues",
  insights: "bp_insights",
  comments: "bp_comments",
  drafts: "bp_drafts",
  draftPicks: "bp_draft_picks",
  draftTeams: "bp_draft_teams",
  myTeams: "bp_my_teams",
  watchlist: "bp_watchlist",
  playerRankings: "bp_player_rankings",
};

/* ------------------ Utils ------------------ */

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function canUseStorage() {
  try {
    if (typeof window === "undefined") return false;
    const test = "__storage_test__";
    window.localStorage.setItem(test, test);
    window.localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/* ------------------ Users & Session ------------------ */

type StoredUserRow = { user: any; password: string };

function readUsers(): StoredUserRow[] {
  if (!canUseStorage()) return [];
  return safeParse(localStorage.getItem(KEYS.users), []);
}

function writeUsers(rows: StoredUserRow[]) {
  if (!canUseStorage()) return;
  localStorage.setItem(KEYS.users, JSON.stringify(rows));
}

function ensureUser(u: any): User {
  return {
    id: String(u?.id ?? uid("u")),
    name: String(u?.name ?? "User"),
    email: String(u?.email ?? ""),
    username: String(u?.username ?? "user"),
  };
}

export function getSessionUser(): User | null {
  if (!canUseStorage()) return null;
  const raw = localStorage.getItem(KEYS.session);
  return raw ? ensureUser(JSON.parse(raw)) : null;
}

export function signup(name: string, email: string, password: string) {
  if (!canUseStorage()) return { ok: false as const, error: "Storage unavailable" };

  const rows = readUsers();
  if (rows.some(r => r.user.email === email)) {
    return { ok: false as const, error: "Email already exists" };
  }

  const user: User = {
    id: uid("u"),
    name,
    email,
    username: email.split("@")[0],
  };

  rows.push({ user, password });
  writeUsers(rows);
  localStorage.setItem(KEYS.session, JSON.stringify(user));
  return { ok: true as const, user };
}

export function login(email: string, password: string) {
  if (!canUseStorage()) return { ok: false as const, error: "Storage unavailable" };

  const rows = readUsers();
  const row = rows.find(r => r.user.email === email);
  if (!row || row.password !== password) {
    return { ok: false as const, error: "Invalid credentials" };
  }

  localStorage.setItem(KEYS.session, JSON.stringify(row.user));
  return { ok: true as const, user: row.user };
}

export function logout() {
  if (!canUseStorage()) return;
  localStorage.removeItem(KEYS.session);
}

/* ------------------ Leagues (NEW) ------------------ */

export function listLeagues(): League[] {
  if (!canUseStorage()) return [];
  return safeParse<League[]>(localStorage.getItem(KEYS.leagues), []);
}

export function getLeagueBySlug(slug: string): League | null {
  return listLeagues().find(l => l.slug === slug) ?? null;
}

export function createLeague(input: {
  name: string;
  visibility: "public" | "private";
}) {
  if (!canUseStorage()) return { ok: false as const, error: "Storage unavailable" };

  const user = getSessionUser();
  if (!user) return { ok: false as const, error: "Login required" };

  const league: League = {
    id: uid("lg"),
    name: input.name.trim(),
    slug: slugify(input.name),
    ownerId: user.id,
    visibility: input.visibility,
    createdAt: Date.now(),
  };

  const all = listLeagues();
  all.push(league);
  localStorage.setItem(KEYS.leagues, JSON.stringify(all));

  return { ok: true as const, league };
}

/* ------------------ Insights ------------------ */
export function getInsightById(id: string): Insight | null {
  if (!canUseStorage()) return null;
  const all = listInsights();
  return all.find(i => i.id === id) ?? null;
}


export function listInsights(): Insight[] {
  if (!canUseStorage()) return [];
  return safeParse<Insight[]>(localStorage.getItem(KEYS.insights), []);
}

export function createInsight(input: {
  title: string;
  body: string;
  leagueSlug?: string;
}) {
  if (!canUseStorage()) return { ok: false as const, error: "Storage unavailable" };

  const user = getSessionUser();
  if (!user) return { ok: false as const, error: "Login required" };

  const insight: Insight = {
    id: uid("ins"),
    title: input.title.trim(),
    body: input.body.trim(),
    leagueSlug: input.leagueSlug,
    author: user.username,
    createdAt: Date.now(),
    heat: Math.floor(80 + Math.random() * 200),
  };

  const all = listInsights();
  all.unshift(insight);
  localStorage.setItem(KEYS.insights, JSON.stringify(all));

  return { ok: true as const, insight };
}

/* ------------------ Comments ------------------ */

export function listComments(insightId: string): Comment[] {
  if (!canUseStorage()) return [];
  const all = safeParse<Comment[]>(localStorage.getItem(KEYS.comments), []);
  return all.filter(c => c.insightId === insightId);
}

export function addComment(insightId: string, body: string) {
  if (!canUseStorage()) return { ok: false as const, error: "Storage unavailable" };

  const user = getSessionUser();
  if (!user) return { ok: false as const, error: "Login required" };

  const all = safeParse<Comment[]>(localStorage.getItem(KEYS.comments), []);
  const comment: Comment = {
    id: uid("c"),
    insightId,
    author: user.username,
    body: body.trim(),
    createdAt: Date.now(),
  };

  all.push(comment);
  localStorage.setItem(KEYS.comments, JSON.stringify(all));

  return { ok: true as const, comment };
}

/* ------------------ Players Data ------------------ */

import { ALL_PLAYERS } from "./players-data";

const DEFAULT_PLAYERS: Player[] = ALL_PLAYERS as Player[];

export function getPlayers(): Player[] {
  if (!canUseStorage()) return DEFAULT_PLAYERS;
  const custom = safeParse<Player[]>(localStorage.getItem(KEYS.playerRankings), []);
  if (custom.length > 0) return custom;
  return DEFAULT_PLAYERS;
}

export function getPlayerById(id: string): Player | undefined {
  return getPlayers().find(p => p.id === id);
}

export function updatePlayerRanking(playerId: string, newRank: number) {
  if (!canUseStorage()) return { ok: false as const };
  const players = getPlayers();
  const idx = players.findIndex(p => p.id === playerId);
  if (idx === -1) return { ok: false as const };
  players[idx].rank = newRank;
  players.sort((a, b) => a.rank - b.rank);
  localStorage.setItem(KEYS.playerRankings, JSON.stringify(players));
  return { ok: true as const };
}

/* ------------------ Watchlist ------------------ */

export function getWatchlist(): WatchlistItem[] {
  if (!canUseStorage()) return [];
  const user = getSessionUser();
  if (!user) return [];
  const all = safeParse<WatchlistItem[]>(localStorage.getItem(KEYS.watchlist), []);
  return all.filter(w => w.userId === user.id);
}

export function addToWatchlist(playerId: string, notes?: string) {
  if (!canUseStorage()) return { ok: false as const, error: "Storage unavailable" };
  const user = getSessionUser();
  if (!user) return { ok: false as const, error: "Login required" };

  const all = safeParse<WatchlistItem[]>(localStorage.getItem(KEYS.watchlist), []);
  if (all.some(w => w.playerId === playerId && w.userId === user.id)) {
    return { ok: false as const, error: "Already in watchlist" };
  }

  all.push({ playerId, userId: user.id, addedAt: Date.now(), notes });
  localStorage.setItem(KEYS.watchlist, JSON.stringify(all));
  return { ok: true as const };
}

export function removeFromWatchlist(playerId: string) {
  if (!canUseStorage()) return { ok: false as const };
  const user = getSessionUser();
  if (!user) return { ok: false as const };

  let all = safeParse<WatchlistItem[]>(localStorage.getItem(KEYS.watchlist), []);
  all = all.filter(w => !(w.playerId === playerId && w.userId === user.id));
  localStorage.setItem(KEYS.watchlist, JSON.stringify(all));
  return { ok: true as const };
}

/* ------------------ Drafts ------------------ */

export function listDrafts(): Draft[] {
  if (!canUseStorage()) return [];
  const user = getSessionUser();
  if (!user) return [];
  const all = safeParse<Draft[]>(localStorage.getItem(KEYS.drafts), []);
  return all.filter(d => d.userId === user.id);
}

export function getDraftById(id: string): Draft | null {
  const all = safeParse<Draft[]>(localStorage.getItem(KEYS.drafts), []);
  return all.find(d => d.id === id) ?? null;
}

export function createDraft(input: {
  name: string;
  type: "snake" | "linear" | "auction";
  teams: number;
  rounds: number;
  userPosition: number;
  leagueId?: string;
}) {
  if (!canUseStorage()) return { ok: false as const, error: "Storage unavailable" };
  const user = getSessionUser();
  if (!user) return { ok: false as const, error: "Login required" };

  const draft: Draft = {
    id: uid("draft"),
    name: input.name,
    userId: user.id,
    leagueId: input.leagueId,
    type: input.type,
    teams: input.teams,
    rounds: input.rounds,
    userPosition: input.userPosition,
    status: "active",
    currentRound: 1,
    currentPick: 1,
    createdAt: Date.now(),
  };

  const all = safeParse<Draft[]>(localStorage.getItem(KEYS.drafts), []);
  all.push(draft);
  localStorage.setItem(KEYS.drafts, JSON.stringify(all));

  return { ok: true as const, draft };
}

export function updateDraft(id: string, updates: Partial<Draft>) {
  if (!canUseStorage()) return { ok: false as const };
  const all = safeParse<Draft[]>(localStorage.getItem(KEYS.drafts), []);
  const idx = all.findIndex(d => d.id === id);
  if (idx === -1) return { ok: false as const };
  all[idx] = { ...all[idx], ...updates };
  localStorage.setItem(KEYS.drafts, JSON.stringify(all));
  return { ok: true as const, draft: all[idx] };
}

export function getDraftPicks(draftId: string): DraftPick[] {
  if (!canUseStorage()) return [];
  const all = safeParse<DraftPick[]>(localStorage.getItem(KEYS.draftPicks), []);
  return all.filter(p => p.odraftId === draftId);
}

export function addDraftPick(draftId: string, playerId: string, teamId: string, round: number, pick: number) {
  if (!canUseStorage()) return { ok: false as const };

  const draftPick: DraftPick = {
    id: uid("pick"),
    odraftId: draftId,
    playerId,
    teamId,
    round,
    pick,
    timestamp: Date.now(),
  };

  const all = safeParse<DraftPick[]>(localStorage.getItem(KEYS.draftPicks), []);
  all.push(draftPick);
  localStorage.setItem(KEYS.draftPicks, JSON.stringify(all));
  return { ok: true as const, pick: draftPick };
}

/* ------------------ My Teams ------------------ */

export function getMyTeams(): MyTeam[] {
  if (!canUseStorage()) return [];
  const user = getSessionUser();
  if (!user) return [];
  const all = safeParse<MyTeam[]>(localStorage.getItem(KEYS.myTeams), []);
  return all.filter(t => t.userId === user.id);
}

export function createMyTeam(leagueId: string, name: string): { ok: true; team: MyTeam } | { ok: false; error: string } {
  if (!canUseStorage()) return { ok: false, error: "Storage unavailable" };
  const user = getSessionUser();
  if (!user) return { ok: false, error: "Login required" };

  const team: MyTeam = {
    id: uid("team"),
    leagueId,
    userId: user.id,
    name,
    players: [],
    createdAt: Date.now(),
  };

  const all = safeParse<MyTeam[]>(localStorage.getItem(KEYS.myTeams), []);
  all.push(team);
  localStorage.setItem(KEYS.myTeams, JSON.stringify(all));
  return { ok: true, team };
}

export function addPlayerToTeam(teamId: string, playerId: string) {
  if (!canUseStorage()) return { ok: false as const };
  const all = safeParse<MyTeam[]>(localStorage.getItem(KEYS.myTeams), []);
  const idx = all.findIndex(t => t.id === teamId);
  if (idx === -1) return { ok: false as const };
  if (!all[idx].players.includes(playerId)) {
    all[idx].players.push(playerId);
    localStorage.setItem(KEYS.myTeams, JSON.stringify(all));
  }
  return { ok: true as const };
}

export function removePlayerFromTeam(teamId: string, playerId: string) {
  if (!canUseStorage()) return { ok: false as const };
  const all = safeParse<MyTeam[]>(localStorage.getItem(KEYS.myTeams), []);
  const idx = all.findIndex(t => t.id === teamId);
  if (idx === -1) return { ok: false as const };
  all[idx].players = all[idx].players.filter(p => p !== playerId);
  localStorage.setItem(KEYS.myTeams, JSON.stringify(all));
  return { ok: true as const };
}


