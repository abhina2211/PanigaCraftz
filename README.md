# PanigaCraftz website

Storefront for PanigaCraftz, Neha Koolwal's handmade decoupage business in Sydney (Instagram @panigacraftz_neha).

Requirements and the delivery plan live in [`docs/requirements.md`](docs/requirements.md), which is versioned: update it with every change to what the site must do.

The site is built with [Astro](https://astro.build). Astro turns the files in `src/` into plain HTML pages at build time, one page per product from a single template. The browser scripts add the interactive parts (filters, quick view, enquiry list, hamper builder).

## Run it

Needs Node.js 22 or later.

```
npm install        # once, downloads Astro and Tailwind into node_modules/
npm run dev        # local site at http://localhost:4321, reloads on save
npm test           # checks the business rules (word limits, hamper stock)
npm run build      # writes the finished site to dist/
npm run preview    # serves dist/ to check the build
```

## Connect Supabase

Without this step the site runs from `src/data/catalogue.js`. With it, products, prices, stock and word limits come from the database.

1. In Supabase, open **SQL Editor > New query**, paste all of `supabase/schema.sql` and press **Run**.
2. New query again: paste all of `supabase/seed.sql` and **Run**. This loads the 35 products. (`npm run seed` rewrites that file from the catalogue.)
3. Copy `.env.example` to `.env` and paste the **anon public** key from **Project Settings > API** after `PUBLIC_SUPABASE_ANON_KEY=`. Never use the `service_role` key here.
4. Restart `npm run dev`. In the browser console, `document.documentElement.dataset.catalogue` says `Supabase` when it is working.

Stock is now changed in Supabase (**Table Editor > products > stock_qty**) until Neha's admin screen is built.

## Blank bases (shared planters)

Run `supabase/bases.sql` once in the SQL editor (after `admin.sql`). It adds the blank-bases table and starting bases for planters, candles, vases and jars (3 blanks each, a placeholder), links the designs listed in `docs/requirements.md` (REQ-B7), and changes nothing else. Running it again is safe: it only adds what is missing. Until it is run, the site and admin work as before without bases.

## Product photos

To let Neha add products with photos from the admin panel, run `supabase/photos.sql` once in the SQL editor (after `admin.sql`). It creates a public `product-photos` storage folder that only admins can upload to. Without it, products can still be added, just without a photo.

## Admin access

Neha's admin page is `/admin/` (for example http://localhost:4321/admin/).

1. In Supabase, run `supabase/admin.sql` in the SQL editor (once, after `schema.sql`).
2. **Authentication > Users > Add user > Create new user**: Neha's email and a password she chooses. Tick "Auto Confirm User".
3. In the SQL editor, make that account an admin (use her email):
   ```sql
   insert into admins (user_id) select id from auth.users where email = 'her@email' on conflict do nothing;
   ```
4. Recommended: **Authentication > Sign In / Providers > Email**: turn off "Allow new users to sign up", so nobody else can create an account.

The admin page only works for accounts in the `admins` table; the database refuses everyone else, whatever the page shows.

On a phone, open `/admin/` and use **Add to Home Screen** (iPhone, Safari Share menu) or **Install app** (Android, Chrome menu) so it opens like an app.

To try the design without real data, run `npm run dev` and open http://localhost:4321/admin/?demo, then sign in with any email and password. Nothing is saved.

## Files

| Path | What it is |
|---|---|
| `src/data/catalogue.js` | **Edit this to change products, prices, stock, word limits, categories, occasions and festival dates.** Moves to Supabase in phase 3 |
| `src/lib/rules.js` | Business rules shared by every page and the tests: personalisation word limits, hamper stock checks |
| `src/lib/pictures.js` | Drawn placeholder pictures for products without photos |
| `src/pages/index.astro` | Home page |
| `src/pages/products/[slug].astro` | The one template that makes every product page, e.g. `/products/decoupaged-bottle-vase/` |
| `src/layouts/Base.astro` | Page shell: head tags, header, footer |
| `src/components/` | Header (menus built from the catalogue) and footer with the enquiry list drawer |
| `src/scripts/core.js` | Browser code for every page: festival bar, menus, enquiry list |
| `src/scripts/home.js` | Home page: carousel, shop filters, quick view, hamper builder, custom order form |
| `src/scripts/product.js` | Product page: personalisation and add to enquiry |
| `src/styles/global.css` | All styles (theme colours at the top, taken from the logo). Tailwind classes also work |
| `public/images/` | Logo and product photos, served as they are |
| `tests/` | Tests for `rules.js`, and for the database schema run in an in-memory Postgres |
| `supabase/schema.sql` | Database tables, rules and access (run once in the SQL editor) |
| `supabase/seed.sql` | The current catalogue as database rows (generated by `npm run seed`) |
| `src/lib/supabase.js` | Connection to Supabase: loads live products, submits enquiries |
| `supabase/admin.sql` | Admin list and what admins may change (run once after `schema.sql`) |
| `src/pages/admin/index.astro`, `src/scripts/admin.js`, `src/styles/admin.css` | Neha's admin panel: home, enquiries, products, made for phones first |
| `src/lib/admin-demo.js` | Made-up data for trying the admin panel (`/admin/?demo`, dev server only) |
| `.env.example` | Template for your local `.env` with the Supabase URL and anon key |
| `docs/requirements.md` | Versioned requirements, delivery plan and change log |

## Features

- **A page per product** at `/products/<name>/`, with its own title and preview image for sharing on Instagram and WhatsApp.
- **Festival engine.** The announcement bar, its order-by countdown and the first hero slide follow the next festival in `FESTIVALS`. Add `#preview` to the home page URL to show an admin pill that previews each festival.
- **Shareable links** for Instagram posts and the bio: `/#planters`, `/#candles`, `/#hampers`, `/#hampers-festive`, `/#gifts-teacher`, `/#build` and so on.
- **Shop filters** by category, hamper type, occasion and price band, with sorting.
- **Personalisation** only on products marked `pers`, each with its own label and word limit (for example 50 words on the bottle vase), in quick view and on the product page.
- **Build your own hamper** (`/#build`): pick 2 to 8 pieces from what is in stock. Stock counts are in the catalogue (`stock`, `hamper`).
- **Enquiry list**: same product with the same personalisation becomes one line. Shows a shipping estimate and copies a ready-to-send Instagram DM. Saved in the visitor's browser and shared across pages.
- **Custom order form** in 3 steps, with a reference number and a message to copy.

## Placeholders still to replace

- Prices: all are placeholders except the Rose Mummy & Baby Planter Set ($55). Four planters show "Price on enquiry".
- Stock counts, word limits and the hamper fee (see open questions in the requirements doc).
- Drawn pictures stand in for products without photos.
- Corporate hampers are suggestions, not yet in her posts.
- Shipping estimate ($12.95 flat, free over $120).
- Festival dates for 2027 need confirming each year.
- The domain in `astro.config.mjs` (`site`) is a placeholder.

## Branches

- `main`: what is live.
- `development`: finished features waiting to go live.
- `feature/...`: work in progress, branched from `development` and merged back into it.

One feature branch at a time: a new one starts only after the last one is merged into `development`. A branch is ready to merge when it meets the definition of done in [`CONTRIBUTING.md`](CONTRIBUTING.md).
