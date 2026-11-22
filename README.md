# Gallery of Ours

A private family memories app: albums as polaroid piles, a justified photo grid, story mode with music, On this day, places map and 3D globe, year recaps, time capsules, milestones and share links. Visitors see no photos at all, only a polite family-only message. English and Bahasa Indonesia, earthy light and warm dark themes, installable on phones.

**Stack:** Node.js 26 LTS · pnpm 12 · Next.js 16.4 (App Router, Webpack) · React 19.3 · TypeScript 6 · Tailwind CSS 4.3 · shadcn/ui · Motion 14 · Better Auth · Neon Postgres + Drizzle · Cloudflare R2 · Resend · next-intl · MapLibre · Claude Haiku 4.5 (optional captions)

## Interface consistency

The shared theme lives in `src/app/globals.css`: warm paper surfaces, one clay accent, 8px controls and 12px panels. Use Newsreader at normal/medium weight for titles, the body font for controls, 16px body text and 14px labels/help. Full-screen photos and stories retain a warm dark viewing surface.

Use `PageHeader`, `PageSection` and `EmptyState` for app pages; `PublicShell`, `FormHeading`, `Field` and `FormMessage` for public/auth flows. Dialogs, buttons, inputs and tabs come from `src/components/ui`. Avoid page-specific versions of those patterns.

The consistency audit covers all 25 page routes plus shared loading, error and not-found states:

| Area | Routes |
| --- | --- |
| Home and discovery | `/home`, `/search`, `/timeline`, `/favorites` |
| Albums and memories | `/albums`, `/albums/[albumId]`, `/capsules`, `/milestones` |
| Places and recaps | `/places`, `/globe`, `/recap`, `/recap/[year]` |
| Family and preferences | `/family`, `/settings`, `/storage`, `/trash`, `/more` |
| Public and access | `/`, `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email`, `/pending`, `/s/[token]` |

## Run it locally

Use **pnpm 12.21.0** (`packageManager` pins it). On Windows, update an older pnpm installation with `npm.cmd install --global pnpm@12.21.0`; older pnpm launchers can fail when switching automatically to pnpm 12.

`pnpm install` provisions the project's **Node.js 26.13.1 LTS** runtime from `devEngines.runtime` and verifies the locked download. `pnpm dev`, `pnpm build`, and other pnpm scripts use this runtime automatically. Check it with `pnpm exec node --version`. `.nvmrc` also pins the same version for developers using nvm.

TypeScript stays on the current compatible 6.0 release because the Next.js type checker and ESLint integrations require its JavaScript compiler API. Dependency versions are locked in `pnpm-lock.yaml`; CI should use `pnpm install --frozen-lockfile`.

The interface uses warm paper tones, Newsreader headings, and locally hosted fonts in `src/app/fonts` with their OFL licenses. Font downloads are not needed during builds. Motion respects the device's reduced-motion preference.

Development and production builds use Next.js's supported `--webpack` option: Turbopack's PostCSS worker exits prematurely on this Windows/Node setup. This keeps the current stable Next.js release while providing a working build.

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

1. Push the repo and import it on Vercel. Use Node.js 26.x (also declared in `package.json`). Add every variable above, with `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` set to your domain.
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
| `pnpm test:upload` | iPhone MIME, HEIC preparation, video fallback, and preview regression checks |
| `pnpm test:recap` | Video-only years, photo preference, and unique bounded recap highlights |
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
