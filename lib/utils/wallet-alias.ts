const ADJECTIVES = [
  'Brave',
  'Calm',
  'Clever',
  'Daring',
  'Electric',
  'Fierce',
  'Focused',
  'Golden',
  'Iron',
  'Jade',
  'Keen',
  'Lucky',
  'Mighty',
  'Nimble',
  'Noble',
  'Rapid',
  'Quiet',
  'Sharp',
  'Silver',
  'Solar',
  'Solid',
  'Swift',
  'True',
  'Vivid',
  'Wild',
  'Witty',
  'Zen',
  'Crimson',
  'Amber',
  'Azure',
  'Onyx',
  'Ivory',
]

const NOUNS = [
  'Falcon',
  'Wolf',
  'Panther',
  'Shark',
  'Hawk',
  'Bear',
  'Lion',
  'Eagle',
  'Raven',
  'Tiger',
  'Stag',
  'Otter',
  'Fox',
  'Cobra',
  'Viper',
  'Orca',
  'Whale',
  'Stallion',
  'Lynx',
  'Bull',
  'Badger',
  'Drake',
  'Osprey',
  'Puma',
  'Dolphin',
  'Python',
  'Crane',
  'Heron',
  'Ibex',
  'Gryphon',
  'Raptor',
  'Kodiak',
]

const hashWallet = (value: string) => {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24)
  }
  return hash >>> 0
}

export const getWalletAlias = (wallet?: string | null) => {
  if (!wallet) return 'Unknown'
  const normalized = wallet.trim().toLowerCase()
  if (!normalized) return 'Unknown'
  const hash = hashWallet(normalized)
  const adjective = ADJECTIVES[hash % ADJECTIVES.length]
  const noun = NOUNS[(hash >> 8) % NOUNS.length]
  const number = (hash % 97) + 1
  return `${adjective} ${noun} ${number}`
}
