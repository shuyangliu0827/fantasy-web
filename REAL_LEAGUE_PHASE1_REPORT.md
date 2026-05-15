# Real Basketball League Infrastructure — Phase 1 Report

This change establishes the foundational data model, role hierarchy, league
player/team profile fields, and top-level navigation IA for the Real Basketball
League ("Community Leagues") product area. It is intentionally additive — no
existing functionality was removed except the misplaced "其他联赛" tab inside
Daily Contest, which has been promoted to its own top-level section.

## 1. What changed (summary)

| Part | Result |
|---|---|
| A — Navigation / IA | New top-level "社区联赛 / Community Leagues" item; "其他联赛" tab removed from Daily Contest sub-nav |
| B/C — Role hierarchy | `basketball_league_members.role` expanded to `league_admin / team_manager / player / referee / scorekeeper / viewer`; legacy `stat_keeper` rows migrated to `scorekeeper`; `team_id` added |
| D — Player profile | `basketball_players` gains `height_cm`, `weight_kg`, `birth_year`, `is_active`; admin UI captures jersey #, avatar, height/weight/birth-year |
| E — Team profile | `basketball_teams` gains `bio`; admin UI captures bio and logo upload |
| F — Admin UI | TeamsTab, PlayersTab, MembersTab upgraded; PlayerClaim tab untouched (preserved) |
| G — Storage | Two new public Supabase Storage buckets: `basketball-team-logos`, `basketball-player-avatars` |
| H — Permissions | Access helpers extended with `isLeagueAdmin / isTeamManager / isScorekeeper / isReferee`; `requireStatsPermission` switched to `scorekeeper` |
| I — Types/API | All layers updated together (migration, API routes, access types, admin UI, approval list) |

## 2. New / updated schema

Migration: [`supabase/migrations/034_real_league_phase1.sql`](supabase/migrations/034_real_league_phase1.sql).

**`basketball_league_members`** — expanded:
- `UPDATE … SET role='scorekeeper' WHERE role='stat_keeper'` (legacy rows migrated).
- Role CHECK replaced with:
  `('league_admin','team_manager','player','referee','scorekeeper','viewer')`
- New nullable `team_id uuid REFERENCES basketball_teams(id) ON DELETE SET NULL`.
- Index `idx_bball_league_members_team`.

**`basketball_teams`** — added:
- `bio text` (nullable).

**`basketball_players`** — added:
- `height_cm numeric` (nullable).
- `weight_kg numeric` (nullable).
- `birth_year int` (nullable).
- `is_active boolean NOT NULL DEFAULT true`.
- Index `idx_bball_players_active` on `(basketball_league_id, is_active)`.

Legacy text `height` / `weight` columns are retained. New code reads/writes
the numeric variants; old rows continue to work unchanged.

**Storage buckets** — created public, world-readable:
- `basketball-team-logos`
- `basketball-player-avatars`

Both bucket IDs are inserted with `ON CONFLICT DO NOTHING` so re-running the
migration is safe. Writes happen client-side via the helpers in
`lib/basketball/uploads.ts` (auth-gated by the existing site session); reads
return signed-free public URLs via `getPublicUrl()`.

RLS on the `basketball_*` tables remains the permissive `allow_all_*` policy
established in migration 029. Real enforcement continues to live in the API
layer via `lib/basketball/access.ts`. No RLS change was required.

## 3. Role model

The product roles ask for five league-scoped roles plus a viewer baseline.
They map to the existing two-table model as follows:

| Role | Where it lives | Source of truth |
|---|---|---|
| `league_admin` | `basketball_league_admins` (granted by platform admin) | The `basketball_league_admins` table remains the authoritative grant. The new value `league_admin` in `basketball_league_members.role` is supported but is not used by the league-admin gate; it's there so the membership directory can describe an admin uniformly. |
| `team_manager` | `basketball_league_members` (role + `team_id`) | New |
| `player` | `basketball_league_members` (role + optional `team_id`) | Player profiles still live in `basketball_players`. Membership row links a platform user to the league with optional team association. |
| `referee` | `basketball_league_members` | New |
| `scorekeeper` | `basketball_league_members` | Renamed from legacy `stat_keeper`; existing rows were migrated |
| `viewer` | `basketball_league_members` | Retained from before |

New helpers exported from `lib/basketball/access.ts`:

```ts
isLeagueAdmin(supabase, userId, leagueId)
isTeamManager(supabase, userId, leagueId, teamId?)
isScorekeeper(supabase, userId, leagueId)
isReferee(supabase, userId, leagueId)
```

`getBasketballLeagueAccess()` now returns:
- `memberTeamId: string | null` — the team_id from the user's membership row,
  if any.
- `canManageOwnTeam: boolean` — true for league/platform admins and for
  approved team_manager members. (Phase 1 does not yet wire any UI to this
  capability; team managers still cannot write league-wide teams/players/games
  in this phase.)

`requireStatsPermission()` now accepts `scorekeeper` instead of `stat_keeper`.

## 4. Admin UI updates

`/app/admin/basketball-leagues/[id]/page.tsx` — three tabs upgraded.

**Teams tab** — `TeamsTab`
- Inputs: name, abbreviation, city, **bio (textarea)**, **logo (file upload)**.
- Logo flow: team is created first, then the file is uploaded to
  `basketball-team-logos/{leagueId}/{teamId}.{ext}`, then the row is PATCH'd
  with the public URL via the new `/api/basketball-teams/[id]` PATCH.
- Team list row shows a 28px logo thumbnail (falls back to a placeholder
  square) plus the bio if present.

**Players tab** — `PlayersTab`
- Existing required inputs (name, position, team) unchanged.
- New inputs: **jersey number**, **height_cm**, **weight_kg**, **birth_year**,
  **avatar (file upload)**.
- Avatar flow mirrors the team-logo flow but PATCHes through the existing
  `/api/basketball-players/[id]/profile` whitelist (which has been extended
  to accept `height_cm`, `weight_kg`, `birth_year`, `avatar_url`).
- Player list row shows a 28px avatar thumbnail (round) plus `#jersey` badge.

**Members tab** — `MembersTab`
- Role dropdown now includes the five new roles plus `viewer`.
- When the selected role is `team_manager` or `player`, an optional team
  dropdown appears; the chosen `team_id` is sent in the upsert.
- `LeagueMemberApprovalList` accepts an optional `teams` array and, for
  team-scoped roles, renders a team dropdown per-row so admins can re-assign
  team membership inline. The PATCH endpoint validates that the team belongs
  to the league.

**Player claim tab** — unchanged. The claim approval list (and the player
claim flow on the public side) is preserved end-to-end.

## 5. Route / navigation updates

| Before | After |
|---|---|
| Top nav: 首页 / 发现 / 公开联赛 / 每日竞赛 | 首页 / 发现 / 公开联赛 / 每日竞赛 / **社区联赛** (+ 平台管理 conditionally) |
| Daily Contest sub-tabs included `其他联赛` / `全部联赛` | Sub-tabs are now strictly contest-specific |
| `/contest/leagues` page | `/community-leagues` page (new top-level route) |
| Card link target: always `/contest/{slug}/build` | If `is_contest_enabled`, `/contest/{slug}/build`; otherwise `/basketball-leagues/{slug}` |
| Page title: "其他联赛" | "社区联赛 / Community Leagues" |
| Filter: status='approved' AND is_contest_enabled | Filter: status='approved' (all community leagues are surfaced) |

The old `/contest/leagues` URL redirects to `/community-leagues` via
`next.config.ts`. The `/contest/other-leagues` legacy redirect was updated to
point to the new path.

Files touched:
- `components/Header.tsx` — new nav item.
- `components/LightHeader.tsx` — new nav item, updated admin label to "平台管理 / Platform Admin".
- `components/ContestNav.tsx` — removed the trailing "其他联赛 / 全部联赛" tab.
- `app/community-leagues/page.tsx` (new) — Community Leagues directory.
- `app/contest/leagues/` (deleted) — superseded by config redirect.
- `next.config.ts` — added `/contest/leagues → /community-leagues` redirect.

## 6. Storage / image upload behavior

New helper: `lib/basketball/uploads.ts`

```ts
uploadBasketballTeamLogo(leagueId, teamId, file)     → public URL
uploadBasketballPlayerAvatar(leagueId, playerId, file) → public URL
```

Mirrors the existing fantasy-league logo flow (`/app/league/[slug]/settings/page.tsx`).
Upload is `upsert: true` so re-uploads to the same path overwrite. Path scheme:

```
basketball-team-logos/{leagueId}/{teamId}.{ext}
basketball-player-avatars/{leagueId}/{playerId}.{ext}
```

Both buckets are public. The asset URL is stored in
`basketball_teams.logo_url` / `basketball_players.avatar_url`. The buckets
themselves are accessible by anyone with the URL; writes are gated by the
authenticated Supabase client and by the API layer (admin-only PATCH
endpoints).

## 7. RLS / permissions changes

- DB-level RLS: unchanged. The permissive `allow_all_*` policies installed
  in migrations 029 and 030 are correct for the current model.
- Application-layer enforcement: extended.
  - `lib/basketball/access.ts` exports new helpers `isLeagueAdmin`,
    `isTeamManager`, `isScorekeeper`, `isReferee`.
  - `requireStatsPermission` checks `scorekeeper` (legacy `stat_keeper` rows
    were migrated; the value is no longer accepted).
  - `getBasketballLeagueAccess` now exposes `memberTeamId` and
    `canManageOwnTeam`.
- API endpoints that grant league-scoped roles
  (`/api/basketball-leagues/[id]/members` and the dev helper
  `/api/dev/grant-basketball-access`) accept the new role set and the
  optional `team_id`.

## 8. API / migration / type consistency

All layers were updated in lockstep so no surface expects fields the DB
doesn't have:

- SQL: migration 034.
- TS types: `MemberRole`, `Member`, `Team`, `Player` updated in
  `lib/basketball/access.ts`, `components/basketball/LeagueMemberApprovalList.tsx`,
  and `app/admin/basketball-leagues/[id]/page.tsx`.
- API routes:
  - `app/api/basketball-leagues/[id]/members/route.ts` — expanded role set + `team_id`.
  - `app/api/basketball-leagues/[id]/teams/route.ts` — accepts `bio`.
  - `app/api/basketball-teams/[id]/route.ts` — new PATCH with whitelist `(name, abbreviation, city, logo_url, bio)`.
  - `app/api/basketball-leagues/[id]/players/route.ts` — accepts `height_cm`, `weight_kg`, `birth_year`, `is_active`.
  - `app/api/basketball-players/[id]/profile/route.ts` — whitelist extended with `height_cm`, `weight_kg`, `birth_year`.
  - `app/api/dev/grant-basketball-access/route.ts` — new role union + `team_id`.

## 9. Deferred work / known limitations

Out of scope for Phase 1 (per the brief — Part J non-goals):

1. **Public team / player / game pages**, public league homepage redesign,
   and AI scouting reports.
2. **DFS contest integration via `/contest/{leagueSlug}`** — only the
   directory link target is aware of `is_contest_enabled`; building DFS
   pages is later.
3. **Team-manager write privileges** — the access helper
   `isTeamManager` and the `canManageOwnTeam` capability are now available,
   but no UI yet routes through them. League/platform admins still own
   teams/players/games in Phase 1.
4. **Referee permissions** — the role exists with no write privileges. No
   action surfaces are tied to it yet.
5. **Player self-service profile UI** — the `/api/basketball-players/[id]/profile`
   PATCH endpoint accepts the new fields, but no self-service edit page was
   built (admin can still edit on behalf of the player).
6. **Players editing official stats** — explicitly NOT allowed; the
   profile whitelist remains identity-only.
7. **Migration of legacy text `height` / `weight`** to numeric. Both old and
   new columns coexist; downstream code can opt-in to the numeric ones.
8. **Invitation workflow** — Phase 1 keeps the existing flow (admin enters
   a user_id directly + invite + approve). A proper invitation pipeline
   (email, accept link, search-by-handle) is deferred.

## 10. Verification

- `npm run lint`: passes at the same baseline as the trunk (no new errors
  introduced by this branch).
- `npm test`: the 10 pre-existing test failures are path-resolution errors
  unrelated to this branch (`tests/*` references `../lib/<filename>.ts` paths
  that no longer match the post-refactor `lib/` layout). The branch
  reproduces the same baseline.
- `npx tsc --noEmit` outside of `tests/`: clean.
- Migration 034 is idempotent (`IF NOT EXISTS` / `ON CONFLICT DO NOTHING`)
  and safe to re-run.
