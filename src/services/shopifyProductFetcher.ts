import type { StandardProduct, ProductSelectionRule } from './types'

interface ShopifyCredentials {
  storeUrl: string
  accessToken: string
}

interface ShopifyProductNode {
  id: string
  title: string
  handle: string
  createdAt: string
  onlineStoreUrl: string | null
  featuredImage: {
    url: string
  } | null
  variants: {
    edges: Array<{
      node: {
        sku: string
        price: string
        compareAtPrice: string | null
      }
    }>
  }
}

interface ShopifyProductsResponse {
  data: {
    products?: {
      edges: Array<{ node: ShopifyProductNode }>
    }
    collection?: {
      products: {
        edges: Array<{ node: ShopifyProductNode }>
      }
    }
  }
  errors?: Array<{ message: string }>
  extensions?: {
    cost: {
      requestedQueryCost: number
      actualQueryCost: number
      throttleStatus: {
        maximumAvailable: number
        currentlyAvailable: number
        restoreRate: number
      }
    }
  }
}

const PRODUCT_FRAGMENT = `
  id
  title
  handle
  createdAt
  onlineStoreUrl
  featuredImage {
    url
  }
  variants(first: 1) {
    edges {
      node {
        sku
        price
        compareAtPrice
      }
    }
  }
`

async function shopifyGraphQL(
  credentials: ShopifyCredentials,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<ShopifyProductsResponse> {
  const url = `${credentials.storeUrl}/admin/api/2025-01/graphql.json`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': credentials.accessToken,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Shopify API error ${response.status}: ${errorText}`)
  }

  const result = (await response.json()) as ShopifyProductsResponse

  if (result.errors && result.errors.length > 0) {
    throw new Error(`Shopify GraphQL error: ${result.errors[0].message}`)
  }

  return result
}

function toStandardProduct(node: ShopifyProductNode, storeUrl: string): StandardProduct {
  const variant = node.variants.edges[0]?.node
  const price = variant ? parseFloat(variant.price) : 0
  const compareAtPrice = variant?.compareAtPrice ? parseFloat(variant.compareAtPrice) : null
  const salePrice = compareAtPrice && compareAtPrice > price ? price : null

  return {
    sku: variant?.sku || node.handle,
    name: node.title,
    imageUrl: node.featuredImage?.url || '',
    price: compareAtPrice && compareAtPrice > price ? compareAtPrice : price,
    salePrice,
    productUrl: node.onlineStoreUrl || `${storeUrl}/products/${node.handle}`,
  }
}

async function fetchNewArrivals(
  credentials: ShopifyCredentials,
  limit: number,
): Promise<StandardProduct[]> {
  const query = `
    query newArrivals($limit: Int!) {
      products(first: $limit, sortKey: CREATED_AT, reverse: true, query: "status:active") {
        edges {
          node { ${PRODUCT_FRAGMENT} }
        }
      }
    }
  `

  const result = await shopifyGraphQL(credentials, query, { limit })
  const edges = result.data.products?.edges || []
  return edges.map((edge) => toStandardProduct(edge.node, credentials.storeUrl))
}

async function fetchByCollection(
  credentials: ShopifyCredentials,
  collectionId: string,
  limit: number,
): Promise<StandardProduct[]> {
  const gid = collectionId.startsWith('gid://')
    ? collectionId
    : `gid://shopify/Collection/${collectionId}`

  const query = `
    query collectionProducts($id: ID!, $limit: Int!) {
      collection(id: $id) {
        products(first: $limit) {
          edges {
            node { ${PRODUCT_FRAGMENT} }
          }
        }
      }
    }
  `

  const result = await shopifyGraphQL(credentials, query, { id: gid, limit })
  const edges = result.data.collection?.products?.edges || []
  return edges.map((edge) => toStandardProduct(edge.node, credentials.storeUrl))
}

async function fetchSaleItems(
  credentials: ShopifyCredentials,
  limit: number,
): Promise<StandardProduct[]> {
  // Fetch more than needed since we filter client-side for items with compare_at_price
  const fetchLimit = limit * 3
  const query = `
    query saleProducts($limit: Int!) {
      products(first: $limit, sortKey: CREATED_AT, reverse: true, query: "status:active") {
        edges {
          node { ${PRODUCT_FRAGMENT} }
        }
      }
    }
  `

  const result = await shopifyGraphQL(credentials, query, { limit: fetchLimit })
  const edges = result.data.products?.edges || []

  return edges
    .filter((edge) => {
      const variant = edge.node.variants.edges[0]?.node
      if (!variant?.compareAtPrice) return false
      return parseFloat(variant.compareAtPrice) > parseFloat(variant.price)
    })
    .slice(0, limit)
    .map((edge) => toStandardProduct(edge.node, credentials.storeUrl))
}

async function fetchStaffPicks(
  credentials: ShopifyCredentials,
  handles: string[],
): Promise<StandardProduct[]> {
  const handleQuery = handles.map((h) => `handle:${h}`).join(' OR ')
  const query = `
    query staffPicks($limit: Int!, $query: String!) {
      products(first: $limit, query: $query) {
        edges {
          node { ${PRODUCT_FRAGMENT} }
        }
      }
    }
  `

  const result = await shopifyGraphQL(credentials, query, {
    limit: handles.length,
    query: handleQuery,
  })
  const edges = result.data.products?.edges || []
  return edges.map((edge) => toStandardProduct(edge.node, credentials.storeUrl))
}

async function fetchTopSellers(
  credentials: ShopifyCredentials,
  limit: number,
): Promise<StandardProduct[]> {
  const query = `
    query topSellers($limit: Int!) {
      products(first: $limit, sortKey: BEST_SELLING, query: "status:active") {
        edges {
          node { ${PRODUCT_FRAGMENT} }
        }
      }
    }
  `

  const result = await shopifyGraphQL(credentials, query, { limit })
  const edges = result.data.products?.edges || []
  return edges.map((edge) => toStandardProduct(edge.node, credentials.storeUrl))
}

export async function fetchShopifyProducts(
  storeUrl: string,
  credentials: ShopifyCredentials,
  rule: ProductSelectionRule,
): Promise<StandardProduct[]> {
  const limit = rule.limit || 8

  switch (rule.strategy) {
    case 'top_sellers':
      return fetchTopSellers(credentials, limit)

    case 'new_arrivals':
      return fetchNewArrivals(credentials, limit)

    case 'category':
      if (!rule.categoryId) {
        throw new Error('categoryId is required for category strategy')
      }
      return fetchByCollection(credentials, rule.categoryId, limit)

    case 'clearance':
      return fetchSaleItems(credentials, limit)

    case 'staff_picks':
      if (!rule.skuList || rule.skuList.length === 0) {
        throw new Error('skuList is required for staff_picks strategy')
      }
      return fetchStaffPicks(credentials, rule.skuList)

    default:
      throw new Error(`Unknown product selection strategy: ${rule.strategy}`)
  }
}
