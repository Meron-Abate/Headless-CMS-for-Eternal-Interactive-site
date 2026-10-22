import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Services } from './collections/Services'
import { Projects } from './collections/Projects'
import { Homepages } from './collections/Homepages'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Public address of this CMS, e.g. https://cms.eternalevents.com (empty in local development)
const serverURL = process.env.PAYLOAD_PUBLIC_SERVER_URL || ''

// Browser origins allowed to call the API with cookies (the admin panel is always allowed).
// Comma-separated in .env: ALLOWED_ORIGINS=https://eternalstudio.com,https://www.eternalstudio.com
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  ...(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  ...(serverURL ? [serverURL] : []),
]

if (!process.env.PAYLOAD_SECRET) {
  throw new Error('PAYLOAD_SECRET is missing. Set it in .env (use a long random string).')
}

export default buildConfig({
  serverURL,
  admin: {
    user: Users.slug,
    meta: { titleSuffix: '— Eternal CMS' },
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Projects, Services, Homepages, Media, Users],
  cors: allowedOrigins,
  csrf: allowedOrigins,
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    // Development pushes schema changes automatically; production uses migrations (see DEPLOYMENT.md).
    push: process.env.NODE_ENV !== 'production',
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  sharp,
  plugins: [],
})
