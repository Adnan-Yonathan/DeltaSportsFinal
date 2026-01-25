const SUPPORT_EMAIL = "deltasportsintelligence@gmail.com"
const LAST_UPDATED = new Date().toISOString().slice(0, 10)

export default function PrivacyPolicyPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">Privacy Policy</p>
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="text-sm text-white/70">
          This policy explains how Delta Sports AI collects, uses, and protects your information.
        </p>
        <p className="text-sm text-white/60">Operated by DELTA SPORTS APP.</p>
        <p className="text-xs text-white/50">Last updated: {LAST_UPDATED}</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Information we collect</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-white/70">
          <li>Account details such as name, email, and profile preferences.</li>
          <li>Usage data like pages viewed, feature interactions, and chat activity.</li>
          <li>Device and log data including IP address, browser type, and timestamps.</li>
          <li>
            Payment data handled by our payment provider. We do not store your full card
            number or security code.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">How we use information</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-white/70">
          <li>Provide and personalize the Delta Sports AI experience.</li>
          <li>Process subscriptions, trials, and account management.</li>
          <li>Improve performance, reliability, and feature quality.</li>
          <li>Send service updates and important account notices.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">How we share information</h2>
        <p className="text-sm text-white/70">
          We share data only as needed to operate the service. This includes trusted service
          providers (such as analytics, hosting, and payments), legal compliance, or a business
          transfer. We do not sell personal data.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Data retention</h2>
        <p className="text-sm text-white/70">
          We retain data for as long as your account is active or as needed to provide the service.
          We may retain limited records for legal, security, or auditing purposes.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Your choices</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-white/70">
          <li>Access, update, or delete your account information.</li>
          <li>Opt out of non-essential communications.</li>
          <li>Request help by contacting support.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Security</h2>
        <p className="text-sm text-white/70">
          We use reasonable safeguards to protect your data. No method of transmission or storage
          is completely secure, so we cannot guarantee absolute security.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Contact</h2>
        <p className="text-sm text-white/70">
          Questions about privacy can be sent to{" "}
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
