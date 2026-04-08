import type { CollectionConfig } from 'payload'

export const Stores: CollectionConfig = {
  slug: 'stores',
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'platform',
      type: 'select',
      required: true,
      options: [
        { label: 'Magento 2', value: 'magento2' },
        { label: 'Shopify', value: 'shopify' },
      ],
    },
    {
      name: 'storeUrl',
      type: 'text',
      required: true,
    },
    {
      name: 'logoImage',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'apiCredentials',
      type: 'group',
      fields: [
        {
          name: 'apiUrl',
          type: 'text',
          admin: {
            description: 'Base API URL for the store',
          },
        },
        {
          name: 'apiKey',
          type: 'text',
          admin: {
            description: 'API key or access token',
          },
        },
        {
          name: 'apiSecret',
          type: 'text',
          admin: {
            description: 'API secret (if applicable)',
          },
        },
      ],
    },
    {
      name: 'klaviyoApiKey',
      type: 'text',
      required: true,
    },
    {
      name: 'klaviyoListId',
      type: 'text',
      required: true,
      admin: {
        description: 'Klaviyo list or segment ID for campaign audience',
      },
    },
  ],
}
