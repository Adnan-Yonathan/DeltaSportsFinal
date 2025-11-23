export default function ModelsDocsPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
          Custom Models
        </p>
        <h2 className="text-2xl font-semibold">Using Custom Models Safely</h2>
      </header>

      <div className="space-y-3 text-sm text-white/70">
        <p>
          Custom models in Delta AI let you define which stats matter, how important they are, and
          what edge threshold you care about. The app then evaluates slates using those rules.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Models are defined in terms of stat keys, directions, and importance weights.</li>
          <li>
            The app pulls stats from its own data layer; the AI should not invent stats that aren&apos;t
            present in those feeds.
          </li>
          <li>
            Model runs should return edges and explanations, not &quot;locks&quot; or guaranteed
            winners.
          </li>
        </ul>
        <p>
          Use the chat to ask for model-style breakdowns or to summarize model outputs in plain
          language. Stay focused on understanding why a model likes or avoids a spot rather than
          treating it as a pick engine.
        </p>
      </div>
    </div>
  )
}

