/* Supabase connection, shared by the Astro build and the browser.
   The URL and anon key come from .env (see .env.example). Without them the site
   runs entirely from src/data/catalogue.js, as before. */
import { createClient } from '@supabase/supabase-js';
import { PRODUCTS, BASES, statusFor } from '../data/catalogue.js';

const env = import.meta.env || {}; /* undefined when the tests run in plain Node */
const url = env.PUBLIC_SUPABASE_URL;
const key = env.PUBLIC_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

/* The admin page needs a client that remembers the sign-in between visits. */
export const isConnected = !!(url && key);
export const adminClient = () => createClient(url, key, { auth: { persistSession: true, storageKey: 'pc-admin-auth' } });

/* Database rows in the shape the rest of the code already uses (see catalogue.js). */
export const fromBaseRow = b => ({ id: b.id, name: b.name, stock: b.stock_qty });
export function fromRow(r, bases = BASES) {
  const d = r.details || {};
  const stock = r.stock_qty;
  const p = {
    id: r.id, slug: r.slug, cat: r.category, ht: r.hamper_type || undefined, name: r.name, d: r.description,
    price: r.price_cents == null ? null : r.price_cents / 100, priceFrom: r.price_from,
    fixedStatus: r.status, stock, base: r.base_id || undefined, hamper: r.hamper_eligible, builder: r.is_hamper_builder || undefined,
    pers: r.personalisable ? { label: r.personalisation_label, words: r.personalisation_word_limit } : false,
    added: r.sort_added,
    img: d.img, img2: d.img2, badge: d.badge, size: d.size || '', occ: d.occ || [], fest: d.fest || [],
    ig: d.ig, col: d.col, sample: d.sample !== false
  };
  p.status = statusFor(p, bases);
  return p;
}

/* Ready-made hamper contents (REQ-H8): attach the hamper_pieces rows to their hampers,
   then work out each hamper's status from its pieces. Changes products in place. */
export function applyHamperPieces(products, rows, bases = BASES) {
  products.forEach(p => { delete p.pieces; });
  (rows || []).forEach(r => {
    const h = products.find(p => p.id === r.hamper_id);
    if (h) (h.pieces ??= []).push({ id: r.piece_id, qty: r.qty });
  });
  products.forEach(p => { if (p.pieces) p.status = statusFor(p, bases, products); });
  return products;
}

/* Replace the local catalogue with the live products, in place, so every module that
   imported PRODUCTS (rules, pages, scripts) sees the live data. Returns how it went. */
let loading = null;
export function loadLiveProducts() {
  if (!supabase) return Promise.resolve({ source: 'local file' });
  return loading ??= (async () => {
    try {
      const [{ data, error }, b, hp] = await Promise.all([
        supabase.from('products').select('*').order('id'),
        supabase.from('bases').select('*'), /* missing until supabase/bases.sql is run: then no bases */
        supabase.from('hamper_pieces').select('*') /* missing until supabase/hampers.sql is run: then no contents */
      ]);
      if (error) throw error;
      if (!data.length) return { source: 'local file', error: 'no products in the database yet' };
      BASES.splice(0, BASES.length, ...(b.error ? [] : b.data.map(fromBaseRow)));
      PRODUCTS.splice(0, PRODUCTS.length, ...data.map(r => fromRow(r, BASES)));
      applyHamperPieces(PRODUCTS, hp.error ? [] : hp.data, BASES);
      return { source: 'Supabase', count: data.length };
    } catch (e) {
      console.warn('[PanigaCraftz] Using the local catalogue; Supabase failed:', e.message || e);
      return { source: 'local file', error: e.message || String(e) };
    }
  })();
}

/* BACKEND HOOK done: save an enquiry list through the database function, which
   re-checks every rule and holds hamper stock in one transaction. Returns the reference. */
export async function submitEnquiry(contact, lines) {
  if (!supabase) throw new Error('Supabase is not connected');
  const { data, error } = await supabase.rpc('submit_enquiry', { payload: { ...contact, lines: lines.map(({ id, qty, opts }) => ({ id, qty, opts })) } });
  if (error) throw new Error(error.message);
  return data;
}
