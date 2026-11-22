/* PanigaCraftz business rules, shared by every screen that takes an order.
   Kept free of page code: Astro pages, browser scripts and the tests in tests/
   all import this file, and the rules match the database checks in supabase/schema.sql.

   REQ-P1..P4  per-product personalisation flag and word limit
   REQ-H1..H5  custom hampers may only contain pieces that are in stock
   (see docs/requirements.md) */
import { PRODUCTS, PERS_DEFAULT, HAMPER_BUILDER } from '../data/catalogue.js';

export const byId = id => PRODUCTS.find(p => p.id === id);

/* Words are runs of non-space characters, so "Ms Lee" is 2 and "Happy-Diwali!" is 1.
   The database uses the same rule (pc_word_count). */
export const wordCount = s => { const t = String(s ?? '').trim(); return t ? t.split(/\s+/).length : 0; };

/* Personalisation settings for a product, or null when it can't be personalised.
   pers: true uses the default; pers: { label, words } sets them per product. */
export const persOf = p => {
  if (!p || !p.pers) return null;
  return Object.assign({}, PERS_DEFAULT, p.pers === true ? {} : p.pers);
};

/* Check personalisation text against the product's word limit. Empty text is allowed
   (personalisation is optional). */
export function checkPers(p, text) {
  const cfg = persOf(p), words = wordCount(text);
  if (!words) return { ok: true, words, limit: cfg ? cfg.words : 0 };
  if (!cfg) return { ok: false, words, limit: 0, msg: `${p ? p.name : 'This piece'} can't be personalised.` };
  if (words > cfg.words) return { ok: false, words, limit: cfg.words, msg: `Please keep it to ${cfg.words} word${cfg.words === 1 ? '' : 's'} (you have ${words}).` };
  return { ok: true, words, limit: cfg.words };
}

/* ---------- custom hampers and inventory ---------- */
/* A piece can go in a custom hamper when it is marked hamper: true and has a stock count. */
export const hamperEligible = p => !!(p && p.hamper && typeof p.stock === 'number' && p.price != null);

/* Units of each piece already held by custom-hamper lines in the enquiry list
   (hamper quantity × piece quantity). Lines for single pieces are not counted:
   those are enquiries Neha confirms herself, and can be made to order. */
export function hamperUsage(bag, excludeKey) {
  const used = {};
  (bag || []).forEach(l => {
    if (l.key === excludeKey || !l.opts || !Array.isArray(l.opts.items)) return;
    l.opts.items.forEach(it => { used[it.id] = (used[it.id] || 0) + it.qty * l.qty; });
  });
  return used;
}

/* How many more units of a piece can go into hampers. 0 when not eligible. */
export const available = (id, bag, excludeKey) => {
  const p = byId(id);
  if (!hamperEligible(p)) return 0;
  return Math.max(0, p.stock - (hamperUsage(bag, excludeKey)[id] || 0));
};

/* Check a hamper (items = [{id, qty}]) ordered hamperQty times, against stock and the
   other hamper lines already in the enquiry list. */
export function checkHamper(items, hamperQty, bag, excludeKey, note) {
  const errors = [];
  const list = (items || []).filter(it => it && it.qty > 0);
  const pieces = list.reduce((s, it) => s + it.qty, 0);
  if (pieces < HAMPER_BUILDER.minItems) errors.push(`Choose at least ${HAMPER_BUILDER.minItems} pieces.`);
  if (pieces > HAMPER_BUILDER.maxItems) errors.push(`A hamper holds up to ${HAMPER_BUILDER.maxItems} pieces.`);
  const used = hamperUsage(bag, excludeKey);
  list.forEach(it => {
    const p = byId(it.id);
    if (!Number.isInteger(it.qty)) errors.push('Quantities must be whole numbers.');
    else if (!p) errors.push('A piece in this hamper is no longer sold.');
    else if (!hamperEligible(p)) errors.push(`${p.name} can't go in a custom hamper.`);
    else {
      const left = Math.max(0, p.stock - (used[it.id] || 0));
      if (it.qty * hamperQty > left) errors.push(left ? `Only ${left} ${p.name} left in stock.` : `${p.name} is out of stock.`);
    }
  });
  const nw = wordCount(note);
  if (nw > HAMPER_BUILDER.noteWords) errors.push(`Keep the card message to ${HAMPER_BUILDER.noteWords} words (you have ${nw}).`);
  return { ok: !errors.length, errors, pieces };
}

/* Price of one custom hamper: basket and wrapping fee plus its pieces. */
export const hamperPrice = items => HAMPER_BUILDER.base + (items || []).reduce((s, it) => s + (byId(it.id)?.price || 0) * it.qty, 0);

/* Check one enquiry-list line against every rule. Used when a saved list is loaded,
   because stock and limits can change between visits. */
export function checkLine(line, bag) {
  const p = byId(line.id), o = line.opts || {};
  if (!p) return { ok: false, msg: 'A piece in your list is no longer sold.' };
  if (p.builder) {
    const r = checkHamper(o.items, line.qty, bag, line.key, o.note);
    return r.ok ? { ok: true } : { ok: false, msg: r.errors[0] };
  }
  const r = checkPers(p, o.text);
  return r.ok ? { ok: true } : { ok: false, msg: `${p.name}: ${r.msg}` };
}

