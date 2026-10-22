import type { CollectionConfig } from 'payload'

import { authenticated, publishedOrAuthenticated } from '../shared/access'
import { DEFAULT_SITE, SITES } from '../shared/options'
import { rebuildAfterChange, rebuildAfterDelete } from '../shared/siteRebuild'

/**
 * Services shown in the homepage "How We Can Help" panels.
 * Which services appear (and their order) is chosen on the Homepage document.
 */
export const Services: CollectionConfig = {
  slug: 'services',
  admin: {
    group: 'Website',
    useAsTitle: 'title',
    defaultColumns: ['title', 'site', '_status', 'order', 'updatedAt'],
    description: 'Each service becomes one expandable panel on the homepage.',
  },
  versions: {
    drafts: true,
    maxPerDoc: 20,
  },
  defaultSort: 'order',
  access: {
    read: publishedOrAuthenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Service Title',
    },
    {
      name: 'description',
      type: 'textarea',
      required: true,
      label: 'Service Description',
    },
    {
      name: 'icon',
      type: 'upload',
      relationTo: 'media',
      required: true,
      label: 'Service Image',
      admin: { description: 'Shown in the panel preview and the expanded view. Landscape or portrait photos both work.' },
    },
    {
      name: 'capabilities',
      type: 'array',
      label: 'Capabilities',
      labels: { singular: 'Capability', plural: 'Capabilities' },
      fields: [{ name: 'label', type: 'text', required: true }],
    },
    {
      type: 'row',
      fields: [
        { name: 'ctaLabel', type: 'text', label: 'Button text', defaultValue: 'INQUIRE THIS SERVICE' },
        { name: 'ctaLink', type: 'text', label: 'Button link', defaultValue: '#contact' },
      ],
    },
    {
      name: 'site',
      type: 'select',
      options: [...SITES],
      defaultValue: DEFAULT_SITE,
      required: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
      admin: { position: 'sidebar', description: 'Lower numbers first (used when the homepage list is empty).' },
    },
    {
      name: 'isFeatured',
      type: 'checkbox',
      label: 'Show on Homepage?',
      defaultValue: true,
      admin: { position: 'sidebar', description: 'Used when no services are picked on the Homepage document.' },
    },
  ],
  hooks: {
    afterChange: [rebuildAfterChange],
    afterDelete: [rebuildAfterDelete],
  },
}
