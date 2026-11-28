import { afterEach, expect, it, vi } from 'vitest'
import { serverFootprints } from './footprintsApi'

const draft = {
  image: { src: '/images/carousel/%E5%AE%89%E5%BE%BD.webp', thumbnailSrc: '/small.webp' },
  province: 'Anhui', city: 'Hefei', date: '', note: '', themes: [] as [],
}

afterEach(() => { vi.unstubAllGlobals(); window.localStorage.clear() })

it('I01 creates a footprint through POST and propagates a 400 error', async () => {
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1sAAAAASUVORK5CYII='
  const input = { ...draft, note: '\u6625\u6e38', image: { src: image, thumbnailSrc: image } }
  const fetch = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...input, id: 'qa-created', ownerId: 1 }), { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Invalid footprint' }), { status: 400 }))
  vi.stubGlobal('fetch', fetch)
  await expect(serverFootprints.save(1, input)).resolves.toMatchObject({ id: 'qa-created' })
  await expect(serverFootprints.save(1, input)).rejects.toThrow('Invalid footprint')
  expect(fetch).toHaveBeenCalledTimes(2)
  for (const [url, init] of fetch.mock.calls) {
    expect(url).toBe('/api/footprints')
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin' })
    expect(JSON.parse(init.body)).toMatchObject(input)
  }
})

it('uses authenticated API requests and encodes seed identifiers', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...draft, id: 'id', ownerId: 1 }) })
  vi.stubGlobal('fetch', fetch)
  await serverFootprints.save(1, draft, 'seed:1:Inner Mongolia')
  expect(fetch).toHaveBeenCalledWith('/api/footprints/seed%3A1%3AInner%20Mongolia', expect.objectContaining({
    method: 'PUT', credentials: 'same-origin', body: JSON.stringify(draft),
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
