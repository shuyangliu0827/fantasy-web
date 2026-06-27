/**
 * Auth service — mock implementation only.
 *
 * REAL WECHAT LOGIN FLOW (future implementation):
 * 1. Call Taro.login() to get a temporary code from WeChat
 * 2. POST that code to https://blueprintfantasy.com/api/mp/auth/wechat-login
 * 3. Backend calls wx.code2Session (AppID + AppSecret + code) to get openId + sessionKey
 * 4. Backend creates or finds the user record, binds openId to our user system
 * 5. Backend returns a signed session token (JWT or opaque token)
 * 6. Store token: Taro.setStorageSync('bp_mp_token', token)
 * 7. Subsequent API requests attach Authorization: Bearer <token>
 * 8. To get user profile info (nickName, avatarUrl), use Button openType="getUserInfo"
 *    (requires the user to actively tap the button — passive getUserInfo is deprecated)
 */

import Taro from '@tarojs/taro'
import type { User } from '../types/league'
import { mockCurrentUser } from '../mock/leagueData'

const STORAGE_KEY = 'bp_mp_mock_user'

export async function loginWithWeChatMock(): Promise<User> {
  const mockUser: User = {
    ...mockCurrentUser,
    id: 'mock-user-001',
    openId: 'mock_openid_abc123',
    nickName: '篮球家长',
    avatarUrl: '',
    role: 'parent',
    boundTeamId: 'team-1',
    boundTeamName: '飞鹰队',
  }
  Taro.setStorageSync(STORAGE_KEY, JSON.stringify(mockUser))
  return mockUser
}

export async function getCurrentUserMock(): Promise<User | null> {
  try {
    const stored = Taro.getStorageSync(STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored) as User
  } catch {
    return null
  }
}

export async function requireLoginMock(onSuccess: (user: User) => void): Promise<void> {
  const user = await getCurrentUserMock()
  if (user && user.openId) {
    onSuccess(user)
    return
  }
  Taro.showModal({
    title: '需要登录',
    content: '请先登录才能使用此功能',
    confirmText: '去登录',
    cancelText: '取消',
    success: (res) => {
      if (res.confirm) {
        Taro.switchTab({ url: '/pages/profile/index' })
      }
    },
  })
}

export function logoutMock(): void {
  Taro.removeStorageSync(STORAGE_KEY)
}

export function isLoggedIn(): boolean {
  try {
    const stored = Taro.getStorageSync(STORAGE_KEY)
    if (!stored) return false
    const user = JSON.parse(stored) as User
    return Boolean(user.openId)
  } catch {
    return false
  }
}
