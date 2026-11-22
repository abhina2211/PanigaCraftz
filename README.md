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
| `tests/` | Tests for `rules.js` |
| `supabase/schema.sql` | Draft database schema that enforces the same rules (not applied yet) |
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
