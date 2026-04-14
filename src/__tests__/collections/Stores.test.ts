import { describe, it, expect } from 'vitest'
import { Stores } from '../../collections/Stores'

describe('Stores Collection', () => {
  it('has correct slug', () => {
    expect(Stores.slug).toBe('stores')
  })

  it('uses name as admin title', () => {
    expect(Stores.admin?.useAsTitle).toBe('name')
  })

  it('has all required fields', () => {
    const fieldNames = Stores.fields.map((f: any) => f.name)
    expect(fieldNames).toContain('name')
    expect(fieldNames).toContain('platform')
    expect(fieldNames).toContain('storeUrl')
    expect(fieldNames).toContain('logoImage')
    expect(fieldNames).toContain('apiCredentials')
    expect(fieldNames).toContain('klaviyoApiKey')
    expect(fieldNames).toContain('klaviyoListId')
  })

  it('has platform as a select with magento2 and shopify options', () => {
    const platform = Stores.fields.find((f: any) => f.name === 'platform') as any
    expect(platform.type).toBe('select')
    expect(platform.required).toBe(true)
    const values = platform.options.map((o: any) => o.value)
    expect(values).toContain('magento2')
    expect(values).toContain('shopify')
  })

  it('has logoImage as upload related to media', () => {
    const logo = Stores.fields.find((f: any) => f.name === 'logoImage') as any
    expect(logo.type).toBe('upload')
    expect(logo.relationTo).toBe('media')
  })

  it('has apiCredentials group with apiUrl, apiKey, apiSecret', () => {
    const creds = Stores.fields.find((f: any) => f.name === 'apiCredentials') as any
    expect(creds.type).toBe('group')
    const subFields = creds.fields.map((f: any) => f.name)
    expect(subFields).toContain('apiUrl')
    expect(subFields).toContain('apiKey')
    expect(subFields).toContain('apiSecret')
  })

  it('marks name, platform, storeUrl, klaviyoApiKey, klaviyoListId as required', () => {
    const requiredFields = ['name', 'platform', 'storeUrl', 'klaviyoApiKey', 'klaviyoListId']
    for (const name of requiredFields) {
      const field = Stores.fields.find((f: any) => f.name === name) as any
      expect(field.required, `${name} should be required`).toBe(true)
    }
  })
})
