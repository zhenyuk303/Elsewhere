import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { travelSlides } from '../carousel/carouselData'
import { FootprintEditor } from './FootprintEditor'
import {
  allFilters, demoFootprints, filterPhotos, provinces, shufflePhotoIds, themes,
  type Filters, type Footprint, type FootprintsRepository, type PhotoDraft,
} from './footprintsData'
import { mobileBreakpoint, photoSize, reelFrame, reelSlideDistance, reelStride, rightmostPhotoX, shiftReelCard, trailingPhotoOffset, wheelTravel } from './reelGeometry'
import { useReelMotion } from './useReelMotion'
import './footprints.css'

const introduction = {
  title: 'Footprints',
  secondLine: 'Journal',
  lines: ['Some places stay with us.', 'A photo journal of the places you carry home.'],
}
const titleLetterDuration = 1200
const titleLetterStagger = 50
const titleOpeningDuration = titleLetterDuration +
  (Math.max(introduction.title.length, introduction.secondLine.length) - 1) * titleLetterStagger
type Gallery = { ids: string[]; lead?: Footprint; leadKey?: string; version?: number }

function ProvinceTitle({ province }: { province: string }) {
  const labelSrc = travelSlides.find(slide => slide.location === province)?.labelSrc
  const [imageFailed, setImageFailed] = useState(false)
  if (!labelSrc || imageFailed) return <span className="fp-province-fallback">{province}</span>

  return (
    <span className="fp-province-artwork">
      <img src={labelSrc} alt="" decoding="async" onError={() => setImageFailed(true)} />
    </span>
  )
}

function galleryCardKey(version: number, index: number, id: string) {
  return `${version}:${index}:${id}`
}

function galleryLayout(width: number, gallery: Gallery, position: number, openingScale = 1) {
  const { ids, leadKey, version = 0 } = gallery
  // Eight slots cover the full scrolling range, including partially visible cards.
  const slotCount = ids.length ? ids.length * Math.ceil(8 / ids.length) : 0
  const frame = reelFrame(width, slotCount, position, openingScale)
  const seen = new Set<string>()
  const cards = frame.map(card => {
    const { index } = card
    const id = ids[index % ids.length]
    const key = galleryCardKey(version, index, id)
    const selected = key === leadKey
    const isRepeat = !selected && seen.has(id)
    seen.add(id)
    return { ...card, id, selected, isRepeat, key }
  })
  const lead = cards.find(card => card.selected)
  if (!lead) return cards
  const offset = trailingPhotoOffset(width, lead.x)
  if (!offset) return cards
  return cards
    .map(card => card.x > lead.x ? { ...card, left: card.left + offset } : card)
    .filter(card => card.left < width - .01)
}

type GalleryCard = ReturnType<typeof galleryLayout>[number]
type FilterSlide = { width: number; distance: number; outgoing: GalleryCard[] }

export function FootprintsPage({ ownerId, repository = demoFootprints }: {
  ownerId: number
  repository?: FootprintsRepository
}) {
  const [photos, setPhotos] = useState<Footprint[]>([])
  const [filters, setFilters] = useState<Filters>(allFilters)
  const [gallery, setGallery] = useState<Gallery>({ ids: [] })
  const [filterSlide, setFilterSlide] = useState<FilterSlide | null>(null)
  const [editor, setEditor] = useState<'add' | Footprint | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [notice, setNotice] = useState('')
  const [wheelHoverPaused, setWheelHoverPaused] = useState(false)
  const [animateOpening] = useState(() => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const [opening, setOpening] = useState(animateOpening)
  const galleryVersion = useRef(0)
  const chosenFilters = useRef(allFilters)
  const sceneElement = useRef<HTMLElement>(null)
  const wheelPointer = useRef<{ x: number; y: number } | null>(null)
  const gesture = useRef<{ x: number; y: number; lastX: number; active: boolean } | null>(null)
  const suppressClickUntil = useRef(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const editorTrigger = useRef<HTMLButtonElement | null>(null)
  const mounted = useRef(false)
  const reel = useReelMotion()
  const resetReel = reel.reset
  const move = reel.move
  const openReel = reel.open

  useEffect(() => {
    mounted.current = true
    heading.current?.focus({ preventScroll: true })
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!opening) return
    const timer = window.setTimeout(() => setOpening(false), titleOpeningDuration)
    return () => window.clearTimeout(timer)
  }, [opening])

  useEffect(() => {
    let active = true
    repository.list(ownerId).then(records => {
      if (!active) return
      setPhotos(records)
      setGallery({ ids: shufflePhotoIds(records) })
      setLoading(false)
      if (animateOpening && records.length) openReel()
    }).catch(() => {
      if (!active) return
      setLoadFailed(true)
      setLoading(false)
    })
    return () => { active = false }
  }, [ownerId, repository, attempt, animateOpening, openReel])

  useEffect(() => {
    if (!filterSlide) return
    if (filterSlide.width === reel.width && reel.position !== -filterSlide.distance) return
    resetReel()
    setFilterSlide(null)
  }, [filterSlide, reel.position, reel.width, resetReel])

  function slideToFilter(next: Gallery) {
    const outgoing = cards.filter(isVisible)
    resetReel()
    setGallery(next)
    if ((!outgoing.length && !next.ids.length) || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setFilterSlide(null)
      return
    }
    const incoming = galleryLayout(reel.width, next, 0)
    const distance = reelSlideDistance(reel.width, outgoing, incoming)
    setFilterSlide({ width: reel.width, distance, outgoing })
    move(-distance)
  }

  function changeFilters(change: Partial<Filters>) {
    const next = { ...chosenFilters.current, ...change }
    chosenFilters.current = next
    setFilters(next)
    setNotice('')
    slideToFilter({ ids: shufflePhotoIds(filterPhotos(photos, next)), version: ++galleryVersion.current })
  }

  function select(photo: Footprint, card: GalleryCard) {
    if (filterSlide) return
    setNotice('')
    setGallery(current => ({ ...current, lead: photo, leadKey: card.key }))
    reel.scrollTo(reel.position + card.x - rightmostPhotoX(reel.width))
  }

  const lead = gallery.lead
  const canScrollReel = !filterSlide && gallery.ids.length > 0

  useEffect(() => {
    const element = sceneElement.current
    if (!element || !canScrollReel || editor) return
    function wheel(event: WheelEvent) {
      if (event.ctrlKey || (event.target instanceof Element && event.target.closest('dialog, select, .fp-note'))) return
      const mode = event.deltaMode
      const distance = wheelTravel(event.deltaX, event.deltaY, mode, element?.clientHeight)
      if (!distance) return
      event.preventDefault()
      wheelPointer.current = { x: event.clientX, y: event.clientY }
      setWheelHoverPaused(true)
      move(distance)
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [canScrollReel, editor, move])

  function closeEditor() {
    setEditor(null)
    const trigger = editorTrigger.current
    requestAnimationFrame(() => {
      if (trigger?.isConnected) trigger.focus()
      else heading.current?.focus()
    })
  }

  async function save(draft: PhotoDraft) {
    const previous = editor !== 'add' ? editor : null
    if (!editor || (previous && previous.ownerId !== ownerId)) throw new Error('You can only edit photos you own.')
    const record = await repository.save(ownerId, draft, previous?.id)
    if (!mounted.current) return
    const next = previous ? photos.map(photo => photo.id === record.id ? record : photo) : [...photos, record]
    const result = filterPhotos(next, chosenFilters.current)
    const ids = shufflePhotoIds(result)
    const savedIndex = ids.indexOf(record.id)
    const inScope = savedIndex >= 0
    const version = ++galleryVersion.current
    const position = inScope ? savedIndex * reelStride(reel.width) - rightmostPhotoX(reel.width) : 0
    resetReel(position)
    setFilterSlide(null)
    setPhotos(next)
    setGallery({ ids, version, lead: inScope ? record : undefined, leadKey: inScope ? galleryCardKey(version, savedIndex, record.id) : undefined })
    setNotice(inScope ? 'Footprint saved.' : 'Footprint saved. It is outside the current filters.')
    closeEditor()
  }

  const controlsDisabled = loading || loadFailed
  const mediaSize = photoSize(reel.width)
  const byId = new Map(photos.map(photo => [photo.id, photo]))
  const slide = filterSlide?.width === reel.width ? filterSlide : null
  const openingScale = reel.width > mobileBreakpoint ? reel.openingProgress : 1
  const restingCards = galleryLayout(reel.width, gallery, filterSlide ? 0 : reel.position, openingScale)
  const cards = slide ? [
    ...slide.outgoing.map(card => shiftReelCard(reel.width, { ...card, selected: false }, -reel.position))
      .filter(isVisible),
    ...restingCards.map(card => shiftReelCard(reel.width, card, -reel.position - slide.distance)),
  ].sort((a, b) => a.x - b.x) : restingCards

  function isVisible(card: GalleryCard) {
    return card.left < reel.width && card.left + card.width > 0
  }

  return (
    <section ref={sceneElement} className="footprints" data-opening={opening && gallery.version === undefined}
      style={{ '--fp-title-letter-duration': `${titleLetterDuration}ms` } as CSSProperties}>
      <div className="fp-tools">
        <div className="fp-filter"><label htmlFor="fp-filter-province">Province</label>
          <select id="fp-filter-province" value={filters.province} onChange={event => changeFilters({ province: event.target.value })} disabled={controlsDisabled}>
            <option value="">All provinces</option>
            {provinces.map(province => <option key={province}>{province}</option>)}
          </select>
        </div>
        <div className="fp-filter"><label htmlFor="fp-filter-theme">Theme</label>
          <select id="fp-filter-theme" value={filters.theme} onChange={event => changeFilters({ theme: event.target.value })} disabled={controlsDisabled}>
            <option value="">All themes</option>
            {themes.map(theme => <option key={theme}>{theme}</option>)}
          </select>
        </div>
        <button type="button" className="fp-add" disabled={controlsDisabled} onClick={event => {
          editorTrigger.current = event.currentTarget
          setEditor('add')
        }}><span aria-hidden="true">+</span> Add footprint</button>
      </div>

      <header className="fp-intro" data-selected={!!lead}>
        <div className="fp-intro-content">
          <h1 id="footprints-title" tabIndex={-1} ref={heading} className={lead ? 'fp-title fp-title--province' : 'fp-title'}
            aria-label={lead?.province ?? introduction.title}>
            {lead ? <ProvinceTitle key={lead.province} province={lead.province} /> : [introduction.title, introduction.secondLine].map(line => (
              <span key={line} className="fp-title-line" aria-hidden="true">
                {[...line].map((letter, index) => (
                  <span key={index} className="fp-title-letter"
                    style={{ animationDelay: `${index * titleLetterStagger}ms` }}>{letter}</span>
                ))}
              </span>
            ))}
          </h1>
          {lead ? (
            <div className="fp-details" aria-live="polite">
              <dl>
                <div><dt>City</dt><dd>{lead.city || <span>City to be added</span>}</dd></div>
                <div><dt>Date</dt><dd>{lead.date ? <time dateTime={lead.date}>{lead.date}</time> : <span>Date to be added</span>}</dd></div>
                <div><dt>Theme</dt><dd>{lead.themes.length ? lead.themes.join(' / ') : <span>Theme to be added</span>}</dd></div>
              </dl>
              <p className="fp-note">{lead.note.trim() ? lead.note : <span>Note to be added</span>}</p>
              {lead.ownerId === ownerId && <button type="button" className="fp-edit" onClick={event => {
                editorTrigger.current = event.currentTarget
                setEditor(lead)
              }}>Edit<span aria-hidden="true"> ↗</span></button>}
            </div>
          ) : <p className="fp-description">{introduction.lines.map(line => <span key={line}>{line}</span>)}</p>}
        </div>
      </header>

      <div className="fp-gallery" role="region" aria-label="Photo composition" aria-busy={!!slide || (reel.moving && !!gallery.leadKey)}
        data-moving={reel.moving || !!slide} data-wheel-hover-paused={wheelHoverPaused} tabIndex={0}
        style={{
          '--fp-photo-media-width': `${mediaSize.width}px`,
          '--fp-photo-media-height': `${mediaSize.height}px`,
          '--fp-photo-opening-opacity': reel.openingProgress,
        } as CSSProperties}
        onKeyDown={event => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault()
          event.currentTarget.focus({ preventScroll: true })
          if (canScrollReel) move((event.key === 'ArrowRight' ? -1 : 1) * reelStride(reel.width))
        }}
        onPointerDown={event => {
          if (!canScrollReel || event.button !== 0) return
          gesture.current = { x: event.clientX, y: event.clientY, lastX: event.clientX, active: false }
        }}
        onPointerMove={event => {
          const pointer = wheelPointer.current
          if (pointer && event.pointerType === 'mouse') {
            if (reel.moving) {
              wheelPointer.current = { x: event.clientX, y: event.clientY }
            } else if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) >= 4) {
              wheelPointer.current = null
              setWheelHoverPaused(false)
            }
          }
          const start = gesture.current
          if (!start) return
          if (!start.active) {
            const dx = event.clientX - start.x
            if (Math.abs(dx) < 5 || Math.abs(dx) <= Math.abs(event.clientY - start.y)) return
            start.active = true
            event.currentTarget.setPointerCapture?.(event.pointerId)
          }
          if (canScrollReel) move(start.lastX - event.clientX, true)
          start.lastX = event.clientX
        }}
        onPointerCancel={() => { gesture.current = null }}
        onPointerUp={event => {
          const start = gesture.current
          gesture.current = null
          if (!start?.active) return
          if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
          suppressClickUntil.current = performance.now() + 300
        }}>
        {cards.map(card => {
          const { id, key, selected, isRepeat, left, width, height, scale } = card
          const photo = byId.get(id)
          if (!photo) return null
          const hidden = !!slide
          const visibleLeft = Math.max(0, left)
          return (
            <button type="button" key={key} className="fp-photo"
              style={{
                left, width, height,
                '--fp-photo-media-x': `${left}px`,
                '--fp-photo-media-scale': scale,
                '--fp-meta-inset': `${visibleLeft - left}px`,
                '--fp-meta-room': `${reel.width - visibleLeft}px`,
              } as CSSProperties}
              aria-label={`View photo from ${photo.province}`} aria-pressed={selected}
              aria-hidden={hidden ? true : undefined} tabIndex={hidden || isRepeat ? -1 : undefined} onClick={event => {
                if (event.detail && performance.now() < suppressClickUntil.current) return
                select(photo, card)
              }}>
              <span className="fp-photo-media">
                <img src={photo.image.thumbnailSrc} alt={`Photo from ${photo.province}`} loading="lazy" decoding="async" draggable={false} />
              </span>
              <span className="fp-photo-meta" aria-hidden="true">
                <span className="fp-photo-province">{photo.province}</span>
                {photo.date
                  ? <time className="fp-photo-date" dateTime={photo.date}>{photo.date}</time>
                  : <span className="fp-photo-date">Date unknown</span>}
              </span>
            </button>
          )
        })}
        {loading || loadFailed || (!slide && !gallery.ids.length) ? (
          <div className="fp-empty" role={loadFailed ? 'alert' : 'status'}>
            {loading ? 'Opening your photo journal…' : loadFailed ? <>
              <p>Could not open your local photo library.</p>
              <button type="button" onClick={() => { setLoadFailed(false); setLoading(true); setAttempt(value => value + 1) }}>Try again</button>
            </> : <>
              <p>No footprints match these filters.</p>
              <button type="button" onClick={() => changeFilters(allFilters)}>Clear filters</button>
            </>}
          </div>
        ) : null}
      </div>

      <span className="fp-sr-only" role="status">{notice}</span>
      {editor && <FootprintEditor photo={editor === 'add' ? undefined : editor} onSave={save} onDismiss={closeEditor} />}
    </section>
  )
}
