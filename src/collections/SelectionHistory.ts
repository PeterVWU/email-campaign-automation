import type { CollectionConfig } from 'payload'

export const SelectionHistory: CollectionConfig = {
  slug: 'selection-history',
  admin: {
    useAsTitle: 'week',
  },
  fields: [
    {
      name: 'week',
      type: 'text',
      required: true,
      admin: {
        description: 'Week identifier (e.g., 2026-W15)',
      },
    },
    {
      name: 'campaignType',
      type: 'relationship',
      relationTo: 'campaign-types',
      required: true,
    },
    {
      name: 'store',
      type: 'relationship',
      relationTo: 'stores',
      required: true,
    },
    {
      name: 'selectedBanners',
      type: 'json',
      admin: {
        description: 'JSON array of selected banner IDs',
      },
    },
    {
      name: 'selectedProducts',
      type: 'json',
      admin: {
        description: 'JSON array of selected product identifiers',
      },
    },
    {
      name: 'selectedCategories',
      type: 'json',
      admin: {
        description: 'JSON array of selected category pool IDs',
      },
    },
  ],
}
