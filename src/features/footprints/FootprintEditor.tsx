import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAnchoredDialog } from '../../components/useAnchoredDialog'
import { FootprintSelect } from './FootprintSelect'
import { provinces, themes, type Footprint, type PhotoDraft, type PhotoImage, type PhotoUpload, type Theme } from './footprintsData'
import './footprint-editor.css'

const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
const provinceOptions = provinces.map(province => ({ value: province, label: province }))

function DeleteConfirmation({ anchor, onDismiss, onConfirm }: {
  anchor: HTMLElement
  onDismiss: () => void
  onConfirm: () => void
}) {
  const { dialogRef, close, backdropProps } = useAnchoredDialog({
    anchor, onClose: onDismiss, initialFocus: '#fp-delete-cancel',
  })
  return <dialog ref={dialogRef} className="fp-delete-confirmation" aria-labelledby="fp-delete-title"
    aria-describedby="fp-delete-description" {...backdropProps} onCancel={event => {
      event.preventDefault()
      event.stopPropagation()
      close()
    }}>
    <h2 id="fp-delete-title">Delete this footprint?</h2>
    <p id="fp-delete-description">This photo and its details will be permanently deleted.</p>
    <div className="fp-delete-confirmation-actions">
      <button id="fp-delete-cancel" type="button" onClick={() => close()}>Cancel</button>
      <button type="button" onClick={() => close(onConfirm)}>Delete footprint</button>
    </div>
  </dialog>
}

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

export function FootprintEditor({ photo, anchor = null, onSave, onDismiss, onDelete }: {
  photo?: Footprint
  anchor?: HTMLElement | null
  onSave: (draft: PhotoDraft, upload?: PhotoUpload) => Promise<void | (() => void)>
  onDismiss: () => void
  onDelete?: () => Promise<void | (() => void)>
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
  const [progress, setProgress] = useState<{ confirmed: number; total: number }>()
  const [deleteAnchor, setDeleteAnchor] = useState<HTMLButtonElement | null>(null)
  const { dialogRef, close, backdropProps } = useAnchoredDialog({
    anchor, onClose: onDismiss, onBackdropClick: dismiss,
  })
  const fileInput = useRef<HTMLInputElement>(null)
  const provinceInput = useRef<HTMLButtonElement>(null)
  const dateInput = useRef<HTMLInputElement>(null)
  const lastFile = useRef(0)
  const savePending = useRef(false)
  const upload = useRef<PhotoUpload | undefined>(undefined)

  function resetUpload() {
    void upload.current?.cancel?.().catch(() => undefined)
    upload.current = undefined
    setProgress(undefined)
  }

  function dismiss() {
    if (savePending.current) return
    resetUpload()
    close()
  }

  async function deletePhoto() {
    if (savePending.current || !onDelete) return
    savePending.current = true
    setSaving(true)
    setSaveError('')
    try {
      const afterClose = await onDelete()
      close(afterClose || undefined)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not delete this footprint.')
      savePending.current = false
      setSaving(false)
    }
  }

  useEffect(() => {
    return () => {
      lastFile.current += 1
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
        resetUpload()
        setSaveError('')
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
      if (!photo) upload.current ??= { onProgress: (confirmed, total) => setProgress({ confirmed, total }) }
      const afterClose = await onSave({ image, province, city: city.trim(), date: photoDate, note, themes: labels }, upload.current)
      close(afterClose || undefined)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save this footprint. Please try again.')
      savePending.current = false
      setSaving(false)
    }
  }

  return (
    <dialog ref={dialogRef} className="fp-editor" aria-labelledby="fp-editor-title" {...backdropProps} onCancel={event => {
      event.preventDefault()
      if (!savePending.current) dismiss()
    }}>
      <header className="fp-editor-head">
        <div>
          <h2 id="fp-editor-title">{photo ? 'Edit footprint' : 'Add footprint'}</h2>
          <p>Photo and province are required.</p>
        </div>
        <button className="fp-close" type="button" onClick={dismiss} aria-label="Close editor" disabled={saving}>×</button>
      </header>
      <form className="fp-form" noValidate onSubmit={submit}>
        <div className="fp-editor-body" role="region" aria-label="Footprint details" tabIndex={0}>
          <fieldset className="fp-editor-fields" disabled={saving}>
            <div className="fp-editor-field">
              <label htmlFor="fp-image">Photo</label>
              <div className="fp-preview">
                {image ? <img src={image.thumbnailSrc} alt="Footprint photo preview" /> : <span>No photo selected</span>}
              </div>
              <div className="fp-file">
                <input id="fp-image" ref={fileInput} type="file" accept={imageTypes.join(',')} aria-required={!photo}
                  aria-invalid={!!imageError} aria-describedby={imageError ? 'fp-image-error' : image ? 'fp-file-name' : undefined}
                  onChange={event => void chooseImage(event.currentTarget.files?.[0])} />
                <span className="fp-file-action" aria-hidden="true">{image ? 'Replace photo' : 'Choose photo'}</span>
                {image && <span className="fp-file-name" id="fp-file-name" title={fileName || undefined}>{fileName || 'Current photo'}</span>}
              </div>
              {processing && <p className="fp-field-message" role="status">Preparing preview…</p>}
              {imageError && <div className="fp-field-message" role="alert" id="fp-image-error">
                {imageError} {photo && <button type="button" onClick={() => { setImage(photo.image); setFileName(''); setImageError('') }}>Keep original photo</button>}
              </div>}
            </div>

            <div className="fp-editor-field">
              <label htmlFor="fp-province">Province</label>
              <FootprintSelect id="fp-province" label="Province" triggerRef={provinceInput} value={province}
                options={provinceOptions} placeholder="Choose a province" disabled={saving} required
                invalid={provinceInvalid} describedBy={provinceInvalid ? 'fp-province-error' : undefined}
                onChange={value => { setProvince(value); setProvinceInvalid(false) }} />
              {provinceInvalid && <p className="fp-field-message" role="alert" id="fp-province-error">Choose a province to continue.</p>}
            </div>

            <div className="fp-form-row">
              <label className="fp-editor-field">
                City
                <input value={city} maxLength={120} onChange={event => setCity(event.target.value)} />
              </label>
              <label className="fp-editor-field">
                Photo date
                <input ref={dateInput} value={date} maxLength={10} placeholder="YYYY-MM-DD"
                  aria-invalid={dateInvalid} aria-describedby={dateInvalid ? 'fp-date-error' : undefined}
                  onChange={event => { setDate(event.target.value); setDateInvalid(false) }} />
              </label>
              {dateInvalid && <p className="fp-field-message" role="alert" id="fp-date-error">Enter a valid date in YYYY-MM-DD format.</p>}
            </div>

            <label className="fp-editor-field" htmlFor="fp-note">
              Note
              <textarea id="fp-note" value={note} maxLength={4000} rows={3} onChange={event => setNote(event.target.value)} />
            </label>

            <fieldset className="fp-theme-field">
              <legend>Theme</legend>
              <div className="fp-theme-options">
                {themes.map(theme => <label key={theme}>
                  <input type="checkbox" checked={labels.includes(theme)} onChange={event => setLabels(current =>
                    event.target.checked ? [...current, theme] : current.filter(label => label !== theme))} />
                  <span className="fp-theme-pill"><span aria-hidden="true">✓</span>{theme}</span>
                </label>)}
              </div>
              {!!photo?.suggestedThemes?.length && <p className="fp-field-message">
                Suggested: {photo.suggestedThemes.map(({ theme, confidence }) => `${theme} (${Math.round(confidence * 100)}%)`).join(', ')}
              </p>}
            </fieldset>
          </fieldset>
        </div>
        <footer className="fp-editor-footer">
          {progress && <div className="fp-upload-progress">
            <label htmlFor="fp-frame-progress">Photo frames</label>
            <progress id="fp-frame-progress" value={progress.confirmed} max={progress.total} />
            <span role="status">{progress.confirmed} / {progress.total} confirmed{saving && progress.confirmed === progress.total && ' · Verifying and saving…'}</span>
          </div>}
          {saveError && <p className="fp-field-message" role="alert">{saveError}</p>}
          <div className="fp-editor-actions">
            {onDelete && <button className="fp-delete" type="button"
              onClick={event => setDeleteAnchor(event.currentTarget)} disabled={saving}>Delete footprint</button>}
            <button type="button" onClick={dismiss} disabled={saving}>Cancel</button>
            <button type="submit" disabled={processing || saving}>{saving ? 'Saving…' : progress && saveError ? 'Retry upload' : 'Save footprint'}</button>
          </div>
        </footer>
      </form>
      {deleteAnchor && <DeleteConfirmation anchor={deleteAnchor} onDismiss={() => setDeleteAnchor(null)}
        onConfirm={() => void deletePhoto()} />}
    </dialog>
  )
}
