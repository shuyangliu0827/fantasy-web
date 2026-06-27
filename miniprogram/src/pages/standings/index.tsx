import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useLoad, usePullDownRefresh } from '@tarojs/taro'
import type { Standing } from '../../types/league'
import { fetchStandings } from '../../services/api'
import LoadingState from '../../components/LoadingState'
import EmptyState from '../../components/EmptyState'
import styles from './index.module.scss'

export default function StandingsPage() {
  const [standings, setStandings] = useState<Standing[]>([])
  const [loading, setLoading] = useState(true)

  async function loadData() {
    try {
      const data = await fetchStandings()
      setStandings(data)
    } catch {
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
  if (standings.length === 0) return <EmptyState message="暂无排名数据" icon="🏆" />

  return (
    <ScrollView scrollY className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.col} style={{ flex: '0 0 60px' }}>排名</Text>
        <Text className={styles.col} style={{ flex: 1 }}>球队</Text>
        <Text className={styles.col}>胜</Text>
        <Text className={styles.col}>负</Text>
        <Text className={styles.col}>胜率</Text>
        <Text className={styles.col}>近5场</Text>
      </View>
      {standings.map((s) => (
        <View
          key={s.teamId}
          className={[styles.row, s.rank <= 4 ? styles.qualified : ''].join(' ')}
          onTap={() => Taro.navigateTo({ url: `/pages/team-detail/index?id=${s.teamId}` })}
        >
          <View className={styles.rankCell} style={{ flex: '0 0 60px' }}>
            {s.rank <= 3 ? (
              <Text className={styles.medal}>{['🥇', '🥈', '🥉'][s.rank - 1]}</Text>
            ) : (
              <Text className={[styles.rankNum, s.rank <= 4 ? styles.rankTop : ''].join(' ')}>
                {s.rank}
              </Text>
            )}
          </View>
          <Text className={[styles.col, styles.teamName].join(' ')} style={{ flex: 1 }}>
            {s.teamName}
          </Text>
          <Text className={[styles.col, styles.wins].join(' ')}>{s.wins}</Text>
          <Text className={[styles.col, styles.losses].join(' ')}>{s.losses}</Text>
          <Text className={styles.col}>{(s.winPct * 100).toFixed(0)}%</Text>
          <View className={styles.last5}>
            {s.last5.map((result, i) => (
              <Text
                key={i}
                className={[styles.dot, result === 'W' ? styles.dotW : styles.dotL].join(' ')}
              >
                {result}
              </Text>
            ))}
          </View>
        </View>
      ))}
      <View className={styles.legend}>
        <View className={styles.legendDot} />
        <Text className={styles.legendText}>前4名晋级季后赛</Text>
      </View>
    </ScrollView>
  )
}
