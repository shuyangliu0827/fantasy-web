import { View, Text } from '@tarojs/components'
import styles from './index.module.scss'

interface Props {
  message?: string
}

export default function LoadingState({ message = '加载中...' }: Props) {
  return (
    <View className={styles.container}>
      <View className={styles.spinner} />
      <Text className={styles.message}>{message}</Text>
    </View>
  )
}
