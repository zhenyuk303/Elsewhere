import { useEffect, useRef, useState, type FormEvent } from 'react'
import { provinces, themes, type Footprint, type PhotoDraft, type PhotoImage, type Theme } from './footprintsData'

const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']

export async function prepareImage(file: File): Promise<PhotoImage> {
  if (!imageTypes.includes(file.type)) throw new Error('Choose a JPEG, PNG, WebP, AVIF or GIF photo.')
  if (file.size > 20 * 1024 * 1024) throw new Error('Choose a photo smaller than 20 MB.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const scale = Math.min(1, 1120 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image preview is unavailable in this browser.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const src = canvas.toDataURL('image/webp', 0.8)
    return { src, thumbnailSrc: src }
  } catch {
    throw new Error('Could not open this photo. Try another image.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function FootprintEditor({ photo, onSave, onDismiss, onDelete }: {
  photo?: Footprint
  onSave: (draft: PhotoDraft) => Promise<void>
  onDismiss: () => void
  onDelete?: () => Promise<void>
}) {
  const [image, setImage] = useState(photo?.image)
  const [fileName, setFileName] = useState('')
  const [province, setProvince] = useState(photo?.province ?? '')
  const [city, setCity] = useState(photo?.city ?? '')
  const [date, setDate] = useState(photo?.date ?? '')
  const [note, setNote] = useState(photo?.note ?? '')
  const [labels, setLabels] = useState<Theme[]>(photo?.themes ?? [])
  const [imageError, setImageError] = useState('')
  const [provinceInvalid, setProvinceInvalid] = useState(false)
  const [dateInvalid, setDateInvalid] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [saving, setSaving] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const provinceInput = useRef<HTMLSelectElement>(null)
  const dateInput = useRef<HTMLInputElement>(null)
  const lastFile = useRef(0)
  const savePending = useRef(false)

  async function deletePhoto() {
    if (savePending.current || !onDelete || !window.confirm('Delete this footprint?')) return
    savePending.current = true
    setSaving(true)
    setSaveError('')
    try { await onDelete() }
    catch (error) { setSaveError(error instanceof Error ? error.message : 'Could not delete this footprint.') }
    finally { savePending.current = false; setSaving(false) }
  }

  useEffect(() => {
    const panel = dialog.current
    panel?.showModal()
    return () => {
      lastFile.current += 1
      panel?.close()
    }
  }, [])

  async function chooseImage(file?: File) {
    if (!file) return
    const revision = ++lastFile.current
    setProcessing(true)
    setImageError('')
    try {
      const preview = await prepareImage(file)
      if (revision === lastFile.current) {
        setImage(preview)
        setFileName(file.name)
      }
    } catch (error) {
      if (revision === lastFile.current) {
        setImageError((error as Error).message)
        if (fileInput.current) fileInput.current.value = ''
      }
    } finally {
      if (revision === lastFile.current) setProcessing(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (processing || savePending.current) return
    setSaveError('')
    if (!province) setProvinceInvalid(true)
    if (!image || imageError) {
      if (!imageError) setImageError('Choose a photo to continue.')
      fileInput.current?.focus()
      return
    }
    if (!province) {
      provinceInput.current?.focus()
      return
    }
    const photoDate = date.trim()
    if (photoDate) {
      const parsed = new Date(photoDate)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(photoDate) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== photoDate) {
        setDateInvalid(true)
        dateInput.current?.focus()
        return
      }
    }
    savePending.current = true
    setSaving(true)
    try {
      await onSave({ image, province, city: city.trim(), date: photoDate, note, themes: labels })
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save this footprint. Please try again.')
    } finally {
      savePending.current = false
      setSaving(false)
    }
  }

  return (
    <dialog ref={dialog} className="fp-editor" aria-labelledby="fp-editor-title" onCancel={event => {
      event.preventDefault()
      if (!savePending.current) onDismiss()
    }}>
      <div className="fp-editor-head">
        <p className="fp-kicker"><span aria-hidden="true" />Personal photo journal</p>
        <button className="fp-close" type="button" onClick={onDismiss} aria-label="Close editor" disabled={saving}>×</button>
        <h2 id="fp-editor-title">{photo ? 'Edit footprint' : 'Add footprint'}</h2>
        <p>Photo and province are required. Other details can wait.</p>
      </div>
      <form className="fp-form" noValidate onSubmit={submit}>
        <fieldset disabled={saving}>
          <div className="fp-preview">
            {image ? <img src={image.thumbnailSrc} alt="Footprint photo preview" /> : <span>No photo selected</span>}
          </div>
          <label htmlFor="fp-image">Photo</label>
          <div className="fp-file">
            <input id="fp-image" ref={fileInput} type="file" accept={imageTypes.join(',')} aria-required={!photo}
              aria-invalid={!!imageError} aria-describedby={imageError ? 'fp-image-error' : 'fp-file-name'}
              onChange={event => void chooseImage(event.currentTarget.files?.[0])} />
            <span aria-hidden="true">{image ? 'Replace photo' : 'Choose photo'}</span>
            <span id="fp-file-name">{fileName || (image ? 'Current photo' : 'No file selected')}</span>
          </div>
          {processing && <p className="fp-field-message" role="status">Preparing preview…</p>}
          {imageError && <div className="fp-field-message" role="alert" id="fp-image-error">
            {imageError} {photo && <button type="button" onClick={() => { setImage(photo.image); setFileName(''); setImageError('') }}>Keep original photo</button>}
          </div>}

          <label htmlFor="fp-province">Province</label>
          <select id="fp-province" ref={provinceInput} required value={province} aria-invalid={provinceInvalid}
            aria-describedby={provinceInvalid ? 'fp-province-error' : undefined}
            onChange={event => { setProvince(event.target.value); setProvinceInvalid(false) }}>
            <option value="">Choose a province</option>
            {provinces.map(item => <option key={item}>{item}</option>)}
          </select>
          {provinceInvalid && <p className="fp-field-message" role="alert" id="fp-province-error">Choose a province to continue.</p>}

          <div className="fp-form-row">
            <label>City<input value={city} maxLength={120} onChange={event => setCity(event.target.value)} /></label>
            <label>Photo date<input ref={dateInput} value={date} maxLength={10} placeholder="YYYY-MM-DD"
              aria-invalid={dateInvalid} aria-describedby={dateInvalid ? 'fp-date-error' : undefined}
              onChange={event => { setDate(event.target.value); setDateInvalid(false) }} /></label>
          </div>
          {dateInvalid && <p className="fp-field-message" role="alert" id="fp-date-error">Enter a valid date in YYYY-MM-DD format.</p>}
          <label htmlFor="fp-note">Note</label>
          <textarea id="fp-note" value={note} maxLength={4000} rows={4} onChange={event => setNote(event.target.value)} />

          <fieldset className="fp-theme-field">
            <legend>Theme</legend>
            <p>Choose any labels that fit this photo.</p>
            <div className="fp-theme-options">
              {themes.map(theme => <label key={theme}>
                <input type="checkbox" checked={labels.includes(theme)} onChange={event => setLabels(current =>
                  event.target.checked ? [...current, theme] : current.filter(label => label !== theme))} />
                {theme}
              </label>)}
            </div>
            {!!photo?.suggestedThemes?.length && <p>
              Suggested: {photo.suggestedThemes.map(({ theme, confidence }) => `${theme} (${Math.round(confidence * 100)}%)`).join(', ')}
            </p>}
          </fieldset>
        </fieldset>
        {saveError && <p className="fp-field-message" role="alert">{saveError}</p>}
        <div className="fp-editor-actions">
          {onDelete && <button type="button" onClick={() => void deletePhoto()} disabled={saving}>Delete footprint</button>}
          <button type="button" onClick={onDismiss} disabled={saving}>Cancel</button>
          <button type="submit" disabled={processing || saving}>{saving ? 'Saving…' : 'Save footprint'}</button>
        </div>
      </form>
    </dialog>
  )
}
