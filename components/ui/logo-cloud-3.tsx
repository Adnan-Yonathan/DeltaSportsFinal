import { InfiniteSlider } from '@/components/ui/infinite-slider'
import { cn } from '@/lib/utils'

type Logo = {
  src: string
  alt: string
  width?: number
  height?: number
}

type LogoCloudProps = React.ComponentProps<'div'> & {
  logos: Logo[]
}

export function LogoCloud({ className, logos, ...props }: LogoCloudProps) {
  return (
    <div
      {...props}
      className={cn(
        'overflow-hidden py-4 [mask-image:linear-gradient(to_right,transparent,black,transparent)]',
        className
      )}
    >
      <InfiniteSlider gap={42} reverse speed={80} speedOnHover={25}>
        {logos.map((logo) => (
          <img
            key={`logo-${logo.alt}`}
            src={logo.src}
            alt={logo.alt}
            loading="lazy"
            width={logo.width || undefined}
            height={logo.height || undefined}
            className="pointer-events-none h-4 select-none opacity-80 md:h-5"
          />
        ))}
      </InfiniteSlider>
    </div>
  )
}
