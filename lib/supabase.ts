// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ====================================
// 类型定义
// ====================================

export type League = {
  id: string
  name: string
  commissioner_id: string
  season: string
  status: 'draft_pending' | 'drafting' | 'active' | 'completed'
  max_teams: number
  draft_type: 'snake' | 'linear'
  draft_date?: string
  scoring_type: string
  created_at: string
  updated_at: string
}

export type Team = {
  id: string
  league_id: string
  user_id: string
  team_name: string
  wins: number
  losses: number
  ties: number
  total_points: number
  draft_position: number
  created_at: string
}

export type DraftSettings = {
  id: string
  league_id: string
  draft_type: 'snake' | 'linear'
  seconds_per_pick: number
  current_pick: number
  current_round: number
  total_rounds: number
  is_paused: boolean
  started_at?: string
  completed_at?: string
  created_at: string
}

export type DraftPick = {
  id: string
  league_id: string
  team_id: string
  player_id: number
  player_name: string
  player_team: string
  player_position: string
  round: number
  pick_number: number
  overall_pick: number
  picked_at: string
}

export type TeamRoster = {
  id: string
  team_id: string
  player_id: number
  player_name: string
  player_team: string
  player_position: string
  acquisition_type: 'draft' | 'waiver' | 'trade'
  is_active: boolean
  acquired_at: string
}

export type Matchup = {
  id: string
  league_id: string
  week: number
  team1_id: string
  team2_id: string
  team1_points: number
  team2_points: number
  winner_id?: string
  status: 'scheduled' | 'in_progress' | 'completed'
  week_start_date: string
  week_end_date: string
  created_at: string
}

// ====================================
// 辅助函数
// ====================================

/**
 * 获取当前用户
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

/**
 * 计算蛇形选秀顺序
 */
export function getSnakeDraftOrder(round: number, numTeams: number, position: number): number {
  if (round % 2 === 1) {
    // 奇数轮：正序
    return position
  } else {
    // 偶数轮：倒序
    return numTeams - position + 1
  }
}

/**
 * 计算当前应该选秀的队伍
 */
export async function getCurrentDraftingTeam(leagueId: string) {
  // 1. 获取选秀设置
  const { data: draftSettings, error: settingsError } = await supabase
    .from('draft_settings')
    .select('*')
    .eq('league_id', leagueId)
    .single()

  if (settingsError || !draftSettings) return null

  // 2. 获取所有队伍
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('*')
    .eq('league_id', leagueId)
    .order('draft_position', { ascending: true })

  if (teamsError || !teams) return null

  // 3. 计算当前应该选秀的位置
  const pickPosition = getSnakeDraftOrder(
    draftSettings.current_round,
    teams.length,
    draftSettings.current_pick
  )

  // 4. 找到对应的队伍
  return teams.find(t => t.draft_position === pickPosition)
}

/**
 * 检查是否轮到某个队伍选秀
 */
export async function isMyTurn(leagueId: string, teamId: string): Promise<boolean> {
  const currentTeam = await getCurrentDraftingTeam(leagueId)
  return currentTeam?.id === teamId
}

/**
 * 获取联赛的所有已选球员ID
 */
export async function getDraftedPlayerIds(leagueId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('draft_picks')
    .select('player_id')
    .eq('league_id', leagueId)

  if (error) throw error
  return data?.map(p => p.player_id) || []
}

// ====================================
// Realtime订阅辅助函数
// ====================================

/**
 * 订阅选秀房间更新
 */
export function subscribeToDraftRoom(
  leagueId: string,
  onUpdate: (payload: any) => void
) {
  const channel = supabase
    .channel(`draft_room_${leagueId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'draft_picks',
        filter: `league_id=eq.${leagueId}`,
      },
      onUpdate
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'draft_settings',
        filter: `league_id=eq.${leagueId}`,
      },
      onUpdate
    )
    .subscribe()

  return channel
}

/**
 * 订阅联赛更新
 */
export function subscribeToLeague(
  leagueId: string,
  onUpdate: (payload: any) => void
) {
  const channel = supabase
    .channel(`league_${leagueId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'leagues',
        filter: `id=eq.${leagueId}`,
      },
      onUpdate
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'teams',
        filter: `league_id=eq.${leagueId}`,
      },
      onUpdate
    )
    .subscribe()

  return channel
}

/**
 * 订阅球队阵容更新
 */
export function subscribeToTeamRoster(
  teamId: string,
  onUpdate: (payload: any) => void
) {
  const channel = supabase
    .channel(`team_roster_${teamId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'team_rosters',
        filter: `team_id=eq.${teamId}`,
      },
      onUpdate
    )
    .subscribe()

  return channel
}

// ====================================
// 数据库操作封装
// ====================================

/**
 * 创建联赛
 */
export async function createLeague(data: {
  name: string
  max_teams?: number
  draft_type?: 'snake' | 'linear'
}) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')

  const { data: league, error } = await supabase
    .from('leagues')
    .insert({
      name: data.name,
      commissioner_id: user.id,
      max_teams: data.max_teams || 10,
      draft_type: data.draft_type || 'snake',
    })
    .select()
    .single()

  if (error) throw error

  // 创建选秀设置
  await supabase
    .from('draft_settings')
    .insert({
      league_id: league.id,
      draft_type: data.draft_type || 'snake',
    })

  return league
}

/**
 * 加入联赛
 */
export async function joinLeague(leagueId: string, teamName: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')

  // 1. 检查联赛是否存在和是否已满
  const { data: league, error: leagueError } = await supabase
    .from('leagues')
    .select('*, teams:teams(count)')
    .eq('id', leagueId)
    .single()

  if (leagueError) throw leagueError
  if (!league) throw new Error('League not found')

  const currentTeams = league.teams[0]?.count || 0
  if (currentTeams >= league.max_teams) {
    throw new Error('League is full')
  }

  // 2. 检查是否已加入
  const { data: existingTeam } = await supabase
    .from('teams')
    .select('id')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .single()

  if (existingTeam) {
    throw new Error('Already joined this league')
  }

  // 3. 创建队伍
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .insert({
      league_id: leagueId,
      user_id: user.id,
      team_name: teamName,
      draft_position: currentTeams + 1,
    })
    .select()
    .single()

  if (teamError) throw teamError
  return team
}

/**
 * 开始选秀
 */
export async function startDraft(leagueId: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')

  // 1. 检查是否是管理员
  const { data: league, error: leagueError } = await supabase
    .from('leagues')
    .select('commissioner_id')
    .eq('id', leagueId)
    .single()

  if (leagueError) throw leagueError
  if (league.commissioner_id !== user.id) {
    throw new Error('Only commissioner can start the draft')
  }

  // 2. 更新联赛状态
  await supabase
    .from('leagues')
    .update({ status: 'drafting' })
    .eq('id', leagueId)

  // 3. 更新选秀设置
  await supabase
    .from('draft_settings')
    .update({ started_at: new Date().toISOString() })
    .eq('league_id', leagueId)
}

/**
 * 选择球员
 */
export async function pickPlayer(
  leagueId: string,
  teamId: string,
  player: {
    id: number
    name: string
    team: string
    position: string
  }
) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')

  // 1. 检查是否轮到该队伍
  const currentTeam = await getCurrentDraftingTeam(leagueId)
  if (!currentTeam || currentTeam.id !== teamId) {
    throw new Error('Not your turn to pick')
  }

  // 2. 检查球员是否已被选
  const { data: existingPick } = await supabase
    .from('draft_picks')
    .select('id')
    .eq('league_id', leagueId)
    .eq('player_id', player.id)
    .single()

  if (existingPick) {
    throw new Error('Player already drafted')
  }

  // 3. 获取选秀设置
  const { data: draftSettings } = await supabase
    .from('draft_settings')
    .select('*')
    .eq('league_id', leagueId)
    .single()

  if (!draftSettings) throw new Error('Draft settings not found')

  // 4. 获取队伍数量
  const { count: teamCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('league_id', leagueId)

  const numTeams = teamCount || 0

  // 5. 计算overall pick
  const overallPick = 
    (draftSettings.current_round - 1) * numTeams +
    getSnakeDraftOrder(draftSettings.current_round, numTeams, draftSettings.current_pick)

  // 6. 记录选秀（使用事务）
  const { data: pick, error: pickError } = await supabase
    .from('draft_picks')
    .insert({
      league_id: leagueId,
      team_id: teamId,
      player_id: player.id,
      player_name: player.name,
      player_team: player.team,
      player_position: player.position,
      round: draftSettings.current_round,
      pick_number: draftSettings.current_pick,
      overall_pick: overallPick,
    })
    .select()
    .single()

  if (pickError) throw pickError

  // 7. 添加到阵容
  await supabase
    .from('team_rosters')
    .insert({
      team_id: teamId,
      player_id: player.id,
      player_name: player.name,
      player_team: player.team,
      player_position: player.position,
      acquisition_type: 'draft',
    })

  // 8. 更新选秀进度
  let newPick = draftSettings.current_pick + 1
  let newRound = draftSettings.current_round

  if (newPick > numTeams) {
    newPick = 1
    newRound = newRound + 1
  }

  const updateData: any = {
    current_pick: newPick,
    current_round: newRound,
  }

  // 检查是否完成
  if (newRound > draftSettings.total_rounds) {
    updateData.completed_at = new Date().toISOString()
    
    // 更新联赛状态为active
    await supabase
      .from('leagues')
      .update({ status: 'active' })
      .eq('id', leagueId)
  }

  await supabase
    .from('draft_settings')
    .update(updateData)
    .eq('league_id', leagueId)

  return pick
}