/* Coming-soon mode (REQ-S10). Set the build variable PUBLIC_COMING_SOON=true on Cloudflare
   (or in .env) and the home page becomes the "launching soon" page, product pages send
   visitors there, and the admin panel keeps working so Neha can get the shop ready.
   Remove the variable (or set it to anything else) and rebuild to open the shop. */
export const comingSoon = value => String(value ?? '').trim().toLowerCase() === 'true';

export const COMING_SOON = comingSoon(import.meta.env?.PUBLIC_COMING_SOON);

export const CONTACT_EMAIL = 'panigacraftz@gmail.com';
export const contactMailto = (email = CONTACT_EMAIL) =>
  `mailto:${email}?subject=${encodeURIComponent('Hello PanigaCraftz')}`;
