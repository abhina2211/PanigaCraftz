# PanigaCraftz website

Storefront for PanigaCraftz, Neha Koolwal's handmade decoupage business in Sydney (Instagram @panigacraftz_neha).

This folder is the single working version. It merges:

- **The Claude chat design** (22 Nov 2026): logo and colour theme, header with Products and Hampers dropdowns, hero carousel, Recent products, Shop by category, Quick view, enquiry list, 7 categories from her recent Instagram posts.
- **The other project** (`C:\work\NehaWebsite\panigaCraftz\panigaCraftz`, handover pack of 19 Nov): the 12 planters with real photos, names and sizes, the festival engine, personalisation (name, packaging, gift note), the 3-step custom order form with Australian validation, `BACKEND HOOK` markers, the "From our Instagram" strip, and the Supabase + Stripe plan.

The old folder was only read; nothing in it was changed.

## Run it

No build step. Open `index.html` in a browser, or serve the folder:

```
npx serve .
```

## Files

| Path | What it is |
|---|---|
| `index.html` | Page structure |
| `css/styles.css` | All styles (theme colours at the top, taken from the logo) |
| `js/data.js` | **Edit this to change products, prices, categories, occasions and festival dates** |
| `js/app.js` | Storefront behaviour: carousel, filters, quick view, enquiry list, custom order form, festival engine |
| `images/logo.png` | Logo, cropped from the Instagram profile picture (150 px source; replace with the original file when available) |
| `images/planters/` | 18 planter photos from Instagram (owner's permission noted in the handover pack) |
| `images/products/` | Other product photos |

## Features

- **Festival engine.** The announcement bar, its order-by countdown and the first hero slide follow the next festival in `FESTIVALS` (Christmas, Lunar New Year, Eid, Mother's Day, Diwali). Add `#preview` to the URL to show an admin pill that previews each festival.
- **Shareable links** for Instagram posts and the bio: `#planters`, `#candles`, `#hampers`, `#hampers-festive`, `#hampers-personal`, `#hampers-corporate`, `#gifts-teacher`, `#gifts-christmas`, `#gifts-housewarming` and so on.
- **Shop filters** by category, hamper type, occasion and price band, with sorting.
- **Quick view** with personalisation for items marked `pers: true`, and previous and next arrows.
- **Enquiry list**: same product with the same personalisation becomes one line. Shows a shipping estimate and copies a ready-to-send Instagram DM. Saved in the visitor's browser.
- **Custom order form** in 3 steps, with a reference number and a message to copy.
- **Stock status** (`in`, `made`, `sold`) shows only where it is known.

## Placeholders still to replace

- Prices: all are placeholders except the Rose Mummy & Baby Planter Set ($55). Four planters show "Price on enquiry".
- Drawn pictures stand in for products without photos (everything except planters and the botanical candle).
- Corporate hampers are suggestions, not yet in her posts.
- Shipping estimate ($12.95 flat, free over $120) is the prototype's placeholder.
- Festival dates for 2027 need confirming each year.

## Next steps (from the website plan)

1. Move to **Astro + Tailwind** so each product gets its own page from one template, then connect **Supabase** (products, festivals, enquiries, `interest_events`) and the admin screens. The `BACKEND HOOK` comments in `js/app.js` mark where the database calls go.
2. **Stripe Checkout** and Australia Post shipping quotes in January 2027.
3. Put this folder in a **GitHub repository** and deploy to Cloudflare Pages or Netlify.
