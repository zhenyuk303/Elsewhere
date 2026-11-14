import beijingImage from '../../assets/travel/beijing.jpg'
import qinghaiImage from '../../assets/travel/qinghai.jpg'
import shanghaiImage from '../../assets/travel/shanghai.jpg'
import tibetImage from '../../assets/travel/tibet.jpg'
import xinjiangImage from '../../assets/travel/xinjiang.jpg'

export type HomePhase = 'primed' | 'gallery' | 'lifting' | 'ready'

export const HOME_GALLERY_MS = 2700
export const HOME_LIFT_MS = 850

export type HomeIntroSlide = {
  id: string
  src: string
  copy: string
  alt: string
}

export const homeIntroSlides: readonly HomeIntroSlide[] = [
  {
    id: 'curiosity',
    src: beijingImage,
    copy: '01 / GO WHERE CURIOSITY LEADS',
    alt: 'White magnolia blossoms against a deep red wall in Beijing.',
  },
  {
    id: 'road',
    src: qinghaiImage,
    copy: '02 / FOLLOW THE OPEN ROAD',
    alt: 'A road crossing red and tan desert terrain in Qinghai.',
  },
  {
    id: 'city',
    src: shanghaiImage,
    copy: '03 / SEE CITIES IN A NEW LIGHT',
    alt: 'An aerial night view of illuminated streets and towers in Shanghai.',
  },
  {
    id: 'memory',
    src: tibetImage,
    copy: '04 / COLLECT WHAT STAYS WITH YOU',
    alt: 'Colorful prayer flags radiating around a golden center in Tibet.',
  },
  {
    id: 'elsewhere',
    src: xinjiangImage,
    copy: '05 / FIND YOUR OWN ELSEWHERE',
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
