import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runDailyCampaigns, runStoreCampaign, extractPlainText } from '../../services/campaignScheduler'

vi.mock('../../services/bannerSelector', () => ({
  selectBanners: vi.fn(),
  getWeekId: vi.fn().mockReturnValue('2026-W15'),
  randomSample: vi.fn(),
}))

vi.mock('../../services/categorySelector', () => ({
  selectCategories: vi.fn(),
}))

vi.mock('../../services/productSelector', () => ({
  selectProducts: vi.fn(),
}))

vi.mock('../../services/emailBuilder', () => ({
  buildCampaignEmail: vi.fn().mockReturnValue('<html>email</html>'),
}))

vi.mock('../../services/klaviyoCampaignSender', () => ({
  createAndSendCampaign: vi.fn(),
}))

import { selectBanners } from '../../services/bannerSelector'
import { selectCategories } from '../../services/categorySelector'
import { selectProducts } from '../../services/productSelector'
import { buildCampaignEmail } from '../../services/emailBuilder'
import { createAndSendCampaign } from '../../services/klaviyoCampaignSender'

const mockedSelectBanners = vi.mocked(selectBanners)
const mockedSelectCategories = vi.mocked(selectCategories)
const mockedSelectProducts = vi.mocked(selectProducts)
const mockedBuildEmail = vi.mocked(buildCampaignEmail)
const mockedSendCampaign = vi.mocked(createAndSendCampaign)

const testCampaignType = {
  id: 1,
  name: 'Top Sellers',
  titleTemplate: '{Store} Top Sellers This Week',
  bodyCopy: '<p>Check out our best sellers!</p>',
  dayOfWeek: 'thursday',
}

const testStore = {
  id: 1,
  name: 'Test Store',
  storeUrl: 'https://teststore.com',
  logoImage: { url: '/api/media/file/logo.png' },
  klaviyoApiKey: 'pk_test',
  klaviyoListId: 'LIST_001',
}

function makeMockPayload(campaignTypes: any[] = [testCampaignType], stores: any[] = [testStore]) {
  return {
    find: vi.fn().mockImplementation(({ collection }: any) => {
      if (collection === 'campaign-types') {
        return Promise.resolve({ docs: campaignTypes })
      }
      if (collection === 'stores') {
        return Promise.resolve({ docs: stores })
      }
      return Promise.resolve({ docs: [] })
    }),
    findByID: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: 1 }),
  } as any
}

function setupMocks() {
  mockedSelectBanners.mockResolvedValue([
    { id: 1, title: 'Banner 1', imageUrl: '/banner1.jpg' },
    { id: 2, title: 'Banner 2', imageUrl: '/banner2.jpg' },
  ])
  mockedSelectProducts.mockResolvedValue({
    block1: [
      { sku: 'P1', name: 'Product 1', imageUrl: '/p1.jpg', price: 29.99, salePrice: null, productUrl: '/p1' },
      { sku: 'P2', name: 'Product 2', imageUrl: '/p2.jpg', price: 19.99, salePrice: null, productUrl: '/p2' },
    ],
    block2: [
      { sku: 'P3', name: 'Product 3', imageUrl: '/p3.jpg', price: 39.99, salePrice: null, productUrl: '/p3' },
      { sku: 'P4', name: 'Product 4', imageUrl: '/p4.jpg', price: 49.99, salePrice: null, productUrl: '/p4' },
    ],
  })
  mockedSelectCategories.mockResolvedValue([
    { id: 1, categoryName: 'Vape Kits', categoryUrl: '/vape-kits' },
    { id: 2, categoryName: 'E-Liquids', categoryUrl: '/e-liquids' },
    { id: 3, categoryName: 'Accessories', categoryUrl: '/accessories' },
  ])
  mockedBuildEmail.mockReturnValue('<html>campaign email</html>')
  mockedSendCampaign.mockResolvedValue({
    campaignId: 'CAMP_001',
    messageId: 'MSG_001',
    templateId: 'TMPL_001',
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  setupMocks()
})

describe('runDailyCampaigns', () => {
  it('looks up campaign type by day of week', async () => {
    // Thursday = April 9, 2026
    const thursday = new Date('2026-04-09T10:00:00Z')
    const payload = makeMockPayload()

    await runDailyCampaigns(payload, thursday)

    const ctCall = payload.find.mock.calls.find((c: any) => c[0].collection === 'campaign-types')
    expect(ctCall[0].where.dayOfWeek).toEqual({ equals: 'thursday' })
  })

  it('skips when no campaign type for today', async () => {
    mockedSelectBanners.mockClear()
    const payload = makeMockPayload([])
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await runDailyCampaigns(payload, new Date('2026-04-09T10:00:00Z'))

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No campaign type'))
    expect(mockedSelectBanners).not.toHaveBeenCalled()
  })

  it('skips when no stores configured', async () => {
    mockedSelectBanners.mockClear()
    const payload = makeMockPayload([testCampaignType], [])
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await runDailyCampaigns(payload, new Date('2026-04-09T10:00:00Z'))

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No stores'))
    expect(mockedSelectBanners).not.toHaveBeenCalled()
  })

  it('runs pipeline for each store', async () => {
    mockedSelectBanners.mockClear()
    mockedSendCampaign.mockClear()
    setupMocks()
    const store2 = { ...testStore, id: 2, name: 'Store 2' }
    const payload = makeMockPayload([testCampaignType], [testStore, store2])

    await runDailyCampaigns(payload, new Date('2026-04-09T10:00:00Z'))

    expect(mockedSelectBanners).toHaveBeenCalledTimes(2)
    expect(mockedSendCampaign).toHaveBeenCalledTimes(2)
  })

  it('continues processing other stores when one fails', async () => {
    mockedSelectBanners.mockReset()
    mockedSendCampaign.mockClear()
    const store2 = { ...testStore, id: 2, name: 'Store 2' }
    const payload = makeMockPayload([testCampaignType], [testStore, store2])

    mockedSelectBanners
      .mockRejectedValueOnce(new Error('Banner fetch failed'))
      .mockResolvedValueOnce([{ id: 1, title: 'B1', imageUrl: '/b1.jpg' }])

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await runDailyCampaigns(payload, new Date('2026-04-09T10:00:00Z'))

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Campaign failed for store Test Store'))
    // Second store should still be processed
    expect(mockedSendCampaign).toHaveBeenCalledTimes(1)
  })

  it('logs failure to campaign-log when store pipeline fails', async () => {
    const payload = makeMockPayload()
    mockedSelectBanners.mockRejectedValue(new Error('API down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await runDailyCampaigns(payload, new Date('2026-04-09T10:00:00Z'))

    const createCalls = payload.create.mock.calls
    const logCall = createCalls.find((c: any) => c[0].collection === 'campaign-log')
    expect(logCall).toBeDefined()
    expect(logCall[0].data.status).toBe('failed')
    expect(logCall[0].data.error).toContain('API down')
  })
})

describe('runStoreCampaign', () => {
  it('calls all pipeline steps in order', async () => {
    const payload = makeMockPayload()
    const callOrder: string[] = []

    mockedSelectBanners.mockImplementation(async () => {
      callOrder.push('banners')
      return [{ id: 1, title: 'B', imageUrl: '/b.jpg' }]
    })
    mockedSelectProducts.mockImplementation(async () => {
      callOrder.push('products')
      return { block1: [], block2: [] }
    })
    mockedSelectCategories.mockImplementation(async () => {
      callOrder.push('categories')
      return []
    })
    mockedBuildEmail.mockImplementation(() => {
      callOrder.push('buildEmail')
      return '<html></html>'
    })
    mockedSendCampaign.mockImplementation(async () => {
      callOrder.push('send')
      return { campaignId: 'C1', messageId: 'M1', templateId: 'T1' }
    })

    await runStoreCampaign(payload, testStore as any, testCampaignType as any, new Date('2026-04-09T10:00:00Z'))

    expect(callOrder).toEqual(['banners', 'products', 'categories', 'buildEmail', 'send'])
  })

  it('passes correct subject with store name substituted', async () => {
    const payload = makeMockPayload()

    await runStoreCampaign(payload, testStore as any, testCampaignType as any, new Date('2026-04-09T10:00:00Z'))

    const sendCall = mockedSendCampaign.mock.calls[0][0]
    expect(sendCall.subject).toBe('Test Store Top Sellers This Week')
  })

  it('sends with correct Klaviyo credentials from store', async () => {
    const payload = makeMockPayload()

    await runStoreCampaign(payload, testStore as any, testCampaignType as any, new Date('2026-04-09T10:00:00Z'))

    const sendCall = mockedSendCampaign.mock.calls[0][0]
    expect(sendCall.apiKey).toBe('pk_test')
    expect(sendCall.listId).toBe('LIST_001')
  })

  it('records selection history after successful send', async () => {
    const payload = makeMockPayload()

    await runStoreCampaign(payload, testStore as any, testCampaignType as any, new Date('2026-04-09T10:00:00Z'))

    const historyCall = payload.create.mock.calls.find(
      (c: any) => c[0].collection === 'selection-history',
    )
    expect(historyCall).toBeDefined()
    expect(historyCall[0].data.week).toBe('2026-W15')
    expect(historyCall[0].data.campaignType).toBe(1)
    expect(historyCall[0].data.store).toBe(1)
    expect(historyCall[0].data.selectedBanners).toEqual([1, 2])
    expect(historyCall[0].data.selectedProducts).toEqual(['P1', 'P2', 'P3', 'P4'])
    expect(historyCall[0].data.selectedCategories).toEqual([1, 2, 3])
  })

  it('logs success to campaign-log', async () => {
    const payload = makeMockPayload()

    await runStoreCampaign(payload, testStore as any, testCampaignType as any, new Date('2026-04-09T10:00:00Z'))

    const logCall = payload.create.mock.calls.find(
      (c: any) => c[0].collection === 'campaign-log',
    )
    expect(logCall).toBeDefined()
    expect(logCall[0].data.status).toBe('success')
    expect(logCall[0].data.klaviyoCampaignId).toBe('CAMP_001')
    expect(logCall[0].data.selectedContent).toBeDefined()
  })

  it('includes campaign name with store name and date', async () => {
    const payload = makeMockPayload()

    await runStoreCampaign(payload, testStore as any, testCampaignType as any, new Date('2026-04-09T10:00:00Z'))

    const sendCall = mockedSendCampaign.mock.calls[0][0]
    expect(sendCall.campaignName).toContain('Top Sellers')
    expect(sendCall.campaignName).toContain('Test Store')
    expect(sendCall.campaignName).toContain('2026-04-09')
  })
})

describe('extractPlainText', () => {
  it('returns empty string for null/undefined', () => {
    expect(extractPlainText(null)).toBe('')
    expect(extractPlainText(undefined)).toBe('')
  })

  it('returns string as-is', () => {
    expect(extractPlainText('hello world')).toBe('hello world')
  })

  it('extracts text from Lexical rich text format', () => {
    const richText = {
      root: {
        children: [
          { children: [{ text: 'Hello ' }, { text: 'world' }] },
          { children: [{ text: 'Second line' }] },
        ],
      },
    }

    expect(extractPlainText(richText)).toBe('Hello world\nSecond line')
  })

  it('handles empty rich text', () => {
    expect(extractPlainText({ root: { children: [] } })).toBe('')
  })

  it('returns empty string for unrecognized format', () => {
    expect(extractPlainText({ foo: 'bar' })).toBe('')
  })
})
