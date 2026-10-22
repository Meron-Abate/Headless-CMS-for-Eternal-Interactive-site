import { redirect } from 'next/navigation'

// This server only hosts the CMS; the public website is the static site. Send visitors to the admin.
export default function HomePage() {
  redirect('/admin')
}
