import { travelSlides } from '../carousel/carouselData'
import { createDemoRepository, filterPhotos, type PhotoDraft } from './footprintsData'

const picture = { src: '/example.webp', thumbnailSrc: '/small.webp' }
const draft: PhotoDraft = { image: picture, province: 'Anhui', city: '', date: '', note: '', themes: ['COAST'] }

it('seeds one owned record per existing province and preserves the carousel pairing', async () => {
  const storage = window.sessionStorage
  storage.clear()
  const repo = createDemoRepository(storage)
  const photos = await repo.list(100)
  expect(photos).toHaveLength(34)
  expect(new Set(photos.map(photo => photo.province)).size).toBe(34)
  expect(photos.map(photo => [photo.province, photo.image.src])).toEqual(travelSlides.map(slide => [slide.location, slide.src]))
  expect(photos.every(photo => photo.ownerId === 100 && !photo.city && !photo.note && !photo.date && !photo.themes.length)).toBe(true)
  expect(await repo.list(100)).toEqual(photos)
})

it('keeps browser edits with their account and rejects another owner’s photo', async () => {
  const storage = window.sessionStorage
  storage.clear()
  const repo = createDemoRepository(storage)
  const original = (await repo.list(100))[0]
  await repo.save(100, { ...draft, city: 'Local edit' }, original.id)
  const added = await repo.save(100, draft)
  expect(await createDemoRepository(storage).list(100)).toHaveLength(35)
  expect((await repo.list(100)).find(photo => photo.id === original.id)?.city).toBe('Local edit')
  expect((await repo.list(200)).some(photo => photo.id === added.id || photo.city === 'Local edit')).toBe(false)
  await expect(repo.save(200, draft, original.id)).rejects.toThrow()
})

it('uses the local folder for its authorized account and preserves existing seed edits', async () => {
  const storage = window.sessionStorage
  storage.clear()
  const bundled = createDemoRepository(storage)
  const seeds = await bundled.list(100)
  const anhui = seeds.find(photo => photo.province === 'Anhui')!
  const beijing = seeds.find(photo => photo.province === 'Beijing')!
  const otherAccountSeeds = await bundled.list(200)
  const edit: PhotoDraft = {
    ...draft, image: anhui.image, city: 'Hefei', date: '2025-05-01', note: 'Spring visit',
  }
  await bundled.save(100, edit, anhui.id)
  await bundled.save(100, { ...draft, province: 'Beijing', image: picture }, beijing.id)

  const repo = createDemoRepository(storage, async (ownerId: number) =>
    ownerId === 100 ? ['安徽.jpg', '北京.jpg'] : undefined,
  )
  const localPhotos = await repo.list(100)
  const localImage = `/api/local-footprints/${encodeURIComponent('安徽.jpg')}`

  expect(localPhotos.find(photo => photo.id === anhui.id)).toMatchObject({
    ...edit, id: anhui.id, ownerId: 100, image: { src: localImage, thumbnailSrc: `${localImage}?thumb` },
  })
  expect(localPhotos.find(photo => photo.id === beijing.id)?.image).toEqual(picture)
  expect(await repo.list(200)).toEqual(otherAccountSeeds)

  const localAnhui = localPhotos.find(photo => photo.id === anhui.id)!
  await repo.save(100, localAnhui, anhui.id)
  const withoutAnhui = createDemoRepository(storage, async () => ['北京.jpg'])
  expect((await withoutAnhui.list(100)).some(photo => photo.id === anhui.id)).toBe(false)
  expect((await bundled.list(100)).find(photo => photo.id === anhui.id)).toMatchObject(edit)
})

it('matches both filters and returns each matching record once', async () => {
  window.sessionStorage.clear()
  const repo = createDemoRepository(window.sessionStorage)
  const coast = await repo.save(100, draft)
  const otherCoast = await repo.save(100, draft)
  await repo.save(100, { ...draft, province: 'Hainan' })
  const photos = await repo.list(100)
  expect(filterPhotos(photos, { province: 'Anhui', theme: 'COAST' }).map(photo => photo.id)).toEqual([coast.id, otherCoast.id])
  expect(filterPhotos(photos, { province: 'Anhui', theme: 'CITY' })).toEqual([])
})
