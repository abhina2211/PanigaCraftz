// Checks supabase/admin.sql: only people in the admins table can edit products and
// see enquiries. Runs in an in-memory Postgres set up like Supabase (auth schema,
// anon/authenticated roles with Supabase's default table grants).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const sql = f => readFileSync(new URL(`../supabase/${f}`, import.meta.url), 'utf8');
const db = new PGlite();
const NEHA = '00000000-0000-0000-0000-00000000000a';
const STRANGER = '00000000-0000-0000-0000-00000000000b';

/* Run a query as a visitor (no user) or as a signed-in user, like Supabase does. */
async function as(user, query, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user || ''}', false); set role ${user ? 'authenticated' : 'anon'};`);
  try { return await db.query(query, params); } finally { await db.exec('reset role;'); }
}

before(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    insert into auth.users values ('${NEHA}', 'neha@example.com'), ('${STRANGER}', 'someone@example.com');
  `);
  await db.exec(sql('schema.sql'));
  await db.exec(sql('seed.sql'));
  await db.exec(sql('admin.sql'));
  await db.exec(sql('admin.sql')); // running it twice must be safe
  await db.exec(sql('bases.sql'));
  await db.exec(`insert into admins (user_id) select id from auth.users where email = 'neha@example.com'`);
  await db.query(`select submit_enquiry($1)`, [JSON.stringify({ name: 'Test Buyer', email: 'test@example.com', postcode: '2000', lines: [{ id: 'h8', qty: 1, opts: { items: [{ id: 'c1', qty: 1 }, { id: 'j2', qty: 1 }] } }] })]);
});

test('is_admin is true only for Neha', async () => {
  assert.equal((await as(NEHA, 'select is_admin() as a')).rows[0].a, true);
  assert.equal((await as(STRANGER, 'select is_admin() as a')).rows[0].a, false);
  assert.equal((await as(null, 'select is_admin() as a')).rows[0].a, false);
});

test('only admins can change stock', async () => {
  await as(STRANGER, `update products set stock_qty = 99 where id = 'c1'`);
  await as(null, `update products set stock_qty = 99 where id = 'c1'`);
  assert.equal((await db.query(`select stock_qty from products where id = 'c1'`)).rows[0].stock_qty, 7);
  await as(NEHA, `update products set stock_qty = 20 where id = 'c1'`);
  assert.equal((await db.query(`select stock_qty from products where id = 'c1'`)).rows[0].stock_qty, 20);
});

test('database checks still apply to admins', async () => {
  await assert.rejects(as(NEHA, `update products set stock_qty = -1 where id = 'c1'`), /check/);
  await assert.rejects(as(NEHA, `update products set personalisable = true, personalisation_word_limit = null where id = 'd1'`), /personalisation_needs_limit/);
});

test('only admins can see enquiries', async () => {
  assert.equal((await as(STRANGER, 'select * from enquiries')).rows.length, 0);
  assert.equal((await as(null, 'select * from enquiries')).rows.length, 0);
  assert.equal((await as(NEHA, 'select * from enquiries')).rows.length, 1);
  assert.equal((await as(NEHA, 'select * from enquiry_hamper_items')).rows.length, 2);
});

test('admins can change an enquiry status but not the customer details', async () => {
  await assert.rejects(as(NEHA, `update enquiries set email = 'x@example.com'`), /permission denied/);
  await as(NEHA, `update enquiries set status = 'cancelled'`);
  assert.equal((await db.query(`select stock_qty from products where id = 'j2'`)).rows[0].stock_qty, 10, 'cancel returns stock');
});

test('hidden products disappear for visitors but not for admins', async () => {
  await as(NEHA, `update products set active = false where id = 'd1'`);
  assert.equal((await as(null, `select id from products where id = 'd1'`)).rows.length, 0);
  assert.equal((await as(NEHA, `select id from products where id = 'd1'`)).rows.length, 1);
});

test('only admins change blank bases; visitors can read them', async () => {
  await as(STRANGER, `update bases set stock_qty = 50 where id = 'planter-21'`);
  assert.equal((await db.query(`select stock_qty from bases where id = 'planter-21'`)).rows[0].stock_qty, 3);
  await as(NEHA, `update bases set stock_qty = 6 where id = 'planter-21'`);
  assert.equal((await db.query(`select stock_qty from bases where id = 'planter-21'`)).rows[0].stock_qty, 6);
  assert.equal((await as(null, `select id from bases`)).rows.length, 4);
  await as(NEHA, `insert into bases (id, name, stock_qty) values ('vase-small', 'Small glass vase', 4)`);
  await assert.rejects(as(STRANGER, `insert into bases (id, name) values ('x', 'x')`), /row-level security/);
  await as(NEHA, `update products set base_id = 'vase-small' where id = 'v1'`);
  assert.equal((await db.query(`select base_id from products where id = 'v1'`)).rows[0].base_id, 'vase-small');
});

test('REQ-B8: an admin can add a product on a new base in one go; others cannot', async () => {
  await as(NEHA, `insert into bases (id, name, stock_qty) values ('vase-tall', 'Tall vase', 2)`);
  await as(NEHA, `insert into products (id, slug, category, name, price_cents, stock_qty, base_id, hamper_eligible, details)
                  values ('n-peacock-vase', 'peacock-vase', 'vases', 'Peacock vase', 4800, 0, 'vase-tall', true, '{"sample":false}')`);
  const { rows } = await db.query(`select base_id, hamper_eligible from products where id = 'n-peacock-vase'`);
  assert.deepEqual(rows[0], { base_id: 'vase-tall', hamper_eligible: true });
  await assert.rejects(as(STRANGER, `insert into products (id, slug, category, name) values ('x', 'x', 'vases', 'X')`), /row-level security/);
});
