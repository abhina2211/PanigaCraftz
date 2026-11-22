/* PanigaCraftz storefront.
   Merges the design from the Claude chat (header dropdowns, carousel, recent products,
   quick view, enquiry list) with the festival prototype (festival engine, personalisation,
   3-step custom order form). Lines marked BACKEND HOOK are where Supabase calls go later. */
{
const { IG, CATEGORIES, HAMPER_TYPES, OCCASIONS, FESTIVALS, PACKAGING_DEFAULT, HAMPER_BUILDER, PRODUCTS, IG_STRIP, SHIPPING, rules } = window.PC;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const aud = n => '$' + (Number.isInteger(n) ? n : n.toFixed(2));
const byId = id => PRODUCTS.find(p => p.id === id);
const catName = id => (CATEGORIES.find(c => c.id === id) || {}).name || '';
const occName = id => (OCCASIONS.find(o => o.id === id) || {}).name || id;
const htName = id => (HAMPER_TYPES.find(h => h.id === id) || {}).name || '';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const daysUntil = iso => Math.max(0, Math.ceil((new Date(iso + 'T00:00:00') - today()) / 864e5));
const priceText = p => p.price == null ? 'Price on enquiry' : (p.priceFrom ? 'From ' : '') + aud(p.price);
const IG_DM = `https://ig.me/m/${IG}`;
const igPost = (id, kind = 'p') => `https://www.instagram.com/${kind}/${id}/`;

/* BACKEND HOOK: log interest (planned table interest_events: product_id, source, created_at). */
const trackInterest = (productId, source) => { console.info('[PanigaCraftz] interest', { productId, source, at: new Date().toISOString() }); };

/* ---------- drawn placeholders for products without photos ---------- */
const LEAF = 'M0 0C9-11 25-11 34 0C25 11 9 11 0 0z';
const deco = c => `<g fill="${c}"><path d="${LEAF}" transform="translate(-30 -6) rotate(-30)"/><path d="${LEAF}" transform="translate(-4 8) rotate(20)" opacity=".6"/><circle cx="18" cy="-10" r="6" fill="#e8a7ab"/><circle cx="-24" cy="18" r="4" fill="#6e1f24"/></g>`;
const shapes = {
  candles: a => `<path d="M60 60h80v90a6 6 0 0 1-6 6H66a6 6 0 0 1-6-6z" fill="#fffaf8" stroke="#ead6d4"/><ellipse cx="100" cy="60" rx="40" ry="8" fill="#f5e8e6"/><path d="M100 52v-12" stroke="#5a3a3a" stroke-width="2"/><path d="M100 22c6 8 6 14 0 18c-6-4-6-10 0-18z" fill="#f0a040"/><g transform="translate(100 108)">${deco(a)}</g>`,
  tealights: a => `<path d="M68 80h64l-6 66H74z" fill="#ffffff" fill-opacity=".85" stroke="#dcc8c6"/><ellipse cx="100" cy="80" rx="32" ry="6" fill="#f5e8e6"/><path d="M100 60c5 7 5 12 0 16c-5-4-5-9 0-16z" fill="#f0a040"/><g transform="translate(100 115) scale(.85)">${deco(a)}</g>`,
  vases: a => `<path d="M88 34h24v14c18 10 26 30 22 56c-3 24-14 42-34 42s-31-18-34-42c-4-26 4-46 22-56z" fill="#fffaf8" stroke="#e1cfcd"/><path d="M80 70l10 8M118 92l10-6M86 120l8 6" stroke="#cdb6b3"/><g transform="translate(100 98)">${deco(a)}</g>`,
  jars: a => `<rect x="62" y="40" width="76" height="16" rx="5" fill="#c9a07b"/><path d="M58 58h84v84a12 12 0 0 1-12 12H70a12 12 0 0 1-12-12z" fill="#fffaf8" stroke="#e1cfcd"/><g transform="translate(100 104)">${deco(a)}</g>`,
  planters: a => `<path d="M84 64c-14-20-6-34 10-36c-2 14 2 24 6 36zM116 64c14-20 6-34-10-36c2 14-2 24-6 36z" fill="#5f7d55"/><rect x="56" y="62" width="88" height="14" rx="4" fill="#ecdcd8"/><path d="M62 76h76l-10 74H72z" fill="#fffaf8" stroke="#e1cfcd"/><g transform="translate(100 112)">${deco(a)}</g>`,
  decor: a => `<rect x="40" y="128" width="120" height="14" rx="5" fill="#ecdcd8"/><path d="M56 70h28v58H56z" fill="#fffaf8" stroke="#e1cfcd"/><rect x="62" y="58" width="16" height="12" fill="#c9a07b"/><path d="M66 58v-10h14" stroke="#c9a07b" stroke-width="4" fill="none"/><path d="M96 84h28l-4 44h-20z" fill="#fffaf8" stroke="#e1cfcd"/><g transform="translate(70 100) scale(.55)">${deco(a)}</g><g transform="translate(110 108) scale(.5)">${deco(a)}</g><ellipse cx="142" cy="126" rx="14" ry="4" fill="${a}"/>`,
  hampers: a => `<path d="M60 60c0-40 80-40 80 0" fill="none" stroke="#a87b52" stroke-width="6"/><rect x="74" y="54" width="20" height="30" rx="3" fill="#fffaf8" stroke="#e1cfcd"/><rect x="100" y="48" width="24" height="36" rx="4" fill="#fffaf8" stroke="#e1cfcd"/><path d="M44 80h112l-12 70H56z" fill="#d1a678"/><path d="M50 100h100M53 120h94M55 138h90" stroke="#a87b52" stroke-width="3"/><path d="M90 84l10 14 10-14" fill="${a}"/><circle cx="100" cy="86" r="5" fill="${a}"/>`
};
const pic = (cat, bg, a, label) => `<svg viewBox="0 0 200 180" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(label || 'Illustration of ' + cat)}"><rect width="200" height="180" fill="${bg}"/>${shapes[cat](a)}</svg>`;
const imgOf = (p, lazy = true) => p.img ? `<img src="${p.img}" alt="${esc(p.name)}"${lazy ? ' loading="lazy"' : ''}>` : pic(p.cat, ...(p.col || ['#fbefee', '#c0403a']), p.name);
const statusHtml = p => p.status ? `<span class="status ${p.status}">${{ in: 'In stock', made: 'Made to order', sold: 'Sold out' }[p.status]}</span>` : '';

/* ---------- festival engine ---------- */
const nextFestival = () => Object.entries(FESTIVALS).map(([id, f]) => ({ id, ...f }))
  .filter(f => new Date(f.date + 'T00:00:00') >= today())
  .sort((a, b) => new Date(a.date) - new Date(b.date))[0] || null;
let fest = null;
const applyFestival = id => {
  fest = id === 'auto' ? nextFestival() : (FESTIVALS[id] ? { id, ...FESTIVALS[id] } : null);
  const bar = $('#bar');
  if (fest) {
    bar.style.background = fest.accent;
    $('#announce').textContent = fest.announcement;
    const d = daysUntil(fest.orderBy);
    $('#countdown').hidden = false;
    $('#countdown').textContent = d === 0 ? 'Last day to order' : `${d} day${d === 1 ? '' : 's'} to order`;
  } else { bar.style.background = ''; $('#countdown').hidden = true; $('#announce').textContent = 'Handmade in Sydney. Australia-wide shipping.'; }
  buildSlides();
  $$('#fbuttons .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.fprev === id));
};

/* ---------- hero carousel (slide 1 follows the active festival) ---------- */
let cur = 0, timer = null, SLIDES = [];
const LEAVES = `<svg class="leaves" viewBox="0 0 400 400" aria-hidden="true"><defs><path id="lf" d="${LEAF}"/></defs><g fill="#e8c4c6" stroke="#c0403a" stroke-width="1.2"><use href="#lf" transform="translate(14 96) rotate(-35) scale(1.5)"/><use href="#lf" transform="translate(326 34) rotate(40) scale(1.3)"/><use href="#lf" transform="translate(356 300) rotate(110) scale(1.2)"/><use href="#lf" transform="translate(40 318) rotate(-80) scale(1.2)"/></g><g fill="#c0403a"><circle cx="72" cy="58" r="8"/><circle cx="372" cy="190" r="6"/></g></svg>`;
function buildSlides() {
  SLIDES = [];
  if (fest) SLIDES.push({ badge: fest.name, accent: fest.accent, eye: fest.eyebrow, h: fest.headline, t: fest.sub, cta: [fest.cta, 'occ:' + fest.occ], art: `<img src="${fest.img}" alt="">` });
  SLIDES.push({ eye: 'Our signature', h: 'Decoupage planters, layered and sealed by hand', t: 'From our first best-seller, the Blue Tile Planter, to statement tripod pots. Each one is a one-off.', cta: ['Shop planters', 'cat:planters'], art: `<img src="images/planters/CLDJx4NBfqU.jpg" alt="Blue tile decoupage planter on a timber stand">` });
  SLIDES.push({ eye: 'Hampers for every occasion', h: 'Festive, personal and corporate hampers', t: 'Christmas, Diwali, baby showers, birthdays and client thank-yous, each with a handmade piece inside.', cta: ['Explore hampers', 'cat:hampers'], art: pic('hampers', '#fbefee', '#c0403a', 'Illustration of a gift hamper') });
  if (!fest) SLIDES.unshift({ eye: 'Handmade in Sydney', h: 'Decoupaged gifts, made by hand and made personal', t: 'Plain candles, jars, vases and planters, given colour one piece at a time.', cta: ['Shop teacher gifts', 'occ:teacher'], art: `<img src="images/products/candle-1.jpg" alt="Decoupage candle, gift-boxed with ribbon">` });
  $('#slides').innerHTML = SLIDES.map((s, i) => `<div class="slide${i ? '' : ' on'}" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${SLIDES.length}"><div>${s.badge ? `<span class="fest-badge" style="background:${s.accent}">${esc(s.badge)}</span>` : ''}<p class="eyebrow">${esc(s.eye)}</p>${i ? `<h2 style="font-size:clamp(32px,4.8vw,50px)">${esc(s.h)}</h2>` : `<h1>${esc(s.h)}</h1>`}<p class="lead">${esc(s.t)}</p><div class="cta"><button class="btn" data-go="${s.cta[1]}">${esc(s.cta[0])}</button><a class="btn ghost" href="#recent">See what's new</a></div></div><div class="art"><div class="photo">${s.art}</div>${LEAVES}</div></div>`).join('');
  $('#dots').innerHTML = SLIDES.map((s, i) => `<button aria-label="Show slide ${i + 1}" aria-current="${!i}" data-slide="${i}"></button>`).join('');
  cur = 0; auto();
}
const show = i => { cur = (i + SLIDES.length) % SLIDES.length; $$('.slide').forEach((s, k) => s.classList.toggle('on', k === cur)); $$('#dots button').forEach((d, k) => d.setAttribute('aria-current', k === cur)); };
const auto = () => { clearInterval(timer); if (!reduce) timer = setInterval(() => show(cur + 1), 6000); };
$('#prev').onclick = () => { show(cur - 1); auto(); };
$('#next').onclick = () => { show(cur + 1); auto(); };
$('.hero').addEventListener('mouseenter', () => clearInterval(timer));
$('.hero').addEventListener('mouseleave', auto);

/* ---------- static lists ---------- */
const catPic = { candles: ['#f8e4e4', '#c0403a'], tealights: ['#f3e6dc', '#6e1f24'], vases: ['#f8e4e4', '#c0403a'], jars: ['#f3e6dc', '#c0403a'], decor: ['#e3eaf5', '#c0403a'], hampers: ['#f8e4e4', '#6e1f24'] };
const catImg = c => c.id === 'planters' ? `<img src="images/planters/CX__oHHB4Pj.jpg" alt="" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px">` : c.id === 'candles' ? `<img src="images/products/candle-1.jpg" alt="" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px">` : pic(c.id, ...catPic[c.id]);
$('#dropProducts').innerHTML = CATEGORIES.filter(c => c.id !== 'hampers').map(c => `<li><a href="#${c.id}" data-cat="${c.id}">${c.name}<small>${c.blurb}</small></a></li>`).join('') + `<li><a href="#shop" data-cat="all">All products<small>Everything in one place</small></a></li>`;
$('#dropHampers').innerHTML = HAMPER_TYPES.map(h => `<li><a href="#hampers-${h.id}" data-ht="${h.id}">${h.name}<small>${h.blurb}</small></a></li>`).join('') + `<li><a href="#build" data-build>Build your own hamper<small>Pick from what's in stock</small></a></li><li><a href="#hampers" data-cat="hampers">All hampers<small>Every hamper we make</small></a></li>`;
$('#footCats').innerHTML = CATEGORIES.filter(c => c.id !== 'hampers').map(c => `<button data-cat="${c.id}">${c.name}</button>`).join('');
$('#footHampers').innerHTML = HAMPER_TYPES.map(h => `<button data-ht="${h.id}">${h.name}</button>`).join('');
$('#cats').innerHTML = CATEGORIES.map(c => `<button class="cat" data-cat="${c.id}">${catImg(c)}<b>${c.name}</b><small>${c.blurb}</small></button>`).join('');
$('#igstrip').innerHTML = IG_STRIP.map(x => `<a href="${igPost(x.id, x.kind)}" aria-label="Open Instagram post"><img src="images/planters/${x.id}.jpg" alt="PanigaCraftz planter on Instagram" loading="lazy">${x.kind === 'reel' ? '<span>Reel</span>' : ''}</a>`).join('');
$('#coOcc').innerHTML = OCCASIONS.map(o => `<option>${o.name}</option>`).join('') + Object.values(FESTIVALS).filter(f => !OCCASIONS.some(o => o.name.startsWith(f.name))).map(f => `<option>${f.name}</option>`).join('') + '<option>Wedding or engagement</option><option>Other</option>';
$('#fbuttons').innerHTML = [['auto', 'Auto (by date)'], ...Object.entries(FESTIVALS).map(([id, f]) => [id, f.name])].map(([id, n]) => `<button class="chip" data-fprev="${id}" aria-pressed="false">${n}</button>`).join('');

/* ---------- product cards ---------- */
const recentIds = [...PRODUCTS].sort((a, b) => b.added - a.added).slice(0, 6).map(p => p.id);
const card = p => `<article class="p"><div class="img">${imgOf(p)}${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : recentIds.includes(p.id) ? '<span class="badge new">New</span>' : ''}<button class="qv" data-quick="${p.id}" aria-label="Quick view: ${esc(p.name)}">Quick view</button></div>
 <div class="body"><span class="cat-l">${p.ht ? htName(p.ht) : catName(p.cat)}</span><h3>${esc(p.name)}</h3>${p.size || p.status ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${statusHtml(p)}${p.size ? `<span class="size">${esc(p.size)}</span>` : ''}</div>` : ''}<p>${esc(p.d.split('. ')[0].replace(/\.$/, ''))}.</p>
 <div class="row"><span class="price"${p.price == null ? ' style="font-size:16px"' : ''}>${priceText(p)}</span>${p.builder ? `<button class="btn" data-build>Build</button>` : `<button class="btn" data-add="${p.id}"${p.status === 'sold' ? ' disabled' : ''}>Add</button>`}</div></div></article>`;
$('#rail').innerHTML = recentIds.map(id => card(byId(id))).join('');

/* ---------- shop: filters, price band, sort, shareable hash links ---------- */
let filter = 'all', ht = null, occ = null, list = [];
function render() {
  const band = $('#priceBand').value, sort = $('#sort').value;
  list = PRODUCTS.filter(p => (filter === 'all' || p.cat === filter) && (!ht || p.ht === ht) && (!occ || p.occ.includes(occ)));
  if (band) { const [lo, hi] = band.split('-').map(Number); list = list.filter(p => p.price != null && p.price >= lo && p.price < hi); }
  if (sort === 'new') list.sort((a, b) => b.added - a.added);
  if (sort === 'low') list.sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));
  if (sort === 'high') list.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
  const title = occ ? occName(occ) + ' gifts' : ht ? htName(ht) : filter === 'all' ? 'All handmade pieces' : catName(filter);
  $('#shopTitle').textContent = title;
  $('#shopLead').textContent = occ ? `${list.length} pieces suited to this occasion.` : ht ? HAMPER_TYPES.find(h => h.id === ht).blurb + '.' : filter === 'all' ? `${list.length} handmade pieces. Pick a category or occasion to narrow it down.` : CATEGORIES.find(c => c.id === filter).blurb + '.';
  $('#grid').innerHTML = list.map(card).join('') || '<p>Nothing here yet. Ask us about a custom order.</p>';
  $('#filter').innerHTML = [{ id: 'all', name: 'All' }, ...CATEGORIES].map(c => `<button class="chip" data-f="${c.id}" aria-pressed="${filter === c.id && !occ}">${c.name}</button>`).join('');
  $('#subfilter').innerHTML = filter === 'hampers'
    ? [{ id: '', name: 'All hampers' }, ...HAMPER_TYPES].map(h => `<button class="chip" data-hf="${h.id}" aria-pressed="${(ht || '') === h.id}">${h.name}</button>`).join('')
    : OCCASIONS.map(o => `<button class="chip" data-occ="${o.id}" aria-pressed="${occ === o.id}">${o.name}</button>`).join('');
}
$('#priceBand').onchange = render; $('#sort').onchange = render;
const setHash = h => { try { history.replaceState(null, '', h ? '#' + h : location.pathname); } catch (e) {} };
const goShop = () => { closeMenu(); $('#shop').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); };
/* Shareable links for Instagram posts and bio: #planters, #hampers-festive, #gifts-teacher */
function fromHash() {
  const h = location.hash.slice(1);
  if (h === 'preview') { $('#fpreview').classList.add('on'); return false; }
  if (h === 'build') return false;
  let m;
  if (CATEGORIES.some(c => c.id === h)) { filter = h; ht = null; occ = null; }
  else if ((m = h.match(/^hampers-(\w+)$/)) && HAMPER_TYPES.some(x => x.id === m[1])) { filter = 'hampers'; ht = m[1]; occ = null; }
  else if ((m = h.match(/^gifts-(\w+)$/)) && OCCASIONS.some(o => o.id === m[1])) { filter = 'all'; ht = null; occ = m[1]; }
  else return false;
  render(); return true;
}

/* ---------- quick view with personalisation ---------- */
const dlg = $('#qview'); let qid = null, qq = 1, qset = [];
const packOptions = sel => [PACKAGING_DEFAULT, ...Object.values(FESTIVALS).map(f => f.packaging)].map(o => `<option${o === sel ? ' selected' : ''}>${esc(o)}</option>`).join('');
function openQuick(id, set) {
  qset = set && set.length ? set : PRODUCTS.map(p => p.id); qid = id; qq = 1; fillQuick();
  if (!dlg.open) { try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); } }
  trackInterest(id, 'quick_view');
}
function fillQuick() {
  const p = byId(qid);
  $('#qImg').innerHTML = imgOf(p, false);
  $('#qCat').textContent = p.ht ? htName(p.ht) : catName(p.cat);
  $('#qName').textContent = p.name; $('#qPrice').textContent = priceText(p);
  $('#qStatus').innerHTML = statusHtml(p); $('#qSize').textContent = p.size || '';
  $('#qDesc').textContent = p.d;
  $('#qList').innerHTML = ['Decorated by hand with decoupage, so each piece is unique', 'Gift-wrapped and ready to give', 'Ships Australia-wide, or pick up in Sydney'].map(s => `<li>${s}</li>`).join('');
  const pc = rules.persOf(p);
  $('#qPers').hidden = !pc;
  if (pc) { $('#qPersLabel').textContent = pc.label; $('#qPersText').placeholder = pc.words <= 5 ? 'e.g. Ms Lee' : 'Your message'; }
  $('#qPersText').value = ''; $('#qNote').value = ''; $('#qNoteCount').textContent = '0 / 150';
  $('#qPack').innerHTML = packOptions(fest ? fest.packaging : PACKAGING_DEFAULT);
  $('#qTags').innerHTML = p.occ.map(o => `<span>${esc(occName(o))}</span>`).join('');
  $('#qQty').textContent = qq;
  $('#qAdd').disabled = p.status === 'sold'; $('#qAdd').textContent = p.status === 'sold' ? 'Sold out' : p.builder ? 'Start building' : 'Add to enquiry';
  persInput();
  const ig = $('#qIg'); ig.hidden = !p.ig; if (p.ig) ig.href = igPost(p.ig);
  $('#qPrev').hidden = $('#qNext').hidden = qset.length < 2;
}
const stepQuick = d => { const i = qset.indexOf(qid); qid = qset[(i + d + qset.length) % qset.length]; qq = 1; fillQuick(); };
$('#qClose').onclick = () => dlg.close();
$('#qPrev').onclick = () => stepQuick(-1); $('#qNext').onclick = () => stepQuick(1);
$('#qMinus').onclick = () => { qq = Math.max(1, qq - 1); $('#qQty').textContent = qq; };
$('#qPlus').onclick = () => { qq = Math.min(500, qq + 1); $('#qQty').textContent = qq; };
/* REQ-P3: live word count; Add is blocked while the text is over the product's limit. */
function persInput() {
  const p = byId(qid), pc = rules.persOf(p), text = $('#qPersText').value;
  if (!pc) return true;
  const r = rules.checkPers(p, text);
  $('#qPersCount').textContent = r.words ? `${r.words} / ${pc.words} words` : `(optional, up to ${pc.words} word${pc.words === 1 ? '' : 's'})`;
  $('#qPersErr').textContent = r.msg || ''; $('#qPersErr').hidden = r.ok;
  $('#qPersText').classList.toggle('field-error', !r.ok); $('#qPersText').setAttribute('aria-invalid', !r.ok);
  $('#qPersPreview').textContent = text;
  if (p.status !== 'sold') $('#qAdd').disabled = !r.ok;
  return r.ok;
}
$('#qPersText').oninput = persInput;
$('#qNote').oninput = e => { $('#qNoteCount').textContent = `${e.target.value.length} / 150`; };
$('#qAdd').onclick = () => {
  const p = byId(qid);
  if (p.builder) { dlg.close(); goBuild(); return; }
  const opts = p.pers ? { text: $('#qPersText').value.trim().replace(/\s+/g, ' '), packaging: $('#qPack').value, note: $('#qNote').value.trim() } : {};
  if (addToBag(qid, qq, opts)) dlg.close();
};
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
dlg.addEventListener('keydown', e => { if (e.target.matches('input,textarea,select')) return; if (e.key === 'ArrowRight') stepQuick(1); if (e.key === 'ArrowLeft') stepQuick(-1); });

/* ---------- enquiry list (cart): same product + same personalisation = one line ---------- */
let bag = [], dropped = [];
const lineKey = (id, opts) => id + '|' + JSON.stringify(opts);
try {
  /* v2 lists stored the personalisation as opts.name; it is now opts.text. */
  const raw = JSON.parse(localStorage.getItem('pc-bag-v3') || 'null') ?? JSON.parse(localStorage.getItem('pc-bag-v2') || '[]').map(i => {
    const o = Object.assign({}, i.opts); if ('name' in o) { o.text = o.name; delete o.name; }
    return { id: i.id, qty: i.qty, opts: o, key: lineKey(i.id, o) };
  });
  /* Stock and limits may have changed since the last visit: re-check every line (REQ-P4, REQ-H4). */
  raw.forEach(l => { const r = rules.checkLine(l, bag); if (r.ok) bag.push(l); else dropped.push(r.msg); });
} catch (e) { bag = []; }
const saveBag = () => { try { localStorage.setItem('pc-bag-v3', JSON.stringify(bag)); } catch (e) {} };
/* Every add goes through the rules, whichever screen it comes from. Returns false if refused. */
function addToBag(id, qty = 1, opts = {}) {
  const key = lineKey(id, opts);
  const line = bag.find(i => i.key === key);
  const next = { key, id, qty: Math.min(500, (line ? line.qty : 0) + qty), opts };
  const r = rules.checkLine(next, bag);
  if (!r.ok) { toast(r.msg); return false; }
  if (line) line.qty = next.qty; else bag.push(next);
  saveBag(); renderBag(); trackInterest(id, 'add_to_enquiry');
  toast(`${qty} added to your enquiry list`);
  return true;
}
const unitPrice = i => { const p = byId(i.id); return p.builder ? rules.hamperPrice(i.opts.items) : p.price; };
const unitText = i => byId(i.id).builder ? aud(unitPrice(i)) : priceText(byId(i.id));
const persText = i => { const pc = rules.persOf(byId(i.id)); return pc ? pc.label : 'Personalisation'; };
const itemsText = i => (i.opts.items || []).map(it => `${it.qty} x ${byId(it.id).name}`).join(', ');
const totals = () => {
  const priced = bag.filter(i => unitPrice(i) != null);
  const sub = priced.reduce((s, i) => s + unitPrice(i) * i.qty, 0);
  const ship = sub === 0 || sub >= SHIPPING.freeOver ? 0 : SHIPPING.flat;
  return { sub, ship, total: sub + ship, unpriced: bag.length - priced.length, count: bag.reduce((s, i) => s + i.qty, 0) };
};
function renderBag() {
  const t = totals();
  $('#bagCount').textContent = t.count;
  $('#bagFoot').hidden = !bag.length;
  $('#bagList').innerHTML = bag.length ? bag.map(i => {
    const p = byId(i.id), o = i.opts || {};
    return `<li><div class="thumb">${imgOf(p)}</div><div class="li-main"><b>${esc(p.name)}</b><small>${unitText(i)}${unitPrice(i) != null ? ' each' : ''}</small>
      ${o.items ? `<small>Contains: ${esc(itemsText(i))}</small>` : ''}${o.text ? `<small>${esc(persText(i))}: <i>${esc(o.text)}</i></small>` : ''}${o.packaging ? `<small>Packaging: ${esc(o.packaging)}</small>` : ''}${o.note ? `<small>Card: “${esc(o.note)}”</small>` : ''}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px"><span class="qty"><button data-dec="${esc(i.key)}" aria-label="One fewer">−</button><span>${i.qty}</span><button data-inc="${esc(i.key)}" aria-label="One more">+</button></span><button class="remove" data-remove="${esc(i.key)}">Remove</button></div></div></li>`;
  }).join('') : '<li>Your list is empty. Add a few pieces to get started.</li>';
  $('#bagSub').textContent = aud(t.sub) + (t.unpriced ? ' + quote' : '');
  $('#bagShip').textContent = t.sub === 0 ? 'To confirm' : t.ship ? aud(t.ship) : 'Free';
  $('#bagTotal').textContent = aud(t.total) + (t.unpriced ? ' + quote' : '');
  const left = Math.max(0, SHIPPING.freeOver - t.sub);
  $('#shipMsg').textContent = left > 0 ? `${aud(left)} away from free Australia-wide shipping (estimate).` : 'Free Australia-wide shipping unlocked (estimate).';
  $('#shipBar').style.width = Math.min(100, t.sub / SHIPPING.freeOver * 100) + '%';
  renderBuilder(); /* stock held by hampers in the list changes what the builder can offer */
}
const bagMsg = () => {
  if (!bag.length) return '';
  const t = totals();
  const lines = bag.map(i => { const p = byId(i.id), o = i.opts || {}; return `- ${i.qty} x ${p.name} (${unitText(i)}${unitPrice(i) != null ? ' each' : ''})` + (o.items ? `\n   Contains: ${itemsText(i)}` : '') + (o.text ? `\n   ${persText(i)}: ${o.text}` : '') + (o.packaging ? `\n   Packaging: ${o.packaging}` : '') + (o.note ? `\n   Card: "${o.note}"` : ''); });
  return `Hi Neha! I'd like to order:\n${lines.join('\n')}\nEstimated total: ${aud(t.total)}${t.unpriced ? ' plus items to quote' : ''}\nPlease confirm availability, delivery and the final price. Thank you!`;
};

/* ---------- build-your-own hamper: only pieces in stock (REQ-H1..H5) ---------- */
/* BACKEND HOOK: read stock from the products table; submit through the submit_enquiry
   function, which re-checks and holds the stock in one transaction (supabase/schema.sql). */
const BUILDER_ID = (PRODUCTS.find(p => p.builder) || {}).id;
let hb = {}; /* product id -> quantity in the hamper being built */
const hbItems = () => Object.entries(hb).map(([id, qty]) => ({ id, qty }));
function renderBuilder() {
  /* Trim anything that went out of stock while building. */
  Object.keys(hb).forEach(id => { const left = rules.available(id, bag); if (hb[id] > left) hb[id] = left; if (!hb[id]) delete hb[id]; });
  const pieces = hbItems().reduce((s, it) => s + it.qty, 0);
  const full = pieces >= HAMPER_BUILDER.maxItems;
  const eligible = PRODUCTS.filter(p => p.hamper && !p.builder);
  eligible.sort((a, b) => (rules.available(b.id, bag) > 0) - (rules.available(a.id, bag) > 0));
  $('#hbItems').innerHTML = eligible.map(p => {
    const left = rules.available(p.id, bag), n = hb[p.id] || 0, ok = left > 0;
    return `<li class="${ok ? '' : 'out'}"><div class="thumb">${imgOf(p)}</div><div class="info"><b>${esc(p.name)}</b><small>${priceText(p)}</small><small>${ok ? `${left} in stock` : 'Out of stock'}</small></div>
      <span class="qty"><button data-hb-dec="${p.id}" aria-label="One fewer ${esc(p.name)}"${n ? '' : ' disabled'}>−</button><span>${n}</span><button data-hb-inc="${p.id}" aria-label="One more ${esc(p.name)}"${ok && n < left && !full ? '' : ' disabled'}>+</button></span></li>`;
  }).join('');
  $('#hbChosen').innerHTML = pieces ? hbItems().map(it => `<li>${it.qty} x ${esc(byId(it.id).name)}</li>`).join('') : `<li>Add at least ${HAMPER_BUILDER.minItems} pieces.</li>`;
  $('#hbPieces').textContent = `${pieces} of ${HAMPER_BUILDER.maxItems}`;
  $('#hbBase').textContent = aud(HAMPER_BUILDER.base);
  $('#hbTotal').textContent = aud(rules.hamperPrice(hbItems()));
  const nw = rules.wordCount($('#hbNote').value);
  $('#hbNoteCount').textContent = `${nw} / ${HAMPER_BUILDER.noteWords} words`;
  const r = rules.checkHamper(hbItems(), 1, bag, null, $('#hbNote').value);
  const shown = pieces ? r.errors : r.errors.filter(m => !m.startsWith('Choose at least'));
  $('#hbErr').textContent = shown.join(' '); $('#hbErr').hidden = !shown.length;
  $('#hbNote').classList.toggle('field-error', nw > HAMPER_BUILDER.noteWords);
  $('#hbAdd').disabled = !r.ok;
}
const goBuild = () => { closeMenu(); setHash('build'); $('#build').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); };
$('#hbNote').oninput = renderBuilder;
$('#hbAdd').onclick = () => {
  if (!BUILDER_ID) return;
  const items = hbItems().sort((a, b) => a.id.localeCompare(b.id));
  if (addToBag(BUILDER_ID, 1, { items, packaging: $('#hbPack').value, note: $('#hbNote').value.trim() })) { hb = {}; $('#hbNote').value = ''; renderBuilder(); }
};

/* ---------- custom order: 3 steps with validation ---------- */
let coStep = 1;
const coForm = $('#coForm');
function showStep(n) {
  coStep = n;
  $$('.co-step').forEach(s => { s.hidden = +s.dataset.step !== n; });
  $$('.prog b').forEach((b, i) => { b.style.width = i < n ? '100%' : '0'; });
  $('#stepLabel').textContent = `Step ${n} of 3: ${['What you need', 'The details', 'Your contact details'][n - 1]}`;
  $('#coBack').style.visibility = n === 1 ? 'hidden' : 'visible';
  $('#coNext').textContent = n === 3 ? 'Create my request' : 'Continue';
}
const setErr = (name, bad) => {
  const e = $(`#coForm .err[data-for="${name}"]`); if (e) e.hidden = !bad;
  const f = coForm.elements[name];
  if (f && f.type !== 'checkbox' && !(f instanceof RadioNodeList)) { f.classList.toggle('field-error', bad); f.setAttribute('aria-invalid', bad); }
  return !bad;
};
function validate(n) {
  const f = coForm.elements; let ok = true;
  if (n === 1) { ok = setErr('type', !f.type.value) && ok; const q = +f.qty.value; ok = setErr('qty', !(q >= 1 && q <= 500)) && ok; ok = setErr('budget', !f.budget.value) && ok; }
  if (n === 2) { ok = setErr('details', f.details.value.trim().length < 15) && ok; const min = today(); min.setDate(min.getDate() + 7); const d = f.date.value ? new Date(f.date.value + 'T00:00:00') : null; ok = setErr('date', !d || d < min) && ok; }
  if (n === 3) {
    ok = setErr('name', f.name.value.trim().length < 2) && ok;
    ok = setErr('email', !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim())) && ok;
    const ph = f.phone.value.replace(/[\s-]/g, ''); ok = setErr('phone', ph !== '' && !/^(\+?61|0)4\d{8}$/.test(ph)) && ok;
    ok = setErr('postcode', !/^\d{4}$/.test(f.postcode.value.trim())) && ok;
    ok = setErr('consent', !f.consent.checked) && ok;
  }
  return ok;
}
coForm.addEventListener('submit', e => {
  e.preventDefault();
  if (!validate(coStep)) { const first = $('#coForm .co-step:not([hidden]) .err:not([hidden])'); first && first.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); return; }
  if (coStep < 3) { showStep(coStep + 1); return; }
  const payload = Object.fromEntries(new FormData(coForm).entries());
  payload.ref = 'PC-' + Date.now().toString(36).toUpperCase().slice(-6);
  payload.submittedAt = new Date().toISOString();
  /* BACKEND HOOK: insert payload into the planned enquiries table (Supabase) and email Neha. */
  console.info('[PanigaCraftz] custom order enquiry', payload);
  const when = new Date(payload.date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  $('#customOut').textContent = `Hi Neha! Custom order request ${payload.ref}\nType: ${payload.type}\nOccasion: ${payload.occasion}\nQuantity: ${payload.qty}\nBudget per item: ${payload.budget}\nNeeded by: ${when}\nDetails: ${payload.details}\nName: ${payload.name}\nEmail: ${payload.email}${payload.phone ? `\nMobile: ${payload.phone}` : ''}\nPostcode: ${payload.postcode}`;
  $('#coRef').textContent = 'Reference ' + payload.ref;
  coForm.hidden = true; $('.prog').hidden = true; $('#stepLabel').hidden = true; $('#coDone').hidden = false;
});
$('#coBack').onclick = () => showStep(Math.max(1, coStep - 1));
$('#coRestart').onclick = () => { coForm.reset(); $$('#coForm .err').forEach(e => { e.hidden = true; }); $$('.field-error').forEach(e => e.classList.remove('field-error')); coForm.hidden = false; $('.prog').hidden = false; $('#stepLabel').hidden = false; $('#coDone').hidden = true; showStep(1); };
{ const min = today(); min.setDate(min.getDate() + 7); coForm.elements.date.min = min.toISOString().slice(0, 10); }

/* ---------- helpers: toast, copy, menus ---------- */
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2000); }
const copy = async t => { try { await navigator.clipboard.writeText(t); toast('Copied. Paste it into an Instagram DM'); } catch (e) { toast('Copy blocked. Select the text to copy it'); } };
const closeDrops = except => $$('[data-drop]').forEach(b => { if (b !== except) { b.setAttribute('aria-expanded', 'false'); $('#' + b.getAttribute('aria-controls')).classList.remove('open'); } });
function closeMenu() { closeDrops(); $('#menu').classList.remove('open'); $('#burger').setAttribute('aria-expanded', 'false'); }

document.addEventListener('click', e => {
  const t = e.target.closest('button,a');
  if (!t) { if (!e.target.closest('.menu')) closeDrops(); return; }
  const d = t.dataset;
  if ('drop' in d) { const open = t.getAttribute('aria-expanded') !== 'true'; closeDrops(t); t.setAttribute('aria-expanded', open); $('#' + t.getAttribute('aria-controls')).classList.toggle('open', open); return; }
  if (t.id === 'burger') { const o = !$('#menu').classList.contains('open'); $('#menu').classList.toggle('open', o); t.setAttribute('aria-expanded', o); return; }
  if (d.quick) { openQuick(d.quick, t.closest('#rail') ? recentIds : t.closest('#grid') ? list.map(p => p.id) : null); return; }
  if (d.slide) { show(+d.slide); auto(); return; }
  if (d.fprev) { applyFestival(d.fprev); return; }
  if (d.cat) { e.preventDefault(); filter = d.cat; ht = null; occ = null; render(); setHash(d.cat === 'all' ? 'shop' : d.cat); goShop(); }
  else if (d.ht) { e.preventDefault(); filter = 'hampers'; ht = d.ht; occ = null; render(); setHash('hampers-' + d.ht); goShop(); }
  else if (d.go) { const [k, v] = d.go.split(':'); if (k === 'cat') { filter = v; ht = null; occ = null; setHash(v); } else { filter = 'all'; ht = null; occ = v; setHash('gifts-' + v); } render(); goShop(); }
  else if (d.f) { filter = d.f; ht = null; occ = null; render(); }
  else if (d.hf !== undefined) { ht = d.hf || null; render(); }
  else if (d.occ) { const was = occ === d.occ; occ = was ? null : d.occ; filter = 'all'; ht = null; render(); if (!was) setHash('gifts-' + d.occ); if (!t.closest('#subfilter')) goShop(); }
  else if ('build' in d) { e.preventDefault(); goBuild(); }
  else if (d.hbInc || d.hbDec) { const id = d.hbInc || d.hbDec; hb[id] = Math.max(0, (hb[id] || 0) + (d.hbInc ? 1 : -1)); if (!hb[id]) delete hb[id]; renderBuilder(); }
  else if (d.add) { addToBag(d.add, 1, byId(d.add).pers ? { packaging: fest ? fest.packaging : PACKAGING_DEFAULT } : {}); }
  else if (d.inc) { const l = bag.find(i => i.key === d.inc); if (l) { const q = Math.min(500, l.qty + 1), r = rules.checkLine({ ...l, qty: q }, bag); if (!r.ok) toast(r.msg); else { l.qty = q; saveBag(); renderBag(); } } }
  else if (d.dec) { const l = bag.find(i => i.key === d.dec); if (l) { l.qty--; if (l.qty <= 0) bag = bag.filter(i => i !== l); saveBag(); renderBag(); } }
  else if (d.remove) { bag = bag.filter(i => i.key !== d.remove); saveBag(); renderBag(); }
  else if (t.id === 'openBag') { e.preventDefault(); closeMenu(); $('#drawer').classList.add('open'); $('#closeBag').focus(); }
  else if (t.id === 'closeBag') { $('#drawer').classList.remove('open'); }
  else if (t.id === 'copyBag') { const m = bagMsg(); if (m) { copy(m); bag.forEach(i => trackInterest(i.id, 'enquire_instagram')); } else toast('Add a piece first'); }
  else if (t.id === 'copyCustom') { copy($('#customOut').textContent); }
  else if (t.closest('.menu') && t.tagName === 'A') closeMenu();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeDrops(); $('#drawer').classList.remove('open'); } });
window.addEventListener('hashchange', () => { if (fromHash()) $('#shop').scrollIntoView(); });

/* ---------- start ---------- */
applyFestival('auto');
$('#hbPack').innerHTML = packOptions(fest ? fest.packaging : PACKAGING_DEFAULT);
showStep(1);
render();
renderBag();
if (fromHash()) setTimeout(() => $('#shop').scrollIntoView(), 50);
if (dropped.length) { saveBag(); setTimeout(() => toast(`Removed from your list. ${dropped[0]}`), 300); }
}
