import { getPayload } from 'payload'
import config from '@payload-config'
import { selectBanners } from '@/services/bannerSelector'
import { selectCategories } from '@/services/categorySelector'
import { selectProducts } from '@/services/productSelector'
import { buildCampaignEmail } from '@/services/emailBuilder'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const campaignTypeId = url.searchParams.get('campaignTypeId')
  const storeId = url.searchParams.get('storeId')
  const format = url.searchParams.get('format') || 'json'

  if (!campaignTypeId || !storeId) {
    return Response.json(
      { error: 'Missing required query params: campaignTypeId, storeId' },
      { status: 400 },
    )
  }

  try {
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

    const banners = await selectBanners(payload, Number(campaignType.id), Number(store.id))
    const productBlocks = await selectProducts(payload, Number(campaignType.id), Number(store.id))
    const categories = await selectCategories(payload, Number(campaignType.id), Number(store.id))

    const subject = (campaignType.titleTemplate as string).replace('{Store}', store.name as string)

    // Build absolute base URL for local media files
    const baseUrl = new URL(request.url).origin
    const logoImage = store.logoImage as any
    const logoUrl = logoImage?.url ? `${baseUrl}${logoImage.url}` : ''

    // Make banner image URLs absolute
    const absoluteBanners = banners.map((b) => ({
      ...b,
      imageUrl: b.imageUrl.startsWith('/') ? `${baseUrl}${b.imageUrl}` : b.imageUrl,
    }))

    const html = buildCampaignEmail({
      storeName: store.name as string,
      storeUrl: store.storeUrl as string,
      logoUrl,
      banners: absoluteBanners,
      bodyCopy: extractText(campaignType.bodyCopy),
      productBlock1: productBlocks.block1,
      productBlock2: productBlocks.block2,
      categories,
      subject,
    })

    // Return raw HTML if requested
    if (format === 'html') {
      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    // Default: return JSON with HTML + metadata
    return Response.json({
      html,
      metadata: {
        subject,
        store: {
          id: store.id,
          name: store.name,
          platform: store.platform,
          storeUrl: store.storeUrl,
        },
        campaignType: {
          id: campaignType.id,
          name: campaignType.name,
          dayOfWeek: campaignType.dayOfWeek,
        },
        banners: banners.map((b) => ({ id: b.id, title: b.title, imageUrl: b.imageUrl })),
        productBlock1: productBlocks.block1.map((p) => ({
          sku: p.sku,
          name: p.name,
          price: p.price,
          salePrice: p.salePrice,
        })),
        productBlock2: productBlocks.block2.map((p) => ({
          sku: p.sku,
          name: p.name,
          price: p.price,
          salePrice: p.salePrice,
        })),
        categories: categories.map((c) => ({
          id: c.id,
          categoryName: c.categoryName,
          categoryUrl: c.categoryUrl,
        })),
      },
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
