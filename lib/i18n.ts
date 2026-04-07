export type Lang = "zh" | "en";

const TEAM_MAP: Record<string, { en: string; zh: string }> = {
  ATL: { en: "Atlanta Hawks", zh: "老鹰" },
  BOS: { en: "Boston Celtics", zh: "凯尔特人" },
  BKN: { en: "Brooklyn Nets", zh: "篮网" },
  CHA: { en: "Charlotte Hornets", zh: "黄蜂" },
  CHI: { en: "Chicago Bulls", zh: "公牛" },
  CLE: { en: "Cleveland Cavaliers", zh: "骑士" },
  DAL: { en: "Dallas Mavericks", zh: "独行侠" },
  DEN: { en: "Denver Nuggets", zh: "掘金" },
  DET: { en: "Detroit Pistons", zh: "活塞" },
  GSW: { en: "Golden State Warriors", zh: "勇士" },
  HOU: { en: "Houston Rockets", zh: "火箭" },
  IND: { en: "Indiana Pacers", zh: "步行者" },
  LAC: { en: "LA Clippers", zh: "快船" },
  LAL: { en: "Los Angeles Lakers", zh: "湖人" },
  MEM: { en: "Memphis Grizzlies", zh: "灰熊" },
  MIA: { en: "Miami Heat", zh: "热火" },
  MIL: { en: "Milwaukee Bucks", zh: "雄鹿" },
  MIN: { en: "Minnesota Timberwolves", zh: "森林狼" },
  NOP: { en: "New Orleans Pelicans", zh: "鹈鹕" },
  NYK: { en: "New York Knicks", zh: "尼克斯" },
  OKC: { en: "Oklahoma City Thunder", zh: "雷霆" },
  ORL: { en: "Orlando Magic", zh: "魔术" },
  PHI: { en: "Philadelphia 76ers", zh: "76人" },
  PHX: { en: "Phoenix Suns", zh: "太阳" },
  POR: { en: "Portland Trail Blazers", zh: "开拓者" },
  SAC: { en: "Sacramento Kings", zh: "国王" },
  SAS: { en: "San Antonio Spurs", zh: "马刺" },
  TOR: { en: "Toronto Raptors", zh: "猛龙" },
  UTA: { en: "Utah Jazz", zh: "爵士" },
  WAS: { en: "Washington Wizards", zh: "奇才" },
};

const ALIAS_TO_CODE = Object.entries(TEAM_MAP).reduce<Record<string, string>>((acc, [code, names]) => {
  acc[code.toLowerCase()] = code;
  acc[names.en.toLowerCase()] = code;
  acc[names.zh.toLowerCase()] = code;
  return acc;
}, {});

export function normalizeTeamCode(raw: string | null | undefined): string {
  if (!raw) return "N/A";
  const normalized = ALIAS_TO_CODE[raw.trim().toLowerCase()];
  return normalized ?? raw;
}

export function translateTeam(raw: string | null | undefined, lang: Lang): string {
  const code = normalizeTeamCode(raw);
  const team = TEAM_MAP[code];
  if (!team) return code;
  return lang === "zh" ? team.zh : team.en;
}
