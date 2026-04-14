const KLAVIYO_API_BASE = 'https://a.klaviyo.com'
const KLAVIYO_REVISION = '2026-01-15'

export interface KlaviyoCampaignInput {
  apiKey: string
  listId: string
  campaignName: string
  subject: string
  fromEmail: string
  fromLabel: string
  htmlContent: string
}

export interface KlaviyoCampaignResult {
  campaignId: string
  messageId: string
  templateId: string
}

async function klaviyoRequest<T>(
  apiKey: string,
  method: string,
  endpoint: string,
  body?: unknown,
): Promise<{ data: T; status: number }> {
  const response = await fetch(`${KLAVIYO_API_BASE}${endpoint}`, {
    method,
    headers: {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      'Content-Type': 'application/vnd.api+json',
      revision: KLAVIYO_REVISION,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Klaviyo API error ${response.status}: ${errorText}`)
  }

  const data = (await response.json()) as T
  return { data, status: response.status }
}

async function createTemplate(
  apiKey: string,
  name: string,
  html: string,
): Promise<string> {
  const { data } = await klaviyoRequest<any>(apiKey, 'POST', '/api/templates', {
    data: {
      type: 'template',
      attributes: {
        name,
        editor_type: 'CODE',
        html,
      },
    },
  })

  return data.data.id
}

async function createCampaign(
  apiKey: string,
  input: KlaviyoCampaignInput,
): Promise<{ campaignId: string; messageId: string }> {
  const { data } = await klaviyoRequest<any>(apiKey, 'POST', '/api/campaigns', {
    data: {
      type: 'campaign',
      attributes: {
        name: input.campaignName,
        audiences: {
          included: [input.listId],
        },
        'campaign-messages': {
          data: [
            {
              type: 'campaign-message',
              attributes: {
                definition: {
                  channel: 'email',
                  content: {
                    subject: input.subject,
                    from_email: input.fromEmail,
                    from_label: input.fromLabel,
                  },
                },
              },
            },
          ],
        },
        send_strategy: {
          method: 'immediate',
        },
      },
    },
  })

  const campaignId = data.data.id
  const messageId = data.data.relationships['campaign-messages'].data[0].id

  return { campaignId, messageId }
}

async function assignTemplateToCampaignMessage(
  apiKey: string,
  messageId: string,
  templateId: string,
): Promise<void> {
  await klaviyoRequest(apiKey, 'POST', '/api/campaign-message-assign-template', {
    data: {
      type: 'campaign-message',
      id: messageId,
      relationships: {
        template: {
          data: {
            type: 'template',
            id: templateId,
          },
        },
      },
    },
  })
}

async function sendCampaign(apiKey: string, campaignId: string): Promise<void> {
  await klaviyoRequest(apiKey, 'POST', '/api/campaign-send-jobs', {
    data: {
      type: 'campaign-send-job',
      id: campaignId,
    },
  })
}

export async function createAndSendCampaign(
  input: KlaviyoCampaignInput,
  options: { draftOnly?: boolean } = {},
): Promise<KlaviyoCampaignResult> {
  // 1. Create template with HTML content
  const templateId = await createTemplate(
    input.apiKey,
    `${input.campaignName} - Template`,
    input.htmlContent,
  )

  // 2. Create campaign with audience and email settings
  const { campaignId, messageId } = await createCampaign(input.apiKey, input)

  // 3. Assign template to campaign message
  await assignTemplateToCampaignMessage(input.apiKey, messageId, templateId)

  // 4. Trigger send (unless draft only)
  if (!options.draftOnly) {
    await sendCampaign(input.apiKey, campaignId)
  }

  return { campaignId, messageId, templateId }
}
