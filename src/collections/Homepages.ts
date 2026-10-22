import type { CollectionConfig } from 'payload'

import { anyone, authenticated } from '../shared/access'
import { SITES } from '../shared/options'
import { rebuildAfterChange, rebuildAfterDelete } from '../shared/siteRebuild'

/**
 * One Homepage document per website. Pick and drag-to-reorder the services and
 * projects shown on the homepage. Leave a list empty to fall back to the
 * "Show on Homepage" / "Feature on homepage" checkboxes.
 */
export const Homepages: CollectionConfig = {
  slug: 'homepages',
  labels: { singular: 'Homepage', plural: 'Homepages' },
  admin: {
    group: 'Website',
    useAsTitle: 'site',
    defaultColumns: ['site', 'updatedAt'],
    description: 'Choose what appears in the homepage "How We Can Help" and "Selected Work" sections.',
  },
  access: {
    read: anyone,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      name: 'site',
      type: 'select',
      options: [...SITES],
      required: true,
      unique: true,
    },
    {
      type: 'collapsible',
      label: 'How We Can Help (services)',
      fields: [
        { name: 'servicesHeading', type: 'text', defaultValue: 'HOW WE CAN HELP', label: 'Section heading' },
        {
          name: 'featuredServices',
          type: 'relationship',
          relationTo: 'services',
          hasMany: true,
          label: 'Services to show (drag to reorder)',
          filterOptions: ({ data }) => ({ site: { equals: data?.site } }),
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Selected Work (projects)',
      fields: [
        { name: 'selectedWorkHeading', type: 'text', defaultValue: 'SELECTED WORK', label: 'Section heading' },
        {
          name: 'featuredProjects',
          type: 'relationship',
          relationTo: 'projects',
          hasMany: true,
          label: 'Projects to show (drag to reorder)',
          filterOptions: ({ data }) => ({ site: { equals: data?.site } }),
        },
      ],
    },
  ],
  hooks: {
    afterChange: [rebuildAfterChange],
    afterDelete: [rebuildAfterDelete],
  },
}
