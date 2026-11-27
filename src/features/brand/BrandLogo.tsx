import './brand-logo.css'

type BrandLogoProps = {
  className?: string
  decorative?: boolean
  withWordmark?: boolean
}

export function BrandLogo({ className = '', decorative = false, withWordmark = false }: BrandLogoProps) {
  const variant = withWordmark ? ' brand-logo--with-wordmark' : ''

  return (
    <span
      className={`brand-logo${variant} ${className}`.trim()}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'ELSEWHERE'}
      aria-hidden={decorative ? true : undefined}
    />
  )
}
