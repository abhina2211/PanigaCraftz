/* Adds the security headers (src/lib/security-headers.js) to pages the Worker draws on each
   visit, such as product pages. Prebuilt pages get the same headers from public/_headers.
   Left out on the dev server, whose live reload needs inline scripts. */
import { defineMiddleware } from 'astro:middleware';
import { SECURITY_HEADERS } from './lib/security-headers.js';

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  if (import.meta.env.DEV) return response;
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!response.headers.has(name)) response.headers.set(name, value);
  }
  return response;
});
