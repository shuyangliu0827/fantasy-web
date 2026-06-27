import { useState } from 'react'
import { View, Text, ScrollView, Button } from '@tarojs/components'
import Taro, { useLoad, useShow } from '@tarojs/taro'
import type { User } from '../../types/league'
import { loginWithWeChatMock, getCurrentUserMock, logoutMock } from '../../services/auth'
import PrimaryButton from '../../components/PrimaryButton'
import styles from './index.module.scss'

/**
 * Profile page — WeChat login placeholder.
 *
 * REAL LOGIN: Replace loginWithWeChatMock() with:
 * 1. Taro.login() → get code
 * 2. POST code to https://blueprintfantasy.com/api/mp/auth/wechat-login
 * 3. Store returned token in Taro.setStorageSync('bp_mp_token', token)
 * 4. Use Button openType="getUserInfo" to get nickName/avatarUrl (requires user tap)
 */
export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [logging, setLogging] = useState(false)

  async function loadUser() {
    const u = await getCurrentUserMock()
    setUser(u)
  }

  useLoad(() => {
    loadUser()
  })

  useShow(() => {
    loadUser()
  })

  async function handleLogin() {
    setLogging(true)
    try {
      const u = await loginWithWeChatMock()
      setUser(u)
      Taro.showToast({ title: '登录成功', icon: 'success' })
    } catch {
      Taro.showToast({ title: '登录失败', icon: 'error' })
    } finally {
      setLogging(false)
    }
  }

  function handleLogout() {
    Taro.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          logoutMock()
          setUser(null)
        }
      },
    })
  }

  const isLoggedIn = Boolean(user?.openId)

  return (
    <ScrollView scrollY className={styles.page}>
      {/* User card */}
      <View className={styles.userCard}>
        <View className={styles.avatar}>
          {isLoggedIn ? (
            <Text className={styles.avatarText}>{user!.nickName[0] ?? '我'}</Text>
          ) : (
            <Text className={styles.avatarIcon}>👤</Text>
          )}
        </View>
        {isLoggedIn ? (
          <View className={styles.userInfo}>
            <Text className={styles.nickName}>{user!.nickName}</Text>
            <Text className={styles.role}>
              {user!.role === 'parent' ? '家长' : user!.role === 'coach' ? '教练' : user!.role === 'admin' ? '管理员' : '球员'}
            </Text>
          </View>
        ) : (
          <View className={styles.userInfo}>
            <Text className={styles.nickName}>未登录</Text>
            <Text className={styles.role}>登录后查看更多功能</Text>
          </View>
        )}
      </View>

      {/* Bound info */}
      {isLoggedIn && (
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>绑定信息</Text>
          <View className={styles.card}>
            {user?.boundTeamName ? (
              <View className={styles.infoRow}>
                <Text className={styles.infoLabel}>绑定球队</Text>
                <Text
                  className={styles.infoLink}
                  onTap={() => Taro.navigateTo({ url: `/pages/team-detail/index?id=${user.boundTeamId}` })}
                >
                  {user.boundTeamName} &gt;
                </Text>
              </View>
            ) : null}
            {user?.boundPlayerName ? (
              <View className={styles.infoRow}>
                <Text className={styles.infoLabel}>绑定球员</Text>
                <Text
                  className={styles.infoLink}
                  onTap={() => Taro.navigateTo({ url: `/pages/player-detail/index?id=${user.boundPlayerId}` })}
                >
                  {user.boundPlayerName} &gt;
                </Text>
              </View>
            ) : null}
            {!user?.boundTeamName && !user?.boundPlayerName && (
              <View className={styles.infoRow}>
                <Text className={styles.infoLabel}>暂未绑定球队或球员</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Actions */}
      <View className={styles.section}>
        <Text className={styles.sectionTitle}>功能菜单</Text>
        <View className={styles.card}>
          <View
            className={styles.menuItem}
            onTap={() => Taro.navigateTo({ url: '/pages/announcements/index' })}
          >
            <Text className={styles.menuIcon}>📢</Text>
            <Text className={styles.menuLabel}>联赛公告</Text>
            <Text className={styles.menuArrow}>&gt;</Text>
          </View>
          <View
            className={styles.menuItem}
            onTap={() => Taro.navigateTo({ url: '/pages/teams/index' })}
          >
            <Text className={styles.menuIcon}>🏀</Text>
            <Text className={styles.menuLabel}>所有球队</Text>
            <Text className={styles.menuArrow}>&gt;</Text>
          </View>
          <View
            className={styles.menuItem}
            onTap={() =>
              Taro.showModal({
                title: '联系我们',
                content: '联赛热线：400-888-8888\n邮箱：support@blueprintfantasy.com',
                showCancel: false,
              })
            }
          >
            <Text className={styles.menuIcon}>📞</Text>
            <Text className={styles.menuLabel}>联系我们</Text>
            <Text className={styles.menuArrow}>&gt;</Text>
          </View>
        </View>
      </View>

      {/* Login / Logout */}
      <View className={styles.section}>
        {!isLoggedIn ? (
          <View>
            <Text className={styles.loginHint}>
              登录后可发帖、查看绑定信息、与其他家长互动。
            </Text>
            {/* In production, use Button openType="getUserInfo" for WeChat nickname/avatar */}
            <PrimaryButton onTap={handleLogin} loading={logging}>
              微信登录（模拟）
            </PrimaryButton>
          </View>
        ) : (
          <PrimaryButton onTap={handleLogout} variant="outline">
            退出登录
          </PrimaryButton>
        )}
      </View>

      <View className={styles.footer}>
        <Text className={styles.footerText}>Blueprint 青少年篮球联赛</Text>
        <Text className={styles.footerText}>版本 1.0.0 · AppID wx3bd939a6658ed9c1</Text>
      </View>
    </ScrollView>
  )
}
