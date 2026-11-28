import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useAnchoredDialog } from '../../components/useAnchoredDialog'
import { prepareImage } from '../footprints/FootprintEditor'
import { provinces } from '../footprints/footprintsData'
import {
  listCommunitySources,
  type CommunityAttachment,
  type CommunityDraft,
  type CommunityDraftFields,
  type CommunityPhoto,
} from './communityData'
import './community-composer.css'

const imageTypes = 'image/jpeg,image/png,image/webp,image/avif,image/gif'
const maxPhotos = 9
const emptyFields: CommunityDraftFields = { title: '', body: '', province: '', city: '', photos: [] }

type Mode = 'share' | 'write'
type Pending = 'photos' | 'draft' | 'publish'
type Sources = Awaited<ReturnType<typeof listCommunitySources>>
type SavePost = (fields: CommunityDraftFields, id?: string) => Promise<(() => void) | void>
type ValidationField = 'title' | 'body' | 'source'

function location(attachment: CommunityAttachment) {
  const { city, province } = attachment
  return city && city !== province ? [city, province].filter(Boolean).join(', ') : province || city
}

function choices(items: CommunityAttachment[], field: 'city' | 'province') {
  return [...new Set(items.map(item => item[field]).filter(Boolean))].sort((left, right) => left.localeCompare(right))
}

export function CommunityComposer({ ownerId, anchor, draft, onDismiss, onSaveDraft, onPublish }: {
  ownerId: number
  anchor: HTMLElement
  draft?: CommunityDraft
  onDismiss: () => void
  onSaveDraft: SavePost
  onPublish: SavePost
}) {
  const heading = useId()
  const failureId = useId()
  const form = useRef<HTMLFormElement>(null)
  const active = useRef<Pending | null>(null)
  const closing = useRef(false)
  const revision = useRef(0)
  const [mode, setMode] = useState<Mode>(draft && !draft.attachment ? 'write' : 'share')
  const [kind, setKind] = useState<CommunityAttachment['kind']>(draft?.attachment?.kind ?? 'guide')
  const [attachment, setAttachment] = useState(draft?.attachment)
  const [caption, setCaption] = useState(draft?.attachment ? draft.body : '')
  const [fields, setFields] = useState<CommunityDraftFields>(draft && !draft.attachment ? draft : emptyFields)
  const [provinceFilter, setProvinceFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [sources, setSources] = useState<Sources>()
  const [sourceError, setSourceError] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [error, setError] = useState<{ message: string; field?: ValidationField }>()
  const saving = pending === 'draft' || pending === 'publish'
  const { dialogRef, close, backdropProps } = useAnchoredDialog({
    anchor, onClose: onDismiss, onBackdropClick: dismiss, initialFocus: '[name="community-post-mode"]:checked',
  })

  useEffect(() => () => { revision.current += 1 }, [])

  useEffect(() => {
    if (mode !== 'share' || sources || sourceError) return
    let active = true
    listCommunitySources(ownerId).then(result => {
      if (active) setSources(result)
    }).catch(() => {
      if (active) setSourceError(true)
    })
    return () => { active = false }
  }, [mode, ownerId, sourceError, sources])

  const items = (kind === 'guide' ? sources?.guides : sources?.footprints) ?? []
  const inProvince = items.filter(item => !provinceFilter || item.province === provinceFilter)
  const visible = inProvince.filter(item => !cityFilter || item.city === cityFilter)
  const displayedItems = attachment && !visible.some(item => item.id === attachment.id) ? [attachment, ...visible] : visible
  const provinceChoices = choices(items, 'province')
  const cityChoices = choices(inProvince, 'city')
  const attachmentPlace = attachment ? location(attachment) : ''

  function finish(afterClose?: () => void) {
    if (closing.current) return
    closing.current = true
    revision.current += 1
    close(afterClose)
  }

  function dismiss() {
    if (active.current !== 'draft' && active.current !== 'publish') finish()
  }

  function setField(field: 'title' | 'body' | 'province' | 'city', value: string) {
    setFields(current => ({ ...current, [field]: value }))
    if (error?.field === field) setError(undefined)
  }

  function chooseMode(nextMode: Mode) {
    setMode(nextMode)
    setError(undefined)
  }

  async function operate(operation: Pending, action: (isCurrent: () => boolean) => Promise<void>) {
    if (active.current || closing.current) return
    active.current = operation
    const request = ++revision.current
    const isCurrent = () => request === revision.current
    setPending(operation)
    setError(undefined)
    try {
      await action(isCurrent)
    } catch (cause) {
      if (isCurrent()) setError({ message: cause instanceof Error ? cause.message : 'Something went wrong. Try again.' })
    } finally {
      if (isCurrent()) {
        active.current = null
        setPending(null)
      }
    }
  }

  async function addPhotos(input: HTMLInputElement) {
    const files = Array.from(input.files ?? [])
    input.value = ''
    if (!files.length || active.current || closing.current) return
    if (fields.photos.length + files.length > maxPhotos) {
      setError({ message: `A post can include up to ${maxPhotos} photos.` })
      return
    }
    await operate('photos', async isCurrent => {
      const photos: CommunityPhoto[] = []
      for (const file of files) {
        const image = await prepareImage(file)
        if (!isCurrent()) return
        photos.push({ ...image, alt: 'Post photo' })
      }
      setFields(current => ({ ...current, photos: [...current.photos, ...photos] }))
    })
  }

  function validation(field: ValidationField, message: string) {
    setError({ field, message })
    const target = form.current?.elements.namedItem(field)
    if (target instanceof HTMLElement) target.focus()
  }

  async function save(operation: 'draft' | 'publish') {
    if (active.current || closing.current) return
    const publishing = operation === 'publish'
    let next = fields
    if (mode === 'share') {
      if (!attachment) {
        validation('source', `Choose a ${kind} to share.`)
        return
      }
      next = {
        title: attachment.title, body: caption, province: attachment.province, city: attachment.city,
        photos: [], attachment,
      }
    } else if (publishing) {
      if (!fields.title.trim()) return validation('title', 'Enter a title before publishing.')
      if (!fields.body.trim() && !fields.photos.length) return validation('body', 'Write something or add a photo before publishing.')
    }
    if (publishing) next = { ...next, title: next.title.trim(), body: next.body.trim(), city: next.city.trim() }

    const commit = publishing ? onPublish : onSaveDraft
    await operate(operation, async isCurrent => {
      const afterClose = await commit(next, draft?.id)
      if (isCurrent()) finish(afterClose || undefined)
    })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void save('publish')
  }

  const invalid = (field: ValidationField) => error?.field === field || undefined

  return (
    <dialog className="community-composer" ref={dialogRef} aria-labelledby={heading} {...backdropProps}
      onCancel={event => { event.preventDefault(); dismiss() }}>
      <header className="community-composer__header">
        <h2 id={heading}>{draft ? 'Edit draft' : 'Create post'}</h2>
        <button type="button" className="community-composer__close" onClick={dismiss} disabled={saving}
          aria-label="Close post editor">×</button>
      </header>

      <form className="community-composer__form" ref={form} noValidate onSubmit={submit}>
        <div className="community-composer__content">
          <fieldset className="community-composer__fields" disabled={pending !== null}>
            <div className="community-composer__modes" role="group" aria-label="Post type">
              <label><input type="radio" name="community-post-mode" checked={mode === 'share'}
                onChange={() => chooseMode('share')} /><span>Share existing</span></label>
              <label><input type="radio" name="community-post-mode" checked={mode === 'write'}
                onChange={() => chooseMode('write')} /><span>Write a post</span></label>
            </div>

            {mode === 'share' ? (
              <div className="community-composer__share">
                <div className="community-composer__controls">
                  <label className="community-composer__field">Share from
                    <select value={kind} onChange={event => {
                      setKind(event.currentTarget.value === 'guide' ? 'guide' : 'footprint')
                      setProvinceFilter('')
                      setCityFilter('')
                      setAttachment(undefined)
                      setError(undefined)
                    }}>
                      <option value="guide">Guides</option>
                      <option value="footprint">Footprints</option>
                    </select>
                  </label>
                  <div className="community-composer__location">
                    <label className="community-composer__field">Province
                      <select value={provinceFilter} onChange={event => {
                        const province = event.currentTarget.value
                        setProvinceFilter(province)
                        setCityFilter('')
                        if (province && attachment?.province !== province) setAttachment(undefined)
                      }}>
                        <option value="">All provinces</option>
                        {provinceChoices.map(province => <option key={province}>{province}</option>)}
                      </select>
                    </label>
                    <label className="community-composer__field">City
                      <select value={cityFilter} onChange={event => {
                        const city = event.currentTarget.value
                        setCityFilter(city)
                        if (city && attachment?.city !== city) setAttachment(undefined)
                      }}>
                        <option value="">All cities</option>
                        {cityChoices.map(city => <option key={city}>{city}</option>)}
                      </select>
                    </label>
                  </div>
                  <label className="community-composer__field">{kind === 'guide' ? 'Guide' : 'Footprint'}
                    <select name="source" value={attachment?.id ?? ''} aria-invalid={invalid('source')}
                      aria-describedby={invalid('source') ? failureId : undefined} onChange={event => {
                        const id = event.currentTarget.value
                        setAttachment(displayedItems.find(item => item.id === id))
                        setError(undefined)
                      }}>
                      <option value="">{kind === 'guide' ? 'Choose a guide' : 'Choose a footprint'}</option>
                      {displayedItems.map(item => {
                        const place = location(item)
                        return <option key={item.id} value={item.id}>
                          {place && place !== item.title ? `${item.title} · ${place}` : item.title}
                        </option>
                      })}
                    </select>
                  </label>
                  {!sources && !sourceError && <p className="community-composer__message" role="status">Loading your {kind === 'guide' ? 'guides' : 'footprints'}…</p>}
                  {(sourceError || sources?.unavailable.includes(kind)) ? (
                    <p className="community-composer__message" role="status">
                      Could not load your {kind === 'guide' ? 'guides' : 'footprints'}.{' '}
                      <button type="button" className="community-composer__retry" onClick={() => {
                        setSources(undefined)
                        setSourceError(false)
                      }}>Try again</button>
                    </p>
                  ) : sources && !displayedItems.length && (
                    <p className="community-composer__message" role="status">
                      No {kind === 'guide' ? 'guides' : 'footprints'}{provinceFilter || cityFilter ? ' match these filters.' : ' available to share.'}
                    </p>
                  )}
                  {attachment && <label className="community-composer__field">
                    <span>Caption <small className="community-composer__optional">Optional</small></span>
                    <textarea rows={3} maxLength={4000} value={caption} onChange={event => setCaption(event.currentTarget.value)} />
                  </label>}
                </div>
                <section className="community-composer__preview" aria-label="Share preview">
                  {attachment ? <>
                    <h3>{attachment.title}</h3>
                    {attachmentPlace && attachmentPlace !== attachment.title && <p className="community-composer__place">{attachmentPlace}</p>}
                    {!!attachment.photos.length && <div className="community-composer__preview-photos">
                      {attachment.photos.map((photo, index) => <img key={index}
                        src={photo.thumbnailSrc || photo.src} alt={photo.alt} loading="lazy" decoding="async" />)}
                    </div>}
                    {attachment.body && <p className="community-composer__preview-body">{attachment.body}</p>}
                  </> : <p className="community-composer__message">Choose a {kind} to preview it here.</p>}
                </section>
              </div>
            ) : (
              <div className="community-composer__controls">
                <fieldset className="community-composer__media">
                  <legend>Photos</legend>
                  <div className="community-composer__photos">
                    {fields.photos.map((photo, index) => (
                      <div className="community-composer__photo" key={index}>
                        <img src={photo.thumbnailSrc || photo.src} alt={`Post photo ${index + 1}`} />
                        <button type="button" aria-label={`Remove photo ${index + 1}`} onClick={() => {
                          setFields(current => ({ ...current, photos: current.photos.filter((_, item) => item !== index) }))
                          setError(undefined)
                        }}>×</button>
                      </div>
                    ))}
                    {fields.photos.length < maxPhotos && <label className="community-composer__add-photo">
                      <input type="file" multiple accept={imageTypes} aria-label="Add photos"
                        onChange={event => void addPhotos(event.currentTarget)} />
                      <span aria-hidden="true">+</span>
                    </label>}
                  </div>
                </fieldset>
                <label className="community-composer__field">Title
                  <input name="title" maxLength={120} value={fields.title} aria-invalid={invalid('title')}
                    aria-describedby={invalid('title') ? failureId : undefined} onChange={event => setField('title', event.currentTarget.value)} />
                </label>
                <label className="community-composer__field">Post text
                  <textarea name="body" rows={5} maxLength={12000} value={fields.body} aria-invalid={invalid('body')}
                    aria-describedby={invalid('body') ? failureId : undefined} onChange={event => setField('body', event.currentTarget.value)} />
                </label>
                <div className="community-composer__location" role="group" aria-label="Post location">
                  <label className="community-composer__field">Province
                    <select value={fields.province} onChange={event => setField('province', event.currentTarget.value)}>
                      <option value="">Choose a province</option>
                      {provinces.map(province => <option key={province}>{province}</option>)}
                    </select>
                  </label>
                  <label className="community-composer__field">City
                    <input value={fields.city} maxLength={120} onChange={event => setField('city', event.currentTarget.value)} />
                  </label>
                </div>
              </div>
            )}
          </fieldset>
        </div>
        <footer className="community-composer__footer">
          {pending === 'photos' && <p className="community-composer__message" role="status">Preparing photos…</p>}
          {error && <p className="community-composer__error" id={failureId} role="alert">{error.message}</p>}
          <div className="community-composer__actions">
            <button type="button" disabled={saving} onClick={dismiss}>Cancel</button>
            <button type="button" disabled={pending !== null || (mode === 'share' && !attachment)} onClick={() => void save('draft')}>
              {pending === 'draft' ? 'Saving…' : 'Save draft'}
            </button>
            <button type="submit" disabled={pending !== null}>{pending === 'publish' ? 'Publishing…' : 'Publish'}</button>
          </div>
        </footer>
      </form>
    </dialog>
  )
}
