// removebg-handler.ts
// iLoveIMG Remove Background — convert dari Node.js module
// Creator: baniw
import type { Request, Response } from 'express';
import axios from 'axios';
// @ts-ignore
import FormData from 'form-data';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const PAGE_URL = 'https://www.iloveimg.com/remove-background';

const SERVERS = [
  'api1g', 'api2g', 'api3g', 'api8g', 'api9g', 'api10g', 'api11g', 'api12g',
  'api13g', 'api14g', 'api15g', 'api16g', 'api17g', 'api18g', 'api19g',
  'api20g', 'api21g', 'api22g', 'api24g', 'api25g',
];

const TASK = 'r68zl88mq72xq94j2d5p66bn2z9lrbx20njsbw2qsAvgmzr11lvfhAx9kl87pp6yqgx7c8vg7sfbqnrr42qb16v0gj8jl5s0kq1kgp26mdyjjspd8c5A2wk8b4Adbm6vf5tpwbqlqdr8A9tfn7vbqvy28ylphlxdl379psxpd8r70nzs3sk1';

const HTTP_TIMEOUT_MS = 45_000;
const GPU_TIMEOUT_MS = 180_000;
const TOKEN_TTL_MS = 10 * 60_000;
const MAX_RETRIES = 3;

const sessionCache = new Map<string, { token: string; csrf: string; servers: string[] | null; ts: number }>();

function parseConfig(html: string) {
  const text = typeof html === 'string' ? html : Buffer.from(html || '').toString();
  let token: string | null = null;
  let cfg: any = null;
  const cfgIdx = text.indexOf('ilovepdfConfig');
  if (cfgIdx !== -1) {
    const objStart = text.indexOf('{', cfgIdx);
    const objEnd = text.indexOf('};', objStart);
    if (objStart !== -1 && objEnd !== -1) {
      try {
        cfg = JSON.parse(text.slice(objStart, objEnd + 1));
        token = cfg?.token || null;
      } catch {}
    }
  }
  const csrf = text.match(/<meta[^>]*name=["']csrf-token["'][^>]*content=["']([^"']+)["']/i)?.[1] || null;
  return { token, csrf, servers: Array.isArray(cfg?.servers) && cfg.servers.length ? cfg.servers : null };
}

async function getTokenInfo(force = false): Promise<{ token: string; csrf: string; servers: string[] | null }> {
  const now = Date.now();
  const hit = sessionCache.get(PAGE_URL);
  if (!force && hit?.token && hit?.csrf && now - hit.ts < TOKEN_TTL_MS) {
    return { token: hit.token, csrf: hit.csrf, servers: hit.servers };
  }
  const res = await axios.get(PAGE_URL, {
    timeout: 15_000,
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  });
  const { token, csrf, servers } = parseConfig(res.data);
  if (!token || !csrf) throw new Error('Token/CSRF gagal diambil dari iloveimg.com');
  sessionCache.set(PAGE_URL, { token, csrf, servers, ts: now });
  return { token, csrf, servers };
}

function buildHeaders(token: string, csrf: string, multipart?: FormData) {
  return {
    Authorization: `Bearer ${token}`,
    Origin: 'https://www.iloveimg.com/',
    Cookie: `_csrf=${csrf}`,
    'User-Agent': UA,
    ...(multipart ? multipart.getHeaders() : {}),
  };
}

function classifyError(err: any): 'auth' | 'rate' | 'server' | null {
  const st = err?.response?.status;
  if (st === 401 || st === 403) return 'auth';
  if (st === 429) return 'rate';
  if (st && st >= 500) return 'server';
  if (/unauthorized|forbidden|invalid token/i.test(String(err?.message || ''))) return 'auth';
  return null;
}

function pickServer(pool: string[] = SERVERS, used: string[] = []) {
  const avail = pool.filter((s) => !used.includes(s));
  const src = avail.length ? avail : pool;
  if (!src.length) return null;
  return src[Math.floor(Math.random() * src.length)];
}

async function postToTool(opts: any) {
  const { server, path, token, csrf, form, timeout, responseType } = opts;
  const res = await axios.post(`https://${server}.iloveimg.com/v1/${path}`, form, {
    headers: buildHeaders(token, csrf, form),
    responseType,
    timeout,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: () => true,
  });
  if (res.status < 200 || res.status >= 300) {
    const body = responseType === 'arraybuffer'
      ? Buffer.from(res.data || []).toString('utf8')
      : JSON.stringify(res.data);
    const e: any = new Error(`HTTP ${res.status} pada /v1/${path}: ${String(body).slice(0, 200)}`);
    e.response = { status: res.status };
    throw e;
  }
  return res;
}

function buildUploadForm(fileName: string) {
  const form = new FormData();
  form.append('name', fileName);
  form.append('chunk', '0');
  form.append('chunks', '1');
  form.append('task', TASK);
  form.append('preview', '1');
  return form;
}

const RM_BG_MAX_BYTES = 2 * 1024 * 1024;
const RM_BG_MAX_PIXELS = 4_403_200;

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function inspectPng(buf: Buffer): { width: number; height: number } | null {
  if (!buf || buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIG)) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function uploadForRmBg(opts: any) {
  const { server, token, csrf, buffer, fileName, contentType } = opts;
  const form = buildUploadForm(fileName);
  form.append('file', buffer, { filename: fileName, contentType: contentType || 'image/jpeg' });
  const res = await postToTool({ server, path: 'upload', token, csrf, form, timeout: HTTP_TIMEOUT_MS });
  const serverFilename = res.data?.server_filename;
  if (!serverFilename) throw new Error('Upload gagal: server_filename tidak ada');
  return serverFilename;
}

async function requestRemoveBackground(opts: any) {
  const { server, token, csrf, serverFilename } = opts;
  const form = new FormData();
  form.append('task', TASK);
  form.append('server_filename', serverFilename);
  const res = await postToTool({
    server, path: 'removebackground', token, csrf, form,
    timeout: GPU_TIMEOUT_MS, responseType: 'arraybuffer',
  });
  return Buffer.from(res.data || []);
}

export async function removeBackgroundImage(buffer: Buffer, opts: any = {}) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('Buffer gambar kosong');
  if (buffer.length > RM_BG_MAX_BYTES) {
    throw new Error(`Ukuran ${(buffer.length / 1048576).toFixed(2)} MB melebihi batas 2 MB iLoveIMG.`);
  }
  const fileName = String(opts.fileName || 'image.jpg').replace(/[^\w.\-]/g, '_') || 'image.jpg';

  let session = await getTokenInfo(false);
  const pool = (Array.isArray(session.servers) && session.servers.length ? session.servers : SERVERS).filter(Boolean);
  const used: string[] = [];
  let lastErr: any = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const server = pickServer(pool, used);
    if (!server) break;
    used.push(server);
    try {
      const serverFilename = await uploadForRmBg({ server, ...session, buffer, fileName, contentType: opts.contentType });
      const out = await requestRemoveBackground({ server, ...session, serverFilename });
      if (!out.length) throw new Error('Hasil remove-background kosong');
      const png = inspectPng(out);
      if (!png) throw new Error('Server membalas data yang bukan PNG valid');
      if (png.width * png.height > RM_BG_MAX_PIXELS) {
        throw new Error(`Hasil ${png.width}×${png.height} melebihi batas 4.4MP`);
      }
      return { buffer: out, width: png.width, height: png.height, server, transparent: true };
    } catch (err: any) {
      lastErr = err;
      if (classifyError(err) === 'auth') {
        try { session = await getTokenInfo(true); } catch {}
      }
    }
  }
  throw lastErr || new Error('Gagal remove background (semua server error)');
}

// ═══════════════════════════════════════════════════════════════════
// EXPRESS HANDLER
// ═══════════════════════════════════════════════════════════════════
export async function handleRemoveBg(req: Request, res: Response) {
  const CREATOR = 'baniw';
  const wrap = (payload: any) => ({ creator: CREATOR, timestamp: new Date().toISOString(), ...payload });

  try {
    let imageBuffer: Buffer | null = null;
    let fileName = 'image.jpg';

    // 1. Dari upload file (multer)
    if ((req as any).file?.buffer) {
      imageBuffer = (req as any).file.buffer;
      fileName = (req as any).file.originalname || 'image.jpg';
    }

    // 2. Dari URL
    let urlContentType: string | undefined;
    if (!imageBuffer && (req.query.url as string)) {
      const url = req.query.url as string;
      const fetched = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 20_000,
        headers: { 'User-Agent': UA },
        maxContentLength: RM_BG_MAX_BYTES + 1024,
      });
      imageBuffer = Buffer.from(fetched.data);
      urlContentType = String(fetched.headers['content-type'] || '').split(';')[0].trim();

      // Extract filename + pastiin ada extension yang valid
      let baseName = (url.split('/').pop() || 'image').split('?')[0];
      baseName = baseName.replace(/[^\w.-]/g, '_');
      const hasExt = /\.(jpe?g|png|webp)$/i.test(baseName);
      if (!hasExt) {
        // Detect dari content-type
        if (urlContentType === 'image/png') baseName += '.png';
        else if (urlContentType === 'image/webp') baseName += '.webp';
        else baseName += '.jpg';
      }
      fileName = baseName;

      // iLoveIMG cuma nerima jpeg/jpg/png — kalau webp, kita perlu fallback
      if (urlContentType === 'image/webp' || urlContentType === '') {
        // Force ke jpg kalau webp (ILoveIMG nolak webp)
        if (urlContentType === 'image/webp') {
          urlContentType = 'image/jpeg';
          fileName = fileName.replace(/\.webp$/i, '.jpg');
        }
      }
    }

    if (!imageBuffer) {
      return res.status(400).json(wrap({
        success: false,
        error: 'Kirim gambar via upload (field "image") atau query param "?url=<URL>"',
      }));
    }

    const result = await removeBackgroundImage(imageBuffer, { fileName, contentType: urlContentType });

    // Raw mode → kirim PNG langsung
    if (req.query.raw === 'true') {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `inline; filename="removebg-${Date.now()}.png"`);
      res.setHeader('X-Creator', CREATOR);
      return res.send(result.buffer);
    }

    // Default → JSON base64
    return res.json(wrap({
      success: true,
      data: {
        image_base64: `data:image/png;base64,${result.buffer.toString('base64')}`,
        width: result.width,
        height: result.height,
        size_bytes: result.buffer.length,
        server: result.server,
        transparent: result.transparent,
      },
    }));
  } catch (err: any) {
    return res.status(500).json(wrap({
      success: false,
      error: err.message || 'Internal error',
    }));
  }
}
