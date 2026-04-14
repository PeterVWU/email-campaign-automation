import type { StandardProduct } from './types'
import type { SelectedBanner } from './bannerSelector'
import type { SelectedCategory } from './categorySelector'

export interface EmailBuildInput {
  storeName: string
  storeUrl: string
  logoUrl: string
  banners: SelectedBanner[]
  bodyCopy: string
  productBlock1: StandardProduct[]
  productBlock2: StandardProduct[]
  categories: SelectedCategory[]
  subject: string
}

export function buildCampaignEmail(input: EmailBuildInput): string {
  const {
    storeName,
    storeUrl,
    banners,
    bodyCopy,
    productBlock1,
    productBlock2,
    categories,
    subject,
  } = input

  const banner1 = banners[0]
  const banner2 = banners[1]

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(storeName)}</title>
<!--[if mso]>
<style type="text/css">
  table {border-collapse: collapse;}
</style>
<![endif]-->
<style>
  @media screen and (max-width: 620px){
    .container{ width:100% !important; }
    .px{ padding-left:16px !important; padding-right:16px !important; }
    .stack{ display:block !important; width:100% !important; }
    .gutter{ display:none !important; width:0 !important; }
    .center{ text-align:center !important; }
    .card{ margin-bottom:14px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background:#EEF2F7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF2F7;">
<tr><td align="center" style="padding:20px 12px;">

<!-- CONTAINER -->
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0"
  style="width:600px; max-width:600px; background:#FFFFFF; border:1px solid #D1D5DB; box-shadow:0 10px 26px rgba(17,24,39,0.08);">

${buildNicotineWarning()}
${buildMasthead(storeName, storeUrl)}
${buildAccentRule()}
${buildPromoRow(categories, storeUrl)}
${banner1 ? buildHeroBanner(banner1, storeUrl, subject, bodyCopy, categories) : ''}
${buildCategoryLinks(categories)}
${buildProductsHeader()}
${buildProductGrid(productBlock1)}
${banner2 ? buildBottomBanner(banner2, storeUrl) : ''}
${buildProductGrid(productBlock2)}
${buildFooter(storeName)}

</table>
<!-- /CONTAINER -->

</td></tr>
</table>
</body>
</html>`
}

function buildNicotineWarning(): string {
  return `<!-- Nicotine warning -->
<tr>
  <td style="background:#0B0F14; padding:10px 24px; font-family:Arial,sans-serif; font-size:11px; line-height:16px; color:#FFFFFF;">
    WARNING: This product contains nicotine. Nicotine is an addictive chemical.
  </td>
</tr>`
}

function buildMasthead(storeName: string, storeUrl: string): string {
  return `<!-- Masthead -->
<tr>
  <td class="px" style="padding:18px 24px; background:#FFFFFF; font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left" valign="middle" class="stack center" style="padding:0;">
          <div style="font-size:22px; line-height:26px; font-weight:900; letter-spacing:4px; color:#0B0F14;">
            ${escapeHtml(storeName.toUpperCase())}
          </div>
          <div style="font-size:11px; line-height:16px; letter-spacing:1.5px; color:#6B7280; margin-top:6px;">
            E-LIQUID &bull; DISPOSABLES &bull; HARDWARE
          </div>
        </td>
        <td align="right" valign="middle" class="stack center" style="padding:0;">
          <a href="${escapeHtml(storeUrl)}" target="_blank"
            style="display:inline-block; background:#0B0F14; color:#FFFFFF; text-decoration:none;
                   font-family:Arial,sans-serif; font-size:12px; font-weight:900; padding:10px 14px;">
            Shop Now
          </a>
        </td>
      </tr>
    </table>
  </td>
</tr>`
}

function buildAccentRule(): string {
  return `<!-- Accent rule -->
<tr>
  <td style="height:4px; background:#A3E635; line-height:4px; font-size:0;">&nbsp;</td>
</tr>`
}

function buildPromoRow(categories: SelectedCategory[], storeUrl: string): string {
  const firstCategory = categories[0]
  const ctaLabel = firstCategory ? `Shop ${firstCategory.categoryName} &rarr;` : 'Shop Now &rarr;'
  const ctaUrl = firstCategory ? firstCategory.categoryUrl : storeUrl
  return `<!-- Promo row -->
<tr>
  <td class="px" style="padding:14px 24px; background:#FFFFFF; font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left" class="stack center" style="padding:0;">
          <span style="display:inline-block; background:#F3F4F6; color:#0B0F14; font-size:12px; font-weight:900;
                       padding:8px 12px; border:1px solid #D1D5DB;">
            15% OFF LIQUIDS &mdash; TODAY
          </span>
        </td>
        <td align="right" class="stack center" style="padding:0;">
          <a href="${escapeHtml(ctaUrl)}" target="_blank"
            style="display:inline-block; background:#A3E635; color:#0B0F14; text-decoration:none;
                   font-family:Arial,sans-serif; font-size:12px; font-weight:900; padding:10px 14px;">
            ${ctaLabel}
          </a>
        </td>
      </tr>
    </table>
  </td>
</tr>`
}

function buildHeroBanner(banner: SelectedBanner, storeUrl: string, subject: string, bodyCopy: string, categories: SelectedCategory[]): string {
  const secondaryCta = categories.length > 0
    ? `<td style="width:10px;">&nbsp;</td>
              <td style="background:#FFFFFF; border:1px solid #D1D5DB;">
                <a href="${escapeHtml(categories[0].categoryUrl)}" target="_blank"
                  style="display:inline-block; padding:11px 14px; background:#FFFFFF;
                         color:#0B0F14; text-decoration:none; font-family:Arial,sans-serif; font-size:13px; font-weight:900;">
                  ${escapeHtml(categories[0].categoryName)} &rarr;
                </a>
              </td>`
    : ''

  return `<!-- Hero banner -->
<tr>
  <td class="px" style="padding:0 24px 18px; background:#FFFFFF;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="border:1px solid #D1D5DB; background:#FFFFFF;">
      <tr>
        <td align="center" valign="middle" style="background:#F3F4F6;">
          <a href="${escapeHtml(storeUrl)}" target="_blank" style="text-decoration:none;">
            <img src="${escapeHtml(banner.imageUrl)}" alt="${escapeHtml(banner.title || '')}" width="552"
              style="display:block; width:100%; max-width:552px; height:auto; border:0;">
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 16px 16px; font-family:Arial,sans-serif;">
          <div style="font-size:18px; line-height:24px; font-weight:900; color:#0B0F14;">
            ${escapeHtml(subject)}
          </div>
          <div style="font-size:13px; line-height:20px; color:#6B7280; margin-top:6px;">
            ${bodyCopy || 'Handpicked products at great prices.'}
          </div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
            <tr>
              <td style="background:#0B0F14;">
                <a href="${escapeHtml(storeUrl)}" target="_blank"
                  style="display:inline-block; padding:11px 14px; background:#0B0F14;
                         color:#FFFFFF; text-decoration:none; font-family:Arial,sans-serif; font-size:13px; font-weight:900;">
                  Shop Now &rarr;
                </a>
              </td>
              ${secondaryCta}
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </td>
</tr>`
}

function buildCategoryLinks(categories: SelectedCategory[]): string {
  if (categories.length === 0) return ''

  const cells = categories
    .map(
      (cat, i) => {
        const paddingStyle = i === 0
          ? 'padding-right:10px;'
          : i === categories.length - 1
            ? 'padding-left:10px;'
            : 'padding:0 5px;'
        return `<td class="stack card" width="${Math.floor(100 / categories.length)}%" style="${paddingStyle}">
            <a href="${escapeHtml(cat.categoryUrl)}" target="_blank"
              style="display:block; border:1px solid #D1D5DB; background:#FFFFFF; padding:14px;
                     text-decoration:none; font-weight:900; color:#0B0F14; font-family:Arial,sans-serif; font-size:13px;">
              ${escapeHtml(cat.categoryName)} &rarr;
            </a>
          </td>`
      },
    )
    .join('\n        ')

  return `<!-- Category links -->
<tr>
  <td class="px" style="padding:0 24px 18px; background:#FFFFFF; font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        ${cells}
      </tr>
    </table>
  </td>
</tr>`
}

function buildProductsHeader(): string {
  return `<!-- Products header -->
<tr>
  <td class="px" style="padding:0 24px 10px; background:#FFFFFF; font-family:Arial,sans-serif;">
    <div style="font-size:16px; font-weight:900; color:#0B0F14;">Featured Picks</div>
    <div style="font-size:13px; line-height:20px; color:#6B7280; margin-top:4px;">Four quick adds.</div>
  </td>
</tr>`
}

function buildProductGrid(products: StandardProduct[]): string {
  if (products.length === 0) return ''

  const rows: string[] = []
  for (let i = 0; i < products.length; i += 2) {
    const p1 = products[i]
    const p2 = products[i + 1]
    const isEvenRow = (i / 2) % 2 === 0
    rows.push(buildProductRow(p1, p2, isEvenRow))
    if (i + 2 < products.length) {
      rows.push(`<tr><td colspan="3" style="height:16px; line-height:16px; font-size:0;">&nbsp;</td></tr>`)
    }
  }

  return `<!-- Product grid -->
<tr>
  <td class="px" style="padding:0 24px 22px; background:#FFFFFF;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${rows.join('\n      ')}
    </table>
  </td>
</tr>`
}

function buildProductRow(product1: StandardProduct, product2: StandardProduct | undefined, isEvenRow: boolean): string {
  const card1Bg = isEvenRow ? '#0B0F14' : '#A3E635'
  const card1Color = isEvenRow ? '#FFFFFF' : '#0B0F14'
  const card2Bg = isEvenRow ? '#A3E635' : '#0B0F14'
  const card2Color = isEvenRow ? '#0B0F14' : '#FFFFFF'

  return `<tr>
      ${buildProductCard(product1, card1Bg, card1Color)}
      <td class="gutter" width="16" style="font-size:0; line-height:0;">&nbsp;</td>
      ${product2 ? buildProductCard(product2, card2Bg, card2Color) : '<td class="stack" width="272" valign="top">&nbsp;</td>'}
    </tr>`
}

function buildProductCard(product: StandardProduct, buttonBg: string, buttonColor: string): string {
  const priceHtml = product.salePrice
    ? `<span style="text-decoration:line-through; color:#9CA3AF; font-size:12px;">$${product.price.toFixed(2)}</span>
       <span style="font-size:14px; font-weight:900; color:#0B0F14; margin-left:4px;">$${product.salePrice.toFixed(2)}</span>`
    : `<span style="font-size:14px; font-weight:900; color:#0B0F14;">$${product.price.toFixed(2)}</span>`

  const { title, subtitle } = splitProductName(product.name)
  const subtitleHtml = subtitle
    ? `<div style="font-size:12px; color:#6B7280; margin-top:6px;">${escapeHtml(subtitle)}</div>`
    : ''
  return `<td class="stack" width="272" valign="top" style="border:1px solid #D1D5DB; background:#FFFFFF;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" valign="middle" height="210" style="height:210px; background:#F3F4F6; overflow:hidden;">
              <a href="${escapeHtml(product.productUrl)}" target="_blank" style="text-decoration:none; display:block; line-height:0;">
                <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}"
                  style="display:block; width:100%; max-width:272px; height:210px; object-fit:cover; border:0;">
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:14px; font-family:Arial,sans-serif;">
              <div style="font-size:14px; font-weight:900; color:#0B0F14;">${escapeHtml(title)}</div>
              ${subtitleHtml}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;">
                <tr>
                  <td>${priceHtml}</td>
                  <td align="right">
                    <a href="${escapeHtml(product.productUrl)}" target="_blank"
                      style="font:900 12px Arial; color:#0B0F14; text-decoration:none;">Details &rarr;</a>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
                <tr>
                  <td style="background:${buttonBg};">
                    <a href="${escapeHtml(product.productUrl)}" target="_blank"
                      style="display:block; width:100%; box-sizing:border-box; padding:11px 12px;
                             background:${buttonBg}; text-align:center; font:900 13px Arial;
                             color:${buttonColor}; text-decoration:none;">
                      Add to Cart
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>`
}

function buildBottomBanner(banner: SelectedBanner, storeUrl: string): string {
  return `<!-- Bottom banner -->
<tr>
  <td class="px" style="padding:0 24px 18px; background:#FFFFFF;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="border:1px solid #D1D5DB; overflow:hidden;">
      <tr>
        <td align="center" valign="middle">
          <a href="${escapeHtml(storeUrl)}" target="_blank" style="text-decoration:none;">
            <img src="${escapeHtml(banner.imageUrl)}" alt="${escapeHtml(banner.title || '')}" width="552"
              style="display:block; width:100%; max-width:552px; height:auto; border:0;">
          </a>
        </td>
      </tr>
    </table>
  </td>
</tr>`
}

function buildFooter(storeName: string): string {
  return `<!-- Footer -->
<tr>
  <td style="background:#0B0F14; padding:18px 24px; font-family:Arial,sans-serif;">
    <div style="font-size:12px; line-height:18px; font-weight:900; color:#FFFFFF;">${escapeHtml(storeName.toUpperCase())}</div>
    <div style="font-size:11px; line-height:16px; color:#9CA3AF; margin-top:6px;">
      Support &bull; Shipping &bull; Returns &bull; <a href="{{unsubscribe_url}}" style="color:#A3E635; text-decoration:none;">Unsubscribe</a>
    </div>
    <div style="font-size:11px; line-height:16px; color:#9CA3AF; margin-top:10px;">
      Age-restricted products. Verify local laws before purchase.
    </div>
  </td>
</tr>`
}

export function splitProductName(name: string): { title: string; subtitle: string } {
  const dashIndex = name.indexOf(' - ')
  if (dashIndex === -1) {
    const singleDash = name.indexOf('-')
    if (singleDash === -1) return { title: name.trim(), subtitle: '' }
    return {
      title: name.substring(0, singleDash).trim(),
      subtitle: name.substring(singleDash + 1).trim(),
    }
  }
  return {
    title: name.substring(0, dashIndex).trim(),
    subtitle: name.substring(dashIndex + 3).trim(),
  }
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
