import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { GuideEditor } from './GuideEditor'
import { guideCover, guideProvinces, guideRepository, sampleGuides, type Guide, type GuideDay, type GuideDraft } from './guidesData'
import './guides.css'

function matchesGuide(guide: Guide, province: string, query: string) {
  if (province && guide.province !== province) return false
  const text = [guide.title, guide.place, guide.province, ...(guide.tags ?? [])].join(' ').normalize('NFKC').toLowerCase()
  return query.trim().normalize('NFKC').toLowerCase().split(/\s+/).every(word => text.includes(word))
}

function GuideItinerary({ days, generated }: { days: GuideDay[]; generated: boolean }) {
  return (
    <section className="guides-itinerary" aria-labelledby="guide-itinerary-title">
      <h3 id="guide-itinerary-title">{generated ? 'Generated itinerary' : 'Itinerary'}</h3>
      {days.map((day, index) => (
        <section className="guides-day" key={day.id}>
          <h4>Day {index + 1}</h4>
          <ol>
            {day.stops.map(stop => (
              <li key={stop.id}>
                <div className="guides-stop-heading">
                  <h5>{stop.place}</h5>
                  <span><time dateTime={stop.start}>{stop.start}</time>–<time dateTime={stop.end}>{stop.end}</time></span>
                </div>
                {stop.notes && <p>{stop.notes}</p>}
                {stop.tips && <p><strong>Tips </strong>{stop.tips}</p>}
                {stop.photos.map((src, photoIndex) => (
                  <img key={photoIndex} className="guides-detail-photo" src={src}
                    alt={`Photo ${photoIndex + 1} from ${stop.place}`} loading="lazy" decoding="async" />
                ))}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </section>
  )
}

export function GuidesPage({ ownerId }: { ownerId: number }) {
  const [guides, setGuides] = useState(sampleGuides)
  const [province, setProvince] = useState('')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [editor, setEditor] = useState<{ anchor: HTMLButtonElement; guide?: Guide }>()
  const [showDrafts, setShowDrafts] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const guideGrid = useRef<HTMLUListElement>(null)
  const reader = useRef<HTMLElement>(null)
  const readerScroll = useRef<HTMLDivElement>(null)
  const addGuide = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    let active = true
    guideRepository.list(ownerId).then(records => {
      if (active) setGuides(records)
    }).catch(() => {
      if (active) setNotice('Saved guides could not be loaded. You can still browse the examples.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [ownerId])

  useLayoutEffect(() => {
    if (loading || !guideGrid.current) return
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (reducedMotion?.matches) return

    const cards = Array.from(guideGrid.current.children)
    const stagger = Math.min(65, 480 / Math.max(1, cards.length - 1))
    const animations = cards.map((card, index) => card.animate?.([
      { opacity: 0, transform: 'translateY(16px) scale(.965)' },
      { opacity: 1, transform: 'translateY(-2px) scale(1.008)', offset: .78 },
      { opacity: 1, transform: 'translateY(0) scale(1)' },
    ], {
      delay: index * stagger,
      duration: 360,
      easing: 'cubic-bezier(.2,.7,.2,1)',
      fill: 'backwards',
    }))

    const cancel = () => animations.forEach(animation => animation?.cancel())
    reducedMotion?.addEventListener?.('change', cancel)
    return () => {
      reducedMotion?.removeEventListener?.('change', cancel)
      cancel()
    }
  }, [loading])

  const drafts = guides.filter(guide => guide.status === 'draft')
  const visible = guides.filter(guide => guide.status !== 'draft' && matchesGuide(guide, province, query))
  const selected = visible.find(guide => guide.id === selectedId) ?? visible[0]
  const selectedCover = selected ? guideCover(selected) : ''

  useEffect(() => {
    if (readerScroll.current) readerScroll.current.scrollTop = 0
  }, [selected?.id])

  function showGuide(id: string) {
    setSelectedId(id)
    if (window.matchMedia?.('(max-width: 760px)').matches) {
      reader.current?.scrollIntoView({ block: 'start' })
    }
  }

  function closeEditor() {
    const anchor = editor?.anchor
    setEditor(undefined)
    requestAnimationFrame(() => {
      if (anchor?.isConnected) anchor.focus({ preventScroll: true })
      else addGuide.current?.focus({ preventScroll: true })
    })
  }

  async function saveGuide(draft: GuideDraft) {
    const existing = editor?.guide
    const existingId = existing?.id
    const saved = await guideRepository.save(ownerId, draft, existingId)
    return () => {
      setGuides(current => existingId
        ? current.map(guide => guide.id === existingId ? saved : guide)
        : [saved, ...current])
      if (saved.status === 'draft') {
        setShowDrafts(true)
        setNotice('Draft saved in this browser.')
        return
      }
      if (!matchesGuide(saved, province, query)) {
        setProvince('')
        setQuery('')
      }
      setSelectedId(saved.id)
      setNotice(existing && existing.status !== 'draft'
        ? 'Changes saved in this browser.'
        : 'Guide published in this browser.')
    }
  }

  return (
    <section className="guides-page" aria-labelledby="guides-title">
      <header className="guides-header">
        <h1 id="guides-title" ref={heading} tabIndex={-1}>Guides</h1>
        <div className="guides-tools" role="search" aria-label="Find a guide">
          <label className="guides-filter">
            <span className="guides-sr-only">Filter guides by province</span>
            <select value={province} onChange={event => setProvince(event.target.value)}>
              <option value="">All provinces</option>
              {guideProvinces.map(name => <option key={name}>{name}</option>)}
            </select>
          </label>
          <label className="guides-search">
            <span className="guides-sr-only">Search guides by title, place or tag</span>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="5.75" />
              <path d="m15 15 4.1 4.1" />
            </svg>
            <input type="search" placeholder="Search guides" value={query}
              onChange={event => setQuery(event.target.value)} />
          </label>
          <button type="button" className="guides-assistant" disabled>AI assistant</button>
        </div>
        <button type="button" className="guides-add" ref={addGuide} disabled={loading} onClick={event => {
          setEditor({ anchor: event.currentTarget })
        }}><span aria-hidden="true">+</span> Add guide</button>
      </header>

      <div className="guides-columns">
        <section className="guides-library" aria-labelledby="guide-library-title">
          {drafts.length > 0 && (
            <div className="guides-drafts">
              <button className="guides-drafts-toggle" type="button" aria-expanded={showDrafts}
                aria-controls="guide-draft-list" onClick={() => setShowDrafts(current => !current)}>
                Drafts ({drafts.length}) <span aria-hidden="true">{showDrafts ? '▴' : '▾'}</span>
              </button>
              <ul id="guide-draft-list" hidden={!showDrafts} aria-label="Saved drafts">
                {drafts.map(draft => (
                  <li key={draft.id}>
                    <button type="button" className="guides-draft" aria-label={`Edit draft: ${draft.title || 'Untitled guide'}`} onClick={event => {
                      setEditor({ anchor: event.currentTarget, guide: draft })
                    }}>
                      {draft.title || 'Untitled guide'}
                      <span>Edit draft</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="guides-library-heading">
            <h2 id="guide-library-title">Travel guides</h2>
            <span role="status">{visible.length} {visible.length === 1 ? 'guide' : 'guides'}</span>
          </div>
          {loading ? null : visible.length ? (
            <ul className="guides-grid" ref={guideGrid}>
              {visible.map(guide => (
                <li key={guide.id}>
                  <button type="button" className="guides-card" aria-label={`Read guide: ${guide.title}`}
                    aria-pressed={selected?.id === guide.id} aria-controls="guide-details"
                    onClick={() => showGuide(guide.id)}>
                    <img src={guideCover(guide)} alt="" loading="lazy" decoding="async" />
                    <span className="guides-card-title">{guide.title}</span>
                    <span className="guides-card-place">{guide.place}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="guides-empty">
              <p>No guides match your search.</p>
              <button type="button" onClick={() => { setProvince(''); setQuery('') }}>Clear filters</button>
            </div>
          )}
        </section>

        <section className="guides-reader" id="guide-details" aria-label="Guide details" ref={reader}>
          {selected ? (
            <>
              <div className="guides-reader-bar">
                <p>{selected.province}</p>
                <button type="button" className="guides-edit" disabled={loading} onClick={event => {
                  setEditor({ anchor: event.currentTarget, guide: selected })
                }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path d="m14.8 5.2 4 4M4 20l4.3-.8L20 7.5 16.5 4 4.8 15.7 4 20Z" />
                  </svg>
                  Edit
                </button>
              </div>
              <div className="guides-reader-scroll" ref={readerScroll} tabIndex={0}
                role="region" aria-labelledby="guide-detail-title">
                <article>
                  <h2 id="guide-detail-title" aria-live="polite">{selected.title}</h2>
                  <p className="guides-detail-place">{selected.place}</p>
                  {!!selected.tags?.length && (
                    <ul className="guides-detail-tags" aria-label="Tags">
                      {selected.tags.map(tag => <li key={tag}>{tag}</li>)}
                    </ul>
                  )}
                  {selectedCover && <img className="guides-detail-cover" src={selectedCover} alt="" decoding="async" />}
                  {selected.body && (selected.itinerarySource !== 'generated' || !selected.itinerary?.length) && (
                    <div className="guides-detail-body">
                      {selected.body.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                    </div>
                  )}
                  {!!selected.itinerary?.length && (
                    <GuideItinerary days={selected.itinerary} generated={selected.itinerarySource === 'generated'} />
                  )}
                  {selected.photos.filter(photo => photo !== selectedCover).map((photo, index) => (
                    <img key={index} className="guides-detail-photo" src={photo}
                      alt={`Guide photo ${index + 1}`} loading="lazy" decoding="async" />
                  ))}
                </article>
              </div>
            </>
          ) : <p className="guides-reader-empty">Select a guide to see its details.</p>}
        </section>
      </div>
      {notice && <p className="guides-notice" role="status">{notice}</p>}
      {editor && <GuideEditor anchor={editor.anchor} draft={editor.guide} onSave={saveGuide} onDismiss={closeEditor} />}
    </section>
  )
}
