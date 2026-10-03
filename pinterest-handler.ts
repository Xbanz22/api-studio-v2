// pinterest-handler.ts
// Pinterest scraper via official API (by xDonzCode, adapted)
import type { Request, Response } from 'express';

export async function handlePinterestScraper(req: Request, res: Response) {
  const q = ((req.query.q as string) || (req.query.query as string) || (req.body?.q) || (req.body?.query) || 'aesthetic wallpaper').trim();
  const limit = Math.min(30, Math.max(1, Number(req.query.limit || req.body?.limit || 12)));

  try {
    // @ts-ignore
    const { CookieJar } = require('tough-cookie');
    const jar = new CookieJar();

    // Step 1: Init session + collect cookies
    const initRes = await fetch('https://id.pinterest.com/', {
      method: 'GET',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
      },
    });

    const setCookies = typeof (initRes.headers as any).getSetCookie === 'function'
      ? (initRes.headers as any).getSetCookie()
      : [];
    for (const c of setCookies) {
      try { await jar.setCookie(c, 'https://id.pinterest.com'); } catch {}
    }
    const cookieString = await jar.getCookieString('https://id.pinterest.com');

    // Step 2: Call Pinterest internal search API
    const sourceUrl = `/search/pins/?q=${encodeURIComponent(q)}&rs=typed`;
    const dataPayload = JSON.stringify({
      options: {
        query: q,
        scope: 'pins',
        appliedProductFilters: '---',
        domains: null,
        user: null,
        seoDrawerEnabled: false,
        applied_unified_filters: null,
        auto_correction_disabled: false,
        journey_depth: null,
        source_id: null,
        source_module_id: null,
        source_url: sourceUrl,
        static_feed: false,
        selected_one_bar_modules: null,
        query_pin_sigs: null,
        page_size: null,
        price_max: null,
        price_min: null,
        query_image_pins: null,
        request_params: null,
        top_pin_ids: null,
        article: null,
        corpus: null,
        customized_rerank_type: null,
        filters: null,
        rs: 'typed',
        redux_normalize_feed: true,
      },
      context: {},
    });

    const apiUrl = `https://id.pinterest.com/resource/BaseSearchResource/get/?source_url=${encodeURIComponent(sourceUrl)}&data=${encodeURIComponent(dataPayload)}&_=${Date.now()}`;

    const apiRes = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0',
        'accept': 'application/json, text/javascript, */*; q=0.01',
        'accept-language': 'en-US,en;q=0.9',
        'referer': 'https://id.pinterest.com/',
        'x-requested-with': 'XMLHttpRequest',
        'x-app-version': '8048c97',
        'x-pinterest-appstate': 'active',
        'x-pinterest-source-url': '/',
        'x-pinterest-pws-handler': 'www/index.js',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'cookie': cookieString,
      },
    });

    const json: any = await apiRes.json();
    const results: any[] = json?.resource_response?.data?.results || [];

    const pins = results.slice(0, limit).map((pin: any) => ({
      id: pin.id || null,
      title: pin.grid_title || pin.title || null,
      description: pin.description || null,
      image: pin.images?.orig?.url || pin.images?.['736x']?.url || null,
      pinUrl: pin.id ? `https://www.pinterest.com/pin/${pin.id}/` : null,
      link: pin.link || null,
      domain: pin.domain || null,
      author: pin.pinner?.full_name || null,
      username: pin.pinner?.username || null,
      likes: pin.reaction_counts?.['1'] || 0,
      repinCount: pin.repin_count || 0,
      createdAt: pin.created_at || null,
    }));

    res.json({
      success: true,
      query: q,
      total: pins.length,
      source: 'Pinterest Media & Pin Search Engine',
      sourceUrl: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`,
      data: pins,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      query: q,
      error: `Gagal mencari pin Pinterest: ${err?.message || err}`,
    });
  }
}
