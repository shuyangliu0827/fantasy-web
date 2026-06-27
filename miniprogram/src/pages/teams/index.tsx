import { useState } from 'react'
import { View, ScrollView } from '@tarojs/components'
import Taro, { useLoad, usePullDownRefresh } from '@tarojs/taro'
import type { Team } from '../../types/league'
import { fetchTeams } from '../../services/api'
import TeamCard from '../../components/TeamCard'
import EmptyState from '../../components/EmptyState'
import LoadingState from '../../components/LoadingState'
import styles from './index.module.scss'

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  async function loadData() {
    try {
      const data = await fetchTeams()
      setTeams(data)
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
  if (teams.length === 0) return <EmptyState message="暂无球队数据" />

  return (
    <ScrollView scrollY className={styles.page}>
      <View className={styles.list}>
        {teams.map((team) => (
          <TeamCard key={team.id} team={team} />
        ))}
      </View>
    </ScrollView>
  )
}
