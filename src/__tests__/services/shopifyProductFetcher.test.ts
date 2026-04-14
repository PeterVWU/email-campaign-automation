import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchShopifyProducts } from '../../services/shopifyProductFetcher'

const mockCredentials = {
  storeUrl: 'https://test-store.myshopify.com',
  accessToken: 'shpat_test_token',
}

const storeUrl = 'https://test-store.myshopify.com'

function makeShopifyProduct(overrides: Record<string, any> = {}) {
  return {
    id: 'gid://shopify/Product/123',
    title: 'Test Product',
    handle: 'test-product',
    createdAt: '2026-01-01T00:00:00Z',
    onlineStoreUrl: 'https://test-store.myshopify.com/products/test-product',
    featuredImage: { url: 'https://cdn.shopify.com/test-image.jpg' },
    variants: {
      edges: [
        {
          node: {
            sku: 'SHOP-SKU-001',
            price: '29.99',
            compareAtPrice: null,
          },
        },
      ],
    },
    ...overrides,
  }
}

function mockGraphQLResponse(data: any) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data, extensions: { cost: { requestedQueryCost: 10, actualQueryCost: 8, throttleStatus: { maximumAvailable: 1000, currentlyAvailable: 992, restoreRate: 50 } } } }),
    text: () => Promise.resolve(JSON.stringify({ data })),
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('fetchShopifyProducts', () => {
  describe('new_arrivals strategy', () => {
    it('fetches products sorted by CREATED_AT', async () => {
      const products = [makeShopifyProduct(), makeShopifyProduct({ handle: 'product-2', title: 'Product 2' })]
      global.fetch = mockGraphQLResponse({
        products: { edges: products.map((node) => ({ node })) },
      })

      const result = await fetchShopifyProducts(storeUrl, mockCredentials, {
        strategy: 'new_arrivals',
        limit: 8,
      })

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Test Product')
      expect(result[0].sku).toBe('SHOP-SKU-001')
      expect(result[0].price).toBe(29.99)
      expect(result[0].salePrice).toBeNull()
      expect(result[0].imageUrl).toBe('https://cdn.shopify.com/test-image.jpg')
      expect(result[0].productUrl).toBe('https://test-store.myshopify.com/products/test-product')

      const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      expect(callBody.query).toContain('CREATED_AT')
      expect(callBody.query).toContain('reverse: true')
    })
  })

  describe('top_sellers strategy', () => {
    it('fetches products sorted by BEST_SELLING', async () => {
      const products = [makeShopifyProduct()]
      global.fetch = mockGraphQLResponse({
        products: { edges: products.map((node) => ({ node })) },
      })

      const result = await fetchShopifyProducts(storeUrl, mockCredentials, {
        strategy: 'top_sellers',
        limit: 8,
      })

      expect(result).toHaveLength(1)
      const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      expect(callBody.query).toContain('BEST_SELLING')
    })
  })

  describe('category strategy', () => {
    it('fetches products from a collection by numeric ID', async () => {
      const products = [makeShopifyProduct()]
      global.fetch = mockGraphQLResponse({
        collection: { products: { edges: products.map((node) => ({ node })) } },
      })

      const result = await fetchShopifyProducts(storeUrl, mockCredentials, {
        strategy: 'category',
        categoryId: '456',
        limit: 8,
      })

      expect(result).toHaveLength(1)
      const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      expect(callBody.variables.id).toBe('gid://shopify/Collection/456')
    })

    it('accepts full GID format for collection', async () => {
      global.fetch = mockGraphQLResponse({
        collection: { products: { edges: [] } },
      })

      await fetchShopifyProducts(storeUrl, mockCredentials, {
        strategy: 'category',
        categoryId: 'gid://shopify/Collection/789',
        limit: 4,
      })

      const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      expect(callBody.variables.id).toBe('gid://shopify/Collection/789')
    })

    it('throws if categoryId is missing', async () => {
      await expect(
        fetchShopifyProducts(storeUrl, mockCredentials, { strategy: 'category' }),
      ).rejects.toThrow('categoryId is required')
    })
  })

  describe('clearance strategy', () => {
    it('filters for products with compareAtPrice > price', async () => {
      const saleProduct = makeShopifyProduct({
        handle: 'sale-item',
        variants: {
          edges: [{ node: { sku: 'SALE-1', price: '19.99', compareAtPrice: '29.99' } }],
        },
      })
      const regularProduct = makeShopifyProduct({
        handle: 'regular',
        variants: {
          edges: [{ node: { sku: 'REG-1', price: '29.99', compareAtPrice: null } }],
        },
      })

      global.fetch = mockGraphQLResponse({
        products: { edges: [{ node: saleProduct }, { node: regularProduct }] },
      })

      const result = await fetchShopifyProducts(storeUrl, mockCredentials, {
        strategy: 'clearance',
        limit: 8,
      })

      expect(result).toHaveLength(1)
      expect(result[0].sku).toBe('SALE-1')
      expect(result[0].price).toBe(29.99)
      expect(result[0].salePrice).toBe(19.99)
    })

    it('limits results to requested limit', async () => {
      const saleProducts = Array.from({ length: 5 }, (_, i) =>
        makeShopifyProduct({
          handle: `sale-${i}`,
          variants: {
            edges: [{ node: { sku: `SALE-${i}`, price: '10.00', compareAtPrice: '20.00' } }],
          },
        }),
      )

      global.fetch = mockGraphQLResponse({
        products: { edges: saleProducts.map((node) => ({ node })) },
      })

      const result = await fetchShopifyProducts(storeUrl, mockCredentials, {
        strategy: 'clearance',
        limit: 3,
      })

      expect(result).toHaveLength(3)
    })
  })

  describe('staff_picks strategy', () => {
    it('fetches products by handles', async () => {
      const products = [
        makeShopifyProduct({ handle: 'pick-1' }),
        makeShopifyProduct({ handle: 'pick-2' }),
      ]
      global.fetch = mockGraphQLResponse({
        products: { edges: products.map((node) => ({ node })) },
      })

      const result = await fetchShopifyProducts(storeUrl, mockCredentials, {
        strategy: 'staff_picks',
        skuList: ['pick-1', 'pick-2'],
      })

      expect(result).toHaveLength(2)
      const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      expect(callBody.variables.query).toContain('handle:pick-1')
      expect(callBody.variables.query).toContain('handle:pick-2')
    })

    it('throws if skuList is missing', async () => {
      await expect(
        fetchShopifyProducts(storeUrl, mockCredentials, { strategy: 'staff_picks' }),
      ).rejects.toThrow('skuList is required')
    })

    it('throws if skuList is empty', async () => {
      await expect(
        fetchShopifyProducts(storeUrl, mockCredentials, { strategy: 'staff_picks', skuList: [] }),
      ).rejects.toThrow('skuList is required')
    })
  })

  describe('unknown strategy', () => {
    it('throws for unknown strategy', async () => {
      await expect(
        fetchShopifyProducts(storeUrl, mockCredentials, { strategy: 'unknown' as any }),
      ).rejects.toThrow('Unknown product selection strategy')
    })
  })

  describe('default limit', () => {
    it('uses limit of 8 when not specified', async () => {
      global.fetch = mockGraphQLResponse({ products: { edges: [] } })

      await fetchShopifyProducts(storeUrl, mockCredentials, { strategy: 'new_arrivals' })

      const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      expect(callBody.variables.limit).toBe(8)
    })
  })

  describe('product transformation', () => {
    it('handles product without featured image', async () => {
      const product = makeShopifyProduct({ featuredImage: null })
      global.fetch = mockGraphQLResponse({
        products: { edges: [{ node: product }] },
      })

      const result = await fetchShopifyProducts(storeUrl, mockCredentials, { strategy: 'new_arrivals' })
      expect(result[0].imageUrl).toBe('')
    })

    it('handles product without onlineStoreUrl by building from handle', async () => {
      const product = makeShopifyProduct({ onlineStoreUrl: null })
      global.fetch = mockGraphQLResponse({
        products: { edges: [{ node: product }] },
      })

      const result = await fetchShopifyProducts(storeUrl, mockCredentials, { strategy: 'new_arrivals' })
      expect(result[0].productUrl).toBe('https://test-store.myshopify.com/products/test-product')
    })

    it('uses handle as SKU when variant has no SKU', async () => {
      const product = makeShopifyProduct({
        variants: { edges: [{ node: { sku: '', price: '10.00', compareAtPrice: null } }] },
      })
      global.fetch = mockGraphQLResponse({
        products: { edges: [{ node: product }] },
      })

      const result = await fetchShopifyProducts(storeUrl, mockCredentials, { strategy: 'new_arrivals' })
      expect(result[0].sku).toBe('test-product')
    })

    it('sets price to compareAtPrice and salePrice to actual price when on sale', async () => {
      const product = makeShopifyProduct({
        variants: { edges: [{ node: { sku: 'SALE', price: '15.00', compareAtPrice: '25.00' } }] },
      })
      global.fetch = mockGraphQLResponse({
        products: { edges: [{ node: product }] },
      })

      const result = await fetchShopifyProducts(storeUrl, mockCredentials, { strategy: 'new_arrivals' })
      expect(result[0].price).toBe(25)
      expect(result[0].salePrice).toBe(15)
    })
  })

  describe('API error handling', () => {
    it('throws on non-ok HTTP response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      })

      await expect(
        fetchShopifyProducts(storeUrl, mockCredentials, { strategy: 'new_arrivals' }),
      ).rejects.toThrow('Shopify API error 401: Unauthorized')
    })

    it('throws on GraphQL errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ errors: [{ message: 'Throttled' }] }),
      })

      await expect(
        fetchShopifyProducts(storeUrl, mockCredentials, { strategy: 'new_arrivals' }),
      ).rejects.toThrow('Shopify GraphQL error: Throttled')
    })
  })

  describe('API authentication', () => {
    it('sends X-Shopify-Access-Token header', async () => {
      global.fetch = mockGraphQLResponse({ products: { edges: [] } })

      await fetchShopifyProducts(storeUrl, mockCredentials, { strategy: 'new_arrivals' })

      const callOptions = (global.fetch as any).mock.calls[0][1]
      expect(callOptions.headers['X-Shopify-Access-Token']).toBe('shpat_test_token')
      expect(callOptions.headers['Content-Type']).toBe('application/json')
    })

    it('calls correct GraphQL endpoint', async () => {
      global.fetch = mockGraphQLResponse({ products: { edges: [] } })

      await fetchShopifyProducts(storeUrl, mockCredentials, { strategy: 'new_arrivals' })

      const callUrl = (global.fetch as any).mock.calls[0][0]
      expect(callUrl).toBe('https://test-store.myshopify.com/admin/api/2025-01/graphql.json')
    })
  })
})
