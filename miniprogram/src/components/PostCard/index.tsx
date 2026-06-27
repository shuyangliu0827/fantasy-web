import { View, Text, Navigator } from '@tarojs/components'
import type { Post } from '../../types/league'
import styles from './index.module.scss'

interface Props {
  post: Post
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffH = Math.floor(diffMs / 3600000)
  if (diffH < 1) return '刚刚'
  if (diffH < 24) return `${diffH}小时前`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}天前`
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export default function PostCard({ post }: Props) {
  const preview = post.content.length > 80 ? post.content.slice(0, 80) + '…' : post.content

  return (
    <Navigator url={`/pages/post-detail/index?id=${post.id}`} className={styles.card}>
      <View className={styles.header}>
        <View className={styles.avatar}>
          <Text className={styles.avatarText}>{post.authorName[0]}</Text>
        </View>
        <View className={styles.authorInfo}>
          <Text className={styles.authorName}>{post.authorName}</Text>
          <Text className={styles.time}>{formatTime(post.createdAt)}</Text>
        </View>
      </View>
      <Text className={styles.title}>{post.title}</Text>
      <Text className={styles.content}>{preview}</Text>
      {post.tags.length > 0 && (
        <View className={styles.tags}>
          {post.tags.map((tag) => (
            <Text key={tag} className={styles.tag}>#{tag}</Text>
          ))}
        </View>
      )}
      <View className={styles.footer}>
        <Text className={styles.footerItem}>👍 {post.likeCount}</Text>
        <Text className={styles.footerItem}>💬 {post.commentCount}</Text>
      </View>
    </Navigator>
  )
}
