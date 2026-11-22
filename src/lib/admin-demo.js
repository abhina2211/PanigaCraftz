/* Demo data for the admin panel (dev server only, open /admin/?demo).
   Behaves like the few Supabase calls admin.js makes, using the catalogue as
   products and a couple of made-up enquiries. Nothing is saved anywhere. */
import { PRODUCTS, BASES } from '../data/catalogue.js';
import { persOf } from './rules.js';

export function demoClient() {
  const products = PRODUCTS.map(p => {
    const pers = persOf(p);
    return { id: p.id, slug: p.slug, category: p.cat, name: p.name, price_cents: p.price == null ? null : p.price * 100,
      status: p.fixedStatus ?? null, stock_qty: p.stock ?? null, base_id: p.base ?? null, personalisable: !!pers,
      personalisation_label: pers?.label ?? null, personalisation_word_limit: pers?.words ?? null,
      hamper_eligible: !!p.hamper, is_hamper_builder: !!p.builder, active: true,
      details: { img: p.img, col: p.col } };
  });
  const name = id => ({ name: products.find(p => p.id === id).name });
  const ago = h => new Date(Date.now() - h * 36e5).toISOString();
  const enquiries = [
    { id: 'e1', ref: 'PC-7Q2KX1', customer_name: 'Priya Sharma', email: 'priya@example.com', phone: '0412 345 678', postcode: '2150', status: 'new', created_at: ago(2),
      enquiry_items: [{ product_id: 'v3', qty: 1, personalisation_text: 'Happy housewarming Priya and Raj, may your home be full of flowers', packaging: 'Christmas red & gold', gift_note: null, products: name('v3'), enquiry_hamper_items: [] },
                      { product_id: 'h8', qty: 1, personalisation_text: null, packaging: 'Classic kraft with ribbon', gift_note: 'Thank you Ms Lee!', products: name('h8'),
                        enquiry_hamper_items: [{ qty: 1, product_id: 'c1', products: name('c1') }, { qty: 2, product_id: 'j2', products: name('j2') }] }] },
    { id: 'e2', ref: 'PC-3MF8A0', customer_name: 'Tom Nguyen', email: 'tom@example.com', phone: null, postcode: '2000', status: 'confirmed', created_at: ago(30),
      enquiry_items: [{ product_id: 'p1', qty: 2, personalisation_text: null, packaging: null, gift_note: null, products: name('p1'), enquiry_hamper_items: [] }] }
  ];
  const bases = BASES.map(b => ({ id: b.id, name: b.name, stock_qty: b.stock, active: true }));
  const tables = { products, enquiries, bases };
  let session = null;
  const photos = {};
  const query = table => {
    let rows = tables[table], patch = null, id = null, added = null;
    const q = {
      select() { return q; }, order() { return q; },
      eq(_, v) { id = v; return q; },
      update(p) { patch = p; return q; },
      insert(r) { added = { active: true, ...r }; return q; },
      then(res) {
        if (added) { rows.push(added); return res({ data: [added], error: null }); }
        if (patch) { const r = rows.find(x => x.id === id); Object.assign(r, patch); return res({ data: [r], error: null }); }
        return res({ data: rows, error: null });
      }
    };
    return q;
  };
  return {
    auth: {
      getSession: async () => ({ data: { session } }),
      signInWithPassword: async ({ email }) => { session = { user: { email, user_metadata: { name: 'Neha' } } }; return { error: null }; },
      signOut: async () => { session = null; }
    },
    rpc: async () => ({ data: true }),
    storage: { from: () => ({
      upload: async (path, blob) => { photos[path] = URL.createObjectURL(blob); return { data: { path }, error: null }; },
      getPublicUrl: path => ({ data: { publicUrl: photos[path] } })
    }) },
    from: query
  };
}
