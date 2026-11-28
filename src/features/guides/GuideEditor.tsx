import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useAnchoredDialog } from '../../components/useAnchoredDialog'
import { prepareImage } from '../footprints/FootprintEditor'
import { guideCities } from './guideCities'
import { guideProvinces, type GuideDay, type GuideDraft, type GuideStatus, type GuideStop } from './guidesData'
import { GuideItineraryEditor, newGuideDay } from './GuideItineraryEditor'
import './guide-editor.css'

const acceptedImages = 'image/jpeg,image/png,image/webp,image/avif,image/gif'
const maxPhotos = 8
const otherCity = '__other__'
const clockTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const emptyDraft: GuideDraft = { title: '', province: '', place: '', body: '', photos: [] }
type Operation = 'cover' | 'photos' | 'stopPhotos' | 'save'

function savedCity(draft?: GuideDraft) {
  if (!draft) return ''
  if (draft.status === 'draft' && draft.city !== undefined) return draft.city
  const city = draft.city?.trim()
  if (city) return city
  const place = draft.place.trim()
  const parts = place.split(/[,，]/).map((part) => part.trim()).filter(Boolean)
  const localParts = parts.length > 1
    ? parts.filter((part) => part.toLowerCase() !== draft.province.toLowerCase()) : parts
  const cities = guideCities[draft.province] ?? []
  for (const part of localParts) {
    const match = cities.find((item) => item.toLowerCase() === part.toLowerCase())
    if (match) return match
  }
  return localParts.length === 1 ? localParts[0] : place
}

function stopHasContent(stop: GuideStop) {
  const timesEdited = Boolean(stop.start || stop.end) && (stop.start !== '09:00' || stop.end !== '12:00')
  return Boolean(stop.place || stop.notes || stop.tips || stop.photos.length || timesEdited)
}

function splitTags(input: string) {
  const tags = new Map<string, string>()
  for (const tag of input.split(/[,，]/).map((item) => item.trim()).filter(Boolean)) {
    if (!tags.has(tag.toLowerCase())) tags.set(tag.toLowerCase(), tag)
  }
  return [...tags.values()]
}

export function GuideEditor({ anchor, draft, onSave, onDismiss }: {
  anchor: HTMLElement | null
  draft?: GuideDraft
  onSave: (draft: GuideDraft) => Promise<() => void>
  onDismiss: () => void
}) {
  const heading = useId()
  const form = useRef<HTMLFormElement>(null)
  const currentOperation = useRef<Operation | null>(null)
  const closing = useRef(false)
  const revision = useRef(0)
  const [initialCity] = useState(() => savedCity(draft))
  const [values, setValues] = useState<GuideDraft>(draft ?? emptyDraft)
  const [cityChoice, setCityChoice] = useState(() => {
    if (!initialCity) return ''
    return guideCities[draft?.province ?? '']?.includes(initialCity) ? initialCity : otherCity
  })
  const [customCity, setCustomCity] = useState(initialCity)
  const [tagInput, setTagInput] = useState(() => draft?.tags?.join(', ') ?? '')
  const [days, setDays] = useState<GuideDay[]>(() => draft?.itinerary?.length ? draft.itinerary : [newGuideDay()])
  const [pending, setPending] = useState<Operation | null>(null)
  const [error, setError] = useState('')
  const isPublished = Boolean(draft && draft.status !== 'draft')
  const cities = guideCities[values.province] ?? []
  const { dialogRef, close, backdropProps } = useAnchoredDialog({
    anchor, onClose: onDismiss, initialFocus: 'input[name="title"]', onBackdropClick: dismiss,
  })

  useEffect(() => () => {
    revision.current += 1
  }, [])

  async function runOperation(operation: Operation, task: (isCurrent: () => boolean) => Promise<void>) {
    if (closing.current || currentOperation.current) return
    currentOperation.current = operation
    const startedAt = ++revision.current
    const isCurrent = () => startedAt === revision.current
    setPending(operation)
    setError('')
    try {
      await task(isCurrent)
    } catch (cause) {
      if (isCurrent()) setError(cause instanceof Error ? cause.message : 'Something went wrong. Try again.')
    } finally {
      if (isCurrent()) {
        currentOperation.current = null
        setPending(null)
      }
    }
  }

  async function preparePhotos(files: File[], isCurrent: () => boolean) {
    const sources: string[] = []
    for (const file of files) {
      const image = await prepareImage(file)
      if (!isCurrent()) return
      sources.push(image.src)
    }
    return sources
  }

  async function choosePhotos(input: HTMLInputElement, kind: 'cover' | 'photos') {
    const chosen = Array.from(input.files ?? [])
    input.value = ''
    if (!chosen.length || currentOperation.current) return
    if (kind === 'photos' && chosen.length + values.photos.length > maxPhotos) {
      setError(`A guide can include up to ${maxPhotos} content photos.`)
      return
    }
    await runOperation(kind, async (isCurrent) => {
      const sources = await preparePhotos(chosen, isCurrent)
      if (!sources || !isCurrent()) return
      setValues((previous) => kind === 'cover'
        ? { ...previous, cover: sources[0] }
        : { ...previous, photos: [...previous.photos, ...sources] })
    })
  }

  async function attachStopPhotos(dayId: string, stopId: string, chosen: File[]) {
    const stop = days.find((day) => day.id === dayId)?.stops.find((item) => item.id === stopId)
    if (!stop || !chosen.length || currentOperation.current) return
    if (stop.photos.length + chosen.length > maxPhotos) {
      setError(`Each stop can include up to ${maxPhotos} photos.`)
      return
    }
    await runOperation('stopPhotos', async (isCurrent) => {
      const sources = await preparePhotos(chosen, isCurrent)
      if (!sources || !isCurrent()) return
      setDays((previous) => previous.map((day) => day.id === dayId ? {
        ...day,
        stops: day.stops.map((item) => item.id === stopId ? { ...item, photos: [...item.photos, ...sources] } : item),
      } : day))
    })
  }

  function focusField(name: string) {
    const field = form.current?.elements.namedItem(name)
    if (field instanceof HTMLElement) field.focus()
  }

  async function submit(status: GuideStatus) {
    if (closing.current || currentOperation.current) return
    const publishing = status === 'published'
    const title = publishing ? values.title.trim() : values.title
    const city = cityChoice === otherCity ? (publishing ? customCity.trim() : customCity) : cityChoice
    const body = publishing ? values.body.trim() : values.body
    const itinerary = publishing ? days.map((day) => ({
      ...day,
      stops: day.stops.map((stop) => ({
        ...stop,
        place: stop.place.trim(),
        start: stop.start.trim(),
        end: stop.end.trim(),
        notes: stop.notes.trim(),
        tips: stop.tips.trim(),
      })).filter(stopHasContent),
    })).filter((day) => day.stops.length > 0) : days

    if (publishing) {
      if (!title || !guideProvinces.includes(values.province) || !city) {
        setError('Enter a title, province and city before publishing.')
        focusField(!title ? 'title' : !guideProvinces.includes(values.province) ? 'province'
          : cityChoice === otherCity ? 'customCity' : 'city')
        return
      }
      for (const day of itinerary) {
        for (const stop of day.stops) {
          const invalid = !stop.place ? 'place' : !clockTime.test(stop.start) ? 'start'
            : !clockTime.test(stop.end) || stop.end <= stop.start ? 'end' : null
          if (invalid) {
            setError(invalid === 'place' ? 'Enter a place for each itinerary stop.'
              : 'Give each stop a start and end time. The end time must be later than the start.')
            focusField(`guide-stop-${stop.id}-${invalid}`)
            return
          }
        }
      }
      if (!itinerary.length && !body) {
        setError('Add at least one itinerary stop or guide text before publishing.')
        const first = days[0]?.stops[0]
        if (first) focusField(`guide-stop-${first.id}-place`)
        return
      }
    }
    const province = values.province
    const displayCity = city.trim()
    const cityIncludesProvince = displayCity.toLowerCase().endsWith(province.toLowerCase())
    const place = draft && draft.province === province && initialCity === city ? draft.place
      : displayCity && province && !cityIncludesProvince ? `${displayCity}, ${province}` : displayCity
    await runOperation('save', async (isCurrent) => {
      const applySave = await onSave({
        title, province, city, place, body, cover: values.cover,
        photos: values.photos, tags: splitTags(tagInput), itinerary, status,
        itinerarySource: draft?.body.trim() === body.trim() ? draft?.itinerarySource : undefined,
      })
      if (isCurrent()) finish(applySave)
    })
  }

  function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit('published')
  }

  function finish(afterClose?: () => void) {
    if (closing.current) return
    closing.current = true
    revision.current += 1
    close(afterClose)
  }

  function dismiss() {
    if (currentOperation.current !== 'save') finish()
  }

  function removeCover() {
    setError('')
    setValues((previous) => ({ ...previous, cover: undefined }))
  }

  function removePhoto(index: number) {
    setError('')
    setValues((previous) => ({ ...previous, photos: previous.photos.filter((_, item) => item !== index) }))
  }

  return (
    <dialog className="guide-editor" ref={dialogRef} aria-labelledby={heading} {...backdropProps}
      onCancel={(event) => { event.preventDefault(); dismiss() }}>
      <header className="guide-editor__header">
        <h2 id={heading}>{draft ? 'Edit guide' : 'Add a guide'}</h2>
        <button type="button" className="guide-editor__close" aria-label="Close guide editor"
          disabled={pending === 'save'} onClick={dismiss}>×</button>
      </header>

      <form ref={form} className="guide-editor__form" noValidate onSubmit={publish}>
        <div className="guide-editor__content">
          <fieldset className="guide-editor__fields" disabled={pending !== null}>
            <div className="guide-editor__metadata">
              <div className="guide-editor__metadata-fields">
                <label className="guide-editor__field">
                  Title
                  <input name="title" required maxLength={100} value={values.title}
                    placeholder="Give your guide a title"
                    onChange={(event) => setValues({ ...values, title: event.currentTarget.value })} />
                </label>
                <div className="guide-editor__location">
                  <label className="guide-editor__field">
                    Province
                    <select name="province" required value={values.province}
                      onChange={(event) => {
                        setValues({ ...values, province: event.currentTarget.value })
                        setCityChoice('')
                        setCustomCity('')
                      }}>
                      <option value="">Choose a province</option>
                      {guideProvinces.map((province) => <option key={province}>{province}</option>)}
                    </select>
                  </label>
                  <label className="guide-editor__field">
                    City
                    <select name="city" required value={cityChoice} disabled={!values.province}
                      onChange={(event) => setCityChoice(event.currentTarget.value)}>
                      <option value="">{values.province ? 'Choose a city' : 'Choose a province first'}</option>
                      {cities.map((city) => <option key={city}>{city}</option>)}
                      <option value={otherCity}>Other city</option>
                    </select>
                  </label>
                </div>
                {cityChoice === otherCity && <label className="guide-editor__field">
                  City name
                  <input name="customCity" required maxLength={100} value={customCity}
                    onChange={(event) => setCustomCity(event.currentTarget.value)} />
                </label>}
                <label className="guide-editor__field">
                  <span>Tags <small>Separate with commas</small></span>
                  <input name="tags" maxLength={320} placeholder="e.g. Street food, Walking" value={tagInput}
                    onChange={(event) => setTagInput(event.currentTarget.value)} />
                </label>
              </div>
              <div className="guide-editor__media">
                <label className="guide-editor__field">
                  <span>Cover photo <small>Optional</small></span>
                  <span className="guide-editor__cover">
                    {values.cover && <img src={values.cover} alt="Cover preview" />}
                    <span className="guide-editor__cover-action" aria-hidden="true">
                      {values.cover ? 'Replace cover photo' : 'Choose cover photo'}
                    </span>
                    <input type="file" className="guide-editor__cover-input" aria-label="Cover photo (optional)"
                      accept={acceptedImages} onChange={(event) => void choosePhotos(event.currentTarget, 'cover')} />
                  </span>
                </label>
                {values.cover && <button type="button" className="guide-editor__remove" onClick={removeCover}>Remove cover</button>}
              </div>
            </div>

            <section className="guide-editor__itinerary">
              <h3>Itinerary</h3>
              <GuideItineraryEditor days={days} onChange={setDays}
                onAttach={(dayId, stopId, files) => void attachStopPhotos(dayId, stopId, files)} />
            </section>

            <details className="guide-editor__legacy">
              <summary>Guide text and content photos</summary>
              <div className="guide-editor__legacy-fields">
                <label className="guide-editor__field">
                  Guide text
                  <textarea name="body" rows={5} maxLength={12000} value={values.body}
                    onChange={(event) => setValues({ ...values, body: event.currentTarget.value })} />
                </label>
                <label className="guide-editor__field">
                  <span>Content photos <small>Up to {maxPhotos}</small></span>
                  <input type="file" accept={acceptedImages} multiple disabled={values.photos.length >= maxPhotos}
                    onChange={(event) => void choosePhotos(event.currentTarget, 'photos')} />
                </label>
                {values.photos.length > 0 && (
                  <ul className="guide-editor__photos" aria-label="Selected content photos">
                    {values.photos.map((source, index) => (
                      <li key={index} className="guide-editor__attachment">
                        <img src={source} alt={`Content photo ${index + 1}`} />
                        <button type="button" aria-label={`Remove content photo ${index + 1}`}
                          onClick={() => removePhoto(index)}>Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          </fieldset>
        </div>

        <footer className="guide-editor__actions">
          {pending && pending !== 'save' && <p className="guide-editor__message" role="status">Preparing photos…</p>}
          {error && <p className="guide-editor__message guide-editor__error" role="alert">{error}</p>}
          <div className="guide-editor__buttons">
            <button type="button" disabled={pending === 'save'} onClick={dismiss}>Cancel</button>
            {!isPublished && <button type="button" disabled={pending !== null} onClick={() => void submit('draft')}>Save draft</button>}
            <button type="submit" disabled={pending !== null}>
              {pending === 'save' ? 'Saving…' : isPublished ? 'Save changes' : 'Publish'}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  )
}
