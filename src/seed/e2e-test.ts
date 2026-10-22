/**
 * End-to-end test of the CMS -> website workflow, through the real REST API (as the admin panel does):
 *   1. upload images  2. create a DRAFT project (must NOT appear on the site)
 *   3. publish it (site rebuilds; card in the right category, own page, sitemap)
 *   4. feature it on the homepage  5. unpublish + delete it (page removed again)
 * A temporary admin user is created for the run and removed afterwards; test content is cleaned up.
 *
 * Run (with the CMS dev server running):  npm run test:workflow
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'

import config from '../payload.config'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const CMS = (process.env.CMS_URL || 'http://localhost:3000').replace(/\/$/, '')
const SITE_DIR = path.resolve(dirname, '../..', process.env.SITE_REBUILD_CWD || '../Interative-Website-for-Event-Company')
const SLUG = 'cms-workflow-test-project'
const results: [string, boolean, string?][] = []
const check = (name: string, ok: boolean, info?: string) => {
  results.push([name, ok, info])
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`)
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const read = (rel: string) => (fs.existsSync(path.join(SITE_DIR, rel)) ? fs.readFileSync(path.join(SITE_DIR, rel), 'utf8') : '')

async function waitFor(cond: () => boolean, label: string, timeout = 90_000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (cond()) return true
    await wait(1000)
  }
  console.log(`   ...timed out waiting for: ${label}`)
  return false
}

async function main() {
  const payload = await getPayload({ config })
  const email = `workflow-test-${crypto.randomBytes(4).toString('hex')}@local.test`
  const password = crypto.randomBytes(18).toString('base64url')
  const user = await payload.create({ collection: 'users', data: { email, password } })
  const created: { media: (number | string)[]; project?: number | string } = { media: [] }
  let token = ''
  let homeId: number | string | undefined
  let homeBefore: (number | string)[] = []

  const rest = async (method: string, url: string, body?: unknown) => {
    const res = await fetch(`${CMS}/api/${url}`, {
      method,
      headers: { Authorization: `JWT ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${JSON.stringify(json).slice(0, 300)}`)
    return json
  }

  try {
    const login = await fetch(`${CMS}/api/users/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then((r) => r.json())
    token = login.token
    check('admin login via REST', Boolean(token))

    // 1. Upload two images (cover + gallery)
    const imgDir = path.join(SITE_DIR, 'assets', 'images', 'hero')
    for (const [file, alt] of [
      ['hero-slide-5.jpg', 'Workflow test cover: stage with LED wall'],
      ['hero-slide-6.jpg', 'Workflow test gallery: audience during the show'],
    ]) {
      const form = new FormData()
      form.append('file', new Blob([fs.readFileSync(path.join(imgDir, file))], { type: 'image/jpeg' }), file)
      form.append('_payload', JSON.stringify({ alt }))
      const res = await fetch(`${CMS}/api/media`, { method: 'POST', headers: { Authorization: `JWT ${token}` }, body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(`upload failed: ${JSON.stringify(json).slice(0, 300)}`)
      created.media.push(json.doc.id)
      check(`upload ${file} with alt text + WebP sizes`, Boolean(json.doc.sizes?.card?.url && json.doc.sizes?.hero?.url && json.doc.sizes?.thumbnail?.url))
    }
    const noAlt = new FormData()
    noAlt.append('file', new Blob([fs.readFileSync(path.join(imgDir, 'hero-slide-5.jpg'))], { type: 'image/jpeg' }), 'no-alt.jpg')
    const noAltRes = await fetch(`${CMS}/api/media`, { method: 'POST', headers: { Authorization: `JWT ${token}` }, body: noAlt })
    check('upload without alt text is rejected', noAltRes.status === 400)

    // 2. Create a DRAFT project
    const draft = await rest('POST', 'projects?draft=true', {
      title: 'CMS Workflow Test Project',
      category: 'concerts',
      year: 2026,
      client: 'Test Client',
      location: 'Addis Ababa, Ethiopia',
      venue: 'Millennium Hall, Addis Ababa, Ethiopia',
      tagline: 'LIVE CONCERT PRODUCTION',
      summary: 'A test project created through the CMS to verify the publishing workflow.',
      cover: created.media[0],
      challenge: 'Verify that drafts stay private.',
      solution: 'Publish from the admin panel and let the site rebuild itself.',
      approach: [{ title: 'Plan', description: 'Create the project as a draft.' }, { title: 'Publish', description: 'Click publish.' }],
      servicesDelivered: [{ label: 'Stage Lighting' }, { label: 'Line-Array Sound' }],
      info: [{ label: 'Audience', value: '3,000 guests' }],
      gallery: [{ image: created.media[1], caption: 'Audience during the show' }],
      body: {
        root: {
          type: 'root', version: 1, direction: 'ltr', format: '', indent: 0,
          children: [
            { type: 'heading', tag: 'h3', version: 1, direction: 'ltr', format: '', indent: 0, children: [{ type: 'text', text: 'Behind the scenes', version: 1, format: 0, detail: 0, mode: 'normal', style: '' }] },
            { type: 'paragraph', version: 1, direction: 'ltr', format: '', indent: 0, textFormat: 0, children: [{ type: 'text', text: 'Detailed story written in the rich text editor.', version: 1, format: 1, detail: 0, mode: 'normal', style: '' }] },
          ],
        },
      },
      _status: 'draft',
    })
    created.project = draft.doc.id
    check('draft project created (slug from title)', draft.doc.slug === SLUG, draft.doc.slug)
    const publicDraft = await fetch(`${CMS}/api/projects?where[slug][equals]=${SLUG}`).then((r) => r.json())
    check('draft is NOT visible to the public API', publicDraft.totalDocs === 0)
    await wait(6000)
    check('draft does NOT appear on the Work page', !read('work/index.html').includes(SLUG))

    // 3. Publish
    await rest('PATCH', `projects/${created.project}`, { _status: 'published' })
    const built = await waitFor(() => read('work/index.html').includes(`/work/${SLUG}/`), 'Work page rebuild')
    check('publishing triggers a rebuild: card on the Work page', built)
    const work = read('work/index.html')
    const card = work.slice(work.lastIndexOf('<article', work.indexOf(`/work/${SLUG}/`)), work.indexOf('</article>', work.indexOf(`/work/${SLUG}/`)))
    check('card is in the "Concerts" category (filter button)', card.includes('data-category="concerts"') && work.includes('data-filter="concerts">Concerts'))
    const page = read(`work/${SLUG}/index.html`)
    check('project has its own page at /work/<slug>/', page.includes('CMS WORKFLOW TEST PROJECT'))
    check('page has title, description, canonical, og:image, JSON-LD', ['<title>CMS Workflow Test Project', 'name="description"', `rel="canonical" href="https://`, 'og:image', 'application/ld+json'].every((s) => page.includes(s)))
    check('page shows gallery image with its alt text', page.includes('alt="Audience during the show"'))
    check('page shows rich-text story', page.includes('<h3>Behind the scenes</h3>') && page.includes('<strong>Detailed story'))
    check('page shows approach, services and extra facts', page.includes('approach-step-title">Publish') && page.includes('Stage Lighting, Line-Array Sound') && page.includes('3,000 guests'))
    check('sitemap lists the new page', read('sitemap.xml').includes(`/work/${SLUG}/`))
    const imgRefs = [...page.matchAll(/assets\/cms\/([^" ,]+)/g)].map((m) => decodeURIComponent(m[1]))
    check('page images were downloaded locally', imgRefs.length > 0 && imgRefs.every((f) => fs.existsSync(path.join(SITE_DIR, 'assets', 'cms', f))))

    // 4. Feature it on the homepage (first position)
    const home = (await rest('GET', 'homepages?where[site][equals]=eternal-events&depth=0')).docs[0]
    homeId = home.id
    homeBefore = home.featuredProjects || []
    await rest('PATCH', `homepages/${homeId}`, { featuredProjects: [created.project, ...homeBefore] })
    const onHome = await waitFor(() => {
      const idx = read('index.html')
      const sel = idx.slice(idx.indexOf('<!-- cms:selected-work -->'), idx.indexOf('<!-- /cms:selected-work -->'))
      return sel.indexOf(`/work/${SLUG}/`) > -1 && sel.indexOf(`/work/${SLUG}/`) < sel.indexOf('/work/', sel.indexOf(`/work/${SLUG}/`) + 5)
    }, 'homepage rebuild')
    check('featured on homepage Selected Work (first card)', onHome)

    // 5. Unpublish, then delete
    await rest('PATCH', `homepages/${homeId}`, { featuredProjects: homeBefore })
    await rest('PATCH', `projects/${created.project}`, { _status: 'draft' })
    const gone = await waitFor(() => !read('work/index.html').includes(`/work/${SLUG}/`) && !fs.existsSync(path.join(SITE_DIR, 'work', SLUG)), 'unpublish rebuild')
    check('unpublishing removes the card and the page', gone)
    check('unpublishing removes it from the homepage', !read('index.html').includes(`/work/${SLUG}/`))
  } catch (err) {
    check('workflow completed without errors', false, (err as Error).message)
  } finally {
    // Clean up test content (no rebuild needed: it is already unpublished)
    if (homeId && homeBefore.length) await payload.update({ collection: 'homepages', id: homeId, data: { featuredProjects: homeBefore } as never, context: { skipSiteRebuild: true } }).catch(() => {})
    if (created.project) await payload.delete({ collection: 'projects', id: created.project, context: { skipSiteRebuild: true } }).catch(() => {})
    for (const id of created.media) await payload.delete({ collection: 'media', id, context: { skipSiteRebuild: true } }).catch(() => {})
    await payload.delete({ collection: 'users', id: user.id }).catch(() => {})
    const failed = results.filter((r) => !r[1]).length
    console.log(`\n${results.length - failed}/${results.length} checks passed. Test user and test content removed.`)
    process.exit(failed ? 1 : 0)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
