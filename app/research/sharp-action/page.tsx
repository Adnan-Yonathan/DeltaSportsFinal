import SharpActionClient from './sharp-action-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SharpActionPage() {
  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Sharp Action</h1>
        <p className="mt-2 text-sm text-white/60">
          Every game on today&apos;s slate, separated by sport with line movement history
        </p>
      </div>

      <SharpActionClient previewMode={false} />
    </div>
  )
}
