/**
 * Test ESPN Injuries API directly
 */

async function test() {
  const url = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries'

  console.log('Fetching injuries from ESPN...')
  console.log(`URL: ${url}\n`)

  try {
    const res = await fetch(url, { cache: 'no-store' })
    console.log(`Response status: ${res.status}`)
    console.log(`Response OK: ${res.ok}\n`)

    if (!res.ok) {
      console.log('❌ Failed to fetch from ESPN')
      const text = await res.text()
      console.log('Response text:', text.substring(0, 500))
      return
    }

    const data = await res.json()
    console.log('Response keys:', Object.keys(data))

    const teams = data.injuries || []

    if (teams.length === 0) {
      console.log('❌ No teams in injuries array')
      console.log('Full response:', JSON.stringify(data, null, 2).substring(0, 1000))
      return
    }

    console.log(`✅ Found ${teams.length} teams with injury data\n`)

    for (const team of teams) {
      const teamName = team.displayName || 'Unknown'
      const injuries = team.injuries || []

      if (injuries.length === 0) continue

      console.log(`\n${teamName}:`)
      for (const injury of injuries) {
        const player = injury.athlete?.displayName || 'Unknown'
        const status = injury.status || 'Unknown'
        const type = injury.details?.type || 'N/A'
        const comment = injury.longComment || ''

        console.log(`  - ${player}`)
        console.log(`    Status: ${status}`)
        console.log(`    Type: ${type}`)
        if (comment) {
          console.log(`    Note: ${comment.substring(0, 100)}...`)
        }
      }
    }
  } catch (err) {
    console.error('❌ Error:', err)
  }
}

test()
