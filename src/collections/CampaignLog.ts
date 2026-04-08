import type { CollectionConfig } from 'payload'

export const CampaignLog: CollectionConfig = {
  slug: 'campaign-log',
  admin: {
    useAsTitle: 'date',
    defaultColumns: ['date', 'store', 'campaignType', 'status'],
  },
  fields: [
    {
      name: 'date',
      type: 'date',
      required: true,
    },
    {
      name: 'store',
      type: 'relationship',
      relationTo: 'stores',
      required: true,
    },
    {
      name: 'campaignType',
      type: 'relationship',
      relationTo: 'campaign-types',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Success', value: 'success' },
        { label: 'Failed', value: 'failed' },
        { label: 'Pending', value: 'pending' },
      ],
      defaultValue: 'pending',
    },
    {
      name: 'klaviyoCampaignId',
      type: 'text',
      admin: {
        description: 'Campaign ID returned by Klaviyo API',
      },
    },
    {
      name: 'error',
      type: 'textarea',
      admin: {
        description: 'Error details if campaign failed',
      },
    },
    {
      name: 'selectedContent',
      type: 'json',
      admin: {
        description: 'JSON snapshot of all content selected for this campaign',
      },
    },
  ],
}
