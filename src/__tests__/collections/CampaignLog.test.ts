import { describe, it, expect } from 'vitest'
import { CampaignLog } from '../../collections/CampaignLog'

describe('CampaignLog Collection', () => {
  it('has correct slug', () => {
    expect(CampaignLog.slug).toBe('campaign-log')
  })

  it('uses date as admin title', () => {
    expect(CampaignLog.admin?.useAsTitle).toBe('date')
  })

  it('has defaultColumns configured', () => {
    expect(CampaignLog.admin?.defaultColumns).toEqual(['date', 'store', 'campaignType', 'status'])
  })

  it('has all required fields', () => {
    const fieldNames = CampaignLog.fields.map((f: any) => f.name)
    expect(fieldNames).toContain('date')
    expect(fieldNames).toContain('store')
    expect(fieldNames).toContain('campaignType')
    expect(fieldNames).toContain('status')
    expect(fieldNames).toContain('klaviyoCampaignId')
    expect(fieldNames).toContain('error')
    expect(fieldNames).toContain('selectedContent')
  })

  it('has date as required date field', () => {
    const date = CampaignLog.fields.find((f: any) => f.name === 'date') as any
    expect(date.type).toBe('date')
    expect(date.required).toBe(true)
  })

  it('has status as select with success/failed/pending options', () => {
    const status = CampaignLog.fields.find((f: any) => f.name === 'status') as any
    expect(status.type).toBe('select')
    expect(status.required).toBe(true)
    expect(status.defaultValue).toBe('pending')
    const values = status.options.map((o: any) => o.value)
    expect(values).toEqual(['success', 'failed', 'pending'])
  })

  it('has error as textarea', () => {
    const error = CampaignLog.fields.find((f: any) => f.name === 'error') as any
    expect(error.type).toBe('textarea')
  })

  it('has selectedContent as JSON', () => {
    const content = CampaignLog.fields.find((f: any) => f.name === 'selectedContent') as any
    expect(content.type).toBe('json')
  })
})
