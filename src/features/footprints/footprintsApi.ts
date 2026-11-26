import { prepareImage } from './FootprintEditor'
import type { Footprint, FootprintsRepository, PhotoDraft, PhotoUpload } from './footprintsData'

class FootprintRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

async function request<T>(path = '', method = 'GET', body?: unknown, frameHeaders?: Record<string, string>, upload = false): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api/footprints${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        ...(method === 'GET' ? {} : { 'X-Elsewhere-Request': '1' }),
        ...(body === undefined ? {} : { 'Content-Type': frameHeaders ? 'application/octet-stream' : 'application/json' }),
        ...frameHeaders,
      },
      body: frameHeaders ? body as Blob : body === undefined ? undefined : JSON.stringify(body),
      ...(upload ? { signal: AbortSignal.timeout(15_000) } : {}),
    })
  } catch {
    throw new FootprintRequestError('Could not reach the server. Please try again.', 0)
  }
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { message?: string } | null
    throw new FootprintRequestError(error?.message ?? (response.status === 401 ? 'Please sign in again.' : 'Could not save your footprints.'), response.status)
  }
  if (response.status === 204) return undefined as T
  try { return await response.json() as T }
  catch { throw new FootprintRequestError('Could not read the server confirmation. Please try again.', 0) }
}

type UploadStatus = { uploadId: string; frameSize: number; frameCount: number; received: number[]; completed: boolean }

function uploadRequest<T>(path: string, method = 'GET', body?: unknown, headers?: Record<string, string>) {
  return request<T>(path, method, body, headers, true)
}

async function sha256(data: Blob) {
  const hash = await crypto.subtle.digest('SHA-256', await data.arrayBuffer())
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
}

function retryable(error: unknown) {
  return error instanceof FootprintRequestError && (error.status === 0 || error.status >= 500)
}

async function saveFramed(draft: PhotoDraft, upload: PhotoUpload) {
  if (!globalThis.crypto?.subtle) throw new Error('Photo upload requires HTTPS or localhost.')
  const { image, ...metadata } = draft
  const [info, encoded] = image.src.split(',', 2)
  const mime = /^data:(image\/[\w+-]+);base64$/.exec(info)?.[1]
  if (!mime || !encoded) throw new Error('Choose a photo to upload.')
  const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0))
  const photo = new Blob([bytes], { type: mime })
  if (!photo.size || photo.size > 4 * 1024 * 1024) throw new Error('Prepared photo must be at most 4 MB.')

  let status: UploadStatus | undefined
  if (upload.sessionId) {
    try { status = await uploadRequest<UploadStatus>(`/uploads/${upload.sessionId}`) }
    catch (error) {
      if (!(error instanceof FootprintRequestError && (error.status === 404 || error.status === 410))) throw error
    }
  }
  if (!status) {
    status = await uploadRequest<UploadStatus>('/uploads', 'POST', { totalSize: photo.size, type: photo.type, sha256: await sha256(photo) })
    upload.sessionId = status.uploadId
    const id = status.uploadId
    upload.cancel = () => uploadRequest(`/uploads/${id}`, 'DELETE')
  }

  const { uploadId, frameSize, frameCount } = status
  const path = `/uploads/${uploadId}`
  const confirmed = new Set(status.received)
  upload.onProgress(status.completed ? frameCount : confirmed.size, frameCount)
  if (!status.completed) {
    for (let index = 0; index < frameCount; index++) {
      if (confirmed.has(index)) continue
      const offset = index * frameSize
      const frame = photo.slice(offset, offset + frameSize)
      const headers = {
        'X-Frame-Offset': String(offset),
        'X-Frame-Length': String(frame.size),
        'X-Upload-Size': String(photo.size),
        'X-Frame-SHA256': await sha256(frame),
      }
      for (let attempt = 0; ; attempt++) {
        try {
          const ack = await uploadRequest<{ frameIndex: number }>(`${path}/frames/${index}`, 'PUT', frame, headers)
          if (ack.frameIndex !== index) throw new FootprintRequestError('Unexpected photo frame confirmation.', 0)
          confirmed.add(index)
          break
        } catch (error) {
          if (!retryable(error) || attempt === 2) throw error
          const resume = await uploadRequest<UploadStatus>(path).catch(statusError => {
            if (!retryable(statusError)) throw statusError
          })
          if (resume?.completed) {
            upload.onProgress(frameCount, frameCount)
            return uploadRequest<Footprint>('', 'POST', { ...metadata, uploadId })
          }
          resume?.received.forEach(received => confirmed.add(received))
          if (confirmed.has(index)) break
        }
      }
      upload.onProgress(confirmed.size, frameCount)
    }
  }
  return uploadRequest<Footprint>('', 'POST', { ...metadata, uploadId })
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
  async save(_ownerId, draft, id, upload) {
    if (!id && upload) return saveFramed(draft, upload)
    return request<Footprint>(id ? `/${encodeURIComponent(id)}` : '', id ? 'PUT' : 'POST', draft)
  },
  async remove(_ownerId, id) {
    await request(`/${encodeURIComponent(id)}`, 'DELETE')
  },
}
