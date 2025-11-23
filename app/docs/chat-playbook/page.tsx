export default function ChatPlaybookPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
          Chat Playbook
        </p>
        <h2 className="text-2xl font-semibold">How to Ask for Help</h2>
      </header>

      <div className="space-y-3 text-sm text-white/70">
        <p>
          The chat assistant is optimized for concrete, data-backed questions. It won&apos;t give
          you picks or guarantees, but it will explain what matters for a matchup and where the
          line might be strong or weak.
        </p>
        <p className="font-medium text-white">Good prompts include:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            &quot;Break down tonight&apos;s {`{team A}`} vs {`{team B}`} game. What stats actually
            matter for the spread and total?&quot;
          </li>
          <li>
            &quot;Here&apos;s an article about this game. What parts are real signal vs narrative
            noise for betting?&quot;
          </li>
          <li>
            &quot;Show me how my NFL bets have performed over the last 30 days by bet type.&quot;
          </li>
          <li>
            &quot;Using the live odds above, which books have the best price on the underdog?&quot;
          </li>
        </ul>
        <p>
          When you ask for stats, the assistant should pull from the app&apos;s ESPN-backed
          endpoints. When you ask for odds or best lines, it should rely on the odds provider and
          never fabricate prices from memory.
        </p>
      </div>
    </div>
  )
}

