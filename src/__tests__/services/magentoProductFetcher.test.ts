import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchMagentoProducts, getParentProductName } from '../../services/magentoProductFetcher'

const mockCredentials = {
  apiUrl: 'https://magento.example.com',
  apiKey: 'test-api-key',
}

const storeUrl = 'https://magento.example.com'

function makeMagentoProduct(overrides: Record<string, any> = {}) {
  return {
    sku: 'TEST-SKU-001',
    name: 'Test Product',
    price: 29.99,
    type_id: 'configurable',
    created_at: '2026-01-01T00:00:00Z',
    media_gallery_entries: [
      { file: '/t/e/test-image.jpg', types: ['image', 'small_image', 'thumbnail'] },
    ],
    custom_attributes: [
      { attribute_code: 'url_key', value: 'test-product' },
      { attribute_code: 'special_price', value: '19.99' },
    ],
    ...overrides,
  }
}

function mockFetchResponse(data: any) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('getParentProductName', () => {
  it('extracts parent name before first dash', () => {
    expect(getParentProductName('The One Series 100ML - 3mg - Blueberry')).toBe('The One Series 100ML')
  })

  it('handles dash without spaces', () => {
    expect(getParentProductName('Geek Bar Pulse-Sour Watermelon-5%')).toBe('Geek Bar Pulse')
  })

  it('returns full name when no dash', () => {
    expect(getParentProductName('Simple Product Name')).toBe('Simple Product Name')
  })

  it('handles dash at start', () => {
    expect(getParentProductName('-Variant Only')).toBe('')
  })

  it('trims whitespace', () => {
    expect(getParentProductName('Product Name  - Variant')).toBe('Product Name')
  })
})

describe('fetchMagentoProducts', () => {
  describe('new_arrivals strategy', () => {
    it('fetches products sorted by created_at DESC', async () => {
      const products = [makeMagentoProduct(), makeMagentoProduct({ sku: 'SKU-002', name: 'Product 2' })]
      global.fetch = mockFetchResponse({ items: products, total_count: 2 })

      const result = await fetchMagentoProducts(storeUrl, mockCredentials, {
        strategy: 'new_arrivals',
        limit: 8,
      })

      expect(result).toHaveLength(2)
      expect(result[0].sku).toBe('TEST-SKU-001')
      expect(result[0].name).toBe('Test Product')
      expect(result[0].price).toBe(29.99)
      expect(result[0].salePrice).toBe(19.99)
      expect(result[0].imageUrl).toBe('https://magento.example.com/media/catalog/product/t/e/test-image.jpg')
      expect(result[0].productUrl).toBe('https://magento.example.com/test-product')

      const callUrl = (global.fetch as any).mock.calls[0][0]
      expect(callUrl).toContain('/rest/V1/products')
      expect(callUrl).toContain('created_at')
      expect(callUrl).toContain('DESC')
    })
  })

  describe('category strategy', () => {
    it('fetches products filtered by category ID', async () => {
      const products = [makeMagentoProduct()]
      global.fetch = mockFetchResponse({ items: products, total_count: 1 })

      const result = await fetchMagentoProducts(storeUrl, mockCredentials, {
        strategy: 'category',
        categoryId: '42',
        limit: 8,
      })

      expect(result).toHaveLength(1)
      const callUrl = (global.fetch as any).mock.calls[0][0]
      expect(callUrl).toContain('category_id')
      expect(callUrl).toContain('42')
    })

    it('throws if categoryId is missing', async () => {
      await expect(
        fetchMagentoProducts(storeUrl, mockCredentials, { strategy: 'category' }),
      ).rejects.toThrow('categoryId is required')
    })
  })

  describe('clearance strategy', () => {
    it('fetches products with special_price', async () => {
      const products = [makeMagentoProduct()]
      global.fetch = mockFetchResponse({ items: products, total_count: 1 })

      const result = await fetchMagentoProducts(storeUrl, mockCredentials, {
        strategy: 'clearance',
        limit: 4,
      })

      expect(result).toHaveLength(1)
      const callUrl = (global.fetch as any).mock.calls[0][0]
      expect(callUrl).toContain('special_price')
    })
  })

  describe('staff_picks strategy', () => {
    it('fetches products by specific SKU list', async () => {
      const products = [
        makeMagentoProduct({ sku: 'PICK-1' }),
        makeMagentoProduct({ sku: 'PICK-2' }),
      ]
      global.fetch = mockFetchResponse({ items: products, total_count: 2 })

      const result = await fetchMagentoProducts(storeUrl, mockCredentials, {
        strategy: 'staff_picks',
        skuList: ['PICK-1', 'PICK-2'],
      })

      expect(result).toHaveLength(2)
      const callUrl = (global.fetch as any).mock.calls[0][0]
      expect(callUrl).toContain('PICK-1')
      expect(callUrl).toContain('PICK-2')
    })

    it('throws if skuList is missing', async () => {
      await expect(
        fetchMagentoProducts(storeUrl, mockCredentials, { strategy: 'staff_picks' }),
      ).rejects.toThrow('skuList is required')
    })

    it('throws if skuList is empty', async () => {
      await expect(
        fetchMagentoProducts(storeUrl, mockCredentials, { strategy: 'staff_picks', skuList: [] }),
      ).rejects.toThrow('skuList is required')
    })
  })

  describe('top_sellers strategy', () => {
    it('fetches orders then fetches top-selling products', async () => {
      const orderData = {
        items: [
          { items: [{ sku: 'TOP-1', qty_ordered: 10 }, { sku: 'TOP-2', qty_ordered: 5 }] },
          { items: [{ sku: 'TOP-1', qty_ordered: 3 }] },
        ],
      }
      const productData = {
        items: [
          makeMagentoProduct({ sku: 'TOP-1' }),
          makeMagentoProduct({ sku: 'TOP-2' }),
        ],
        total_count: 2,
      }

      let callCount = 0
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++
        const data = callCount === 1 ? orderData : productData
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(data),
          text: () => Promise.resolve(JSON.stringify(data)),
        })
      })

      const result = await fetchMagentoProducts(storeUrl, mockCredentials, {
        strategy: 'top_sellers',
        limit: 8,
      })

      expect(result).toHaveLength(2)
      // First call is orders, second is products
      const orderCallUrl = (global.fetch as any).mock.calls[0][0]
      expect(orderCallUrl).toContain('/rest/V1/orders')
      const productCallUrl = (global.fetch as any).mock.calls[1][0]
      expect(productCallUrl).toContain('/rest/V1/products')
      expect(productCallUrl).toContain('TOP-1')
    })

    it('returns empty array when no orders found', async () => {
      global.fetch = mockFetchResponse({ items: [] })

      const result = await fetchMagentoProducts(storeUrl, mockCredentials, {
        strategy: 'top_sellers',
        limit: 8,
      })

      expect(result).toEqual([])
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('unknown strategy', () => {
    it('throws for unknown strategy', async () => {
      await expect(
        fetchMagentoProducts(storeUrl, mockCredentials, {
          strategy: 'unknown' as any,
        }),
      ).rejects.toThrow('Unknown product selection strategy')
    })
  })

  describe('default limit', () => {
    it('uses limit of 8 when not specified', async () => {
      global.fetch = mockFetchResponse({ items: [], total_count: 0 })

      await fetchMagentoProducts(storeUrl, mockCredentials, {
        strategy: 'new_arrivals',
      })

      const callUrl = (global.fetch as any).mock.calls[0][0]
      expect(callUrl).toContain('pageSize')
      expect(callUrl).toContain('8')
    })
  })

  describe('product transformation', () => {
    it('handles product without media gallery with placeholder', async () => {
      const product = makeMagentoProduct({ type_id: 'configurable', media_gallery_entries: undefined })
      global.fetch = mockFetchResponse({ items: [product], total_count: 1 })

      const result = await fetchMagentoProducts(storeUrl, mockCredentials, {
        strategy: 'new_arrivals',
      })

      expect(result[0].imageUrl).toContain('placeholder')
    })

    it('handles product without url_key', async () => {
      const product = makeMagentoProduct({ custom_attributes: [] })
      global.fetch = mockFetchResponse({ items: [product], total_count: 1 })

      const result = await fetchMagentoProducts(storeUrl, mockCredentials, {
        strategy: 'new_arrivals',
      })

      expect(result[0].productUrl).toContain('TEST-SKU-001')
    })

    it('sets salePrice to null when no special_price', async () => {
      const product = makeMagentoProduct({
        custom_attributes: [{ attribute_code: 'url_key', value: 'test' }],
      })
      global.fetch = mockFetchResponse({ items: [product], total_count: 1 })

      const result = await fetchMagentoProducts(storeUrl, mockCredentials, {
        strategy: 'new_arrivals',
      })

      expect(result[0].salePrice).toBeNull()
    })
  })

  describe('parent URL resolution', () => {
    it('uses configurable product own URL directly', async () => {
      const product = makeMagentoProduct({ type_id: 'configurable' })
      global.fetch = mockFetchResponse({ items: [product], total_count: 1 })

      const result = await fetchMagentoProducts(storeUrl, mockCredentials, {
        strategy: 'new_arrivals',
      })

      expect(result[0].productUrl).toBe('https://magento.example.com/test-product')
      // Only 1 fetch call — no parent lookup
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('resolves parent URL for simple products', async () => {
      const variant = makeMagentoProduct({
        type_id: 'simple',
        name: 'The One Series 100ML-3mg-Blueberry',
        custom_attributes: [
          { attribute_code: 'url_key', value: 'the-one-series-100ml-3mg-blueberry' },
        ],
      })
      const parentProduct = makeMagentoProduct({
        type_id: 'configurable',
        name: 'The One Series 100ML',
        custom_attributes: [
          { attribute_code: 'url_key', value: 'the-one-series-100ml' },
        ],
      })

      let callCount = 0
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++
        const data =
          callCount === 1
            ? { items: [variant], total_count: 1 }
            : { items: [parentProduct], total_count: 1 }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(data),
          text: () => Promise.resolve(JSON.stringify(data)),
        })
      })

      const result = await fetchMagentoProducts(storeUrl, mockCredentials, {
        strategy: 'new_arrivals',
      })

      expect(result[0].productUrl).toBe('https://magento.example.com/the-one-series-100ml')
      expect(result[0].name).toBe('The One Series 100ML-3mg-Blueberry')
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('falls back to variant URL when no parent found', async () => {
      const variant = makeMagentoProduct({
        type_id: 'simple',
        name: 'Standalone Product',
        custom_attributes: [
          { attribute_code: 'url_key', value: 'standalone-product' },
        ],
      })

      let callCount = 0
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++
        const data =
          callCount === 1
            ? { items: [variant], total_count: 1 }
            : { items: [], total_count: 0 }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(data),
          text: () => Promise.resolve(JSON.stringify(data)),
        })
      })

      const result = await fetchMagentoProducts(storeUrl, mockCredentials, {
        strategy: 'new_arrivals',
      })

      expect(result[0].productUrl).toBe('https://magento.example.com/standalone-product')
    })

    it('caches parent lookups for same parent name', async () => {
      const variant1 = makeMagentoProduct({
        type_id: 'simple',
        sku: 'V1',
        name: 'Widget-Red',
        custom_attributes: [{ attribute_code: 'url_key', value: 'widget-red' }],
      })
      const variant2 = makeMagentoProduct({
        type_id: 'simple',
        sku: 'V2',
        name: 'Widget-Blue',
        custom_attributes: [{ attribute_code: 'url_key', value: 'widget-blue' }],
      })
      const parentProduct = makeMagentoProduct({
        type_id: 'configurable',
        name: 'Widget',
        custom_attributes: [{ attribute_code: 'url_key', value: 'widget' }],
      })

      let callCount = 0
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++
        const data =
          callCount === 1
            ? { items: [variant1, variant2], total_count: 2 }
            : { items: [parentProduct], total_count: 1 }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(data),
          text: () => Promise.resolve(JSON.stringify(data)),
        })
      })

      const result = await fetchMagentoProducts(storeUrl, mockCredentials, {
        strategy: 'new_arrivals',
      })

      expect(result[0].productUrl).toBe('https://magento.example.com/widget')
      expect(result[1].productUrl).toBe('https://magento.example.com/widget')
      // 1 product fetch + 1 parent lookup (cached for second variant)
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('parent image fallback', () => {
    it('uses parent image when variant has no image', async () => {
      const variant = makeMagentoProduct({
        type_id: 'simple',
        name: 'Widget-Red',
        media_gallery_entries: [],
        custom_attributes: [{ attribute_code: 'url_key', value: 'widget-red' }],
      })
      const parentProduct = makeMagentoProduct({
        type_id: 'configurable',
        name: 'Widget',
        media_gallery_entries: [
          { file: '/w/i/widget-main.jpg', types: ['image', 'small_image', 'thumbnail'] },
        ],
        custom_attributes: [{ attribute_code: 'url_key', value: 'widget' }],
      })

      let callCount = 0
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++
        const data =
          callCount === 1
            ? { items: [variant], total_count: 1 }
            : { items: [parentProduct], total_count: 1 }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(data),
          text: () => Promise.resolve(JSON.stringify(data)),
        })
      })

      const result = await fetchMagentoProducts(storeUrl, mockCredentials, {
        strategy: 'new_arrivals',
      })

      expect(result[0].imageUrl).toContain('widget-main.jpg')
    })

    it('uses placeholder when neither variant nor parent has image', async () => {
      const variant = makeMagentoProduct({
        type_id: 'simple',
        name: 'Standalone',
        media_gallery_entries: [],
        custom_attributes: [{ attribute_code: 'url_key', value: 'standalone' }],
      })

      let callCount = 0
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++
        const data =
          callCount === 1
            ? { items: [variant], total_count: 1 }
            : { items: [], total_count: 0 }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(data),
          text: () => Promise.resolve(JSON.stringify(data)),
        })
      })

      const result = await fetchMagentoProducts(storeUrl, mockCredentials, {
        strategy: 'new_arrivals',
      })

      expect(result[0].imageUrl).toContain('placeholder')
    })
  })

  describe('API error handling', () => {
    it('throws on non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      })

      await expect(
        fetchMagentoProducts(storeUrl, mockCredentials, { strategy: 'new_arrivals' }),
      ).rejects.toThrow('Magento API error 401: Unauthorized')
    })
  })

  describe('API authentication', () => {
    it('sends Bearer token in Authorization header', async () => {
      global.fetch = mockFetchResponse({ items: [], total_count: 0 })

      await fetchMagentoProducts(storeUrl, mockCredentials, { strategy: 'new_arrivals' })

      const callOptions = (global.fetch as any).mock.calls[0][1]
      expect(callOptions.headers.Authorization).toBe('Bearer test-api-key')
      expect(callOptions.headers['Content-Type']).toBe('application/json')
    })
  })

  describe('trailing slash handling', () => {
    it('strips trailing slashes from store URL', async () => {
      const product = makeMagentoProduct()
      global.fetch = mockFetchResponse({ items: [product], total_count: 1 })

      const result = await fetchMagentoProducts('https://store.com/', mockCredentials, {
        strategy: 'new_arrivals',
      })

      expect(result[0].productUrl).toBe('https://store.com/test-product')
      expect(result[0].imageUrl.replace('https://', '')).not.toContain('//')
    })
  })
})
