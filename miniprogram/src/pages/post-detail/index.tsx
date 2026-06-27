import { useState } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import type { Post } from '../../types/league'
import { fetchPostById, likePost, reportPost } from '../../services/api'
import { requireLoginMock } from '../../services/auth'
import LoadingState from '../../components/LoadingState'
import EmptyState from '../../components/EmptyState'
import styles from './index.module.scss'

function formatTime(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function PostDetailPage() {
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useLoad(async () => {
    const params = Taro.getCurrentInstance().router?.params
    const id = params?.id as string
    if (!id) return
    try {
      const data = await fetchPostById(id)
      setPost(data)
      setLikeCount(data.likeCount)
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  })

  function handleLike() {
    requireLoginMock(() => {
      if (liked) return
      setLiked(true)
      setLikeCount((n) => n + 1)
      likePost(post!.id)
    })
  }

  function handleReport() {
    requireLoginMock(() => {
      Taro.showActionSheet({
        itemList: ['内容不当', '虚假信息', '涉及隐私', '其他'],
        success: async (res) => {
          const reasons = ['内容不当', '虚假信息', '涉及隐私', '其他']
          await reportPost(post!.id, reasons[res.tapIndex])
          Taro.showToast({ title: '举报已提交', icon: 'success' })
        },
      })
    })
  }

  function handleSubmitComment() {
    if (!commentText.trim()) return
    requireLoginMock(async () => {
      setSubmitting(true)
      await new Promise((r) => setTimeout(r, 400))
      Taro.showToast({ title: '评论已发布（模拟）', icon: 'success' })
      setCommentText('')
      setSubmitting(false)
    })
  }

  if (loading) return <LoadingState />
  if (!post) return <EmptyState message="帖子不存在" icon="💬" />

  return (
    <View className={styles.page}>
      <ScrollView scrollY className={styles.scroll}>
        {/* Post body */}
        <View className={styles.postCard}>
          <View className={styles.author}>
            <View className={styles.avatar}>
              <Text className={styles.avatarText}>{post.authorName[0]}</Text>
            </View>
            <View>
              <Text className={styles.authorName}>{post.authorName}</Text>
              <Text className={styles.time}>{formatTime(post.createdAt)}</Text>
            </View>
          </View>
          <Text className={styles.title}>{post.title}</Text>
          <Text className={styles.content}>{post.content}</Text>
          {post.tags.length > 0 && (
            <View className={styles.tags}>
              {post.tags.map((tag) => (
                <Text key={tag} className={styles.tag}>#{tag}</Text>
              ))}
            </View>
          )}
          {/* Like / Report actions */}
          <View className={styles.actions}>
            <View className={[styles.action, liked ? styles.actionLiked : ''].join(' ')} onTap={handleLike}>
              <Text className={styles.actionIcon}>👍</Text>
              <Text className={styles.actionCount}>{likeCount}</Text>
            </View>
            <View className={styles.action}>
              <Text className={styles.actionIcon}>💬</Text>
              <Text className={styles.actionCount}>{post.comments?.length ?? post.commentCount}</Text>
            </View>
            <View className={styles.action} onTap={handleReport}>
              <Text className={styles.actionText}>举报</Text>
            </View>
          </View>
        </View>

        {/* Comments */}
        <View className={styles.commentsSection}>
          <Text className={styles.commentsTitle}>
            评论 ({post.comments?.length ?? 0})
          </Text>
          {(post.comments ?? []).length === 0 ? (
            <Text className={styles.noComments}>暂无评论，来第一个评论吧</Text>
          ) : (
            (post.comments ?? []).map((c) => (
              <View key={c.id} className={styles.comment}>
                <View className={styles.commentAvatar}>
                  <Text className={styles.commentAvatarText}>{c.authorName[0]}</Text>
                </View>
                <View className={styles.commentBody}>
                  <View className={styles.commentHeader}>
                    <Text className={styles.commentAuthor}>{c.authorName}</Text>
                    <Text className={styles.commentTime}>{formatTime(c.createdAt)}</Text>
                  </View>
                  <Text className={styles.commentContent}>{c.content}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Comment input bar */}
      <View className={styles.inputBar}>
        <Input
          className={styles.input}
          value={commentText}
          onInput={(e) => setCommentText(e.detail.value)}
          placeholder="说点什么..."
          placeholderStyle="color: #9ca3af"
        />
        <View
          className={[styles.sendBtn, submitting || !commentText.trim() ? styles.sendDisabled : ''].join(' ')}
          onTap={handleSubmitComment}
        >
          <Text className={styles.sendText}>发送</Text>
        </View>
      </View>
    </View>
  )
}
