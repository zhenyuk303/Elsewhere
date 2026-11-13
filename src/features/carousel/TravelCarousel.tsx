import { useEffect, useRef, useState } from 'react'
import type { CarouselPhase } from './useCarousel'
import {
  shuffleTravelSlides,
  travelSlides,
  type TravelSlide as TravelSlideData,
} from './carouselData'
import { useCarousel } from './useCarousel'
import './carousel.css'

type TravelCarouselProps = {
  paused: boolean
}

type SlideProps = {
  slide: TravelSlideData
  index: number
  phase: CarouselPhase
  active: boolean
  slot: 'current' | 'next'
}

function colorWindowScale(width: number, height: number) {
  if (width <= 0 || height <= 0) return 1

  const aspectRatio = width / height
  if (aspectRatio >= 1.5) return 0.5
  if (aspectRatio >= 1.05) return 0.72
  return 1
}

function TravelSlide({ slide, index, phase, active, slot }: SlideProps) {
  const clipId = `travel-window-${slot}-${index}`
  const animationPhase = active ? phase : 'waiting'
  const [imageError, setImageError] = useState(false)
  const [labelError, setLabelError] = useState(false)

  return (
    <article
      className={`travel-slide travel-slide--${slot} ${imageError ? 'has-image-error' : ''}`}
      aria-label={slide.location}
    >
      <div className="travel-image-fallback" aria-hidden="true" />
      <svg
        className={`travel-visual color-window--${animationPhase}`}
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMid slice"
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
          className="travel-image travel-image--gray"
          href={slide.src}
          width="1000"
          height="1000"
          preserveAspectRatio="xMidYMid slice"
          onError={() => setImageError(true)}
        />
        {active && !imageError ? (
          <>
            <image
              className="travel-image travel-image--color"
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
          </>
        ) : null}
      </svg>
      <div className="slide-shade" aria-hidden="true" />
      <div className="location-lockup">
        {labelError ? (
          <h2 className="location-fallback">{slide.location}</h2>
        ) : (
          <img
            className="location-calligraphy"
            src={slide.labelSrc}
            alt=""
            aria-hidden="true"
            onError={() => setLabelError(true)}
          />
        )}
      </div>
    </article>
  )
}

export function TravelCarousel({ paused }: TravelCarouselProps) {
  const carouselRef = useRef<HTMLElement>(null)
  const [slides] = useState(() => shuffleTravelSlides(travelSlides))
  const { currentIndex, nextIndex, phase } = useCarousel(
    slides.length,
    paused,
  )

  useEffect(() => {
    const carousel = carouselRef.current
    if (!carousel) return

    const updateScale = (width: number, height: number) => {
      carousel.style.setProperty(
        '--color-window-scale',
        String(colorWindowScale(width, height)),
      )
    }
    const updateFromElement = () => {
      const { width, height } = carousel.getBoundingClientRect()
      updateScale(width, height)
    }

    updateFromElement()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateFromElement)
      return () => window.removeEventListener('resize', updateFromElement)
    }

    const observer = new ResizeObserver(([entry]) => {
      if (entry) updateScale(entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(carousel)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={carouselRef}
      className={`travel-carousel ${paused ? 'is-paused' : ''}`}
      aria-label="Travel destinations"
      data-index={currentIndex}
      data-phase={phase}
      data-slide-count={slides.length}
      data-location={slides[currentIndex]?.location}
    >
      <div className={`carousel-track carousel-track--${phase}`}>
        <TravelSlide
          key={`current-${slides[currentIndex].labelSrc}`}
          slide={slides[currentIndex]}
          index={currentIndex}
          phase={phase}
          active
          slot="current"
        />
        <TravelSlide
          key={`next-${slides[nextIndex].labelSrc}`}
          slide={slides[nextIndex]}
          index={nextIndex}
          phase="reveal"
          active={false}
          slot="next"
        />
      </div>
      <div className="carousel-counter" aria-hidden="true">
        <span>{String(currentIndex + 1).padStart(2, '0')}</span>
        <i />
        <span>{String(slides.length).padStart(2, '0')}</span>
      </div>
    </section>
  )
}
