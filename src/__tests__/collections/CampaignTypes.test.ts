import { describe, it, expect } from 'vitest'
import { CampaignTypes } from '../../collections/CampaignTypes'

describe('CampaignTypes Collection', () => {
  it('has correct slug', () => {
    expect(CampaignTypes.slug).toBe('campaign-types')
  })

  it('uses name as admin title', () => {
    expect(CampaignTypes.admin?.useAsTitle).toBe('name')
  })

  it('has all required fields', () => {
    const fieldNames = CampaignTypes.fields.map((f: any) => f.name)
    expect(fieldNames).toContain('name')
    expect(fieldNames).toContain('dayOfWeek')
    expect(fieldNames).toContain('titleTemplate')
    expect(fieldNames).toContain('bodyCopy')
    expect(fieldNames).toContain('productSelectionRule')
  })

  it('has dayOfWeek with all 7 days', () => {
    const dayField = CampaignTypes.fields.find((f: any) => f.name === 'dayOfWeek') as any
    expect(dayField.type).toBe('select')
    expect(dayField.required).toBe(true)
    const values = dayField.options.map((o: any) => o.value)
    expect(values).toEqual([
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    ])
  })

  it('has bodyCopy as richText', () => {
    const body = CampaignTypes.fields.find((f: any) => f.name === 'bodyCopy') as any
    expect(body.type).toBe('richText')
  })

  it('has productSelectionRule as JSON', () => {
    const rule = CampaignTypes.fields.find((f: any) => f.name === 'productSelectionRule') as any
    expect(rule.type).toBe('json')
    expect(rule.required).toBe(true)
  })

  it('marks name, dayOfWeek, titleTemplate, productSelectionRule as required', () => {
    const requiredFields = ['name', 'dayOfWeek', 'titleTemplate', 'productSelectionRule']
    for (const name of requiredFields) {
      const field = CampaignTypes.fields.find((f: any) => f.name === name) as any
      expect(field.required, `${name} should be required`).toBe(true)
    }
  })
})
