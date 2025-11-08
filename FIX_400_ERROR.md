# Fix 400 Bad Request Error - Supabase Auth

## The Error You're Seeing

```
Failed to load resource: the server responded with a status of 400 ()
grant_type=password
```

This means Supabase is rejecting the authentication request. Here's how to fix it:

---

## 🔧 Quick Fix Steps

### Step 1: Verify Your Environment Variables

Open `.env.local` and check the format:

```bash
# CORRECT FORMAT:
NEXT_PUBLIC_SUPABASE_URL=https://btcrlsrfmzlveticpavv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# WRONG (Missing NEXT_PUBLIC_ prefix):
SUPABASE_URL=https://btcrlsrfmzlveticpavv.supabase.co  ❌

# WRONG (Not a valid URL):
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here  ❌
```

### Step 2: Get Fresh Credentials from Supabase

1. Go to [app.supabase.com](https://app.supabase.com)
2. Select your project
3. Click **Settings** (gear icon) → **API**
4. Copy these values:

**Project URL:**
```
https://btcrlsrfmzlveticpavv.supabase.co
```

**anon public key:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0Y3Jsc3JmbXpsdmV0aWNwYXZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzEwMzE4MjcsImV4cCI6MjA0NjYwNzgyN30...
```

### Step 3: Update `.env.local`

Replace the values in your `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://btcrlsrfmzlveticpavv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....(your actual key)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....(your actual key)
OPENAI_API_KEY=sk-...
ODDS_API_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Step 4: Restart Development Server

```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 5: Enable Email Auth in Supabase

1. Go to Supabase Dashboard
2. **Authentication** → **Providers**
3. Find **Email** provider
4. Click to expand
5. Toggle **Enable Email provider** to ON
6. Click **Save**

### Step 6: Configure Auth Settings

1. **Authentication** → **Settings**
2. Find **Site URL** and set to: `http://localhost:3000`
3. Find **Redirect URLs** and add: `http://localhost:3000/auth/callback`
4. For development, toggle OFF **Enable email confirmations**
5. Click **Save**

---

## 🧪 Test Your Fix

### Option 1: Use Test Page
```
http://localhost:3000/test-auth
```
Click "Run Authentication Test" and see the detailed results.

### Option 2: Manual Test
```bash
1. Open browser console (F12)
2. Go to: http://localhost:3000/auth/signup
3. Try creating an account
4. Watch console for logs
```

---

## ✅ Common Mistakes

### ❌ Mistake 1: Missing NEXT_PUBLIC_ prefix
```env
# WRONG:
SUPABASE_URL=https://...

# CORRECT:
NEXT_PUBLIC_SUPABASE_URL=https://...
```

### ❌ Mistake 2: Not restarting dev server
```bash
# After changing .env.local, you MUST restart:
Ctrl+C
npm run dev
```

### ❌ Mistake 3: Wrong API key
```env
# Make sure you're using the "anon public" key, NOT:
# - service_role key (that goes in SUPABASE_SERVICE_ROLE_KEY)
# - JWT secret (that's different)
```

### ❌ Mistake 4: Auth not enabled
- Check: Supabase → Authentication → Providers → Email = ON

---

## 🔍 Still Getting 400?

Run this in browser console on any page:

```javascript
console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('Key exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
console.log('Key starts with:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20))
```

Expected output:
```
URL: https://btcrlsrfmzlveticpavv.supabase.co
Key exists: true
Key starts with: eyJhbGciOiJIUzI1NiIsI
```

If you see `undefined` or `your_supabase_url_here`, your env vars aren't loaded.

---

## 📋 Checklist

Before trying again, verify:

- [ ] `.env.local` file exists in project root
- [ ] All environment variables use `NEXT_PUBLIC_` prefix
- [ ] Supabase URL is a real URL (not placeholder text)
- [ ] API keys are the actual keys (not placeholder text)
- [ ] Development server was restarted after changes
- [ ] Email auth is enabled in Supabase dashboard
- [ ] Site URL is set to `http://localhost:3000`
- [ ] Email confirmations are disabled (for development)

---

## 🆘 Emergency Fix

If nothing works, start completely fresh:

```bash
# 1. Delete the env file
rm .env.local

# 2. Copy the example
cp .env.example .env.local

# 3. Open in editor
nano .env.local  # or use VS Code

# 4. Paste your ACTUAL credentials from Supabase dashboard

# 5. Save and restart
npm run dev
```

---

## 📞 Next Steps

After fixing:

1. Visit: `http://localhost:3000/test-auth` to verify
2. Try signup: `http://localhost:3000/auth/signup`
3. Check console for "Login successful" message
4. Should redirect to `/chat` on success

The 400 error should be gone! 🎉
