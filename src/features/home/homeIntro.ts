import beijingImage from '../../assets/travel/beijing.jpg'
import qinghaiImage from '../../assets/travel/qinghai.jpg'
import shanghaiImage from '../../assets/travel/shanghai.jpg'
import tibetImage from '../../assets/travel/tibet.jpg'
import xinjiangImage from '../../assets/travel/xinjiang.jpg'

export type HomePhase = 'primed' | 'gallery' | 'lifting' | 'ready'

export const HOME_SLIDE_INTERVAL_MS = 500
export const HOME_COUNTER_STOPS = [27, 42, 68, 92, 99] as const
export const HOME_COUNTER_EXIT_AT_MS = (HOME_COUNTER_STOPS.length - 1) * HOME_SLIDE_INTERVAL_MS
export const HOME_GALLERY_MS = HOME_COUNTER_EXIT_AT_MS + 500
export const HOME_CONTENT_DELAY_MS = 600
export const HOME_ACTION_DELAY_MS = 1380
export const HOME_LINE_REVEAL_MS = 800
export const HOME_FOOTPRINTS_EXIT_MS = 300
// Give the browser a paint after the last line settles before the walker mounts.
export const HOME_LIFT_MS = HOME_ACTION_DELAY_MS + HOME_LINE_REVEAL_MS + 40

export type HomeIntroSlide = {
  id: string
  src: string
  alt: string
}

export const homeIntroSlides: readonly HomeIntroSlide[] = [
  {
    id: 'curiosity',
    src: beijingImage,
    alt: 'White magnolia blossoms against a deep red wall in Beijing.',
  },
  {
    id: 'road',
    src: qinghaiImage,
    alt: 'A road crossing red and tan desert terrain in Qinghai.',
  },
  {
    id: 'city',
    src: shanghaiImage,
    alt: 'An aerial night view of illuminated streets and towers in Shanghai.',
  },
  {
    id: 'memory',
    src: tibetImage,
    alt: 'Colorful prayer flags radiating around a golden center in Tibet.',
  },
  {
    id: 'elsewhere',
    src: xinjiangImage,
    alt: 'Turquoise desert lakes winding between pale dunes in Xinjiang.',
  },
]

const preloadCache = new Map<string, Promise<void>>()

export function preloadHomeImage(src: string): Promise<void> {
  const cached = preloadCache.get(src)
  if (cached) return cached

  const pending = new Promise<void>((resolve) => {
    const image = new Image()
    image.decoding = 'async'

    const finish = () => {
      image.onload = null
      image.onerror = null
      resolve()
    }

    image.onload = () => {
      image.decode().catch(() => undefined).then(finish)
    }
    image.onerror = finish
    image.src = src
  })

  preloadCache.set(src, pending)
  return pending
}
