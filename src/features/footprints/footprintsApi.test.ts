/// <reference types="node" />
import { afterEach, expect, it, vi } from 'vitest'
import { Blob as NodeBlob } from 'node:buffer'
import { createHash, webcrypto } from 'node:crypto'
import { serverFootprints } from './footprintsApi'

const draft = {
  image: { src: '/images/carousel/%E5%AE%89%E5%BE%BD.webp', thumbnailSrc: '/small.webp' },
  province: 'Anhui', city: 'Hefei', date: '', note: '', themes: [] as [],
}

afterEach(() => { vi.unstubAllGlobals(); window.localStorage.clear() })

it('uses authenticated API requests and encodes seed identifiers', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...draft, id: 'id', ownerId: 1 }) })
  vi.stubGlobal('fetch', fetch)
  await serverFootprints.save(1, draft, 'seed:1:Inner Mongolia')
  expect(fetch).toHaveBeenCalledWith('/api/footprints/seed%3A1%3AInner%20Mongolia', expect.objectContaining({
    method: 'PUT', credentials: 'same-origin', body: JSON.stringify(draft),
    headers: { 'X-Elsewhere-Request': '1', 'Content-Type': 'application/json' },
  }))
})

it('imports only the current account browser records before listing', async () => {
  window.localStorage.setItem('elsewhere:footprints:v1:1', JSON.stringify([
    { ...draft, id: 'old', ownerId: 1 }, { ...draft, id: 'other', ownerId: 2 },
  ]))
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
  vi.stubGlobal('fetch', fetch)
  await serverFootprints.list(1)
  expect(fetch.mock.calls[0][0]).toBe('/api/footprints/import')
  expect(JSON.parse(fetch.mock.calls[0][1].body).records).toHaveLength(1)
  expect(fetch.mock.calls[1][0]).toBe('/api/footprints')
})

it('surfaces backend validation and expired-session errors', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ message: 'Enter a valid photo date' }) }))
  await expect(serverFootprints.save(1, draft)).rejects.toThrow('Enter a valid photo date')
})

const uploadDraft = { ...draft, image: { src: 'data:image/png;base64,AQID', thumbnailSrc: '' } }
const endpoint = '/api/footprints/uploads'
const session = (received: number[]) => ({ uploadId: 'upload-id', frameSize: 2, frameCount: 2, received, completed: false })
const ok = <T,>(data: T) => ({ ok: true, json: async () => data })

function useBinaryUploads() {
  vi.stubGlobal('crypto', webcrypto)
  vi.stubGlobal('Blob', NodeBlob)
}

it('sends binary frames in order and continues when a stored frame lost its acknowledgement', async () => {
  useBinaryUploads()
  const fetch = vi.fn()
    .mockResolvedValueOnce(ok(session([])))
    .mockRejectedValueOnce(new Error('Connection lost after storing the first frame'))
    .mockResolvedValueOnce(ok(session([0])))
    .mockResolvedValueOnce(ok({ frameIndex: 1 }))
    .mockResolvedValueOnce(ok({ id: 'created' }))
  vi.stubGlobal('fetch', fetch)
  const progress = vi.fn()
  await expect(serverFootprints.save(1, uploadDraft, undefined, { onProgress: progress })).resolves.toEqual({ id: 'created' })
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    endpoint, `${endpoint}/upload-id/frames/0`, `${endpoint}/upload-id`, `${endpoint}/upload-id/frames/1`, '/api/footprints',
  ])
  const first = fetch.mock.calls[1][1]
  expect(first.method).toBe('PUT')
  expect(first.headers).toEqual({
    'Content-Type': 'application/octet-stream', 'X-Elsewhere-Request': '1', 'X-Frame-Offset': '0',
    'X-Frame-Length': '2', 'X-Upload-Size': '3',
    'X-Frame-SHA256': createHash('sha256').update(Buffer.from([1, 2])).digest('hex'),
  })
  expect(Array.from(new Uint8Array(await first.body.arrayBuffer()))).toEqual([1, 2])
  expect(fetch.mock.calls[3][1].headers['X-Frame-Offset']).toBe('2')
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
    totalSize: 3, type: 'image/png', sha256: createHash('sha256').update(Buffer.from([1, 2, 3])).digest('hex'),
  })
  expect(JSON.parse(fetch.mock.calls[4][1].body)).toEqual({
    uploadId: 'upload-id', province: 'Anhui', city: 'Hefei', date: '', note: '', themes: [],
  })
  expect(progress.mock.calls).toEqual([[0, 2], [1, 2], [2, 2]])
})

it('stops retrying when offline and resumes only the missing frame on the next save', async () => {
  useBinaryUploads()
  const fetch = vi.fn().mockResolvedValueOnce(ok(session([]))).mockResolvedValueOnce(ok({ frameIndex: 0 }))
    .mockRejectedValue(new Error('Offline'))
  vi.stubGlobal('fetch', fetch)
  const upload = { onProgress: vi.fn() }
  await expect(serverFootprints.save(1, uploadDraft, undefined, upload)).rejects.toThrow('Could not reach the server')
  const attempts = fetch.mock.calls.filter(([url]) => url === `${endpoint}/upload-id/frames/1`)
  expect(attempts).toHaveLength(3)

  fetch.mockReset()
    .mockResolvedValueOnce(ok(session([0])))
    .mockResolvedValueOnce(ok({ frameIndex: 1 }))
    .mockResolvedValueOnce(ok({ id: 'created' }))
  await expect(serverFootprints.save(1, uploadDraft, undefined, upload)).resolves.toEqual({ id: 'created' })
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([`${endpoint}/upload-id`, `${endpoint}/upload-id/frames/1`, '/api/footprints'])
})
