export type HeroPlayer = {
  id: string;
  season: string;
  name: string;
  nameZh: string;
  team: string;
  teamZh: string;
  number: string;
  position: string;
  portraitImage: string;
  jerseyImage: string;
  accent: string;
  accentLight: string;
  pts: string;
  reb: string;
  ast: string;
};

export const TEAM_ZH: Record<string, string> = {
  ATL: "老鹰", BOS: "凯尔特人", BKN: "篮网", CHA: "黄蜂", CHI: "公牛",
  CLE: "骑士", DAL: "独行侠", DEN: "掘金", DET: "活塞", GSW: "勇士",
  HOU: "火箭", IND: "步行者", LAC: "快船", LAL: "湖人", MEM: "灰熊",
  MIA: "热火", MIL: "雄鹿", MIN: "森林狼", NOP: "鹈鹕", NYK: "尼克斯",
  OKC: "雷霆", ORL: "魔术", PHI: "76人", PHX: "太阳", POR: "开拓者",
  SAC: "国王", SAS: "马刺", TOR: "猛龙", UTA: "爵士", WAS: "奇才",
};

const NBA_HEADSHOT = (id: number) =>
  `https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`;

export const HERO_PLAYERS: HeroPlayer[] = [
  {
    id: "lebron", season: "2025-26", name: "LeBron James", nameZh: "勒布朗·詹姆斯",
    team: "LAL", teamZh: "湖人", number: "23", position: "SF",
    portraitImage: NBA_HEADSHOT(2544), jerseyImage: NBA_HEADSHOT(2544),
    accent: "#552583", accentLight: "#FDB927",
    pts: "25.7", reb: "7.3", ast: "8.3",
  },
  {
    id: "jokic", season: "2025-26", name: "Nikola Jokić", nameZh: "尼古拉·约基奇",
    team: "DEN", teamZh: "掘金", number: "15", position: "C",
    portraitImage: NBA_HEADSHOT(203999), jerseyImage: NBA_HEADSHOT(203999),
    accent: "#0E2240", accentLight: "#FEC524",
    pts: "26.4", reb: "12.4", ast: "9.0",
  },
  {
    id: "curry", season: "2025-26", name: "Stephen Curry", nameZh: "斯蒂芬·库里",
    team: "GSW", teamZh: "勇士", number: "30", position: "PG",
    portraitImage: NBA_HEADSHOT(201939), jerseyImage: NBA_HEADSHOT(201939),
    accent: "#1D428A", accentLight: "#FFC72C",
    pts: "26.4", reb: "4.5", ast: "6.1",
  },
  {
    id: "giannis", season: "2025-26", name: "Giannis Antetokounmpo", nameZh: "扬尼斯·字母哥",
    team: "MIL", teamZh: "雄鹿", number: "34", position: "PF",
    portraitImage: NBA_HEADSHOT(203507), jerseyImage: NBA_HEADSHOT(203507),
    accent: "#00471B", accentLight: "#EEE1C6",
    pts: "31.1", reb: "11.9", ast: "5.7",
  },
  {
    id: "luka", season: "2025-26", name: "Luka Dončić", nameZh: "卢卡·东契奇",
    team: "DAL", teamZh: "独行侠", number: "77", position: "PG",
    portraitImage: NBA_HEADSHOT(1629029), jerseyImage: NBA_HEADSHOT(1629029),
    accent: "#00538C", accentLight: "#B8C4CA",
    pts: "33.9", reb: "9.2", ast: "9.8",
  },
  {
    id: "shai", season: "2025-26", name: "Shai Gilgeous-Alexander", nameZh: "亚历山大",
    team: "OKC", teamZh: "雷霆", number: "2", position: "SG",
    portraitImage: NBA_HEADSHOT(1628983), jerseyImage: NBA_HEADSHOT(1628983),
    accent: "#007AC1", accentLight: "#EF6100",
    pts: "30.1", reb: "5.5", ast: "6.2",
  },
  {
    id: "tatum", season: "2025-26", name: "Jayson Tatum", nameZh: "杰森·塔图姆",
    team: "BOS", teamZh: "凯尔特人", number: "0", position: "SF",
    portraitImage: NBA_HEADSHOT(1628369), jerseyImage: NBA_HEADSHOT(1628369),
    accent: "#007A33", accentLight: "#BA9653",
    pts: "26.9", reb: "8.1", ast: "4.9",
  },
  {
    id: "embiid", season: "2025-26", name: "Joel Embiid", nameZh: "乔尔·恩比德",
    team: "PHI", teamZh: "76人", number: "21", position: "C",
    portraitImage: NBA_HEADSHOT(203954), jerseyImage: NBA_HEADSHOT(203954),
    accent: "#006BB6", accentLight: "#ED174C",
    pts: "34.7", reb: "11.0", ast: "5.6",
  },
  {
    id: "durant", season: "2025-26", name: "Kevin Durant", nameZh: "凯文·杜兰特",
    team: "PHX", teamZh: "太阳", number: "35", position: "PF",
    portraitImage: NBA_HEADSHOT(201142), jerseyImage: NBA_HEADSHOT(201142),
    accent: "#1D1160", accentLight: "#E56020",
    pts: "27.1", reb: "6.6", ast: "5.0",
  },
  {
    id: "ad", season: "2025-26", name: "Anthony Davis", nameZh: "安东尼·戴维斯",
    team: "LAL", teamZh: "湖人", number: "3", position: "PF",
    portraitImage: NBA_HEADSHOT(203076), jerseyImage: NBA_HEADSHOT(203076),
    accent: "#552583", accentLight: "#FDB927",
    pts: "24.7", reb: "12.6", ast: "3.5",
  },
  {
    id: "ant", season: "2025-26", name: "Anthony Edwards", nameZh: "安东尼·爱德华兹",
    team: "MIN", teamZh: "森林狼", number: "5", position: "SG",
    portraitImage: NBA_HEADSHOT(1630162), jerseyImage: NBA_HEADSHOT(1630162),
    accent: "#0C2340", accentLight: "#236192",
    pts: "25.9", reb: "5.4", ast: "5.1",
  },
  {
    id: "wemby", season: "2025-26", name: "Victor Wembanyama", nameZh: "文班亚马",
    team: "SAS", teamZh: "马刺", number: "1", position: "C",
    portraitImage: NBA_HEADSHOT(1641705), jerseyImage: NBA_HEADSHOT(1641705),
    accent: "#C4CED4", accentLight: "#000000",
    pts: "21.4", reb: "10.6", ast: "3.9",
  },
  {
    id: "lamelo", season: "2025-26", name: "LaMelo Ball", nameZh: "拉梅洛·鲍尔",
    team: "CHA", teamZh: "黄蜂", number: "1", position: "PG",
    portraitImage: NBA_HEADSHOT(1630163), jerseyImage: NBA_HEADSHOT(1630163),
    accent: "#1D1160", accentLight: "#00788C",
    pts: "23.9", reb: "5.1", ast: "8.0",
  },
  {
    id: "paolo", season: "2025-26", name: "Paolo Banchero", nameZh: "保罗·班凯罗",
    team: "ORL", teamZh: "魔术", number: "5", position: "PF",
    portraitImage: NBA_HEADSHOT(1631094), jerseyImage: NBA_HEADSHOT(1631094),
    accent: "#0077C0", accentLight: "#C4CED4",
    pts: "22.6", reb: "6.9", ast: "5.4",
  },
  {
    id: "dame", season: "2025-26", name: "Damian Lillard", nameZh: "达米安·利拉德",
    team: "MIL", teamZh: "雄鹿", number: "0", position: "PG",
    portraitImage: NBA_HEADSHOT(203081), jerseyImage: NBA_HEADSHOT(203081),
    accent: "#00471B", accentLight: "#EEE1C6",
    pts: "24.3", reb: "4.4", ast: "7.0",
  },
  {
    id: "booker", season: "2025-26", name: "Devin Booker", nameZh: "德文·布克",
    team: "PHX", teamZh: "太阳", number: "1", position: "SG",
    portraitImage: NBA_HEADSHOT(1626164), jerseyImage: NBA_HEADSHOT(1626164),
    accent: "#1D1160", accentLight: "#E56020",
    pts: "27.1", reb: "4.5", ast: "6.9",
  },
  {
    id: "brunson", season: "2025-26", name: "Jalen Brunson", nameZh: "杰伦·布伦森",
    team: "NYK", teamZh: "尼克斯", number: "11", position: "PG",
    portraitImage: NBA_HEADSHOT(1628973), jerseyImage: NBA_HEADSHOT(1628973),
    accent: "#006BB6", accentLight: "#F58426",
    pts: "28.7", reb: "3.5", ast: "6.7",
  },
  {
    id: "fox", season: "2025-26", name: "De'Aaron Fox", nameZh: "福克斯",
    team: "SAC", teamZh: "国王", number: "5", position: "PG",
    portraitImage: NBA_HEADSHOT(1628368), jerseyImage: NBA_HEADSHOT(1628368),
    accent: "#5A2D81", accentLight: "#63727A",
    pts: "26.6", reb: "4.6", ast: "5.6",
  },
  {
    id: "morant", season: "2025-26", name: "Ja Morant", nameZh: "贾·莫兰特",
    team: "MEM", teamZh: "灰熊", number: "12", position: "PG",
    portraitImage: NBA_HEADSHOT(1629630), jerseyImage: NBA_HEADSHOT(1629630),
    accent: "#5D76A9", accentLight: "#12173F",
    pts: "25.1", reb: "5.6", ast: "8.1",
  },
  {
    id: "mitchell", season: "2025-26", name: "Donovan Mitchell", nameZh: "多诺万·米切尔",
    team: "CLE", teamZh: "骑士", number: "45", position: "SG",
    portraitImage: NBA_HEADSHOT(1628378), jerseyImage: NBA_HEADSHOT(1628378),
    accent: "#860038", accentLight: "#FDBB30",
    pts: "26.6", reb: "5.1", ast: "4.5",
  },
  {
    id: "tyrese", season: "2025-26", name: "Tyrese Haliburton", nameZh: "泰里斯·哈利伯顿",
    team: "IND", teamZh: "步行者", number: "0", position: "PG",
    portraitImage: NBA_HEADSHOT(1630169), jerseyImage: NBA_HEADSHOT(1630169),
    accent: "#002D62", accentLight: "#FDBB30",
    pts: "20.7", reb: "3.7", ast: "10.9",
  },
];
