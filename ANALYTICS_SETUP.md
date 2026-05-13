# Analytics Setup — PostHog

Blueprint Fantasy uses **PostHog** for three things at once:

- **Product Analytics** — custom events + autocapture of clicks/inputs
- **Web Analytics** — pageviews, sessions, traffic sources
- **Session Replay** — privacy-masked replays of real user sessions

This document is the single source of truth for how PostHog is wired in, what
env vars to set on the Tencent Cloud production server, how to verify the
integration end-to-end, and how to add new events later.

---

## 1. Files touched in this integration

| File | What it does |
|---|---|
| `package.json` / `package-lock.json` | Adds `posthog-js` dependency. |
| `lib/analytics/posthog.ts` | **Analytics utility layer.** Exports `initPostHog`, `trackEvent`, `identifyUser`, `resetUser`, `capturePageview`, `getPostHog`. All call sites should import from here — never import `posthog-js` directly. |
| `components/analytics/AnalyticsProvider.tsx` | Client component. Initializes PostHog on mount, tracks App Router pageviews on every client navigation (via `usePathname` + `useSearchParams` inside a `Suspense` boundary), and identifies the current Supabase user (initial check + `onAuthStateChange`). |
| `app/layout.tsx` | Mounts `AnalyticsProvider` once, wrapping `LangProvider` and the rest of the tree. |
| `.env.example` | Documents `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST`. |
| `ANALYTICS_SETUP.md` | This file. |

Nothing else in the app changed. No custom events have been scattered yet —
see §6 for where to add them next.

---

## 2. Environment variables (Tencent Cloud production)

Set these on the production server (e.g. in `.env.production`, the systemd unit
file, or your deploy pipeline) **before** the next `next build`:

```bash
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Notes:

- Both vars are `NEXT_PUBLIC_*`, so they are **inlined into the client bundle
  at build time**. You must rebuild (`npm run build`) after changing them.
- `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` is found in the PostHog UI under
  *Project Settings → General → Project API Key* (starts with `phc_`).
  This is a public, write-only token — it is safe to ship to the browser.
- For a US PostHog Cloud project use `https://us.i.posthog.com`. For an EU
  project use `https://eu.i.posthog.com`.
- **Leaving the token empty disables analytics gracefully** (the helpers
  become no-ops). This is the intended behavior in local dev when you don't
  want to pollute the production project.

---

## 3. How it works

### Initialization

`AnalyticsProvider` calls `initPostHog()` once in a `useEffect`. The init
config is:

| Option | Value | Why |
|---|---|---|
| `capture_pageview` | `false` | App Router does not fire native route events. We capture manually from `PageviewTracker` instead. |
| `capture_pageleave` | `true` | Needed for accurate session duration / bounce. |
| `autocapture` | `true` | Catches clicks, form submits, etc. for Product Analytics without any code changes. |
| `person_profiles` | `"identified_only"` | Anonymous events are still collected (Web Analytics works) but no persistent person profile is created until `identifyUser` is called. Cheaper and more privacy-friendly. |
| `session_recording.maskAllInputs` | `true` | Mask values of all `<input>` / `<textarea>` so emails, league names, chat messages, etc. don't leak into replays. |
| `session_recording.maskTextSelector` | `"[data-ph-mask]"` | Add `data-ph-mask` to any element whose text should also be masked. |

### Pageviews on App Router navigations

`PageviewTracker` reads `usePathname()` + `useSearchParams()` and fires a
`$pageview` event on every change. It is wrapped in `<Suspense>` because
`useSearchParams` opts the subtree into CSR (Next.js requirement).

### User identification

On mount, the provider calls `supabase.auth.getUser()` and, if a session
exists, calls `identifyUser(user.id, { email })`. It also subscribes to
`supabase.auth.onAuthStateChange` so the user is re-identified on `SIGNED_IN`
and `resetUser()` is called on `SIGNED_OUT`. PostHog's `distinct_id` therefore
matches the Supabase `auth.users.id` for every logged-in session.

---

## 4. Verifying the integration

After deploying with the env vars set:

1. **Browser console / network.** Open the production site, navigate to a few
   pages, log in. In DevTools → Network, filter for `i.posthog.com` (or
   whatever `NEXT_PUBLIC_POSTHOG_HOST` is). You should see `POST /e/` and
   `POST /s/` requests returning `200`.

2. **PostHog Activity feed.** In the PostHog UI go to *Activity* (or
   *Live events*). Within a few seconds you should see `$pageview`,
   `$autocapture`, and `$identify` events with the correct `distinct_id`.

3. **Web Analytics dashboard.** *Web Analytics* in the left nav should start
   populating within ~1 minute (sessions, top paths, referrers).

4. **Session Replay.** *Session Replay* → *Recordings* — there should be a
   recording for your test session. Open it and confirm form inputs (email,
   league name) are masked as `***`.

5. **Identify check.** While logged in, in DevTools console run
   `window.posthog?.get_distinct_id()` — it should return your Supabase
   `auth.users.id`, not an anonymous UUID.

If no requests fire at all: the env vars were not set at **build time**.
Rebuild and redeploy.

---

## 5. Same-domain reverse proxy (recommended for China)

Direct requests to `us.i.posthog.com` from mainland China are unreliable
(intermittent latency / packet loss). Once basic integration is verified,
front PostHog with a same-domain Nginx reverse proxy at `/ingest` on the
Blueprint Fantasy domain. PostHog officially supports this pattern.

### Nginx snippet

```nginx
# /etc/nginx/sites-available/blueprint-fantasy
location /ingest/static/ {
    proxy_pass https://us-assets.i.posthog.com/static/;
    proxy_set_header Host us-assets.i.posthog.com;
    proxy_ssl_server_name on;
    proxy_redirect off;
    proxy_buffering on;
    # PostHog assets are immutable — cache aggressively.
    proxy_cache_valid 200 1d;
}

location /ingest/ {
    proxy_pass https://us.i.posthog.com/;
    proxy_set_header Host us.i.posthog.com;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_ssl_server_name on;
    proxy_redirect off;
    proxy_buffering off;
    # Session replay payloads can be large.
    client_max_body_size 20m;
}
```

Then change the env var and rebuild:

```bash
NEXT_PUBLIC_POSTHOG_HOST=https://yourdomain.com/ingest
```

`posthog-js` will then load its own JS bundle, send events, and stream session
recordings — all over the same TLS connection as your app. No CORS, no
third-party DNS lookup, no extra trust prompts.

For EU projects, swap `us.i.posthog.com` → `eu.i.posthog.com` and
`us-assets.i.posthog.com` → `eu-assets.i.posthog.com`.

---

## 6. Suggested next-step custom events

The foundation is intentionally minimal — autocapture + pageviews already
power Web Analytics and most Product Analytics funnels. Add the explicit
events below as we work on each surface so we can build clean named funnels
and retention reports.

Use `trackEvent` from `lib/analytics/posthog.ts` everywhere:

```ts
import { trackEvent } from "@/lib/analytics/posthog";

trackEvent("click_signup", { source: "hero" });
```

| Event | Suggested location | Recommended properties |
|---|---|---|
| `click_cta_join` | Home/landing primary CTA buttons (`components/HeroSection.tsx`, `components/HomeHeroShowcase.tsx`) | `cta_id`, `position` |
| `click_cta_try_contest` | "Try daily fantasy" CTA on home / `app/contest/**` | `source` |
| `click_signup` | `app/auth/**` signup button + any header signup link | `source` |
| `click_login` | `app/auth/**` login button + header login link | `source` |
| `view_contest_page` | `app/contest/**` page mounts | `contest_slug`, `tab` |
| `select_player` | Contest lineup builder + draft picker | `player_id`, `slot`, `contest_slug` |
| `remove_player` | Same surfaces as `select_player` | `player_id`, `slot` |
| `submit_lineup` | Lineup submit handler | `contest_slug`, `lineup_size`, `valid` |
| `view_leaderboard` | `app/contest/**/leaderboard` + `app/league/**` standings | `scope`, `week_start` |
| `share_lineup` | `components/LineupShareCard.tsx` share button | `channel` |
| `view_feed` | `app/discover` / posts feed page mount | `tab` |
| `click_create_post` | Compose CTA in feed/header | `source` |
| `publish_post` | Post submit handler | `post_type`, `has_image` |
| `like_post` | Post like button | `post_id`, `author_id` |
| `comment_post` | Comment submit handler | `post_id` |
| `share_post` | Post share button | `post_id`, `channel` |

**Conventions** (please keep consistent so funnels work):

- Event names: lowercase `snake_case`, verb-first (`click_*`, `view_*`,
  `submit_*`, `publish_*`).
- Property names: lowercase `snake_case`. IDs are strings.
- For ambiguous "where did this come from" cases, add a `source` string
  property (`"hero" | "header" | "footer" | "contest_card"` etc.).
- Do **not** put PII in event properties — email, full name, etc. are already
  captured at identify-time on the person profile.

When wiring an event, mark any sensitive surrounding UI with `data-ph-mask`
to keep session replays clean.

---

## 7. Disabling analytics

- **Locally:** leave `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` blank in `.env.local`.
  `initPostHog` will log a one-line notice and become a no-op; all helpers are
  safe to call.
- **In production (kill switch):** unset the token env var and redeploy. No
  code changes needed.
