# JWU Admin (`app-site`) → app.justwhyus.com

Separate Vite app for the team to review **contacts** and **applications** captured by the marketing site. Kept apart from the public site so admin code never ships in the public bundle.

## Run
```bash
cd app-site
npm install
npm run dev        # http://localhost:5181
```
(The marketing site runs on 5180, so both can run at once.)

Mock auth: any valid email + 6+ char password signs in.

## Architecture
- **UI** — login (`pages/Login.tsx`) + dashboard (`pages/Dashboard.tsx`): Overview, Contacts inbox, Applications inbox, and a detail drawer showing every captured field (country, city, device, browser, referrer, **time-on-site**, pages viewed, …).
- **Auth** — `lib/auth.tsx` (mock session in `sessionStorage`). Swap `signIn` for Supabase `signInWithPassword` later.
- **Data** — `lib/api.ts` exposes one `DataApi` interface. Today it's `MockApi` (seed data). When `VITE_SUPABASE_URL` is set, drop in a `SupabaseApi` with the same shape — no UI changes.
- **Schema** — `lib/types.ts`. Mirror of the marketing site's `src/lib/submissionTypes.ts`; the two describe one contract.

## Wiring Supabase later
1. Create `contacts` + `applications` tables matching `lib/types.ts`.
2. Add `lib/supabase.ts` (`createClient`) and a `SupabaseApi implements DataApi`.
3. Point `export const api` in `lib/api.ts` at it. Done.
