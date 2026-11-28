import beijingCover from '../../assets/travel/beijing.jpg'
import { travelSlides } from '../carousel/carouselData'
import { upgradeLegacyGuide } from './legacyGuide'

export type GuideStatus = 'draft' | 'published'

export type GuideStop = {
  id: string
  start: string
  end: string
  place: string
  notes: string
  tips: string
  photos: string[]
}

export type GuideDay = { id: string; stops: GuideStop[] }

export type GuideDraft = {
  title: string
  province: string
  place: string
  body: string
  cover?: string
  photos: string[]
  city?: string
  tags?: string[]
  itinerary?: GuideDay[]
  itinerarySource?: 'generated'
  status?: GuideStatus
}

export type Guide = GuideDraft & { id: string }

const provinceImages = new Map(travelSlides.map(slide => [slide.location, slide.src]))
export const guideProvinces = [...provinceImages.keys()].sort()

export function guideCover(guide: GuideDraft): string {
  const cover = guide.cover || guide.photos[0]
  if (cover) return cover

  for (const day of guide.itinerary ?? []) {
    for (const stop of day.stops) {
      const photo = stop.photos[0]
      if (photo) return photo
    }
  }

  return provinceImages.get(guide.province) || ''
}

export const sampleGuides: Guide[] = [
  {
    id: 'sample-beijing-dongcheng',
    title: 'A Morning in Dongcheng',
    province: 'Beijing',
    place: 'Dongcheng, Beijing',
    cover: beijingCover,
    photos: [],
    body: [
      'Start at Jingshan Park for a view over the Forbidden City. From the hill, you can see how the palace roofs and courtyards line up along Beijing’s central axis. Spend a minute looking at the view before reaching for the camera.',
      'Continue north toward the Drum Tower and Bell Tower. Follow the smaller lanes off Nanluoguxiang to see how the scale changes from broad streets to low walls and courtyard doors.',
      'Take a break for tea before heading back. This walk works best with room to stop: a patch of afternoon light, a painted doorstep, or the sound of bicycles coming down a lane can be as memorable as the landmarks.',
    ].join('\n\n'),
  },
  {
    id: 'sample-beijing-xicheng',
    title: 'The Lakes of Xicheng',
    province: 'Beijing',
    place: 'Xicheng, Beijing',
    photos: [],
    body: [
      'Begin by the water at Beihai Park and let the shoreline set your pace. The White Pagoda makes a useful landmark as you move around the lake, and the view changes with every bend.',
      'Continue toward Shichahai and follow the edges of Qianhai and Houhai. Go slowly across the bridges and look back across the water at the willows and tiled roofs.',
      'For a quiet end to the walk, find a spot along the lakeside and stay until the light changes. A short route is enough when the same scene gives you a different view every few minutes.',
    ].join('\n\n'),
  },
  {
    id: 'sample-shanghai-bund',
    title: 'The Bund at Blue Hour',
    province: 'Shanghai',
    place: 'Huangpu, Shanghai',
    photos: [],
    body: [
      'Start on the Bund while there is still light to pick out the details of the buildings behind you. Look across the Huangpu River, then turn around to see how different the two banks feel.',
      'Walk north toward Waibaidu Bridge for changing angles on the skyline. The river is the thread of the route, so leave time to stop when a boat or a reflection catches your eye.',
      'Around dusk, frame a scene with both banks in view. Leave some space for the river: the movement of water is part of what makes this corner of Shanghai feel alive.',
    ].join('\n\n'),
  },
  {
    id: 'sample-zhejiang-west-lake',
    title: 'West Lake on Foot',
    province: 'Zhejiang',
    place: 'Hangzhou, Zhejiang',
    photos: [],
    body: [
      'Follow the northern shore of West Lake from Beishan Road. The shore changes from open water to trees and low buildings, so the walk offers both broad views and small details.',
      'Take a stretch of the Bai Causeway for a view from the water. Stop on a bridge and look in both directions before carrying on. The skyline and hills make very different pictures from the same spot.',
      'Finish with a pause by the shore. There is no need to circle the whole lake; choose a different stretch of water if you come back another day.',
    ].join('\n\n'),
  },
  {
    id: 'sample-sichuan-jiuzhaigou',
    title: 'Following the Water in Jiuzhaigou',
    province: 'Sichuan',
    place: 'Jiuzhaigou, Sichuan',
    photos: [],
    body: [
      'Build this outing around a few stops rather than a checklist. At Five Flower Lake, look down at the water near the shore as well as out toward the forest. The two views tell very different stories.',
      'Give the waterfalls time. Look for the points where white water breaks into smaller streams, and try a close photograph alongside the wider view of the valley.',
      'Use the marked paths and pause where there is space for others to pass. In a place with so much colour, the smallest stretch of shore can be worth lingering over.',
    ].join('\n\n'),
  },
  {
    id: 'sample-yunnan-dali',
    title: 'Between Cangshan and Erhai',
    province: 'Yunnan',
    place: 'Dali, Yunnan',
    photos: [],
    body: [
      'Begin in Dali’s old town, where narrow streets open into views of Cangshan. Spend part of the morning among the lanes and courtyards before heading toward the water.',
      'Choose a stretch of the Erhai shoreline for the second half of the day. The distance from the mountains changes how the light falls, so watch the ridge as you move along the lake.',
      'Bring back a pair of photographs that show the two sides of the day: one close detail from the streets and one wide view across the lake. Together they make a better record than either view alone.',
    ].join('\n\n'),
  },
].map(upgradeLegacyGuide)

type StoredGuide = Guide & { ownerId: number; createdAt: number }

const storeName = 'guides'

function openGuideDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('Guide storage is unavailable in this browser.'))
      return
    }

    const request = indexedDB.open('elsewhere-guides', 1)
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(storeName, { keyPath: ['ownerId', 'id'] })
      store.createIndex('ownerId', 'ownerId')
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      resolve(database)
    }
    request.onerror = () => reject(new Error('Could not open guides saved in this browser.'))
    request.onblocked = () => {
      request.onsuccess = () => request.result.close()
      reject(new Error('Close other Elsewhere tabs and try again.'))
    }
  })
}

export const guideRepository = {
  async list(ownerId: number): Promise<Guide[]> {
    const database = await openGuideDatabase()
    try {
      const records = await new Promise<StoredGuide[]>((resolve, reject) => {
        const transaction = database.transaction(storeName)
        const request = transaction.objectStore(storeName).index('ownerId').getAll(ownerId)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(new Error('Could not read guides saved in this browser.'))
      })

      const bundled = new Map(sampleGuides.map(guide => [guide.id, guide]))
      const additions: Guide[] = []
      for (const { ownerId: _ownerId, createdAt: _createdAt, ...guide } of records.sort((a, b) => b.createdAt - a.createdAt)) {
        const updated = upgradeLegacyGuide(guide)
        if (bundled.has(guide.id)) bundled.set(guide.id, updated)
        else additions.push(updated)
      }
      return [...additions, ...bundled.values()]
    } finally {
      database.close()
    }
  },

  async save(ownerId: number, draft: GuideDraft, guideId?: string): Promise<Guide> {
    const guide = { ...draft, id: guideId ?? crypto.randomUUID() }
    const database = await openGuideDatabase()
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(storeName, 'readwrite')
        const store = transaction.objectStore(storeName)
        transaction.oncomplete = () => resolve()
        transaction.onabort = () => reject(new Error('Could not save this guide in this browser.'))

        if (!guideId) {
          store.add({ ...guide, ownerId, createdAt: Date.now() } satisfies StoredGuide)
          return
        }

        const request = store.get([ownerId, guideId])
        request.onsuccess = () => {
          const previous = request.result as StoredGuide | undefined
          if (!previous && !sampleGuides.some(sample => sample.id === guideId)) {
            transaction.abort()
            return
          }
          store.put({ ...guide, ownerId, createdAt: previous?.createdAt ?? Date.now() } satisfies StoredGuide)
        }
      })
      return guide
    } finally {
      database.close()
    }
  },
}
