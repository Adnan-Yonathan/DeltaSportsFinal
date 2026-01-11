import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Calendar, LucideIcon, MapIcon } from 'lucide-react'
import { ReactNode } from 'react'

export function Features() {
  return (
    <section className="bg-zinc-50 py-16 md:py-32 dark:bg-transparent">
      <div className="mx-auto max-w-2xl px-6 lg:max-w-5xl">
        <div className="mx-auto grid gap-4 lg:grid-cols-2">
          <FeatureCard>
            <CardHeader className="pb-3">
              <CardHeading
                icon={MapIcon}
                title="Market-driven projections"
                description="Delta builds projections for games, players, and parlays by tracking market movement and following sharp money."
              />
            </CardHeader>

            <div className="relative mb-6 border-t border-dashed sm:mb-0">
              <div className="absolute inset-0 [background:radial-gradient(125%_125%_at_50%_0%,transparent_40%,hsl(var(--muted)),white_125%)]"></div>
              <div className="aspect-[76/59] p-1 px-6">
                <DualModeImage
                  darkSrc="/Screenshot 2026-01-11 161550.png"
                  lightSrc="/Screenshot 2026-01-11 161528.png"
                  alt="Delta sports preview"
                  width={1207}
                  height={929}
                />
              </div>
            </div>
          </FeatureCard>

          <FeatureCard>
            <CardHeader className="pb-3">
              <CardHeading
                icon={Calendar}
                title="Sharp detector intelligence"
                description="We track big bets on peer-to-peer exchanges and compare them to sportsbook lines to quantify how sharp a bet is."
              />
            </CardHeader>

            <CardContent>
              <div className="relative mb-6 sm:mb-0">
                <div className="absolute -inset-6 [background:radial-gradient(50%_50%_at_75%_50%,transparent,hsl(var(--background))_100%)]"></div>
                <div className="aspect-[76/59] border">
                  <DualModeImage
                    darkSrc="/Screenshot 2026-01-11 161528.png"
                    lightSrc="/Screenshot 2026-01-11 161550.png"
                    alt="Delta sports calendar"
                    width={1207}
                    height={929}
                  />
                </div>
              </div>
            </CardContent>
          </FeatureCard>

          <FeatureCard className="p-6 lg:col-span-2">
            <p className="mx-auto my-6 max-w-md text-balance text-center text-2xl font-semibold">
              Projections and sharp signals stay synced to the latest market moves.
            </p>

            <div className="flex justify-center gap-6 overflow-hidden">
              <CircularUI
                label="Inclusion"
                circles={[{ pattern: 'border' }, { pattern: 'border' }]}
              />

              <CircularUI
                label="Inclusion"
                circles={[{ pattern: 'none' }, { pattern: 'primary' }]}
              />

              <CircularUI
                label="Join"
                circles={[{ pattern: 'blue' }, { pattern: 'none' }]}
              />

              <CircularUI
                label="Exclusion"
                circles={[{ pattern: 'primary' }, { pattern: 'none' }]}
                className="hidden sm:block"
              />
            </div>
          </FeatureCard>
        </div>
      </div>
    </section>
  )
}

interface FeatureCardProps {
  children: ReactNode
  className?: string
}

const FeatureCard = ({ children, className }: FeatureCardProps) => (
  <Card className={cn('group relative rounded-none shadow-zinc-950/5', className)}>
    <CardDecorator />
    {children}
  </Card>
)

const CardDecorator = () => (
  <>
    <span className="border-primary absolute -left-px -top-px block size-2 border-l-2 border-t-2"></span>
    <span className="border-primary absolute -right-px -top-px block size-2 border-r-2 border-t-2"></span>
    <span className="border-primary absolute -bottom-px -left-px block size-2 border-b-2 border-l-2"></span>
    <span className="border-primary absolute -bottom-px -right-px block size-2 border-b-2 border-r-2"></span>
  </>
)

interface CardHeadingProps {
  icon: LucideIcon
  title: string
  description: string
}

const CardHeading = ({ icon: Icon, title, description }: CardHeadingProps) => (
  <div className="p-6">
    <span className="text-muted-foreground flex items-center gap-2">
      <Icon className="size-4" />
      {title}
    </span>
    <p className="mt-8 text-2xl font-semibold">{description}</p>
  </div>
)

interface DualModeImageProps {
  darkSrc: string
  lightSrc: string
  alt: string
  width: number
  height: number
  className?: string
}

const DualModeImage = ({ darkSrc, lightSrc, alt, width, height, className }: DualModeImageProps) => (
  <>
    <img
      src={darkSrc}
      className={cn('hidden dark:block', className)}
      alt={`${alt} dark`}
      width={width}
      height={height}
    />
    <img
      src={lightSrc}
      className={cn('shadow dark:hidden', className)}
      alt={`${alt} light`}
      width={width}
      height={height}
    />
  </>
)

interface CircleConfig {
  pattern: 'none' | 'border' | 'primary' | 'blue'
}

interface CircularUIProps {
  label: string
  circles: CircleConfig[]
  className?: string
}

const CircularUI = ({ label, circles, className }: CircularUIProps) => (
  <div className={className}>
    <div className="bg-gradient-to-b from-border size-fit rounded-2xl to-transparent p-px">
      <div className="bg-gradient-to-b from-background to-muted/25 relative flex aspect-square w-fit items-center -space-x-4 rounded-[15px] p-4">
        {circles.map((circle, i) => (
          <div
            key={i}
            className={cn('size-7 rounded-full border sm:size-8', {
              'border-primary': circle.pattern === 'none',
              'border-primary bg-[repeating-linear-gradient(-45deg,hsl(var(--border)),hsl(var(--border))_1px,transparent_1px,transparent_4px)]': circle.pattern === 'border',
              'border-primary bg-background bg-[repeating-linear-gradient(-45deg,hsl(var(--primary)),hsl(var(--primary))_1px,transparent_1px,transparent_4px)]': circle.pattern === 'primary',
              'bg-background z-1 border-blue-500 bg-[repeating-linear-gradient(-45deg,theme(colors.blue.500),theme(colors.blue.500)_1px,transparent_1px,transparent_4px)]': circle.pattern === 'blue',
            })}
          ></div>
        ))}
      </div>
    </div>
    <span className="text-muted-foreground mt-1.5 block text-center text-sm">{label}</span>
  </div>
)
