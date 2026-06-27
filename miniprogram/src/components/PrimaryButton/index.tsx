import { View, Text } from '@tarojs/components'
import styles from './index.module.scss'

interface Props {
  children: string
  onTap?: () => void
  disabled?: boolean
  loading?: boolean
  variant?: 'primary' | 'secondary' | 'outline'
}

export default function PrimaryButton({
  children,
  onTap,
  disabled = false,
  loading = false,
  variant = 'primary',
}: Props) {
  const cls = [
    styles.btn,
    styles[variant],
    disabled || loading ? styles.disabled : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <View className={cls} onTap={!disabled && !loading ? onTap : undefined}>
      {loading ? (
        <View className={styles.loadingDot} />
      ) : (
        <Text className={styles.text}>{children}</Text>
      )}
    </View>
  )
}
