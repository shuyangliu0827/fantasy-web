# Implementation Plan

## Task 1: Replace "幻想篮球" → "范特西篮球" in CN interface

Files to update (5 instances):
- `app/page.tsx` — hero description paragraph
- `app/my-team/page.tsx` — empty team prompt
- `app/how-to-play/page.tsx` — page title and section header (2 places)
- `app/auth/signup/page.tsx` — sign-up subtitle

---

## Task 2: Implement Insights pages (light theme, matching design mockup)

### 2a. `app/insights/page.tsx` — Insights Feed/Listing (REWRITE)
Current state: file incorrectly contains an old "New Insight" form.
New design: **light-theme feed page** using the `Header` component.

Layout:
- **Hero bar**: Title "球探报告" / "Scout Reports", subtitle, + "发布笔记" button (logged-in users only)
- **Filter tabs**: All / 选秀策略 / 球员分析 / 交易建议 / 新手指南 (tag filter)
- **Masonry/grid of insight cards** (3-column), each card shows:
  - Cover image (aspect-ratio 4:5)
  - Title
  - Tags (colored pills)
  - Author avatar + username
  - Date, ❤️ heat count
  - Click → `/insights/[id]`
- Loading skeleton state
- Empty state with CTA to create first post
- Uses `listInsights()` from store, `useLang()` for bilingual support

### 2b. `app/insights/new/page.tsx` — Post Editor (REDESIGN to light theme)
Current state: dark theme (`background: #0a0a0a`).
New design: **light theme** matching the mockup.

Changes:
- Background: `#f8fafc` / white
- Cards: white with subtle borders and shadow
- Text: `#0f172a` / `#64748b`
- Buttons: navy `#1e3a8a` primary, `#e2e8f0` borders
- Upload zone: light dashed border on `#f8fafc`
- Title input, body textarea: white bg, `#e2e8f0` border
- Tags: light pills matching the rest of the site

### 2c. `app/insights/[id]/page.tsx` — Detail Page (REDESIGN to light theme)
Current state: dark theme.
New design: **light theme** — white background, navy text, blue accents.

Changes:
- Container: white background, `#e2e8f0` borders
- Left panel (image viewer): `#f8fafc` background
- Right panel: white background, dark text
- Comment form: light inputs
- Author avatar: navy gradient instead of amber

---

## Execution Order
1. Translation fixes (quick, 5 edits)
2. Rewrite `insights/page.tsx` (new feed page)
3. Redesign `insights/new/page.tsx` (light theme)
4. Redesign `insights/[id]/page.tsx` (light theme)
5. Run `npm run dev` locally for user review
6. After approval → commit & push to `claude/plan-mode-Wht37`
