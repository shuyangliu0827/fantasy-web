import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import type { Player } from '../../types/league'
import { fetchPlayerById } from '../../services/api'
import LoadingState from '../../components/LoadingState'
import EmptyState from '../../components/EmptyState'
import styles from './index.module.scss'

const POSITION_FULL: Record<string, string> = {
  PG: '控球后卫',
  SG: '得分后卫',
  SF: '小前锋',
  PF: '大前锋',
  C: '中锋',
}

export default function PlayerDetailPage() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)

  useLoad(async () => {
    const params = Taro.getCurrentInstance().router?.params
    const id = params?.id as string
    if (!id) {
      Taro.showToast({ title: '参数错误', icon: 'error' })
      return
    }
    try {
      const data = await fetchPlayerById(id)
      setPlayer(data)
      Taro.setNavigationBarTitle({ title: data.name })
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  })

  if (loading) return <LoadingState />
  if (!player) return <EmptyState message="球员不存在" />

  const stats = player.stats
  const STAT_ROWS = [
    { label: '场均得分', value: stats.pointsPerGame.toFixed(1), unit: '分' },
    { label: '场均篮板', value: stats.reboundsPerGame.toFixed(1), unit: '个' },
    { label: '场均助攻', value: stats.assistsPerGame.toFixed(1), unit: '次' },
    { label: '场均抢断', value: stats.stealsPerGame.toFixed(1), unit: '次' },
    { label: '场均盖帽', value: stats.blocksPerGame.toFixed(1), unit: '次' },
    { label: '投篮命中率', value: (stats.fieldGoalPct * 100).toFixed(1), unit: '%' },
    { label: '三分命中率', value: (stats.threePointPct * 100).toFixed(1), unit: '%' },
    { label: '罚球命中率', value: (stats.freeThrowPct * 100).toFixed(1), unit: '%' },
    { label: '出场场次', value: String(stats.gamesPlayed), unit: '场' },
  ]

  return (
    <ScrollView scrollY className={styles.page}>
      {/* Header */}
      <View className={styles.header}>
        <View className={styles.avatarWrap}>
          <Text className={styles.avatarText}>{player.name[0]}</Text>
          <View className={styles.numberBadge}>
            <Text className={styles.number}>#{player.number}</Text>
          </View>
        </View>
        <Text className={styles.name}>{player.name}</Text>
        <Text
          className={styles.team}
          onTap={() => Taro.navigateTo({ url: `/pages/team-detail/index?id=${player.teamId}` })}
        >
          {player.teamName} &gt;
        </Text>
        <View className={styles.badges}>
          <Text className={styles.posBadge}>{POSITION_FULL[player.position]}</Text>
          <Text className={styles.ageBadge}>年龄 {player.age}岁</Text>
        </View>
      </View>

      {/* Physical info */}
      <View className={styles.section}>
        <View className={styles.physicalRow}>
          <View className={styles.physicalItem}>
            <Text className={styles.physicalValue}>{player.height}</Text>
            <Text className={styles.physicalLabel}>身高</Text>
          </View>
          <View className={styles.divider} />
          <View className={styles.physicalItem}>
            <Text className={styles.physicalValue}>{player.weight}</Text>
            <Text className={styles.physicalLabel}>体重</Text>
          </View>
          <View className={styles.divider} />
          <View className={styles.physicalItem}>
            <Text className={styles.physicalValue}>{player.position}</Text>
            <Text className={styles.physicalLabel}>位置</Text>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View className={styles.section}>
        <Text className={styles.sectionTitle}>本赛季数据</Text>
        <View className={styles.statsCard}>
          {STAT_ROWS.map((row) => (
            <View key={row.label} className={styles.statRow}>
              <Text className={styles.statLabel}>{row.label}</Text>
              <Text className={styles.statValue}>
                {row.value}
                <Text className={styles.statUnit}> {row.unit}</Text>
              </Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}
