import { describe, it, expect } from 'vitest'
import { buildCampaignEmail, escapeHtml } from '../../services/emailBuilder'
import type { EmailBuildInput } from '../../services/emailBuilder'
import type { StandardProduct } from '../../services/types'
import type { SelectedBanner } from '../../services/bannerSelector'
import type { SelectedCategory } from '../../services/categorySelector'

function makeProduct(sku: string, opts: Partial<StandardProduct> = {}): StandardProduct {
  return {
    sku,
    name: `Product ${sku}`,
    imageUrl: `https://store.com/img/${sku}.jpg`,
    price: 29.99,
    salePrice: null,
    productUrl: `https://store.com/product/${sku}`,
    ...opts,
  }
}

function makeBanner(id: number): SelectedBanner {
  return { id, title: `Banner ${id}`, imageUrl: `https://store.com/banner-${id}.jpg` }
}

function makeCategory(id: number): SelectedCategory {
  return { id, categoryName: `Category ${id}`, categoryUrl: `https://store.com/cat-${id}` }
}

function makeInput(overrides: Partial<EmailBuildInput> = {}): EmailBuildInput {
  return {
    storeName: 'Test Store',
    storeUrl: 'https://store.com',
    logoUrl: 'https://store.com/logo.png',
    banners: [makeBanner(1), makeBanner(2)],
    bodyCopy: 'Check out our latest deals!',
    productBlock1: [makeProduct('P1'), makeProduct('P2'), makeProduct('P3'), makeProduct('P4')],
    productBlock2: [makeProduct('P5'), makeProduct('P6'), makeProduct('P7'), makeProduct('P8')],
    categories: [makeCategory(1), makeCategory(2), makeCategory(3)],
    subject: 'Weekly Deals',
    ...overrides,
  }
}

describe('buildCampaignEmail', () => {
  it('returns valid HTML document', () => {
    const html = buildCampaignEmail(makeInput())
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<html')
    expect(html).toContain('</html>')
  })

  it('includes nicotine warning bar', () => {
    const html = buildCampaignEmail(makeInput())
    expect(html).toContain('WARNING: This product contains nicotine')
    expect(html).toContain('background:#0B0F14')
  })

  it('includes masthead with store name and Shop Now button', () => {
    const html = buildCampaignEmail(makeInput())
    expect(html).toContain('TEST STORE')
    expect(html).toContain('Shop Now')
    expect(html).toContain('href="https://store.com"')
  })

  it('includes lime accent rule', () => {
    const html = buildCampaignEmail(makeInput())
    expect(html).toContain('background:#A3E635')
  })

  it('includes promo row with body copy', () => {
    const html = buildCampaignEmail(makeInput())
    expect(html).toContain('Check out our latest deals!')
  })

  it('includes hero banner with image and subject', () => {
    const html = buildCampaignEmail(makeInput())
    expect(html).toContain('https://store.com/banner-1.jpg')
    expect(html).toContain('Weekly Deals')
  })

  it('includes second banner as bottom banner', () => {
    const html = buildCampaignEmail(makeInput())
    expect(html).toContain('https://store.com/banner-2.jpg')
  })

  it('includes all products from block 1', () => {
    const html = buildCampaignEmail(makeInput())
    expect(html).toContain('Product P1')
    expect(html).toContain('Product P2')
    expect(html).toContain('Product P3')
    expect(html).toContain('Product P4')
  })

  it('includes all products from block 2', () => {
    const html = buildCampaignEmail(makeInput())
    expect(html).toContain('Product P5')
    expect(html).toContain('Product P6')
    expect(html).toContain('Product P7')
    expect(html).toContain('Product P8')
  })

  it('displays product images with links', () => {
    const html = buildCampaignEmail(makeInput())
    expect(html).toContain('https://store.com/img/P1.jpg')
    expect(html).toContain('href="https://store.com/product/P1"')
  })

  it('displays Add to Cart buttons with alternating colors', () => {
    const html = buildCampaignEmail(makeInput())
    expect(html).toContain('Add to Cart')
    // Both button colors should be present
    expect(html).toContain('background:#0B0F14')
    expect(html).toContain('background:#A3E635')
  })

  it('displays Details link for products', () => {
    const html = buildCampaignEmail(makeInput())
    expect(html).toContain('Details')
  })

  it('displays regular price for non-sale products', () => {
    const html = buildCampaignEmail(makeInput({
      productBlock1: [makeProduct('REG', { price: 49.99, salePrice: null })],
      productBlock2: [],
    }))
    expect(html).toContain('$49.99')
    expect(html).not.toContain('line-through')
  })

  it('displays sale price with strikethrough original for sale products', () => {
    const html = buildCampaignEmail(makeInput({
      productBlock1: [makeProduct('SALE', { price: 49.99, salePrice: 29.99 })],
      productBlock2: [],
    }))
    expect(html).toContain('$49.99')
    expect(html).toContain('$29.99')
    expect(html).toContain('line-through')
  })

  it('includes category link buttons', () => {
    const html = buildCampaignEmail(makeInput())
    expect(html).toContain('Category 1')
    expect(html).toContain('Category 2')
    expect(html).toContain('Category 3')
    expect(html).toContain('href="https://store.com/cat-1"')
  })

  it('includes Featured Picks header', () => {
    const html = buildCampaignEmail(makeInput())
    expect(html).toContain('Featured Picks')
  })

  it('includes dark footer with store name and unsubscribe', () => {
    const html = buildCampaignEmail(makeInput())
    expect(html).toContain('TEST STORE')
    expect(html).toContain('Unsubscribe')
    expect(html).toContain('{{unsubscribe_url}}')
  })

  it('uses tables-based layout for email compatibility', () => {
    const html = buildCampaignEmail(makeInput())
    expect(html).toContain('role="presentation"')
    expect(html).toContain('cellpadding="0"')
    expect(html).toContain('cellspacing="0"')
  })

  it('sets max-width 600px for main container', () => {
    const html = buildCampaignEmail(makeInput())
    expect(html).toContain('max-width:600px')
    expect(html).toContain('width:600px')
  })

  it('includes responsive media query', () => {
    const html = buildCampaignEmail(makeInput())
    expect(html).toContain('@media screen and (max-width: 620px)')
    expect(html).toContain('.stack')
  })

  it('handles missing banners gracefully', () => {
    const html = buildCampaignEmail(makeInput({ banners: [] }))
    expect(html).toContain('<!doctype html>')
    expect(html).not.toContain('banner-1.jpg')
  })

  it('handles single banner', () => {
    const html = buildCampaignEmail(makeInput({ banners: [makeBanner(1)] }))
    expect(html).toContain('banner-1.jpg')
    expect(html).not.toContain('banner-2.jpg')
  })

  it('handles empty product blocks', () => {
    const html = buildCampaignEmail(makeInput({ productBlock1: [], productBlock2: [] }))
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('Featured Picks')
  })

  it('handles empty categories', () => {
    const html = buildCampaignEmail(makeInput({ categories: [] }))
    expect(html).toContain('<!doctype html>')
    expect(html).not.toContain('Category 1')
  })

  it('handles odd number of products in a block', () => {
    const html = buildCampaignEmail(makeInput({
      productBlock1: [makeProduct('P1'), makeProduct('P2'), makeProduct('P3')],
      productBlock2: [],
    }))
    expect(html).toContain('Product P1')
    expect(html).toContain('Product P2')
    expect(html).toContain('Product P3')
  })
})

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a&b')).toBe('a&amp;b')
  })

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
  })

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;')
  })

  it('handles strings with no special characters', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('escapes multiple special characters together', () => {
    expect(escapeHtml('<a href="url">&')).toBe('&lt;a href=&quot;url&quot;&gt;&amp;')
  })
})
