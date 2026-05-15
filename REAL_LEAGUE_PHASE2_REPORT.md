# Real Basketball League Infrastructure — Phase 2 Report

This change fixes four follow-up issues surfaced by Phase 1 testing and
brings the public-facing community-league experience (league / team /
player / game pages) up to spec. It also adds admin → public preview
links and a server-side season summary endpoint.

## 1. Bugfixes

### A1 — Top nav visibility

**Root cause.** `app/page.tsx`, `app/discover/page.tsx`, `app/discover/[id]/page.tsx`,
and `app/discover/new/page.tsx` each render their own inline `<nav>` populated
from a hard-coded `NAV_ITEMS` constant. After Phase 1 added "社区联赛" to
`components/Header.tsx` and `components/LightHeader.tsx`, those four inline
arrays still listed only the original four items. Users hit `/contest` (which
uses `LightHeader`), saw "社区联赛 / 平台管理" appear there, and reported the
items as having "shown up only after clicking Daily Contest." In reality the
items were never present in the inline navs.

**Fix.** Extracted a small shared hook `lib/basketball/use-platform-admin.ts`
that mirrors the existing `LightHeader` admin-status fetch. The four inline-nav
pages now derive their `NAV_ITEMS` array from a shared `BASE_NAV_ITEMS`
(includes "社区联赛 / Community Leagues") plus the conditional `ADMIN_NAV_ITEM`
("平台管理 / Platform Admin") gated on `isPlatformAdmin`. Top nav is now
identical across:

- `/` (home)
- `/discover`, `/discover/[id]`, `/discover/new`
- `/league` (uses `LightHeader`)
- `/contest/*` (uses `LightHeader`)
- `/community-leagues` (uses `LightHeader`)
- `/admin/*` (uses `LightHeader`)
- `/basketball-leagues/[slug]/*` (uses `LightHeader`)

In all cases the order is 首页 / 发现 / 公开联赛 / 每日竞赛 / 社区联赛 + 平台管理
(when admin). Auth-based gating for 平台管理 is preserved.

### A2 — Community league contest page context

`components/contest/league/PageShell.tsx` already linked back to the league's
public page and rendered the league name. It now also:

- Shows the H1 as `"{LeagueName} 每日竞赛"` / `"{LeagueName} Daily Contest"` so
  it cannot be confused with the generic NBA hub.
- Adds a small subtitle `"社区联赛 · {LeagueName}"` / `"Community League · {LeagueName}"`
  for additional context.
- Leaves `activeHref="/contest"` so the top-nav highlight remains "每日竞赛"
  (per the spec: all DFS lives under Daily Contest).
- Preserves the existing `"查看联赛详情 →"` link to `/basketball-leagues/{slug}`.

### A3 — Member invitation flow

**Findings from audit.**
- The POST `/api/basketball-leagues/[id]/members` handler accepted any
  non-empty string as `user_id` (no UUID format validation). Admins who pasted
  a username instead of a UUID got a row written with an unmatchable value, so
  the invited user's auth UUID never matched.
- The page-side `Access` type on `/basketball-leagues/[slug]/page.tsx` dropped
  `memberRole` from the server response, so even a correct invite was invisible
  to the invited user.
- There was no UI surface anywhere showing "你在本联赛中的身份".

**Fix.**
- **UUID validation**: POST + PATCH now strictly require a UUID-shaped
  `user_id`. Invalid input returns `400 invalid_user_id_format`.
- **User-exists check**: POST also looks up the target in `public.users` and
  returns `warning: "user_not_found_in_public_users"` when missing. The admin
  UI surfaces a friendly warning when this fires.
- **Admin-gated username lookup endpoint**: new
  `GET /api/basketball-leagues/[id]/lookup-user?u=<username>`, gated by
  `requireLeagueAdmin`. Returns `{ user_id, username, name, avatar_url }`
  from `public.users`, or 404. The admin Members tab now has a "用户名 (查找)
  / Username (lookup)" + "查找 / Look up" pair that calls this endpoint and
  auto-fills the user_id field. Admins do not have to know auth UUIDs.
- **Role indicator on public league page**: `/basketball-leagues/[slug]` now
  pulls the full `BasketballLeagueAccess` (including `memberRole`,
  `memberTeamId`, `canEditOwnPlayerProfile`) and renders a chip near the hero:
  `"你在本联赛中的身份 · {localized role}"` (only when `memberStatus === "approved"`).
  For role = `player` without a linked player profile, the chip additionally
  shows `"· 球员档案待绑定"`.

**Semantics (confirmed in this report).**

- "邀请并通过" creates an active membership row immediately. No additional
  acceptance step is required from the invited user.
- The invited user immediately gains:
  - `canView` on `invite_only` and `private` leagues (since
    `memberStatus = "approved"`).
  - `canInputStats` if role is `scorekeeper`.
  - `canManageOwnTeam` if role is `team_manager` (helper exists; no admin UI
    surfaces this yet in Phase 2).
  - `canEditOwnPlayerProfile` only after also passing through the existing
    player claim flow.
- The invited user sees the role badge on `/basketball-leagues/{slug}` after
  this fix.
- If role is `player` but the user has not (yet) claimed a player profile,
  the page does not pretend a profile is bound — it shows
  `"球员档案待绑定 / player profile pending link"`.

### A4 — Role label localization

New helper `lib/basketball/role-labels.ts` exposes:

```ts
memberRoleLabel(role, lang)
MEMBER_ROLE_VALUES
```

Mapping (`zh` / `en`):

| Enum value | 中文 | English |
|---|---|---|
| `league_admin` | 联赛管理员 | League Admin |
| `team_manager` | 球队经理 | Team Manager |
| `player` | 球员 | Player |
| `referee` | 裁判 | Referee |
| `scorekeeper` | 记分员 | Scorekeeper |
| `viewer` | 观察者 | Viewer |

Consumers updated:
- Admin Members tab role `<select>` in `app/admin/basketball-leagues/[id]/page.tsx`.
- Approval row role `<select>` in `components/basketball/LeagueMemberApprovalList.tsx`.
- Public league page role badge in `app/basketball-leagues/[slug]/page.tsx`.

Wire/storage format is unchanged — the `value` attribute on each `<option>`
remains the raw enum string. Only the display label is localized.

## 2. Public pages (Phase 2 upgrades)

Route convention: kept the existing plural `/basketball-leagues/[slug]/...`
tree. The spec's singular "/basketball-league/{leagueSlug}" would have meant
renaming every existing link and route file; the spec itself allows following
the existing repo convention.

### League page — `/basketball-leagues/[slug]`

- Hero now includes language-aware role badge, description, and CTAs.
- `"进入每日竞赛 →" / "Play daily contest →"` button when
  `is_contest_enabled` is true.
- Teams grid shows logo thumbnails (with placeholder fallback) and is
  clickable to the team detail page.
- Players grid shows avatar thumbnails, jersey number badges, position, team
  name; clickable to the player detail page.
- Schedule cards are clickable (existing).
- Two new "coming soon" placeholders sit between hero and schedule: 联赛新闻 /
  League News, 比赛集锦 / Highlights.

### Team page — `/basketball-leagues/[slug]/teams/[teamId]`

- Hero now displays `bio` when present (existing logo/name/city/abbr).
- **Season snapshot**: W-L (incl. ties when present), games played, average
  points scored, average points allowed — all sourced from the new server-side
  endpoint `/api/basketball-teams/[id]/season-summary`. Empty state
  "暂无已完赛比赛数据 / No completed games yet." when no qualifying games exist.
- **Team leaders**: scoring / rebounding / assists leader cards derived from
  `basketball_player_game_stats` joined to finalized games. Cards are
  clickable to each player's detail page. If the season summary returned
  `null` for all categories, a dashed-border placeholder shows
  "球队数据领袖即将上线 / Team leaders coming soon."
- Roster grid now shows avatar thumbnails and is fully clickable.
- **Schedule** now resolves opposing team names + logos via a new
  `team_map` returned by the existing `/api/basketball-teams/[id]` endpoint
  (replaces the prior `"home"/"away"` placeholder strings).
- Back link to the league.

### Player page — `/basketball-leagues/[slug]/players/[playerId]`

- Identity hero shows avatar + name + team (link) + jersey + position. Now
  also prefers `height_cm` / `weight_kg` over the legacy text columns and
  computes age from `birth_year` ("Age 23" / "23 岁") when present.
- **Platform Account Link**: when the player is claimed (status `approved`
  and `claimed_by_user_id` set), the existing
  `/api/basketball-players/[id]` endpoint now resolves the user via the
  existing `public.users` table and returns `claimed_user`. The page renders
  a chip linking to `/u/{username}` ("查看平台主页 / View platform profile").
  When unclaimed, a subtle hint "该球员暂未绑定平台账号 / This player has not yet
  been linked to a platform account." is shown.
- Season averages + game log unchanged (preserves Phase 1 behavior).
- New **AI Scouting Snapshot placeholder** section: "AI 技术画像 / AI Scouting
  Snapshot" with copy "基于比赛数据的球员技术分析即将上线 / Data-driven player
  scouting coming soon." Dashed-border card, no AI integration yet.

### Game page — `/basketball-leagues/[slug]/games/[gameId]`

- Team panel scores in the header are now wrapped in `<Link>` to the
  team detail page when a team id exists.
- Box score tables continue to render player names as links to the player
  detail page.
- Empty state ("No data yet") was already present for scheduled/no-stats
  games — left unchanged.

## 3. Admin preview links

In `/app/admin/basketball-leagues/[id]/page.tsx`:

- League H1 wrapped in a `<Link>` to `/basketball-leagues/{slug}` plus an
  explicit "查看公开页面 →" chip in the header row.
- TeamsTab team-name rows: clickable to `/basketball-leagues/{slug}/teams/{teamId}`.
- PlayersTab player-name rows: clickable to `/basketball-leagues/{slug}/players/{playerId}`.
- GamesTab "away @ home" labels: clickable to `/basketball-leagues/{slug}/games/{gameId}`.

All preview links open in the same tab (matches the site pattern).

## 4. API surface changes

| Endpoint | Change |
|---|---|
| POST/PATCH `/api/basketball-leagues/[id]/members` | UUID validation on `user_id`; POST returns `warning: "user_not_found_in_public_users"` when target missing in `public.users`. |
| GET `/api/basketball-leagues/[id]/lookup-user?u=<username>` | **New.** Admin-gated username → user_id lookup for invite UX. |
| GET `/api/basketball-teams/[id]` | Response now includes `team_map: Record<id, {id, name, abbreviation, logo_url}>` covering every team referenced by the games list. |
| GET `/api/basketball-teams/[id]/season-summary` | **New.** Server-side W/L record + PF/PA averages + leaders, gated by visibility. |
| GET `/api/basketball-players/[id]` | Response now includes `claimed_user: { user_id, username, name, avatar_url } \| null` when the player has been claimed by a platform user. |

No DB migrations were needed for Phase 2.

## 5. Localization

All new copy passes through `useLang()` / `t(zh, en)`:

- Top nav labels (zh & en variants).
- Community-contest subtitle.
- Role badges via `memberRoleLabel`.
- League / team / player / game page section titles, empty states, AI
  placeholder, and the invitation lookup UI.

## 6. Verification

- `npm run lint`: matches the pre-existing baseline (81 errors / 89 problems).
  No new lint errors were introduced by Phase 2.
- `npx tsc --noEmit`: clean outside the pre-existing `tests/` path-resolution
  issues that also fail on trunk.

## 7. Deferred work / known limitations

- **Team manager write permissions**: helpers `isTeamManager` and
  `canManageOwnTeam` exist (Phase 1), but no admin/manager UI yet wires
  them. League/platform admins still own team and player writes.
- **Referee permissions**: still a no-op role with no write surfaces.
- **Player profile binding**: the public league role badge marks a `player`
  member as "球员档案待绑定" when no claimed profile exists; we did not auto-link
  a freshly invited `player` member to a `basketball_players` row. That binding
  remains the responsibility of the existing player claim flow.
- **AI Scouting Snapshot**: placeholder only. No model integration.
- **News & Highlights**: placeholders only. No content pipeline.
- **Username uniqueness**: the lookup endpoint returns the first row matching
  `public.users.username`. The schema treats `username` as the user handle —
  if duplicates exist anywhere, the lookup will need to be tightened.
- **Game page polish**: pre-game empty state is shown via the box-score
  "No data yet" path. A larger pre-game card with team logos + tip-off
  countdown is intentionally deferred.
