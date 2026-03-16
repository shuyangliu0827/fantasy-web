# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Production build
npm start        # Run production server
npm run lint     # Run ESLint
```

## Architecture Overview

**Fantasy Basketball Platform** - A Next.js application for fantasy basketball league management with real NBA statistics integration.

### Tech Stack
- **Framework**: Next.js 16 (App Router) with React 19 and TypeScript
- **Styling**: Tailwind CSS 4 + inline `<style jsx>` (scoped CSS)
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **External API**: Ball Don't Lie API for real NBA player statistics

### Directory Structure
```
/app
  ├── api/draft/          # Draft system API (in-memory state)
  ├── api/nba-stats/      # NBA stats caching (30-min TTL)
  ├── auth/               # Login/signup pages
  ├── league/[slug]/      # League pages (board, members, schedule, scoreboard, settings, standings)
  ├── insights/           # Community posts with multi-image support
  ├── rankings/           # Player rankings
  ├── compare/            # Player comparison tool
  ├── mock-draft/         # Practice draft tool
  └── my-team/            # User team management

/lib
  ├── supabase.ts         # Supabase client & type definitions
  ├── store.ts            # Main state management (Supabase + localStorage hybrid)
  ├── session.ts          # Session management hooks
  ├── lang.tsx            # i18n context (Chinese/English)
  ├── balldontlie.ts      # Ball Don't Lie API wrapper
  └── players-data.ts     # Fallback NBA player data
```

### Data Storage Strategy
- **Supabase**: Users, insights, comments, leagues, memberships
- **localStorage**: Session (`bp_user`), language (`bp_lang`), drafts, watchlist, team rosters
- **In-memory**: Draft room state during active drafts

## Key Patterns

### Bilingual Support (i18n)
```typescript
const { t, lang } = useLang()
// Usage: t("中文文本", "English text")
```

### Authentication
```typescript
import { getSessionUser, login, signup } from "@/lib/store"
// Session stored in localStorage, synced with Supabase
```

### API Routes
- GET for fetching, POST for mutations
- Actions via query string: `?action=league_info&leagueId=123`

### Fantasy Scoring
Player stats: PPG, RPG, APG, SPG, BPG, FG%, FT%, TOV
Scoring weights configurable per league (steals/blocks 2x, turnovers negative)

### Draft Types
- Snake draft: Alternating order each round
- Linear draft: Same order every round
- Use `getSnakeDraftOrder(round, numTeams, position)` for pick calculations

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Code Conventions

- All page components use `"use client"` directive
- Dark theme: amber/gold accents (#f59e0b), dark backgrounds (#0a0a0a, #111)
- Path alias: `@/*` maps to project root
- Supabase types defined in `/lib/supabase.ts`
- CRUD operations in `/lib/store.ts`
