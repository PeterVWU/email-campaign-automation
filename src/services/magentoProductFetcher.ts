import type { StandardProduct, ProductSelectionRule } from './types'

interface MagentoCredentials {
  apiUrl: string
  apiKey: string
}

interface MagentoProduct {
  sku: string
  name: string
  price: number
  type_id: string
  created_at: string
  media_gallery_entries?: Array<{
    file: string
    types: string[]
  }>
  custom_attributes?: Array<{
    attribute_code: string
    value: string
  }>
}

interface MagentoProductResponse {
  items: MagentoProduct[]
  total_count: number
}

interface MagentoOrderItem {
  sku: string
  qty_ordered: number
}

interface MagentoOrder {
  items: Array<{
    items: MagentoOrderItem[]
  }>
}

interface ParentInfo {
  urlKey: string | null
  imageUrl: string | null
}

function buildSearchCriteriaParams(params: {
  filters?: Array<{ field: string; value: string; conditionType: string }>
  sortOrders?: Array<{ field: string; direction: 'ASC' | 'DESC' }>
  pageSize?: number
  currentPage?: number
}): URLSearchParams {
  const searchParams = new URLSearchParams()

  if (params.filters) {
    params.filters.forEach((filter, index) => {
      searchParams.set(`searchCriteria[filterGroups][${index}][filters][0][field]`, filter.field)
      searchParams.set(`searchCriteria[filterGroups][${index}][filters][0][value]`, filter.value)
      searchParams.set(
        `searchCriteria[filterGroups][${index}][filters][0][conditionType]`,
        filter.conditionType,
      )
    })
  }

  if (params.sortOrders) {
    params.sortOrders.forEach((sort, index) => {
      searchParams.set(`searchCriteria[sortOrders][${index}][field]`, sort.field)
      searchParams.set(`searchCriteria[sortOrders][${index}][direction]`, sort.direction)
    })
  }

  if (params.pageSize) {
    searchParams.set('searchCriteria[pageSize]', String(params.pageSize))
  }

  if (params.currentPage) {
    searchParams.set('searchCriteria[currentPage]', String(params.currentPage))
  }

  return searchParams
}

async function magentoRequest<T>(
  credentials: MagentoCredentials,
  endpoint: string,
  searchParams?: URLSearchParams,
): Promise<T> {
  const url = new URL(endpoint, credentials.apiUrl)
  if (searchParams) {
    url.search = searchParams.toString()
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${credentials.apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Magento API error ${response.status}: ${errorText}`)
  }

  return response.json() as Promise<T>
}

function getProductImageUrl(product: MagentoProduct, storeUrl: string): string {
  const imageEntry = product.media_gallery_entries?.find((entry) => entry.types.includes('image'))
  if (imageEntry) {
    return `${storeUrl}/media/catalog/product${imageEntry.file}`
  }
  return ''
}

function hasValidImage(product: MagentoProduct): boolean {
  return !!product.media_gallery_entries?.some((entry) => entry.types.includes('image'))
}

function getCustomAttribute(product: MagentoProduct, code: string): string | undefined {
  return product.custom_attributes?.find((attr) => attr.attribute_code === code)?.value
}

export function getParentProductName(variantName: string): string {
  const dashIndex = variantName.indexOf('-')
  if (dashIndex === -1) return variantName.trim()
  return variantName.substring(0, dashIndex).trim()
}

async function resolveParent(
  credentials: MagentoCredentials,
  parentName: string,
  storeUrl: string,
  cache: Map<string, ParentInfo | null>,
): Promise<ParentInfo | null> {
  if (cache.has(parentName)) return cache.get(parentName)!

  const params = buildSearchCriteriaParams({
    filters: [
      { field: 'name', value: parentName, conditionType: 'eq' },
      { field: 'type_id', value: 'configurable', conditionType: 'eq' },
    ],
    pageSize: 1,
  })

  try {
    const data = await magentoRequest<MagentoProductResponse>(
      credentials,
      '/rest/V1/products',
      params,
    )

    if (data.items.length > 0) {
      const parent = data.items[0]
      const info: ParentInfo = {
        urlKey: getCustomAttribute(parent, 'url_key') || null,
        imageUrl: getProductImageUrl(parent, storeUrl),
      }
      cache.set(parentName, info)
      return info
    }
  } catch {
    // Ignore lookup failures — fall back to variant data
  }

  cache.set(parentName, null)
  return null
}

async function resolveProducts(
  credentials: MagentoCredentials,
  products: MagentoProduct[],
  storeUrl: string,
): Promise<StandardProduct[]> {
  const baseUrl = storeUrl.replace(/\/+$/, '')
  const parentCache = new Map<string, ParentInfo | null>()
  const placeholderUrl = `${baseUrl}/media/catalog/product/placeholder/default/no-image.jpg`

  const results: StandardProduct[] = []

  for (const product of products) {
    const specialPrice = getCustomAttribute(product, 'special_price')
    const variantUrlKey = getCustomAttribute(product, 'url_key')
    let productUrl: string
    let imageUrl = getProductImageUrl(product, baseUrl)

    if (product.type_id === 'configurable') {
      productUrl = `${baseUrl}/${variantUrlKey || encodeURIComponent(product.sku)}`
    } else {
      // Simple product — resolve parent for URL and fallback image
      const parentName = getParentProductName(product.name)
      const parentInfo = await resolveParent(credentials, parentName, baseUrl, parentCache)

      if (parentInfo?.urlKey) {
        productUrl = `${baseUrl}/${parentInfo.urlKey}`
      } else {
        productUrl = `${baseUrl}/${variantUrlKey || encodeURIComponent(product.sku)}`
      }

      // If variant has no image, use parent's image
      if (!imageUrl && parentInfo?.imageUrl) {
        imageUrl = parentInfo.imageUrl
      }
    }

    // Final fallback to placeholder
    if (!imageUrl) {
      imageUrl = placeholderUrl
    }

    results.push({
      sku: product.sku,
      name: product.name,
      imageUrl,
      price: product.price,
      salePrice: specialPrice ? parseFloat(specialPrice) : null,
      productUrl,
    })
  }

  return results
}

// Note: Stock filtering is handled by Magento's visibility settings.
// Products with visibility=4 (catalog+search) are typically in-stock.

async function fetchNewArrivals(
  credentials: MagentoCredentials,
  storeUrl: string,
  limit: number,
): Promise<StandardProduct[]> {
  const params = buildSearchCriteriaParams({
    filters: [
      { field: 'status', value: '1', conditionType: 'eq' },
      { field: 'visibility', value: '4', conditionType: 'eq' },
    ],
    sortOrders: [{ field: 'created_at', direction: 'DESC' }],
    pageSize: limit,
  })

  const data = await magentoRequest<MagentoProductResponse>(
    credentials,
    '/rest/V1/products',
    params,
  )

  return resolveProducts(credentials, data.items, storeUrl)
}

async function fetchByCategory(
  credentials: MagentoCredentials,
  storeUrl: string,
  categoryId: string,
  limit: number,
): Promise<StandardProduct[]> {
  const params = buildSearchCriteriaParams({
    filters: [
      { field: 'category_id', value: categoryId, conditionType: 'eq' },
      { field: 'status', value: '1', conditionType: 'eq' },
      { field: 'visibility', value: '4', conditionType: 'eq' },
    ],
    pageSize: limit,
  })

  const data = await magentoRequest<MagentoProductResponse>(
    credentials,
    '/rest/V1/products',
    params,
  )

  return resolveProducts(credentials, data.items, storeUrl)
}

async function fetchClearance(
  credentials: MagentoCredentials,
  storeUrl: string,
  limit: number,
): Promise<StandardProduct[]> {
  const params = buildSearchCriteriaParams({
    filters: [
      { field: 'special_price', value: '0', conditionType: 'gt' },
      { field: 'status', value: '1', conditionType: 'eq' },
      { field: 'visibility', value: '4', conditionType: 'eq' },
    ],
    sortOrders: [{ field: 'created_at', direction: 'DESC' }],
    pageSize: limit,
  })

  const data = await magentoRequest<MagentoProductResponse>(
    credentials,
    '/rest/V1/products',
    params,
  )

  return resolveProducts(credentials, data.items, storeUrl)
}

async function fetchStaffPicks(
  credentials: MagentoCredentials,
  storeUrl: string,
  skuList: string[],
): Promise<StandardProduct[]> {
  const params = buildSearchCriteriaParams({
    filters: [
      { field: 'sku', value: skuList.join(','), conditionType: 'in' },
      { field: 'status', value: '1', conditionType: 'eq' },
    ],
    pageSize: skuList.length,
  })

  const data = await magentoRequest<MagentoProductResponse>(
    credentials,
    '/rest/V1/products',
    params,
  )

  return resolveProducts(credentials, data.items, storeUrl)
}

async function fetchTopSellers(
  credentials: MagentoCredentials,
  storeUrl: string,
  limit: number,
): Promise<StandardProduct[]> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const dateStr = thirtyDaysAgo.toISOString().split('T')[0]

  const orderParams = buildSearchCriteriaParams({
    filters: [
      { field: 'status', value: 'complete', conditionType: 'eq' },
      { field: 'created_at', value: dateStr, conditionType: 'gteq' },
    ],
    pageSize: 100,
  })

  const orderData = await magentoRequest<MagentoOrder>(
    credentials,
    '/rest/V1/orders',
    orderParams,
  )

  const skuQuantities = new Map<string, number>()
  for (const order of orderData.items) {
    for (const item of order.items) {
      const current = skuQuantities.get(item.sku) || 0
      skuQuantities.set(item.sku, current + item.qty_ordered)
    }
  }

  const topSkus = Array.from(skuQuantities.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([sku]) => sku)

  if (topSkus.length === 0) {
    return []
  }

  return fetchStaffPicks(credentials, storeUrl, topSkus)
}

export async function fetchMagentoProducts(
  storeUrl: string,
  credentials: MagentoCredentials,
  rule: ProductSelectionRule,
): Promise<StandardProduct[]> {
  const limit = rule.limit || 8

  switch (rule.strategy) {
    case 'top_sellers':
      return fetchTopSellers(credentials, storeUrl, limit)

    case 'new_arrivals':
      return fetchNewArrivals(credentials, storeUrl, limit)

    case 'category':
      if (!rule.categoryId) {
        throw new Error('categoryId is required for category strategy')
      }
      return fetchByCategory(credentials, storeUrl, rule.categoryId, limit)

    case 'clearance':
      return fetchClearance(credentials, storeUrl, limit)

    case 'staff_picks':
      if (!rule.skuList || rule.skuList.length === 0) {
        throw new Error('skuList is required for staff_picks strategy')
      }
      return fetchStaffPicks(credentials, storeUrl, rule.skuList)

    default:
      throw new Error(`Unknown product selection strategy: ${rule.strategy}`)
  }
}
