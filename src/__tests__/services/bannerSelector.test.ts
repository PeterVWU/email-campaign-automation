import { describe, it, expect, vi, beforeEach } from 'vitest'
import { selectBanners, getWeekId, randomSample } from '../../services/bannerSelector'

function makeMockPayload(banners: any[], historyDocs: any[] = []) {
  return {
    find: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'banners') {
        return Promise.resolve({ docs: banners })
      }
      if (collection === 'selection-history') {
        return Promise.resolve({ docs: historyDocs })
      }
      return Promise.resolve({ docs: [] })
    }),
  } as any
}

function makeBanner(id: number, title: string = `Banner ${id}`) {
  return {
    id,
    title,
    image: { url: `/api/media/file/banner-${id}.jpg` },
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('selectBanners', () => {
  it('selects 2 banners from the pool', async () => {
    const banners = [makeBanner(1), makeBanner(2), makeBanner(3), makeBanner(4)]
    const payload = makeMockPayload(banners)

    const result = await selectBanners(payload, 1, 1)

    expect(result).toHaveLength(2)
    expect(result[0]).toHaveProperty('id')
    expect(result[0]).toHaveProperty('title')
    expect(result[0]).toHaveProperty('imageUrl')
  })

  it('queries banners filtered by campaignType and store', async () => {
    const payload = makeMockPayload([makeBanner(1), makeBanner(2)])

    await selectBanners(payload, 5, 3)

    const bannersCall = payload.find.mock.calls.find(
      (call: any[]) => call[0].collection === 'banners',
    )
    expect(bannersCall[0].where).toEqual({
      campaignType: { equals: 5 },
      store: { equals: 3 },
    })
  })

  it('queries selection history for correct campaignType, store, and week', async () => {
    const payload = makeMockPayload([makeBanner(1), makeBanner(2)])

    await selectBanners(payload, 5, 3)

    const historyCall = payload.find.mock.calls.find(
      (call: any[]) => call[0].collection === 'selection-history',
    )
    expect(historyCall[0].where.campaignType).toEqual({ equals: 5 })
    expect(historyCall[0].where.store).toEqual({ equals: 3 })
    expect(historyCall[0].where.week).toBeDefined()
  })

  it('excludes last week banners from selection', async () => {
    const banners = [makeBanner(1), makeBanner(2), makeBanner(3), makeBanner(4)]
    const history = [{ selectedBanners: [1, 2] }]
    const payload = makeMockPayload(banners, history)

    const result = await selectBanners(payload, 1, 1)

    expect(result).toHaveLength(2)
    const selectedIds = result.map((b) => b.id)
    expect(selectedIds).not.toContain(1)
    expect(selectedIds).not.toContain(2)
    expect(selectedIds).toContain(3)
    expect(selectedIds).toContain(4)
  })

  it('resets exclusion list when pool too small after dedup', async () => {
    const banners = [makeBanner(1), makeBanner(2)]
    const history = [{ selectedBanners: [1, 2] }]
    const payload = makeMockPayload(banners, history)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await selectBanners(payload, 1, 1)

    expect(result).toHaveLength(2)
    expect(warnSpy).toHaveBeenCalledOnce()
    expect(warnSpy.mock.calls[0][0]).toContain('Resetting exclusion list')
  })

  it('returns empty array when no banners exist', async () => {
    const payload = makeMockPayload([])

    const result = await selectBanners(payload, 1, 1)

    expect(result).toEqual([])
  })

  it('returns fewer banners when pool is smaller than count', async () => {
    const banners = [makeBanner(1)]
    const payload = makeMockPayload(banners)

    const result = await selectBanners(payload, 1, 1)

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(1)
  })

  it('respects custom count parameter', async () => {
    const banners = [makeBanner(1), makeBanner(2), makeBanner(3), makeBanner(4), makeBanner(5)]
    const payload = makeMockPayload(banners)

    const result = await selectBanners(payload, 1, 1, 3)

    expect(result).toHaveLength(3)
  })

  it('maps banner fields correctly', async () => {
    const banners = [makeBanner(1, 'Spring Sale'), makeBanner(2, 'Summer Deal')]
    const payload = makeMockPayload(banners)

    const result = await selectBanners(payload, 1, 1)

    for (const banner of result) {
      expect(typeof banner.id).toBe('number')
      expect(typeof banner.imageUrl).toBe('string')
      expect(banner.imageUrl).toContain('/api/media/file/')
    }
  })

  it('sets title to null when banner has no title', async () => {
    const banners = [{ id: 1, image: { url: '/img.jpg' } }, makeBanner(2)]
    const payload = makeMockPayload(banners)

    const result = await selectBanners(payload, 1, 1)

    const noTitleBanner = result.find((b) => b.id === 1)
    if (noTitleBanner) {
      expect(noTitleBanner.title).toBeNull()
    }
  })

  it('handles missing selection history gracefully', async () => {
    const banners = [makeBanner(1), makeBanner(2), makeBanner(3)]
    const payload = makeMockPayload(banners, [])

    const result = await selectBanners(payload, 1, 1)

    expect(result).toHaveLength(2)
  })

  it('handles history with null selectedBanners', async () => {
    const banners = [makeBanner(1), makeBanner(2)]
    const history = [{ selectedBanners: null }]
    const payload = makeMockPayload(banners, history)

    const result = await selectBanners(payload, 1, 1)

    expect(result).toHaveLength(2)
  })
})

describe('getWeekId', () => {
  it('returns year-week format', () => {
    const result = getWeekId(new Date('2026-04-10'))
    expect(result).toMatch(/^\d{4}-W\d{2}$/)
  })

  it('pads single-digit week numbers', () => {
    const result = getWeekId(new Date('2026-01-05'))
    expect(result).toMatch(/W\d{2}/)
  })

  it('returns different week IDs for dates in different weeks', () => {
    const week1 = getWeekId(new Date('2026-04-01'))
    const week2 = getWeekId(new Date('2026-04-10'))
    expect(week1).not.toBe(week2)
  })

  it('returns same week ID for dates in same week', () => {
    const monday = getWeekId(new Date('2026-04-06'))
    const tuesday = getWeekId(new Date('2026-04-07'))
    expect(monday).toBe(tuesday)
  })
})

describe('randomSample', () => {
  it('returns requested number of items', () => {
    const items = [1, 2, 3, 4, 5]
    const result = randomSample(items, 3)
    expect(result).toHaveLength(3)
  })

  it('returns all items when count equals array length', () => {
    const items = [1, 2, 3]
    const result = randomSample(items, 3)
    expect(result).toHaveLength(3)
    expect(result.sort()).toEqual([1, 2, 3])
  })

  it('returns empty array for empty input', () => {
    const result = randomSample([], 3)
    expect(result).toEqual([])
  })

  it('does not modify original array', () => {
    const items = [1, 2, 3, 4, 5]
    const original = [...items]
    randomSample(items, 3)
    expect(items).toEqual(original)
  })

  it('returns unique items (no duplicates)', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    for (let i = 0; i < 20; i++) {
      const result = randomSample(items, 5)
      const unique = new Set(result)
      expect(unique.size).toBe(result.length)
    }
  })
})
