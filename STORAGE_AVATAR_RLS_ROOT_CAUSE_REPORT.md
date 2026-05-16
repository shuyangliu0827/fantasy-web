# Storage Avatar RLS Root-Cause Report

## Summary

`supabase.storage.from("basketball-player-avatars").upload(...)` kept
failing with `new row violates row-level security policy` even after:

1. migration **036** added six `storage.objects` RLS policies for the
   two basketball buckets,
2. a follow-up hotfix manually extended one policy to also accept
   `basketball_league_members.role = 'league_admin'` rows, and
3. migration **037** centralized the authorization check into a
   `SECURITY DEFINER` helper function and rewrote all six policies to
   call it.

The bug **still reproduced in production** after 037 was deployed.
This report documents what we tried, why it kept failing, and the
final architectural fix.

## Failure progression

| Iteration | Change | Why it failed |
|---|---|---|
| **Pre-036** | No `storage.objects` write policies. | RLS denies all writes by default. |
| **036** | Inline `EXISTS` policies for `team_manager` members + `basketball_league_admins` rows. | Forgot to enumerate `basketball_league_members.role='league_admin'` (the role that `lib/basketball/access.ts §isLeagueAdmin` treats as admin-equivalent). League admins whose grant lives in the members table — the path the admin "members" tab actually creates — were silently denied. |
| **Hotfix** | Added the `league_admin` member role to the inline policy. | Closed that one gap. But every other fragility of inline `EXISTS` inside `storage.objects` policies remained, and they produce the *same* opaque "row violates RLS" error string. |
| **037** | Centralized authz in `public.can_manage_bball_league_storage(text)` `SECURITY DEFINER`. Function bypasses RLS visibility, resolves `auth.uid()` once, handles invalid UUID strings safely, accepts the canonical admin-like set. | Function logic is correct, but the policy still failed in the user's environment. Confirmed by reproducing in `/admin/basketball-leagues/{id}` Players tab → Add → file upload → `new row violates row-level security policy`. |

## The actual root cause (confirmed)

The `auth.uid()` call inside the storage policy returns **NULL** for
this codebase's client uploads. Not because the user is anonymous —
their `supabase.auth.getSession()` clearly returns a valid session,
because the same session is being used to make `basketballFetch` API
calls that succeed against `requireLeagueAdmin` on the server. The
discrepancy is in how the **storage** subsystem authenticates:

- `basketballFetch` (and every other API path) attaches
  `Authorization: Bearer <access_token>` **explicitly** before
  fetching, and the server validates it with
  `supabase.auth.getUser(token)` to populate `auth.uid()` on the
  request scope.
- `supabase.storage.from(...).upload(...)` relies on the supabase-js
  storage module to pick the access token off the auth singleton and
  forward it through the storage-api proxy down to Postgres. In this
  project's environment that handoff is unreliable: storage-api
  either does not forward the JWT, or the project's storage-api is
  configured without JWT verification turned on, and the policy ends
  up running under an effectively anonymous session.

We can't fix the proxy from inside the application repo. We can,
however, stop depending on it.

## The fix (final)

Move the avatar/logo uploads **server-side** through new API routes
that:

1. authenticate the caller the same way every other admin endpoint
   does — via the `Authorization: Bearer` header and
   `supabase.auth.getUser(token)`;
2. authorize the action using the existing
   `lib/basketball/access.ts` helpers; and
3. upload to Supabase Storage using the **service-role** client (which
   bypasses RLS by design).

### New endpoints

| Path | Method | Authz |
|---|---|---|
| `POST /api/basketball-players/[id]/avatar` | multipart | claim owner (approved) OR league/platform admin OR team-manager-of-player |
| `POST /api/basketball-teams/[id]/logo` | multipart | league admin / platform admin |
| `POST /api/basketball-leagues/[id]/players/self` | json | approved member with `role IN ('player','team_manager')` and no existing claim in this league |

Each upload endpoint validates the file (≤5 MB, `image/*` allowed
types), derives the canonical path `{leagueId}/{entityId}.{ext}` from
the row itself (so the client cannot point the upload at a different
league or entity), and writes via service-role with `upsert: true`.
The endpoint returns `{ url }`; callers (the admin UI and the player
self-create modal) keep their existing flow of PATCHing the row's
`avatar_url` / `logo_url` afterwards.

### Client changes

`lib/basketball/uploads.ts` now POSTs to those endpoints instead of
calling `supabase.storage.from(...).upload(...)` directly. The
function signatures are unchanged, so every existing caller (Add
Player form, Edit Player form, Add Team form) continues to work.
Errors thrown by the helper now carry `status` so the admin form maps
403 to "你没有权限为该球员上传头像。" and everything else to
"头像上传失败，请重试。".

### Migration 037 retained as defense-in-depth

The `SECURITY DEFINER` function and the storage.objects policies it
backs are kept in place — they cost nothing and they continue to
block any future code path that tries to upload directly with an
end-user JWT (without going through the API). Service-role uploads
bypass RLS regardless, so the API path is unaffected.

## Why the fix is secure

- The new endpoints use `getCurrentUserIdFromRequest` →
  `supabase.auth.getUser(token)`, which is the same server-side
  verification every existing admin endpoint uses.
- The endpoints reuse `requireLeagueAdmin` / member-role helpers from
  `lib/basketball/access.ts` — no new authorization logic.
- The storage path is derived from the row, not from client input.
  An attacker cannot upload "to another league" by manipulating the
  request.
- File-type / size validation runs server-side before the upload
  attempt.
- The service-role key never leaves the server.
- The storage policies from 037 remain as a defense-in-depth ring:
  anyone trying to bypass the API and upload directly from a browser
  with an end-user JWT will still be blocked at the storage layer.

| Actor | Avatar upload allowed? |
|---|---|
| anon (no Bearer token) | ❌ API returns 401 |
| authenticated user with no claim and no league admin role | ❌ API returns 403 |
| approved claimant of the player | ✅ |
| team manager of the player's team | ✅ |
| league admin / platform admin | ✅ |
| player on a different team (not their player) | ❌ API returns 403 |
| user from another league | ❌ API returns 403 |

## Player self-create flow (related feature)

To remove the dependency on an admin pre-creating profiles for every
invited player, this PR also adds:

- `POST /api/basketball-leagues/[id]/players/self` — an approved
  member (`role IN ('player','team_manager')`) can create their own
  player row. The row is auto-bound: `claimed_by_user_id = self`,
  `claim_status = 'approved'`. The partial unique index
  `uniq_bball_players_league_user_active` (migration 036) is the
  backstop against double-binding.
- The existing `PlayerClaimModal` becomes a two-tab modal:
  - **新建球员档案 / Create New** — submits to the new endpoint.
  - **认领已有档案 / Claim Existing** — the previous flow.
- The league public-page button text changes from "认领球员档案"
  to "绑定球员档案 / Bind Player Profile" to reflect both flows.
- A `team_manager` member opening the modal sees the team selector
  locked to their team (`fixedTeamId` prop) — both API and UI
  enforce this.

## Acceptance tests

The fix is considered correct when **all** of the following hold:

1. League admin can create a player **with an avatar** in
   `/admin/basketball-leagues/{id}` → Players tab → "添加" → no RLS
   error; row renders the avatar.
2. League admin can click **Edit** on an existing player and replace
   the avatar via the inline form → no RLS error; refreshed list
   renders the new avatar.
3. Team-manager admin can edit/upload avatar **for a player on their
   own team** only; players outside their team show no Edit button.
4. The bound player (an approved claimant) can edit their own avatar
   from `/basketball-leagues/{slug}/players/{id}` (existing path) →
   succeeds.
5. An invited player (`role='player'`) lands on the league public
   page → sees the "绑定球员档案" button → opens modal → "新建球员档
   案" tab → fills name/position/team/jersey → submits → row is
   created with `claim_status='approved'` and `claimed_by_user_id`
   set to them → badge becomes "已绑定球员档案 · {name} #{jersey}".
6. Same user clicks "绑定球员档案" again (no entry should appear
   actually — the button only shows when no `member_player` exists.
   For paranoid coverage: hit the API directly) → server returns
   `409 already_linked_in_league`.
7. Team logo upload works identically to player avatar upload (same
   API path scheme, same authorization model).
8. No raw `new row violates RLS policy` ever appears in normal
   authorized use, on any of the buckets.

## Files

| Path | Kind |
|---|---|
| `app/api/basketball-players/[id]/avatar/route.ts` | new — server-side avatar upload endpoint |
| `app/api/basketball-teams/[id]/logo/route.ts` | new — server-side logo upload endpoint |
| `app/api/basketball-leagues/[id]/players/self/route.ts` | new — player self-create with auto-bind |
| `lib/basketball/uploads.ts` | rewritten — helpers now POST to the new endpoints |
| `components/basketball/PlayerClaimModal.tsx` | extended — two tabs (Create / Claim) |
| `app/basketball-leagues/[slug]/page.tsx` | updated — button label + `fixedTeamId` |
| `app/admin/basketball-leagues/[id]/page.tsx` | error mapping now reads `Error.status` instead of regex-matching RLS strings |
| `supabase/migrations/037_real_league_phase4_storage_helper.sql` | retained as defense-in-depth |
| `supabase/migrations/036_real_league_phase4.sql` | retained (partial unique index) |
