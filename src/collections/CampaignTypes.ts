import type { CollectionConfig } from 'payload'

export const CampaignTypes: CollectionConfig = {
  slug: 'campaign-types',
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
      name: 'dayOfWeek',
      type: 'select',
      required: true,
      options: [
        { label: 'Monday', value: 'monday' },
        { label: 'Tuesday', value: 'tuesday' },
        { label: 'Wednesday', value: 'wednesday' },
        { label: 'Thursday', value: 'thursday' },
        { label: 'Friday', value: 'friday' },
        { label: 'Saturday', value: 'saturday' },
        { label: 'Sunday', value: 'sunday' },
      ],
    },
    {
      name: 'titleTemplate',
      type: 'text',
      required: true,
      admin: {
        description: 'Email subject line template. Use {Store} for store name, {Category} for category.',
      },
    },
    {
      name: 'bodyCopy',
      type: 'richText',
      admin: {
        description: 'Introductory body text for the email',
      },
    },
    {
      name: 'productSelectionRule',
      type: 'json',
      required: true,
      admin: {
        description: 'JSON defining the product selection logic (e.g., top_sellers, new_arrivals, category, clearance, staff_picks)',
      },
    },
  ],
}
