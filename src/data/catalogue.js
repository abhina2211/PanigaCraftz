/* PanigaCraftz catalogue data.
   One place for products, categories, hamper types, occasions and festivals.
   Astro reads this at build time to make the menus and one page per product;
   the browser scripts import it too. In phase 3 the products come from Supabase
   (see supabase/schema.sql); until then, edit this file.

   Product fields
   id        unique id
   slug      web address of the product page (/products/<slug>/), made from the name
   cat       category id (see CATEGORIES)
   ht        hamper type id, hampers only (see HAMPER_TYPES)
   name, d   name and description
   price     number in AUD, or null for "price on enquiry"
   size      size text, or ''
   status    'in' (in stock), 'made' (made to order), 'sold' (sold out), or null if unknown.
             When stock is a number and status is not set, status follows stock.
   stock     ready-made pieces on hand, or null when not counted (REQ-H2). Placeholder counts until Neha confirms.
   base      id of the blank base this design is made on (see BASES), or undefined (REQ-B1)
   hamper    true if the piece can go in a build-your-own hamper (REQ-H1). Needs a stock count or a base.
   img/img2  photo paths; without a photo a drawn placeholder is used (col = [background, accent])
   pers      false, or the personalisation settings (REQ-P1, REQ-P2):
               true                       default: PERS_DEFAULT (label and word limit)
               { label, words }           own label and maximum number of words
             Packaging and a gift note are offered with any personalisable piece.
   builder   true for the build-your-own hamper product (priced by its pieces)
   occ       occasions it suits (see OCCASIONS)
   fest      festivals it is featured for (keys of FESTIVALS)
   added     ordering for "Recent products": higher = newer
   ig        Instagram post id the product came from, if known
   sample    true when name/price are placeholders written by Claude, not confirmed by Neha
*/
export const IG = 'panigacraftz_neha';

export const CATEGORIES = [
  { id: 'planters',  name: 'Planters',          blurb: 'Our signature decoupage pots' },
  { id: 'candles',   name: 'Candles',           blurb: 'Decoupaged and personalised' },
  { id: 'tealights', name: 'Tea light holders', blurb: 'Glass, wooden and named' },
  { id: 'vases',     name: 'Vases',             blurb: 'Rose crackle and bottle art' },
  { id: 'jars',      name: 'Jars & boxes',      blurb: 'Cookie jars and treat boxes' },
  { id: 'decor',     name: 'Home décor',        blurb: 'Bathroom sets, coasters, stands' },
  { id: 'hampers',   name: 'Gift hampers',      blurb: 'Festive, personal, corporate' }
];

export const HAMPER_TYPES = [
  { id: 'festive',   name: 'Festive hampers',   blurb: 'Christmas, Diwali, Lunar New Year, Eid' },
  { id: 'personal',  name: 'Personal hampers',  blurb: 'Teachers, birthdays, babies, anniversaries' },
  { id: 'corporate', name: 'Corporate hampers', blurb: 'Client and staff thank-yous, 10 to 500 boxes' }
];

export const OCCASIONS = [
  { id: 'teacher',     name: 'Teacher & year-end' },
  { id: 'christmas',   name: 'Christmas & Kris Kringle' },
  { id: 'diwali',      name: 'Diwali & Rakhi' },
  { id: 'mothersday',  name: "Mother's Day" },
  { id: 'birthday',    name: 'Birthday & anniversary' },
  { id: 'baby',        name: 'New baby & naming' },
  { id: 'housewarming',name: 'Housewarming' },
  { id: 'corporate',   name: 'Corporate' }
];

/* Festival engine (from the festival prototype). The site picks the nearest
   festival whose date hasn't passed. Dates need confirming each year. */
export const FESTIVALS = {
  christmas: { name: 'Christmas', date: '2026-12-25', orderBy: '2026-12-15', accent: '#1f5f45',
    announcement: 'Christmas and teacher gifts: order by 15 Dec for Australia-wide delivery',
    eyebrow: 'Christmas collection 2026', headline: 'A handmade Christmas, wrapped with love',
    sub: 'Personalised candles, decoupage planters and hampers for family, teachers and Kris Kringle.',
    cta: 'Shop Christmas gifts', occ: 'christmas', packaging: 'Christmas red & gold', img: '/images/products/candle-1.jpg',
    featured: ['h5', 'c1', 'p8', 'h1'] },
  lunar: { name: 'Lunar New Year', date: '2027-02-06', orderBy: '2027-01-27', accent: '#b3202a',
    announcement: 'Lunar New Year gifts: order by 27 Jan for Australia-wide delivery',
    eyebrow: 'Lunar New Year 2027', headline: 'Gift good fortune for the new year',
    sub: 'Blue-and-white willow planters and prosperity hampers for family and clients.',
    cta: 'Shop Lunar New Year', occ: 'corporate', packaging: 'Lunar crimson & gold', img: '/images/planters/CYlPJjtlT9n.jpg',
    featured: ['p6', 'h6', 'p1', 't2'] },
  eid: { name: 'Eid', date: '2027-03-10', orderBy: '2027-02-28', accent: '#17635f',
    announcement: 'Eid gifts: order by 28 Feb for Australia-wide delivery',
    eyebrow: 'Eid al-Fitr collection', headline: 'Eid Mubarak, beautifully handmade',
    sub: 'Tea light holders, rose planters and hampers finished by hand.',
    cta: 'Shop Eid gifts', occ: 'birthday', packaging: 'Eid emerald & gold', img: '/images/planters/CX__oHHB4Pj.jpg',
    featured: ['p7', 't3', 'h2', 'v1'] },
  mothersday: { name: "Mother's Day", date: '2027-05-09', orderBy: '2027-05-01', accent: '#a84f6e',
    announcement: "Mother's Day gifts: order by 1 May for Australia-wide delivery",
    eyebrow: "Mother's Day 2027", headline: 'For the woman who grew everything',
    sub: 'Rose planter sets, blue rose vases and pamper hampers she will keep for years.',
    cta: "Shop Mother's Day", occ: 'mothersday', packaging: "Mother's Day rose & sage", img: '/images/planters/CK5eCbqhQjs.jpg',
    featured: ['p3', 'v2', 'h2', 'p7'] },
  diwali: { name: 'Diwali', date: '2027-10-29', orderBy: '2027-10-19', accent: '#5b2a86',
    announcement: 'Diwali hampers and tea lights: order by 19 Oct for Australia-wide delivery',
    eyebrow: 'Diwali, the festival of lights', headline: 'Light up Diwali with something handmade',
    sub: 'Marigold planters, decorated tea light sets and Diwali hampers.',
    cta: 'Shop Diwali gifts', occ: 'diwali', packaging: 'Diwali marigold & purple', img: '/images/planters/CYWFXeIFDyK.jpg',
    featured: ['p4', 'h4', 't3', 'j3'] }
};
export const PACKAGING_DEFAULT = 'Classic kraft with ribbon';

/* Personalisation used when a product just says pers: true (REQ-P2). */
export const PERS_DEFAULT = { label: 'Name to add', words: 5 };

/* Build-your-own hamper (REQ-H1..H5). Fee and limits are placeholders to confirm with Neha. */
export const HAMPER_BUILDER = { base: 15, minItems: 2, maxItems: 8, noteWords: 30 };

/* Blank bases shared by several designs (REQ-B1). stock = blanks ready to decorate.
   Placeholder counts until Neha confirms. In Supabase: the bases table. */
export const BASES = [
  { id: 'planter-21', name: '21 cm planter on timber base', stock: 3 }
];

/* What a product shows (REQ-B2): ready-made pieces first ("In stock"), then blanks on
   its base ("Made to order"), otherwise "Sold out". A status Neha set by hand wins.
   Products with no count and no base show nothing. */
export function statusFor(p, bases = BASES) {
  if (p.fixedStatus) return p.fixedStatus;
  const base = p.base && bases.find(b => b.id === p.base);
  if (typeof p.stock === 'number' && p.stock > 0) return 'in';
  if (base && base.stock > 0) return 'made';
  if (typeof p.stock === 'number' || base) return 'sold';
  return null;
}

const P = (o) => {
  const p = Object.assign({ price: null, size: '', status: null, stock: null, hamper: false, pers: false, occ: [], fest: [], added: 0, sample: true }, o);
  p.fixedStatus = p.status;
  p.status = statusFor(p);
  p.slug = p.slug || p.name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return p;
};
const PL = id => `/images/planters/${id}.jpg`;

export const PRODUCTS = [
 // Planters: real photos and names from the other project (images/planters/<post id>.jpg).
 // Prices are prototype placeholders except Rose Mummy & Baby ($55, from the caption).
 P({ id:'p1', cat:'planters', name:'Blue Tile Planter on Stand', d:'Our first and best-selling design. Hand-decoupaged blue tile pattern on a timber stand, sealed for indoor and covered outdoor use.', price:69, img:PL('CLDJx4NBfqU'), ig:'CLDJx4NBfqU', badge:'Bestseller', occ:['housewarming','birthday'], fest:['lunar'], added:12 }),
 P({ id:'p2', cat:'planters', name:'Paris Butterfly Planter', d:'Vintage Paris motifs with fluttering butterflies. Fits a 15 cm pot. Made to order and can be personalised with a name.', price:59, size:'18 × 17 cm', status:'made', pers:true, img:PL('CWg4R7nBfbq'), ig:'CWg4R7nBfbq', occ:['mothersday','birthday'], fest:['mothersday'], added:15 }),
 P({ id:'p3', cat:'planters', name:'Rose Mummy & Baby Planter Set', d:'A matching pair of rose planters, one for mum and one for the little one. Add both names.', price:55, size:'Set of 2', pers:true, img:PL('CK5eCbqhQjs'), ig:'CK5eCbqhQjs', badge:"Mother's Day", occ:['mothersday','baby'], fest:['mothersday'], added:11, sample:false }),
 P({ id:'p4', cat:'planters', name:'Marigold Bloom Planter', d:'Bright marigold blooms hand-layered and sealed. A cheerful Diwali or housewarming gift.', price:49, pers:true, img:PL('CYWFXeIFDyK'), ig:'CYWFXeIFDyK', occ:['diwali','housewarming'], fest:['diwali'], added:17 }),
 P({ id:'p5', cat:'planters', name:'Tropical Leaf Tripod Planter', d:'Statement tropical-leaf planter on a tripod stand. Perfect for a monstera or fiddle leaf.', price:89, size:'44 cm tall with stand', img:PL('CKDDLd8hLCg'), ig:'CKDDLd8hLCg', occ:['housewarming'], added:10 }),
 P({ id:'p6', cat:'planters', name:'Blue Willow Footed Trough', d:'Classic blue-and-white willow pattern on a footed trough. Lovely for succulents or lucky bamboo.', price:65, size:'12 × 25 × 9.4 cm', img:PL('CYlPJjtlT9n'), ig:'CYlPJjtlT9n', occ:['housewarming','corporate'], fest:['lunar'], added:18 }),
 P({ id:'p7', cat:'planters', name:'Watercolour Rose Planter', d:'Soft watercolour roses on a hand-finished pot.', price:45, pers:true, img:PL('CX__oHHB4Pj'), ig:'CX__oHHB4Pj', occ:['mothersday','birthday','teacher'], fest:['eid','mothersday'], added:16 }),
 P({ id:'p8', cat:'planters', name:'Vintage Bouquet Mini Planter', d:'A petite vintage bouquet planter, the perfect stocking filler or Kris Kringle gift.', price:35, size:'11 × 10 cm', stock:3, hamper:true, pers:true, img:PL('CVEi430hYq_'), ig:'CVEi430hYq_', badge:'Under $40', occ:['christmas','teacher'], fest:['christmas'], added:14 }),
 P({ id:'p9', cat:'planters', name:'Leafy Raised Planter', d:'Blue leaf decoupage on a raised timber base.', img:PL('Ca8K_iDB095'), ig:'Ca8K_iDB095', occ:['housewarming'], added:20 }),
 P({ id:'p10',cat:'planters', name:'Line-Art Faces Stand Planter', d:'Modern line-art faces on a planter with a wooden stand.', img:PL('CaYI2OVBAaf'), ig:'CaYI2OVBAaf', occ:['housewarming','birthday'], added:21 }),
 P({ id:'p11',cat:'planters', name:'Bluebell Timber-Base Planter', d:'Bluebell florals on a planter with a timber base.', size:'21 × 21 cm', stock:1, base:'planter-21', img:PL('CZ1IhnVlWmM'), ig:'CZ1IhnVlWmM', occ:['housewarming','mothersday'], added:19 }),
 P({ id:'p12',cat:'planters', name:'Aztec Stripe Planter', d:'Bold Aztec stripes on an acacia stand.', size:'21 × 21 cm', stock:0, base:'planter-21', img:PL('CQanJlSBMwB'), ig:'CQanJlSBMwB', occ:['housewarming','corporate'], added:13 }),

 // Other lines: names from recent Instagram posts; prices and drawn pictures are placeholders.
 P({ id:'c1', cat:'candles', name:'Botanical decoupage candle', d:'Leaf and blossom design on a frosted candle jar, boxed with a satin ribbon.', price:22, img:'/images/products/candle-1.jpg', img2:'/images/products/candle-2.jpg', badge:'Teacher favourite', stock:8, hamper:true, pers:{ label:'Words beside the motif', words:15 }, occ:['teacher','christmas','birthday'], fest:['christmas'], added:60 }),
 P({ id:'c2', cat:'candles', name:'Personalised name candle', d:'A name added to the decoupage design. Popular as thank-you gifts for families and guests.', price:28, stock:5, hamper:true, pers:{ label:'Name or short message', words:10 }, occ:['teacher','housewarming','baby'], fest:['christmas'], added:44, col:['#f8e4e4','#c0403a'] }),
 P({ id:'c3', cat:'candles', name:'Blue rose candle', d:'Made to match the blue rose vase and diffuser set.', price:26, stock:0, hamper:true, occ:['mothersday','housewarming'], added:51, col:['#e3eaf5','#3d5f9a'] }),
 P({ id:'t1', cat:'tealights', name:'Personalised tea light holder', d:'Decoupaged glass with a name on the front.', price:18, badge:'Personalised', stock:6, hamper:true, pers:{ label:'Name to add', words:3 }, occ:['teacher','birthday'], added:58, col:['#fbefee','#c0403a'] }),
 P({ id:'t2', cat:'tealights', name:'Wooden tea light holder', d:'A unique wooden design, decoupaged by hand.', price:24, stock:3, hamper:true, occ:['housewarming','christmas'], added:43, col:['#f3e6dc','#6e1f24'] }),
 P({ id:'t3', cat:'tealights', name:'Festive glass tea light set', d:'A pair of decorated holders for Diwali evenings.', price:30, badge:'Festive', stock:4, hamper:true, occ:['diwali'], fest:['diwali','eid'], added:20, col:['#fbe9d6','#c0403a'] }),
 P({ id:'v1', cat:'vases', name:'Rose crackle vase', d:'Glass vase with rose decoupage and a crackle effect, her most detailed technique.', price:45, badge:'Signature', occ:['mothersday','housewarming','birthday'], fest:['eid'], added:50, col:['#f8e4e4','#c0403a'] }),
 P({ id:'v2', cat:'vases', name:'Blue rose vase set', d:'Vase, candle and diffuser in matching blue roses.', price:85, occ:['mothersday','housewarming'], fest:['mothersday'], added:52, col:['#e3eaf5','#3d5f9a'] }),
 P({ id:'v3', cat:'vases', name:'Decoupaged bottle vase', d:'An upcycled glass bottle turned into a statement vase.', price:30, pers:{ label:'Message on the bottle', words:50 }, occ:['housewarming','birthday'], added:49, col:['#fbefee','#6e1f24'] }),
 P({ id:'j1', cat:'jars', name:'Decoupaged cookie jar', d:'A glass cookie jar for the kitchen bench, ready to fill with homemade cookies.', price:32, stock:2, hamper:true, occ:['housewarming','christmas'], added:55, col:['#fbefee','#6e1f24'] }),
 P({ id:'j2', cat:'jars', name:'Festive chocolate box', d:'A decorated box to fill with Christmas chocolates.', price:20, badge:'Christmas', stock:10, hamper:true, occ:['christmas','teacher'], fest:['christmas'], added:30, col:['#f8e4e4','#c0403a'] }),
 P({ id:'j3', cat:'jars', name:'Storage jar', d:'Clip-top jar for tea, spices or treats.', price:25, stock:0, hamper:true, occ:['housewarming','diwali'], fest:['diwali'], added:22, col:['#f3e6dc','#c0403a'] }),
 P({ id:'d1', cat:'decor', name:'Decoupaged bathroom set', d:'Matching bathroom pieces. One customer came back after six years for the same set for a friend.', price:75, occ:['housewarming'], added:56, col:['#e3eaf5','#6e1f24'] }),
 P({ id:'d2', cat:'decor', name:'Travel-theme coasters', d:'A set of coasters for people who love to travel.', price:28, stock:4, hamper:true, occ:['birthday','christmas','corporate'], added:47, col:['#fbefee','#3d5f9a'] }),
 P({ id:'d3', cat:'decor', name:'Cutlery or pen stand', d:'Amsterdam-inspired stand for cutlery, pens or makeup brushes.', price:30, stock:3, hamper:true, occ:['housewarming','teacher','corporate'], added:42, col:['#f3e6dc','#c0403a'] }),
 P({ id:'h1', cat:'hampers', ht:'personal', name:'Teacher pamper hamper', d:'A personalised pamper hamper with a handmade decoupage piece and treats.', price:65, badge:'Year-end', pers:true, occ:['teacher','christmas'], fest:['christmas'], added:36, col:['#f8e4e4','#c0403a'] }),
 P({ id:'h2', cat:'hampers', ht:'personal', name:'Tea lover hamper', d:'A decorated cup with tea. "A little cup of friendship."', price:45, pers:true, occ:['birthday','mothersday'], fest:['eid','mothersday'], added:48, col:['#eef2e6','#6e1f24'] }),
 P({ id:'h3', cat:'hampers', ht:'personal', name:'New baby hamper', d:'To celebrate the arrival of a little one, for baby showers and naming ceremonies.', price:85, pers:true, occ:['baby'], added:46, col:['#e3eaf5','#c0403a'] }),
 P({ id:'h4', cat:'hampers', ht:'festive', name:'Diwali hamper', d:'Decorated tea lights, a treat box and festive touches for Diwali.', price:70, badge:'Festive', pers:true, occ:['diwali'], fest:['diwali'], added:21, col:['#fbe9d6','#c0403a'] }),
 P({ id:'h5', cat:'hampers', ht:'festive', name:'Christmas & Kris Kringle hamper', d:'A chocolate box, botanical candle and mini planter, made for Christmas surprises.', price:60, badge:'Christmas', pers:true, occ:['christmas','teacher'], fest:['christmas'], added:34, col:['#f8e4e4','#6e1f24'] }),
 P({ id:'h6', cat:'hampers', ht:'corporate', name:'Build-your-own corporate hamper', d:'Your logo on the card, festival-themed packaging, 10 to 500 boxes. Quoted per order.', price:85, priceFrom:true, badge:'Bulk pricing', pers:true, occ:['corporate','christmas'], fest:['christmas','lunar','diwali'], added:10, col:['#fbefee','#6e1f24'] }),
 P({ id:'h8', cat:'hampers', ht:'personal', builder:true, name:'Build-your-own hamper', d:'Pick the pieces yourself from what is in stock today. We add the basket, wrapping and a card.', price:15, priceFrom:true, badge:'Build your own', occ:['birthday','teacher','christmas','mothersday'], added:35, col:['#fbefee','#c0403a'] }),
 P({ id:'h7', cat:'hampers', ht:'corporate', name:'Staff desk gift set', d:'Pen stand, personalised name candle and a card. Quoted per order.', price:55, priceFrom:true, pers:true, occ:['corporate'], added:9, col:['#f3e6dc','#c0403a'] })
];

/* Homepage "From our Instagram" strip (curated, not a live feed). */
export const IG_STRIP = [
  { id:'DPEGeUTk78W', kind:'reel' }, { id:'CXRyM3YB4QH', kind:'p' }, { id:'CRc1T-EhCqx', kind:'p' },
  { id:'CMOAVAsh4mt', kind:'p' }, { id:'CMDcy4HhpiE', kind:'p' }, { id:'CJCjqg2BeBM', kind:'p' }
];

/* Shipping estimate shown in the enquiry list (placeholder from the prototype; final rates via Australia Post later). */
export const SHIPPING = { flat: 12.95, freeOver: 120 };

