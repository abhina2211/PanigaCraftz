# PanigaCraftz website requirements

| | |
|---|---|
| Document version | 1.3 |
| Status | Draft, to review with Neha |
| Owner | Abhi (for Neha Koolwal, PanigaCraftz) |
| Last updated | 22 Nov 2026 |

This is the single list of what the website must do. Every change to a requirement gets a new version number and a line in the change log at the bottom. Requirement ids never change or get reused; a dropped requirement is marked **Withdrawn** instead of deleted.

**How to update:** edit the requirement, raise the version (1.0 → 1.1 for additions or changes, 2.0 for a change in direction), and add a change log line saying what changed and why.

## 1. Goal and audience

A storefront for PanigaCraftz, Neha Koolwal's handmade decoupage business in Sydney. Buyers are mostly Sydney gift buyers; planters and hampers lead. Ordering is by Instagram DM until online payment is added.

MVP target: **30 Nov 2026**.

## 2. Delivery plan

| Phase | When | What | Done when |
|---|---|---|---|
| 0. Prototype | Done (22 Nov) | Static site: catalogue in `js/data.js`, enquiry list, custom order form, festival engine | Live in this repo |
| 1. Rules first | 22 to 24 Nov | The two features below, built in the static site with the rules in `js/rules.js`, and the matching draft database schema in `supabase/schema.sql` | Rules work in the browser and are written down here |
| 2. Astro move | Started 22 Nov | Astro + Tailwind project in the same repo. One product page template generates a page per product. Existing JS becomes components; `rules.js` is imported unchanged. Catalogue still read from a local file. Deploy previews on Cloudflare Pages or Netlify | Every product has its own URL; site matches the prototype |
| 3. Supabase | Started 22 Nov (project created by Abhi) | Create the Supabase project (needs Abhi's go-ahead), apply `supabase/schema.sql`, load the catalogue, read products and stock from the database, save enquiries through a server function, simple admin screen for Neha to edit products and stock | Neha can change stock and a hamper respects it without a code change |
| 4. Payments | Jan 2027 | Stripe Checkout and Australia Post shipping quotes | Customer can pay online |

## 3. Requirements

### Personalisation

| Id | Requirement | Status |
|---|---|---|
| REQ-P1 | Each product has a flag saying whether it can be personalised. Only flagged products show the personalisation fields. | Built (v1.0) |
| REQ-P2 | Each personalisable product has its own word limit and its own field label (for example "Message on the bottle"). Products without their own setting use the default: "Name to add", 5 words. | Built (v1.0) |
| REQ-P3 | The personalisation field shows a live word count against the limit. While the text is over the limit, an error is shown and the piece can't be added. | Built (v1.0) |
| REQ-P4 | The limit is also enforced in the data model: every add to the enquiry list is checked, saved lists are re-checked when the page loads, and the database rejects personalisation that is too long or on a product that can't be personalised. | Built in the site; database rule drafted (applied in phase 3) |
| REQ-P5 | A word is any run of characters between spaces, so "Ms Lee" is 2 words and "Happy-Diwali!" is 1. Site and database count the same way. | Built (v1.0) |

Word limits set so far (placeholders except where noted; Neha to confirm):

| Product | Field label | Limit |
|---|---|---|
| Decoupaged bottle vase | Message on the bottle | 50 words (from request) |
| Botanical decoupage candle (motif candle) | Words beside the motif | 15 words (request said 10 to 15) |
| Personalised name candle | Name or short message | 10 words |
| Personalised tea light holder | Name to add | 3 words |
| Other personalisable pieces | Name to add | 5 words (default) |

The gift note on the card stays a separate field limited to 150 characters.

### Site structure (Astro move)

| Id | Requirement | Status |
|---|---|---|
| REQ-S1 | Every product has its own page at `/products/<name>/`, made from one template, with its own page title, description and preview image for sharing. | Built (v1.1) |
| REQ-S2 | Product pages offer the same personalisation, word limits and enquiry list as quick view. The enquiry list is shared across all pages. | Built (v1.1) |
| REQ-S3 | Existing share links keep working: `/#planters`, `/#hampers-festive`, `/#gifts-teacher`, plus `/#build` for the hamper builder. | Built (v1.1) |
| REQ-S4 | The business rules have automated tests (`npm test`). | Built (v1.1) |
| REQ-S5 | Work happens on `feature/...` branches taken from `development`; `development` is merged into `main` to go live. | Agreed (v1.1) |

### Database (Supabase)

| Id | Requirement | Status |
|---|---|---|
| REQ-D1 | Products, prices, stock and word limits live in Supabase. The site reads them at build time (product pages) and again in the browser (live stock and prices). If Supabase is not set up or can't be reached, the site falls back to the local catalogue file. | Built (v1.2) |
| REQ-D2 | The website only uses the public (anon) key, which can read active products and submit enquiries, nothing else. The service role key is never used in the website or committed. Keys live in a local `.env` file that is not committed. | Built (v1.2) |
| REQ-D3 | An enquiry is saved by one database function that checks every rule (word limits, stock, hamper size) and holds hamper stock in the same transaction. If any line fails, nothing is saved. | Built and tested (v1.2); used by REQ-D6 (v1.3) |
| REQ-D4 | The database starts with the current catalogue, generated from the catalogue file (`npm run seed`). | Built (v1.2) |
| REQ-D5 | Neha has an admin screen at `/admin/`, behind an email and password login, to edit prices, stock, status, personalisation, word limits, hamper pieces and whether a product is on the site, and to see enquiries and change their status. Only accounts listed in the `admins` table can see or change anything; the database enforces this, not the page. Cancelling an enquiry returns its hamper stock. Products are hidden, never deleted. | Built (v1.3); adding new products with photos is next |
| REQ-D6 | Customers can send their enquiry list to Neha from the site (name, email, optional mobile, postcode), as well as copying it to Instagram. They get a reference number and the list is cleared. | Built (v1.3) |
| REQ-D7 | Neha gets an email when a new enquiry arrives. | Next |
| REQ-D8 | Neha can add a new product with photos from the admin screen, and the site rebuilds so it gets its own page. | Next |

### Custom hampers

| Id | Requirement | Status |
|---|---|---|
| REQ-H1 | Customers can build their own hamper by picking pieces. Only products marked as hamper pieces are offered. | Built (v1.0) |
| REQ-H2 | Every hamper piece has a stock count. A product's "In stock" or "Sold out" label follows its count. | Built (v1.0), counts are placeholders |
| REQ-H3 | A hamper can only contain pieces that are in stock. Out-of-stock pieces are shown greyed out and can't be added, and a piece's quantity can't go above what is left. | Built (v1.0) |
| REQ-H4 | Stock is checked against everything already in the customer's enquiry list (several hampers can't use the same last unit), again when a hamper's quantity is raised, and again when a saved list is loaded. In the database, submitting a hamper holds the stock in the same step, so two customers can't take the last unit. | Built in the site; database rule drafted (applied in phase 3) |
| REQ-H5 | Cancelling an enquiry returns its held hamper stock. | Database rule drafted (phase 3) |
| REQ-H6 | A hamper has 2 to 8 pieces. Its price is a basket, wrapping and card fee ($15) plus its pieces. It has a packaging choice and a card message of up to 30 words. | Built (v1.0), numbers are placeholders |
| REQ-H7 | Single pieces added to the enquiry list on their own are not limited by stock, because Neha can make them to order. | Built (v1.0), to confirm with Neha |

## 4. Open questions for Neha

1. Confirm the word limits above, especially the motif candle (10 or 15 words).
2. Real stock counts for hamper pieces, and which pieces she is happy to put in hampers.
3. Hamper fee, minimum and maximum number of pieces.
4. Should stock be held when an enquiry is sent, or only when she confirms it? (The draft holds it when sent and releases it on cancel.)
5. Should single pieces also stop at the stock count when they are not made to order (REQ-H7)?

## 5. Change log

| Version | Date | Change | Asked by |
|---|---|---|---|
| 1.3 | 23 Nov 2026 | Admin screen with login and database-enforced admin list (REQ-D5); customers can send enquiries from the site (REQ-D6); email alerts and adding products planned (REQ-D7, D8). | Abhi |
| 1.2 | 22 Nov 2026 | Supabase connection: live products and stock (REQ-D1), key handling (REQ-D2), all-or-nothing enquiry function (REQ-D3), seed (REQ-D4); admin and sending enquiries planned (REQ-D5, D6). | Abhi |
| 1.1 | 22 Nov 2026 | Astro move started: page per product (REQ-S1 to S3), rules tests (REQ-S4), branch workflow (REQ-S5). | Abhi |
| 1.0 | 22 Nov 2026 | First version. Delivery plan; personalisation flag and per-product word limit (REQ-P1 to P5); build-your-own hampers limited to stock (REQ-H1 to H7). | Abhi |
