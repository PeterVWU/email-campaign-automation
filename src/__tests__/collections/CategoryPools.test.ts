import { describe, it, expect } from 'vitest'
import { CategoryPools } from '../../collections/CategoryPools'

describe('CategoryPools Collection', () => {
  it('has correct slug', () => {
    expect(CategoryPools.slug).toBe('category-pools')
  })

  it('uses categoryName as admin title', () => {
    expect(CategoryPools.admin?.useAsTitle).toBe('categoryName')
  })

  it('has all required fields', () => {
    const fieldNames = CategoryPools.fields.map((f: any) => f.name)
    expect(fieldNames).toContain('categoryName')
    expect(fieldNames).toContain('categoryUrl')
    expect(fieldNames).toContain('campaignType')
    expect(fieldNames).toContain('store')
  })

  it('marks categoryName and categoryUrl as required text fields', () => {
    for (const name of ['categoryName', 'categoryUrl']) {
      const field = CategoryPools.fields.find((f: any) => f.name === name) as any
      expect(field.type).toBe('text')
      expect(field.required, `${name} should be required`).toBe(true)
    }
  })

  it('has campaignType relationship to campaign-types', () => {
    const ct = CategoryPools.fields.find((f: any) => f.name === 'campaignType') as any
    expect(ct.type).toBe('relationship')
    expect(ct.relationTo).toBe('campaign-types')
    expect(ct.required).toBe(true)
  })

  it('has store relationship to stores', () => {
    const store = CategoryPools.fields.find((f: any) => f.name === 'store') as any
    expect(store.type).toBe('relationship')
    expect(store.relationTo).toBe('stores')
    expect(store.required).toBe(true)
  })
})
