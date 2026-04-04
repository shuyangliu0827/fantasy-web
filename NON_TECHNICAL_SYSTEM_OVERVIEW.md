# Blueprint Fantasy — System Overview
_For Founders, Operators, and Non-Technical Stakeholders_
_Updated: 2026-04-04_

---

## What Is Blueprint Fantasy?

Blueprint Fantasy is a bilingual (English + Chinese) fantasy basketball platform. Users join private leagues, draft real NBA players onto their team, set a daily lineup, and compete head-to-head each week based on how their players actually perform in real NBA games.

The app is live at a web address, deployed on Vercel (a cloud hosting service), and stores all data in Supabase (a cloud database service). NBA game data is pulled in real time from an external provider called Ball Don't Lie.

---

## What Recently Broke and Why

### The symptom (March–April 2026)

After a code update, the Roster page stopped showing live game data. Every player showed `--` in the "opponent" column and the stats columns (points, rebounds, assists), even during games. The rest of the app — standings, season averages, drafts — continued working normally.

### Two separate root causes were identified

**Root Cause 1: Missing password in the wrong place**

The app uses a paid external NBA data service (Ball Don't Lie). Accessing it requires a secret password called an API key. This key must be stored in two separate places:

- In the cloud database (Supabase) — for the background stats updater
- In the web host (Vercel) — for the live data fetcher

A previous developer had the key correctly stored in the database but had never set it in the web host. The background stats updater worked fine. But the live data fetcher — the part of the system that populates the opponent and stats columns — silently failed every time it tried to reach the NBA data provider.

**Fix:** The key was manually added to the Vercel web host settings.

**Root Cause 2: The app was using the wrong clock**

The NBA data provider (Ball Don't Lie) organizes game data by date using US Eastern time. The app was looking up data using an international reference clock (UTC), which runs ahead of US local time. After about 7 PM US Central time, the international clock had already rolled to the next day. So the app was asking "show me games for April 5th" while the data was still filed under April 4th.

This caused all schedule and stats lookups to fail silently in the evening hours — right when many users are actively managing their lineups.

**Fix:** The app was updated to always use local time when looking up game schedules and stats.

---

## How the System Works

### The three-layer architecture

```
LAYER 1: External NBA Data Source
  Ball Don't Lie — provides game schedules, live scores, player stats
  (Independent company; requires paid subscription and API key)

LAYER 2: Backend (data processing and storage)
  Supabase — the database; stores everything permanently
  Vercel — runs the app code; fetches live data when users open pages

LAYER 3: Frontend (what users see)
  The web app pages — Roster, Rankings, Matchup, Free Agents, etc.
```

---

### The two data update jobs

The app has two completely separate jobs for pulling NBA data. Understanding the difference between them is important for diagnosing problems.

---

#### Job 1: The Hourly Stats Updater

**What it does:**
Every hour, a small program running inside the database automatically fetches season-average statistics for all ~600 active NBA players. For each player it records: points per game, rebounds per game, assists, steals, blocks, turnovers, shooting efficiency, and a pre-calculated "fantasy points per game" figure.

**Where it runs:** Inside the database server (Supabase), not the web host.

**What it powers:** The season average column on your roster, player rankings, the free agent pool, and the compare tool.

**What it does NOT do:** It does not fetch live game schedules or box scores.

**If this breaks:** Season averages will slowly go stale (8+ hours before a complete cycle). Users will see old numbers. Rankings and free agent evaluations will be less accurate. Live scores and opponent info continue working normally.

**Required credential:** The BDL API key stored in **Supabase database secrets**.

---

#### Job 2: The Live Game Fetcher

**What it does:**
Every time a user opens their roster page, the app immediately contacts the NBA data provider to get:
- This week's game schedule (who plays who, on what day, what's the score right now)
- Today's individual box score stats (how many points/rebounds/assists each player has so far)

**Where it runs:** On the web host (Vercel), triggered by the user's browser.

**What it powers:** The opponent column, live stats columns, and the lineup lock (which prevents moving players whose game has already started).

**What it does NOT do:** It does not compute season averages or maintain the player database.

**If this breaks:** All live columns show `--`. Users cannot see opponents or live stats. Season averages continue showing correctly.

**Required credential:** The BDL API key stored in **Vercel web host settings**.

---

### The critical "two passwords" rule

The app needs the same Ball Don't Lie API key set in two different places. These are completely independent — one being set does not affect the other.

| Who needs it | Where to set it | What breaks without it |
|---|---|---|
| Background stats updater | Supabase Dashboard → Edge Functions → Secrets | Season averages go stale |
| Live game fetcher | Vercel Dashboard → Settings → Environment Variables | Live opponent + stats columns show `--` |

**If the API key ever changes or is renewed: it must be updated in BOTH places.**

---

## How Your Fantasy Score Is Calculated

When an NBA game is played:

1. Ball Don't Lie records the box score: LeBron scored 30 points, 8 rebounds, 9 assists.

2. The app applies the ESPN scoring formula to those numbers:
   - 1 point for each point scored
   - 2 points for each field goal made
   - −1 point for each field goal attempt (efficiency penalty)
   - 2 points for each assist
   - 4 points for each steal
   - 4 points for each block
   - −2 points for each turnover
   - (Plus adjustments for free throw efficiency and three-pointers)

3. Those converted "fantasy points" accumulate throughout the week.

4. At the end of the week (Sunday midnight), your total is compared to your opponent's total. Higher total wins.

**Only players in your starting lineup count.** Bench players score zero, even if they play. The app allows you to change your lineup daily, but locks you out once a player's game starts.

---

## System Map

```
Real NBA Games Happen
        ↓
Ball Don't Lie (external website, paid subscription)
  collects all game data
        │
        ├──────────────────────────────────────────────────┐
        │                                                  │
        ↓ (every hour, runs automatically)                 ↓ (when any user opens roster page)
─────────────────────────────────        ──────────────────────────────────────
Background Stats Updater                 Live Game Fetcher
(runs inside Supabase database)          (runs on Vercel web host)
        │                                                  │
        ↓                                                  │
Season Average Database                    ┌──────────────┴─────────────────┐
(player_stats_cache table)                 │                                │
        │                         Game Schedule              Box Score Stats
        │                         (this week's matchups)     (today's player stats)
        │                                  │                                │
        │                                  └──────────────┬─────────────────┘
        │                                                  │
        └──────────────────────────┬───────────────────────┘
                                   ↓
                          Roster Page Shows:
                          - Season average (FPTS/G)
                          - Today's opponent
                          - Live stats (PTS/REB/AST)
                          - Injury status
                          - Lineup lock state
```

---

## What Each Page Does

| Page | What it shows | Data freshness |
|---|---|---|
| **Roster** | Your team, today's matchups, live stats, lineup | Updated every 5 minutes during games |
| **Scoreboard** | Weekly matchup results | End-of-week final |
| **Matchup Detail** | Player-by-player weekly breakdown | Historical |
| **Standings** | League W/L/PF/PA table | Always recomputed from results |
| **Free Agents** | Unsigned players with stats | Updated hourly |
| **Trade** | Propose/accept player trades | Real-time |
| **Draft Room** | Live draft interface | Real-time sync across browsers |
| **Rankings** | All players ranked by fantasy value | Updated hourly |
| **Compare** | Head-to-head player analysis | Season + recent games |

---

## Current System Health (as of April 4, 2026)

| Area | Status | Notes |
|---|---|---|
| Live game data (opponent + stats) | ✅ Fixed | Root cause was missing Vercel API key + UTC date bug |
| Season averages | ✅ Working | Supabase hourly updater running normally |
| Standings computation | ✅ Working | Always recomputed from match records |
| All logic tests | ✅ 66/66 pass | Scoring engine, lineup, roster history all verified |
| Core code quality | ✅ Clean | Business-critical library files have zero lint issues |
| Broader code quality | ⚠️ Known debt | ~161 style/type warnings in older parts of the app — no user impact |

---

## Risk Register (Plain English)

### Highest risks (would break the app)

| Risk | How it could happen | How to catch it |
|---|---|---|
| Ball Don't Lie API key expires or is rotated | Annual subscription renewal, security rotation | Check Vercel env vars AND Supabase secrets after any key change |
| Vercel API key missing after new deployment | Re-deployment without verifying env vars | Check opponent column works after every deploy |
| Hourly updater stops running | Supabase infrastructure issue, disabled cron | Check if season averages are >4 hours old |

### Medium risks (degraded experience)

| Risk | Effect | Check |
|---|---|---|
| Ball Don't Lie API is down | Live data unavailable temporarily | BDL status page |
| NBA Finals end date not updated each season | Week selector stops expanding at wrong time | Update `NBA_FINALS_END_UTC` each October |

### Lower risks (maintenance debt, no immediate impact)

| Item | Notes |
|---|---|
| ~161 code style warnings | In older, less-used parts of the codebase. No user impact. |
| Scoring formula copied in two places | If formula ever changes, both copies must be updated manually |
| Draft state in browser memory | Power outage during draft could require page reload; picks are recoverable from saved state |

---

## Key Operational Rules (No Coding Required)

1. **If you rotate the Ball Don't Lie API key**, update it in Vercel AND Supabase. One will not update the other.

2. **After any deployment**, open the Roster page and check that the opponent column shows team names (not `--`).

3. **Each October** before the new NBA season, remind the engineering team to update the "season end date" setting. If this isn't done, the week counter will behave incorrectly in late May/June.

4. **If users report stats not updating**, check the hourly updater first — this is the most common failure point.

5. **If users report "everything shows --"**, the Vercel API key is missing or wrong. Check immediately.

---

## Glossary

| Term | What it means |
|---|---|
| **API** | A connection between two software systems — like a phone line for computers |
| **API key** | A secret password that proves you're allowed to use an external service |
| **Supabase** | The cloud database service — stores all league, roster, and stats data permanently |
| **Vercel** | The web hosting service — runs the app code that users interact with |
| **Edge Function** | A small background program running on the database server on a timer |
| **pg_cron** | The timer that triggers the background program every hour |
| **Ball Don't Lie (BDL)** | The third-party NBA statistics provider the app pays for |
| **TTL cache** | A temporary memory store that holds recent results for a few minutes to avoid redundant external calls |
| **UTC** | An international reference clock (also called "Greenwich time") — runs ahead of US time |
| **Deploy** | Publishing a new version of the app code to the web host |
| **JSONB** | A flexible data format that stores a structured list (like a spreadsheet in a single cell) |
| **Lineup lock** | A rule preventing managers from moving players once their game starts |
