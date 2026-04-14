import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAndSendCampaign } from '../../services/klaviyoCampaignSender'
import type { KlaviyoCampaignInput } from '../../services/klaviyoCampaignSender'

const defaultInput: KlaviyoCampaignInput = {
  apiKey: 'pk_test_key',
  listId: 'LIST123',
  campaignName: 'Weekly Top Sellers',
  subject: 'This Week\'s Top Sellers at Test Store',
  fromEmail: 'deals@teststore.com',
  fromLabel: 'Test Store',
  htmlContent: '<html><body>Hello</body></html>',
}

let fetchCallIndex: number
let fetchMocks: Array<{ status: number; body: any }>

function setupFetchMocks(mocks: Array<{ status: number; body: any }>) {
  fetchMocks = mocks
  fetchCallIndex = 0
  global.fetch = vi.fn().mockImplementation(() => {
    const mock = fetchMocks[fetchCallIndex++]
    return Promise.resolve({
      ok: mock.status >= 200 && mock.status < 300,
      status: mock.status,
      json: () => Promise.resolve(mock.body),
      text: () => Promise.resolve(JSON.stringify(mock.body)),
    })
  })
}

function setupSuccessfulFlow() {
  setupFetchMocks([
    // 1. Create template
    { status: 201, body: { data: { id: 'TMPL_001' } } },
    // 2. Create campaign
    {
      status: 201,
      body: {
        data: {
          id: 'CAMP_001',
          relationships: {
            'campaign-messages': {
              data: [{ type: 'campaign-message', id: 'MSG_001' }],
            },
          },
        },
      },
    },
    // 3. Assign template to message
    { status: 200, body: { data: { id: 'MSG_001' } } },
    // 4. Send campaign
    { status: 202, body: { data: { id: 'CAMP_001', attributes: { status: 'queued' } } } },
  ])
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('createAndSendCampaign', () => {
  it('returns campaignId, messageId, and templateId on success', async () => {
    setupSuccessfulFlow()

    const result = await createAndSendCampaign(defaultInput)

    expect(result.campaignId).toBe('CAMP_001')
    expect(result.messageId).toBe('MSG_001')
    expect(result.templateId).toBe('TMPL_001')
  })

  it('makes 4 API calls in correct order', async () => {
    setupSuccessfulFlow()

    await createAndSendCampaign(defaultInput)

    expect(global.fetch).toHaveBeenCalledTimes(4)

    const calls = (global.fetch as any).mock.calls

    // Call 1: Create template
    expect(calls[0][0]).toContain('/api/templates')
    expect(calls[0][1].method).toBe('POST')

    // Call 2: Create campaign
    expect(calls[1][0]).toContain('/api/campaigns')
    expect(calls[1][1].method).toBe('POST')

    // Call 3: Assign template
    expect(calls[2][0]).toContain('/api/campaign-message-assign-template')
    expect(calls[2][1].method).toBe('POST')

    // Call 4: Send
    expect(calls[3][0]).toContain('/api/campaign-send-jobs')
    expect(calls[3][1].method).toBe('POST')
  })

  describe('authentication', () => {
    it('sends Klaviyo-API-Key header on all requests', async () => {
      setupSuccessfulFlow()

      await createAndSendCampaign(defaultInput)

      const calls = (global.fetch as any).mock.calls
      for (const call of calls) {
        expect(call[1].headers.Authorization).toBe('Klaviyo-API-Key pk_test_key')
      }
    })

    it('sends correct content type on all requests', async () => {
      setupSuccessfulFlow()

      await createAndSendCampaign(defaultInput)

      const calls = (global.fetch as any).mock.calls
      for (const call of calls) {
        expect(call[1].headers['Content-Type']).toBe('application/vnd.api+json')
      }
    })

    it('sends revision header on all requests', async () => {
      setupSuccessfulFlow()

      await createAndSendCampaign(defaultInput)

      const calls = (global.fetch as any).mock.calls
      for (const call of calls) {
        expect(call[1].headers.revision).toBe('2026-01-15')
      }
    })
  })

  describe('template creation', () => {
    it('creates template with CODE editor type and HTML content', async () => {
      setupSuccessfulFlow()

      await createAndSendCampaign(defaultInput)

      const templateBody = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      expect(templateBody.data.type).toBe('template')
      expect(templateBody.data.attributes.editor_type).toBe('CODE')
      expect(templateBody.data.attributes.html).toBe('<html><body>Hello</body></html>')
      expect(templateBody.data.attributes.name).toContain('Weekly Top Sellers')
    })
  })

  describe('campaign creation', () => {
    it('creates campaign with correct audience list', async () => {
      setupSuccessfulFlow()

      await createAndSendCampaign(defaultInput)

      const campaignBody = JSON.parse((global.fetch as any).mock.calls[1][1].body)
      expect(campaignBody.data.attributes.audiences.included).toEqual(['LIST123'])
    })

    it('sets email subject and from fields', async () => {
      setupSuccessfulFlow()

      await createAndSendCampaign(defaultInput)

      const campaignBody = JSON.parse((global.fetch as any).mock.calls[1][1].body)
      const message = campaignBody.data.attributes['campaign-messages'].data[0]
      expect(message.attributes.definition.content.subject).toBe(
        "This Week's Top Sellers at Test Store",
      )
      expect(message.attributes.definition.content.from_email).toBe('deals@teststore.com')
      expect(message.attributes.definition.content.from_label).toBe('Test Store')
    })

    it('sets email channel on message definition', async () => {
      setupSuccessfulFlow()

      await createAndSendCampaign(defaultInput)

      const campaignBody = JSON.parse((global.fetch as any).mock.calls[1][1].body)
      const message = campaignBody.data.attributes['campaign-messages'].data[0]
      expect(message.attributes.definition.channel).toBe('email')
    })

    it('uses immediate send strategy', async () => {
      setupSuccessfulFlow()

      await createAndSendCampaign(defaultInput)

      const campaignBody = JSON.parse((global.fetch as any).mock.calls[1][1].body)
      expect(campaignBody.data.attributes.send_strategy.method).toBe('immediate')
    })
  })

  describe('template assignment', () => {
    it('assigns template to campaign message with correct IDs', async () => {
      setupSuccessfulFlow()

      await createAndSendCampaign(defaultInput)

      const assignBody = JSON.parse((global.fetch as any).mock.calls[2][1].body)
      expect(assignBody.data.type).toBe('campaign-message')
      expect(assignBody.data.id).toBe('MSG_001')
      expect(assignBody.data.relationships.template.data.type).toBe('template')
      expect(assignBody.data.relationships.template.data.id).toBe('TMPL_001')
    })
  })

  describe('campaign send', () => {
    it('sends campaign with correct campaign ID', async () => {
      setupSuccessfulFlow()

      await createAndSendCampaign(defaultInput)

      const sendBody = JSON.parse((global.fetch as any).mock.calls[3][1].body)
      expect(sendBody.data.type).toBe('campaign-send-job')
      expect(sendBody.data.id).toBe('CAMP_001')
    })
  })

  describe('error handling', () => {
    it('throws when template creation fails', async () => {
      setupFetchMocks([
        { status: 400, body: { errors: [{ detail: 'Invalid template' }] } },
      ])

      await expect(createAndSendCampaign(defaultInput)).rejects.toThrow('Klaviyo API error 400')
    })

    it('throws when campaign creation fails', async () => {
      setupFetchMocks([
        { status: 201, body: { data: { id: 'TMPL_001' } } },
        { status: 403, body: { errors: [{ detail: 'Forbidden' }] } },
      ])

      await expect(createAndSendCampaign(defaultInput)).rejects.toThrow('Klaviyo API error 403')
    })

    it('throws when template assignment fails', async () => {
      setupFetchMocks([
        { status: 201, body: { data: { id: 'TMPL_001' } } },
        {
          status: 201,
          body: {
            data: {
              id: 'CAMP_001',
              relationships: { 'campaign-messages': { data: [{ id: 'MSG_001' }] } },
            },
          },
        },
        { status: 500, body: { errors: [{ detail: 'Internal error' }] } },
      ])

      await expect(createAndSendCampaign(defaultInput)).rejects.toThrow('Klaviyo API error 500')
    })

    it('throws when send fails', async () => {
      setupFetchMocks([
        { status: 201, body: { data: { id: 'TMPL_001' } } },
        {
          status: 201,
          body: {
            data: {
              id: 'CAMP_001',
              relationships: { 'campaign-messages': { data: [{ id: 'MSG_001' }] } },
            },
          },
        },
        { status: 200, body: { data: { id: 'MSG_001' } } },
        { status: 429, body: { errors: [{ detail: 'Rate limited' }] } },
      ])

      await expect(createAndSendCampaign(defaultInput)).rejects.toThrow('Klaviyo API error 429')
    })
  })

  describe('draft mode', () => {
    it('skips send when draftOnly is true', async () => {
      setupSuccessfulFlow()

      await createAndSendCampaign(defaultInput, { draftOnly: true })

      // Only 3 calls: template, campaign, assign — no send
      expect(global.fetch).toHaveBeenCalledTimes(3)
      const calls = (global.fetch as any).mock.calls
      expect(calls[2][0]).toContain('/api/campaign-message-assign-template')
    })

    it('still returns campaignId and templateId in draft mode', async () => {
      setupSuccessfulFlow()

      const result = await createAndSendCampaign(defaultInput, { draftOnly: true })

      expect(result.campaignId).toBe('CAMP_001')
      expect(result.templateId).toBe('TMPL_001')
    })
  })

  describe('API base URL', () => {
    it('calls Klaviyo API at a.klaviyo.com', async () => {
      setupSuccessfulFlow()

      await createAndSendCampaign(defaultInput)

      const calls = (global.fetch as any).mock.calls
      for (const call of calls) {
        expect(call[0]).toContain('https://a.klaviyo.com')
      }
    })
  })
})
