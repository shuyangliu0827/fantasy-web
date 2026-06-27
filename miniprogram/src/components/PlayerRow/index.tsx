import { View, Text, Navigator } from '@tarojs/components'
import type { Player } from '../../types/league'
import styles from './index.module.scss'

interface Props {
  player: Player
}

const POSITION_COLOR: Record<string, string> = {
  PG: '#3b82f6',
  SG: '#8b5cf6',
  SF: '#10b981',
  PF: '#f59e0b',
  C: '#ef4444',
}

export default function PlayerRow({ player }: Props) {
  return (
    <Navigator url={`/pages/player-detail/index?id=${player.id}`} className={styles.row}>
      <View className={styles.number}>
        <Text className={styles.numberText}>{player.number}</Text>
      </View>
      <View className={styles.info}>
        <Text className={styles.name}>{player.name}</Text>
        <View
          className={styles.positionBadge}
          style={{ backgroundColor: POSITION_COLOR[player.position] + '20', borderColor: POSITION_COLOR[player.position] + '40' }}
        >
          <Text className={styles.position} style={{ color: POSITION_COLOR[player.position] }}>
            {player.position}
          </Text>
        </View>
      </View>
      <View className={styles.stats}>
        <View className={styles.stat}>
          <Text className={styles.statValue}>{player.stats.pointsPerGame.toFixed(1)}</Text>
          <Text className={styles.statLabel}>得分</Text>
        </View>
        <View className={styles.stat}>
          <Text className={styles.statValue}>{player.stats.reboundsPerGame.toFixed(1)}</Text>
          <Text className={styles.statLabel}>篮板</Text>
        </View>
        <View className={styles.stat}>
          <Text className={styles.statValue}>{player.stats.assistsPerGame.toFixed(1)}</Text>
          <Text className={styles.statLabel}>助攻</Text>
        </View>
      </View>
    </Navigator>
  )
}
