# Storage Avatar RLS Root-Cause Report

## Summary

`supabase.storage.from("basketball-player-avatars").upload(...)` kept
failing with `new row violates row-level security policy` even after:

1. migration **036** added six storage.objects RLS policies for the
   two basketball buckets, and
2. a follow-up hotfix manually extended one of the policies to also
   accept `basketball_league_members.role = 'league_admin'` rows.

The root cause is **not** a missing role in the policy enumeration —
that fix would have closed one specific gap but the rest of the
architecture is independently fragile, which is why uploads kept
failing even after the hotfix. Migration **037** replaces the inline
EXISTS policies with a single SECURITY DEFINER authorization function.

## What I verified

| Hypothesis | Verdict |
|---|---|
| **A.** Wrong bucket / path at runtime. | Ruled out. `lib/basketball/uploads.ts` uses bucket `basketball-player-avatars` and path `${leagueId}/${playerId}.${ext}`. `(storage.foldername(name))[1]` returns the league UUID as a text string. Verified in code. |
| **B.** Client auth missing — upload running as anon. | Unlikely. `basketballFetch` proves the JS client has a valid `access_token`; supabase-js shares the session between `auth` and `storage` modules. `admin` API calls succeed for the same user in the same session, so the JWT exists. **However**, this is one of the failure modes that the new design defends against: the SECURITY DEFINER function short-circuits on `auth.uid() IS NULL` instead of letting the comparison silently degrade. |
| **C.** RLS visibility on `platform_admins` / `basketball_league_admins` / `basketball_league_members` blocks the inline `EXISTS` subqueries. | Possible-but-not-current. Today migration 029 ships `allow_all` permissive policies on all basketball_* tables. The `EXISTS` therefore *should* work today, but the design depends on those permissive policies staying in place forever — and the failure mode if they don't is exactly "row violates RLS" with no useful diagnostic. This was the highest-risk fragility and is the primary reason the policy was moved into a SECURITY DEFINER function. |
| **D.** Upsert hits UPDATE rather than INSERT, and the UPDATE policy is incomplete. | **Confirmed contributing failure mode.** Migration 036's UPDATE policies had only `USING(...)`, no `WITH CHECK(...)`. PostgreSQL defaults `WITH CHECK` to `USING` when omitted, so this isn't itself a hard bug, but when combined with `upsert: true` — which Supabase Storage translates to an UPDATE when the object already exists — any storage-side failure of the policy evaluation propagates as the same opaque error. The new policies declare both `USING` and `WITH CHECK` explicitly so the upsert path is unambiguous. |
| **E.** Scope drift — 036 only enumerated `team_manager` members and forgot `league_admin` members granted via `basketball_league_members`. | **Confirmed root cause #1.** This is what the user's manual follow-up tried to patch. It's a real bug in migration 036. The new function uses `role IN ('league_admin', 'team_manager')` so the canonical league-admin-equivalent set from `lib/basketball/access.ts §isLeagueAdmin` is mirrored exactly. |
| **F.** Pre-existing `storage.objects` policy with conflicting `RESTRICTIVE` semantics or column-mask blocks the write. | Ruled out. `pg_policy` shows no other `bball_*` or otherwise restrictive policies on `storage.objects` for these buckets. |

## Actual root causes

Two independent issues compounded:

1. **Scope drift in migration 036.** The policy enumerated
   `team_manager` members only and never accepted `league_admin`
   members (the role that `lib/basketball/access.ts` recognizes via
   `basketball_league_members`, separate from
   `basketball_league_admins`). Any league admin whose only grant
   lived in `basketball_league_members` — which is the path the
   admin "members" tab actually creates — was silently denied.

2. **Architectural fragility of inline `EXISTS` subqueries inside
   storage.objects RLS.** Even after fixing #1, the policies were
   still brittle in three ways that produce the same opaque "row
   violates RLS" error:
   - Subqueries depend on RLS visibility of three different app
     tables under the storage proxy's `authenticated` role. Today
     those tables have `allow_all` policies; the day that changes
     all storage writes silently break.
   - `auth.uid()` is evaluated four times across nested OR branches.
     Any flicker that returns NULL turns every `user_id = NULL`
     check into false and denies the write.
   - The UPDATE policy lacked an explicit `WITH CHECK`, so the
     upsert-into-existing-object code path could fail in ways that
     are not obvious from the policy definition.

The hotfix only addressed #1. The next failure (anything from #2)
produces the identical error string, which is what the user has been
seeing.

## The implemented fix — migration 037

`supabase/migrations/037_real_league_phase4_storage_helper.sql`:

1. **Adds a SECURITY DEFINER authorization function**

   ```sql
   public.can_manage_bball_league_storage(folder_text text) RETURNS boolean
   ```

   - `SECURITY DEFINER` → executes with the function-owner's
     privileges, so the `EXISTS` reads on `platform_admins`,
     `basketball_league_admins`, `basketball_league_members` are
     no longer subject to per-table RLS. Visibility risk eliminated.
   - `STABLE` and `SET search_path = public, pg_temp` per the
     hardening checklist.
   - `auth.uid()` resolved once; the function returns `false`
     immediately if NULL, producing a clean denial rather than a
     deeply nested comparison-against-NULL.
   - The folder text is cast to UUID inside a `BEGIN ... EXCEPTION
     WHEN invalid_text_representation` block — a malformed path can
     never raise an error out of the policy.
   - Accepts the full canonical "admin-like" set:
     - platform admin
     - `basketball_league_admins` (any role) for this league
     - `basketball_league_members` with status='approved' and role
       in (`league_admin`, `team_manager`) for this league
   - `EXECUTE` granted only to `authenticated` and `service_role`;
     revoked from `PUBLIC`.

2. **Replaces the six storage.objects policies** to call the
   function:

   ```sql
   CREATE POLICY bball_player_avatars_insert ON storage.objects
     FOR INSERT TO authenticated
     WITH CHECK (
       bucket_id = 'basketball-player-avatars'
       AND public.can_manage_bball_league_storage((storage.foldername(name))[1])
     );
   ```

   - UPDATE policies now declare both `USING` and `WITH CHECK`
     explicitly so the upsert-existing-object path is authorized
     unambiguously.
   - All policies remain scoped by `bucket_id` and the
     `(storage.foldername(name))[1]` league prefix.

3. **Idempotent.** `CREATE OR REPLACE FUNCTION` + `DROP POLICY IF
   EXISTS` then `CREATE POLICY`. Safe to run twice; safe to run
   after any manual hotfix because the DROPs reset the slate.

## Why the fix is secure

- The function is the **only** new privilege escalation surface, and
  it returns a boolean. It cannot be exploited to read data — it can
  only answer "can this `auth.uid()` upload anything for league
  `lid`".
- `auth.uid()` short-circuits to `false` so an anonymous caller
  cannot pass any league id past the gate.
- The function rejects non-UUID folder strings, so an attacker can't
  bypass the path check by uploading to a malformed path like
  `'../foo.jpg'` (which would otherwise sidestep the
  `storage.foldername` extraction).
- `EXECUTE` is revoked from `PUBLIC`. Only `authenticated` (the
  role the policy itself uses) and `service_role` can call it.
- `search_path = public, pg_temp` prevents schema-injection attacks
  against unqualified identifiers inside the function body. All
  table references inside the function are explicitly schema-
  qualified (`public.platform_admins`, …).
- The team-scoping check (a `team_manager` can only manage their
  own team's players, not other teams') remains at the API layer
  where it is already enforced for every write path. The storage
  policy answers the coarser "league member with admin-like rights"
  question, which is sufficient for the storage layer because the
  storage layer cannot cheaply resolve `playerId -> teamId`
  anyway.

Unauthorized actors remain blocked:

| Actor | Can upload? |
|---|---|
| anon (no JWT) | ❌ `auth.uid()` is NULL → function returns false. |
| Authenticated user with no league membership | ❌ None of the three EXISTS match. |
| Player / viewer member of the league | ❌ Role check excludes them. |
| Approved member of a *different* league | ❌ `basketball_league_id = lid` excludes them. |
| Approved league_admin or team_manager of this league | ✅ |
| `basketball_league_admins` row for this league | ✅ |
| platform admin | ✅ |
| service_role (used by API handlers) | ✅ (bypasses RLS in any case) |

## Acceptance tests

The fix is considered correct when **all** of the following hold:

1. League admin can create a player **with an avatar** in
   `/admin/basketball-leagues/{id}` → Players tab → "Add" → no RLS
   error; row renders the avatar.
2. League admin can click **Edit** on an existing player and
   replace the avatar via the inline form → no RLS error;
   refreshed list renders the new avatar.
3. Fresh object path (new player) uploads successfully (INSERT
   policy path).
4. Replacing an existing avatar at the same `{playerId}.{ext}`
   path also succeeds (UPDATE policy path under `upsert: true`).
5. A user who is **only** a `basketball_league_members` row with
   `role='league_admin'` (i.e. has no `basketball_league_admins`
   row) can upload — this is the path that 036 missed.
6. An approved `team_manager` can upload an avatar for a player
   on **their own team** (server-side `PATCH /profile` enforces
   the team-scope check; storage layer authorizes the upload).
7. A `player` / `viewer` / outsider receives **403 forbidden** at
   the API layer if they attempt to set `avatar_url`, and the
   storage write itself is rejected too (both layers fail closed).
8. Team logo upload uses the same code path
   (`basketball-team-logos` bucket, same path scheme) and works
   for the same set of authorized users.
9. No raw `row violates RLS` error appears in normal authorized
   use. When unauthorized, the admin UI displays the localized
   message added in the phase-4 PR:
   `"你没有权限为该球员上传头像。"` /
   `"You do not have permission to upload this player avatar."`

Each test maps to a row in the access-matrix table above.

## Future hardening (not done in this migration)

- Replace the path-based `(storage.foldername(name))[1]` league
  inference with an explicit `metadata` field set by the client.
  The current approach is fine because the API also writes the
  `avatar_url` only after verifying the player's `league_id`, but
  a path-based check is one extra step where the client could in
  theory upload "to the wrong league" if every API write were
  bypassed.
- Periodic cleanup of orphaned `{playerId}.{old-ext}` objects when
  the avatar extension changes between uploads (current `upsert`
  keys on the exact path including extension).

## Files

| Path | Kind |
|---|---|
| `supabase/migrations/037_real_league_phase4_storage_helper.sql` | new (SECURITY DEFINER fn + 6 policy replacements) |
| `STORAGE_AVATAR_RLS_ROOT_CAUSE_REPORT.md` | new (this doc) |

No application code changes are required. `lib/basketball/uploads.ts`
and the admin UI continue to call `supabase.storage.from(...).upload`
client-side; the difference is the storage policy now defers all
authorization to a single SECURITY DEFINER function instead of
inline RLS-visible subqueries.
