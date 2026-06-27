# Blueprint 青少年篮球联赛 — WeChat Mini Program

WeChat mini program companion for the Blueprint youth basketball league platform.

AppID: `wx3bd939a6658ed9c1`  
Framework: Taro 4.2.0 + React 18 + TypeScript + SCSS  
Target: WeChat Mini Program (weapp)

---

## Architecture: Web App + Mini Program

**This mini program is a lightweight parent/player-facing client that mirrors core read flows from the existing Blueprint web platform. It is not a standalone product.**

| Concern | Where it lives |
|---|---|
| Full admin dashboard | [blueprintfantasy.com](https://blueprintfantasy.com) (web app) |
| League settings, season config | Web app only |
| Data entry, score reporting | Web app only |
| Complex community management | Web app only |
| Viewing schedule, results, standings | Mini program + web app |
| Player & team profiles | Mini program + web app |
| Announcements (read-only) | Mini program + web app |
| Community feed (read + post) | Mini program + web app |
| My profile / WeChat login | Mini program |

### The web app remains the full admin and product experience

The web app at **blueprintfantasy.com** is the source of truth for all data and functionality. League commissioners, coaches, and organizers manage everything there: creating seasons, entering scores, managing rosters, publishing announcements, and accessing detailed analytics. Nothing in the mini program can replace or bypass the web app's admin capabilities.

### The mini program is the lightweight parent/player client

The mini program surfaces the information that parents and players need on-the-go — upcoming games, live scores, standings, team rosters, and community posts — without requiring them to log into a full web browser. It is intentionally scoped to read-only core flows plus basic community participation. Admin features, league settings, and complex management remain on the web app.

### Real backend integration will use `/api/mp/...` endpoints on blueprintfantasy.com

When `USE_MOCK = false` in `src/services/api.ts`, all real calls go to **`https://blueprintfantasy.com/api/mp/...`**. This namespace is dedicated to mini program endpoints on the Next.js backend, isolated from the web app's own routes. The mini program never calls internal web app routes directly.

---

## Quick Start

```bash
# 1. Enter the miniprogram directory
cd miniprogram

# 2. Install dependencies (first time only)
npm install

# 3. Start development build with file watcher
npm run dev:weapp

# 4. Open WeChat DevTools, import project pointing at:
#    /path/to/fantasy-web/miniprogram/dist/
```

---

## Available Scripts

```bash
# Development (watch mode — rebuilds on file changes)
npm run dev:weapp

# Production build (minified, optimized)
npm run build:weapp

# CI production build
npm run build:weapp:ci
```

---

## Opening in WeChat DevTools

1. Run `npm run dev:weapp` (keep it running in the background)
2. Open **微信开发者工具** (WeChat DevTools)
3. Click **导入项目** (Import Project)
4. Set **项目目录** to `.../fantasy-web/miniprogram/dist/`
5. AppID is already set to `wx3bd939a6658ed9c1` in `project.config.json`
6. Click **确定**

The DevTools read compiled output from `dist/`, not `src/`. Leave `npm run dev:weapp` running so the `dist/` stays in sync as you edit.

---

## Preview on Phone

In WeChat DevTools toolbar:
1. Click **预览** → DevTools generates a QR code
2. Scan the QR code with the WeChat account registered as a developer for this AppID
3. The mini program opens on your phone

---

## Upload Development Version

1. In WeChat DevTools toolbar, click **上传**
2. Fill in version number and description
3. Log into the [WeChat Mini Program admin console](https://mp.weixin.qq.com/)
4. Go to **版本管理** → find the uploaded version under **开发版本**
5. Click **提交审核** when ready for review, or **选为体验版** to share with testers

---

## Configuring Legal Domains (WeChat Backend)

Before making real API calls to blueprintfantasy.com, you must whitelist the domain in the WeChat Mini Program admin console.

1. Go to [mp.weixin.qq.com](https://mp.weixin.qq.com/)
2. **开发** → **开发设置** → **服务器域名**
3. Add the following:

| Type | Domain |
|---|---|
| request 合法域名 | `https://blueprintfantasy.com` |
| uploadFile 合法域名 | `https://blueprintfantasy.com` |
| downloadFile 合法域名 | `https://blueprintfantasy.com` |

Only `https://` domains are allowed. `http://` and non-standard ports are blocked.  
In DevTools you can temporarily disable domain validation: **详情** → **本地设置** → check **不校验合法域名**.

---

## Project Structure

```
miniprogram/
├── package.json
├── tsconfig.json
├── babel.config.js
├── project.config.json          # WeChat project config (AppID, miniprogramRoot)
├── config/
│   ├── index.ts                 # Taro build config
│   ├── dev.ts
│   └── prod.ts
└── src/
    ├── app.ts                   # App entry
    ├── app.config.ts            # Pages + tabBar
    ├── app.scss                 # Global CSS variables
    ├── types/league.ts          # All TypeScript interfaces
    ├── mock/leagueData.ts       # Mock data (flip USE_MOCK in api.ts to disable)
    ├── services/
    │   ├── api.ts               # API layer — set USE_MOCK=false for real backend
    │   └── auth.ts              # Auth helpers + real login flow docs
    ├── components/              # 8 reusable components
    │   ├── GameCard/
    │   ├── TeamCard/
    │   ├── PlayerRow/
    │   ├── PostCard/
    │   ├── EmptyState/
    │   ├── LoadingState/
    │   ├── SectionHeader/
    │   └── PrimaryButton/
    ├── pages/                   # 11 pages
    │   ├── home/                # Tab 1 — upcoming games, announcements ticker, league info
    │   ├── schedule/            # Tab 2 — all games grouped by date, filterable
    │   ├── standings/           # Tab 3 — ranked teams, W/L/pct, last-5
    │   ├── community/           # Tab 4 — parent/player community feed
    │   ├── profile/             # Tab 5 — WeChat login + bound team/player
    │   ├── teams/               # All teams list
    │   ├── team-detail/         # receives ?id= — overview/roster/games tabs
    │   ├── player-detail/       # receives ?id= — stats + physical info
    │   ├── announcements/       # Full announcements list (pinned first)
    │   ├── post-detail/         # receives ?id= — post + comments
    │   └── create-post/         # Gated behind login
    └── assets/icons/            # Tab bar PNG icons (placeholder 1×1)
```

---

## Switching from Mock to Real Backend

1. Open `src/services/api.ts`
2. Change `const USE_MOCK = true` to `const USE_MOCK = false`
3. Ensure `https://blueprintfantasy.com` is in your WeChat legal domains (see above)
4. Implement the `/api/mp/...` routes on the Next.js backend

All API calls target `https://blueprintfantasy.com/api/mp/...`. This namespace is reserved for mini program endpoints and kept separate from the web app's own routes.

---

## API Endpoint Plan (`/api/mp/...`)

These endpoints need to be built on the Next.js backend when switching off mock data:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/mp/league` | League metadata, current season |
| GET | `/api/mp/games` | All games (filterable by status/date/week) |
| GET | `/api/mp/teams` | All teams with W/L record |
| GET | `/api/mp/teams/:id` | Team detail + roster + game list |
| GET | `/api/mp/players/:id` | Player profile + season stats |
| GET | `/api/mp/standings` | Full standings from matchup results |
| GET | `/api/mp/announcements` | Announcements, pinned first |
| GET | `/api/mp/community/posts` | Community feed |
| GET | `/api/mp/community/posts/:id` | Post + comments |
| POST | `/api/mp/community/posts` | Create post (auth required) |
| POST | `/api/mp/auth/wechat-login` | Exchange WeChat code → session token |

Source tables: `basketball_leagues`, `basketball_games`, `basketball_teams`, `basketball_players`, `basketball_player_game_stats`, `insights` (community/news), `comments`, `users`.

---

## WeChat Login (Future Implementation)

See `src/services/auth.ts` for the full real-login flow documentation.

In brief:
1. `Taro.login()` → `code`
2. `POST https://blueprintfantasy.com/api/mp/auth/wechat-login` with `{ code }`
3. Backend calls `wx.code2Session(AppID, AppSecret, code)` → `openId`
4. Backend creates/finds user, returns session token
5. `Taro.setStorageSync('bp_mp_token', token)`
6. API requests attach `Authorization: Bearer <token>`

Profile picture and nickname require `Button openType="getUserInfo"` (user must actively tap).

---

## Design Notes

- Colors: Navy `#1e3a5f` (nav) + Orange `#f97316` (accent)
- Font: `-apple-system, PingFang SC` (system font, no webfonts needed)
- CSS units: Write `px` in SCSS; Taro's pxtransform converts to `rpx` at build time (designWidth: 750)
- All layout uses `View`/`Text`/`Image` from `@tarojs/components` — no HTML tags
- Tab icons in `src/assets/icons/` are 1×1 placeholder PNGs — replace with real 81×81 PNGs before launch

---

## Out of Scope for Mini Program

The following features belong on the web app (blueprintfantasy.com) only:

- League creation and season configuration
- Score entry and box score editing
- Roster management (add/remove players)
- Admin dashboard and analytics
- Trade proposals and advanced team management
- Payment and registration flows
- Community moderation tools

Parents and coaches who need any of the above should be directed to **blueprintfantasy.com**.

---

## Language Policy

This mini program serves youth basketball league participants (parents, players, coaches). Do not use words associated with sports gambling, daily fantasy sports, or prediction games anywhere in the UI, page titles, API responses, or mock data.

**Banned**: fantasy, betting, odds, prize, cash reward, contest, salary cap, gambling, wager, prediction game  
**Banned (Chinese)**: 竞猜, 下注, 奖金, 赔率, 彩票
