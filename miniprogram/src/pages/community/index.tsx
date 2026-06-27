import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useLoad, usePullDownRefresh } from '@tarojs/taro'
import type { Post } from '../../types/league'
import { fetchPosts } from '../../services/api'
import { requireLoginMock } from '../../services/auth'
import PostCard from '../../components/PostCard'
import EmptyState from '../../components/EmptyState'
import LoadingState from '../../components/LoadingState'
import styles from './index.module.scss'

export default function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  async function loadData() {
    try {
      const data = await fetchPosts()
      setPosts(data)
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

  function handleCreatePost() {
    requireLoginMock(() => {
      Taro.navigateTo({ url: '/pages/create-post/index' })
    })
  }

  if (loading) return <LoadingState />

  return (
    <View className={styles.page}>
      <ScrollView scrollY className={styles.list}>
        <View className={styles.inner}>
          {posts.length === 0 ? (
            <EmptyState message="暂无帖子，来发第一条吧！" icon="💬" />
          ) : (
            posts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </View>
      </ScrollView>

      {/* FAB — create post button */}
      <View className={styles.fab} onTap={handleCreatePost}>
        <Text className={styles.fabIcon}>✏️</Text>
        <Text className={styles.fabText}>发帖</Text>
      </View>
    </View>
  )
}
