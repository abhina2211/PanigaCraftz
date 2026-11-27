/* Security headers sent with every page (REQ-X5). The same list is in public/_headers,
   which Cloudflare applies to the prebuilt pages (home, admin, 404); src/middleware.js adds
   it to the product pages, which the Worker draws on each visit. A test checks the two match.

   The Content-Security-Policy says where a page may load things from: scripts only from this
   site, styles and fonts from Google Fonts, photos and data from Supabase. If someone ever
   managed to slip a <script> into a product or enquiry, the browser would refuse to run it. */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", /* style="" attributes are used */
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.supabase.co", /* blob: = photo preview in the admin panel */
  "connect-src 'self' https://*.supabase.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'", /* no other site can show these pages in a frame (clickjacking) */
  'upgrade-insecure-requests'
].join('; ');

export const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin'
};
