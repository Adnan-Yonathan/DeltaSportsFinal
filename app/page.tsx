import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function Home() {
  // Redirect to the chat interface
  redirect('/chat')
}
