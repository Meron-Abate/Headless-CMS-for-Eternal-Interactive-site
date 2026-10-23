import type { CollectionConfig, FieldHook } from 'payload'

import { authenticated, publishedOrAuthenticated } from '../shared/access'
import { DEFAULT_SITE, PROJECT_CATEGORIES, SITES, slugify } from '../shared/options'
import { rebuildAfterChange, rebuildAfterDelete } from '../shared/siteRebuild'

/** Fill the slug from the title when it is left empty, and normalise anything typed by hand. */
const formatSlug: FieldHook = ({ value, data, originalDoc }) => {
  const source = (typeof value === 'string' && value.trim()) || data?.title || originalDoc?.title || ''
  return slugify(source)
}

/**
 * Portfolio projects. Each published project gets:
 *   - a card on /work/ (filtered by category)
 *   - its own case-study page at /work/<slug>/
 *   - optionally a card in the homepage "Selected Work" gallery
 */
export const Projects: CollectionConfig = {
  slug: 'projects',
  admin: {
    group: 'Website',
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'year', '_status', 'featured', 'order'],
    listSearchableFields: ['title', 'client', 'slug'],
    description: 'Publish a project to add it to the Work page. Drafts stay private.',
    // Shows the case-study page next to the form and updates as you type (see js/cms-preview.js on the site).
    livePreview: {
      url: ({ data }) => {
        const site = (process.env.NEXT_PUBLIC_SITE_PREVIEW_URL || 'http://localhost:5500').replace(/\/$/, '')
        const cms = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
        return `${site}/preview/project/?cms=${encodeURIComponent(cms)}&id=${encodeURIComponent(String(data?.id ?? ''))}`
      },
    },
  },
  versions: {
    drafts: { autosave: false },
    maxPerDoc: 25,
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
      label: 'Project title',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'URL slug',
      admin: {
        position: 'sidebar',
        description: 'The page address: /work/<slug>/. Leave empty to create it from the title.',
      },
      hooks: { beforeValidate: [formatSlug] },
      validate: (value: unknown) =>
        typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
          ? true
          : 'Use lowercase letters, numbers and dashes only.',
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
      name: 'featured',
      type: 'checkbox',
      label: 'Feature on homepage',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Shown in "Selected Work" when no projects are picked on the Homepage document.',
      },
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
      label: 'Display order',
      admin: { position: 'sidebar', description: 'Lower numbers appear first.' },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Overview',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'category',
                  type: 'select',
                  required: true,
                  options: PROJECT_CATEGORIES,
                  admin: { width: '50%', description: 'Matches the filter buttons on the Work page.' },
                },
                { name: 'year', type: 'number', required: true, min: 1990, max: 2100, admin: { width: '50%' } },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'client', type: 'text', admin: { width: '50%' } },
                {
                  name: 'location',
                  type: 'text',
                  admin: { width: '50%', description: 'Short line shown on cards, e.g. "Addis Ababa, Ethiopia".' },
                },
              ],
            },
            {
              name: 'venue',
              type: 'text',
              admin: { description: 'Full venue shown on the case-study page (optional).' },
            },
            {
              name: 'tagline',
              type: 'text',
              admin: { description: 'Small label in the case-study hero, e.g. "EVENT SOLUTION / AV PRODUCTION".' },
            },
            {
              name: 'summary',
              type: 'textarea',
              required: true,
              maxLength: 320,
              label: 'Short description',
              admin: { description: 'One or two sentences. Used for search results and social sharing.' },
            },
            {
              name: 'cover',
              type: 'upload',
              relationTo: 'media',
              required: true,
              label: 'Cover image',
              admin: { description: 'Used as the case-study hero, and on cards unless a card image is set.' },
            },
            {
              name: 'cardImage',
              type: 'upload',
              relationTo: 'media',
              label: 'Card image (optional)',
              admin: { description: 'A different photo for the Work page and homepage cards.' },
            },
          ],
        },
        {
          label: 'Case study',
          fields: [
            { name: 'challenge', type: 'textarea', label: 'The challenge' },
            { name: 'solution', type: 'textarea', label: 'The solution' },
            {
              name: 'approach',
              type: 'array',
              label: 'Our approach (steps)',
              labels: { singular: 'Step', plural: 'Steps' },
              fields: [
                { name: 'title', type: 'text', required: true },
                { name: 'description', type: 'textarea', required: true },
              ],
            },
            {
              name: 'body',
              type: 'richText',
              label: 'Detailed case study',
              admin: { description: 'Optional longer story with headings, lists and links.' },
            },
            {
              name: 'servicesDelivered',
              type: 'array',
              label: 'Services delivered',
              labels: { singular: 'Service', plural: 'Services' },
              fields: [{ name: 'label', type: 'text', required: true }],
            },
            {
              name: 'info',
              type: 'array',
              label: 'Extra facts',
              labels: { singular: 'Fact', plural: 'Facts' },
              admin: { description: 'Shown in the project information grid, e.g. Audience, Scope.' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'label', type: 'text', required: true, admin: { width: '30%' } },
                    { name: 'value', type: 'text', required: true, admin: { width: '70%' } },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Gallery',
          fields: [
            {
              name: 'gallery',
              type: 'array',
              labels: { singular: 'Image', plural: 'Images' },
              fields: [
                { name: 'image', type: 'upload', relationTo: 'media', required: true },
                { name: 'caption', type: 'text' },
              ],
            },
          ],
        },
        {
          label: 'SEO',
          fields: [
            { name: 'metaTitle', type: 'text', admin: { description: 'Defaults to "<title> — Case Study | ETERNAL Events".' } },
            { name: 'metaDescription', type: 'textarea', maxLength: 300, admin: { description: 'Defaults to the short description.' } },
            { name: 'ogImage', type: 'upload', relationTo: 'media', label: 'Social sharing image', admin: { description: 'Defaults to the cover image.' } },
          ],
        },
      ],
    },
  ],
  hooks: {
    afterChange: [rebuildAfterChange],
    afterDelete: [rebuildAfterDelete],
  },
}
