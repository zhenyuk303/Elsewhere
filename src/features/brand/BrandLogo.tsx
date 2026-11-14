import './brand-logo.css'

type BrandLogoProps = {
  className?: string
  decorative?: boolean
}

export function BrandLogo({ className = '', decorative = false }: BrandLogoProps) {
  return (
    <span
      className={`brand-logo ${className}`.trim()}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'ELSEWHERE'}
      aria-hidden={decorative ? true : undefined}
    />
  )
}
