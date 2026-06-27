import { View, Text } from '@tarojs/components'
import styles from './index.module.scss'

interface Props {
  message: string
  icon?: string
}

export default function EmptyState({ message, icon = '🏀' }: Props) {
  return (
    <View className={styles.container}>
      <Text className={styles.icon}>{icon}</Text>
      <Text className={styles.message}>{message}</Text>
    </View>
  )
}
