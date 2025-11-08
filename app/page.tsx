import { redirect } from 'next/navigation'

export default function Home() {
  // Redirect to the chat interface
  redirect('/chat')
}
