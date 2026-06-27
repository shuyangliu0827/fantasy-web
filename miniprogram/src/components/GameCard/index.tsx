import { View, Text } from '@tarojs/components'
import type { Game } from '../../types/league'
import styles from './index.module.scss'

interface Props {
  game: Game
}

const STATUS_LABEL: Record<string, string> = {
  upcoming: '待赛',
  live: '进行中',
  finished: '已结束',
}

export default function GameCard({ game }: Props) {
  return (
    <View className={styles.card}>
      <View className={styles.teams}>
        <View className={styles.teamSide}>
          <Text className={styles.teamName}>{game.awayTeamName}</Text>
          <Text className={styles.label}>客队</Text>
        </View>
        <View className={styles.center}>
          {game.status === 'finished' && game.homeScore !== null ? (
            <Text className={styles.score}>
              {game.awayScore} - {game.homeScore}
            </Text>
          ) : (
            <Text className={styles.vs}>VS</Text>
          )}
          <Text className={[styles.badge, styles[`status_${game.status}`]].join(' ')}>
            {STATUS_LABEL[game.status]}
          </Text>
        </View>
        <View className={styles.teamSide}>
          <Text className={styles.teamName}>{game.homeTeamName}</Text>
          <Text className={styles.label}>主队</Text>
        </View>
      </View>
      <View className={styles.meta}>
        <Text className={styles.metaText}>{game.date} {game.time}</Text>
        <Text className={styles.venue}>{game.venue}</Text>
      </View>
    </View>
  )
}
