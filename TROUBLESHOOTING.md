# Troubleshooting Authentication Issues

## Quick Diagnostic

Visit `/diagnostic` in your browser to run automated checks.

## Common Issues & Solutions

### 1. "Failed to sign in" or No Error Message

**Possible Causes:**
- Environment variables not set
- Supabase project not configured
- Auth not enabled in Supabase

**Solutions:**

#### A. Check Environment Variables
```bash
# Verify .env.local exists and contains:
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
OPENAI_API_KEY=sk-your-key-here
ODDS_API_KEY=your-odds-api-key-here
```

#### B. Restart Development Server
```bash
# After changing .env.local, always restart:
# Press Ctrl+C to stop
npm run dev
```

#### C. Check Supabase Dashboard
1. Go to [app.supabase.com](https://app.supabase.com)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Ensure **Email** provider is enabled
5. Check **Authentication** → **URL Configuration**:
   - Site URL: `http://localhost:3000` (for development)
   - Redirect URLs: Add `http://localhost:3000/auth/callback`

#### D. Verify Database Schema
1. Go to **SQL Editor** in Supabase
2. Paste contents of `lib/supabase/schema.sql`
3. Click **Run**
4. Check for any errors

### 2. "User already registered" but can't log in

**Solution:**
1. Go to Supabase Dashboard → **Authentication** → **Users**
2. Find your user
3. Check if email is confirmed
4. If not confirmed, click the user and select "Send confirmation email"
5. Or enable "Disable email confirmations" in **Authentication** → **Settings** for testing

### 3. Login succeeds but redirects back to login

**Possible Causes:**
- Cookie issues
- Middleware blocking
- Session not persisting

**Solutions:**

#### A. Clear Browser Data
1. Open DevTools (F12)
2. Go to **Application** → **Storage**
3. Click "Clear site data"
4. Try logging in again

#### B. Check Browser Console
1. Open DevTools (F12)
2. Go to **Console** tab
3. Look for error messages when logging in
4. Share the errors for further debugging

#### C. Disable Email Confirmation (Development Only)
1. Supabase Dashboard → **Authentication** → **Settings**
2. Scroll to "Email Auth"
3. Toggle OFF "Enable email confirmations"
4. Try signing up with a new account

### 4. Infinite redirect loop

**Solution:**
```bash
# Clear Next.js cache
rm -rf .next
npm run dev
```

### 5. "Invalid login credentials"

**Possible Causes:**
- Wrong email/password
- User doesn't exist
- Password too short

**Solutions:**
1. Verify email is correct (check for typos)
2. Password must be at least 6 characters
3. Try signing up instead if account doesn't exist
4. Check Supabase Dashboard → Users to verify account exists

## Development Checklist

Before reporting issues, verify:

- [ ] `.env.local` file exists with all variables
- [ ] Development server restarted after changing env vars
- [ ] Supabase project is active (not paused)
- [ ] Database schema deployed (run `schema.sql`)
- [ ] Email auth enabled in Supabase
- [ ] Browser console shows no errors
- [ ] Tried in incognito/private browsing mode
- [ ] Visited `/diagnostic` page for automated checks

## Manual Testing Steps

### Test Signup Flow
```bash
# 1. Open browser to http://localhost:3000
# 2. Navigate to /auth/signup
# 3. Fill in form with:
#    - Email: test@example.com
#    - Password: password123
#    - Starting Bankroll: 1000
# 4. Click "Create Account"
# 5. Check browser console for errors
# 6. Should redirect to /chat
```

### Test Login Flow
```bash
# 1. Open browser to http://localhost:3000
# 2. Navigate to /auth/login
# 3. Enter credentials from signup
# 4. Click "Sign In"
# 5. Check browser console for logs
# 6. Should redirect to /chat
```

## Browser Console Logs

The app now logs helpful debugging info:

**On Login:**
```
Attempting login for: user@example.com
Login response: { data: {...}, error: null }
Login successful, user: abc-123-def-456
```

**On Error:**
```
Login error: { message: "Invalid login credentials", ... }
Login exception: Error: Invalid login credentials
```

## Supabase Auth Settings

Recommended settings for development:

1. **Authentication** → **Settings**:
   - ✓ Enable email provider
   - ✓ Disable email confirmations (dev only)
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`

2. **Authentication** → **Providers**:
   - ✓ Email enabled
   - Confirm password enabled: ✓

3. **Authentication** → **Policies**:
   - Check that RLS policies exist for all tables
   - Verify policies allow user CRUD on their own data

## Still Having Issues?

1. Visit `/diagnostic` for automated diagnostics
2. Check browser console for detailed error messages
3. Check Supabase Dashboard → Logs for backend errors
4. Try creating a new Supabase project and migrating
5. Ensure you're using the latest package versions:
   ```bash
   npm update @supabase/supabase-js @supabase/auth-helpers-nextjs
   ```

## Production Deployment

For Vercel/Production:

1. Add environment variables in Vercel dashboard
2. Update Supabase Auth settings:
   - Site URL: `https://your-app.vercel.app`
   - Redirect URLs: `https://your-app.vercel.app/auth/callback`
3. Enable email confirmations
4. Update `NEXT_PUBLIC_APP_URL` to production URL
