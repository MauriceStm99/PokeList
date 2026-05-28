const ALLOWED_PATHS = [
  /^\/tcgplayer\/categories\/?$/,
  /^\/tcgplayer\/\d+\/groups\/?$/,
  /^\/tcgplayer\/\d+\/\d+\/products\/?$/,
  /^\/tcgplayer\/\d+\/\d+\/prices\/?$/,
  /^\/tcgplayer\/\d+\/\d+\/ProductsAndPrices\/?$/,
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    if (!ALLOWED_PATHS.some((re) => re.test(url.pathname))) {
      return new Response(JSON.stringify({ error: 'Path not allowed' }), {
        status: 403,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const upstream = `https://tcgcsv.com${url.pathname}${url.search}`;
    const response = await fetch(upstream, {
      cf: { cacheTtl: 3600, cacheEverything: true },
      headers: { Accept: 'application/json' },
    });

    const headers = new Headers(response.headers);
    Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
    headers.set('Cache-Control', 'public, max-age=3600');

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  },
};
