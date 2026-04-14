import { describe, it, expect } from 'vitest'
import { Banners } from '../../collections/Banners'

describe('Banners Collection', () => {
  it('has correct slug', () => {
    expect(Banners.slug).toBe('banners')
  })

  it('uses title as admin title', () => {
    expect(Banners.admin?.useAsTitle).toBe('title')
  })

  it('has all required fields', () => {
    const fieldNames = Banners.fields.map((f: any) => f.name)
    expect(fieldNames).toContain('title')
    expect(fieldNames).toContain('image')
    expect(fieldNames).toContain('campaignType')
    expect(fieldNames).toContain('store')
    expect(fieldNames).toContain('tags')
  })

  it('has image as upload related to media', () => {
    const image = Banners.fields.find((f: any) => f.name === 'image') as any
    expect(image.type).toBe('upload')
    expect(image.relationTo).toBe('media')
    expect(image.required).toBe(true)
  })

  it('has campaignType relationship to campaign-types', () => {
    const ct = Banners.fields.find((f: any) => f.name === 'campaignType') as any
    expect(ct.type).toBe('relationship')
    expect(ct.relationTo).toBe('campaign-types')
    expect(ct.required).toBe(true)
  })

  it('has store relationship to stores', () => {
    const store = Banners.fields.find((f: any) => f.name === 'store') as any
    expect(store.type).toBe('relationship')
    expect(store.relationTo).toBe('stores')
    expect(store.required).toBe(true)
  })

  it('has tags as array of text fields', () => {
    const tags = Banners.fields.find((f: any) => f.name === 'tags') as any
    expect(tags.type).toBe('array')
    expect(tags.fields[0].name).toBe('tag')
    expect(tags.fields[0].type).toBe('text')
  })
})
