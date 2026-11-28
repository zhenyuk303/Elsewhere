import { guideCover, type GuideDay, type GuideDraft } from './guidesData'

const draft: GuideDraft = {
  title: 'A morning walk',
  province: 'Beijing',
  place: 'Dongcheng, Beijing',
  body: 'Start by the city walls.',
  photos: [],
}

describe('guide cover selection', () => {
  it('prefers an explicit cover, then the first content photo, then the province photo', () => {
    const photos = ['/first-photo.webp', '/second-photo.webp']
    expect(guideCover({ ...draft, cover: '/cover.webp', photos })).toBe('/cover.webp')
    expect(guideCover({ ...draft, photos })).toBe('/first-photo.webp')
    expect(guideCover(draft)).toBe('/images/carousel/%E5%8C%97%E4%BA%AC.webp')
  })

  it('uses the first itinerary photo before the province photo', () => {
    const itinerary: GuideDay[] = [
      {
        id: 'day-1',
        stops: [
          { id: 'stop-1', start: '09:00', end: '10:00', place: 'City walls', notes: '', tips: '', photos: [] },
          { id: 'stop-2', start: '10:00', end: '11:00', place: 'Jingshan Park', notes: '', tips: '', photos: ['/itinerary.webp'] },
        ],
      },
    ]
    const withItinerary = { ...draft, itinerary }
    expect(guideCover(withItinerary)).toBe('/itinerary.webp')
    expect(guideCover({ ...withItinerary, photos: ['/legacy.webp'] })).toBe('/legacy.webp')
    expect(guideCover({ ...withItinerary, cover: '/cover.webp' })).toBe('/cover.webp')
  })
})
