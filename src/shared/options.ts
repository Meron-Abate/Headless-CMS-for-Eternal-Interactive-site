/**
 * Options shared across collections.
 *
 * SITES: every website managed from this CMS. Add a new entry to manage another site.
 * PROJECT_CATEGORIES: values + labels used by the Work page filter buttons.
 */

export const SITES = [{ label: 'Eternal Events', value: 'eternal-events' }] as const

export const DEFAULT_SITE = SITES[0].value

export const PROJECT_CATEGORIES = [
  { label: 'Corporate Events', value: 'corporate-events' },
  { label: 'International Conferences', value: 'international-conferences' },
  { label: 'Concerts', value: 'concerts' },
  { label: 'Private Events', value: 'private-events' },
  { label: 'Cultural Events', value: 'cultural-events' },
]

export const slugify = (value: string): string =>
  value
    .toString()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
