import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useLoad, usePullDownRefresh } from '@tarojs/taro'
import type { Game } from '../../types/league'
import { fetchGames } from '../../services/api'
import GameCard from '../../components/GameCard'
import EmptyState from '../../components/EmptyState'
import LoadingState from '../../components/LoadingState'
import styles from './index.module.scss'

export default function SchedulePage() {
  const [gamesByDate, setGamesByDate] = useState<Record<string, Game[]>>({})
  const [sortedDates, setSortedDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'finished'>('all')

  async function loadData() {
    try {
      const games = await fetchGames()
      groupGames(games, filter)
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  }

  function groupGames(games: Game[], currentFilter: string) {
    const filtered = currentFilter === 'all' ? games : games.filter((g) => g.status === currentFilter)
    const grouped = filtered.reduce<Record<string, Game[]>>((acc, game) => {
      if (!acc[game.date]) acc[game.date] = []
      acc[game.date].push(game)
      return acc
    }, {})
    const dates = Object.keys(grouped).sort()
    setGamesByDate(grouped)
    setSortedDates(dates)
  }

  useLoad(() => {
    loadData()
  })

  usePullDownRefresh(async () => {
    await loadData()
    Taro.stopPullDownRefresh()
  })

  const FILTERS: Array<{ key: typeof filter; label: string }> = [
    { key: 'all', label: '全部' },
    { key: 'upcoming', label: '待赛' },
    { key: 'finished', label: '已结束' },
  ]

  if (loading) return <LoadingState />

  return (
    <ScrollView scrollY className={styles.page}>
      <View className={styles.filters}>
        {FILTERS.map((f) => (
          <Text
            key={f.key}
            className={[styles.filterBtn, filter === f.key ? styles.filterActive : ''].join(' ')}
            onTap={() => {
              setFilter(f.key)
              // Re-fetch so we can re-filter; using closure to pass new filter value
              fetchGames().then((games) => groupGames(games, f.key))
            }}
          >
            {f.label}
          </Text>
        ))}
      </View>

      {sortedDates.length === 0 ? (
        <EmptyState message="暂无赛程" />
      ) : (
        sortedDates.map((date) => (
          <View key={date} className={styles.dateGroup}>
            <View className={styles.dateBadge}>
              <Text className={styles.dateText}>{date}</Text>
            </View>
            {gamesByDate[date].map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </View>
        ))
      )}
    </ScrollView>
  )
}
