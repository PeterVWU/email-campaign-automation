import { getPayload } from 'payload'
import config from '@payload-config'
import { selectBanners } from '@/services/bannerSelector'
import { selectCategories } from '@/services/categorySelector'
import { selectProducts } from '@/services/productSelector'
import { buildCampaignEmail } from '@/services/emailBuilder'
import { createAndSendCampaign } from '@/services/klaviyoCampaignSender'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { campaignTypeId, storeId, email } = body

    if (!campaignTypeId || !storeId || !email) {
      return Response.json(
        { error: 'Missing required fields: campaignTypeId, storeId, email' },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })

    const store = await payload.findByID({
      collection: 'stores',
      id: Number(storeId),
      depth: 1,
    })

    const campaignType = await payload.findByID({
      collection: 'campaign-types',
      id: Number(campaignTypeId),
    })

    if (!store || !campaignType) {
      return Response.json({ error: 'Store or Campaign Type not found' }, { status: 404 })
    }

    if (!store.klaviyoApiKey || !store.klaviyoListId) {
      return Response.json(
        { error: 'Store is missing Klaviyo API key or list ID' },
        { status: 400 },
      )
    }

    // Select content
    const banners = await selectBanners(payload, campaignType.id, store.id)
    const productBlocks = await selectProducts(payload, campaignType.id, store.id)
    const categories = await selectCategories(payload, campaignType.id, store.id)

    const subject = (campaignType.titleTemplate as string).replace('{Store}', store.name as string)
    const logoImage = store.logoImage as any
    const logoUrl = logoImage?.url ? `${store.storeUrl}${logoImage.url}` : ''

    const html = buildCampaignEmail({
      storeName: store.name as string,
      storeUrl: store.storeUrl as string,
      logoUrl,
      banners,
      bodyCopy: extractText(campaignType.bodyCopy),
      productBlock1: productBlocks.block1,
      productBlock2: productBlocks.block2,
      categories,
      subject,
    })

    const now = new Date()

    // Create a draft campaign targeting a single test email
    // Klaviyo doesn't have a direct "send test" API, so we create a draft
    // The user can then send it from the Klaviyo dashboard
    const result = await createAndSendCampaign(
      {
        apiKey: store.klaviyoApiKey as string,
        listId: store.klaviyoListId as string,
        campaignName: `[TEST] ${campaignType.name} - ${store.name} - ${email} - ${now.toISOString().split('T')[0]}`,
        subject: `[TEST] ${subject}`,
        fromEmail: `deals@${new URL(store.storeUrl as string).hostname}`,
        fromLabel: store.name as string,
        htmlContent: html,
      },
      { draftOnly: true },
    )

    return Response.json({
      message: `Test campaign draft created for ${email}. Open in Klaviyo to send a test.`,
      campaignId: result.campaignId,
      klaviyoUrl: `https://www.klaviyo.com/campaign/${result.campaignId}/wizard/1`,
      email,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ error: message }, { status: 500 })
  }
}

function extractText(richText: any): string {
  if (!richText) return ''
  if (typeof richText === 'string') return richText
  if (richText.root?.children) {
    return richText.root.children
      .map((node: any) => {
        if (node.children) {
          return node.children.map((child: any) => child.text || '').join('')
        }
        return node.text || ''
      })
      .join('<br>')
  }
  return ''
}
