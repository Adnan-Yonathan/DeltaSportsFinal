const SUPPORT_EMAIL = "deltasportsintelligence@gmail.com"
const LAST_UPDATED = new Date().toISOString().slice(0, 10)

export default function RefundPolicyPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">Refund Policy</p>
        <h1 className="text-3xl font-bold">Refund Policy</h1>
        <p className="text-sm text-white/70">
          This policy explains how refunds and cancellations work for Delta Sports AI.
        </p>
        <p className="text-xs text-white/50">Last updated: {LAST_UPDATED}</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Subscriptions</h2>
        <p className="text-sm text-white/70">
          Subscriptions are billed in advance for the billing period. Once a payment goes through,
          it is deemed final. Refunds will not be given unless the fault is on Delta Sports.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Trials</h2>
        <p className="text-sm text-white/70">
          Free trials convert to paid subscriptions unless canceled before the trial ends. Charges
          for converted trials follow the standard subscription terms.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Billing issues</h2>
        <p className="text-sm text-white/70">
          If you believe you were wrongly charged or experienced a Delta Sports issue that prevented
          access, contact support and we will determine next steps from there.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">How to request help</h2>
        <p className="text-sm text-white/70">
          Email{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-white underline decoration-white/30 underline-offset-4 hover:text-white/90"
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          with the account email and the billing date so we can assist you quickly.
        </p>
      </section>
    </div>
  )
}
