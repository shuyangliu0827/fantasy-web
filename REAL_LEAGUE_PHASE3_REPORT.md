# Real Basketball League Infrastructure — Phase 3 Report

Phase 3 turns the admin "数据录入" tab into a real-time scorekeeping
workspace and tightens the team-score / box-score pipeline so the
public Game Page and admin live entry share a single source of truth.

This phase deliberately does NOT touch DFS contest gameplay, salary
engine, AI scouting, or advanced referee/period mechanics (see "Non-goals"
at the bottom).

## 1. What changed (summary)

| Area | Change |
|---|---|
| Schema | New `basketball_games.on_court_player_ids uuid[]` column (migration 035) |
| Aggregate pipeline | New `recomputeTeamScores()` in `lib/basketball/aggregate.ts`; called from every event POST/DELETE and from the admin box-score override |
| Game lifecycle API | New `PATCH /api/basketball-leagues/{id}/games/{gameId}` for status transitions + on-court updates (scorekeeper-gated) |
| Scorekeeping UI | New `components/basketball/ScorekeepingPanel.tsx` replaces flat `StatEventInput` inside the admin BoxScoreTab — two-team columns, on-court/bench grouping, per-player stat lines, global Recent Actions rail with undo |
| Admin Games tab | Each game row now has a public "Preview" link; shows live score when set |
| Public Game Page | Auto-refreshes every 10 s while `status === 'live'` |

No changes to RLS or migrations 029–034.

## 2. Game lifecycle

Status values are unchanged: `scheduled | live | final | cancelled`
(declared in migration 029). "finished" is surfaced as `final` — UI labels
read "已结束 / Finished".

| State | Behavior |
|---|---|
| `scheduled` | Pre-game. Box score empty. Scorekeeper sees a **Start Game** button. |
| `live` | Stat events accepted. Public Game Page polls the box-score every 10 s. Scorekeeper sees **Finish Game**. |
| `final` | Stat actions blocked client-side ("比赛已结束。如需修改，请使用「重新开放」。"). Scorekeeper sees **Reopen** to flip back to `live` for corrections. |
| `cancelled` | Allowed but not surfaced in the lifecycle buttons — set via API only. |

Transitions are written through the new
`PATCH /api/basketball-leagues/{id}/games/{gameId}` endpoint. The endpoint
accepts:

```json
{ "status": "live" | "final" | "scheduled" | "cancelled",
  "on_court_player_ids": ["uuid", ...] }
```

Both fields are optional and orthogonal; either can be sent in isolation.

The PATCH endpoint validates:
- `status` is one of the four allowed values.
- Every player ID in `on_court_player_ids` is a UUID, exists, and belongs
  to either the home or away team of this game.

It does **not** restrict transitions beyond that — any-to-any is allowed
so admins can recover from operator error. The UI only exposes the
sensible buttons per state (scheduled → live → final → reopen).

## 3. Scorekeeper permissions

Scorekeeper access is **league-wide**. Phase 3 reuses the existing
`requireStatsPermission(supabase, leagueId, userId)` gate
(`lib/basketball/access.ts`). That helper passes for:

- platform admins (`platform_admins.role`)
- league owners / admins (`basketball_league_admins`)
- approved league members with `role = scorekeeper`

Team managers, players, referees, and viewers are explicitly **not** in
this set. Phase-3 stat actions, status transitions, on-court toggles,
event-undo, and admin box-score overrides all flow through
`requireStatsPermission`, so unauthorized users see a 403 from every
write path.

The admin page (`/admin/basketball-leagues/{leagueId}`) already gates
its render on `access.canManageLeague`. Scorekeepers cannot reach the
admin URL today because the BoxScoreTab lives inside the league admin
shell — this is **a known limitation**, documented at the bottom of
this report. Scorekeepers can still operate via league-admin invitation
or by being granted admin alongside scorekeeper. Adding a stand-alone
scorekeeping route is deferred.

Game-assignment ("scorekeeper for game X only") is also deferred —
there is no `assigned_scorekeeper_id` on `basketball_games` today. The
new schema for assignment can be added in a future migration without
breaking the current model.

## 4. Event logging and undo

Phase 1 already shipped a per-event log (`basketball_stat_events`,
migration 030) and a server-side aggregator
(`lib/basketball/aggregate.ts → recomputeBoxScore`). Phase 3 keeps that
contract and adds:

- **`recomputeTeamScores(supabase, gameId)`** — sums `pts` from
  `basketball_player_game_stats` grouped by team, writes
  `basketball_games.home_score` and `away_score`, and returns the
  numbers. Called automatically from:
  - `POST /api/basketball-games/{id}/events`
  - `DELETE /api/basketball-games/{id}/events/{eventId}`
  - `POST/PUT /api/basketball-games/{id}/box-score` (admin direct
    override)
- All three endpoints now return `team_scores: { home_score, away_score }`
  in the response so the client can refresh the header without an extra
  GET.

**Undo flow** (unchanged contract; surfaced more prominently in UI):

1. Scorekeeper clicks a stat button → `POST /events` inserts a row and
   re-aggregates the player's stat row and team scores.
2. The new Recent Actions rail shows the latest 12 events for the game.
3. Each event has a per-row "撤销 / Undo" button that calls
   `DELETE /events/{eventId}`. The server deletes the row and replays
   the remaining events for that player; team scores are re-derived
   the same way. UI state is updated from the response.
4. Undo is blocked while the game is `final` (the Reopen control must
   be used first).

No new `is_reverted` column was added — events are hard-deleted and the
remaining log replays cleanly. The audit trail is the event log itself;
deletions are observable in DB logs but not on the row level. If a
later phase needs a soft-delete audit, a `reverted_*` column trio can
be added then.

## 5. On-court / bench state

A new `uuid[]` column `on_court_player_ids` was added to
`basketball_games` (migration 035, default `'{}'`). The set is updated
through the PATCH endpoint described above. The list is a flat array of
player UUIDs across both teams; the client filters by team when
rendering.

The ScorekeepingPanel UI exposes a "上场 / 下场" toggle on each player
card; clicks PATCH a new array. There is no per-quarter or per-period
tracking — that is intentionally out of scope for Phase 3.

## 6. Source of truth for team score and box score

- **Player box score**: derived server-side from
  `basketball_stat_events` and stored in `basketball_player_game_stats`
  by `recomputeBoxScore()`. Both the data-entry workspace and the
  public Game Page read from `basketball_player_game_stats`.
- **Team score**: derived from `basketball_player_game_stats` by
  `recomputeTeamScores()` and stored in `basketball_games.home_score`
  / `away_score`. Both surfaces read from that game row.
- **Direct numeric admin override**: writes to
  `basketball_player_game_stats` directly (bypasses the event log) and
  now also triggers `recomputeTeamScores()`. Team scores stay in sync
  whether stats arrived through events or through a direct override.

There is no separate "client-side score" anywhere; the React component
state in ScorekeepingPanel hydrates from the API responses and is
refreshed on undo / reload.

## 7. Data-entry page redesign

`ScorekeepingPanel.tsx` is the new live-game workspace component
(replaces the per-player `StatEventInput` flat layout in the admin
BoxScoreTab).

**Layout:**

1. **Game control header** — away/home logo + name + live score,
   scheduled time, status badge (待开始 / 进行中 / 已结束 / 已取消),
   `Start Game` / `Finish Game` / `Reopen` controls, "Preview public →"
   link to the public Game Page.
2. **Two-column team split** (`auto-fit` grid; desktop side-by-side,
   mobile stacks). Each column carries:
   - Team header with logo, side label (客队 / 主队), team name (links
     to the public team page), on-court count, and team score.
   - `在场球员 / On Court` subsection (pinned at the top), then
     `替补席 / Bench`. Empty states ("尚无在场球员 / No on-court players")
     when applicable.
3. **Player card** — avatar, jersey, name, position, On Court / Bench
   badge, "上场 / 下场" toggle, full stat line (PTS, FG, 3P, FT, REB,
   AST, STL, BLK, TOV, FPTS), and the 11 stat action buttons (+2,
   2 miss, +3, 3 miss, FT+, FT−, REB, AST, STL, BLK, TOV). On-court
   cards have a blue left-rail accent; bench cards are de-emphasized
   on a soft gray.
4. **Recent Actions rail** — last 12 events with the team chip (客/主),
   jersey + name, action label, timestamp, and an inline `撤销 / Undo`
   button per row. Disabled when the game is `final`.

All copy is bilingual via `useLang()` / `t(zh, en)`.

`StatEventInput.tsx` remains in the repo but is no longer used by the
admin tab — left in place to avoid breaking any dev import paths; can
be deleted in a follow-up.

## 8. Game tab improvements

- Game creation already validated home ≠ away, both teams, and a
  scheduled time (unchanged from Phase 2). Verified that the POST API
  enforces the same.
- Each row now displays the live score (e.g. `78 – 81`) when
  `home_score` or `away_score` is set.
- Each row now exposes a `预览 / Preview` link to the public Game Page,
  alongside the existing `删除 / Delete`.
- A dedicated "Open scorekeeping" button was not added because the
  admin uses local tab state (not URL routing); the existing Box Score
  tab game selector covers the scorekeeping entry path without adding
  a new state-sync surface. Documented as deferred.

## 9. Public Game Page live consistency

The page at `/basketball-leagues/{slug}/games/{gameId}` already reads
score + box score from the canonical sources
(`basketball_games`, `basketball_player_game_stats`). Phase 3 adds:

- A 10-second polling loop while `game.status === "live"`. Refreshes
  the team scores and box-score table without manual reload.
- The loop is wired through the existing `load()` `useCallback` and
  cleans up on unmount or status change.

No WebSockets or Supabase Realtime subscription was introduced — the
repo's other live surfaces use polling, so this matches the existing
pattern.

## 10. Localization

Every Phase 3 string is bilingual via `useLang()` / `t(zh, en)`:

- 开始比赛 / Start Game
- 结束比赛 / Finish Game
- 重新开放 / Reopen
- 在场 / 替补 (badge), 在场球员 / 替补席 (section headers)
- 上场 / 下场
- 最近操作 / Recent Actions
- 撤销 / Undo
- 客队 / 主队
- 比赛已结束。如需修改，请使用「重新开放」。 / Game finished. Use "Reopen" to edit stats.
- 暂无可录入比赛 / No games available for scorekeeping

## 11. API surface (Phase 3 additions)

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| `PATCH` | `/api/basketball-leagues/{id}/games/{gameId}` | `requireStatsPermission` | `{ status?, on_court_player_ids? }` | Game lifecycle + on-court control |
| `POST` | `/api/basketball-games/{id}/events` | `requireStatsPermission` | (existing) | Now returns `team_scores` |
| `DELETE` | `/api/basketball-games/{id}/events/{eventId}` | `requireStatsPermission` | — | Now returns `team_scores` |
| `POST/PUT` | `/api/basketball-games/{id}/box-score` | `requireStatsPermission` | (existing) | Now also recomputes team scores |

## 12. Files touched

- `supabase/migrations/035_real_league_phase3.sql` (new)
- `lib/basketball/aggregate.ts` (`recomputeTeamScores`)
- `app/api/basketball-leagues/[id]/games/[gameId]/route.ts` (new PATCH; DELETE retained)
- `app/api/basketball-games/[id]/events/route.ts` (hooks team-score recompute, returns `team_scores`)
- `app/api/basketball-games/[id]/events/[eventId]/route.ts` (same)
- `app/api/basketball-games/[id]/box-score/route.ts` (same on POST/PUT)
- `components/basketball/ScorekeepingPanel.tsx` (new)
- `app/admin/basketball-leagues/[id]/page.tsx` (BoxScoreTab → ScorekeepingPanel; live score + Preview in GamesTab; Game type expanded)
- `app/basketball-leagues/[slug]/games/[gameId]/page.tsx` (10 s polling while live)

## 13. Verification

- `npm run lint` matches the existing baseline (81 errors / 89 problems,
  pre-existing only — no Phase 3 regressions).
- `npx tsc --noEmit` clean outside the pre-existing `tests/` path
  resolution issues that also fail on trunk.
- Migration 035 is idempotent (`ADD COLUMN IF NOT EXISTS`).

## 14. Known limitations / deferred work

1. **Stand-alone scorekeeping route**: the workspace currently lives
   inside `/admin/basketball-leagues/{id}` which gates entry on
   `canManageLeague` (admin only). A scorekeeper without league-admin
   status needs to be promoted or use a parallel route. A
   `/scorekeeping/{gameId}` route is a small future addition.
2. **Game-assignment for scorekeepers**: scorekeeper access is
   league-wide. No `basketball_games.assigned_scorekeeper_id`.
3. **Soft-delete audit on events**: undo currently hard-deletes the
   event. The schema can be extended with `reverted_*` fields later.
4. **Per-quarter / period / minutes**: not tracked. `min` exists on
   the box-score row but is always `0` for event-derived rows.
5. **WebSocket / Supabase Realtime**: not used. Public Game Page polls
   every 10 s while live; this is consistent with the rest of the app.
6. **No "Open scorekeeping" admin button**: the admin page uses local
   tab state, so cross-tab linking would require routing the tab via
   URL. Deferred until the admin shell adopts routed tabs.
