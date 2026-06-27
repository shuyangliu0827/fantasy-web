import { useState } from 'react'
import { View, Text, Textarea, Input } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { createPost } from '../../services/api'
import { requireLoginMock, getCurrentUserMock } from '../../services/auth'
import PrimaryButton from '../../components/PrimaryButton'
import styles from './index.module.scss'

export default function CreatePostPage() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [gated, setGated] = useState(true)

  // Check login on load; gate the form if not logged in
  useLoad(async () => {
    const user = await getCurrentUserMock()
    if (user?.openId) {
      setGated(false)
    }
  })

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) {
      Taro.showToast({ title: '请填写标题和内容', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      await createPost({
        title: title.trim(),
        content: content.trim(),
        imageUrls: [],
        tags: tags
          .split(/[,，\s]+/)
          .map((t) => t.trim())
          .filter(Boolean),
      })
      Taro.showToast({ title: '发布成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1200)
    } catch {
      Taro.showToast({ title: '发布失败，请重试', icon: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (gated) {
    return (
      <View className={styles.gatePage}>
        <Text className={styles.gateIcon}>🔒</Text>
        <Text className={styles.gateTitle}>需要登录</Text>
        <Text className={styles.gateDesc}>请先在「我的」页面登录，然后再发帖。</Text>
        <PrimaryButton
          onTap={() => {
            requireLoginMock(() => {
              setGated(false)
            })
          }}
        >
          去登录
        </PrimaryButton>
      </View>
    )
  }

  return (
    <View className={styles.page}>
      <View className={styles.form}>
        {/* Title */}
        <View className={styles.field}>
          <Text className={styles.fieldLabel}>标题</Text>
          <Input
            className={styles.titleInput}
            value={title}
            onInput={(e) => setTitle(e.detail.value)}
            placeholder="请输入标题（必填）"
            placeholderStyle="color: #9ca3af"
            maxlength={60}
          />
          <Text className={styles.charCount}>{title.length}/60</Text>
        </View>

        {/* Content */}
        <View className={styles.field}>
          <Text className={styles.fieldLabel}>内容</Text>
          <Textarea
            className={styles.contentArea}
            value={content}
            onInput={(e) => setContent(e.detail.value)}
            placeholder="分享比赛感受、训练日常、或向其他家长提问..."
            placeholderStyle="color: #9ca3af"
            maxlength={1000}
            autoHeight
          />
          <Text className={styles.charCount}>{content.length}/1000</Text>
        </View>

        {/* Tags */}
        <View className={styles.field}>
          <Text className={styles.fieldLabel}>标签（可选）</Text>
          <Input
            className={styles.tagsInput}
            value={tags}
            onInput={(e) => setTags(e.detail.value)}
            placeholder="多个标签用逗号分隔，如：比赛日,训练"
            placeholderStyle="color: #9ca3af"
          />
        </View>

        {/* Image placeholder */}
        <View className={styles.field}>
          <Text className={styles.fieldLabel}>图片（可选）</Text>
          <View className={styles.imagePlaceholder}>
            <Text className={styles.imagePlaceholderIcon}>📷</Text>
            <Text className={styles.imagePlaceholderText}>图片上传功能即将上线</Text>
          </View>
        </View>

        {/* Tip */}
        <View className={styles.tip}>
          <Text className={styles.tipText}>
            发帖请遵守社区规范：友善交流，不发布涉及未成年人隐私信息，不传播违规内容。
          </Text>
        </View>

        <PrimaryButton onTap={handleSubmit} loading={submitting} disabled={!title.trim() || !content.trim()}>
          发布帖子
        </PrimaryButton>
      </View>
    </View>
  )
}
