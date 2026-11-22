/* Supabase connection, shared by the Astro build and the browser.
   The URL and anon key come from .env (see .env.example). Without them the site
   runs entirely from src/data/catalogue.js, as before. */
import { createClient } from '@supabase/supabase-js';
import { PRODUCTS } from '../data/catalogue.js';

const env = import.meta.env || {}; /* undefined when the tests run in plain Node */
const url = env.PUBLIC_SUPABASE_URL;
const key = env.PUBLIC_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

/* The admin page needs a client that remembers the sign-in between visits. */
export const isConnected = !!(url && key);
export const adminClient = () => createClient(url, key, { auth: { persistSession: true, storageKey: 'pc-admin-auth' } });

/* A database row in the shape the rest of the code already uses (see catalogue.js). */
export function fromRow(r) {
  const d = r.details || {};
  const stock = r.stock_qty;
  return {
    id: r.id, slug: r.slug, cat: r.category, ht: r.hamper_type || undefined, name: r.name, d: r.description,
    price: r.price_cents == null ? null : r.price_cents / 100, priceFrom: r.price_from,
    status: r.status ?? (typeof stock === 'number' ? (stock > 0 ? 'in' : 'sold') : null),
    stock, hamper: r.hamper_eligible, builder: r.is_hamper_builder || undefined,
    pers: r.personalisable ? { label: r.personalisation_label, words: r.personalisation_word_limit } : false,
    added: r.sort_added,
    img: d.img, img2: d.img2, badge: d.badge, size: d.size || '', occ: d.occ || [], fest: d.fest || [],
    ig: d.ig, col: d.col, sample: d.sample !== false
  };
}

/* Replace the local catalogue with the live products, in place, so every module that
   imported PRODUCTS (rules, pages, scripts) sees the live data. Returns how it went. */
let loading = null;
export function loadLiveProducts() {
  if (!supabase) return Promise.resolve({ source: 'local file' });
  return loading ??= (async () => {
    try {
      const { data, error } = await supabase.from('products').select('*').order('id');
      if (error) throw error;
      if (!data.length) return { source: 'local file', error: 'no products in the database yet' };
      PRODUCTS.splice(0, PRODUCTS.length, ...data.map(fromRow));
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
