import { buildCampaignEmail } from '../src/services/emailBuilder.ts'
import { writeFileSync } from 'node:fs'

const makeProduct = (sku, opts = {}) => ({
  sku,
  name: `Juice Name ${sku}`,
  imageUrl: `https://picsum.photos/seed/${sku}/544/420`,
  price: 24.99,
  salePrice: null,
  productUrl: `https://ejuices.com/p/${sku}`,
  ...opts,
})

const html = buildCampaignEmail({
  storeName: 'eJuices.com',
  storeUrl: 'https://ejuices.com',
  logoUrl: '',
  banners: [
    { id: 1, title: 'Hero', imageUrl: 'https://picsum.photos/seed/hero/1104/640' },
    { id: 2, title: 'Promo', imageUrl: 'https://picsum.photos/seed/promo/1104/320' },
  ],
  bodyCopy: '15% OFF LIQUIDS — TODAY',
  productBlock1: [makeProduct('1'), makeProduct('2', { salePrice: 19.99 }), makeProduct('3'), makeProduct('4', { salePrice: 14.99 })],
  productBlock2: [],
  categories: [
    { id: 1, categoryName: 'E-Liquids', categoryUrl: 'https://ejuices.com/e-liquids' },
    { id: 2, categoryName: 'Disposables', categoryUrl: 'https://ejuices.com/disposables' },
    { id: 3, categoryName: 'New', categoryUrl: 'https://ejuices.com/new' },
  ],
  subject: 'Clean Drops. Great Prices.',
})

writeFileSync(new URL('../.preview-builder.html', import.meta.url), html)
console.log('wrote .preview-builder.html')
