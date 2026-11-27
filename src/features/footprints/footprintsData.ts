import { travelSlides } from '../carousel/carouselData'

export const themes = ['COAST', 'MOUNTAINS', 'CITY', 'COUNTRYSIDE', 'CULTURE', 'FOOD', 'WILDLIFE'] as const
export type Theme = typeof themes[number]
export const provinces = travelSlides.map(slide => slide.location).sort()

export type PhotoImage = { src: string; thumbnailSrc: string }
export type PhotoDraft = {
  image: PhotoImage
  province: string
  city: string
  date: string
  note: string
  themes: Theme[]
}
export type Footprint = PhotoDraft & {
  id: string
  ownerId: number
  suggestedThemes?: { theme: Theme; confidence: number }[]
}
export type PhotoUpload = {
  sessionId?: string
  cancel?: () => Promise<void>
  onProgress: (confirmed: number, total: number) => void
}
export type FootprintsRepository = {
  list(ownerId: number): Promise<Footprint[]>
  save(ownerId: number, draft: PhotoDraft, id?: string, upload?: PhotoUpload): Promise<Footprint>
  remove?(ownerId: number, id: string): Promise<void>
}

const localPhotoEndpoint = '/api/local-footprints'
type LocalPhotoLoader = (ownerId: number) => Promise<string[] | undefined>

async function fetchLocalPhotoFiles(ownerId: number): Promise<string[] | undefined> {
  if (!import.meta.env.DEV || import.meta.env.MODE === 'test') return
  try {
    const response = await fetch(localPhotoEndpoint)
    if (!response.ok) return
    const library: { ownerId: number; files: string[] } = await response.json()
    if (library.ownerId === ownerId && Array.isArray(library.files)) return library.files
  } catch {
    // The bundled library is also available without a local photo service.
  }
}

function seeds(ownerId: number): Footprint[] {
  return travelSlides.map(slide => ({
    id: `seed:${ownerId}:${slide.location}`,
    ownerId,
    image: {
      src: slide.src,
      thumbnailSrc: `${import.meta.env.BASE_URL}images/footprint-thumbs/${slide.src.split('/').at(-1)}`,
    },
    province: slide.location,
    city: '', date: '', note: '', themes: [],
  }))
}

// Only overrides and additions are written. Bundled seeds never consume browser storage.
export function createDemoRepository(storage?: Storage, loadLocalFiles?: LocalPhotoLoader): FootprintsRepository {
  const store = () => storage ?? window.localStorage
  const key = (ownerId: number) => `elsewhere:footprints:v1:${ownerId}`
  function read(ownerId: number): Footprint[] {
    const raw = store().getItem(key(ownerId))
    if (!raw) return []
    const records = JSON.parse(raw) as Footprint[]
    if (!Array.isArray(records)) throw new Error('The local photo library could not be read.')
    return records.filter(record => record?.ownerId === ownerId)
  }

  function merge(ownerId: number, overrides: Footprint[], localFiles?: string[]) {
    const bundled = new Map(seeds(ownerId).map(photo => [photo.id, photo]))
    const photos = new Map(bundled)
    if (localFiles) {
      const files = new Set(localFiles)
      photos.clear()
      for (const photo of bundled.values()) {
        const file = decodeURIComponent(photo.image.src.split('/').at(-1)!).replace(/\.webp$/, '.jpg')
        if (!files.has(file)) continue
        const src = `${localPhotoEndpoint}/${encodeURIComponent(file)}`
        photos.set(photo.id, { ...photo, image: { src, thumbnailSrc: `${src}?thumb` } })
      }
    }
    for (const photo of overrides) {
      const original = bundled.get(photo.id)
      const usesBundledImage = !!localFiles && original?.image.src === photo.image.src
      const usesLocalImage = !!original && photo.image.src.startsWith(`${localPhotoEndpoint}/`)
      if (usesBundledImage || usesLocalImage) {
        const seed = photos.get(photo.id)
        if (seed) photos.set(photo.id, { ...photo, image: seed.image })
      } else {
        photos.set(photo.id, photo)
      }
    }
    return [...photos.values()]
  }

  return {
    async list(ownerId) { return merge(ownerId, read(ownerId), await loadLocalFiles?.(ownerId)) },
    async save(ownerId, draft, id) {
      const overrides = read(ownerId)
      const previous = id ? merge(ownerId, overrides).find(photo => photo.id === id) : undefined
      if (id && previous?.ownerId !== ownerId) throw new Error('You can only edit photos you own.')
      if (!draft.image.src || !provinces.includes(draft.province)) throw new Error('Choose a photo and a province.')
      const record = {
        ...previous, ...draft,
        id: previous?.id ?? Array.from(crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16).padStart(8, '0')).join(''),
        ownerId,
      }
      try {
        store().setItem(key(ownerId), JSON.stringify([...overrides.filter(photo => photo.id !== record.id), record]))
      } catch {
        throw new Error('Could not save to this browser. Storage may be full or unavailable.')
      }
      return record
    },
  }
}

export const demoFootprints = createDemoRepository(undefined, fetchLocalPhotoFiles)
export type Filters = { province: string; theme: string }
export const allFilters: Filters = { province: '', theme: '' }

export function filterPhotos(photos: Footprint[], { province, theme }: Filters) {
  return photos.filter(photo => (!province || photo.province === province) &&
    (!theme || photo.themes.some(label => label === theme)))
}

export function shufflePhotoIds(photos: Footprint[]) {
  const shuffled = [...photos]
  for (let i = 0; i < shuffled.length; i++) {
    const j = i + Math.floor(Math.random() * (shuffled.length - i))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.map(photo => photo.id)
}
