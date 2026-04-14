import type { Payload } from 'payload'
import type { StandardProduct, ProductSelectionRule } from './types'
import { fetchMagentoProducts } from './magentoProductFetcher'
import { fetchShopifyProducts } from './shopifyProductFetcher'
import { getWeekId, randomSample } from './bannerSelector'

export interface ProductBlocks {
  block1: StandardProduct[]
  block2: StandardProduct[]
}

interface StoreDoc {
  id: number
  platform: 'magento2' | 'shopify'
  storeUrl: string
  apiCredentials: {
    apiUrl: string | null
    apiKey: string | null
    apiSecret: string | null
  }
}

interface CampaignTypeDoc {
  id: number
  productSelectionRule: ProductSelectionRule
}

interface SelectionHistoryDoc {
  selectedProducts?: string[] | null
}

export async function selectProducts(
  payload: Payload,
  campaignTypeId: number,
  storeId: number,
  totalCount: number = 8,
): Promise<ProductBlocks> {
  // 1. Fetch store and campaign type
  const store = (await payload.findByID({
    collection: 'stores',
    id: storeId,
  })) as unknown as StoreDoc

  const campaignType = (await payload.findByID({
    collection: 'campaign-types',
    id: campaignTypeId,
  })) as unknown as CampaignTypeDoc

  const rule = campaignType.productSelectionRule

  // 2. Call appropriate product fetcher based on platform
  let products: StandardProduct[]

  if (store.platform === 'magento2') {
    if (!store.apiCredentials.apiUrl || !store.apiCredentials.apiKey) {
      throw new Error(`Store ${storeId} is missing Magento API credentials`)
    }
    products = await fetchMagentoProducts(
      store.storeUrl,
      { apiUrl: store.apiCredentials.apiUrl, apiKey: store.apiCredentials.apiKey },
      { ...rule, limit: totalCount * 3 },
    )
  } else if (store.platform === 'shopify') {
    if (!store.apiCredentials.apiKey) {
      throw new Error(`Store ${storeId} is missing Shopify access token`)
    }
    products = await fetchShopifyProducts(
      store.storeUrl,
      { storeUrl: store.storeUrl, accessToken: store.apiCredentials.apiKey },
      { ...rule, limit: totalCount * 3 },
    )
  } else {
    throw new Error(`Unknown store platform: ${store.platform}`)
  }

  // 3. Query last week's product selections for dedup
  const now = new Date()
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const weekId = getWeekId(oneWeekAgo)

  const historyResult = await payload.find({
    collection: 'selection-history',
    where: {
      campaignType: { equals: campaignTypeId },
      store: { equals: storeId },
      week: { equals: weekId },
    },
    limit: 1,
  })

  const lastWeekHistory = historyResult.docs[0] as unknown as SelectionHistoryDoc | undefined
  const lastWeekProductSkus = lastWeekHistory?.selectedProducts || []

  // 4. Exclude last week's products
  let availableProducts = products.filter(
    (product) => !lastWeekProductSkus.includes(product.sku),
  )

  // 5. If pool too small after exclusion, reset and log warning
  if (availableProducts.length < totalCount) {
    if (availableProducts.length < products.length) {
      console.warn(
        `Product pool too small after dedup for campaignType=${campaignTypeId}, store=${storeId}. ` +
          `Available: ${availableProducts.length}, needed: ${totalCount}. Resetting exclusion list.`,
      )
      availableProducts = products
    }
  }

  // 6. Randomly select and split into 2 blocks
  const selected = randomSample(availableProducts, Math.min(totalCount, availableProducts.length))
  const midpoint = Math.ceil(selected.length / 2)

  return {
    block1: selected.slice(0, midpoint),
    block2: selected.slice(midpoint),
  }
}
