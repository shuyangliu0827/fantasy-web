import Taro from '@tarojs/taro'
import type { League, Team, Player, Game, Standing, Announcement, Post } from '../types/league'
import {
  mockLeague,
  mockTeams,
  mockPlayers,
  mockGames,
  mockStandings,
  mockAnnouncements,
  mockPosts,
} from '../mock/leagueData'

export const API_BASE_URL = 'https://blueprintfantasy.com'

// Flip to false when real backend APIs are ready
const USE_MOCK = true

async function request<T>(path: string, options?: Partial<Taro.request.Option>): Promise<T> {
  const token = Taro.getStorageSync('bp_mp_token')
  const res = await Taro.request({
    url: `${API_BASE_URL}${path}`,
    header: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  })
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`API error ${res.statusCode}: ${path}`)
  }
  return res.data as T
}

function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchLeague(): Promise<League> {
  if (USE_MOCK) {
    await delay()
    return mockLeague
  }
  return request<League>('/api/mp/league')
}

export async function fetchTeams(): Promise<Team[]> {
  if (USE_MOCK) {
    await delay()
    return mockTeams
  }
  return request<Team[]>('/api/mp/teams')
}

export async function fetchTeamById(id: string): Promise<Team> {
  if (USE_MOCK) {
    await delay()
    const team = mockTeams.find((t) => t.id === id)
    if (!team) throw new Error(`Team not found: ${id}`)
    return {
      ...team,
      players: mockPlayers.filter((p) => p.teamId === id),
      games: mockGames.filter((g) => g.homeTeamId === id || g.awayTeamId === id),
    }
  }
  return request<Team>(`/api/mp/teams/${id}`)
}

export async function fetchGames(): Promise<Game[]> {
  if (USE_MOCK) {
    await delay()
    return mockGames
  }
  return request<Game[]>('/api/mp/games')
}

export async function fetchPlayerById(id: string): Promise<Player> {
  if (USE_MOCK) {
    await delay()
    const player = mockPlayers.find((p) => p.id === id)
    if (!player) throw new Error(`Player not found: ${id}`)
    return player
  }
  return request<Player>(`/api/mp/players/${id}`)
}

export async function fetchStandings(): Promise<Standing[]> {
  if (USE_MOCK) {
    await delay()
    return mockStandings
  }
  return request<Standing[]>('/api/mp/standings')
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  if (USE_MOCK) {
    await delay()
    return mockAnnouncements.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }
  return request<Announcement[]>('/api/mp/announcements')
}

export async function fetchPosts(): Promise<Post[]> {
  if (USE_MOCK) {
    await delay()
    return mockPosts.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }
  return request<Post[]>('/api/mp/community/posts')
}

export async function fetchPostById(id: string): Promise<Post> {
  if (USE_MOCK) {
    await delay()
    const post = mockPosts.find((p) => p.id === id)
    if (!post) throw new Error(`Post not found: ${id}`)
    return post
  }
  return request<Post>(`/api/mp/community/posts/${id}`)
}

export async function createPost(data: {
  title: string
  content: string
  imageUrls: string[]
  tags: string[]
}): Promise<Post> {
  if (USE_MOCK) {
    await delay(500)
    const newPost: Post = {
      id: `post-${Date.now()}`,
      authorId: 'mock-user',
      authorName: '我',
      authorAvatarUrl: '',
      likeCount: 0,
      commentCount: 0,
      createdAt: new Date().toISOString(),
      comments: [],
      ...data,
    }
    return newPost
  }
  return request<Post>('/api/mp/community/posts', {
    method: 'POST',
    data,
  })
}

export async function likePost(postId: string): Promise<void> {
  if (USE_MOCK) {
    await delay(200)
    return
  }
  return request<void>(`/api/mp/community/posts/${postId}/like`, { method: 'POST' })
}

export async function reportPost(postId: string, reason: string): Promise<void> {
  if (USE_MOCK) {
    await delay(200)
    return
  }
  return request<void>(`/api/mp/community/posts/${postId}/report`, {
    method: 'POST',
    data: { reason },
  })
}
