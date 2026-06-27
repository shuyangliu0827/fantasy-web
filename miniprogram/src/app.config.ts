export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/schedule/index',
    'pages/standings/index',
    'pages/community/index',
    'pages/profile/index',
    'pages/teams/index',
    'pages/team-detail/index',
    'pages/player-detail/index',
    'pages/announcements/index',
    'pages/post-detail/index',
    'pages/create-post/index',
  ],
  tabBar: {
    color: '#9ca3af',
    selectedColor: '#f97316',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '首页',
        iconPath: 'assets/icons/home.png',
        selectedIconPath: 'assets/icons/home-active.png',
      },
      {
        pagePath: 'pages/schedule/index',
        text: '赛程',
        iconPath: 'assets/icons/schedule.png',
        selectedIconPath: 'assets/icons/schedule-active.png',
      },
      {
        pagePath: 'pages/standings/index',
        text: '排名',
        iconPath: 'assets/icons/standings.png',
        selectedIconPath: 'assets/icons/standings-active.png',
      },
      {
        pagePath: 'pages/community/index',
        text: '社区',
        iconPath: 'assets/icons/community.png',
        selectedIconPath: 'assets/icons/community-active.png',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/icons/profile.png',
        selectedIconPath: 'assets/icons/profile-active.png',
      },
    ],
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#1e3a5f',
    navigationBarTitleText: '青少年篮球联赛',
    navigationBarTextStyle: 'white',
  },
})
