# Delta Mobile Onboarding Research

Updated: March 13, 2026

## Goal

Design a mobile onboarding flow for Delta that:

1. Maximizes starts on the 7-day free trial.
2. Increases trial-to-paid conversion.
3. Increases long-term retention by getting users to a real "first win" quickly.

This brief is focused on Delta's product reality today:

- Core value props already present in the app: Sharp Projections, Sharp Props, Whale Detector, Research Mode.
- Existing 7-day trial and paywall flows already exist in the codebase.
- Existing onboarding is mostly a feature walkthrough after signup, not a personalized activation system.

## What the research says

### 1. Mobile onboarding has a very short window to prove value

- Appcues cites survey data showing 72% of users say providing required information in under 60 seconds is somewhat to very important during mobile onboarding.
- Appcues also argues that the value proposition has to land almost immediately on mobile because users decide fast whether to continue.

Implication for Delta:

- Do not lead with a long tutorial.
- Do not ask for more than 3 to 5 lightweight questions before showing value.
- The first screen sequence should quickly answer: "What edge do I get here that I cannot get elsewhere?"

### 2. Personalized onboarding improves activation and retention

- Appcues reports GetResponse increased activation by 60% with onboarding flows.
- Appcues reports Appointlet increased free-to-paid conversion by 210% using checklists.
- Appcues reports ProfitWell improved first-week retention by 20% after deploying onboarding experiences.
- MYOB rebuilt onboarding with short surveys, tailored checklists, and guided flows and improved new user activation by 21%.
- In the MYOB case, they explicitly tied early setup behavior to 90-day subscription continuation.

Implication for Delta:

- Ask a few intent questions up front.
- Branch the onboarding based on the user's job-to-be-done.
- Give each segment a different first action and a different activation checklist.

### 3. Checklists and guided progress reduce decision fatigue

- Appcues documentation frames checklists as a persistent way to guide users through activation milestones.
- Amplitude's "From Aha to Impact" shows Dropbox Capture rebuilt onboarding with a checklist, improved activation by 25%+, and increased second-week return usage by 5%.
- The same Amplitude guide shows a first-screen clarity fix can materially raise completion and first-payment revenue.

Implication for Delta:

- Delta should not rely on one passive walkthrough.
- After trial start, show a persistent "Your first 3 wins" checklist.
- Every checklist item should end in a concrete user outcome, not a page visit.

### 4. Onboarding paywalls are often the highest-converting placement, but 7-day trials churn early

- RevenueCat's paywall guide says onboarding paywalls are often where most conversions happen; one cited example reports about 50% of trial starts from onboarding.
- RevenueCat's 2025 State of Subscription Apps says 3-day and 7-day trials have the highest Day 0 and Day 1 cancellation rates.
- RevenueCat's 2026 shopping report says 39.8% of 7-day trial cancellations happen on Day 0, and 64% of 7-day trial cancellations happen between Day 0 and Day 1.
- RevenueCat also notes a late-trial cancellation spike near the end of the trial.
- RevenueCat notes "not enough usage" is the top cancellation reason across categories on Google churn surveys.

Implication for Delta:

- Keep an onboarding paywall, but make it feel like the gateway to an immediate edge.
- A 7-day trial can work, but only if Delta creates heavy value density in the first 24 to 72 hours.
- Delta needs a structured day-3 to day-6 lifecycle to prevent "forgotten renewal" cancellations from becoming default behavior.

### 5. Showing value before asking for commitment is especially strong on mobile

- Appcues' mobile onboarding examples repeatedly highlight "show, don't tell."
- Audible let users try the product before full registration, letting users experience value in less than a minute.
- Goody offered a free gift so users could reach the aha moment sooner.
- Zova used interactive, personalized videos to demonstrate value before asking users to subscribe.
- RevenueCat recommends testing reverse-trial or feature-first approaches for lower-intent users: let people experience a single useful flow, then paywall continued access.

Implication for Delta:

- Delta should test a hybrid model:
  - Primary flow: onboarding paywall for high-intent users.
  - Secondary flow: one free "market edge preview" or "today's sharp opportunity preview" before the paywall for lower-intent users.

### 6. Permission asks should happen in context, not at app open

- Android's current documentation says to request notification permission in the correct context and not at app startup.
- Android's permission best-practices page says users are more likely to allow permissions they expect and that apps should avoid requesting every permission at launch.
- Appcues examples like Zova and Goody reinforce that permission prompts work better after the user understands why notifications matter.

Implication for Delta:

- Do not ask for push permission on launch.
- Ask after the user creates or follows a signal, alert, or watchlist.
- The permission framing should be specific: "Get alerted when this line moves" or "Get alerted when whale action hits your tracked market."

## Delta-specific diagnosis

### What Delta already has

- Strong premium proof:
  - Sharp Projections
  - Sharp Props
  - Whale Detector
  - Research Mode
- Existing trust messaging:
  - 7-day free trial
  - no charge today
  - cancel anytime
  - reminder before billing
- Existing visual assets:
  - `public/Screenshot 2026-02-24 142211.png`
  - `public/Screenshot 2026-02-24 170409.png`
  - `public/Screenshot 2026-02-24 142244.png`
  - `public/Screenshot 2026-02-24 142303.png`
- Existing social-proof style claims in the landing experience:
  - +9.8% long-term ROI
  - +1.6% average CLV
  - tracked picks / tracked props / tracked alerts

### What is missing

- No sharp segmentation before value is shown.
- No obvious "first win" path tailored to different bettor types.
- Current onboarding is tutorial-heavy and outcome-light.
- No persistent activation checklist tied to trial success.
- No first-week lifecycle system clearly connected to the 7-day trial.

## Recommended mobile onboarding structure

This is the recommended screen order for Delta mobile.

### Screen 1: Outcome-first welcome

Purpose:

- Make the user feel they found an edge platform, not just another betting content app.

Content:

- Headline: "See where the sharp money moved before the books catch up."
- Supporting proof:
  - "Orderbooks, whale flow, projections, and line context in one app."
  - One compact proof module with 2 to 3 stats.
- Visual:
  - Full-screen dark, high-contrast market board crop from Sharp Projections.
  - Animated line movement or orderbook pulse.

Keep:

- One primary CTA: `See my setup`
- One secondary CTA: `Watch 20-sec demo`

### Screen 2: 3-question personalization

Ask only what changes the first-session experience:

1. `What are you here for?`
   - Find today's best edges
   - Tail sharp action
   - Beat player props
   - Improve CLV over time

2. `What do you bet most?`
   - Game lines
   - Player props
   - Both

3. `How experienced are you?`
   - New to sharp tools
   - Some experience
   - Advanced

Rules:

- Use chips, not forms.
- One screen if possible.
- Do not ask bankroll yet unless it directly powers an immediate ROI calculator screen.

### Screen 3: Personalized outcome preview

Purpose:

- Translate answers into a concrete promise.

Examples:

- Props bettor: "We'll start you in Sharp Props and show you where orderbook pressure is strongest today."
- Sharp-action tailer: "We'll build your feed around whale flow, line movement, and confirmation."
- Research-focused bettor: "We'll show you where to validate edges before you size up."

Content blocks:

- "Your setup"
- "You should start in"
- "You will get alerts for"
- "What your first 5 minutes will look like"

Visual:

- Personalized tool card stack using actual Delta screenshots.

### Screen 4: Value demonstration before paywall

This is critical.

Do one of these:

- Show a live, blurred-but-readable board with 1 to 3 highlighted edges and concise explanations.
- Show a single "today's opportunity" card with:
  - market
  - edge %
  - line movement context
  - why it matters
- Show an interactive 20-second motion story across Sharp Projections, Sharp Props, and Whale Feed.

Best version for Delta:

- A swipeable "edge story" with 3 cards:
  - Card 1: market gap
  - Card 2: sharp confirmation
  - Card 3: why acting early matters

This should make the user feel:

- "I understand what Delta sees."
- "I can use this immediately."
- "This is different from generic picks apps."

### Screen 5: Trial paywall

The paywall should appear after value is tangible, not before the user understands the product.

Recommended structure:

- Headline: `Start your 7-day trial and track real sharp signals this week`
- Subhead:
  - `No charge today. Cancel anytime. We'll remind you before billing.`
- Main proof stack:
  - Find mispriced lines faster
  - Confirm with orderbook and whale flow
  - Build a repeatable CLV process
- One featured plan, not equal-weight plan overload
  - Default the plan you want most people to take
  - Show monthly anchor if that is the long-term target
- Show annual equivalence only if tested and if it improves take rate without hurting trial starts

Include:

- Product proof thumbnail
- One "why users stay" section
- One "what happens in your first 7 days" section

Avoid:

- Long feature grids
- Too many billing options on the first paywall
- Generic "unlock premium" framing

### Screen 6: Post-trial-start setup

Immediately after trial start:

- Ask the user to choose:
  - favorite sports
  - markets to watch
  - books to compare
- Optional:
  - average unit size

Only ask anything that powers the home feed instantly.

### Screen 7: First-win checklist

This should persist on home until completed.

Recommended checklist:

1. View your first 3 sharp edges.
2. Save one alert or watchlist.
3. Compare one market across books.
4. Review one line move or whale confirmation.

Stretch item:

5. Review one post-close / CLV recap.

Why:

- This teaches the workflow.
- It reduces the "what do I do now?" problem.
- It gives Delta multiple chances to create habit before the trial ends.

## Best sections for the trial paywall

These are the highest-value sections to include in order.

### 1. Immediate value promise

- "Track sharp action before numbers move."

### 2. Proof of differentiation

- Exchange orderbooks
- Whale flow
- projections
- market context

This is where Delta should clearly separate itself from "picks" apps and from generic odds tools.

### 3. What happens this week

Show a simple 7-day timeline:

- Day 1: personalized feed
- Day 2: save alerts
- Day 3: follow a line move
- Day 5: review CLV
- Day 7: decide if Delta belongs in your routine

This reduces uncertainty and makes the trial feel purposeful.

### 4. Product proof

Use one strong screenshot and one annotated signal card, not a crowded collage.

### 5. Trust and friction reducers

- No charge today
- Cancel anytime
- Reminder before billing
- Analytics platform, not a picks service

### 6. Focused plan selection

- Prefer one recommended plan
- De-emphasize the rest

## Recommended first-week lifecycle

Because Delta uses a 7-day trial, the lifecycle matters almost as much as the paywall.

### Day 0

- In-app: finish setup and first-win checklist.
- Email/push: "Your Delta setup is live."
- Goal: get the user to save one alert or revisit one board.

### Day 1

- Push or email with a live market moment:
  - "2 sharp moves hit your tracked markets."
- Goal: return visit driven by real signal, not generic reminder.

### Day 2

- Show a compact recap:
  - edges seen
  - alerts triggered
  - line moves caught

### Day 3

- In-app modal or card:
  - "Want more tailored alerts?"
  - prompt for push permission here if not already granted

### Day 4 to Day 5

- Deliver one insight that teaches process:
  - "Here is how to read this move"
  - "Here is why this prop got steamed"

### Day 6

- Reminder:
  - what the user accomplished during the trial
  - what they lose if they cancel
  - what habit Delta has already built for them

### Day 7

- Conversion message should summarize personal usage:
  - signals tracked
  - alerts saved
  - markets followed
  - line-shopping opportunities viewed

This is much stronger than a generic "your trial ends tomorrow."

## Visual creative directions for Delta

These are the most promising visual directions based on the research and Delta's product.

### Direction A: Market Command Center

Inspiration:

- Bloomberg terminal energy
- trading app density
- high-confidence signal visualization

Use:

- Black / deep green / ice-cyan palette
- sharp, luminous data highlights
- line movement pulse animations
- annotated screenshots with one highlighted edge

Best for:

- high-intent bettors
- users already familiar with sharp betting language

### Direction B: Edge Story

Inspiration:

- Zova-style story progression
- short-card walkthroughs
- one insight per frame

Use:

- full-screen cards
- segmented progress bar
- 15 to 25 second flow
- card 1 = market gap, card 2 = sharp confirmation, card 3 = why now

Best for:

- acquisition traffic
- users who need the value explained quickly

### Direction C: Personal Trading Coach

Inspiration:

- Headspace goal-based onboarding
- humanized expert framing

Use:

- goal-first copy
- "we'll help you do X" tone
- personalized setup summary
- confidence-building copy for newer users

Best for:

- users intimidated by sharp betting tools

### Direction D: Mission-Based Activation

Inspiration:

- Albert mission-based onboarding
- checklist-driven progress

Use:

- "Mission 1: Find your first edge"
- "Mission 2: Confirm with whales"
- "Mission 3: Save your market"

Best for:

- turning first-week usage into habit

## Recommended visual assets to use from the repo

Use these existing Delta screenshots as the starting creative kit:

- `public/Screenshot 2026-02-24 142211.png` for Sharp Projections hero
- `public/Screenshot 2026-02-24 170409.png` for Sharp Props proof
- `public/Screenshot 2026-02-24 142244.png` for Whale Detector proof
- `public/Screenshot 2026-02-24 142303.png` for Research Mode proof

Recommended treatment:

- Tight crop for mobile
- dark vignette around edges
- 1 highlighted annotation per image
- one stat chip per image

## What Delta should test first

### Test 1: Paywall timing

- Variant A: paywall after personalized setup
- Variant B: paywall after one live edge preview

Expected winner:

- Edge preview may increase trial starts for colder traffic.

### Test 2: One recommended plan vs multi-plan chooser

- Variant A: one recommended monthly plan
- Variant B: current multi-option layout

Expected winner:

- Focused choice should improve checkout completion.

### Test 3: Outcome framing

- Variant A: "Track sharp money before the move"
- Variant B: "Find the best bets faster"

Expected winner:

- Delta-specific sharp framing should attract higher-intent users.

### Test 4: Checklist vs no checklist

- Persistent post-start checklist
- Measure trial-to-paid and day-2/day-7 retention

### Test 5: Push prompt timing

- Variant A: app start
- Variant B: after alert/save action

Expected winner:

- In-context prompt.

### Test 6: Personalized trial-end summary

- Variant A: generic reminder
- Variant B: personalized usage recap

Expected winner:

- Personalized recap.

## Core metrics to track

Top-funnel:

- onboarding start rate
- onboarding completion rate
- paywall view rate
- trial start rate

Activation:

- time to first edge viewed
- time to first alert saved
- time to first book comparison
- checklist completion rate

Retention:

- day-1 retention
- day-3 retention
- day-7 retention
- second-week return rate

Monetization:

- trial-to-paid conversion
- day-0 and day-1 trial cancellation rate
- billing-period mix
- proceeds per trial start

Quality:

- usage before conversion
- feature path by paid converters vs churned trials

## Recommended final flow for V1

If Delta needed to ship one strong version first, this is the version to build:

1. Welcome screen with strong proof and a 20-second demo option.
2. Three-question segmentation.
3. Personalized setup summary.
4. Swipeable edge-story preview with real Delta data/screens.
5. Trial paywall with one recommended plan and a 7-day timeline.
6. Post-start feed setup.
7. Persistent "First 3 wins" checklist on home.
8. Day 1 to Day 7 lifecycle powered by alerts, recaps, and personalized trial-end messaging.

## Bottom line

The best-performing Delta onboarding will not feel like a product tour.

It should feel like:

- a fast diagnosis of what kind of bettor the user is,
- a vivid proof that Delta sees real market edge,
- a low-friction path into a 7-day trial,
- and a structured first week that turns one-time curiosity into repeated use.

For Delta specifically, the highest-leverage move is not "more onboarding." It is:

- less explanation,
- more personalized proof,
- one immediate first win,
- and a trial lifecycle built around market moments.

## Sources

- RevenueCat, State of Subscription Apps 2025: https://www.revenuecat.com/state-of-subscription-apps-2025/
- RevenueCat, State of Subscription Apps 2026 Shopping: https://www.revenuecat.com/state-of-subscription-apps-2026-shopping/
- RevenueCat, The essential guide to mobile paywalls for subscription apps: https://www.revenuecat.com/blog/growth/guide-to-mobile-paywalls-subscription-apps/
- RevenueCat, Is it time to stop offering free trials?: https://www.revenuecat.com/blog/growth/should-your-app-stop-offering-free-trials/
- RevenueCat, 7 smart ways to monetize low-intent users: https://www.revenuecat.com/blog/growth/revenue-strategies-low-intent-users/
- Appcues, User onboarding overview: https://try.appcues.com/user-onboarding
- Appcues, Mobile app onboarding: 4 ideas for nudging new users to take action: https://www.appcues.com/blog/mobile-app-onboarding
- Appcues, MYOB onboarding case study: https://www.appcues.com/customer-stories/how-myob-increased-new-user-activation-by-21-with-thoughtful-personalized-onboarding
- Appcues Good UX, Zova onboarding: https://goodux.appcues.com/blog/zovas-interactive-video-onboarding
- Appcues Good UX, Goody onboarding: https://goodux.appcues.com/blog/goody-unique-onboarding-experience
- Appcues Good UX, Headspace onboarding: https://goodux.appcues.com/blog/headspaces-mindful-onboarding-sequence
- Amplitude, From Aha to Impact: https://info.amplitude.com/rs/138-CDN-550/images/From-Aha-to-Impact.pdf
- Android Developers, Notification runtime permission: https://developer.android.com/develop/ui/views/notifications/notification-permission
- Android Developers, App permissions best practices: https://developer.android.com/training/permissions/usage-notes
- Paywall inspiration gallery referenced by RevenueCat: https://www.paywallscreens.com/
- Mobile experiment case studies referenced by RevenueCat: https://abtest.design/
