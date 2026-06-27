export interface League {
  id: string
  name: string
  season: string
  startDate: string
  endDate: string
  description: string
  logoUrl: string
  organizer: string
  contactPhone: string
  venue: string
}

export type GameStatus = 'upcoming' | 'live' | 'finished'

export interface Game {
  id: string
  leagueId: string
  homeTeamId: string
  awayTeamId: string
  homeTeamName: string
  awayTeamName: string
  homeScore: number | null
  awayScore: number | null
  date: string
  time: string
  venue: string
  status: GameStatus
  week?: number
  round?: string
}

export interface PlayerStats {
  gamesPlayed: number
  pointsPerGame: number
  reboundsPerGame: number
  assistsPerGame: number
  stealsPerGame: number
  blocksPerGame: number
  fieldGoalPct: number
  threePointPct: number
  freeThrowPct: number
}

export interface Player {
  id: string
  name: string
  number: string
  teamId: string
  teamName: string
  position: 'PG' | 'SG' | 'SF' | 'PF' | 'C'
  height: string
  weight: string
  age: number
  avatarUrl: string
  stats: PlayerStats
}

export interface Team {
  id: string
  name: string
  shortName: string
  logoUrl: string
  coachName: string
  wins: number
  losses: number
  description?: string
  players?: Player[]
  games?: Game[]
}

export interface Standing {
  rank: number
  teamId: string
  teamName: string
  wins: number
  losses: number
  winPct: number
  pointsFor: number
  pointsAgainst: number
  streak: string
  last5: Array<'W' | 'L'>
}

export interface Announcement {
  id: string
  title: string
  content: string
  createdAt: string
  authorName: string
  isPinned: boolean
  tags: string[]
}

export interface User {
  id: string
  openId: string
  nickName: string
  avatarUrl: string
  boundPlayerId?: string
  boundPlayerName?: string
  boundTeamId?: string
  boundTeamName?: string
  role: 'parent' | 'player' | 'coach' | 'admin'
}

export interface Comment {
  id: string
  postId: string
  authorId: string
  authorName: string
  authorAvatarUrl: string
  content: string
  createdAt: string
  likeCount: number
}

export interface Post {
  id: string
  authorId: string
  authorName: string
  authorAvatarUrl: string
  title: string
  content: string
  imageUrls: string[]
  createdAt: string
  likeCount: number
  commentCount: number
  tags: string[]
  comments?: Comment[]
}
