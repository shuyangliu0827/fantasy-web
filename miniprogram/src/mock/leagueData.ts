import type { League, Team, Player, Game, Standing, Announcement, Post, User } from '../types/league'

export const mockLeague: League = {
  id: 'league-2026-spring',
  name: '2026春季青少年篮球联赛',
  season: '2026春季',
  startDate: '2026-03-01',
  endDate: '2026-06-30',
  description: '面向8-16岁青少年的社区篮球联赛，培养团队精神与运动热情。',
  logoUrl: '',
  organizer: '蓝图青少年体育协会',
  contactPhone: '400-888-8888',
  venue: '青少年体育馆',
}

export const mockTeams: Team[] = [
  { id: 'team-1', name: '飞鹰队', shortName: '飞鹰', logoUrl: '', coachName: '张教练', wins: 8, losses: 2, description: '速度与技巧并重，联赛常年劲旅。' },
  { id: 'team-2', name: '雷霆队', shortName: '雷霆', logoUrl: '', coachName: '李教练', wins: 7, losses: 3, description: '以强力内线为核心，攻防均衡。' },
  { id: 'team-3', name: '猎豹队', shortName: '猎豹', logoUrl: '', coachName: '王教练', wins: 6, losses: 4, description: '全场紧逼防守，节奏快速。' },
  { id: 'team-4', name: '海豚队', shortName: '海豚', logoUrl: '', coachName: '刘教练', wins: 6, losses: 4, description: '注重配合，整体篮球风格突出。' },
  { id: 'team-5', name: '雄鹿队', shortName: '雄鹿', logoUrl: '', coachName: '陈教练', wins: 5, losses: 5, description: '新兴力量，年轻球员成长迅速。' },
  { id: 'team-6', name: '猛虎队', shortName: '猛虎', logoUrl: '', coachName: '赵教练', wins: 4, losses: 6, description: '身体对抗强，擅长抢板。' },
  { id: 'team-7', name: '天马队', shortName: '天马', logoUrl: '', coachName: '孙教练', wins: 3, losses: 7, description: '三分球威胁大，外线攻击力强。' },
  { id: 'team-8', name: '骑士队', shortName: '骑士', logoUrl: '', coachName: '周教练', wins: 1, losses: 9, description: '正在重建阶段，培养新人为主。' },
]

export const mockPlayers: Player[] = [
  // 飞鹰队
  { id: 'p-1', name: '陈小明', number: '23', teamId: 'team-1', teamName: '飞鹰队', position: 'PG', height: '172cm', weight: '65kg', age: 15, avatarUrl: '', stats: { gamesPlayed: 10, pointsPerGame: 18.5, reboundsPerGame: 4.2, assistsPerGame: 6.8, stealsPerGame: 2.1, blocksPerGame: 0.3, fieldGoalPct: 0.48, threePointPct: 0.38, freeThrowPct: 0.82 } },
  { id: 'p-2', name: '林大伟', number: '5', teamId: 'team-1', teamName: '飞鹰队', position: 'SF', height: '183cm', weight: '78kg', age: 16, avatarUrl: '', stats: { gamesPlayed: 10, pointsPerGame: 15.2, reboundsPerGame: 7.5, assistsPerGame: 2.3, stealsPerGame: 1.5, blocksPerGame: 1.2, fieldGoalPct: 0.52, threePointPct: 0.33, freeThrowPct: 0.75 } },
  { id: 'p-3', name: '张浩然', number: '11', teamId: 'team-1', teamName: '飞鹰队', position: 'C', height: '190cm', weight: '92kg', age: 16, avatarUrl: '', stats: { gamesPlayed: 10, pointsPerGame: 12.8, reboundsPerGame: 10.3, assistsPerGame: 1.1, stealsPerGame: 0.8, blocksPerGame: 2.5, fieldGoalPct: 0.61, threePointPct: 0.0, freeThrowPct: 0.65 } },
  // 雷霆队
  { id: 'p-4', name: '王志远', number: '3', teamId: 'team-2', teamName: '雷霆队', position: 'SG', height: '178cm', weight: '72kg', age: 15, avatarUrl: '', stats: { gamesPlayed: 10, pointsPerGame: 20.1, reboundsPerGame: 3.8, assistsPerGame: 4.5, stealsPerGame: 1.8, blocksPerGame: 0.5, fieldGoalPct: 0.45, threePointPct: 0.41, freeThrowPct: 0.88 } },
  { id: 'p-5', name: '刘宇航', number: '21', teamId: 'team-2', teamName: '雷霆队', position: 'PF', height: '186cm', weight: '85kg', age: 16, avatarUrl: '', stats: { gamesPlayed: 10, pointsPerGame: 14.6, reboundsPerGame: 9.1, assistsPerGame: 1.8, stealsPerGame: 1.0, blocksPerGame: 1.8, fieldGoalPct: 0.55, threePointPct: 0.28, freeThrowPct: 0.70 } },
  { id: 'p-6', name: '赵子豪', number: '8', teamId: 'team-2', teamName: '雷霆队', position: 'PG', height: '170cm', weight: '62kg', age: 14, avatarUrl: '', stats: { gamesPlayed: 10, pointsPerGame: 10.5, reboundsPerGame: 3.2, assistsPerGame: 7.2, stealsPerGame: 2.5, blocksPerGame: 0.2, fieldGoalPct: 0.42, threePointPct: 0.35, freeThrowPct: 0.79 } },
  // 猎豹队
  { id: 'p-7', name: '孙建国', number: '14', teamId: 'team-3', teamName: '猎豹队', position: 'SF', height: '181cm', weight: '76kg', age: 15, avatarUrl: '', stats: { gamesPlayed: 10, pointsPerGame: 16.3, reboundsPerGame: 5.8, assistsPerGame: 3.1, stealsPerGame: 2.8, blocksPerGame: 0.8, fieldGoalPct: 0.47, threePointPct: 0.36, freeThrowPct: 0.77 } },
  { id: 'p-8', name: '李俊杰', number: '33', teamId: 'team-3', teamName: '猎豹队', position: 'C', height: '192cm', weight: '95kg', age: 16, avatarUrl: '', stats: { gamesPlayed: 10, pointsPerGame: 13.9, reboundsPerGame: 11.2, assistsPerGame: 0.9, stealsPerGame: 0.6, blocksPerGame: 3.1, fieldGoalPct: 0.63, threePointPct: 0.0, freeThrowPct: 0.58 } },
  { id: 'p-9', name: '周明辉', number: '7', teamId: 'team-3', teamName: '猎豹队', position: 'SG', height: '175cm', weight: '69kg', age: 15, avatarUrl: '', stats: { gamesPlayed: 10, pointsPerGame: 11.8, reboundsPerGame: 3.5, assistsPerGame: 4.2, stealsPerGame: 1.9, blocksPerGame: 0.4, fieldGoalPct: 0.44, threePointPct: 0.39, freeThrowPct: 0.83 } },
  // 海豚队
  { id: 'p-10', name: '吴天宇', number: '10', teamId: 'team-4', teamName: '海豚队', position: 'PG', height: '174cm', weight: '67kg', age: 14, avatarUrl: '', stats: { gamesPlayed: 10, pointsPerGame: 14.2, reboundsPerGame: 4.1, assistsPerGame: 8.5, stealsPerGame: 2.2, blocksPerGame: 0.2, fieldGoalPct: 0.46, threePointPct: 0.37, freeThrowPct: 0.84 } },
  { id: 'p-11', name: '郑浩宇', number: '42', teamId: 'team-4', teamName: '海豚队', position: 'PF', height: '185cm', weight: '82kg', age: 16, avatarUrl: '', stats: { gamesPlayed: 10, pointsPerGame: 16.8, reboundsPerGame: 8.9, assistsPerGame: 2.0, stealsPerGame: 1.1, blocksPerGame: 1.5, fieldGoalPct: 0.53, threePointPct: 0.30, freeThrowPct: 0.72 } },
  { id: 'p-12', name: '杨晨曦', number: '6', teamId: 'team-4', teamName: '海豚队', position: 'SF', height: '180cm', weight: '74kg', age: 15, avatarUrl: '', stats: { gamesPlayed: 10, pointsPerGame: 12.5, reboundsPerGame: 5.5, assistsPerGame: 3.8, stealsPerGame: 1.6, blocksPerGame: 0.7, fieldGoalPct: 0.49, threePointPct: 0.34, freeThrowPct: 0.78 } },
  // 雄鹿队
  { id: 'p-13', name: '徐磊', number: '9', teamId: 'team-5', teamName: '雄鹿队', position: 'SG', height: '177cm', weight: '71kg', age: 14, avatarUrl: '', stats: { gamesPlayed: 10, pointsPerGame: 17.5, reboundsPerGame: 4.5, assistsPerGame: 3.5, stealsPerGame: 1.7, blocksPerGame: 0.6, fieldGoalPct: 0.46, threePointPct: 0.40, freeThrowPct: 0.85 } },
  { id: 'p-14', name: '黄志强', number: '15', teamId: 'team-5', teamName: '雄鹿队', position: 'C', height: '189cm', weight: '90kg', age: 15, avatarUrl: '', stats: { gamesPlayed: 10, pointsPerGame: 11.2, reboundsPerGame: 9.8, assistsPerGame: 1.3, stealsPerGame: 0.9, blocksPerGame: 2.2, fieldGoalPct: 0.58, threePointPct: 0.0, freeThrowPct: 0.62 } },
  { id: 'p-15', name: '林子轩', number: '4', teamId: 'team-5', teamName: '雄鹿队', position: 'PG', height: '171cm', weight: '64kg', age: 13, avatarUrl: '', stats: { gamesPlayed: 10, pointsPerGame: 9.8, reboundsPerGame: 3.0, assistsPerGame: 6.5, stealsPerGame: 2.0, blocksPerGame: 0.1, fieldGoalPct: 0.41, threePointPct: 0.33, freeThrowPct: 0.80 } },
  // 猛虎队
  { id: 'p-16', name: '罗俊成', number: '24', teamId: 'team-6', teamName: '猛虎队', position: 'PF', height: '184cm', weight: '86kg', age: 16, avatarUrl: '', stats: { gamesPlayed: 10, pointsPerGame: 15.8, reboundsPerGame: 10.5, assistsPerGame: 1.5, stealsPerGame: 1.2, blocksPerGame: 1.9, fieldGoalPct: 0.54, threePointPct: 0.25, freeThrowPct: 0.68 } },
  { id: 'p-17', name: '蔡宇翔', number: '2', teamId: 'team-6', teamName: '猛虎队', position: 'SG', height: '176cm', weight: '70kg', age: 15, avatarUrl: '', stats: { gamesPlayed: 10, pointsPerGame: 13.2, reboundsPerGame: 3.8, assistsPerGame: 4.0, stealsPerGame: 1.5, blocksPerGame: 0.3, fieldGoalPct: 0.43, threePointPct: 0.36, freeThrowPct: 0.81 } },
  { id: 'p-18', name: '谢宝成', number: '32', teamId: 'team-6', teamName: '猛虎队', position: 'C', height: '191cm', weight: '93kg', age: 16, avatarUrl: '', stats: { gamesPlayed: 10, pointsPerGame: 10.5, reboundsPerGame: 9.2, assistsPerGame: 0.8, stealsPerGame: 0.5, blocksPerGame: 2.8, fieldGoalPct: 0.60, threePointPct: 0.0, freeThrowPct: 0.55 } },
  // 天马队
  { id: 'p-19', name: '魏子豪', number: '30', teamId: 'team-7', teamName: '天马队', position: 'SG', height: '179cm', weight: '73kg', age: 15, avatarUrl: '', stats: { gamesPlayed: 10, pointsPerGame: 19.5, reboundsPerGame: 4.0, assistsPerGame: 3.8, stealsPerGame: 1.6, blocksPerGame: 0.4, fieldGoalPct: 0.44, threePointPct: 0.43, freeThrowPct: 0.87 } },
  { id: 'p-20', name: '庄浩然', number: '13', teamId: 'team-7', teamName: '天马队', position: 'PF', height: '183cm', weight: '80kg', age: 15, avatarUrl: '', stats: { gamesPlayed: 10, pointsPerGame: 12.0, reboundsPerGame: 8.5, assistsPerGame: 1.9, stealsPerGame: 1.0, blocksPerGame: 1.6, fieldGoalPct: 0.50, threePointPct: 0.32, freeThrowPct: 0.73 } },
  { id: 'p-21', name: '袁睿', number: '17', teamId: 'team-7', teamName: '天马队', position: 'PG', height: '169cm', weight: '61kg', age: 14, avatarUrl: '', stats: { gamesPlayed: 10, pointsPerGame: 8.5, reboundsPerGame: 2.8, assistsPerGame: 7.0, stealsPerGame: 1.8, blocksPerGame: 0.1, fieldGoalPct: 0.40, threePointPct: 0.31, freeThrowPct: 0.78 } },
  // 骑士队
  { id: 'p-22', name: '韩子阳', number: '1', teamId: 'team-8', teamName: '骑士队', position: 'SF', height: '180cm', weight: '75kg', age: 13, avatarUrl: '', stats: { gamesPlayed: 10, pointsPerGame: 14.0, reboundsPerGame: 5.2, assistsPerGame: 2.8, stealsPerGame: 1.3, blocksPerGame: 0.6, fieldGoalPct: 0.45, threePointPct: 0.35, freeThrowPct: 0.76 } },
  { id: 'p-23', name: '冯宇', number: '20', teamId: 'team-8', teamName: '骑士队', position: 'PG', height: '168cm', weight: '60kg', age: 13, avatarUrl: '', stats: { gamesPlayed: 10, pointsPerGame: 9.2, reboundsPerGame: 3.1, assistsPerGame: 5.8, stealsPerGame: 1.4, blocksPerGame: 0.2, fieldGoalPct: 0.39, threePointPct: 0.30, freeThrowPct: 0.77 } },
  { id: 'p-24', name: '邓博文', number: '44', teamId: 'team-8', teamName: '骑士队', position: 'C', height: '188cm', weight: '88kg', age: 14, avatarUrl: '', stats: { gamesPlayed: 10, pointsPerGame: 8.8, reboundsPerGame: 8.0, assistsPerGame: 0.7, stealsPerGame: 0.4, blocksPerGame: 2.0, fieldGoalPct: 0.56, threePointPct: 0.0, freeThrowPct: 0.52 } },
]

export const mockGames: Game[] = [
  // Past games (finished)
  { id: 'g-1', leagueId: 'league-2026-spring', homeTeamId: 'team-1', awayTeamId: 'team-3', homeTeamName: '飞鹰队', awayTeamName: '猎豹队', homeScore: 72, awayScore: 58, date: '2026-06-14', time: '10:00', venue: '青少年体育馆A馆', status: 'finished', week: 15 },
  { id: 'g-2', leagueId: 'league-2026-spring', homeTeamId: 'team-2', awayTeamId: 'team-4', homeTeamName: '雷霆队', awayTeamName: '海豚队', homeScore: 65, awayScore: 68, date: '2026-06-14', time: '14:00', venue: '市体育中心篮球馆', status: 'finished', week: 15 },
  { id: 'g-3', leagueId: 'league-2026-spring', homeTeamId: 'team-5', awayTeamId: 'team-7', homeTeamName: '雄鹿队', awayTeamName: '天马队', homeScore: 80, awayScore: 75, date: '2026-06-14', time: '16:00', venue: '青少年体育馆B馆', status: 'finished', week: 15 },
  { id: 'g-4', leagueId: 'league-2026-spring', homeTeamId: 'team-6', awayTeamId: 'team-8', homeTeamName: '猛虎队', awayTeamName: '骑士队', homeScore: 55, awayScore: 48, date: '2026-06-15', time: '10:00', venue: '青少年体育馆A馆', status: 'finished', week: 15 },
  { id: 'g-5', leagueId: 'league-2026-spring', homeTeamId: 'team-1', awayTeamId: 'team-2', homeTeamName: '飞鹰队', awayTeamName: '雷霆队', homeScore: 78, awayScore: 82, date: '2026-06-21', time: '10:00', venue: '市体育中心篮球馆', status: 'finished', week: 16 },
  { id: 'g-6', leagueId: 'league-2026-spring', homeTeamId: 'team-3', awayTeamId: 'team-5', homeTeamName: '猎豹队', awayTeamName: '雄鹿队', homeScore: 66, awayScore: 60, date: '2026-06-21', time: '14:00', venue: '青少年体育馆A馆', status: 'finished', week: 16 },
  // Upcoming games
  { id: 'g-7', leagueId: 'league-2026-spring', homeTeamId: 'team-4', awayTeamId: 'team-6', homeTeamName: '海豚队', awayTeamName: '猛虎队', homeScore: null, awayScore: null, date: '2026-06-28', time: '10:00', venue: '青少年体育馆B馆', status: 'upcoming', week: 17 },
  { id: 'g-8', leagueId: 'league-2026-spring', homeTeamId: 'team-2', awayTeamId: 'team-7', homeTeamName: '雷霆队', awayTeamName: '天马队', homeScore: null, awayScore: null, date: '2026-06-28', time: '14:00', venue: '青少年体育馆A馆', status: 'upcoming', week: 17 },
  { id: 'g-9', leagueId: 'league-2026-spring', homeTeamId: 'team-1', awayTeamId: 'team-5', homeTeamName: '飞鹰队', awayTeamName: '雄鹿队', homeScore: null, awayScore: null, date: '2026-06-28', time: '16:00', venue: '市体育中心篮球馆', status: 'upcoming', week: 17 },
  { id: 'g-10', leagueId: 'league-2026-spring', homeTeamId: 'team-8', awayTeamId: 'team-3', homeTeamName: '骑士队', awayTeamName: '猎豹队', homeScore: null, awayScore: null, date: '2026-06-29', time: '10:00', venue: '青少年体育馆A馆', status: 'upcoming', week: 17 },
  { id: 'g-11', leagueId: 'league-2026-spring', homeTeamId: 'team-3', awayTeamId: 'team-1', homeTeamName: '猎豹队', awayTeamName: '飞鹰队', homeScore: null, awayScore: null, date: '2026-07-05', time: '10:00', venue: '市体育中心篮球馆', status: 'upcoming', week: 18 },
  { id: 'g-12', leagueId: 'league-2026-spring', homeTeamId: 'team-2', awayTeamId: 'team-4', homeTeamName: '雷霆队', awayTeamName: '海豚队', homeScore: null, awayScore: null, date: '2026-07-05', time: '14:00', venue: '青少年体育馆B馆', status: 'upcoming', week: 18 },
]

export const mockStandings: Standing[] = [
  { rank: 1, teamId: 'team-1', teamName: '飞鹰队', wins: 8, losses: 2, winPct: 0.8, pointsFor: 756, pointsAgainst: 680, streak: 'W3', last5: ['W', 'L', 'W', 'W', 'W'] },
  { rank: 2, teamId: 'team-2', teamName: '雷霆队', wins: 7, losses: 3, winPct: 0.7, pointsFor: 732, pointsAgainst: 695, streak: 'W2', last5: ['W', 'W', 'L', 'W', 'W'] },
  { rank: 3, teamId: 'team-3', teamName: '猎豹队', wins: 6, losses: 4, winPct: 0.6, pointsFor: 710, pointsAgainst: 688, streak: 'W1', last5: ['W', 'L', 'L', 'W', 'W'] },
  { rank: 4, teamId: 'team-4', teamName: '海豚队', wins: 6, losses: 4, winPct: 0.6, pointsFor: 698, pointsAgainst: 672, streak: 'L1', last5: ['W', 'W', 'L', 'W', 'L'] },
  { rank: 5, teamId: 'team-5', teamName: '雄鹿队', wins: 5, losses: 5, winPct: 0.5, pointsFor: 670, pointsAgainst: 680, streak: 'W1', last5: ['L', 'W', 'L', 'L', 'W'] },
  { rank: 6, teamId: 'team-6', teamName: '猛虎队', wins: 4, losses: 6, winPct: 0.4, pointsFor: 625, pointsAgainst: 668, streak: 'L2', last5: ['L', 'L', 'W', 'L', 'W'] },
  { rank: 7, teamId: 'team-7', teamName: '天马队', wins: 3, losses: 7, winPct: 0.3, pointsFor: 598, pointsAgainst: 655, streak: 'L3', last5: ['L', 'L', 'L', 'W', 'L'] },
  { rank: 8, teamId: 'team-8', teamName: '骑士队', wins: 1, losses: 9, winPct: 0.1, pointsFor: 542, pointsAgainst: 720, streak: 'L5', last5: ['L', 'L', 'L', 'L', 'W'] },
]

export const mockAnnouncements: Announcement[] = [
  {
    id: 'a-1',
    title: '🏆 季后赛资格公告',
    content: '经过第16周常规赛，飞鹰队、雷霆队、猎豹队、海豚队已确定进入季后赛。季后赛将于7月12日正式开始，欢迎各支球队家长和球迷到场加油！\n\n季后赛赛程将另行通知，请关注联赛公告。',
    createdAt: '2026-06-22T09:00:00Z',
    authorName: '联赛委员会',
    isPinned: true,
    tags: ['季后赛', '重要通知'],
  },
  {
    id: 'a-2',
    title: '第17周赛程安排',
    content: '第17周比赛将于本周六（6月28日）和周日（6月29日）在青少年体育馆和市体育中心举行。请各队提前30分钟到场热身，家长请注意观赛礼仪。\n\n详细赛程请查看"赛程"页面。',
    createdAt: '2026-06-25T10:00:00Z',
    authorName: '赛事组委会',
    isPinned: false,
    tags: ['赛程', '第17周'],
  },
  {
    id: 'a-3',
    title: '球员安全与健康提醒',
    content: '夏季气温较高，请各位家长和教练注意：\n1. 比赛前后确保球员充分补水\n2. 训练时间避开正午高温时段\n3. 如球员出现不适，请立即告知教练\n4. 场馆内备有急救箱，如需帮助请联系工作人员',
    createdAt: '2026-06-20T08:00:00Z',
    authorName: '医务组',
    isPinned: false,
    tags: ['健康', '安全'],
  },
  {
    id: 'a-4',
    title: '球馆维修通知',
    content: '青少年体育馆A馆将于7月1日至7月3日进行地板维修，期间A馆所有场次将临时调整至B馆或市体育中心。具体变更将单独通知各队教练。',
    createdAt: '2026-06-18T14:00:00Z',
    authorName: '场馆管理部',
    isPinned: false,
    tags: ['场馆', '通知'],
  },
  {
    id: 'a-5',
    title: '欢迎加入2026春季联赛！',
    content: '感谢所有球队、教练、家长和球员参与2026春季青少年篮球联赛。本联赛旨在为青少年提供一个公平、快乐、成长的篮球平台。如有任何问题，请拨打联赛热线：400-888-8888。',
    createdAt: '2026-03-01T09:00:00Z',
    authorName: '蓝图青少年体育协会',
    isPinned: false,
    tags: ['欢迎', '联赛介绍'],
  },
]

export const mockPosts: Post[] = [
  {
    id: 'post-1',
    authorId: 'user-1',
    authorName: '飞鹰队家长群',
    authorAvatarUrl: '',
    title: '今天飞鹰队赢了！孩子们太棒了！',
    content: '刚看完第15周和猎豹队的比赛，飞鹰队以72比58大胜！陈小明今天状态超级好，连续命中三分，全场18分！孩子们的配合越来越默契，张教练的训练效果真的很好！为飞鹰队加油！🏀',
    imageUrls: [],
    createdAt: '2026-06-14T16:30:00Z',
    likeCount: 24,
    commentCount: 8,
    tags: ['飞鹰队', '比赛日'],
    comments: [
      { id: 'c-1', postId: 'post-1', authorId: 'user-2', authorName: '林大伟妈妈', authorAvatarUrl: '', content: '太棒了！我儿子今天的篮板也抢得很好！', createdAt: '2026-06-14T16:45:00Z', likeCount: 5 },
      { id: 'c-2', postId: 'post-1', authorId: 'user-3', authorName: '张浩然爸爸', authorAvatarUrl: '', content: '孩子们都很努力，为所有队员骄傲！', createdAt: '2026-06-14T17:00:00Z', likeCount: 3 },
      { id: 'c-3', postId: 'post-1', authorId: 'user-4', authorName: '张教练', authorAvatarUrl: '', content: '孩子们确实发挥得很好，继续努力！下周还有硬仗。', createdAt: '2026-06-14T18:00:00Z', likeCount: 8 },
    ],
  },
  {
    id: 'post-2',
    authorId: 'user-5',
    authorName: '王志远爸爸',
    authorAvatarUrl: '',
    title: '雷霆队训练花絮',
    content: '昨天去接孩子，顺手拍了几张训练照片。雷霆队的孩子们练习三分球投篮，志远今天练习非常认真，李教练对他要求很严格。看到孩子在成长，真的很欣慰！加油雷霆！',
    imageUrls: [],
    createdAt: '2026-06-23T19:15:00Z',
    likeCount: 18,
    commentCount: 4,
    tags: ['雷霆队', '训练'],
    comments: [
      { id: 'c-4', postId: 'post-2', authorId: 'user-6', authorName: '刘宇航妈妈', authorAvatarUrl: '', content: '我儿子也说志远这周进步特别大！', createdAt: '2026-06-23T19:30:00Z', likeCount: 4 },
      { id: 'c-5', postId: 'post-2', authorId: 'user-7', authorName: '李教练', authorAvatarUrl: '', content: '大家继续加油，下周争取拿到主场胜利！', createdAt: '2026-06-23T20:00:00Z', likeCount: 6 },
    ],
  },
  {
    id: 'post-3',
    authorId: 'user-8',
    authorName: '联赛助理',
    authorAvatarUrl: '',
    title: '第16周精彩瞬间回顾',
    content: '第16周联赛圆满结束！本周最佳：飞鹰队VS雷霆队的对决打得非常激烈，最终雷霆队以82比78逆转飞鹰队，王志远全场27分成为本周MVP候选。猎豹队也以稳健表现击败雄鹿队，本周精彩内容回顾请关注联赛公告。',
    imageUrls: [],
    createdAt: '2026-06-22T10:00:00Z',
    likeCount: 42,
    commentCount: 12,
    tags: ['精彩回顾', '第16周'],
    comments: [
      { id: 'c-6', postId: 'post-3', authorId: 'user-2', authorName: '林大伟妈妈', authorAvatarUrl: '', content: '那场飞鹰VS雷霆真的太好看了，输了可惜！', createdAt: '2026-06-22T10:30:00Z', likeCount: 7 },
      { id: 'c-7', postId: 'post-3', authorId: 'user-1', authorName: '飞鹰队家长群', authorAvatarUrl: '', content: '飞鹰下周再来！为孩子们加油！', createdAt: '2026-06-22T11:00:00Z', likeCount: 5 },
    ],
  },
  {
    id: 'post-4',
    authorId: 'user-9',
    authorName: '骑士队妈妈团',
    authorAvatarUrl: '',
    title: '骑士宝贝们，继续加油！',
    content: '虽然骑士队这赛季战绩不理想，但看到孩子们每场比赛都在进步，作为家长真的很骄傲。胜负不是最重要的，孩子们学到了团队合作和永不放弃的精神，这才是最宝贵的！骑士加油！💪',
    imageUrls: [],
    createdAt: '2026-06-20T21:00:00Z',
    likeCount: 56,
    commentCount: 15,
    tags: ['骑士队', '正能量'],
    comments: [
      { id: 'c-8', postId: 'post-4', authorId: 'user-10', authorName: '飞鹰队家长', authorAvatarUrl: '', content: '为骑士队加油！精神最重要！', createdAt: '2026-06-20T21:30:00Z', likeCount: 10 },
      { id: 'c-9', postId: 'post-4', authorId: 'user-11', authorName: '周教练', authorAvatarUrl: '', content: '谢谢家长们的支持！孩子们都在成长，未来可期！', createdAt: '2026-06-20T22:00:00Z', likeCount: 12 },
    ],
  },
  {
    id: 'post-5',
    authorId: 'user-12',
    authorName: '孙建国妈妈',
    authorAvatarUrl: '',
    title: '求推荐：球鞋选购经验分享',
    content: '孩子最近说脚不舒服，想给他换双篮球鞋。请问各位家长有什么推荐？孩子脚型比较宽，上次买的鞋有点夹脚。价格不用太贵，适合训练和比赛都能穿的就好。谢谢！',
    imageUrls: [],
    createdAt: '2026-06-19T15:30:00Z',
    likeCount: 12,
    commentCount: 8,
    tags: ['装备', '经验分享'],
    comments: [
      { id: 'c-10', postId: 'post-5', authorId: 'user-13', authorName: '陈小明爸爸', authorAvatarUrl: '', content: '我们买的是耐克EP系列，宽脚专用，孩子很喜欢！', createdAt: '2026-06-19T15:45:00Z', likeCount: 6 },
      { id: 'c-11', postId: 'post-5', authorId: 'user-14', authorName: '王志远妈妈', authorAvatarUrl: '', content: '李宁也有宽楦款，国产品牌性价比高，可以考虑！', createdAt: '2026-06-19T16:00:00Z', likeCount: 4 },
    ],
  },
  {
    id: 'post-6',
    authorId: 'user-15',
    authorName: '魏子豪爸爸',
    authorAvatarUrl: '',
    title: '天马队本周末大战雷霆，欢迎加油！',
    content: '本周六下午2点，天马队将在青少年体育馆A馆对阵雷霆队。天马队上周训练状态非常好，子豪的三分球感觉越来越准。欢迎各位家长到场加油助威！赛后我们在场馆外聚餐，有意向的家长请私聊我！',
    imageUrls: [],
    createdAt: '2026-06-25T20:00:00Z',
    likeCount: 20,
    commentCount: 6,
    tags: ['天马队', '预告'],
    comments: [
      { id: 'c-12', postId: 'post-6', authorId: 'user-16', authorName: '庄浩然妈妈', authorAvatarUrl: '', content: '一定到！天马加油！', createdAt: '2026-06-25T20:15:00Z', likeCount: 3 },
      { id: 'c-13', postId: 'post-6', authorId: 'user-17', authorName: '孙教练', authorAvatarUrl: '', content: '感谢家长的支持！孩子们会全力以赴的！', createdAt: '2026-06-25T21:00:00Z', likeCount: 5 },
    ],
  },
]

export const mockCurrentUser: User = {
  id: '',
  openId: '',
  nickName: '',
  avatarUrl: '',
  role: 'parent',
}
