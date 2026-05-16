# Real Basketball League — Phase 4 Implementation Report

Player binding UI + admin edit/delete + storage RLS fix.

## Problem statement

Phases 1–3 left three concrete gaps surfaced by manual testing:

1. **No claim UI.** A user invited with `role = player` correctly saw
   "球员档案待绑定" on the league public page, but had no way to
   actually claim a roster profile. The server endpoint
   (`POST /api/basketball-players/{id}/claim`) existed; the surface was
   missing.
2. **No admin edit/delete.** The admin Players tab let you create a
   player but had no way to edit jersey/position/bio/avatar/team or to
   delete a row. Inactive players had to live in the DB forever.
3. **Avatar uploads failed.** Migration 034 created the
   `basketball-player-avatars` and `basketball-team-logos` buckets with
   `public: true` for reads but never added `storage.objects` RLS
   policies for `INSERT`/`UPDATE`/`DELETE`. Supabase denies storage
   writes by default → every avatar upload hit
   `new row violates row-level security policy`.

## Changes

### Migration 036 (`supabase/migrations/036_real_league_phase4.sql`)

Two concerns, fully idempotent (drop-then-create policies; `IF NOT
EXISTS` index).

- **`storage.objects` RLS policies.** Six policies total: `INSERT`,
  `UPDATE`, `DELETE` × `basketball-team-logos`, `basketball-player-avatars`.
  Path scheme is `{leagueId}/{entityId}.{ext}`; we extract the league
  id via `(storage.foldername(name))[1]` and check three OR branches:
  - platform admin (full access to both buckets), OR
  - league admin in that league, OR
  - approved team manager in that league.

  Team-scoping (a manager only touching their own team's logo or their
  own players' avatars) is enforced at the API layer — the storage
  layer cannot cheaply know which player id belongs to which team.
  The API gate is the authoritative check; the bucket policy is the
  outer ring.

- **One pending/approved claim per (league, user).** Partial unique
  index `uniq_bball_players_league_user_active` over
  `(basketball_league_id, claimed_by_user_id)` with predicate
  `claimed_by_user_id IS NOT NULL AND claim_status IN ('pending','approved')`.
  Excludes `rejected`/`unclaimed` rows so a user can retry after a
  rejection. This is the backstop against simultaneous submissions —
  the claim API also short-circuits the case with a clean error code.

### Claim API (`app/api/basketball-players/[id]/claim/route.ts`)

- `POST` tightening:
  - Caller must be a league member (platform/league admin OR approved
    `basketball_league_member`). Prevents random platform users from
    squatting on rosters.
  - Returns `409 { error: "already_linked_in_league" }` when the user
    already has a pending/approved claim on another player in this
    league.
  - Existing `player_already_claimed` (409) for approved-by-someone-else
    is preserved.
  - On `23505` from the partial unique index (race), translates to
    `already_linked_in_league` 409.
- New `DELETE`: league-admin-only path that resets a player to
  `claim_status='unclaimed'` and clears `claimed_by_user_id`. Used by
  the admin "解绑 / Unbind" button in `PlayerClaimApprovalList`.

### Profile API (`app/api/basketball-players/[id]/profile/route.ts`)

- Self-service whitelist unchanged.
- New admin-only whitelist: `team_id`, `is_active`. `team_id`
  validates that the target team belongs to the same league.
- New permission branch: a `team_manager` whose membership `team_id`
  equals the player's `team_id` may PATCH self-service fields. They
  cannot move the player to another team or toggle `is_active` — the
  server explicitly rejects those fields when the caller is not an
  admin (`field_not_editable:team_id` / `field_not_editable:is_active`).

### Player DELETE (`app/api/basketball-players/[id]/route.ts`)

New `DELETE` method on the existing route:

- Permission: platform admin / league admin / team-manager whose team
  matches the player's `team_id`.
- Refuses with `409 { error: "has_binding" }` if `claim_status ===
  'approved'`. `?force=true` does **not** bypass this — admins must
  call `DELETE /claim` first. This guarantees a bound platform user is
  never silently disconnected.
- Default safe path: if the player has rows in `basketball_stat_events`
  or `basketball_player_game_stats`, refuses with
  `409 { error: "has_stats", hint: "use_force_or_deactivate" }`.
- `?force=true` performs a hard delete; CASCADE on the stat tables
  (declared in migrations 029/030) removes box-score history. Restricted
  to platform/league admins — team managers cannot force.

### By-slug response (`app/api/basketball-leagues/by-slug/[slug]/route.ts`)

Now returns `member_player: { id, display_name, jersey_number, team_id,
claim_status } | null` when the caller has a pending/approved claim in
this league. Lets the league public page show the correct role-badge
state without an extra round trip.

### League public page (`app/basketball-leagues/[slug]/page.tsx`)

- Reads `member_player` from the by-slug payload and tracks it in state.
- Approved members with `role = player`:
  - When no claim → renders **"认领球员档案" / "Claim Player Profile"**
    button next to the role badge.
  - Pending claim → badge shows "申请已提交，等待审核 / Claim
    submitted — pending review".
  - Approved claim → badge shows "已绑定球员档案 · {name} #{jersey}"
    plus a "查看我的球员档案 → / View my player profile →" link to
    `/basketball-leagues/{slug}/players/{playerId}`.

### `components/basketball/PlayerClaimModal.tsx` (new)

- Fetches the league's players + teams.
- Filters client-side to `claim_status === "unclaimed"` and `is_active
  !== false`.
- Renders a radio list with avatar / name / jersey / position / team
  resolved from the teams list.
- POSTs to `/api/basketball-players/{id}/claim` with localized error
  handling:
  - `already_linked_in_league` → "该账号已在本联赛绑定其他球员档案。"
  - `player_already_claimed` → "该球员档案已被绑定。"
  - `not_a_league_member` → "你不是本联赛的成员。"
- On success calls `onSubmitted` which closes and reloads the page
  payload so the role badge transitions to "申请已提交".

### Admin Players tab (`app/admin/basketball-leagues/[id]/page.tsx`)

- **Edit form.** Each row now has an "编辑 / Edit" button that toggles
  an inline form below the row with full field set (`display_name`,
  `position`, `team_id` admin-only, `jersey_number`, `height_cm`,
  `weight_kg`, `birth_year`, `bio`, `is_active` admin-only, avatar
  replace). Save calls `PATCH /profile`.
- **Delete buttons.** Standard "删除 / Delete" inside the edit form;
  admins additionally see "强制删除 / Force delete" (with the
  double-confirm copy: "该球员有历史数据，强制删除将一并清除其全部数据，
  是否继续？").
- **Localized errors.**
  - 403 / RLS denial on avatar upload → "你没有权限为该球员上传头像。"
  - Other upload failures → "头像上传失败，请重试。"
  - The raw error is preserved in a smaller "details" line via
    `errDetails`.
  - DELETE responses are mapped:
    - `has_stats` → "该球员有历史数据，无法直接删除，可改为停用。"
    - `has_binding` → "该球员已绑定平台用户，请先解绑。"
- **Team-manager access.** The page-level guard is relaxed to allow
  `canManageOwnTeam` or `canManageLeague`. Non-admin team managers:
  - land on the Players tab by default (`refresh()` sets `tab` when
    access loads),
  - see all players in the league (read-only outside their team — no
    Edit button rendered),
  - have full Edit/Delete on their own team's players,
  - cannot move players between teams or toggle `is_active` (the form
    omits both controls, and the API would reject them anyway),
  - see a "仅联赛管理员可访问 / League admins only" notice if they
    click on `settings` / `teams` / `games` / `boxscore` / `members` /
    `claims` (per-tab render-time guard).

### `PlayerClaimApprovalList`

Now renders two sections instead of just pending:

- **待审核 / Pending** — same approve/reject buttons.
- **已绑定 / Linked** — new "解绑 / Unbind" button that calls the new
  `DELETE /api/basketball-players/{id}/claim` after a `window.confirm`.

## Files touched

| Path | Kind |
|---|---|
| `supabase/migrations/036_real_league_phase4.sql` | new |
| `app/api/basketball-players/[id]/claim/route.ts` | POST tightening + new DELETE |
| `app/api/basketball-players/[id]/profile/route.ts` | admin whitelist + team-manager branch |
| `app/api/basketball-players/[id]/route.ts` | new DELETE method |
| `app/api/basketball-leagues/by-slug/[slug]/route.ts` | adds `member_player` |
| `app/basketball-leagues/[slug]/page.tsx` | claim button + bound-player badge |
| `components/basketball/PlayerClaimModal.tsx` | new modal |
| `app/admin/basketball-leagues/[id]/page.tsx` | edit/delete UI + team-manager gating |
| `components/basketball/PlayerClaimApprovalList.tsx` | unbind button |

## Verification

- `npm run lint` → 81 errors / 8 warnings = 89 problems (matches the
  pre-existing baseline; no new lint debt).
- `npx tsc --noEmit` → clean outside the pre-existing `tests/` module-
  resolution failures.
- Migration 036 is idempotent: drops-and-recreates the six storage
  policies; `CREATE INDEX IF NOT EXISTS` on the partial unique index.
- `npm test` failures are pre-existing (test files reference modules
  that have been moved/renamed in earlier phases).

## Open items (documented, not fixed in this phase)

- **Soft-delete avatar cleanup.** Replacing an avatar overwrites
  `{playerId}.{ext}` via `upsert: true`, so old extensions are leaked.
  Acceptable for now; a periodic cleanup job is a future ticket.
- **Public-page inactive filtering.** `is_active=false` players still
  appear in the public league `/players` list. Filtering can be added
  in a follow-up with a separate "Inactive" toggle.
- **Team-manager bulk edit / move.** Team managers cannot reassign a
  player to another team (admin-only). Roster moves remain an admin
  action.
- **Multiple league bindings.** A user can still hold one claim per
  league; the partial index keys on `(league_id, user_id)` so binding
  to player X in league A and player Y in league B is allowed.
