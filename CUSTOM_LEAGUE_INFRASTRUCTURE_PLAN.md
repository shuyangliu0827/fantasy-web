# Custom Basketball League Infrastructure

This document describes the parallel infrastructure layer for **real-world
basketball leagues** (campus tournaments, semi-pro circuits, internal pickup
leagues) added in migration `029_basketball_infrastructure.sql`. It is
additive: every existing NBA flow (rankings, compare, daily contests,
season-long fantasy, scoreboard, standings, roster) keeps working unchanged.

---

## 1. `basketball_leagues` vs existing `leagues`

The codebase now has two distinct kinds of "league":

| Table                 | Represents                                | Player IDs                       | Scope             |
|-----------------------|-------------------------------------------|----------------------------------|-------------------|
| `leagues`             | Fantasy season-long leagues (NBA-backed)  | BDL integer ids (TEXT)           | Pre-existing      |
| `basketball_leagues`  | Real-world basketball competitions        | UUIDs in `basketball_players.id` | New in 029        |

They are **not interchangeable**. A future "fantasy contest on a custom
league" would link the two via the nullable column we added:

```sql
leagues.basketball_league_id uuid NULL REFERENCES basketball_leagues(id);
```

For now that column is unused. Existing fantasy leagues set it to `NULL`.

---

## 2. Permission model

Two layers, three identity types:

```
┌──────────────────────┐
│  platform_admins     │   Blueprint staff (one row per user, any league)
└──────────┬───────────┘
           │ grants
           ▼
┌──────────────────────┐
│  basketball_league_  │   Per-league owner / admin
│       admins         │
└──────────┬───────────┘
           │ grants
           ▼
┌──────────────────────┐
│  basketball_league_  │   stat_keeper / player / viewer
│       members        │
└──────────────────────┘
```

Permission matrix:

| Action                                | Platform admin | League owner/admin | Approved stat_keeper | Approved player (claim) | Approved viewer | Anonymous |
|---------------------------------------|:-:|:-:|:-:|:-:|:-:|:-:|
| View public league                     | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View invite_only / private league      | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Set league status                      | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Grant `league_owner` / `league_admin`  | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Set visibility                         | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage teams / players / games         | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Grant `stat_keeper`/`player`/`viewer`  | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Approve player claims                  | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create games                           | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Input box scores                       | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit own claimed player profile fields | ✅ | ✅ | ❌ | ✅ (safe fields only) | ❌ | ❌ |

The authoritative implementation is `lib/basketball/access.ts`. Every
mutating API route runs `requirePlatformAdmin` / `requireLeagueAdmin` /
`requireStatsPermission` before touching the DB.

---

## 3. Visibility model

`basketball_leagues.visibility` is one of `public`, `invite_only`, `private`.
Defaults to `invite_only` at creation time.

| Visibility   | Anonymous can see | Non-member sees                     | Approved member sees |
|--------------|:-----------------:|-------------------------------------|----------------------|
| `public`     | ✅                | Full league content                  | Full league content   |
| `invite_only`| ❌                | Request-access wall (UI Phase B)     | Full league content   |
| `private`    | ❌                | Private wall (UI Phase B)            | Full league content   |

Bilingual copy for the walls (Phase B UI will use these strings via `useLang`):

**English**

- Private: *"This league is private. Only approved members can view its stats, fantasy contests, leaderboards, and content."*
- Invite-only: *"This league is invite-only. Request access to follow the league, view stats, and participate in approved features."*
- Public: *"This league is public. Anyone can view schedule, standings, stats, and player profiles. Participation may still require approval."*

**中文**

- 私密：*"该联赛为私密联赛。只有获批成员可以查看数据、Fantasy 比赛、排行榜和联赛内容。"*
- 邀请制：*"该联赛为邀请制联赛。申请加入后，你可以查看数据、关注比赛，并参与获准开放的功能。"*
- 公开：*"该联赛为公开联赛。任何人都可以查看赛程、排名、数据和球员主页；部分互动功能仍可能需要审核。"*

---

## 4. Player profile claim / edit flow

```
unclaimed → (POST /api/basketball-players/[id]/claim by user)
          → pending
          → (PATCH .../claim {claim_status:"approved"} by league admin)
          → approved
              → user may PATCH /api/basketball-players/[id]/profile on
                whitelisted fields:
                  display_name, position, jersey_number, height, weight,
                  bio, avatar_url
              → all other fields (team_id, stats, fantasy_points,
                game records) are 403.
```

Stricter moderation (player files an edit request, league admin reviews
before write) is reserved for a future phase. The
`basketball_player_profile_edit_requests` table exists for that flow.

---

## 5. End-to-end data flow

1. **Create league** — `POST /api/basketball-leagues` (authenticated user).
   The league lands in `status='pending'`, `visibility='invite_only'`, and
   the creator is auto-granted `league_owner` (Choice A MVP behavior).
2. **Platform approval** — Platform admin does
   `PATCH /api/platform/basketball-leagues/[id]/status {status:"approved"}`.
3. **Grant additional league admins** — Platform admin does
   `POST /api/platform/basketball-leagues/[id]/grant-admin
   {user_id, role:"league_admin"}`.
4. **Set visibility** — League admin does
   `PATCH /api/basketball-leagues/[id]/visibility
   {visibility:"public"|"invite_only"|"private"}`.
5. **Add teams** — `POST /api/basketball-leagues/[id]/teams`.
6. **Add players** — `POST /api/basketball-leagues/[id]/players`.
7. **Schedule a game** — `POST /api/basketball-leagues/[id]/games`.
8. **Input box score** — `POST /api/basketball-games/[id]/box-score`
   with `{ stats: [...] }`. The server computes `fantasy_points` for each
   row via `calcFantasyPoints(stats, ESPN_DEFAULT_WEIGHTS)` from
   `lib/fantasy/shared/scoring-config.ts` — the single source of truth for
   scoring across NBA and custom basketball.
9. **Display** — `GET /api/basketball-games/[id]/box-score`,
   `GET /api/basketball-leagues/[id]/games`, etc. (UI in Phase B.)

---

## 6. Dev / test permission grant cookbook

The `POST /api/dev/grant-basketball-access` route is **gated by the
`DEV_ADMIN_SECRET` env var**. If the secret is unset, the route returns
`503 dev_admin_secret_not_configured` — it can never be silently open.
Never expose this route in UI.

### a) `curl` examples

```bash
# Grant platform admin
curl -X POST $BASE/api/dev/grant-basketball-access \
  -H "x-dev-admin-secret: $DEV_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"type":"platform_admin","user_id":"<uuid>"}'

# Grant league_admin (or league_owner)
curl -X POST $BASE/api/dev/grant-basketball-access \
  -H "x-dev-admin-secret: $DEV_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"type":"league_admin",
       "basketball_league_id":"<uuid>",
       "user_id":"<uuid>",
       "role":"league_admin"}'

# Grant approved league member (stat_keeper / player / viewer)
curl -X POST $BASE/api/dev/grant-basketball-access \
  -H "x-dev-admin-secret: $DEV_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"type":"league_member",
       "basketball_league_id":"<uuid>",
       "user_id":"<uuid>",
       "role":"stat_keeper",
       "status":"approved"}'

# Approve a player claim
curl -X POST $BASE/api/dev/grant-basketball-access \
  -H "x-dev-admin-secret: $DEV_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"type":"player_claim",
       "player_id":"<uuid>",
       "user_id":"<uuid>",
       "claim_status":"approved"}'
```

### b) Equivalent SQL (for anyone with direct DB access)

```sql
-- Grant platform admin
INSERT INTO platform_admins (user_id, role)
VALUES ('<uuid>', 'platform_admin')
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

-- Grant league_admin (or league_owner)
INSERT INTO basketball_league_admins (basketball_league_id, user_id, role, granted_at)
VALUES ('<league_uuid>', '<user_uuid>', 'league_admin', now())
ON CONFLICT (basketball_league_id, user_id)
DO UPDATE SET role = EXCLUDED.role, updated_at = now();

-- Grant approved league member
INSERT INTO basketball_league_members
  (basketball_league_id, user_id, role, status, approved_at)
VALUES ('<league_uuid>', '<user_uuid>', 'stat_keeper', 'approved', now())
ON CONFLICT (basketball_league_id, user_id)
DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status,
              approved_at = EXCLUDED.approved_at, updated_at = now();

-- Approve a player claim
UPDATE basketball_players
   SET claimed_by_user_id = '<user_uuid>',
       claim_status = 'approved',
       updated_at = now()
 WHERE id = '<player_uuid>';
```

---

## 7. Future phases (not in this PR)

This Phase A intentionally ships backend + docs only. The following are
planned but deferred:

- **Phase B — UI.** Admin pages (`/admin/platform/basketball-leagues`,
  `/admin/basketball-leagues/[id]`), public league pages
  (`/basketball-leagues/[slug]`), and the visibility walls
  (`PrivateLeagueWall`, `InviteOnlyLeagueWall`, `RequestAccessButton`,
  `PlatformGrantLeagueAdminForm`, `LeagueMemberApprovalList`,
  `PlayerClaimApprovalList`, `BoxScoreInputTable`).
- **CSV upload** for bulk team / player / box-score import
  (`source_type='csv'` already supported on the table).
- **AI recap** of completed games from box scores.
- **Custom fantasy contests** on top of basketball leagues (uses the
  reserved `leagues.basketball_league_id` column).
- **Provider abstraction** for NBA / custom / partner data sources
  (`source_type` is the seam).
- **Landing page acquisition funnel** for custom leagues
  (compare with the existing `/challenge` QR funnel).
