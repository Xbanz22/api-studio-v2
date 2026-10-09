// spotify-handler.ts
// Spotify Partner API scraper + spotidown.net MP3 downloader
// Creator: baniw
import type { Request, Response } from 'express';

const BASE = 'https://open.spotify.com';
const EMBED_BASE = 'https://embed.spotify.com/embed';
const TOKEN_API = 'https://clienttoken.spotify.com/v1/clienttoken';
const PARTNER_API = 'https://api-partner.spotify.com/pathfinder/v1/query';
const SDIDR_BASE = 'https://spotidown.net/en';
const TIMEOUT = 20_000;
const RETRIES = 3;
const RETRYABLE = new Set([403, 408, 425, 429, 500, 502, 503, 504]);
const BOOTSTRAP_TRACK = '4cOdK2wGLETKBW3PvgPWqT';

const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
];
const ua = (i: number) => UAS[i % UAS.length];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Rate limiter per API key
const rateTracker = new Map<string, number[]>();
const RATE_LIMIT_PER_MIN = 30;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const hits = (rateTracker.get(key) || []).filter((t) => now - t < 60_000);
  if (hits.length >= RATE_LIMIT_PER_MIN) return false;
  hits.push(now);
  rateTracker.set(key, hits);
  return true;
}

async function req(url: string, opts: any = {}): Promise<{ res: any; txt: string }> {
  const { headers = {}, method = 'GET', body } = opts;
  let lastErr: any;
  for (let i = 0; i <= RETRIES; i++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'User-Agent': ua(i), Accept: '*/*', ...headers },
        body,
        signal: ac.signal,
        redirect: 'follow',
      });
      const txt = await res.text();
      if (RETRYABLE.has(res.status) && i < RETRIES) {
        const ra = Number(res.headers.get('retry-after'));
        await sleep(ra > 0 ? Math.min(ra * 1000, 5000) : Math.min(1000 * 2 ** i, 8000) + Math.random() * 400);
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      return { res, txt };
    } catch (e: any) {
      lastErr = e;
      if (e.name !== 'AbortError' && !(e instanceof TypeError)) break;
      await sleep(Math.min(1000 * 2 ** i, 8000));
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr || new Error(`Fetch gagal: ${url}`);
}

// ============ TOKEN CACHE ============
let sessionCache: any = null;
let clientTokenCache: any = null;

async function getSession(force = false): Promise<any> {
  if (!force && sessionCache && Date.now() < sessionCache.expiryMs - 60_000) return sessionCache;
  const { txt } = await req(`${EMBED_BASE}/track/${BOOTSTRAP_TRACK}`);
  const m = txt.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('Session bootstrap gagal: __NEXT_DATA__ tidak ditemukan.');
  const data = JSON.parse(m[1]);
  const sess = data?.props?.pageProps?.state?.settings?.session;
  if (!sess?.accessToken) throw new Error('Session bootstrap gagal: token tidak ditemukan.');
  sessionCache = {
    accessToken: sess.accessToken,
    expiryMs: sess.accessTokenExpirationTimestampMs,
    isAnonymous: sess.isAnonymous,
  };
  return sessionCache;
}

async function getClientToken(force = false): Promise<any> {
  if (!force && clientTokenCache && Date.now() < clientTokenCache.expiryMs - 60_000) return clientTokenCache;
  const payload = {
    client_data: {
      client_version: '1.2.57.409.g175f186c',
      client_id: 'f6a40776580943a7bc5173125a1e8832',
      js_sdk_data: {
        device_brand: 'Chrome', device_model: 'Windows', os: 'Windows', os_version: '10',
        container_version: '0.0.0', device_id: '', device_type: 'computer', platform_identifier: 'web_player',
      },
    },
  };
  const { txt } = await req(TOKEN_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const d = JSON.parse(txt);
  if (!d.granted_token?.token) throw new Error('Client token gagal diambil.');
  clientTokenCache = {
    token: d.granted_token.token,
    expiryMs: Date.now() + (d.granted_token.refresh_after_seconds ?? 3600) * 1000,
  };
  return clientTokenCache;
}

const HASH_OK = new Set<string>();
const SEARCH_HASHES = [
  'eff59fa0a3d026b88b56fddbcf4bdfa16a186b8175a5c1a358c072e053c2e5b0',
  '21b3fe49546912ba782db5c47e9ef5a7dbd20329520ba0c7d0fcfadee671d24e',
  '3c9d3f60dac5dea3876b6db3f534192b1c1d90032c4233c1bbaba526db41eb31',
];

async function pathfinder(operationName: string, variables: any, hashCandidates: string[]): Promise<any> {
  const session = await getSession();
  const client = await getClientToken();
  const ordered = hashCandidates.slice();
  hashCandidates.forEach((h) => { if (HASH_OK.has(h)) { ordered.splice(ordered.indexOf(h), 1); ordered.unshift(h); } });
  let lastErr: any = null;
  for (const hash of ordered) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const params = new URLSearchParams({
        operationName,
        variables: JSON.stringify(variables),
        extensions: JSON.stringify({ persistedQuery: { version: 1, sha256Hash: hash } }),
      });
      try {
        const { res, txt } = await req(`${PARTNER_API}?${params}`, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'Client-Token': client.token,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Origin: BASE,
            Referer: `${BASE}/`,
            'Spotify-App-Platform': 'WebPlayer',
          },
        });
        if (res.status === 401 || /token has expired/i.test(txt)) {
          await getSession(true);
          session.accessToken = sessionCache.accessToken;
          continue;
        }
        if (res.status === 400 && /unknown|not found|not supported|hash/i.test(txt)) {
          lastErr = new Error(`Hash ${hash.slice(0, 8)}.. gagal`);
          break;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt.slice(0, 140)}`);
        HASH_OK.add(hash);
        return JSON.parse(txt);
      } catch (e: any) {
        lastErr = e;
        if (/Hash /.test(e.message)) break;
        if (attempt === 1) throw e;
      }
    }
  }
  throw lastErr || new Error(`Semua kandidat hash gagal untuk operation ${operationName}.`);
}

// ============ PARSE EMBED ============
function parseEmbed(html: string): any {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('__NEXT_DATA__ tidak ditemukan.');
  const data = JSON.parse(m[1]);
  const entity = data?.props?.pageProps?.state?.data?.entity;
  if (!entity) throw new Error('Entity tidak ditemukan di embed page.');
  return entity;
}

async function embedEntity(type: string, id: string): Promise<any> {
  const { txt } = await req(`${EMBED_BASE}/${type}/${id}`);
  return parseEmbed(txt);
}

const mapTrack = (t: any) => ({
  id: (t.uri || '').split(':').pop() || null,
  spotifyUri: t.uri || null,
  url: t.uri ? `https://open.spotify.com/track/${t.uri.split(':').pop()}` : null,
  title: t.title || t.name || null,
  artists: (t.artists?.items || (Array.isArray(t.artists) ? t.artists : []))
    .map((a: any) => a.name || a.profile?.name).filter(Boolean),
  album: t.album?.name || null,
  albumId: (t.album?.uri || '').split(':').pop() || null,
  albumCover: t.album?.coverArt?.sources?.[0]?.url || t.visualIdentity?.image?.sources?.[0]?.url || null,
  isExplicit: !!t.isExplicit,
  durationMs: typeof t.duration === 'number' ? t.duration : t.duration?.totalMilliseconds ?? null,
  isPlayable: t.isPlayable !== false,
  playabilityReason: t.playabilityReason || null,
  audioPreviewUrl: t.audioPreview?.url || null,
});

// ============ PUBLIC API ============
async function search(term: string, { limit = 10, offset = 0 }: any = {}): Promise<any> {
  if (!term?.trim()) throw new Error('Kata kunci wajib diisi.');
  const variables = {
    searchTerm: term, offset, limit,
    numberOfTopResults: 5, includeAudiobooks: false,
    includePreReleases: true, includeAlbumPreReleases: false,
    includeAuthors: false, includeEpisodeContentRatingsV2: false,
  };
  const data = await pathfinder('searchDesktop', variables, SEARCH_HASHES);
  const search = data?.data?.searchV2 || data?.data?.search;
  if (!search) throw new Error('Format respons search tidak dikenal.');
  const extract = (x: any) => x?.item?.data || x?.track || x?.data || x;
  const tracks = (search.tracksV2?.items || search.tracks?.items || []).map((x: any) => {
    const raw = x.item?.data || x.track || x.data || x;
    return mapTrack({ ...raw, album: raw.album || raw.albumOfTrack });
  });
  const albums = (search.albumsV2?.items || search.albums?.items || [])
    .map((x: any) => extract(x)).filter((x: any) => x && x.uri)
    .map((x: any) => ({
      id: x.uri.split(':').pop(),
      name: x.name || x.title,
      artists: (x.artists?.items || []).map((a: any) => a.profile?.name || a.name).filter(Boolean),
      coverArt: x.coverArt?.sources?.[0]?.url || null,
      year: x.date?.year || null,
      uri: x.uri,
    }));
  const artists = (search.artistsV2?.items || search.artists?.items || [])
    .map((x: any) => extract(x)).filter((x: any) => x && x.uri)
    .map((x: any) => ({
      id: x.uri.split(':').pop(),
      name: x.profile?.name || x.name,
      uri: x.uri,
      avatar: x.visuals?.avatarImage?.sources?.[0]?.url || null,
    }));
  const top = (search.topResults?.items || []).map((x: any) => {
    const raw = extract(x) || x;
    return raw?.uri?.includes(':track:') ? mapTrack({ ...raw, album: raw.albumOfTrack || raw.album }) : raw;
  });
  return {
    term,
    totalTracks: (search.tracksV2 || search.tracks)?.totalCount ?? tracks.length,
    tracks, albums, artists, top,
  };
}

async function track(idOrUri: string): Promise<any> {
  const id = String(idOrUri || '').replace(/^spotify:track:/, '').replace(/^.*\/track\//, '').split('?')[0];
  if (!id) throw new Error('Parameter id wajib diisi.');
  const embed = await embedEntity('track', id);
  return mapTrack(embed);
}

async function album(idOrUri: string): Promise<any> {
  const id = String(idOrUri || '').replace(/^spotify:album:/, '').replace(/^.*\/album\//, '').split('?')[0];
  if (!id) throw new Error('Parameter id wajib diisi.');
  const e = await embedEntity('album', id);
  const coverUrl = e.visualIdentity?.image?.sources?.[0]?.url || null;
  return {
    id,
    name: e.name || e.title,
    artists: (e.artists || []).map((a: any) => a.name).filter(Boolean),
    releaseDate: e.releaseDate?.isoString || null,
    totalTracks: (e.trackList || []).length,
    tracks: (e.trackList || []).map((t: any) => mapTrack({
      ...t,
      album: { name: e.name, uri: e.uri, coverArt: { sources: coverUrl ? [{ url: coverUrl }] : [] } },
    })),
  };
}

async function artist(idOrUri: string): Promise<any> {
  const id = String(idOrUri || '').replace(/^spotify:artist:/, '').replace(/^.*\/artist\//, '').split('?')[0];
  if (!id) throw new Error('Parameter id wajib diisi.');
  const e = await embedEntity('artist', id);
  return {
    id,
    name: e.name || e.title,
    subtitle: e.subtitle || null,
    relatedEntityUri: e.relatedEntityUri || null,
    tracks: (e.trackList || []).map((t: any) => mapTrack(t)),
  };
}

// ============ SPOTIDOWN (FULL MP3) ============
const UA_SD = UAS[0];
const sdJar = new Map<string, string>();

const sdAddCookies = (res: any) => {
  const getSet = res.headers.getSetCookie?.() ?? [];
  for (const c of getSet) {
    const [p] = c.split(';');
    const i = p.indexOf('=');
    if (i > 0) sdJar.set(p.slice(0, i).trim(), p.slice(i + 1).trim());
  }
};
const sdCk = () => [...sdJar].map(([k, v]) => `${k}=${v}`).join('; ');
const sdHdrs = () => ({ 'User-Agent': UA_SD, Accept: '*/*', Cookie: sdCk() });

async function sdReq(url: string, opts: any = {}): Promise<any> {
  const { method = 'GET', body, headers = {} } = opts;
  let lastErr: any;
  for (let i = 0; i <= RETRIES; i++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT);
    try {
      const res = await fetch(url, {
        method,
        headers: { ...sdHdrs(), ...headers },
        body,
        signal: ac.signal,
        redirect: 'follow',
      });
      sdAddCookies(res);
      if (RETRYABLE.has(res.status) && i < RETRIES) {
        lastErr = new Error(`HTTP ${res.status}`);
        await sleep(Math.min(1000 * 2 ** i, 8000));
        continue;
      }
      return { res, txt: await res.text() };
    } catch (e: any) {
      lastErr = e;
      if (e.name !== 'AbortError' && !(e instanceof TypeError)) break;
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr || new Error(`Fetch gagal: ${url}`);
}

let sdNonce: string | null = null;

async function sdGetNonce(): Promise<string> {
  if (sdNonce) return sdNonce;
  const { txt } = await sdReq(`${SDIDR_BASE}/`);
  sdNonce = txt.match(/"nonce":"([a-f0-9]+)"/)?.[1] || null;
  if (!sdNonce) throw new Error('Nonce form tidak ditemukan di spotidown.net.');
  return sdNonce;
}

async function sdStartDownload(spotifyUrl: string): Promise<any> {
  const n = await sdGetNonce();
  const { res, txt } = await sdReq(`${SDIDR_BASE}/wp-admin/admin-ajax.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `${SDIDR_BASE}/`,
      Origin: 'https://spotidown.net',
    },
    body: new URLSearchParams({
      action: 'elementor_pro_forms_send_form',
      'form_id': '394636d', 'post_id': '2', 'queried_id': '2', 'elementor_ajax': '1',
      'form_fields[music_url]': spotifyUrl,
      referrer: `${SDIDR_BASE}/`, nonce: n,
    }).toString(),
  });
  let json: any;
  try { json = JSON.parse(txt); } catch { throw new Error(`Send-form bukan JSON (${res.status}).`); }
  const redirect = json?.data?.data?.['1']?.redirect_url;
  if (!redirect) throw new Error('redirect_url kosong (form rejected).');
  const resolved = redirect.startsWith('http')
    ? redirect.replace('http://', 'https://')
    : `https://spotidown.net${redirect.replace('/en/?', '/en/').replace('/en//', '/en/')}`;
  const page = await sdReq(resolved);
  const start = page.txt.indexOf('smdDownloadData');
  let output: any = null;
  if (start !== -1) {
    const eq = page.txt.indexOf('=', start);
    const brace = page.txt.indexOf('{', eq);
    if (brace !== -1) {
      let depth = 0, end = -1;
      for (let i = brace; i < page.txt.length; i++) {
        if (page.txt[i] === '{') depth++;
        else if (page.txt[i] === '}' && --depth === 0) { end = i; break; }
      }
      if (end > brace) {
        try { output = JSON.parse(page.txt.slice(brace, end + 1)).output; } catch {}
      }
    }
  }
  if (!output) throw new Error(`smdDownloadData tidak ada.`);
  return output;
}

async function sdResolveMp3(item: any, attempts = 25): Promise<any> {
  const name = item.name || item.song_name;
  const artists = (item.artists || []).map((a: any) => a.name).filter(Boolean).join(', ');
  const link = item.external_urls?.spotify || item.link;
  const b64 = Buffer.from(encodeURIComponent(JSON.stringify({ song_name: name, artist: artists, link }))).toString('base64');
  const start = await sdReq(`${SDIDR_BASE}/wp-admin/admin-ajax.php?action=check_download_status&data=${encodeURIComponent(b64)}`);
  let s: any;
  try { s = JSON.parse(start.txt); } catch { throw new Error('check_download_status bukan JSON.'); }
  if (!s?.success || !s?.data?.download_id) throw new Error('check_download_status gagal.');
  const did = s.data.download_id;
  for (let i = 0; i < attempts; i++) {
    await sleep(1500);
    const { txt } = await sdReq(`${SDIDR_BASE}/wp-admin/admin-ajax.php?action=get_download_status&download_id=${encodeURIComponent(did)}`);
    try {
      const d = JSON.parse(txt);
      if (d?.data?.status === 'ready' && d?.data?.download_url) {
        return { downloadUrl: d.data.download_url, title: d.data.title || name, thumbnail: d.data.thumbnail || null, track: item };
      }
      if (d?.data?.status === 'failed' || d?.data?.status === 'error') {
        throw new Error(`Download gagal di server: ${d?.data?.message || 'unknown'}`);
      }
    } catch (e: any) {
      if (/gagal di server/.test(e.message)) throw e;
    }
  }
  throw new Error('Timeout: server belum siap memberi download_url.');
}

async function sdDownloadTrack(spotifyUrl: string): Promise<any> {
  const output = await sdStartDownload(spotifyUrl);
  let items: any[] = output.artist_tracks?.length ? output.artist_tracks : [];
  if (!items.length && Array.isArray(output.tracks?.items)) {
    items = output.tracks.items.map((i: any) => ({
      ...i,
      album: i.album || { images: output.images },
      external_urls: i.external_urls || { spotify: `https://open.spotify.com/track/${i.id}` },
    }));
  }
  if (!items.length) items = [output];
  const saved: any[] = [];
  for (const item of items) {
    const mp3 = await sdResolveMp3(item);
    saved.push({
      title: mp3.title,
      artist: (item.artists || []).map((a: any) => a.name).join(', '),
      duration: item.duration || null,
      spotifyId: item.id || mp3.track?.id || null,
      spotifyUrl,
      cover: item.album?.images?.[0]?.url || null,
      thumbnail: mp3.thumbnail || null,
      previewUrl: item.preview_url || null,
      fullMp3Url: mp3.downloadUrl,
    });
  }
  return { type: output.type, total: saved.length, tracks: saved };
}

// ============ EXPRESS HANDLER ============
export async function handleSpotify(req: Request, res: Response) {
  const CREATOR = 'baniw';
  const wrap = (payload: any) => ({ creator: CREATOR, timestamp: new Date().toISOString(), ...payload });

  const action = ((req.query.action as string) || (req.body?.action as string) || '').toLowerCase();
  const apiKey = (req.headers['x-api-key'] as string) || (req.query.apiKey as string) || 'anon';

  if (!checkRateLimit(apiKey)) {
    return res.status(429).json(wrap({ success: false, error: `Rate limit: max ${RATE_LIMIT_PER_MIN} req/menit` }));
  }

  if (!action) {
    return res.status(400).json(wrap({
      success: false,
      error: 'Parameter "action" wajib diisi',
      available_actions: {
        search: 'q (wajib), limit, offset',
        track: 'id (wajib)',
        album: 'id (wajib)',
        artist: 'id (wajib)',
        dl: 'url (wajib) — full MP3 download, bisa 30-60 detik',
      },
    }));
  }

  try {
    if (action === 'search') {
      const q = (req.query.q as string) || (req.body?.q as string) || '';
      const limit = Math.min(30, Math.max(1, parseInt((req.query.limit as string) || '10', 10)));
      const offset = Math.max(0, parseInt((req.query.offset as string) || '0', 10));
      const data = await search(q, { limit, offset });
      return res.json(wrap({ success: true, action: 'search', data }));
    }

    if (action === 'track') {
      const id = (req.query.id as string) || (req.body?.id as string) || '';
      const data = await track(id);
      return res.json(wrap({ success: true, action: 'track', data }));
    }

    if (action === 'album') {
      const id = (req.query.id as string) || (req.body?.id as string) || '';
      const data = await album(id);
      return res.json(wrap({ success: true, action: 'album', data }));
    }

    if (action === 'artist') {
      const id = (req.query.id as string) || (req.body?.id as string) || '';
      const data = await artist(id);
      return res.json(wrap({ success: true, action: 'artist', data }));
    }

    if (action === 'dl') {
      const url = (req.query.url as string) || (req.body?.url as string) || '';
      if (!url) return res.status(400).json(wrap({ success: false, error: 'Parameter "url" wajib diisi buat action=dl' }));
      const data = await sdDownloadTrack(url);
      return res.json(wrap({ success: true, action: 'dl', data }));
    }

    return res.status(400).json(wrap({ success: false, error: `Action tidak dikenal: ${action}` }));
  } catch (err: any) {
    return res.status(500).json(wrap({ success: false, error: err.message || 'Internal error' }));
  }
}
