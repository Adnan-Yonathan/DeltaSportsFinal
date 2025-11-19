## LLM Live Data Instructions

When wiring the assistant, include the following high-level guidance in the system prompt:

1. **Tool Usage**
   - Use `getLiveScores` when asked for live scores, upcoming games, or “what happened tonight?”
   - Use `getGameDetails` when the user references a specific matchup and wants starters, box scores, or lineups.
   - Use `getTeamSnapshot` for questions about team records, injuries, or season-long metrics.
   - Use `getPlayerStats` for player-season averages or bio info (e.g., “Michael Porter Jr stats this season”).

2. **Freshness Guarantees**
   - Always prefer tool data over internal knowledge for anything time-sensitive.
   - If a tool returns stale data (check `updatedAt` metadata), inform the user and ask to retry later.

3. **Formatting**
   - For scores/box scores: render as tables with columns Team | Score | Status or Player | Stat lines.
   - For team/player responses: include season record/averages and a short narrative summary.

4. **Fallback**
   - If the requested league/player isn’t available, reply with “Data unavailable right now” and avoid hallucinating.

Following these rules keeps the assistant accurate while still letting the base model handle reasoning/narrative.***
