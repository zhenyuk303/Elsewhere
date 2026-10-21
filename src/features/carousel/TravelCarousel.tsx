import type { CarouselPhase } from './useCarousel'
import { travelSlides } from './carouselData'
import { useCarousel } from './useCarousel'
import './carousel.css'

type TravelCarouselProps = {
  paused: boolean
}

type SlideProps = {
  index: number
  phase: CarouselPhase
  active: boolean
  slot: 'current' | 'next'
}

function TravelSlide({ index, phase, active, slot }: SlideProps) {
  const slide = travelSlides[index]
  const clipId = `travel-window-${slot}-${index}`
  const animationPhase = active ? phase : 'waiting'

  return (
    <article
      className={`travel-slide travel-slide--${slot}`}
      aria-label={slide.location}
    >
      <img
        className="travel-image travel-image--gray"
        src={slide.src}
        alt=""
        draggable="false"
      />
      {active ? (
        <svg
          className={`color-window color-window--${animationPhase}`}
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <clipPath id={clipId}>
              <rect
                className="color-window__shape"
                x="150"
                y="150"
                width="700"
                height="700"
                rx="38"
              />
            </clipPath>
          </defs>
          <image
            href={slide.src}
            width="1000"
            height="1000"
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
          />
          <rect
            className="color-window__border"
            x="150"
            y="150"
            width="700"
            height="700"
            rx="38"
          />
        </svg>
      ) : null}
      <div className="slide-shade" aria-hidden="true" />
      <div className="location-lockup">
        <span className="location-index">
          {String(index + 1).padStart(2, '0')}
        </span>
        <h2>{slide.location}</h2>
      </div>
    </article>
  )
}

export function TravelCarousel({ paused }: TravelCarouselProps) {
  const { currentIndex, nextIndex, phase } = useCarousel(
    travelSlides.length,
    paused,
  )

  return (
    <section
      className={`travel-carousel ${paused ? 'is-paused' : ''}`}
      aria-label="Travel destinations"
      data-index={currentIndex}
      data-phase={phase}
    >
      <div className={`carousel-track carousel-track--${phase}`}>
        <TravelSlide
          index={currentIndex}
          phase={phase}
          active
          slot="current"
        />
        <TravelSlide
          index={nextIndex}
          phase="reveal"
          active={false}
          slot="next"
        />
      </div>
      <div className="carousel-counter" aria-hidden="true">
        <span>{String(currentIndex + 1).padStart(2, '0')}</span>
        <i />
        <span>{String(travelSlides.length).padStart(2, '0')}</span>
      </div>
    </section>
  )
}
