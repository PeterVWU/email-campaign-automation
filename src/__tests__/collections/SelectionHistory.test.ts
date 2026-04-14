import { describe, it, expect } from 'vitest'
import { SelectionHistory } from '../../collections/SelectionHistory'

describe('SelectionHistory Collection', () => {
  it('has correct slug', () => {
    expect(SelectionHistory.slug).toBe('selection-history')
  })

  it('uses week as admin title', () => {
    expect(SelectionHistory.admin?.useAsTitle).toBe('week')
  })

  it('has all required fields', () => {
    const fieldNames = SelectionHistory.fields.map((f: any) => f.name)
    expect(fieldNames).toContain('week')
    expect(fieldNames).toContain('campaignType')
    expect(fieldNames).toContain('store')
    expect(fieldNames).toContain('selectedBanners')
    expect(fieldNames).toContain('selectedProducts')
    expect(fieldNames).toContain('selectedCategories')
  })

  it('has week as required text field', () => {
    const week = SelectionHistory.fields.find((f: any) => f.name === 'week') as any
    expect(week.type).toBe('text')
    expect(week.required).toBe(true)
  })

  it('has selectedBanners, selectedProducts, selectedCategories as JSON fields', () => {
    for (const name of ['selectedBanners', 'selectedProducts', 'selectedCategories']) {
      const field = SelectionHistory.fields.find((f: any) => f.name === name) as any
      expect(field.type, `${name} should be json`).toBe('json')
    }
  })

  it('has campaignType and store as required relationships', () => {
    const ct = SelectionHistory.fields.find((f: any) => f.name === 'campaignType') as any
    expect(ct.type).toBe('relationship')
    expect(ct.relationTo).toBe('campaign-types')
    expect(ct.required).toBe(true)

    const store = SelectionHistory.fields.find((f: any) => f.name === 'store') as any
    expect(store.type).toBe('relationship')
    expect(store.relationTo).toBe('stores')
    expect(store.required).toBe(true)
  })
})
