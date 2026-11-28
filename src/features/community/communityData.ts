import { travelSlides } from '../carousel/carouselData'
import { serverFootprints } from '../footprints/footprintsApi'
import type { Footprint } from '../footprints/footprintsData'
import { guideCover, guideRepository, type Guide } from '../guides/guidesData'

export type CommunityPhoto = { src: string; alt: string; thumbnailSrc?: string }

export type CommunityAttachment = {
  id: string
  kind: 'guide' | 'footprint'
  title: string
  body: string
  city: string
  province: string
  photos: CommunityPhoto[]
}

export type CommunityDraftFields = {
  title: string
  body: string
  city: string
  province: string
  photos: CommunityPhoto[]
  attachment?: CommunityAttachment
}

export type CommunityDraft = CommunityDraftFields & { id: string; updatedAt: string }
export type CommunityPost = CommunityDraftFields & {
  id: string
  ownerId: number | null
  author: string
  publishedAt: string
  likeCount: number
}

export type CommunityLibrary = {
  posts: CommunityPost[]
  drafts: CommunityDraft[]
  likedIds: string[]
}

const provinceImages = new Map(travelSlides.map(slide => [slide.location, slide.src]))
const slideImages = new Set(provinceImages.values())

function withThumbnail(src: string, alt: string): CommunityPhoto {
  if (slideImages.has(src)) {
    const filename = src.split('/').at(-1)
    return { src, alt, thumbnailSrc: `${import.meta.env.BASE_URL}images/footprint-thumbs/${filename}` }
  }
  return { src, alt }
}

type SampleDetails = Omit<CommunityPost, 'ownerId' | 'photos' | 'publishedAt'> & { date: string; alt: string }

function sample({ date, alt, ...details }: SampleDetails): CommunityPost {
  const src = provinceImages.get(details.province)
  return {
    ...details,
    id: `community-sample-${details.id}`,
    ownerId: null,
    publishedAt: `${date}T12:00:00Z`,
    photos: src ? [withThumbnail(src, alt)] : [],
  }
}

export const sampleCommunityPosts: CommunityPost[] = [
  sample({
    id: 'river-blue', author: 'Lin Yu', title: 'At the bend in Guilin',
    city: 'Guilin', province: 'Guangxi', date: '2025-11-18', likeCount: 84,
    alt: 'The limestone arch of Elephant Trunk Hill rising from a river in Guilin',
    body: 'From across the river, the gap in the limestone looked like an opening cut for the water. Trees grew right to the edge of the rock. I stayed by the bank long enough to watch the boats pass and leave the surface still again.',
  }),
  sample({
    id: 'temple-roofs', author: 'Ming Chen', title: 'The blue roofs of Beijing',
    city: 'Beijing', province: 'Beijing', date: '2025-11-16', likeCount: 63,
    alt: 'The round blue roof of the Hall of Prayer for Good Harvests above a stone stairway',
    body: 'From the foot of the stairs, the blue eaves at the Temple of Heaven almost touched the clouds. I kept looking back as I climbed. The spacing of the railings and the rhythm of the steps change the picture a little each time.',
  }),
  sample({
    id: 'crescent-lake', author: 'Tao Jiang', title: 'An oasis in the dunes',
    city: 'Dunhuang', province: 'Gansu', date: '2025-11-15', likeCount: 108,
    alt: 'The green oasis and crescent-shaped lake surrounded by dunes',
    body: 'The curve of Crescent Lake is easy to miss from close by. A little distance brings the whole outline into view, with the line of trees separating water and sand. The dunes behind it looked almost smooth until the shadows revealed their ridges.',
  }),
  sample({
    id: 'harbour-clouds', author: 'Ari Leung', title: 'A break in the clouds',
    city: 'Hong Kong', province: 'Hong Kong', date: '2025-11-11', likeCount: 49,
    alt: 'Clouds over Hong Kong’s towers with the harbour visible beyond them',
    body: 'The harbour appeared in the narrow gaps between towers. Clouds moved in the opposite direction to the boats below, and the glass picked up their reflections for only a few seconds at a time.',
  }),
  sample({
    id: 'tulou', author: 'Jia Xu', title: 'Courtyards in the mist',
    city: 'Longyan', province: 'Fujian', date: '2025-11-09', likeCount: 76,
    alt: 'Circular earthen buildings on a wooded hillside surrounded by morning mist',
    body: 'Seen from the hillside, the round rooflines were the first things to appear through the mist. A few minutes later the trees and narrow paths emerged around them. It made the landscape feel as if someone had drawn it in layers.',
  }),
  sample({
    id: 'west-lake', author: 'Mei Luo', title: 'Last light at West Lake',
    city: 'Hangzhou', province: 'Zhejiang', date: '2025-11-06', likeCount: 93,
    alt: 'A pagoda and wooded shoreline beside West Lake at sunset',
    body: 'The glow held at the far edge of the lake long after the trees had darkened. From this angle, the pagoda was a small point of stillness between the sky and the water.',
  }),
  sample({
    id: 'last-ridge', author: 'Lan Wen', title: 'The colour of the last ridge',
    city: 'Kangding', province: 'Sichuan', date: '2025-11-03', likeCount: 67,
    alt: 'Amber sunlight on snowy mountain summits above a shadowed blue valley',
    body: 'The valley had already cooled to a deep blue when the highest ridge caught the light. The shade moved so slowly at first that I almost missed it. Then there was only one bright peak left.',
  }),
  sample({
    id: 'chongqing-evening', author: 'Ning Qiao', title: 'Chongqing after six',
    city: 'Chongqing', province: 'Chongqing', date: '2025-10-30', likeCount: 55,
    alt: 'Chongqing skyline and an illuminated bridge beneath a warm evening sky',
    body: 'The bridge lights came on while the last patch of daylight was still visible above the buildings. The river gathered both colours and stretched them into softer, longer lines.',
  }),
  sample({
    id: 'harbin-square', author: 'Yun He', title: 'A square under blue light',
    city: 'Harbin', province: 'Heilongjiang', date: '2025-10-27', likeCount: 37,
    alt: 'Saint Sophia Cathedral and its red-brick facade under a blue evening sky',
    body: 'In the square around Saint Sophia, the warm brick held its colour as the sky turned blue. Crossing the square, I could see the domes appear and disappear behind the smaller buildings.',
  }),
  sample({
    id: 'yellow-crane', author: 'Fei Zhao', title: 'Above the rooftops in Wuhan',
    city: 'Wuhan', province: 'Hubei', date: '2025-10-23', likeCount: 52,
    alt: 'The Yellow Crane Tower above green trees and the city of Wuhan',
    body: 'The climb to the tower changes the horizon a little at every turn. Some of the best views are from the path below, where a line of trees crosses the roofs of the city.',
  }),
  sample({
    id: 'canton-skyline', author: 'Xiao Wu', title: 'Guangzhou in the afternoon',
    city: 'Guangzhou', province: 'Guangdong', date: '2025-10-19', likeCount: 44,
    alt: 'Canton Tower and the dense Guangzhou skyline in clear afternoon light',
    body: 'The Canton Tower is easy to find at almost any distance. I liked following the shapes around it, where narrow streets between buildings opened out toward the river.',
  }),
  sample({
    id: 'river-pavilion', author: 'Jian Lin', title: 'The pavilion across the river',
    city: 'Nanchang', province: 'Jiangxi', date: '2025-10-14', likeCount: 61,
    alt: 'A warmly lit pavilion reflected in a dark river',
    body: 'Across the river, the pavilions gave the dark bank its shape. Small ripples pulled the reflections apart and brought them back together. I stayed until there was almost no colour left in the water besides the gold light.',
  }),
]

type StoredDraft = { ownerId: number; id: string; draft: CommunityDraft }
type StoredPost = { ownerId: number; id: string; post: CommunityPost }
type StoredEntry = StoredDraft | StoredPost
type StoredLike = { ownerId: number; id: string }

const entryStore = 'entries'
const likeStore = 'likes'
const ownerIndex = 'ownerId'

function openCommunityDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('Community storage is unavailable in this browser.'))
      return
    }

    const request = indexedDB.open('elsewhere-community', 1)
    request.onupgradeneeded = () => {
      for (const name of [entryStore, likeStore]) {
        const store = request.result.createObjectStore(name, { keyPath: ['ownerId', 'id'] })
        store.createIndex(ownerIndex, 'ownerId')
      }
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      resolve(database)
    }
    request.onerror = () => reject(new Error('Could not open Community storage.'))
    request.onblocked = () => {
      request.onsuccess = () => request.result.close()
      reject(new Error('Close other Elsewhere tabs and try again.'))
    }
  })
}

async function withTransaction<T>(stores: string | string[], mode: IDBTransactionMode, error: string, operation: (transaction: IDBTransaction) => T): Promise<T> {
  const database = await openCommunityDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(stores, mode)
      transaction.onabort = () => reject(new Error(error))
      try {
        const result = operation(transaction)
        transaction.oncomplete = () => resolve(result)
      } catch (cause) {
        transaction.abort()
        reject(new Error(error, { cause }))
      }
    })
  } finally {
    database.close()
  }
}

async function storeEntry(entry: StoredEntry, replaceDraft: boolean, error: string): Promise<void> {
  await withTransaction(entryStore, 'readwrite', error, transaction => {
    const store = transaction.objectStore(entryStore)
    if (!replaceDraft) {
      store.add(entry)
      return
    }

    const request = store.get([entry.ownerId, entry.id]) as IDBRequest<StoredEntry | undefined>
    request.onsuccess = () => {
      if (!request.result || !('draft' in request.result)) {
        transaction.abort()
        return
      }
      store.put(entry)
    }
  })
}

export const communityRepository = {
  async list(ownerId: number): Promise<CommunityLibrary> {
    const requests = await withTransaction([entryStore, likeStore], 'readonly', 'Could not load your Community posts.', transaction => ({
      entries: transaction.objectStore(entryStore).index(ownerIndex).getAll(ownerId) as IDBRequest<StoredEntry[]>,
      likes: transaction.objectStore(likeStore).index(ownerIndex).getAll(ownerId) as IDBRequest<StoredLike[]>,
    }))

    const posts: CommunityPost[] = []
    const drafts: CommunityDraft[] = []
    for (const entry of requests.entries.result) {
      if ('post' in entry) posts.push(entry.post)
      else drafts.push(entry.draft)
    }
    posts.sort((first, second) => second.publishedAt.localeCompare(first.publishedAt))
    drafts.sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
    return { posts, drafts, likedIds: requests.likes.result.map(like => like.id) }
  },

  async saveDraft(ownerId: number, fields: CommunityDraftFields, id?: string): Promise<CommunityDraft> {
    const draft = { ...fields, id: id ?? crypto.randomUUID(), updatedAt: new Date().toISOString() }
    await storeEntry({ ownerId, id: draft.id, draft }, id !== undefined, 'Could not save this draft in this browser.')
    return draft
  },

  async publish(ownerId: number, author: string, fields: CommunityDraftFields, id?: string): Promise<CommunityPost> {
    const post = { ...fields, id: id ?? crypto.randomUUID(), ownerId, author, publishedAt: new Date().toISOString(), likeCount: 0 }
    await storeEntry({ ownerId, id: post.id, post }, id !== undefined, 'Could not publish this post in this browser.')
    return post
  },

  async toggleLike(ownerId: number, postId: string): Promise<boolean> {
    let liked = false
    await withTransaction(likeStore, 'readwrite', 'Could not update this like in this browser.', transaction => {
      const store = transaction.objectStore(likeStore)
      const key = [ownerId, postId]
      const find = store.getKey(key)
      find.onsuccess = () => {
        if (find.result) store.delete(key)
        else {
          store.add({ ownerId, id: postId } satisfies StoredLike)
          liked = true
        }
      }
    })
    return liked
  },
}

function guideAttachment(guide: Guide): CommunityAttachment {
  const cover = guideCover(guide)
  const stops = guide.itinerary?.flatMap(day => day.stops) ?? []
  const sources = [cover, ...guide.photos, ...stops.flatMap(stop => stop.photos)].filter(Boolean)
  const photos = [...new Set(sources)].map(src => withThumbnail(src, guide.title))
  const itinerary = guide.itinerary?.map((day, index) => `Day ${index + 1}\n${day.stops.map(stop => (
    [stop.place, stop.notes, stop.tips].filter(Boolean).join('\n')
  )).join('\n\n')}`).join('\n\n')

  return {
    id: guide.id,
    kind: 'guide',
    title: guide.title,
    body: guide.body.trim() ? guide.body : itinerary ?? '',
    city: guide.city ?? '',
    province: guide.province,
    photos,
  }
}

function footprintAttachment(photo: Footprint): CommunityAttachment {
  const title = photo.city || photo.province || 'Footprint photo'
  return {
    id: photo.id,
    kind: 'footprint',
    title,
    body: photo.note,
    city: photo.city,
    province: photo.province,
    photos: [{ ...photo.image, alt: title }],
  }
}

export async function listCommunitySources(ownerId: number): Promise<{
  guides: CommunityAttachment[]
  footprints: CommunityAttachment[]
  unavailable: ('guide' | 'footprint')[]
}> {
  const [guides, footprints] = await Promise.allSettled([
    guideRepository.list(ownerId).then(records => records.filter(guide => guide.status !== 'draft').map(guideAttachment)),
    serverFootprints.list(ownerId).then(records => records.filter(photo => photo.ownerId === ownerId).map(footprintAttachment)),
  ])
  const unavailable: ('guide' | 'footprint')[] = []
  if (guides.status === 'rejected') unavailable.push('guide')
  if (footprints.status === 'rejected') unavailable.push('footprint')
  return {
    guides: guides.status === 'fulfilled' ? guides.value : [],
    footprints: footprints.status === 'fulfilled' ? footprints.value : [],
    unavailable,
  }
}
