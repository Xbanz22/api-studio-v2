// vps-exec-handler.ts
// Endpoint eksekusi command VPS dengan whitelist + rate limit + log
import type { Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

const LOG_FILE = '/var/log/vps-exec.log';
const RATE_LIMIT_PER_MIN = 30;

// Whitelist command yang diizinkan
const COMMAND_WHITELIST = [
  /^pm2\s+(list|status|logs|restart|reload|stop|start|show)\b/,
  /^git\s+(status|log|diff|pull|fetch|branch|remote)\b/,
  /^curl\s+-s\s+(http|https):\/\/(localhost|127\.0\.0\.1)/,
  /^journalctl\b/,
  /^systemctl\s+(status|is-active|is-enabled)\b/,
  /^cat\s+\/var\/log\//,
  /^tail\s+(-\d+\s+)?\/var\/log\//,
  /^head\s+(-\d+\s+)?\/var\/log\//,
  /^ls\s+(-\w+\s+)?\/var\/www\//,
  /^df\s+-h/,
  /^free\s+-h/,
  /^uptime$/,
  /^ps\s+aux/,
  /^ss\s+-tlnp/,
  /^netstat\s+-tlnp/,
];

// Rate limit tracker (per IP)
const rateTracker = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const hits = (rateTracker.get(ip) || []).filter((t) => now - t < windowMs);
  if (hits.length >= RATE_LIMIT_PER_MIN) return false;
  hits.push(now);
  rateTracker.set(ip, hits);
  return true;
}

function isWhitelisted(cmd: string): boolean {
  return COMMAND_WHITELIST.some((re) => re.test(cmd.trim()));
}

function logExecution(ip: string, cmd: string, result: { ok: boolean; duration: number; error?: string }) {
  const entry = {
    timestamp: new Date().toISOString(),
    ip,
    cmd,
    ok: result.ok,
    durationMs: result.duration,
    error: result.error,
  };
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch {}
}

export async function handleVpsExec(req: Request, res: Response) {
  const start = Date.now();
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';

  // Cek API key
  const providedKey = (req.headers['x-vps-key'] as string) || (req.body?.key as string) || (req.query.key as string);
  const expectedKey = process.env.VPS_EXEC_KEY;

  if (!expectedKey) {
    return res.status(500).json({ ok: false, error: 'VPS_EXEC_KEY belum di-set di environment' });
  }

  if (providedKey !== expectedKey) {
    logExecution(ip, '(auth_failed)', { ok: false, duration: Date.now() - start, error: 'invalid key' });
    return res.status(401).json({ ok: false, error: 'API key invalid' });
  }

  // Cek rate limit
  if (!checkRateLimit(ip)) {
    logExecution(ip, '(rate_limited)', { ok: false, duration: Date.now() - start, error: 'rate limited' });
    return res.status(429).json({ ok: false, error: `Rate limit: max ${RATE_LIMIT_PER_MIN} req/menit` });
  }

  // Ambil command
  const cmd = (req.body?.command as string) || (req.query.command as string) || '';

  if (!cmd || typeof cmd !== 'string') {
    return res.status(400).json({ ok: false, error: 'Parameter "command" wajib diisi' });
  }

  if (cmd.length > 1000) {
    return res.status(400).json({ ok: false, error: 'Command terlalu panjang (max 1000 char)' });
  }

  // Cek whitelist
  if (!isWhitelisted(cmd)) {
    logExecution(ip, cmd, { ok: false, duration: Date.now() - start, error: 'not whitelisted' });
    return res.status(403).json({
      ok: false,
      error: 'Command nggak diizinkan (nggak masuk whitelist)',
      hint: 'Whitelist: pm2, git status/log/diff/pull, curl localhost, journalctl, systemctl status, cat log, tail log, ls /var/www, df, free, uptime, ps, ss, netstat',
    });
  }

  // Eksekusi
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: 30_000,
      maxBuffer: 5 * 1024 * 1024,
      cwd: '/var/www/api-studio-v2',
      shell: '/bin/bash',
    });

    const duration = Date.now() - start;
    logExecution(ip, cmd, { ok: true, duration });

    return res.json({
      ok: true,
      command: cmd,
      stdout: stdout.slice(0, 50_000),
      stderr: stderr?.slice(0, 5_000) || '',
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    const duration = Date.now() - start;
    logExecution(ip, cmd, { ok: false, duration, error: err.message });

    return res.status(500).json({
      ok: false,
      command: cmd,
      error: err.message,
      stdout: err.stdout?.slice(0, 50_000) || '',
      stderr: err.stderr?.slice(0, 5_000) || '',
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
  }
}
