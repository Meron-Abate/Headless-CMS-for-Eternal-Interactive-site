import path from 'path'
import { fileURLToPath } from 'url'
import type { CollectionConfig } from 'payload'

import { anyone, authenticated } from '../shared/access'
import { rebuildAfterDelete, scheduleSiteRebuild } from '../shared/siteRebuild'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// Every size is generated as WebP; width-only resizes keep each photo's own proportions.
const webp = { format: 'webp' as const, options: { quality: 80 } }

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    group: 'Library',
    useAsTitle: 'alt',
    defaultColumns: ['filename', 'alt', 'updatedAt'],
    description: 'Images for projects, services and the homepage. Alt text is required (it is shown to screen readers and search engines).',
  },
  access: {
    read: anyone,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  upload: {
    staticDir: path.resolve(dirname, '../../media'),
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    focalPoint: true,
    adminThumbnail: 'thumbnail',
    imageSizes: [
      { name: 'thumbnail', width: 480, withoutEnlargement: true, formatOptions: webp },
      { name: 'card', width: 960, withoutEnlargement: true, formatOptions: webp },
      { name: 'hero', width: 1920, withoutEnlargement: true, formatOptions: webp },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      label: 'Alt text',
      admin: { description: 'Describe what the image shows, e.g. "Keynote speaker on the main stage at ARFSD".' },
    },
  ],
  hooks: {
    // A new upload changes nothing on the site until it is used; edits to alt text do.
    afterChange: [
      ({ doc, operation, req }) => {
        if (operation === 'update' && !req.context?.skipSiteRebuild) scheduleSiteRebuild(req.payload, 'media update')
        return doc
      },
    ],
    afterDelete: [rebuildAfterDelete],
  },
}
