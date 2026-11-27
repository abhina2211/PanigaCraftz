# PanigaCraftz website requirements

| | |
|---|---|
| Document version | 1.13 |
| Status | Draft, to review with Neha |
| Owner | Abhi (for Neha Koolwal, PanigaCraftz) |
| Last updated | 27 Nov 2026 |

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
| REQ-S6 | A feature branch is merged into `development` only when it meets the definition of done in `CONTRIBUTING.md`: builds, tests pass, checked by hand (on a phone for admin changes), Supabase SQL applied and documented, this document updated, no secrets, pushed and reviewed in a pull request. | Agreed (v1.8) |
| REQ-S7 | Only one feature branch is open at a time: the next one starts from `development` after the previous one is merged. | Agreed (v1.8) |
| REQ-S8 | The site is hosted on a free public URL that works on a phone, deployed automatically from `main` on GitHub. Product pages are rendered on demand from Supabase on each visit, so new products, stock and prices show without a rebuild; the home and admin pages stay prebuilt. Supabase keys are set on the host, never committed. | Built (v1.11) on Cloudflare Workers free tier, `*.workers.dev` address until a domain is chosen |

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
| REQ-D8 | Neha can add a new product from her phone: photo (taken or chosen, shrunk before upload), name, category, description, price, ready-made pieces, blank base, personalisation, hampers and whether it shows on the website. It appears in the shop straight away, and so does its own product page. | Built (v1.7); product page straight away since v1.11 (REQ-S8) |

### Admin panel design (for Neha, mostly on her phone)

Modelled on the Shopify mobile app and the WordPress dashboard: a home screen that says what needs doing, lists of big cards, one edit screen per item, and plain words instead of database terms.

| Id | Requirement | Status |
|---|---|---|
| REQ-A1 | Phone first. Everything works one-handed on a phone: tap targets at least 48 px, text at least 16 px, a bottom tab bar (Home, Enquiries, Products, More). On a computer the tabs become a left sidebar. | Built (v1.4) |
| REQ-A2 | Home screen shows what needs attention: number of new enquiries, out-of-stock and running-low products (2 or fewer left), with the newest enquiries and products to restock listed below. Each number opens the matching filtered list. | Built (v1.4) |
| REQ-A3 | Products list shows a photo, name, price, word limit and a coloured stock label with words (In stock, 2 left, Out of stock, Made to order, Hidden). Search and filter chips: Low or out, Out of stock, Personalised, Hamper pieces, Hidden. | Built (v1.4) |
| REQ-A4 | Editing a product uses plain questions and switches: price; "Count stock for this product" with + and − buttons; what customers see (automatic, made to order, sold out); "Customers can add a name or message" with the question to ask and the most words allowed; "Can go in custom hampers"; "Show on the website". | Built (v1.4) |
| REQ-A5 | A save bar appears only when something has changed (Save or Discard). Leaving a screen with unsaved changes asks first. | Built (v1.4) |
| REQ-A6 | Enquiries list shows customer, reference, how long ago, number of items, estimated total and a status label (New, Confirmed, Done, Cancelled), with filters for each status. | Built (v1.4) |
| REQ-A7 | An enquiry screen shows the customer with one-tap Email, Call and WhatsApp buttons, every item with its personalisation, hamper contents, packaging and card message, and the next step as a big button (Confirm, then Mark as done; Cancel). Status changes and cancelling ask for confirmation in plain words. | Built (v1.4) |
| REQ-A8 | The panel can be added to the phone's home screen and opens like an app. The More tab explains how. | Built (v1.4) |
| REQ-A9 | Database errors are shown as plain sentences ("Stock can't be below 0"), never as codes. | Built (v1.4) |
| REQ-A11 | Common product changes happen in the list itself, without opening the product: stock + and − buttons, "In hampers" and "On website" switches, and tapping the price or the personalisation label. Each change saves straight away, shows "✓ Saved", and offers Undo for 6 seconds. Several quick stock taps save once ("8 → 11"). Products whose stock isn't counted can't be switched into hampers from the list. | Built (v1.5) |
| REQ-A12 | Price and personalisation open a small panel from the bottom of the screen: price box; on/off, the question to ask, quick word-limit picks (5, 15, 30, 50) and + and −. | Built (v1.5) |
| REQ-A13 | "Select" lets Neha tick several products (or select all shown) and then hide, show, add to or remove from hampers, set stock, set personalisation or change the price for all of them at once, with Undo. Adding to hampers skips products without a stock count and says how many. | Built (v1.5) |
| REQ-A14 | The Add product button is always at the top of the Products list on a phone, so Neha never scrolls to the end to add a product: a "＋ Add" button in the top bar next to Select (Shopify mobile style). It is hidden while selecting several products. | Built (v1.9) |
| REQ-A10 | A demo mode with made-up data (`/admin/?demo` on the dev server) lets the design be tried without touching real data. It is not in the live site. | Built (v1.4) |

### Shared blank bases (planters and other pieces)

Several designs are decoupaged onto the same blank piece. For example, the Bluebell Timber-Base and Aztec Stripe planters share one 21 cm planter on a timber base. Some decorated pieces are made in advance to photograph and post; when a customer wants a design that isn't ready, Neha decorates a blank.

| Id | Requirement | Status |
|---|---|---|
| REQ-B1 | A blank base has its own name and count of blanks ready to decorate. Each design (product) can be linked to one base; several designs can share a base. Each design keeps its own count of ready-made pieces. | Built (v1.6) |
| REQ-B2 | A design shows "In stock" while it has ready-made pieces, "Made to order" while it has none but its base has blanks, and "Sold out" when neither is left. A status Neha sets by hand (made to order, sold out) still wins. | Built (v1.6) |
| REQ-B3 | When a design is ordered, ready-made pieces are used first, then blanks from its base. | Built for hampers (v1.6) |
| REQ-B4 | Custom hampers follow the same rule: a design can go in a hamper while it has ready-made pieces or blanks, and designs sharing a base share its blanks. The database takes stock in one locked step, so two customers can't get the last blank. A hamper piece needs a stock count or a base. | Built (v1.6) |
| REQ-B5 | Cancelling an enquiry gives back ready-made pieces and blanks to exactly where they came from. | Built (v1.6) |
| REQ-B7 | Planters, candles, vases and jars share blank bases. Starting bases (placeholder count of 3 blanks each, to confirm): 21 cm planter on timber base (Bluebell, Aztec Stripe), frosted candle jar (botanical, personalised name, blue rose candles), glass vase (rose crackle vase), clip-top glass jar (cookie jar, storage jar). | Built (v1.7) |
| REQ-B8 | When adding or editing a product, Neha can pick an existing blank base or create a new one on the spot ("＋ New blank base…"), without leaving the form. | Built (v1.7) |
| REQ-B6 | The admin panel has a "Blank bases" list (Products tab) to add bases, rename them and change the number of blanks with + and −, with Undo. A product can be linked to a base from its edit screen or, for several at once, with Select then "Made on base…". Product cards show ready-made pieces plus the blanks on their base; Home lists bases running low. | Built (v1.6) |

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
| REQ-H8 | Ready-made hampers are made from the same pieces customers can buy on their own. Each ready-made hamper lists its pieces and how many of each. It shows as available only while every counted piece is in stock or can be made on its base, and an enquiry for it holds those pieces the same way a custom hamper does (cancelling gives them back). Pieces whose stock isn't counted don't limit the hamper. | Built (v1.10) in the site and database (`supabase/hampers.sql`). Contents are set in the SQL editor for now; starting contents for the Christmas and Diwali hampers are placeholders. An admin screen for contents comes later |
| REQ-H9 | Some pieces can be personalised inside a hamper, for example small jars and tea light holders. A piece keeps its own personalisation setting, field label and word limit inside a ready-made or custom hamper. The hamper builder shows the field for those pieces only, and the database checks the word limit. | Planned (v1.10), first week of December |
| REQ-H10 | Enquiries keep the prices shown when they were sent: each line stores the product name and unit price, and a custom hamper also stores its basket and wrapping fee and the price of each piece. Later price changes don't change past enquiries. The admin panel shows the saved prices. | Built (v1.10), decided 24 Nov |

### Security (before going live)

From the security review of 27 Nov 2026. Anyone can send an enquiry, and a hamper enquiry holds stock, so the database limits what one person can hold.

| Id | Requirement | Status |
|---|---|---|
| REQ-X1 | One enquiry has at most 20 items. A hamper line (custom or ready-made) can be ordered at most 10 at a time, and one enquiry holds at most 40 hamper pieces. Anything bigger is refused with a message to contact Neha. | Built (v1.13) in `supabase/security.sql`; numbers are starting values, changed in **Table Editor > enquiry_limits** |
| REQ-X2 | At most 3 enquiries an hour from one email address, and 30 an hour for the whole shop. | Built (v1.13), same table |
| REQ-X3 | An enquiry Neha hasn't confirmed within 7 days is cancelled automatically every hour, which gives its hamper stock back (REQ-H5). Neha marks real enquiries Confirmed to keep them. | Built (v1.13), runs with Supabase's pg_cron |
| REQ-X4 | The website and admin panel can't read or change these limits or run the expiry; only the Supabase dashboard can. | Built (v1.13) |
| REQ-X5 | Every page is sent with security headers: a Content-Security-Policy (scripts only from the site; styles and fonts from Google Fonts; photos and data from Supabase), no framing by other sites, HTTPS only, no MIME sniffing and a strict referrer policy. | Built (v1.13): `public/_headers` for prebuilt pages, `src/middleware.js` for product pages, one list in `src/lib/security-headers.js` |
| REQ-X6 | Product details from the database are checked before they go into a page: photo addresses must be a site path or `https://`, colours must be `#hex`, and ids are escaped. The photo folder only takes JPEG, PNG or WebP up to 5 MB. Each product page visit reads its own copy of the products, so two visits at once can't mix data. | Built (v1.13) |
| REQ-X7 | All keys and tokens are kept encrypted in a key store and read only when needed, never in plain text in the code, the repository or the built site. Server-side secrets go in Cloudflare secrets (Secrets Store) or Supabase Vault. The Supabase `service_role` / secret key is never used by the site. The Supabase anon key is public by design (every visitor's browser needs it) and is safe only because Row Level Security limits it; it is set as a Cloudflare build secret, not committed. | Agreed (v1.13). Next: a bot check (Cloudflare Turnstile) on enquiries, whose secret goes in Cloudflare Secrets Store |

## 4. Open questions for Neha

1. Confirm the word limits above, especially the motif candle (10 or 15 words).
2. Real stock counts for hamper pieces, and which pieces she is happy to put in hampers.
3. Hamper fee, minimum and maximum number of pieces.
4. Should stock be held when an enquiry is sent, or only when she confirms it? (The draft holds it when sent and releases it on cancel.)
5. Should single pieces also stop at the stock count when they are not made to order (REQ-H7)? With bases, the same question applies to blanks: should an enquiry for a single made-to-order design hold a blank?
6. Confirm the starting bases and which designs use each (REQ-B7), and the real number of blanks. The bottle vase, the blue rose vase set and the chocolate box are not linked to a base.

7. Which pieces can be personalised inside a hamper (REQ-H9)? Small jars and tea light holders so far: confirm the exact products and their word limits.
8. What is inside each ready-made hamper (REQ-H8)? Placeholders: Christmas & Kris Kringle = chocolate box, botanical candle, mini planter; Diwali = festive tea light set, chocolate box. Teacher, tea lover and new baby hampers have no contents yet.

## 5. Change log

| Version | Date | Change | Asked by |
|---|---|---|---|
| 1.13 | 27 Nov 2026 | Security before going live: limits on enquiry size and rate, unconfirmed enquiries expire after 7 days (REQ-X1 to X4), security headers (REQ-X5), product details checked before use and photo types limited (REQ-X6), keys kept encrypted in a key store (REQ-X7). Numbered 1.13 because 1.12 is on the open feature/brand-contrast branch. | Abhi |
| 1.12 | 27 Nov 2026 | Brand guidelines written down (`docs/brand-guidelines.md`); grey tagline and Sold out label darkened to pass the WCAG 4.5 contrast ratio. | Abhi |
| 1.11 | 27 Nov 2026 | Hosting on Cloudflare with product pages rendered on demand (REQ-S8); a new product's page shows straight away (REQ-D8). | Abhi |
| 1.10 | 27 Nov 2026 | Ready-made hampers use the same pieces as custom hampers and hold their stock (REQ-H8); pieces can be personalised inside hampers (REQ-H9, planned); enquiries keep the prices shown when sent (REQ-H10). Numbered 1.10 because 1.9 is on the open feature/admin-add-button branch. | Abhi |
| 1.9 | 23 Nov 2026 | Add product button moved to the top bar of the Products list so it is reachable without scrolling (REQ-A14). | Abhi |
| 1.8 | 23 Nov 2026 | Definition of done for feature branches (REQ-S6) and one feature branch at a time (REQ-S7). | Abhi |
| 1.7 | 23 Nov 2026 | Bases for candles, vases and jars (REQ-B7); pick or create a base while adding a product (REQ-B8); add products with a photo from the admin panel (REQ-D8). | Abhi |
| 1.6 | 23 Nov 2026 | Shared blank bases: designs linked to a base, ready-made first then blanks, for display and hampers, admin to manage bases (REQ-B1 to B6). | Abhi |
| 1.5 | 23 Nov 2026 | Fewer taps on the Products page: edit in the list with Undo (REQ-A11), bottom-sheet edits (REQ-A12), select several and change together (REQ-A13). | Abhi |
| 1.4 | 23 Nov 2026 | Admin panel redesigned for phones and non-technical use (REQ-A1 to A10). | Abhi |
| 1.3 | 23 Nov 2026 | Admin screen with login and database-enforced admin list (REQ-D5); customers can send enquiries from the site (REQ-D6); email alerts and adding products planned (REQ-D7, D8). | Abhi |
| 1.2 | 22 Nov 2026 | Supabase connection: live products and stock (REQ-D1), key handling (REQ-D2), all-or-nothing enquiry function (REQ-D3), seed (REQ-D4); admin and sending enquiries planned (REQ-D5, D6). | Abhi |
| 1.1 | 22 Nov 2026 | Astro move started: page per product (REQ-S1 to S3), rules tests (REQ-S4), branch workflow (REQ-S5). | Abhi |
| 1.0 | 22 Nov 2026 | First version. Delivery plan; personalisation flag and per-product word limit (REQ-P1 to P5); build-your-own hampers limited to stock (REQ-H1 to H7). | Abhi |
