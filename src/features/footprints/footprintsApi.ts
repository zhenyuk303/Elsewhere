import { prepareImage } from './FootprintEditor'
import type { Footprint, FootprintsRepository } from './footprintsData'

async function request<T>(path = '', method = 'GET', body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api/footprints${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        ...(method === 'GET' ? {} : { 'X-Elsewhere-Request': '1' }),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error('Could not reach the server. Please try again.')
  }
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(error?.message ?? (response.status === 401 ? 'Please sign in again.' : 'Could not save your footprints.'))
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

async function migrateBrowserPhotos(ownerId: number) {
  const raw = window.localStorage.getItem(`elsewhere:footprints:v1:${ownerId}`)
  if (!raw) return
  const records = JSON.parse(raw) as Footprint[]
  if (!Array.isArray(records)) throw new Error('The browser photo library could not be imported.')
  const owned = records.filter(record => record?.ownerId === ownerId)
  if (!owned.length) return
  const migrated: Footprint[] = []
  for (const photo of owned) {
    if (photo.image.src.startsWith('/api/local-footprints/')) {
      const imageResponse = await fetch(photo.image.src, { credentials: 'same-origin' })
      if (!imageResponse.ok) throw new Error('Connect your original local photo folder to import these photos.')
      const blob = await imageResponse.blob()
      const image = await prepareImage(new File([blob], 'import.jpg', { type: blob.type }))
      migrated.push({ ...photo, image })
    } else {
      migrated.push(photo)
    }
  }
  await request('/import', 'POST', { records: migrated })
  // The server records each source ID transactionally, so retries cannot duplicate an import.
}

export const serverFootprints: FootprintsRepository = {
  async list(ownerId) {
    await migrateBrowserPhotos(ownerId)
    return request<Footprint[]>()
  },
  async save(_ownerId, draft, id) {
    return request<Footprint>(id ? `/${encodeURIComponent(id)}` : '', id ? 'PUT' : 'POST', draft)
  },
  async remove(_ownerId, id) {
    await request(`/${encodeURIComponent(id)}`, 'DELETE')
  },
}
