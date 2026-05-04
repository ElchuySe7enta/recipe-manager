# Household Recipe Manager — Cloud version

A React + Vite app that talks to Supabase. Auth, household sharing, real-time sync.

## Prereqs (one-time)

- Node.js 18 or newer (`node --version`). Get it from <https://nodejs.org> or `brew install node`.
- A GitHub account with the empty `recipe-manager` repo created.
- Vercel account linked to GitHub.

## 1. Apply the database schema

If you haven't already:

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste the entire contents of `supabase-schema.sql` (sibling of this folder) and click **Run**.

## 2. Run locally to verify

```bash
cd recipe-manager
npm install
npm run dev
```

Open <http://localhost:5173>. Sign up with your email. You should see the "Create household" screen. Create one. The app loads with empty inventory/recipes/meal plan. Add an inventory item, refresh — it persists.

If you see "Missing VITE_SUPABASE_URL" — `.env.local` is missing or the values are wrong. The file should already be present with your project URL and anon key.

## 3. Push to GitHub

```bash
cd recipe-manager
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/ElchuySe7enta/recipe-manager.git
git push -u origin main
```

## 4. Deploy to Vercel

1. Go to <https://vercel.com/new> and import the `recipe-manager` repo.
2. Vercel auto-detects Vite — leave the framework preset as "Vite".
3. Click **Environment Variables** and add **two** variables (these are the same values from `.env.local`, but Vercel needs them too because `.env.local` is gitignored):
   - `VITE_SUPABASE_URL` = `https://bgquzfwzoksgmnhqjahg.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `sb_publishable_wPaVUhkby7QZzLxifAGDJg_FZ1g-Av5`
4. Click **Deploy**. Wait ~30 sec.
5. Vercel gives you a URL like `https://recipe-manager-xxx.vercel.app`. Note it.

## 5. Tell Supabase about the Vercel URL

Auth confirmation emails need to know where to redirect users after they click the link.

1. Supabase project → **Authentication** → **URL Configuration**.
2. **Site URL**: paste your Vercel URL (e.g. `https://recipe-manager-xxx.vercel.app`).
3. **Redirect URLs**: add the same URL plus `/*` (e.g. `https://recipe-manager-xxx.vercel.app/*`).
4. Save.

## 6. First sign-up + invite your wife

1. Open your Vercel URL.
2. Click **Sign up**, use your email + password. Confirm via the email Supabase sends.
3. Sign back in. Create a household ("Luque household" or whatever).
4. Click the **Invite** button (top-right). Enter your wife's email. Copy the invite link.
5. Send her the link via WhatsApp/SMS/email. When she opens it:
   - It prompts her to sign up (with the same email the invite was sent to).
   - She signs up, confirms her email.
   - Re-opens the invite link → she's auto-joined to your household.
6. Both of you now see the same pantry, recipes, meal plan in real time.

## Day-to-day workflow

To make changes:

```bash
git add .
git commit -m "what changed"
git push
```

Vercel auto-deploys on every push to `main`. Live in ~30 seconds.

## Project structure

```
recipe-manager/
├── src/
│   ├── main.jsx            entry + router
│   ├── Root.jsx            session/profile gate
│   ├── AuthScreen.jsx      sign in / sign up
│   ├── HouseholdSetup.jsx  first-time household creation
│   ├── HouseholdMenu.jsx   invite button + invite modal
│   ├── InvitePage.jsx      handles /invite/:token
│   ├── App.jsx             main app: data layer + tabs nav
│   ├── tabs/               one file per tab
│   │   ├── InventoryTab.jsx
│   │   ├── RecipesTab.jsx
│   │   ├── PlanTab.jsx
│   │   ├── SuggestionsTab.jsx
│   │   └── ShoppingTab.jsx
│   └── lib/
│       ├── supabase.js     Supabase client
│       ├── units.js        unit conversion
│       └── utils.jsx       icons, date helpers, Excel parsing
├── supabase-schema.sql     run once in Supabase SQL Editor
├── .env.local              your secrets (already populated, gitignored)
├── vercel.json             SPA rewrites for client-side routing
└── package.json
```

## Notes

- Real-time sync uses Supabase's `postgres_changes` channels. When you or your wife edit a row, the other's UI updates within ~1 sec.
- Row-Level Security policies are defined in `supabase-schema.sql`. Even if someone got hold of your `anon` key (it's public, embedded in the JS), they can't read other households' data — the database enforces it.
- The `accept_invite()` SQL function checks that the invitee's email matches what was on the invite, so a stolen invite link can't be used by a different account.
- Inventory units convert automatically (g/kg/mg/oz/lb, mL/L/tsp/tbsp/cup/fl oz, pcs). Custom units like "bunch" still work but only match other entries spelled the same way.

## Troubleshooting

**"Invalid login credentials"** during sign-in: did you confirm your email after signing up? Check spam folder. You can also disable "Confirm email" in Supabase → Authentication → Providers → Email if you want skip that step.

**Build fails on Vercel** with "Missing env": you forgot to add the env vars in step 4. Project Settings → Environment Variables.

**Real-time not working**: Supabase free tier supports it, but check Project Settings → API → Realtime is on.

**Anything else**: copy the error message and ping me.
