# GitaGPT Task Tracker

Real-time collaborative task tracker. Changes appear instantly for all users.

---

## Setup (5 mins)

### 1. Supabase
1. Go to [supabase.com](https://supabase.com) → New project
2. Go to **SQL Editor** → paste `schema.sql` → Run
3. Go to **Settings → API** → copy:
   - `Project URL`
   - `anon public` key

### 2. Deploy to Vercel
1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → Import repo
3. Add these **Environment Variables**:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```
4. Deploy → share the URL with your friends!

---

## Features
- Add / edit / delete tasks
- Tech stack, layer (FE/BE/Full/AI), priority (MVP/V2/V3)
- Status tracking: Todo → In Progress → Done (click the badge to cycle)
- Assign tasks to teammates
- Filter by layer, priority, or status
- **Live updates** — no refresh needed