import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useLoad, usePullDownRefresh } from '@tarojs/taro'
import type { Announcement } from '../../types/league'
import { fetchAnnouncements } from '../../services/api'
import EmptyState from '../../components/EmptyState'
import LoadingState from '../../components/LoadingState'
import styles from './index.module.scss'

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function loadData() {
    try {
      const data = await fetchAnnouncements()
      setAnnouncements(data)
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
  if (announcements.length === 0) return <EmptyState message="暂无公告" icon="📢" />

  return (
    <ScrollView scrollY className={styles.page}>
      {announcements.map((a) => (
        <View key={a.id} className={[styles.card, a.isPinned ? styles.pinned : ''].join(' ')}>
          <View className={styles.cardHeader} onTap={() => setExpanded(expanded === a.id ? null : a.id)}>
            <View className={styles.titleRow}>
              {a.isPinned && <Text className={styles.pinBadge}>置顶</Text>}
              <Text className={styles.title}>{a.title}</Text>
            </View>
            <View className={styles.meta}>
              <Text className={styles.author}>{a.authorName}</Text>
              <Text className={styles.date}>{formatDate(a.createdAt)}</Text>
            </View>
            {a.tags.length > 0 && (
              <View className={styles.tags}>
                {a.tags.map((tag) => (
                  <Text key={tag} className={styles.tag}>{tag}</Text>
                ))}
              </View>
            )}
            <Text className={styles.arrow}>{expanded === a.id ? '▲ 收起' : '▼ 展开'}</Text>
          </View>
          {expanded === a.id && (
            <View className={styles.body}>
              <Text className={styles.content}>{a.content}</Text>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  )
}
