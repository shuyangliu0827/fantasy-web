# Blueprint 青少年篮球联赛 — WeChat Mini Program

Youth basketball league management mini program for parents, players, coaches, and organizers.

AppID: `wx3bd939a6658ed9c1`  
Framework: Taro 4.2.0 + React 18 + TypeScript + SCSS  
Target: WeChat Mini Program (weapp)

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
    │   ├── home/                # Tab 1
    │   ├── schedule/            # Tab 2
    │   ├── standings/           # Tab 3
    │   ├── community/           # Tab 4
    │   ├── profile/             # Tab 5
    │   ├── teams/
    │   ├── team-detail/         # receives ?id=
    │   ├── player-detail/       # receives ?id=
    │   ├── announcements/
    │   ├── post-detail/         # receives ?id=
    │   └── create-post/
    └── assets/icons/            # Tab bar PNG icons (placeholder 1×1)
```

---

## Switching from Mock to Real Backend

1. Open `src/services/api.ts`
2. Change `const USE_MOCK = true` to `const USE_MOCK = false`
3. Ensure `https://blueprintfantasy.com` is in your WeChat legal domains
4. Implement the API routes listed in `api.ts` on the Next.js backend

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

## No Fantasy / Gambling Language

This mini program is positioned as a **youth basketball league management** platform. Do not use words like: fantasy, betting, odds, prize, cash reward, contest, salary cap, gambling, wager, or prediction game anywhere in the UI, page titles, or API responses.
