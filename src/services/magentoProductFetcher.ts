import type { StandardProduct, ProductSelectionRule } from './types'

interface MagentoCredentials {
  apiUrl: string
  apiKey: string
}

interface MagentoProduct {
  sku: string
  name: string
  price: number
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
  return `${storeUrl}/media/catalog/product/placeholder/default/no-image.jpg`
}

function getCustomAttribute(product: MagentoProduct, code: string): string | undefined {
  return product.custom_attributes?.find((attr) => attr.attribute_code === code)?.value
}

function toStandardProduct(product: MagentoProduct, storeUrl: string): StandardProduct {
  const specialPrice = getCustomAttribute(product, 'special_price')
  const urlKey = getCustomAttribute(product, 'url_key')

  return {
    sku: product.sku,
    name: product.name,
    imageUrl: getProductImageUrl(product, storeUrl),
    price: product.price,
    salePrice: specialPrice ? parseFloat(specialPrice) : null,
    productUrl: `${storeUrl}/${urlKey || encodeURIComponent(product.sku)}.html`,
  }
}

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

  return data.items.map((product) => toStandardProduct(product, storeUrl))
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

  return data.items.map((product) => toStandardProduct(product, storeUrl))
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

  return data.items.map((product) => toStandardProduct(product, storeUrl))
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

  return data.items.map((product) => toStandardProduct(product, storeUrl))
}

async function fetchTopSellers(
  credentials: MagentoCredentials,
  storeUrl: string,
  limit: number,
): Promise<StandardProduct[]> {
  // Fetch recent completed orders to aggregate best sellers
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

  // Aggregate SKU quantities
  const skuQuantities = new Map<string, number>()
  for (const order of orderData.items) {
    for (const item of order.items) {
      const current = skuQuantities.get(item.sku) || 0
      skuQuantities.set(item.sku, current + item.qty_ordered)
    }
  }

  // Sort by quantity and take top SKUs
  const topSkus = Array.from(skuQuantities.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([sku]) => sku)

  if (topSkus.length === 0) {
    return []
  }

  // Fetch full product data for top SKUs
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
