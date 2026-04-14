import type { Payload } from 'payload'
import { selectBanners, getWeekId } from './bannerSelector'
import { selectCategories } from './categorySelector'
import { selectProducts } from './productSelector'
import { buildCampaignEmail } from './emailBuilder'
import { createAndSendCampaign } from './klaviyoCampaignSender'

interface StoreDoc {
  id: number
  name: string
  storeUrl: string
  logoImage: { url: string } | null
  klaviyoApiKey: string
  klaviyoListId: string
}

interface CampaignTypeDoc {
  id: number
  name: string
  titleTemplate: string
  bodyCopy: any
  dayOfWeek: string
}

const DAY_MAP: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
}

export async function runDailyCampaigns(payload: Payload, dateOverride?: Date): Promise<void> {
  const now = dateOverride || new Date()
  const dayOfWeek = DAY_MAP[now.getDay()]

  // 1. Find today's campaign type
  const campaignTypeResult = await payload.find({
    collection: 'campaign-types',
    where: {
      dayOfWeek: { equals: dayOfWeek },
    },
    limit: 1,
  })

  const campaignType = campaignTypeResult.docs[0] as unknown as CampaignTypeDoc | undefined

  if (!campaignType) {
    console.log(`No campaign type configured for ${dayOfWeek}. Skipping.`)
    return
  }

  // 2. Query all stores
  const storesResult = await payload.find({
    collection: 'stores',
    limit: 100,
    depth: 1,
  })

  const stores = storesResult.docs as unknown as StoreDoc[]

  if (stores.length === 0) {
    console.log('No stores configured. Skipping.')
    return
  }

  // 3. Run pipeline for each store independently
  for (const store of stores) {
    try {
      await runStoreCampaign(payload, store, campaignType, now)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`Campaign failed for store ${store.name} (${store.id}): ${errorMessage}`)

      // Log failure
      await payload.create({
        collection: 'campaign-log',
        data: {
          date: now.toISOString(),
          store: store.id,
          campaignType: campaignType.id,
          status: 'failed',
          error: errorMessage,
        },
      })
    }
  }
}

export async function runStoreCampaign(
  payload: Payload,
  store: StoreDoc,
  campaignType: CampaignTypeDoc,
  now: Date,
): Promise<void> {
  // a. Select banners
  const banners = await selectBanners(payload, campaignType.id, store.id)

  // b. Select products
  const productBlocks = await selectProducts(payload, campaignType.id, store.id)

  // c. Select category buttons
  const categories = await selectCategories(payload, campaignType.id, store.id)

  // d. Build email HTML
  const subject = campaignType.titleTemplate.replace('{Store}', store.name)
  const bodyCopy = extractPlainText(campaignType.bodyCopy)
  const logoUrl = store.logoImage?.url
    ? `${store.storeUrl}${store.logoImage.url}`
    : ''

  const html = buildCampaignEmail({
    storeName: store.name,
    storeUrl: store.storeUrl,
    logoUrl,
    banners,
    bodyCopy,
    productBlock1: productBlocks.block1,
    productBlock2: productBlocks.block2,
    categories,
    subject,
  })

  // e. Send via Klaviyo
  const result = await createAndSendCampaign({
    apiKey: store.klaviyoApiKey,
    listId: store.klaviyoListId,
    campaignName: `${campaignType.name} - ${store.name} - ${now.toISOString().split('T')[0]}`,
    subject,
    fromEmail: `deals@${new URL(store.storeUrl).hostname}`,
    fromLabel: store.name,
    htmlContent: html,
  })

  // f. Record selections to Selection History
  const weekId = getWeekId(now)
  await payload.create({
    collection: 'selection-history',
    data: {
      week: weekId,
      campaignType: campaignType.id,
      store: store.id,
      selectedBanners: banners.map((b) => b.id),
      selectedProducts: [...productBlocks.block1, ...productBlocks.block2].map((p) => p.sku),
      selectedCategories: categories.map((c) => c.id),
    },
  })

  // g. Log success
  await payload.create({
    collection: 'campaign-log',
    data: {
      date: now.toISOString(),
      store: store.id,
      campaignType: campaignType.id,
      status: 'success',
      klaviyoCampaignId: result.campaignId,
      selectedContent: {
        banners: banners.map((b) => b.id),
        products: [...productBlocks.block1, ...productBlocks.block2].map((p) => p.sku),
        categories: categories.map((c) => c.id),
      },
    },
  })

  console.log(`Campaign sent successfully for store ${store.name}: ${result.campaignId}`)
}

export function extractPlainText(richText: any): string {
  if (!richText) return ''
  if (typeof richText === 'string') return richText

  // Handle Lexical rich text format from Payload
  if (richText.root?.children) {
    return richText.root.children
      .map((node: any) => {
        if (node.children) {
          return node.children.map((child: any) => child.text || '').join('')
        }
        return node.text || ''
      })
      .join('\n')
  }

  return ''
}

