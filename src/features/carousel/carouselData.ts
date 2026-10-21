import beijing from '../../assets/travel/beijing.jpg'
import hongKong from '../../assets/travel/hong-kong.jpg'
import qinghai from '../../assets/travel/qinghai.jpg'
import shanghai from '../../assets/travel/shanghai.jpg'
import tibet from '../../assets/travel/tibet.jpg'
import xinjiang from '../../assets/travel/xinjiang.jpg'

export type TravelSlide = {
  src: string
  location: string
}

export const travelSlides: TravelSlide[] = [
  { src: beijing, location: 'Beijing' },
  { src: shanghai, location: 'Shanghai' },
  { src: xinjiang, location: 'Xinjiang' },
  { src: tibet, location: 'Tibet' },
  { src: qinghai, location: 'Qinghai' },
  { src: hongKong, location: 'Hong Kong' },
]
