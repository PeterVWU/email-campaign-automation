import { describe, it, expect, vi, beforeEach } from 'vitest'
import { selectCategories } from '../../services/categorySelector'

function makeMockPayload(categories: any[], historyDocs: any[] = []) {
  return {
    find: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'category-pools') {
        return Promise.resolve({ docs: categories })
      }
      if (collection === 'selection-history') {
        return Promise.resolve({ docs: historyDocs })
      }
      return Promise.resolve({ docs: [] })
    }),
  } as any
}

function makeCategory(id: number, name?: string) {
  return {
    id,
    categoryName: name || `Category ${id}`,
    categoryUrl: `https://store.com/category-${id}`,
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('selectCategories', () => {
  it('selects 3 categories by default', async () => {
    const categories = [makeCategory(1), makeCategory(2), makeCategory(3), makeCategory(4), makeCategory(5)]
    const payload = makeMockPayload(categories)

    const result = await selectCategories(payload, 1, 1)

    expect(result).toHaveLength(3)
    expect(result[0]).toHaveProperty('id')
    expect(result[0]).toHaveProperty('categoryName')
    expect(result[0]).toHaveProperty('categoryUrl')
  })

  it('queries category-pools filtered by campaignType and store', async () => {
    const payload = makeMockPayload([makeCategory(1), makeCategory(2), makeCategory(3)])

    await selectCategories(payload, 7, 4)

    const poolCall = payload.find.mock.calls.find(
      (call: any[]) => call[0].collection === 'category-pools',
    )
    expect(poolCall[0].where).toEqual({
      campaignType: { equals: 7 },
      store: { equals: 4 },
    })
  })

  it('queries selection history for correct campaignType, store, and week', async () => {
    const payload = makeMockPayload([makeCategory(1), makeCategory(2), makeCategory(3)])

    await selectCategories(payload, 7, 4)

    const historyCall = payload.find.mock.calls.find(
      (call: any[]) => call[0].collection === 'selection-history',
    )
    expect(historyCall[0].where.campaignType).toEqual({ equals: 7 })
    expect(historyCall[0].where.store).toEqual({ equals: 4 })
    expect(historyCall[0].where.week).toBeDefined()
  })

  it('excludes last week categories from selection', async () => {
    const categories = [makeCategory(1), makeCategory(2), makeCategory(3), makeCategory(4), makeCategory(5), makeCategory(6)]
    const history = [{ selectedCategories: [1, 2, 3] }]
    const payload = makeMockPayload(categories, history)

    const result = await selectCategories(payload, 1, 1)

    expect(result).toHaveLength(3)
    const selectedIds = result.map((c) => c.id)
    expect(selectedIds).not.toContain(1)
    expect(selectedIds).not.toContain(2)
    expect(selectedIds).not.toContain(3)
  })

  it('resets exclusion list when pool too small after dedup', async () => {
    const categories = [makeCategory(1), makeCategory(2), makeCategory(3)]
    const history = [{ selectedCategories: [1, 2, 3] }]
    const payload = makeMockPayload(categories, history)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await selectCategories(payload, 1, 1)

    expect(result).toHaveLength(3)
    expect(warnSpy).toHaveBeenCalledOnce()
    expect(warnSpy.mock.calls[0][0]).toContain('Resetting exclusion list')
  })

  it('returns empty array when no categories exist', async () => {
    const payload = makeMockPayload([])

    const result = await selectCategories(payload, 1, 1)

    expect(result).toEqual([])
  })

  it('returns fewer categories when pool is smaller than count', async () => {
    const categories = [makeCategory(1), makeCategory(2)]
    const payload = makeMockPayload(categories)

    const result = await selectCategories(payload, 1, 1)

    expect(result).toHaveLength(2)
  })

  it('respects custom count parameter', async () => {
    const categories = Array.from({ length: 8 }, (_, i) => makeCategory(i + 1))
    const payload = makeMockPayload(categories)

    const result = await selectCategories(payload, 1, 1, 5)

    expect(result).toHaveLength(5)
  })

  it('maps category fields correctly', async () => {
    const categories = [makeCategory(1, 'Vape Kits'), makeCategory(2, 'E-Liquids'), makeCategory(3, 'Accessories')]
    const payload = makeMockPayload(categories)

    const result = await selectCategories(payload, 1, 1)

    for (const cat of result) {
      expect(typeof cat.id).toBe('number')
      expect(typeof cat.categoryName).toBe('string')
      expect(cat.categoryUrl).toContain('https://store.com/category-')
    }
  })

  it('handles missing selection history gracefully', async () => {
    const categories = [makeCategory(1), makeCategory(2), makeCategory(3)]
    const payload = makeMockPayload(categories, [])

    const result = await selectCategories(payload, 1, 1)

    expect(result).toHaveLength(3)
  })

  it('handles history with null selectedCategories', async () => {
    const categories = [makeCategory(1), makeCategory(2), makeCategory(3)]
    const history = [{ selectedCategories: null }]
    const payload = makeMockPayload(categories, history)

    const result = await selectCategories(payload, 1, 1)

    expect(result).toHaveLength(3)
  })
})
