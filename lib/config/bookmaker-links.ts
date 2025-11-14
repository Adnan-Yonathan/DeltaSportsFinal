const BOOKMAKER_LINKS: Record<string, string> = {
  draftkings: 'https://sportsbook.draftkings.com/',
  'draft-kings': 'https://sportsbook.draftkings.com/',

  fanduel: 'https://sportsbook.fanduel.com/',
  'fan-duel': 'https://sportsbook.fanduel.com/',

  bovada: 'https://www.bovada.lv/sports',
  'bovada-lv': 'https://www.bovada.lv/sports',

  betmgm: 'https://www.betmgm.com/en/sports',
  'bet-mgm': 'https://www.betmgm.com/en/sports',

  stake: 'https://stake.com/sports/home',

  betfanatics: 'https://betfanatics.com/sportsbook',
  fanatics: 'https://betfanatics.com/sportsbook',
  'bet-fanatics': 'https://betfanatics.com/sportsbook',

  bet365: 'https://www.bet365.com/',
  'bet-365': 'https://www.bet365.com/',

  caesars: 'https://sportsbook.caesars.com/',

  pinnacle: 'https://www.pinnacle.com/',

  betrivers: 'https://www.betrivers.com',
  'bet-rivers': 'https://www.betrivers.com',

  fliff: 'https://www.getfliff.com/',

  hardrock: 'https://www.hardrock.bet/sportsbook/',
  'hard-rock': 'https://www.hardrock.bet/sportsbook/',

  pointsbet: 'https://join.pointsbet.com/',
  'points-bet': 'https://join.pointsbet.com/',
}

export function getBookmakerLink(slug: string): string | undefined {
  return BOOKMAKER_LINKS[slug]
}
