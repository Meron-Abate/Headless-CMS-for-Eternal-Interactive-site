import { spawn } from 'node:child_process'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, Payload } from 'payload'

/**
 * Rebuilds the static website when published content changes.
 *
 * Configure ONE of these in .env:
 *   SITE_REBUILD_COMMAND      e.g. node scripts/build-from-cms.mjs   (runs on this server)
 *   SITE_REBUILD_CWD          working directory for the command (the website folder)
 *   SITE_REBUILD_WEBHOOK_URL  a URL to POST to instead (e.g. a deploy hook on another server)
 *   SITE_REBUILD_SECRET       optional bearer token sent with the webhook
 *
 * Rapid edits are debounced into one build, and builds never overlap.
 */

const DEBOUNCE_MS = Number(process.env.SITE_REBUILD_DEBOUNCE_MS || 2500)
const TIMEOUT_MS = Number(process.env.SITE_REBUILD_TIMEOUT_MS || 5 * 60 * 1000)

let timer: NodeJS.Timeout | null = null
let running = false
let queued = false
const reasons = new Set<string>()

function log(payload: Payload | undefined, level: 'info' | 'error', msg: string) {
  if (payload?.logger) payload.logger[level](`[site-rebuild] ${msg}`)
  else console[level === 'error' ? 'error' : 'log'](`[site-rebuild] ${msg}`)
}

async function runBuild(payload?: Payload): Promise<void> {
  const command = process.env.SITE_REBUILD_COMMAND
  const webhook = process.env.SITE_REBUILD_WEBHOOK_URL
  const why = [...reasons].join(', ')
  reasons.clear()

  if (!command && !webhook) {
    log(payload, 'info', `content changed (${why}) but no SITE_REBUILD_COMMAND or SITE_REBUILD_WEBHOOK_URL is set`)
    return
  }

  running = true
  const started = Date.now()
  try {
    if (webhook) {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(process.env.SITE_REBUILD_SECRET ? { authorization: `Bearer ${process.env.SITE_REBUILD_SECRET}` } : {}),
        },
        body: JSON.stringify({ reason: why }),
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) throw new Error(`webhook responded ${res.status}`)
      log(payload, 'info', `webhook accepted (${why})`)
    } else if (command) {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(command, {
          cwd: process.env.SITE_REBUILD_CWD || process.cwd(),
          shell: true,
          env: process.env,
        })
        let output = ''
        const keep = (chunk: Buffer) => {
          output = (output + chunk.toString()).slice(-4000)
        }
        child.stdout.on('data', keep)
        child.stderr.on('data', keep)
        const killer = setTimeout(() => child.kill(), TIMEOUT_MS)
        child.on('error', reject)
        child.on('close', (code) => {
          clearTimeout(killer)
          if (code === 0) {
            log(payload, 'info', `site rebuilt in ${Date.now() - started}ms (${why})`)
            resolve()
          } else {
            reject(new Error(`build exited with code ${code}\n${output}`))
          }
        })
      })
    }
  } catch (err) {
    log(payload, 'error', `rebuild failed: ${(err as Error).message}`)
  } finally {
    running = false
    if (queued) {
      queued = false
      void runBuild(payload)
    }
  }
}

export function scheduleSiteRebuild(payload: Payload | undefined, reason: string) {
  reasons.add(reason)
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    if (running) {
      queued = true
      return
    }
    void runBuild(payload)
  }, DEBOUNCE_MS)
}

/**
 * afterChange: rebuild when a published document changes, or when a document is
 * unpublished. Draft-only saves (including autosave) are ignored.
 */
export const rebuildAfterChange: CollectionAfterChangeHook = ({ collection, doc, previousDoc, req, operation }) => {
  if (req.context?.skipSiteRebuild) return doc
  const hasDrafts = Boolean(collection.versions?.drafts)
  const affectsSite =
    !hasDrafts || doc?._status === 'published' || previousDoc?._status === 'published'
  if (affectsSite) scheduleSiteRebuild(req.payload, `${collection.slug} ${operation}`)
  return doc
}

export const rebuildAfterDelete: CollectionAfterDeleteHook = ({ collection, doc, req }) => {
  if (req.context?.skipSiteRebuild) return doc
  scheduleSiteRebuild(req.payload, `${collection.slug} delete`)
  return doc
}
