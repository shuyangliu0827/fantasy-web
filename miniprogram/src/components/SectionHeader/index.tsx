import { View, Text } from '@tarojs/components'
import styles from './index.module.scss'

interface Props {
  title: string
  actionText?: string
  onAction?: () => void
}

export default function SectionHeader({ title, actionText, onAction }: Props) {
  return (
    <View className={styles.header}>
      <View className={styles.titleRow}>
        <View className={styles.accent} />
        <Text className={styles.title}>{title}</Text>
      </View>
      {actionText && onAction && (
        <Text className={styles.action} onTap={onAction}>
          {actionText} &gt;
        </Text>
      )}
    </View>
  )
}
