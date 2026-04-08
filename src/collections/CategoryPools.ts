import type { CollectionConfig } from 'payload'

export const CategoryPools: CollectionConfig = {
  slug: 'category-pools',
  admin: {
    useAsTitle: 'categoryName',
  },
  fields: [
    {
      name: 'categoryName',
      type: 'text',
      required: true,
      admin: {
        description: 'Display name for the category button',
      },
    },
    {
      name: 'categoryUrl',
      type: 'text',
      required: true,
      admin: {
        description: 'URL to the category page on the store',
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
  ],
}
