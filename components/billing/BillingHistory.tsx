import type { BillingInvoiceSummary } from '@/lib/types/billing'
import { formatCurrency, formatDate, formatStatus } from '@/components/billing/billing-ui'

export default function BillingHistory({
  invoices,
}: {
  invoices: BillingInvoiceSummary[]
}) {
  return (
    <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">
        Invoice History
      </div>
      <h2 className="mt-3 text-2xl font-semibold text-white">Recent billing activity</h2>
      <p className="mt-2 text-sm leading-6 text-white/58">
        Review recent charges, invoice status, and hosted Stripe records. Use this section when you need a clean account of what was billed and when.
      </p>

      <div className="mt-6 space-y-3">
        {invoices.length > 0 ? (
          invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="text-sm font-semibold text-white">
                  {formatCurrency(invoice.amountPaid / 100, invoice.currency)}
                </div>
                <div className="mt-1 text-sm text-white/55">
                  {formatDate(invoice.createdAt)} / {formatStatus(invoice.status)}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {invoice.hostedInvoiceUrl ? (
                  <a
                    href={invoice.hostedInvoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[38px] items-center justify-center rounded-full border border-white/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/78 transition hover:border-white/25 hover:text-white"
                  >
                    View
                  </a>
                ) : null}
                {invoice.invoicePdf ? (
                  <a
                    href={invoice.invoicePdf}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[38px] items-center justify-center rounded-full border border-white/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/78 transition hover:border-white/25 hover:text-white"
                  >
                    PDF
                  </a>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-sm text-white/55">
            No invoice history is available yet.
          </div>
        )}
      </div>
    </section>
  )
}
