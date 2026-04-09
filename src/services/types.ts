export interface StandardProduct {
  sku: string
  name: string
  imageUrl: string
  price: number
  salePrice: number | null
  productUrl: string
}

export type ProductSelectionStrategy =
  | 'top_sellers'
  | 'new_arrivals'
  | 'category'
  | 'clearance'
  | 'staff_picks'

export interface ProductSelectionRule {
  strategy: ProductSelectionStrategy
  categoryId?: string
  skuList?: string[]
  limit?: number
}
