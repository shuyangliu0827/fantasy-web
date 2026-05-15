import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Legacy /contest URLs (when NBA was the only contest) -> new /contest/nba/*.
    // Query strings (?id=, ?week_start=, etc.) are preserved automatically.
    return [
      { source: "/contest",             destination: "/contest/nba/build",       permanent: false },
      { source: "/contest/leaderboard", destination: "/contest/nba/leaderboard", permanent: false },
      { source: "/contest/weekly",      destination: "/contest/nba/weekly",      permanent: false },
      { source: "/contest/all-time",    destination: "/contest/nba/all-time",    permanent: false },
      { source: "/contest/my-lineup",   destination: "/contest/nba/my-lineup",   permanent: false },
      { source: "/contest/other-leagues", destination: "/community-leagues",    permanent: false },
      { source: "/contest/leagues",       destination: "/community-leagues",    permanent: false },
    ];
  },
};

export default nextConfig;
