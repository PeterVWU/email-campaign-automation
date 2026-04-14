import { describe, it, expect, vi, beforeEach } from 'vitest'
import { selectProducts } from '../../services/productSelector'
import type { StandardProduct } from '../../services/types'

vi.mock('../../services/magentoProductFetcher', () => ({
  fetchMagentoProducts: vi.fn(),
}))

vi.mock('../../services/shopifyProductFetcher', () => ({
  fetchShopifyProducts: vi.fn(),
}))

import { fetchMagentoProducts } from '../../services/magentoProductFetcher'
import { fetchShopifyProducts } from '../../services/shopifyProductFetcher'

const mockedFetchMagento = vi.mocked(fetchMagentoProducts)
const mockedFetchShopify = vi.mocked(fetchShopifyProducts)

function makeProduct(sku: string): StandardProduct {
  return {
    sku,
    name: `Product ${sku}`,
    imageUrl: `https://store.com/img/${sku}.jpg`,
    price: 29.99,
    salePrice: null,
    productUrl: `https://store.com/product/${sku}`,
  }
}

function makeMockPayload(store: any, campaignType: any, historyDocs: any[] = []) {
  return {
    findByID: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'stores') return Promise.resolve(store)
      if (collection === 'campaign-types') return Promise.resolve(campaignType)
      return Promise.resolve(null)
    }),
    find: vi.fn().mockImplementation(() => {
      return Promise.resolve({ docs: historyDocs })
    }),
  } as any
}

const magentoStore = {
  id: 1,
  platform: 'magento2',
  storeUrl: 'https://magento.example.com',
  apiCredentials: { apiUrl: 'https://magento.example.com', apiKey: 'mag-key', apiSecret: null },
}

const shopifyStore = {
  id: 2,
  platform: 'shopify',
  storeUrl: 'https://shop.myshopify.com',
  apiCredentials: { apiUrl: null, apiKey: 'shpat_token', apiSecret: null },
}

const campaignType = {
  id: 1,
  productSelectionRule: { strategy: 'top_sellers' },
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('selectProducts', () => {
  it('calls Magento fetcher for magento2 stores', async () => {
    const products = Array.from({ length: 10 }, (_, i) => makeProduct(`MAG-${i}`))
    mockedFetchMagento.mockResolvedValue(products)
    const payload = makeMockPayload(magentoStore, campaignType)

    await selectProducts(payload, 1, 1)

    expect(mockedFetchMagento).toHaveBeenCalledOnce()
    expect(mockedFetchShopify).not.toHaveBeenCalled()
  })

  it('calls Shopify fetcher for shopify stores', async () => {
    const products = Array.from({ length: 10 }, (_, i) => makeProduct(`SHOP-${i}`))
    mockedFetchMagento.mockReset()
    mockedFetchShopify.mockReset()
    mockedFetchShopify.mockResolvedValue(products)
    const payload = makeMockPayload(shopifyStore, campaignType)

    await selectProducts(payload, 1, 2)

    expect(mockedFetchShopify).toHaveBeenCalledOnce()
    expect(mockedFetchMagento).not.toHaveBeenCalled()
  })

  it('returns 2 blocks of 4 products by default', async () => {
    const products = Array.from({ length: 12 }, (_, i) => makeProduct(`SKU-${i}`))
    mockedFetchMagento.mockResolvedValue(products)
    const payload = makeMockPayload(magentoStore, campaignType)

    const result = await selectProducts(payload, 1, 1)

    expect(result.block1).toHaveLength(4)
    expect(result.block2).toHaveLength(4)
  })

  it('deduplicates against last week products', async () => {
    const products = Array.from({ length: 12 }, (_, i) => makeProduct(`SKU-${i}`))
    mockedFetchMagento.mockResolvedValue(products)
    const history = [{ selectedProducts: ['SKU-0', 'SKU-1', 'SKU-2', 'SKU-3'] }]
    const payload = makeMockPayload(magentoStore, campaignType, history)

    const result = await selectProducts(payload, 1, 1)

    const allSkus = [...result.block1, ...result.block2].map((p) => p.sku)
    expect(allSkus).not.toContain('SKU-0')
    expect(allSkus).not.toContain('SKU-1')
    expect(allSkus).not.toContain('SKU-2')
    expect(allSkus).not.toContain('SKU-3')
  })

  it('resets dedup when pool too small after exclusion', async () => {
    const products = Array.from({ length: 8 }, (_, i) => makeProduct(`SKU-${i}`))
    mockedFetchMagento.mockResolvedValue(products)
    const history = [{ selectedProducts: ['SKU-0', 'SKU-1', 'SKU-2', 'SKU-3', 'SKU-4', 'SKU-5', 'SKU-6', 'SKU-7'] }]
    const payload = makeMockPayload(magentoStore, campaignType, history)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await selectProducts(payload, 1, 1)

    const totalProducts = result.block1.length + result.block2.length
    expect(totalProducts).toBe(8)
    expect(warnSpy).toHaveBeenCalledOnce()
  })

  it('handles fewer products than requested', async () => {
    const products = [makeProduct('SKU-1'), makeProduct('SKU-2'), makeProduct('SKU-3')]
    mockedFetchMagento.mockResolvedValue(products)
    const payload = makeMockPayload(magentoStore, campaignType)

    const result = await selectProducts(payload, 1, 1)

    const totalProducts = result.block1.length + result.block2.length
    expect(totalProducts).toBe(3)
    expect(result.block1.length).toBe(2)
    expect(result.block2.length).toBe(1)
  })

  it('handles empty product list', async () => {
    mockedFetchMagento.mockResolvedValue([])
    const payload = makeMockPayload(magentoStore, campaignType)

    const result = await selectProducts(payload, 1, 1)

    expect(result.block1).toEqual([])
    expect(result.block2).toEqual([])
  })

  it('throws for missing Magento credentials', async () => {
    const badStore = { ...magentoStore, apiCredentials: { apiUrl: null, apiKey: null, apiSecret: null } }
    const payload = makeMockPayload(badStore, campaignType)

    await expect(selectProducts(payload, 1, 1)).rejects.toThrow('missing Magento API credentials')
  })

  it('throws for missing Shopify access token', async () => {
    const badStore = { ...shopifyStore, apiCredentials: { apiUrl: null, apiKey: null, apiSecret: null } }
    const payload = makeMockPayload(badStore, campaignType)

    await expect(selectProducts(payload, 1, 2)).rejects.toThrow('missing Shopify access token')
  })

  it('throws for unknown platform', async () => {
    const badStore = { ...magentoStore, platform: 'woocommerce' }
    const payload = makeMockPayload(badStore, campaignType)

    await expect(selectProducts(payload, 1, 1)).rejects.toThrow('Unknown store platform')
  })

  it('passes campaign type selection rule to fetcher', async () => {
    const customRule = { strategy: 'category' as const, categoryId: '42' }
    const ct = { id: 1, productSelectionRule: customRule }
    mockedFetchMagento.mockReset()
    mockedFetchMagento.mockResolvedValue([])
    const payload = makeMockPayload(magentoStore, ct)

    await selectProducts(payload, 1, 1)

    const callArgs = mockedFetchMagento.mock.calls[0]
    expect(callArgs[2].strategy).toBe('category')
    expect(callArgs[2].categoryId).toBe('42')
  })

  it('fetches 3x the needed count to allow for dedup', async () => {
    mockedFetchMagento.mockResolvedValue([])
    const payload = makeMockPayload(magentoStore, campaignType)

    await selectProducts(payload, 1, 1, 8)

    const callArgs = mockedFetchMagento.mock.calls[0]
    expect(callArgs[2].limit).toBe(24)
  })

  it('respects custom totalCount', async () => {
    const products = Array.from({ length: 10 }, (_, i) => makeProduct(`SKU-${i}`))
    mockedFetchMagento.mockResolvedValue(products)
    const payload = makeMockPayload(magentoStore, campaignType)

    const result = await selectProducts(payload, 1, 1, 6)

    const totalProducts = result.block1.length + result.block2.length
    expect(totalProducts).toBe(6)
  })

  it('handles history with null selectedProducts', async () => {
    const products = Array.from({ length: 10 }, (_, i) => makeProduct(`SKU-${i}`))
    mockedFetchMagento.mockResolvedValue(products)
    const history = [{ selectedProducts: null }]
    const payload = makeMockPayload(magentoStore, campaignType, history)

    const result = await selectProducts(payload, 1, 1)

    const totalProducts = result.block1.length + result.block2.length
    expect(totalProducts).toBe(8)
  })
})
