import { ApiEndpoint } from '../../../types';

export const alightMotionEndpoint: ApiEndpoint = {
  id: 'tools-alightmotion',
  name: 'AlightMotion Premium Generator',
  nameId: 'AlightMotion Premium Generator',
  category: 'tools',
  method: 'POST',
  path: '/api/tools/alightmotion',
  summary: 'Send & verify Alight Motion magic link to unlock premium features',
  summaryId: 'Kirim dan verifikasi magic link Alight Motion untuk membuka fitur premium',
  description: 'Proxies the AlightMotion Premium Generator API. Two actions: send_link (sends a magic link to the email) and verify_link (redeems the magic link for premium access). The magic link is sent to the inbox/spam folder after calling send_link.',
  descriptionId: 'Jembatan ke API AlightMotion Premium Generator. Dua aksi: send_link (mengirim magic link ke email) dan verify_link (menukar magic link untuk akses premium). Magic link dikirim ke inbox/folder spam setelah memanggil send_link.',
  tags: ['Tools', 'AlightMotion', 'Premium', 'MagicLink', 'VideoEditing'],
  queryParams: [
    {
      name: 'action',
      type: 'enum',
      required: true,
      defaultValue: 'send_link',
      options: ['send_link', 'verify_link'],
      description: 'Action mode: send_link (email the magic link) or verify_link (redeem the magic link)',
      descriptionId: 'Mode aksi: send_link (kirim magic link ke email) atau verify_link (verifikasi magic link)'
    },
    {
      name: 'email',
      type: 'string',
      required: true,
      defaultValue: 'kamu@example.com',
      description: 'Alight Motion account email (e.g. kamu@example.com)',
      descriptionId: 'Email akun Alight Motion (contoh: kamu@example.com)'
    },
    {
      name: 'magicLink',
      type: 'string',
      description: 'Magic link from the email (required for action=verify_link), e.g. https://nyxieamprem.vercel.app/api/verify?token=...',
      descriptionId: 'Magic link dari email (wajib untuk action=verify_link), contoh: https://nyxieamprem.vercel.app/api/verify?token=...'
    }
  ],
  requestBodySample: {
    action: 'send_link',
    email: 'kamu@example.com',
    magicLink: 'https://nyxieamprem.vercel.app/api/verify?token=abc123'
  },
  responseSample: {
    success: true,
    action: 'send_link',
    email: 'kamu@example.com',
    data: {
      success: true,
      email: 'kamu@example.com',
      message: 'link dikirim ke kamu@example.com. cek inbox / spam.'
    },
    upstream: 'https://nyxieamprem.vercel.app/api/send-link',
    timestamp: '2026-09-20T05:35:17.000Z'
  }
};
