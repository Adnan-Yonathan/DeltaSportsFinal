# Database Cleanup Scripts

## cleanup-null-messages.ts

Removes messages with null or empty content from the Supabase database.

### Why is this needed?

In earlier versions of the app, empty/null assistant messages could be saved to the database. This causes errors when the chat API tries to send them to OpenAI.

### Prerequisites

1. Set up environment variables in `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### How to run

```bash
npm run cleanup:messages
```

### What it does

1. Connects to your Supabase database
2. Finds all messages where `content` is `null` or empty string
3. Displays a list of messages to be deleted
4. Deletes them from the database
5. Shows a summary of deleted messages

### Safety

- Only deletes messages with `null` or empty `content`
- Does not affect messages with valid content
- Shows what will be deleted before doing so

### After running

Your chat functionality should work normally (assuming you also have OpenAI credits).
