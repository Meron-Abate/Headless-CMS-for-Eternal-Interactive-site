import type { Access } from 'payload'

/** Logged-in admins/editors only. */
export const authenticated: Access = ({ req: { user } }) => Boolean(user)

/** Everyone can read published documents; drafts are visible to logged-in users only. */
export const publishedOrAuthenticated: Access = ({ req: { user } }) => {
  if (user) return true
  return { _status: { equals: 'published' } }
}

/** Public read access (for collections without drafts, e.g. media and homepage settings). */
export const anyone: Access = () => true
