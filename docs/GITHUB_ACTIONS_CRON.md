# GitHub Actions Cron Jobs Setup

This project uses GitHub Actions to run scheduled tasks (cron jobs) for free, instead of Vercel's paid cron feature.

## Overview

We have three automated workflows:

1. **Auto-Settlement** - Settles finished bets every 15 minutes
2. **Line Recording** - Records betting lines every 30 minutes
3. **Team Stats Ingestion** - Captures current team records every hour

## How It Works

```
┌─────────────────┐
│ GitHub Actions  │
│  (Scheduler)    │
└────────┬────────┘
         │ Every 15/30 min
         │
         ▼
┌─────────────────┐
│  HTTP POST      │
│  with API Key   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Vercel Endpoint │
│ /api/bets/...   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Process Request │
│ Update Database │
└─────────────────┘
```

## Workflows

### 1. Auto-Settlement (`.github/workflows/auto-settle.yml`)

**Schedule:** Every 15 minutes (`*/15 * * * *`)

**What it does:**
- Fetches all pending bets
- Gets live scores from ESPN
- Matches bets to completed games
- Settles bets (won/lost/push)
- Updates user bankrolls

**Endpoint:** `POST /api/bets/auto-settle`

### 2. Line Recording (`.github/workflows/line-recording.yml`)

**Schedule:** Every 30 minutes (`*/30 * * * *`)

**What it does:**
- Fetches current odds for all sports
- Records line snapshots to database
- Marks opening lines for new games
- Enables CLV calculation later

**Endpoint:** `POST /api/lines/record`

**Sports tracked:**
- NBA (basketball_nba)
- NFL (americanfootball_nfl)
- NHL (icehockey_nhl)
- MLB (baseball_mlb)

### 3. Team Stats Ingestion (`.github/workflows/team-stats-ingest.yml`)

**Schedule:** Every hour on the hour (`0 * * * *`)

**What it does:**
- Calls the protected `POST /api/stats/ingest-team` endpoint
- Fetches current team records from ESPN-integrated helpers
- Inserts hourly snapshots into `team_stats` and `team_trends`
- Derives light-weight trend tags and scoring summaries for AI consumption

**Sports tracked:**
- NBA (`basketball_nba`)
- NFL (`americanfootball_nfl`)
- MLB (`baseball_mlb`)
- NHL (`icehockey_nhl`)

**Endpoint:** `POST /api/stats/ingest-team`

**Manual run:** Call `GET /api/stats/ingest-team` locally (or with `Authorization: Bearer CRON_SECRET` in production) or execute `npm run ingest:team-stats`.

## Setup Instructions

### Step 1: Add GitHub Secrets

Go to your GitHub repository:

1. Click **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add the following secrets:

#### Secret 1: `CRON_SECRET`

**Name:** `CRON_SECRET`
**Value:** Generate a random secret (use this command):

```bash
openssl rand -base64 32
```

This is used to authenticate requests from GitHub Actions.

#### Secret 2: `VERCEL_DOMAIN`

**Name:** `VERCEL_DOMAIN`
**Value:** Your Vercel deployment URL (without trailing slash)

Example: `https://your-app.vercel.app`

### Step 2: Add Environment Variable to Vercel

Add the same `CRON_SECRET` to your Vercel project:

1. Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Add new variable:
   - **Name:** `CRON_SECRET`
   - **Value:** (same value you used for GitHub secret)
   - **Environment:** Production, Preview, Development

This allows your API endpoints to verify requests from GitHub Actions.

### Step 3: Enable Workflows

The workflows are already configured! They will:
- ✅ Start running automatically after you push to main
- ✅ Run on the schedules defined
- ✅ Can be manually triggered from GitHub UI

### Step 4: Verify Setup

#### Test Manually

You can manually trigger the workflows to test:

1. Go to **Actions** tab in GitHub
2. Select **Auto-Settle Bets** or **Record Betting Lines**
3. Click **Run workflow** → **Run workflow**
4. Watch the logs to see if it succeeds

#### Check Logs

After workflows run:

1. Go to **Actions** tab
2. Click on the latest workflow run
3. Click on the job to see detailed logs
4. Look for:
   - ✅ `HTTP Status: 200`
   - ✅ `✓ Auto-settlement completed successfully`

## Monitoring

### GitHub Actions Dashboard

View all workflow runs:
- Go to **Actions** tab in your repo
- See history of all runs
- Check success/failure status
- View detailed logs

### Common Issues

#### Issue 1: 401 Unauthorized

**Symptom:** Workflow fails with HTTP 401

**Solution:**
- Check that `CRON_SECRET` matches in both GitHub and Vercel
- Verify the secret has no extra spaces or newlines

#### Issue 2: 404 Not Found

**Symptom:** Workflow fails with HTTP 404

**Solution:**
- Check `VERCEL_DOMAIN` secret is correct
- Ensure URL has no trailing slash
- Verify deployment is live

#### Issue 3: Workflow Not Running

**Symptom:** Workflows don't trigger on schedule

**Solution:**
- Workflows only run on the default branch (main/master)
- Repository must have recent activity (GitHub may pause after 60 days)
- Check Actions tab for disabled workflows

## API Endpoints

### Auto-Settlement Endpoint

**URL:** `POST /api/bets/auto-settle`

**Authentication:**
```
Authorization: Bearer YOUR_CRON_SECRET
```

**Response:**
```json
{
  "message": "Auto-settlement complete",
  "totalPending": 5,
  "settled": 3,
  "failed": 0,
  "settledBets": [
    {
      "betId": "uuid",
      "gameDescription": "Lakers vs Celtics",
      "status": "won",
      "actualResult": 50.00
    }
  ]
}
```

### Line Recording Endpoint

**URL:** `POST /api/lines/record`

**Authentication:**
```
Authorization: Bearer YOUR_CRON_SECRET
```

**Body:**
```json
{
  "sports": [
    "basketball_nba",
    "americanfootball_nfl",
    "icehockey_nhl",
    "baseball_mlb"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "linesRecorded": 450,
  "openingLinesMarked": 12,
  "timestamp": "2025-11-10T15:30:00Z"
}
```

## Cost

**GitHub Actions Free Tier:**
- ✅ 2,000 minutes/month free
- ✅ Unlimited for public repositories
- ✅ Our workflows use ~1 minute each
- ✅ Running 24/7 = ~4,320 runs/month
- ✅ ~72 minutes/month total usage
- ✅ **Well within free tier!**

**Math:**
```
Auto-settle: 96 runs/day × 0.5 min = 48 min/day
Line record: 48 runs/day × 0.5 min = 24 min/day
Total: 72 min/day × 30 days = 2,160 min/month

Free tier: 2,000 minutes/month (for private repos)
Public repos: Unlimited
```

## Manual Triggers

You can manually trigger workflows anytime:

### From GitHub UI

1. Go to **Actions** tab
2. Select workflow
3. Click **Run workflow**
4. Select branch (usually `main`)
5. Click **Run workflow**

### Using GitHub CLI

```bash
# Trigger auto-settlement
gh workflow run auto-settle.yml

# Trigger line recording
gh workflow run line-recording.yml
```

### Using API

```bash
# Get workflow ID
WORKFLOW_ID=$(gh api repos/OWNER/REPO/actions/workflows | jq '.workflows[] | select(.name=="Auto-Settle Bets") | .id')

# Trigger workflow
gh api repos/OWNER/REPO/actions/workflows/$WORKFLOW_ID/dispatches \
  -f ref=main
```

## Customizing Schedules

Edit the cron expression in workflow files:

```yaml
on:
  schedule:
    - cron: '*/15 * * * *'  # Change this line
```

**Common schedules:**
```
'*/5 * * * *'   - Every 5 minutes
'*/15 * * * *'  - Every 15 minutes
'*/30 * * * *'  - Every 30 minutes
'0 * * * *'     - Every hour
'0 */2 * * *'   - Every 2 hours
'0 0 * * *'     - Daily at midnight
```

## Disabling Workflows

To temporarily disable a workflow:

1. Go to **Actions** tab
2. Click on the workflow
3. Click **...** → **Disable workflow**

Or delete the workflow file:
```bash
rm .github/workflows/auto-settle.yml
```

## Alternative: Vercel Cron (Paid)

If you upgrade to Vercel Pro ($20/month), you can use native Vercel crons instead:

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/bets/auto-settle",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/lines/record",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

**Benefits:**
- Slightly lower latency (runs in same region)
- No external dependency
- Built-in monitoring

**Drawbacks:**
- Costs $20/month
- GitHub Actions is free

## Troubleshooting

### Check Workflow Status

```bash
# List recent workflow runs
gh run list --workflow=auto-settle.yml --limit=5

# View specific run
gh run view RUN_ID --log
```

### Test Endpoints Locally

```bash
# Test auto-settlement
curl -X POST http://localhost:3002/api/bets/auto-settle \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test line recording
curl -X POST http://localhost:3002/api/lines/record \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"sports":["basketball_nba"]}'
```

### Debug Failed Runs

1. Go to Actions tab
2. Click on failed run
3. Click on job
4. Expand failed step
5. Read error message
6. Check HTTP status and response

## Security

### Best Practices

✅ **DO:**
- Use GitHub Secrets for sensitive data
- Rotate `CRON_SECRET` periodically
- Monitor workflow logs for suspicious activity
- Use HTTPS for all requests

❌ **DON'T:**
- Hardcode secrets in workflow files
- Commit `.env` files
- Share `CRON_SECRET` publicly
- Use weak/predictable secrets

### Secret Rotation

To rotate `CRON_SECRET`:

1. Generate new secret: `openssl rand -base64 32`
2. Update GitHub Secret
3. Update Vercel Environment Variable
4. Wait for next deployment
5. Old secret stops working

## Support

### Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Cron Expression Guide](https://crontab.guru/)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)

### Common Questions

**Q: Why GitHub Actions instead of Vercel Cron?**
A: Free tier! Vercel limits cron to 1x/day on free plan.

**Q: Are there usage limits?**
A: 2,000 min/month for private repos, unlimited for public.

**Q: Can I run more frequently?**
A: Yes! Minimum is every 5 minutes (`*/5 * * * *`).

**Q: What if GitHub Actions is down?**
A: Users can still manually settle bets via UI buttons.

**Q: How do I see what bets were settled?**
A: Check workflow logs in Actions tab for detailed output.

## Summary

✅ **Free cron jobs** via GitHub Actions
✅ **Automatic bet settlement** every 15 minutes
✅ **Line recording** for CLV tracking every 30 minutes
✅ **Manual triggers** when needed
✅ **Full logging** and monitoring
✅ **Zero cost** on free tier

Your app now has fully automated background processing without any monthly costs! 🚀
