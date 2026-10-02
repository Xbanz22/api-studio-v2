// tempmail-routes.ts
import express, { Request, Response } from 'express';
import axios from 'axios';
// @ts-ignore
const cheerio = require('cheerio');

const BASE_URL = 'https://generator.email';
const DEVELOPER = 'api.baniw-space.my.id';
const VERSION = '1.0.0';
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function extractOtp(text: string, html?: string): string | null {
  const combined = (text || '').trim();
  if (!combined && !html) return null;
  const mH = combined.match(/\b([0-9]{3})[- ]([0-9]{3})\b/);
  if (mH) return mH[1] + mH[2];
  const mK = combined.match(/(?:kode\s*verifikasi|verification\s*code|security\s*code|confirmation\s*code|kode\s*keamanan|auth\s*code|passcode|kode\s*otp|otp|pin|code|kode)(?:(?:\s+[a-zA-Z]+){0,4})?\s*(?:adalah|is|:|:=|-|\s)\s*\b([0-9]{4,8})\b/i);
  if (mK) { const v = mK[1]; if (!(v.length===4 && (v.startsWith('19')||v.startsWith('20')) && !/code|kode|otp|pin/i.test(combined))) return v; }
  const mA = combined.match(/(?:use\s*code|masukkan\s*kode|gunakan\s*kode|enter\s*(?:verification\s*)?code)\s*(?:adalah|is|:|:=|-|\s)?\s*\b([0-9]{4,8})\b/i);
  if (mA) return mA[1];
  const mAl = combined.match(/(?:otp|code|kode|token|password)(?:(?:\s+[a-zA-Z]+){0,3})?\s*(?:adalah|is|:|:=|-|\s)\s*\b([A-Z0-9]*[0-9][A-Z0-9]*)\b/i);
  if (mAl) { const v = mAl[1].trim(); if (v.length>=4 && v.length<=8 && /[0-9]/.test(v) && /[a-zA-Z]/i.test(v)) return v.toUpperCase(); }
  if (html) {
    const $ = cheerio.load(html);
    let found: string | null = null;
    $('b, strong, h1, h2, h3, td, span, font').each((_: any, el: any) => {
      const t = $(el).text().trim();
      if (/^[0-9]{4,8}$/.test(t) && !/^(19\d\d|20[2-3]\d)$/.test(t)) { found = t; return false; }
      if (/^[0-9]{3}[- ][0-9]{3}$/.test(t)) { found = t.replace(/[- ]/, ''); return false; }
    });
    if (found) return found;
  }
  const m6 = combined.match(/\b([0-9]{6})\b/);
  if (m6) return m6[1];
  return null;
}

function extractLinks(html: string): { primary_link: string | null; all_links: { text: string; url: string }[] } {
  if (!html) return { primary_link: null, all_links: [] };
  const $ = cheerio.load(html);
  const links: { text: string; url: string; score: number }[] = [];
  let primary: string | null = null;
  let high = -1;
  const actionKw = ['verify','verifikasi','confirm','konfirmasi','activate','aktifkan','click here','klik di sini','log in','masuk','login','reset password','complete registration','get started','join','accept','approve'];
  const ignoreKw = ['unsubscribe','berhenti langganan','privacy policy','kebijakan privasi','terms','syarat dan ketentuan','facebook','twitter','instagram','linkedin','youtube','help center','pusat bantuan','contact us','hubungi kami','support','preferences','settings','android','ios'];
  $('a[href]').each((_: any, el: any) => {
    const href = ($(el).attr('href') || '').trim();
    if (!href.startsWith('http://') && !href.startsWith('https://')) return;
    const text = $(el).text().trim().toLowerCase();
    const hl = href.toLowerCase();
    if (ignoreKw.some((j) => text.includes(j) || hl.includes(j))) return;
    let score = 0;
    for (const kw of actionKw) { if (text.includes(kw)) score += 15; if (hl.includes(kw)) score += 5; }
    if (/token=|code=|key=|verify|activate|confirmation|auth\/links|auth_action/i.test(hl)) score += 10;
    if (!links.some((l) => l.url === href)) links.push({ text: $(el).text().trim(), url: href, score });
    if (score > high) { high = score; primary = href; }
  });
  links.sort((a, b) => b.score - a.score);
  if (!primary && links.length > 0) primary = links[0].url;
  return { primary_link: primary, all_links: links.map((l) => ({ text: l.text, url: l.url })) };
}

function cleanBody($: any): { bodyText: string; rawHtml: string } {
  const sels = ['div.mess_bodiyy','div[class*="mess_bod"]','div.user_mess_content','#email_content','#mail-summary-body'];
  for (const sel of sels) {
    const c = $(sel);
    if (c.length > 0) {
      const clone = c.first().clone();
      clone.find('script, style, ins, button, iframe, .adsbygoogle, .mesg-row, .mailsrc-panel, .tooltip-container').remove();
      return { bodyText: clone.text().replace(/\n\s*\n/g, '\n').trim(), rawHtml: clone.html() || '' };
    }
  }
  return { bodyText: '', rawHtml: '' };
}

class TempMailClient {
  private cookies = new Map<string, string>();
  private apiToken: string | null = null;
  private tokenAt = 0;
  private domains: string[] = [];
  private domainsAt = 0;
  private cacheTtl = 300000;

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const h: Record<string, string> = { 'User-Agent': DEFAULT_UA, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9,id;q=0.8', Connection: 'keep-alive', ...extra };
    if (this.cookies.size > 0) h['Cookie'] = Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
    return h;
  }
  private updateCookies(headers: any) {
    if (!headers?.['set-cookie']) return;
    const raw = Array.isArray(headers['set-cookie']) ? headers['set-cookie'] : [headers['set-cookie']];
    for (const c of raw) { const [p] = c.split(';'); const i = p.indexOf('='); if (i > 0) this.cookies.set(p.slice(0, i).trim(), p.slice(i + 1).trim()); }
  }

  async getToken(force = false): Promise<string> {
    if (this.apiToken && !force && Date.now() - this.tokenAt < this.cacheTtl) return this.apiToken;
    try {
      const res = await axios.get(`${BASE_URL}/`, { headers: this.headers(), timeout: 15000, validateStatus: () => true });
      this.updateCookies(res.headers);
      if (res.status === 200) {
        const $ = cheerio.load(res.data);
        const t = $('meta[name="api-token"]').attr('content');
        if (t) { this.apiToken = t.trim(); this.tokenAt = Date.now(); return this.apiToken; }
      }
    } catch { if (this.apiToken) return this.apiToken; throw new Error('gagal ambil api-token'); }
    if (this.apiToken) return this.apiToken;
    throw new Error('api-token tidak ditemukan');
  }

  async getDomains(force = false): Promise<string[]> {
    if (this.domains.length > 0 && !force && Date.now() - this.domainsAt < this.cacheTtl) return this.domains;
    try {
      const token = await this.getToken(force);
      const headers = this.headers({ 'X-API-Token': token, 'X-Requested-With': 'XMLHttpRequest', Referer: `${BASE_URL}/` });
      let res = await axios.get(`${BASE_URL}/api/domains.php`, { headers, timeout: 15000, validateStatus: () => true });
      if (res.status === 403) { const nt = await this.getToken(true); headers['X-API-Token'] = nt; res = await axios.get(`${BASE_URL}/api/domains.php`, { headers, timeout: 15000, validateStatus: () => true }); }
      if (res.status === 200 && Array.isArray(res.data) && res.data.length > 0) {
        const p = res.data.map((d: any) => (typeof d === 'object' && d ? d.ascii || d.display : null)).filter(Boolean).map((v: string) => v.trim().toLowerCase());
        if (p.length > 0) { this.domains = p; this.domainsAt = Date.now(); return this.domains; }
      }
    } catch {}
    if (this.domains.length === 0) this.domains = ['fboxmail.com','cunan.store','sds-awe.top','mengundang.live','kintil.buzz','ketua.id'];
    return this.domains;
  }

  sanitizeUser(u: string | null): string {
    if (!u) return `user_${Math.floor(Date.now() / 1000)}`;
    const c = u.trim().toLowerCase().replace(/[^a-zA-Z0-9_.-]/g, '');
    return c || `user_${Math.floor(Date.now() / 1000)}`;
  }

  async generate(user: string | null = null, domain: string | null = null): Promise<string> {
    const domains = await this.getDomains();
    let d = domain ? domain.trim().toLowerCase().replace(/^@/, '') : '';
    if (!d || !domains.includes(d)) d = domains[Math.floor(Math.random() * domains.length)] || 'fboxmail.com';
    const u = user ? this.sanitizeUser(user) : `user_${Math.random().toString(36).substring(2, 12)}`;
    return `${u}@${d}`.toLowerCase();
  }

  async checkInbox(email: string) {
    const clean = (email || '').trim().toLowerCase();
    if (!clean.includes('@')) return { status: 'error', message: 'invalid email', error_code: 'INVALID_EMAIL' };
    const [username, domain] = clean.split('@');
    this.cookies.set('inbox_ctx', encodeURIComponent(`${domain}/${username}/`));
    this.cookies.set('surl', `${domain}/${username}`);
    this.cookies.set('embx', encodeURIComponent(JSON.stringify([clean])));
    try {
      const res = await axios.get(`${BASE_URL}/inbox1/`, { headers: this.headers({ Referer: `${BASE_URL}/` }), timeout: 15000, validateStatus: () => true });
      this.updateCookies(res.headers);
      if (res.status !== 200) return { status: 'error', message: `HTTP ${res.status}`, error_code: 'HTTP_ERROR' };
      const $ = cheerio.load(res.data);
      let count = 0;
      $('script').each((_: any, el: any) => { const t = $(el).text() || ''; if (t.includes('window.SITE_DATA=')) { const m = t.match(/num_mess:\s*(\d+)/); if (m) count = parseInt(m[1], 10); } });
      const messages: any[] = [];
      $('#email-table .list-group-item').each((_: any, el: any) => {
        const item = $(el);
        const onclick = item.attr('onclick') || '';
        const m = onclick.match(/loadInboxClientSide\(['"](.*?)['"]\)/);
        messages.push({ from: item.find('[class*="from_div"]').text().trim(), subject: item.find('[class*="subj_div"]').text().trim(), date: item.find('[class*="time_div"]').text().trim(), link: m ? m[1] : '' });
      });
      const { bodyText, rawHtml } = cleanBody($);
      const otp = bodyText ? extractOtp(bodyText, rawHtml) : null;
      const links = rawHtml ? extractLinks(rawHtml) : { primary_link: null, all_links: [] };
      return { status: 'success', data: { email: clean, total_messages: Math.max(messages.length, count), messages, otp, verification_link: links.primary_link, body: rawHtml || null } };
    } catch (err: any) { return { status: 'error', message: err.message, error_code: 'NETWORK_ERROR' }; }
  }

  async readMessage(email: string, linkOrId: string) {
    const clean = (email || '').trim().toLowerCase();
    if (!clean.includes('@')) return { status: 'error', message: 'invalid email', error_code: 'INVALID_EMAIL' };
    const [username, domain] = clean.split('@');
    const link = (linkOrId || '').replace(/^\//, '');
    const url = link.startsWith(domain) ? `${BASE_URL}/${link}` : `${BASE_URL}/${domain}/${username}/${link}`;
    this.cookies.set('inbox_ctx', encodeURIComponent(`${domain}/${username}/${linkOrId}`));
    this.cookies.set('surl', `${domain}/${username}`);
    this.cookies.set('embx', encodeURIComponent(JSON.stringify([clean])));
    try {
      const res = await axios.get(url, { headers: this.headers({ Referer: `${BASE_URL}/inbox1/` }), timeout: 15000, validateStatus: () => true });
      this.updateCookies(res.headers);
      if (res.status !== 200) return { status: 'error', message: `HTTP ${res.status}`, error_code: 'HTTP_ERROR' };
      const $ = cheerio.load(res.data);
      let from = '', subject = '', date = '';
      const ht = $('#mail-summary-head').text() || '';
      for (const line of ht.split('\n')) {
        const lo = line.toLowerCase();
        if (lo.includes('from:') || lo.includes('dari:')) from = line.replace(/^(from|dari):\s*/i, '').trim();
        else if (lo.includes('subject:') || lo.includes('subjek:')) subject = line.replace(/^(subject|subjek):\s*/i, '').trim();
        else if (lo.includes('date:') || lo.includes('tanggal:') || lo.includes('received:')) date = line.replace(/^(date|tanggal|received):\s*/i, '').trim();
      }
      const { bodyText, rawHtml } = cleanBody($);
      const otp = extractOtp(bodyText, rawHtml);
      const links = extractLinks(rawHtml);
      return { status: 'success', data: { email: clean, from, subject, date, otp, verification_link: links.primary_link, body: rawHtml } };
    } catch (err: any) { return { status: 'error', message: err.message, error_code: 'NETWORK_ERROR' }; }
  }

  async waitForOtp(email: string, timeoutSec = 60) {
    const start = Date.now();
    while (Date.now() - start < timeoutSec * 1000) {
      const res = await this.checkInbox(email);
      if (res.status === 'success' && res.data?.otp) return { status: 'success', data: { email, otp: res.data.otp, subject: res.data.messages?.[0]?.subject || null } };
      await new Promise((r) => setTimeout(r, 2500));
    }
    return { status: 'timeout', message: `nggak ada OTP dalam ${timeoutSec} detik`, error_code: 'TIMEOUT' };
  }

  async waitForLink(email: string, timeoutSec = 60) {
    const start = Date.now();
    while (Date.now() - start < timeoutSec * 1000) {
      const res = await this.checkInbox(email);
      if (res.status === 'success' && res.data?.verification_link) return { status: 'success', data: { email, verification_link: res.data.verification_link } };
      await new Promise((r) => setTimeout(r, 2500));
    }
    return { status: 'timeout', message: `nggak ada link dalam ${timeoutSec} detik`, error_code: 'TIMEOUT' };
  }
}

const client = new TempMailClient();
export const tempmailRouter = express.Router();
const wrap = (p: any) => ({ developer: DEVELOPER, version: VERSION, timestamp: new Date().toISOString(), ...p });

tempmailRouter.get('/status', (_req: Request, res: Response) => {
  res.json(wrap({ status: 'online', endpoints: { domains: '/api/tempmail/domains', generate: '/api/tempmail/generate', inbox: '/api/tempmail/inbox?email=xxx', message: '/api/tempmail/message?email=xxx&link=xxx', otp: '/api/tempmail/otp?email=xxx&timeout=60', link: '/api/tempmail/link?email=xxx&timeout=60' } }));
});
tempmailRouter.get('/domains', async (req: Request, res: Response) => {
  try { const d = await client.getDomains(req.query.refresh === 'true'); res.json(wrap({ status: 'success', data: { total_domains: d.length, domains: d } })); }
  catch (e: any) { res.status(500).json(wrap({ status: 'error', message: e.message })); }
});
tempmailRouter.get('/generate', async (req: Request, res: Response) => {
  try {
    const email = await client.generate((req.query.username as string) || null, (req.query.domain as string) || null);
    const [u, d] = email.split('@');
    res.json(wrap({ status: 'success', data: { email, username: u, domain: d, inbox_url: `${BASE_URL}/${email}` } }));
  } catch (e: any) { res.status(500).json(wrap({ status: 'error', message: e.message })); }
});
tempmailRouter.get('/inbox', async (req: Request, res: Response) => {
  const email = req.query.email as string;
  if (!email) return res.status(400).json(wrap({ status: 'error', message: 'email wajib diisi', error_code: 'MISSING_PARAM' }));
  res.json(wrap(await client.checkInbox(email)));
});
tempmailRouter.get('/message', async (req: Request, res: Response) => {
  const email = req.query.email as string; const link = req.query.link as string;
  if (!email || !link) return res.status(400).json(wrap({ status: 'error', message: 'email & link wajib diisi', error_code: 'MISSING_PARAMS' }));
  res.json(wrap(await client.readMessage(email, link)));
});
tempmailRouter.get('/otp', async (req: Request, res: Response) => {
  const email = req.query.email as string;
  const t = Math.min(parseInt((req.query.timeout as string) || '60', 10), 180);
  if (!email) return res.status(400).json(wrap({ status: 'error', message: 'email wajib diisi', error_code: 'MISSING_PARAM' }));
  res.json(wrap(await client.waitForOtp(email, t)));
});
tempmailRouter.get('/link', async (req: Request, res: Response) => {
  const email = req.query.email as string;
  const t = Math.min(parseInt((req.query.timeout as string) || '60', 10), 180);
  if (!email) return res.status(400).json(wrap({ status: 'error', message: 'email wajib diisi', error_code: 'MISSING_PARAM' }));
  res.json(wrap(await client.waitForLink(email, t)));
});

export default tempmailRouter;