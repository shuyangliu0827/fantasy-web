export const dynamic = "force-dynamic";
// app/api/draft/route.ts
// 选秀系统API

import { NextResponse } from "next/server";
import { getCurrentSeasonYear } from "@/lib/season";

// 临时内存存储 - 生产环境应使用真实数据库
// 这里使用简化的内存结构来演示逻辑
const leagues: Map<string, any> = new Map();
const draftRooms: Map<string, any> = new Map();

// 初始化示例联赛
if (leagues.size === 0) {
  leagues.set("league1", {
    id: "league1",
    name: "NICETRYDIDDY",
    commissioner_id: "user1",
    status: "draft_pending", // draft_pending, drafting, active, completed
    max_teams: 10,
    draft_type: "snake", // snake, linear
    season: String(getCurrentSeasonYear()),
    teams: [
      { id: "team1", user_id: "user1", team_name: "abcd", draft_position: 1, roster: [] },
      { id: "team2", user_id: "user2", team_name: "h75yin", draft_position: 2, roster: [] },
      { id: "team3", user_id: "user3", team_name: "yiweikedajinbei", draft_position: 3, roster: [] },
      { id: "team4", user_id: "user4", team_name: "xujiheng66", draft_position: 4, roster: [] },
    ],
  });
}

// 计算蛇形选秀的选秀顺序
function getSnakeDraftOrder(round: number, numTeams: number, position: number): number {
  if (round % 2 === 1) {
    // 奇数轮：正序 (1, 2, 3, 4...)
    return position;
  } else {
    // 偶数轮：倒序 (4, 3, 2, 1...)
    return numTeams - position + 1;
  }
}

// 计算当前应该选秀的队伍
function getCurrentDraftingTeam(leagueId: string): any {
  const draftRoom = draftRooms.get(leagueId);
  if (!draftRoom) return null;

  const { current_round, current_pick, teams } = draftRoom;
  const numTeams = teams.length;

  // 计算当前轮次应该选秀的位置
  const pickPosition = getSnakeDraftOrder(current_round, numTeams, current_pick);
  
  // 找到对应位置的队伍
  return teams.find((t: any) => t.draft_position === pickPosition);
}

// GET: 获取联赛选秀信息
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const leagueId = searchParams.get("leagueId");
  const userId = searchParams.get("userId");

  try {
    // 获取联赛信息
    if (action === "league_info" && leagueId) {
      const league = leagues.get(leagueId);
      if (!league) {
        return NextResponse.json({ error: "League not found" }, { status: 404 });
      }

      return NextResponse.json({
        status: "success",
        league: {
          id: league.id,
          name: league.name,
          status: league.status,
          max_teams: league.max_teams,
          current_teams: league.teams.length,
          draft_type: league.draft_type,
          teams: league.teams.map((t: any) => ({
            id: t.id,
            team_name: t.team_name,
            draft_position: t.draft_position,
            roster_size: t.roster.length,
          })),
        },
      });
    }

    // 获取选秀房间状态
    if (action === "draft_room" && leagueId) {
      const draftRoom = draftRooms.get(leagueId);
      if (!draftRoom) {
        return NextResponse.json({ error: "Draft room not found" }, { status: 404 });
      }

      const currentTeam = getCurrentDraftingTeam(leagueId);

      return NextResponse.json({
        status: "success",
        draft_room: {
          league_id: draftRoom.league_id,
          current_round: draftRoom.current_round,
          current_pick: draftRoom.current_pick,
          total_rounds: draftRoom.total_rounds,
          current_team: currentTeam,
          is_paused: draftRoom.is_paused,
          picks: draftRoom.picks,
          seconds_per_pick: draftRoom.seconds_per_pick,
          pick_deadline: draftRoom.pick_deadline,
        },
      });
    }

    // 获取我的球队信息
    if (action === "my_team" && leagueId && userId) {
      const league = leagues.get(leagueId);
      if (!league) {
        return NextResponse.json({ error: "League not found" }, { status: 404 });
      }

      const myTeam = league.teams.find((t: any) => t.user_id === userId);
      if (!myTeam) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 });
      }

      return NextResponse.json({
        status: "success",
        team: {
          id: myTeam.id,
          team_name: myTeam.team_name,
          draft_position: myTeam.draft_position,
          roster: myTeam.roster,
        },
      });
    }

    // 获取所有已选球员
    if (action === "drafted_players" && leagueId) {
      const draftRoom = draftRooms.get(leagueId);
      if (!draftRoom) {
        return NextResponse.json({ drafted_players: [] });
      }

      return NextResponse.json({
        status: "success",
        drafted_players: draftRoom.picks.map((p: any) => p.player_id),
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Draft GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: 选秀操作
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, leagueId, userId, teamId, player } = body;

    // 加入选秀
    if (action === "join_draft") {
      const league = leagues.get(leagueId);
      if (!league) {
        return NextResponse.json({ error: "League not found" }, { status: 404 });
      }

      // 检查联赛是否已满
      if (league.teams.length >= league.max_teams) {
        return NextResponse.json({ error: "League is full" }, { status: 400 });
      }

      // 检查用户是否已加入
      const existingTeam = league.teams.find((t: any) => t.user_id === userId);
      if (existingTeam) {
        return NextResponse.json({ error: "Already joined this league" }, { status: 400 });
      }

      // 创建新队伍
      const newTeam = {
        id: `team${league.teams.length + 1}`,
        user_id: userId,
        team_name: body.teamName || `Team ${league.teams.length + 1}`,
        draft_position: league.teams.length + 1,
        roster: [],
      };

      league.teams.push(newTeam);
      leagues.set(leagueId, league);

      return NextResponse.json({
        status: "success",
        message: "Successfully joined the draft",
        team: newTeam,
      });
    }

    // 开始选秀
    if (action === "start_draft") {
      const league = leagues.get(leagueId);
      if (!league) {
        return NextResponse.json({ error: "League not found" }, { status: 404 });
      }

      // 检查是否是管理员
      if (league.commissioner_id !== userId) {
        return NextResponse.json({ error: "Only commissioner can start the draft" }, { status: 403 });
      }

      // 检查队伍数量（必须是偶数且至少2支）
      if (league.teams.length < 2 || league.teams.length % 2 !== 0) {
        return NextResponse.json({ error: "Need an even number of teams (min 2) to start draft" }, { status: 400 });
      }

      // 创建选秀房间
      const totalRounds = 13; // 每队选13名球员
      const draftRoom = {
        league_id: leagueId,
        current_round: 1,
        current_pick: 1,
        total_rounds: totalRounds,
        teams: league.teams,
        picks: [],
        is_paused: false,
        started_at: new Date().toISOString(),
        seconds_per_pick: 90,
        pick_deadline: new Date(Date.now() + 90000).toISOString(), // 90秒后
      };

      draftRooms.set(leagueId, draftRoom);
      league.status = "drafting";
      leagues.set(leagueId, league);

      return NextResponse.json({
        status: "success",
        message: "Draft started",
        draft_room: draftRoom,
      });
    }

    // 选择球员
    if (action === "pick_player") {
      const draftRoom = draftRooms.get(leagueId);
      if (!draftRoom) {
        return NextResponse.json({ error: "Draft room not found" }, { status: 404 });
      }

      const league = leagues.get(leagueId);
      if (!league) {
        return NextResponse.json({ error: "League not found" }, { status: 404 });
      }

      // 检查是否轮到该队伍选秀
      const currentTeam = getCurrentDraftingTeam(leagueId);
      if (!currentTeam || currentTeam.id !== teamId) {
        return NextResponse.json({ error: "Not your turn to pick" }, { status: 400 });
      }

      // 检查球员是否已被选
      const alreadyPicked = draftRoom.picks.find((p: any) => p.player_id === player.id);
      if (alreadyPicked) {
        return NextResponse.json({ error: "Player already drafted" }, { status: 400 });
      }

      // 记录选秀
      const overallPick = (draftRoom.current_round - 1) * league.teams.length + 
                          getSnakeDraftOrder(draftRoom.current_round, league.teams.length, draftRoom.current_pick) - 1 + 1;
      
      const pick = {
        team_id: teamId,
        team_name: currentTeam.team_name,
        player_id: player.id,
        player_name: player.name,
        player_team: player.team,
        player_position: player.position,
        round: draftRoom.current_round,
        pick_number: draftRoom.current_pick,
        overall_pick: overallPick,
        picked_at: new Date().toISOString(),
      };

      draftRoom.picks.push(pick);

      // 添加到队伍阵容
      const team = league.teams.find((t: any) => t.id === teamId);
      if (team) {
        team.roster.push({
          player_id: player.id,
          player_name: player.name,
          player_team: player.team,
          player_position: player.position,
          acquisition_type: "draft",
        });
      }

      // 更新选秀进度
      draftRoom.current_pick++;
      if (draftRoom.current_pick > league.teams.length) {
        draftRoom.current_pick = 1;
        draftRoom.current_round++;
      }

      // 检查选秀是否结束
      if (draftRoom.current_round > draftRoom.total_rounds) {
        league.status = "active";
        draftRoom.completed_at = new Date().toISOString();
        leagues.set(leagueId, league);
      }

      // 更新下一次选秀截止时间
      draftRoom.pick_deadline = new Date(Date.now() + draftRoom.seconds_per_pick * 1000).toISOString();

      draftRooms.set(leagueId, draftRoom);
      leagues.set(leagueId, league);

      return NextResponse.json({
        status: "success",
        message: "Player drafted successfully",
        pick,
        next_team: getCurrentDraftingTeam(leagueId),
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Draft POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
