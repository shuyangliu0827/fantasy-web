# Taro Phase 1 Migration Plan

Scope: user system, Real Basketball Leagues, and public Fantasy leagues.

This phase intentionally excludes Daily Contest, live draft room, AI post generation, poster generation, and platform admin dashboards. Those flows have heavier real time, media, or privileged write behavior and should come after the Mini Program shell is stable.

## Why these modules first

The current Web app already separates the main product into pages, components, library code, API routes, and tests. The user system, public league discovery, and community league discovery are the best first slice because they cover the core mobile entry path without forcing the Mini Program to reimplement every complex fantasy game operation at once.

## Phase 1 user journeys

### Auth and profile

Supported in phase 1:

- Email and password login through a mobile backend wrapper.
- Token persistence in Mini Program storage.
- Fetch current profile from the token.
- Logout.
- Language preference stored locally.

Deferred:

- WeChat one tap login.
- Account binding between WeChat OpenID and existing Supabase user.
- Password reset and email confirmation UI.
- Avatar upload.

### Public Fantasy leagues

Supported in phase 1:

- Public league directory.
- League detail read view.
- Member count display.
- Basic league metadata.

Deferred:

- Creating leagues from Mini Program.
- Joining leagues.
- Roster editing.
- Live scoring pages.
- Draft room.

### Real Basketball Leagues

Supported in phase 1:

- Community league directory.
- League detail read view.
- Teams, players, and games summaries when exposed by the existing mobile API.
- Access token passthrough for invite only or private leagues when the user has permission.

Deferred:

- Admin creation and editing.
- Member invitation.
- Scorekeeper input.
- Player claim flow.
- Media upload.

## Proposed repo layout

```text
apps/mini
  config
  src
    app.config.ts
    app.tsx
    app.scss
    constants
    pages
      home
      auth/login
      profile
      fantasy-leagues
      fantasy-leagues/detail
      community-leagues
      community-leagues/detail
    services
    store
    types
```

## Backend boundary

The Mini Program should not call Ball Don't Lie, Supabase service role operations, or Anthropic directly. It should call mobile friendly API routes under `app/api/mobile/*`. Those routes can reuse the existing server side Supabase clients and access helpers.

Mobile API target surface for phase 1:

```text
POST /api/mobile/auth/login
GET  /api/mobile/auth/me
GET  /api/mobile/fantasy-leagues
GET  /api/mobile/fantasy-leagues/[slug]
GET  /api/mobile/community-leagues
GET  /api/mobile/community-leagues/[id]
```

## Definition of done

Phase 1 is done when the Mini Program can:

- Launch with Home, Leagues, Community, and Me tabs.
- Log in with an existing email and password account.
- Persist and clear the session token.
- Render public Fantasy leagues.
- Render public Real Basketball Leagues.
- Navigate into a league detail screen.
- Use the same bilingual copy model as the Web app.

## Risk notes

- Existing Web code uses browser APIs such as `window`, `localStorage`, `Link`, and `fetch`. The Mini Program code must use Taro APIs instead.
- Existing API routes sometimes return Web sized payloads. Phase 1 adds mobile wrappers so the Mini Program receives smaller and more stable payloads.
- Secrets must remain on the server. No Ball Don't Lie key, Supabase service role key, or Anthropic key belongs in `apps/mini`.
