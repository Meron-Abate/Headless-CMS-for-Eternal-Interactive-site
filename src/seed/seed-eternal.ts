/**
 * Imports the Eternal Events website's existing content into Payload:
 * projects (with cover, hero and gallery images), services and the homepage selection.
 *
 * Run:  npm run seed
 * Safe to re-run: documents are matched by slug / title / original filename and updated.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload, type Payload } from 'payload'

import config from '../payload.config'
import { DEFAULT_SITE } from '../shared/options'

type ImageRef = { file: string | null; alt: string }
type SeedProject = {
  slug: string
  title: string
  year: number
  location: string
  venue: string
  client: string
  category: string
  tagline: string
  summary: string
  challenge: string
  solution: string
  approach: { title: string; description: string }[]
  info: { label: string; value: string }[]
  servicesDelivered: string[]
  cover: ImageRef
  hero: ImageRef
  gallery: ImageRef[]
  featured: boolean
  order: number
}
type SeedService = {
  title: string
  description: string
  capabilities: string[]
  ctaLabel: string
  ctaLink: string
  image: ImageRef
  order: number
}

const dirname = path.dirname(fileURLToPath(import.meta.url))
const context = { skipSiteRebuild: true }

const mediaCache = new Map<string, number | string>()

// Image paths in eternal-content.json are relative to the folder that holds both projects
const contentRoot = path.resolve(dirname, '../../..')

async function upsertMedia(payload: Payload, rawRef: ImageRef, fallbackAlt: string) {
  if (!rawRef?.file) return null
  const ref = { ...rawRef, file: path.resolve(contentRoot, rawRef.file) }
  if (!fs.existsSync(ref.file)) {
    payload.logger.warn(`image not found: ${ref.file}`)
    return null
  }
  if (mediaCache.has(ref.file)) return mediaCache.get(ref.file)!
  const alt = (ref.alt || fallbackAlt).slice(0, 250)
  const originalName = path.basename(ref.file)
  // Uploaded files are renamed when names clash, so match on the stored alt + original base name
  const existing = await payload.find({
    collection: 'media',
    where: { and: [{ alt: { equals: alt } }, { filename: { like: path.parse(originalName).name.replace(/\s+/g, '-') } }] },
    limit: 1,
    depth: 0,
  })
  let id: number | string
  if (existing.docs[0]) {
    id = existing.docs[0].id
  } else {
    const doc = await payload.create({ collection: 'media', data: { alt }, filePath: ref.file, context })
    id = doc.id
  }
  mediaCache.set(ref.file, id)
  return id
}

async function run() {
  const payload = await getPayload({ config })
  const data = JSON.parse(fs.readFileSync(path.join(dirname, 'eternal-content.json'), 'utf8')) as {
    projects: SeedProject[]
    services: SeedService[]
  }

  // Services
  const serviceIds: (number | string)[] = []
  for (const s of data.services) {
    const icon = await upsertMedia(payload, s.image, s.title)
    const fields = {
      title: s.title,
      description: s.description,
      icon,
      capabilities: s.capabilities.map((label) => ({ label })),
      ctaLabel: s.ctaLabel || 'INQUIRE THIS SERVICE',
      ctaLink: s.ctaLink || '#contact',
      site: DEFAULT_SITE,
      order: s.order,
      isFeatured: true,
      _status: 'published' as const,
    }
    const found = await payload.find({ collection: 'services', where: { title: { equals: s.title } }, limit: 1, depth: 0 })
    const doc = found.docs[0]
      ? await payload.update({ collection: 'services', id: found.docs[0].id, data: fields as never, context })
      : await payload.create({ collection: 'services', data: fields as never, context })
    serviceIds.push(doc.id)
    payload.logger.info(`service: ${s.title}`)
  }

  // Projects
  const projectIds: (number | string)[] = []
  for (const p of data.projects) {
    const cover = await upsertMedia(payload, p.hero?.file ? p.hero : p.cover, p.title)
    const cardImage = p.cover?.file && p.cover.file !== p.hero?.file ? await upsertMedia(payload, p.cover, p.title) : null
    const gallery = []
    for (const g of p.gallery) {
      const image = await upsertMedia(payload, g, `${p.title} — production photo`)
      if (image) gallery.push({ image, caption: '' })
    }
    const fields = {
      title: p.title,
      slug: p.slug,
      site: DEFAULT_SITE,
      category: p.category,
      year: p.year,
      client: p.client,
      location: p.location,
      venue: p.venue,
      tagline: p.tagline,
      summary: p.summary.replace(/^Case study:\s*/i, '').slice(0, 320),
      cover,
      cardImage,
      challenge: p.challenge,
      solution: p.solution,
      approach: p.approach,
      servicesDelivered: p.servicesDelivered.map((label) => ({ label })),
      info: p.info,
      gallery,
      featured: p.featured,
      order: p.order,
      _status: 'published' as const,
    }
    const found = await payload.find({ collection: 'projects', where: { slug: { equals: p.slug } }, limit: 1, depth: 0, draft: true })
    const doc = found.docs[0]
      ? await payload.update({ collection: 'projects', id: found.docs[0].id, data: fields as never, context })
      : await payload.create({ collection: 'projects', data: fields as never, context })
    projectIds.push(doc.id)
    payload.logger.info(`project: ${p.title}`)
  }

  // Homepage selection (in the website's current order)
  const home = {
    site: DEFAULT_SITE,
    servicesHeading: 'HOW WE CAN HELP',
    featuredServices: serviceIds,
    selectedWorkHeading: 'SELECTED WORK',
    featuredProjects: projectIds,
  }
  const foundHome = await payload.find({ collection: 'homepages', where: { site: { equals: DEFAULT_SITE } }, limit: 1, depth: 0 })
  if (foundHome.docs[0]) await payload.update({ collection: 'homepages', id: foundHome.docs[0].id, data: home as never, context })
  else await payload.create({ collection: 'homepages', data: home as never, context })

  payload.logger.info(`Seed complete: ${serviceIds.length} services, ${projectIds.length} projects, ${mediaCache.size} images.`)
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
