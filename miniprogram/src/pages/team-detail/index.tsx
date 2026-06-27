import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import type { Team } from '../../types/league'
import { fetchTeamById } from '../../services/api'
import PlayerRow from '../../components/PlayerRow'
import GameCard from '../../components/GameCard'
import LoadingState from '../../components/LoadingState'
import EmptyState from '../../components/EmptyState'
import styles from './index.module.scss'

type Tab = 'overview' | 'roster' | 'games'

export default function TeamDetailPage() {
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')

  useLoad(async () => {
    const params = Taro.getCurrentInstance().router?.params
    const id = params?.id as string
    if (!id) {
      Taro.showToast({ title: '参数错误', icon: 'error' })
      return
    }
    try {
      const data = await fetchTeamById(id)
      setTeam(data)
      Taro.setNavigationBarTitle({ title: data.name })
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  })

  if (loading) return <LoadingState />
  if (!team) return <EmptyState message="球队不存在" />

  const TABS: Array<{ key: Tab; label: string }> = [
    { key: 'overview', label: '概况' },
    { key: 'roster', label: `球员 (${team.players?.length ?? 0})` },
    { key: 'games', label: `赛程 (${team.games?.length ?? 0})` },
  ]

  return (
    <ScrollView scrollY className={styles.page}>
      {/* Header */}
      <View className={styles.header}>
        <View className={styles.logo}>
          <Text className={styles.logoText}>{team.shortName[0]}</Text>
        </View>
        <Text className={styles.name}>{team.name}</Text>
        <Text className={styles.coach}>{team.coachName}</Text>
        <View className={styles.record}>
          <View className={styles.recordItem}>
            <Text className={styles.recordNum} style={{ color: '#10b981' }}>{team.wins}</Text>
            <Text className={styles.recordLabel}>胜</Text>
          </View>
          <Text className={styles.recordDash}>-</Text>
          <View className={styles.recordItem}>
            <Text className={styles.recordNum} style={{ color: '#ef4444' }}>{team.losses}</Text>
            <Text className={styles.recordLabel}>负</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View className={styles.tabs}>
        {TABS.map((t) => (
          <Text
            key={t.key}
            className={[styles.tabBtn, tab === t.key ? styles.tabActive : ''].join(' ')}
            onTap={() => setTab(t.key)}
          >
            {t.label}
          </Text>
        ))}
      </View>

      <View className={styles.content}>
        {tab === 'overview' && (
          <View>
            {team.description && (
              <View className={styles.descCard}>
                <Text className={styles.desc}>{team.description}</Text>
              </View>
            )}
            <View className={styles.infoCard}>
              <View className={styles.infoRow}>
                <Text className={styles.infoLabel}>主教练</Text>
                <Text className={styles.infoValue}>{team.coachName}</Text>
              </View>
              <View className={styles.infoRow}>
                <Text className={styles.infoLabel}>球员人数</Text>
                <Text className={styles.infoValue}>{team.players?.length ?? 0} 人</Text>
              </View>
              <View className={styles.infoRow}>
                <Text className={styles.infoLabel}>胜率</Text>
                <Text className={styles.infoValue}>
                  {team.wins + team.losses > 0
                    ? ((team.wins / (team.wins + team.losses)) * 100).toFixed(0) + '%'
                    : '--'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {tab === 'roster' && (
          <View className={styles.rosterCard}>
            {(team.players ?? []).length === 0 ? (
              <EmptyState message="暂无球员信息" />
            ) : (
              (team.players ?? []).map((p) => <PlayerRow key={p.id} player={p} />)
            )}
          </View>
        )}

        {tab === 'games' && (
          <View>
            {(team.games ?? []).length === 0 ? (
              <EmptyState message="暂无赛程信息" icon="📅" />
            ) : (
              (team.games ?? []).map((g) => <GameCard key={g.id} game={g} />)
            )}
          </View>
        )}
      </View>
    </ScrollView>
  )
}
