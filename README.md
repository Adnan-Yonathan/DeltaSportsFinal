# Delta AI - Intelligent Sports Betting Assistant

<div align="center">

**AI-powered sports betting analytics, live odds tracking, and bankroll management**

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com/)

</div>

---

## Overview

Delta AI is a Next.js 14 application that combines live odds tracking from The Odds API, advanced analytics, AI-powered insights through OpenAI's GPT-4, and comprehensive bankroll management. Built with a Bloomberg Terminal-inspired dark theme, it provides professional-grade tools for sports bettors.

### Key Features

- **AI Chat Interface**: Conversational assistant powered by GPT-4 for odds analysis, line movement insights, and betting guidance
- **Custom Statistical Models**: Build named weighted-stat models directly in chat, then recall them later (e.g., “apply my NBA totals model”) for confidence-interval projections
- **Live Odds Tracking**: Real-time odds from major sportsbooks (FanDuel, DraftKings, BetMGM, Caesars, etc.)
- **Arbitrage Detection**: Automatic scanning for guaranteed profit opportunities across sportsbooks
- **Bankroll Management**: Track bets, analyze performance, visualize ROI trends
- **Line Movement Analysis**: Understand why odds change and identify sharp vs. public money
- **Performance Analytics**: Detailed statistics by sport, bet type, and time period

---

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes (Edge Runtime)
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Authentication**: Supabase Auth
- **AI**: OpenAI API (GPT-4 Turbo with streaming)
- **Sports Data**: The Odds API
- **Charts**: Recharts
- **Deployment**: Vercel

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js** 18+ and npm/yarn/pnpm
- **Supabase Account** (free tier available)
- **OpenAI API Key** (requires paid account)
- **The Odds API Key** (free tier: 500 requests/month)

---

## Quick Start

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd DeltaSportsFinal
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Set Up Supabase

#### Create a Supabase Project

1. Go to [Supabase](https://supabase.com/) and create a new project
2. Wait for the project to be fully provisioned

#### Run the Database Schema

1. Navigate to **SQL Editor** in your Supabase dashboard
2. Copy the contents of `lib/supabase/schema.sql`
3. Paste and execute the SQL to create all tables, indexes, and policies

#### Get Your Supabase Credentials

1. Go to **Project Settings** → **API**
2. Copy:
   - **Project URL** (NEXT_PUBLIC_SUPABASE_URL)
   - **anon/public key** (NEXT_PUBLIC_SUPABASE_ANON_KEY)
   - **service_role key** (SUPABASE_SERVICE_ROLE_KEY)

### 4. Get API Keys

#### OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Navigate to **API Keys**
3. Create a new secret key

#### The Odds API Key

1. Go to [The Odds API](https://the-odds-api.com/)
2. Sign up for a free account
3. Get your API key from the dashboard

### 5. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Fill in your credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key

# The Odds API Configuration
ODDS_API_KEY=your_odds_api_key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 6. Run the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
DeltaSportsFinal/
├── app/
│   ├── api/                    # API routes
│   │   ├── chat/              # Streaming chat with OpenAI
│   │   ├── odds/              # Odds and arbitrage endpoints
│   │   ├── bets/              # Bet CRUD operations
│   │   └── bankroll/          # Performance statistics
│   ├── auth/                   # Authentication pages
│   │   ├── login/
│   │   └── signup/
│   ├── chat/                   # Main chat interface
│   ├── globals.css            # Global styles
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Landing page (redirects to /chat)
├── components/
│   ├── Sidebar.tsx            # Conversation history
│   ├── MessageList.tsx        # Chat messages
│   ├── MessageInput.tsx       # Chat input
│   ├── BankrollTracker.tsx    # Real-time bankroll tracking
│   └── BetModal.tsx           # Manual bet logging
├── lib/
│   ├── supabase/              # Supabase client and types
│   │   ├── client.ts
│   │   ├── server.ts
│   │   ├── types.ts
│   │   └── schema.sql
│   ├── api/                   # API clients
│   │   └── odds-api.ts
│   ├── types/                 # TypeScript types
│   │   └── odds.ts
│   └── utils/                 # Utility functions
│       └── odds.ts
├── middleware.ts              # Auth middleware
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Features in Detail

### 1. AI Chat Interface

- **Streaming Responses**: Real-time AI responses using OpenAI's streaming API
- **Context-Aware**: Includes user's bankroll, active bets, and recent conversations
- **Markdown Support**: Rich formatting with tables, lists, and code blocks
- **Live Odds Integration**: Automatically fetches odds when relevant to queries

**Example Queries:**
- "Show me tonight's NBA odds"
- "Any arbitrage opportunities in NFL?"
- "Why did the Lakers line move from -4.5 to -5.5?"
- "I bet $110 on Lakers -5.5 at FanDuel"

### 2. Live Odds Tracking

- **Real-Time Data**: Fetches from The Odds API (30-second cache)
- **Multiple Sports**: NBA, NFL, MLB, NHL, NCAA Football/Basketball
- **All Markets**: Spreads, moneylines, totals
- **Major Books**: FanDuel, DraftKings, BetMGM, Caesars, Bet365, Pinnacle

### 3. Arbitrage Detection

- **Automatic Scanning**: Finds guaranteed profit opportunities
- **Stake Calculator**: Calculates exact bet amounts for each book
- **Profit Percentage**: Shows ROI for each opportunity
- **Quick Actions**: Log both bets directly from the interface

### 4. Bankroll Management

- **Real-Time Tracking**: Live updates as bets are logged and settled
- **Performance Charts**: 7-day balance trends
- **Detailed Stats**: Win rate, ROI, avg bet size, biggest win/loss
- **Sport Breakdown**: Analyze performance by sport
- **Daily Snapshots**: Historical balance tracking

### 5. Bet Logging

**Two Methods:**

1. **Conversational**: Just tell the AI
   - "I bet $110 on Lakers -5.5 at FanDuel"

2. **Manual**: Click "Log Bet" button
   - Fill out structured form
   - All fields validated

---

## Database Schema

### Tables

- **users**: User profiles with bankroll tracking
- **conversations**: Chat sessions
- **messages**: Individual chat messages
- **bets**: All bet records with status and results
- **bankroll_snapshots**: Daily balance history

### Row Level Security (RLS)

All tables are protected with RLS policies ensuring users can only access their own data.

### Triggers

- Auto-update `updated_at` timestamps
- Create user profile on signup
- Update bankroll on bet settlement
- Create daily snapshots

---

## API Routes

### Chat API (`/api/chat`)

**POST** - Send a message and get streaming AI response

```typescript
Body: {
  message: string
  conversationId: string
  userId: string
}
```

### Odds API (`/api/odds/games`)

**GET** - Fetch live odds for a sport

```
Query: ?sport=basketball_nba&markets=h2h,spreads,totals
```

### Arbitrage API (`/api/odds/arbitrage`)

**GET** - Find arbitrage opportunities

```
Query: ?sport=basketball_nba&threshold=1.0
```

### Bets API (`/api/bets`)

**POST** - Log a new bet
**GET** - Get user's bets

### Bankroll Stats API (`/api/bankroll/stats`)

**GET** - Get performance statistics

```
Query: ?period=7d
```

---

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import repository in [Vercel](https://vercel.com/)
3. Add environment variables in Vercel dashboard
4. Deploy!

### Environment Variables in Vercel

Make sure to add all variables from `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `ODDS_API_KEY`
- `NEXT_PUBLIC_APP_URL` (set to your Vercel URL)

---

## Cost Estimates

### The Odds API
- **Free Tier**: 500 requests/month
- **Paid**: $10/month for 10,000 requests
- **Estimated**: $50-100/month for 1000 active users

### OpenAI API
- **GPT-4 Turbo**: $10/1M input tokens, $30/1M output tokens
- **Estimated**: $500-750/month for 1000 users (10 queries/user/day)

### Supabase
- **Free Tier**: Up to 500MB database, 2GB bandwidth
- **Pro**: $25/month for scaling

**Total**: ~$575-875/month for 1000 active users

---

## Security & Compliance

### Disclaimers

The app displays responsible gambling notices:
- "All betting involves risk"
- "Never bet more than you can afford to lose"
- "Gambling problem? Call 1-800-GAMBLER"
- Age verification (21+)

### Data Privacy

- User data is private and encrypted
- RLS policies prevent unauthorized access
- No data selling
- GDPR compliant (users can delete their data)

---

## Roadmap

### MVP (Current)
- ✅ AI chat interface
- ✅ Live odds tracking
- ✅ Bet logging
- ✅ Bankroll management
- ✅ Arbitrage detection

### Post-MVP
- [ ] Advanced backtesting with user datasets
- [ ] Public vs sharp money indicators
- [ ] Mobile-optimized responsive design
- [ ] Email/SMS notifications
- [ ] CSV export
- [ ] Dark/light mode toggle
- [ ] Voice input
- [ ] Multiple bankroll accounts

---

## Troubleshooting

### "Failed to fetch odds"

- Check that `ODDS_API_KEY` is set correctly
- Verify you haven't exceeded the API rate limit
- Check the sport key is valid (e.g., `basketball_nba`)

### "Unauthorized" errors

- Ensure Supabase credentials are correct
- Check RLS policies are properly set up
- Verify user is logged in

### Streaming responses not working

- Ensure `OPENAI_API_KEY` is valid
- Check you have credits in your OpenAI account
- Verify the Edge Runtime is enabled

### Injury cache ingestion

The chat now pulls injury context from Supabase. Populate the cache locally or via cron with:

```bash
npm run ingest:injuries
```

This fetches current NBA/NFL/MLB/NHL reports from ESPN and stores them in `injury_reports`, so the LLM can answer instantly without hitting third-party feeds every time.

### Recent form cache

To pre-fill last-7-day performance logs (currently NBA example):

```bash
npm run ingest:recent-form
```

This writes game-level results into `team_recent_form`, enabling the chat to summarize “last 5” form without making live calls.

---

## Contributing

This is a portfolio/demonstration project. Feel free to fork and modify for your own use!

---

## License

MIT License - See LICENSE file for details

---

## Acknowledgments

- **The Odds API** for sports betting data
- **OpenAI** for GPT-4 API
- **Supabase** for backend infrastructure
- **Vercel** for hosting platform

---

## Support

For issues or questions, please open an issue in the GitHub repository.

**Disclaimer**: This application is for educational and analytical purposes only. Delta AI does not process real bets or transactions. Users are responsible for complying with local gambling laws.

---

**Built with ❤️ for sports betting enthusiasts**
