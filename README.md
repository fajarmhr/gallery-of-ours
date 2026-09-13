# Gallery of Ours

A private family memories app: albums as polaroid piles, a justified photo grid, story mode with music, On this day, places map and 3D globe, year recaps, time capsules, milestones and share links. Visitors see no photos at all, only a polite family-only message. English and Bahasa Indonesia, earthy light and warm dark themes, installable on phones.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · Tailwind CSS 4 · shadcn/ui · Motion · Better Auth · Neon Postgres + Drizzle · Cloudflare R2 · Resend · next-intl · MapLibre · Claude Haiku 4.5 (optional captions)

## Run it locally

```bash
pnpm install
cp .env.example .env.local      # then fill DATABASE_URL and BETTER_AUTH_SECRET
pnpm db:push                    # create the tables
pnpm seed:demo                  # optional: demo family, albums and generated photos
pnpm dev                        # http://localhost:3000
```

Create your own superadmin (no email needed):

```bash
pnpm create-superadmin --name "Your Name" --username you --email you@example.com --password "a long password"
```

### Demo accounts

After `pnpm seed:demo`, every demo account uses the password `kenangan123`:

| Username | Role | Can do |
| --- | --- | --- |
| `papa` | Superadmin | Everything, including changing roles |
| `mama`, `raka` | Admin | Everything except roles |
| `sari` | Member | Edit "Bali, August 2024" for 5 days |
| `budi`, `nenek` | Member | View, favorite, react, comment |
| `dinda`, `yusuf` | Pending | Waiting for approval in Family |

Remove all demo content with `pnpm seed:remove`.

## Roles

- **Member:** views everything, favorites, reacts and comments. An admin can turn on editing for all albums or one album, for 1, 7 or 30 days or until turned off.
- **Admin:** uploads, edits, trashes, approves sign-ups, gives editing access, creates share links, time capsules and milestones, restores or empties the trash.
- **Superadmin:** everything an admin can do, plus changing roles. The family always keeps at least one superadmin.

New sign-ups confirm their email, then wait on a "Waiting for a family admin" screen until an admin approves them.

## Environment variables

| Variable | Needed | Without it |
| --- | --- | --- |
| `DATABASE_URL` | Yes | – |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` | Yes | – |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | In production | Files are saved in `LOCAL_STORAGE_DIR` (development only) |
| `RESEND_API_KEY`, `EMAIL_FROM` | In production | Verification and reset emails are printed in the terminal |
| `ANTHROPIC_API_KEY`, `AI_DAILY_CAPTION_LIMIT` | Optional | No AI captions or AI search tags |
| `CLOUDINARY_URL_1`, `CLOUDINARY_URL_2` | Optional | No "Add from Cloudinary" button in albums |
| `SUPERADMIN_EMAIL` | Optional | Sign-ups with this email become superadmin automatically |
| `APP_TIMEZONE` | Optional | `Asia/Jakarta` |
| `NEXT_PUBLIC_FAMILY_SINCE` | Optional | Hides the "since 1998" note under the logo |
| `GEOCODING=off` | Optional | Place names are looked up on OpenStreetMap |

## Deploy to Vercel

1. Push the repo and import it on Vercel. Add every variable above, with `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` set to your domain.
2. **Cloudflare R2:** create a bucket and an API token with object read and write. Add a CORS rule so browsers can upload directly:
   ```json
   [{ "AllowedOrigins": ["https://your-domain.com"], "AllowedMethods": ["GET", "PUT"], "AllowedHeaders": ["Content-Type"], "MaxAgeSeconds": 3600 }]
   ```
3. **Resend:** verify your domain so emails reach family inboxes, then set `EMAIL_FROM` to an address on it.
4. Put the production values in `.env.production.local` (git-ignored). Run `pnpm db:push:prod`, then `pnpm seed:remove:prod` if that database still has the demo family (fill in the R2 values first, so the script doesn't delete your local demo files), then `pnpm create-superadmin:prod` for yourself. Vercel never reads this file: paste its contents into **Settings → Environment Variables** for the Production environment, and redeploy after every change.
5. **AI captions (optional):** add `ANTHROPIC_API_KEY` and set a monthly spend limit in the Anthropic Console. `AI_DAILY_CAPTION_LIMIT` caps captions per day.

## Scripts

Scripts ending in `:prod` read `.env.production.local`; the others read `.env.local`. On your computer, `pnpm build` and `pnpm start` load `.env.production.local` first and fill anything missing from `.env.local`.

| Command | What it does |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Develop, build, run |
| `pnpm typecheck` / `pnpm lint` | Type and lint checks |
| `pnpm db:push` / `pnpm db:studio` | Sync the schema, browse the database |
| `pnpm seed:demo` / `pnpm seed:remove` | Add or remove the demo family |
| `pnpm create-superadmin` | Create or promote a superadmin |
| `pnpm db:push:prod` / `pnpm db:studio:prod` / `pnpm seed:remove:prod` / `pnpm create-superadmin:prod` | The same, against production |

## Privacy notes

- Photos are served through `/api/media/…`, which checks the session (or a share link) and then redirects to a short-lived signed URL. Nothing is public in the bucket.
- Photos imported from Cloudinary stay in that account but are switched to private (authenticated) delivery, so their old public links stop working. The app serves them through signed Cloudinary URLs, which don't expire, and emptying the trash deletes them from Cloudinary.
- Time capsules stay hidden from everyone except the person who sealed them until the unlock date.
- GPS coordinates are sent to OpenStreetMap Nominatim to name places. Set `GEOCODING=off` to keep them local. Map tiles come from CARTO.
- Deleted items stay in the trash for 30 days, then they're removed from storage.
