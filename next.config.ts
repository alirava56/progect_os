import type { NextConfig } from 'next';
const config: NextConfig = {
  images: { unoptimized: true },
  devIndicators: false,
  async headers() {
    return [{source:'/:path*',headers:[
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'X-Frame-Options',value:'DENY'},
      {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
      {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
      {key:'Cross-Origin-Opener-Policy',value:'same-origin'},
      {key:'Cross-Origin-Resource-Policy',value:'same-origin'},
      {key:'Content-Security-Policy',value:"base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'"},
      ...(process.env.NODE_ENV==='production'&&process.env.PROJECTOS_PUBLIC_ORIGIN?.startsWith('https://')
        ?[{key:'Strict-Transport-Security',value:'max-age=31536000'}]:[]),
      // Avoid a static CSP that blocks Next.js inline runtime scripts; introduce nonce CSP after E2E coverage.
    ]}];
  },
};
export default config;
