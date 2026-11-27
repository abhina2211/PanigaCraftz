# Branch log

Every feature branch, what it changed, and what happened to it. Add a row when a branch is started, and fill in the merge when it is merged into `development`. Newest first. Merged branches are deleted afterwards, so this log and the merge commits are where their history lives.

Requirement ids and versions refer to `docs/requirements.md`.

## Open

| Started | Branch | Component | What it changes | Req. version | Status |
|---|---|---|---|---|---|
| | (none open) | | | | |

## Merged into development

| Merged | Branch (tip) | Merge commit | Component | What it changed | Req. version |
|---|---|---|---|---|---|
| 27 Nov 2026 | `feature/alt-design` (e3c7bf4) | 23ff5d0 | Storefront design | "Studio journal" shop design, chosen by Abhi after comparing screenshots: warm paper colours, arched photos, Fraunces/Figtree/Caveat fonts, ordering steps after the hero, new section order. Styles in `src/styles/shop.css`; the admin panel keeps `global.css` (REQ-S9). Merge note: development was merged into the branch first (e3c7bf4), and the hamper size and section styles and the footer credit were added to `shop.css`; the launching-soon page now uses the new fonts and colours. | 1.17 |
| 27 Nov 2026 | `feature/footer-credit` (b80de69) | 8f8c32e | Footer | Small "Website by MetaFinTech Pty Ltd" credit at the bottom of the shared footer on every shop page (REQ-S11). | 1.16 |
| 27 Nov 2026 | `feature/coming-soon` (64e874e) | c552c24 | Site, hosting | "Launching soon" page (logo, Instagram link, email link to panigacraftz@gmail.com) shown as the home page when the build variable `PUBLIC_COMING_SOON=true`; product pages redirect to it; admin panel unchanged (REQ-S10). | 1.15 |
| 27 Nov 2026 | `feature/hamper-sizes` (9bdf354) | fd343c4 | Hamper builder, rules, database, admin | Hamper sizes Small 3–4, Medium 5–6, Large 7–10 pieces, set by the number of pieces; a basket price per size plus $6 wrapping and card (REQ-H6); builder sections Planters, Candles, Jars, Others (REQ-H11); chocolates and condiments sold only inside hampers (REQ-H12). New `supabase/hamper-sizes.sql`. Merge note: the live hamper sizes are read with the products (`readLive`), so server-drawn product pages use the live basket prices; the security tests were moved to 3-piece hampers. | 1.14 |
| 27 Nov 2026 | `feature/security-hardening` (d7244de) | 6be6cd5 | Database, hosting, site | Limits on enquiry size and rate, unconfirmed enquiries expire after 7 days (REQ-X1 to X4), security headers (REQ-X5), photo and colour values checked before use (REQ-X6), keys only in a key store (REQ-X7). New `supabase/security.sql`. | 1.13 |
| 27 Nov 2026 | `feature/brand-contrast` (688979d) | 35a4b61 | Brand, styles | Brand guidelines written down (`docs/brand-guidelines.md`); grey tagline and Sold out label darkened to pass WCAG 4.5:1. | 1.12 |
| 27 Nov 2026 | `feature/deploy` (b17fcfb) | ff0a179 | Hosting | Cloudflare Workers hosting; product pages drawn on each visit (REQ-S8, REQ-D8). | 1.11 |
| 27 Nov 2026 | `feature/admin-add-button` (ccbe4bb) | f437b64 | Admin panel | Add product button moved to the top bar of the Products list (REQ-A14). | 1.9 |
| 27 Nov 2026 | `feature/hamper-contents` (de254ef) | 40dec8a | Hampers, database | Ready-made hampers take their pieces' stock (REQ-H8); enquiries keep the prices shown when sent (REQ-H10). New `supabase/hampers.sql`. | 1.10 |
| 23 Nov 2026 | `feature/definition-of-done` (0418bf0) | 2741328 | Process | Definition of done (REQ-S6) and one feature branch at a time (REQ-S7) in `CONTRIBUTING.md`. | 1.8 |
| 23 Nov 2026 | `feature/planter-bases` (8ff3b05) | 42e2fb2 | Stock, admin, database | Blank bases shared by designs (REQ-B1 to B8); add products with a base and a photo. New `supabase/bases.sql`, `supabase/photos.sql`. | 1.6–1.7 |
| 23 Nov 2026 | `feature/admin-quick-edit` (d4e9683) | c38eb46 | Admin panel | Edit products from the list with undo, bottom-sheet edits, bulk changes (REQ-A11 to A13). | 1.5 |
| 23 Nov 2026 | `feature/admin-ui` (d6e63f7) | 9d5b327 | Admin panel | Admin redesigned for phones (REQ-A1 to A10); fix for empty enquiry lists. | 1.4 |
| 23 Nov 2026 | `feature/admin` (80b8803) | 8104ce7 | Admin panel, enquiries | Neha's admin page and sending enquiries from the site. New `supabase/admin.sql`. | 1.3 |
| 23 Nov 2026 | `feature/supabase` (9c4c58c) | 91b4215 | Database | Site connected to Supabase; schema and seed. | 1.2 |
| 23 Nov 2026 | `feature/astro-move` (78eab8e) | a6ed1d5 | Whole site | Storefront moved to Astro with a page per product. | 1.1 |
| 22 Nov 2026 | `feature/personalisation-hampers` (86b391d) | fast-forward | Rules | Per-product personalisation limits and in-stock custom hampers (REQ-P1 to P5, REQ-H1 to H7). | 1.0 |

## Clean-up

| Date | What |
|---|---|
| 27 Nov 2026 | Deleted the merged local branches above (all except `feature/alt-design`). Their copies on GitHub, if pushed, still need deleting there (`git push origin --delete <branch>`), which Abhi does. |
