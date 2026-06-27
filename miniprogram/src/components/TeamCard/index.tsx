import { View, Text, Navigator } from '@tarojs/components'
import type { Team } from '../../types/league'
import styles from './index.module.scss'

interface Props {
  team: Team
}

export default function TeamCard({ team }: Props) {
  return (
    <Navigator url={`/pages/team-detail/index?id=${team.id}`} className={styles.card}>
      <View className={styles.logo}>
        <Text className={styles.logoText}>{team.shortName[0]}</Text>
      </View>
      <View className={styles.info}>
        <Text className={styles.name}>{team.name}</Text>
        <Text className={styles.coach}>{team.coachName}</Text>
      </View>
      <View className={styles.record}>
        <Text className={styles.wins}>{team.wins}</Text>
        <Text className={styles.dash}>-</Text>
        <Text className={styles.losses}>{team.losses}</Text>
        <Text className={styles.recordLabel}>胜-负</Text>
      </View>
    </Navigator>
  )
}
