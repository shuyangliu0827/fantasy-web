import { useState } from 'react'
import { View, Text, ScrollView, Swiper, SwiperItem, Navigator } from '@tarojs/components'
import Taro, { useLoad, usePullDownRefresh } from '@tarojs/taro'
import type { League, Game, Announcement } from '../../types/league'
import { fetchLeague, fetchGames, fetchAnnouncements } from '../../services/api'
import GameCard from '../../components/GameCard'
import SectionHeader from '../../components/SectionHeader'
import LoadingState from '../../components/LoadingState'
import styles from './index.module.scss'

const QUICK_LINKS = [
  { icon: '📅', label: '赛程', url: '/pages/schedule/index', isTab: true },
  { icon: '🏀', label: '球队', url: '/pages/teams/index', isTab: false },
  { icon: '🏆', label: '排名', url: '/pages/standings/index', isTab: true },
  { icon: '📢', label: '公告', url: '/pages/announcements/index', isTab: false },
]

export default function HomePage() {
  const [league, setLeague] = useState<League | null>(null)
  const [upcomingGames, setUpcomingGames] = useState<Game[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  async function loadData() {
    try {
      const [leagueData, gamesData, announcementsData] = await Promise.all([
        fetchLeague(),
        fetchGames(),
        fetchAnnouncements(),
      ])
      setLeague(leagueData)
      setUpcomingGames(gamesData.filter((g) => g.status === 'upcoming').slice(0, 3))
      setAnnouncements(announcementsData.slice(0, 3))
    } catch (e) {
      Taro.showToast({ title: '加载失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useLoad(() => {
    loadData()
  })

  usePullDownRefresh(async () => {
    await loadData()
    Taro.stopPullDownRefresh()
  })

  if (loading) return <LoadingState />

  return (
    <ScrollView scrollY className={styles.page}>
      {/* Hero banner */}
      <View className={styles.hero}>
        <Text className={styles.heroTitle}>{league?.name ?? '青少年篮球联赛'}</Text>
        <Text className={styles.heroSub}>{league?.season} · {league?.organizer}</Text>
      </View>

      {/* Announcement swiper */}
      {announcements.length > 0 && (
        <View className={styles.swiperWrap}>
          <Swiper autoplay circular indicatorDots className={styles.swiper}>
            {announcements.map((a) => (
              <SwiperItem key={a.id}>
                <Navigator url={`/pages/announcements/index`} className={styles.swiperItem}>
                  <Text className={styles.swiperText}>{a.title}</Text>
                </Navigator>
              </SwiperItem>
            ))}
          </Swiper>
        </View>
      )}

      {/* Quick links */}
      <View className={styles.section}>
        <View className={styles.quickLinks}>
          {QUICK_LINKS.map((link) => (
            <Navigator
              key={link.label}
              url={link.url}
              openType={link.isTab ? 'switchTab' : 'navigate'}
              className={styles.quickLink}
            >
              <Text className={styles.quickIcon}>{link.icon}</Text>
              <Text className={styles.quickLabel}>{link.label}</Text>
            </Navigator>
          ))}
        </View>
      </View>

      {/* Upcoming games */}
      <View className={styles.section}>
        <SectionHeader
          title="近期赛程"
          actionText="全部"
          onAction={() => Taro.switchTab({ url: '/pages/schedule/index' })}
        />
        {upcomingGames.length === 0 ? (
          <Text className={styles.empty}>暂无近期赛程</Text>
        ) : (
          upcomingGames.map((game) => <GameCard key={game.id} game={game} />)
        )}
      </View>

      {/* League info */}
      {league && (
        <View className={styles.section}>
          <SectionHeader title="联赛信息" />
          <View className={styles.infoCard}>
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>赛季</Text>
              <Text className={styles.infoValue}>{league.season}</Text>
            </View>
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>时间</Text>
              <Text className={styles.infoValue}>{league.startDate} ~ {league.endDate}</Text>
            </View>
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>场馆</Text>
              <Text className={styles.infoValue}>{league.venue}</Text>
            </View>
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>主办方</Text>
              <Text className={styles.infoValue}>{league.organizer}</Text>
            </View>
          </View>
        </View>
      )}

      <View className={styles.footer}>
        <Text className={styles.footerText}>© 2026 {league?.organizer}</Text>
        <Text className={styles.footerText}>联系电话：{league?.contactPhone}</Text>
        <View className={styles.footerDivider} />
        <Text className={styles.footerPlatform}>管理员及教练请访问完整平台</Text>
        <Text
          className={styles.footerLink}
          onTap={() =>
            Taro.setClipboardData({
              data: 'https://blueprintfantasy.com',
              success: () => Taro.showToast({ title: '链接已复制', icon: 'success' }),
            })
          }
        >
          blueprintfantasy.com（点击复制）
        </Text>
      </View>
    </ScrollView>
  )
}
