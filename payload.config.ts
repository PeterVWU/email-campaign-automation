import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

import { Media } from './src/collections/Media'
import { Stores } from './src/collections/Stores'
import { CampaignTypes } from './src/collections/CampaignTypes'
import { Banners } from './src/collections/Banners'
import { CategoryPools } from './src/collections/CategoryPools'
import { SelectionHistory } from './src/collections/SelectionHistory'
import { CampaignLog } from './src/collections/CampaignLog'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  editor: lexicalEditor(),
  admin: {
    components: {
      views: {
        campaignTester: {
          path: '/campaign-tester',
          Component: '@/components/admin/CampaignTesterView#CampaignTesterView',
        },
      },
      afterNavLinks: ['@/components/admin/CampaignTesterNavLink#CampaignTesterNavLink'],
    },
  },
  collections: [
    Media,
    Stores,
    CampaignTypes,
    Banners,
    CategoryPools,
    SelectionHistory,
    CampaignLog,
  ],
  secret: process.env.PAYLOAD_SECRET || 'CHANGE-ME-IN-PRODUCTION',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
})
