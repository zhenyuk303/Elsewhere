import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type Ref } from 'react'
import { travelSlides } from '../carousel/carouselData'
import { FootprintEditor } from './FootprintEditor'
import { FootprintSelect } from './FootprintSelect'
import { serverFootprints } from './footprintsApi'
import {
  allFilters, filterPhotos, provinces, shufflePhotoIds, themes,
  type Filters, type Footprint, type FootprintsRepository, type PhotoDraft, type PhotoUpload,
} from './footprintsData'
import { highestPhotoBefore, mobileBreakpoint, photoSize, reelFrame, reelSlideDistance, reelStride, rightmostPhotoX, shiftReelCard, trailingPhotoOffset, wheelTravel } from './reelGeometry'
import { useReelMotion } from './useReelMotion'
import './footprints.css'

const provinceOptions = [
  { value: '', label: 'All provinces' },
  ...provinces.map(province => ({ value: province, label: province })),
]
const themeOptions = [
  { value: '', label: 'All themes' },
  ...themes.map(theme => ({ value: theme, label: theme[0] + theme.slice(1).toLowerCase() })),
]

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

function TitleArtwork({ province }: { province: string }) {
  return province ? <ProvinceTitle key={province} province={province} /> : <>
    {[introduction.title, introduction.secondLine].map(line => (
      <span key={line} className="fp-title-line">
        {[...line].map((letter, index) => (
          <span key={index} className="fp-title-letter"
            style={{ animationDelay: `${index * titleLetterStagger}ms` }}>{letter}</span>
        ))}
      </span>
    ))}
  </>
}

function JournalTitle({ province, headingRef }: { province: string; headingRef: Ref<HTMLHeadingElement> }) {
  const currentVisual = useRef<HTMLSpanElement>(null)
  const [transition, setTransition] = useState({
    province, previous: undefined as { province: string; opacity: number } | undefined, version: 0,
  })
  useLayoutEffect(() => {
    if (transition.province === province) return
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const opacity = currentVisual.current ? Number(getComputedStyle(currentVisual.current).opacity) : 1
    setTransition({
      province, previous: reducedMotion ? undefined : { province: transition.province, opacity },
      version: transition.version + 1,
    })
  }, [province, transition.province, transition.version])

  useEffect(() => {
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const skipFade = () => {
      if (preference?.matches) setTransition(current => ({ ...current, previous: undefined }))
    }
    preference?.addEventListener('change', skipFade)
    return () => preference?.removeEventListener('change', skipFade)
  }, [])
  const { previous, version } = transition
  const titleClass = (value: string) => value ? 'fp-title fp-title--province' : 'fp-title'

  return <div className="fp-title-swap">
    <h1 id="footprints-title" tabIndex={-1} ref={headingRef} className={titleClass(transition.province)}
      aria-label={province || introduction.title}>
      <span key={version} ref={currentVisual} className={`fp-title-current${previous !== undefined ? ' fp-title-enter' : ''}`}
        aria-hidden="true" onAnimationEnd={event => {
          if (event.target !== event.currentTarget) return
          setTransition(current => current.version === version ? { ...current, previous: undefined } : current)
        }}>
        <TitleArtwork province={transition.province} />
      </span>
    </h1>
    {previous !== undefined && <div key={version} className="fp-title-previous" aria-hidden="true"
      style={{ '--fp-title-exit-opacity': previous.opacity } as CSSProperties}>
      <div className={titleClass(previous.province)}><TitleArtwork province={previous.province} /></div>
    </div>}
  </div>
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

export function FootprintsPage({ ownerId, repository = serverFootprints }: {
  ownerId: number
  repository?: FootprintsRepository
}) {
  const [photos, setPhotos] = useState<Footprint[]>([])
  const [filters, setFilters] = useState<Filters>(allFilters)
  const [gallery, setGallery] = useState<Gallery>({ ids: [] })
  const [filterSlide, setFilterSlide] = useState<FilterSlide | null>(null)
  const [editor, setEditor] = useState<'add' | Footprint | null>(null)
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null)
  const [noteClipped, setNoteClipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [notice, setNotice] = useState('')
  const [wheelHoverPaused, setWheelHoverPaused] = useState(false)
  const [animateOpening] = useState(() => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const [opening, setOpening] = useState(animateOpening)
  const galleryVersion = useRef(0)
  const chosenFilters = useRef(allFilters)
  const sceneElement = useRef<HTMLElement>(null)
  const detailsElement = useRef<HTMLDivElement>(null)
  const noteElement = useRef<HTMLParagraphElement>(null)
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
    }).catch((error: unknown) => {
      if (!active) return
      setLoadFailed(true)
      setLoadError(error instanceof Error ? error.message : 'Could not open your photo journal.')
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
    setExpandedNoteId(null)
    slideToFilter({ ids: shufflePhotoIds(filterPhotos(photos, next)), version: ++galleryVersion.current })
  }

  function select(photo: Footprint, card: GalleryCard) {
    if (filterSlide) return
    setNotice('')
    if (gallery.lead?.id !== photo.id) setExpandedNoteId(null)
    setGallery(current => ({ ...current, lead: photo, leadKey: card.key }))
    reel.scrollTo(reel.position + card.x - rightmostPhotoX(reel.width))
  }

  const lead = gallery.lead
  const hasLead = !!lead
  const noteExpanded = !!lead && expandedNoteId === lead.id
  const noteText = lead?.note.trim() ?? ''
  const notePreview = noteText.split(/\r?\n[ \t]*\r?\n/, 1)[0]
  const hasFullNote = !!noteText && (noteExpanded || notePreview !== noteText || noteClipped)
  const titleProvince = lead?.province ?? filters.province
  const canScrollReel = !filterSlide && gallery.ids.length > 0

  useLayoutEffect(() => {
    const scene = sceneElement.current
    const details = detailsElement.current
    const note = noteElement.current
    if (!scene || !details || !note) return

    const measure = () => {
      const frame = scene.getBoundingClientRect()
      if (!frame.height) return
      const reading = details.getBoundingClientRect()
      const body = note.getBoundingClientRect()
      const photoHeight = highestPhotoBefore(reel.width, reading.right - frame.left + 12)
      const spaceAroundNote = reading.bottom - frame.top - body.height + photoHeight + 24
      const lineHeight = Number.parseFloat(getComputedStyle(note).lineHeight)
      const minimumNoteHeight = noteExpanded ? body.height : Math.min(note.scrollHeight, lineHeight * 3)
      const title = heading.current?.querySelector<HTMLElement>(
        '.fp-title-current .fp-province-artwork, .fp-title-current .fp-province-fallback',
      )?.getBoundingClientRect()
      const spaceForTitle = title
        ? title.bottom - frame.top + highestPhotoBefore(reel.width, title.right - frame.left + 12) + 24
        : 0
      // Reserve enough room to read in short windows while keeping photos at full size.
      const minimumHeight = Math.ceil(Math.max(spaceAroundNote + minimumNoteHeight, spaceForTitle))
      const noteRoom = Math.floor(Math.max(window.innerHeight, minimumHeight) - spaceAroundNote)
      scene.style.setProperty('--fp-minimum-height', `${minimumHeight}px`)
      if (!noteExpanded) {
        note.style.setProperty('--fp-note-lines', String(Math.max(1, Math.min(4, Math.floor(noteRoom / lineHeight)))))
        setNoteClipped(note.scrollHeight - note.clientHeight > 1)
      }
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(details)
    if (heading.current) observer?.observe(heading.current)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      scene.style.removeProperty('--fp-minimum-height')
      note.style.removeProperty('--fp-note-lines')
    }
  }, [lead?.id, noteExpanded, noteText, titleProvince, reel.width])

  useEffect(() => {
    const element = sceneElement.current
    if (!element || !canScrollReel || editor) return
    function wheel(event: WheelEvent) {
      const target = event.target
      if (event.ctrlKey || (target instanceof Element && target.closest('dialog, .fp-select, .fp-note'))) return
      if (target instanceof Element && !target.closest('.fp-photo') &&
        Math.abs(event.deltaY) > Math.abs(event.deltaX) && (element?.clientHeight ?? 0) > window.innerHeight) return
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

  async function save(draft: PhotoDraft, upload?: PhotoUpload) {
    const previous = editor !== 'add' ? editor : null
    if (!editor || (previous && previous.ownerId !== ownerId)) throw new Error('You can only edit photos you own.')
    const record = await repository.save(ownerId, draft, previous?.id, upload)
    if (!mounted.current) return
    return () => {
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
    }
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
        <div className="fp-filter">
          <span aria-hidden="true">Province</span>
          <FootprintSelect id="fp-filter-province" label="Province" value={filters.province} options={provinceOptions}
            onChange={province => changeFilters({ province })} disabled={controlsDisabled} />
        </div>
        <div className="fp-filter">
          <span aria-hidden="true">Theme</span>
          <FootprintSelect id="fp-filter-theme" label="Theme" value={filters.theme} options={themeOptions}
            onChange={theme => changeFilters({ theme })} disabled={controlsDisabled} />
        </div>
        <button type="button" className="fp-add" disabled={controlsDisabled} onClick={event => {
          editorTrigger.current = event.currentTarget
          setEditor('add')
        }}><span aria-hidden="true">+</span> Add footprint</button>
      </div>

      <header className="fp-intro" data-selected={hasLead}>
        <div className="fp-intro-content">
          <JournalTitle province={titleProvince} headingRef={heading} />
          {lead ? (
            <div className="fp-details" ref={detailsElement} aria-live="polite">
              <p id="fp-journal-note" key={lead.id} ref={noteElement} className="fp-note" data-expanded={noteExpanded}>
                {noteExpanded ? lead.note : notePreview || <span>Note to be added</span>}
              </p>
              <div className="fp-detail-footer">
                <dl className="fp-detail-meta">
                  <div><dt className="fp-sr-only">City</dt><dd>{lead.city || <span>City to be added</span>}</dd></div>
                  <div><dt className="fp-sr-only">Date</dt><dd>{lead.date ? <time dateTime={lead.date}>{lead.date}</time> : <span>Date to be added</span>}</dd></div>
                  <div><dt className="fp-sr-only">Theme</dt><dd>{lead.themes.length ? lead.themes.join(' / ') : <span>Theme to be added</span>}</dd></div>
                </dl>
                {(hasFullNote || lead.ownerId === ownerId) && <div className="fp-detail-actions">
                  {hasFullNote && <button type="button" className="fp-read-note"
                    aria-expanded={noteExpanded} aria-controls="fp-journal-note"
                    onClick={() => setExpandedNoteId(noteExpanded ? null : lead.id)}>
                    {noteExpanded ? 'Show less' : 'Read full note'}
                  </button>}
                  {lead.ownerId === ownerId && <button type="button" className="fp-edit" onClick={event => {
                    editorTrigger.current = event.currentTarget
                    setEditor(lead)
                  }}>Edit<span aria-hidden="true"> ↗</span></button>}
                </div>}
              </div>
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
              <p>{loadError}</p>
              <button type="button" onClick={() => { setLoadFailed(false); setLoading(true); setAttempt(value => value + 1) }}>Try again</button>
            </> : <>
              <p>No footprints match these filters.</p>
              <button type="button" onClick={() => changeFilters(allFilters)}>Clear filters</button>
            </>}
          </div>
        ) : null}
      </div>

      <span className="fp-sr-only" role="status">{notice}</span>
      {editor && <FootprintEditor photo={editor === 'add' ? undefined : editor} anchor={editorTrigger.current}
        onSave={save} onDismiss={closeEditor}
        onDelete={editor !== 'add' && repository.remove ? async () => {
          await repository.remove!(ownerId, editor.id)
          if (!mounted.current) return
          return () => {
            if (!mounted.current) return
            const next = photos.filter(photo => photo.id !== editor.id)
            setPhotos(next)
            resetReel()
            setFilterSlide(null)
            setGallery({ ids: shufflePhotoIds(filterPhotos(next, chosenFilters.current)), version: ++galleryVersion.current })
            setNotice('Footprint deleted.')
          }
        } : undefined} />}
    </section>
  )
}
