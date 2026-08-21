import path from 'path'
import { fileURLToPath } from 'url'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'
import sharp from 'sharp'

import { Agents } from './collections/Agents'
import { Leads } from './collections/Leads'
import { Scripts } from './collections/Scripts'
import { TelegramAccounts } from './collections/TelegramAccounts'
import { Tenants } from './collections/Tenants'
import { Users } from './collections/Users'
import { migrations } from './migrations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const serverURL = process.env.NEXT_PUBLIC_SERVER_URL || process.env.PAYLOAD_PUBLIC_SERVER_URL || ''

export default buildConfig({
  serverURL,
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      afterNavLinks: ['/components/AdminNav#AdminNav'],
    },
  },
  collections: [Users, Tenants, TelegramAccounts, Scripts, Agents, Leads],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'change-me-to-a-long-random-string',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString:
        process.env.DATABASE_URI || 'postgresql://agent:agent@localhost:5432/agent',
    },
    prodMigrations: migrations,
    push: false,
  }),
  sharp,
})
