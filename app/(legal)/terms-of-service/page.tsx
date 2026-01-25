const SUPPORT_EMAIL = "deltasportsintelligence@gmail.com"
const LAST_UPDATED = new Date().toISOString().slice(0, 10)

export default function TermsOfServicePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">Terms of Service</p>
        <h1 className="text-3xl font-bold">Terms of Service</h1>
        <p className="text-sm text-white/70">
          By using Delta Sports AI, you agree to the terms below. If you do not agree, please do
          not use the service.
        </p>
        <p className="text-sm text-white/60">Operated by DELTA SPORTS APP.</p>
        <p className="text-xs text-white/50">Last updated: {LAST_UPDATED}</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Eligibility</h2>
        <p className="text-sm text-white/70">
          You must be at least 18 years old (or the legal age in your jurisdiction) to use the
          service. You are responsible for ensuring your use complies with local laws.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Service description</h2>
        <p className="text-sm text-white/70">
          Delta Sports AI provides analytics and educational insights. We do not accept bets,
          process wagers, or guarantee outcomes. Any information provided is for informational
          purposes only.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Accounts and security</h2>
        <p className="text-sm text-white/70">
          You are responsible for maintaining the confidentiality of your account and for all
          activity that occurs under your account.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Subscriptions and billing</h2>
        <p className="text-sm text-white/70">
          Paid plans are billed in advance and renew automatically unless canceled. Trials convert
          to paid subscriptions unless canceled before the trial ends. Payments are handled by our
          billing provider.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Acceptable use</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-white/70">
          <li>Do not misuse the service or attempt to disrupt its operation.</li>
          <li>Do not access or scrape data beyond your authorized usage.</li>
          <li>Do not use the service for unlawful or prohibited activities.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Intellectual property</h2>
        <p className="text-sm text-white/70">
          Delta Sports AI, its content, and its features are owned by Delta Sports and protected by
          intellectual property laws. You may not copy, resell, or distribute content without
          permission.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Third-party services</h2>
        <p className="text-sm text-white/70">
          We may link to or integrate third-party services. We are not responsible for their
          content, policies, or availability.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Disclaimers and limitation of liability</h2>
        <p className="text-sm text-white/70">
          The service is provided on an "as is" and "as available" basis. To the fullest extent
          permitted by law, we disclaim all warranties and will not be liable for indirect,
          incidental, or consequential damages arising from your use of the service.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Termination</h2>
        <p className="text-sm text-white/70">
          We may suspend or terminate access if you violate these terms or misuse the service.
          You may stop using the service at any time.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Changes to these terms</h2>
        <p className="text-sm text-white/70">
          We may update these terms from time to time. Continued use of the service constitutes
          acceptance of the updated terms.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Contact</h2>
        <p className="text-sm text-white/70">
          Questions about these terms can be sent to{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-white underline decoration-white/30 underline-offset-4 hover:text-white/90"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </section>
    </div>
  )
}
