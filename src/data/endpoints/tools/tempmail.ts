import { ApiEndpoint } from '../../../types';

export const tempmailStatusEndpoint: ApiEndpoint = {
  id: 'tools-tempmail-status',
  name: 'Temp Mail Status',
  nameId: 'Temp Mail Status',
  category: 'tools',
  method: 'GET',
  path: '/api/tempmail/status',
  summary: 'Check tempmail service status and list available endpoints',
  summaryId: 'Cek status service tempmail dan daftar endpoint yang tersedia',
  description: 'Returns the operational status of the Temp Mail service, version info, developer info, and all available endpoint paths.',
  descriptionId: 'Mengembalikan status operasional service Temp Mail, info versi, developer, dan semua path endpoint yang tersedia.',
  tags: ['Tools', 'TempMail', 'Status'],
  responseSample: {
    developer: 'api.baniw-space.my.id',
    version: '1.0.0',
    status: 'online',
    endpoints: {
      domains: '/api/tempmail/domains',
      generate: '/api/tempmail/generate',
      inbox: '/api/tempmail/inbox?email=xxx',
      message: '/api/tempmail/message?email=xxx&link=xxx',
      otp: '/api/tempmail/otp?email=xxx&timeout=60',
      link: '/api/tempmail/link?email=xxx&timeout=60'
    }
  }
};

export const tempmailDomainsEndpoint: ApiEndpoint = {
  id: 'tools-tempmail-domains',
  name: 'Temp Mail Active Domains',
  nameId: 'Temp Mail Domain Aktif',
  category: 'tools',
  method: 'GET',
  path: '/api/tempmail/domains',
  summary: 'Get list of active temp-mail domains scraped from generator.email',
  summaryId: 'Ambil daftar domain temp-mail aktif hasil scrape dari generator.email',
  description: 'Scrapes and returns all currently-active temp-mail domains from generator.email. Pass refresh=true to bypass cache and get fresh list.',
  descriptionId: 'Scrape dan kembalikan semua domain temp-mail yang aktif dari generator.email. Kirim refresh=true untuk lewati cache dan dapatkan list terbaru.',
  tags: ['Tools', 'TempMail', 'Domains'],
  queryParams: [
    {
      name: 'refresh',
      type: 'boolean',
      required: false,
      defaultValue: 'false',
      description: 'Force refresh domains list (bypass 5-minute cache)',
      descriptionId: 'Paksa refresh list domain (lewati cache 5 menit)'
    }
  ],
  responseSample: {
    developer: 'api.baniw-space.my.id',
    version: '1.0.0',
    status: 'success',
    data: {
      total_domains: 15,
      domains: ['ndhello.us', 'pasarakun.me', 'kakaoemail.kr', 'fboxmail.com']
    }
  }
};

export const tempmailGenerateEndpoint: ApiEndpoint = {
  id: 'tools-tempmail-generate',
  name: 'Temp Mail Generate',
  nameId: 'Temp Mail Generate',
  category: 'tools',
  method: 'GET',
  path: '/api/tempmail/generate',
  summary: 'Generate a new temporary email address',
  summaryId: 'Generate alamat email temporary baru',
  description: 'Generates a new temp-mail address. Optionally specify username (custom prefix) and domain (from active domains). If neither given, uses a random username & domain.',
  descriptionId: 'Generate alamat temp-mail baru. Bisa tentukan username (prefix custom) dan domain (dari domain aktif). Kalau kosong, pake username & domain random.',
  tags: ['Tools', 'TempMail', 'Generate'],
  queryParams: [
    {
      name: 'username',
      type: 'string',
      required: false,
      defaultValue: 'mytest',
      description: 'Custom username (prefix before @). Leave empty for random',
      descriptionId: 'Username custom (prefix sebelum @). Kosongin buat random'
    },
    {
      name: 'domain',
      type: 'string',
      required: false,
      defaultValue: 'ndhello.us',
      description: 'Domain to use (must be in active domains list). Leave empty for random',
      descriptionId: 'Domain yang dipake (harus ada di list domain aktif). Kosongin buat random'
    }
  ],
  responseSample: {
    developer: 'api.baniw-space.my.id',
    version: '1.0.0',
    status: 'success',
    data: {
      email: 'mytest@ndhello.us',
      username: 'mytest',
      domain: 'ndhello.us',
      inbox_url: 'https://generator.email/mytest@ndhello.us'
    }
  }
};

export const tempmailInboxEndpoint: ApiEndpoint = {
  id: 'tools-tempmail-inbox',
  name: 'Temp Mail Inbox',
  nameId: 'Temp Mail Inbox',
  category: 'tools',
  method: 'GET',
  path: '/api/tempmail/inbox',
  summary: 'Check inbox and auto-extract OTP / verification link',
  summaryId: 'Cek inbox dan otomatis extract OTP / verification link',
  description: 'Fetches the inbox of the given temp email. Automatically parses OTP codes (4-8 digits) and verification links from the latest messages.',
  descriptionId: 'Ambil inbox dari email temp yang dikasih. Otomatis parse kode OTP (4-8 digit) dan link verifikasi dari pesan terakhir.',
  tags: ['Tools', 'TempMail', 'Inbox', 'OTP'],
  queryParams: [
    {
      name: 'email',
      type: 'string',
      required: true,
      defaultValue: 'test@ndhello.us',
      description: 'Temp email address to check',
      descriptionId: 'Alamat email temp yang mau dicek'
    }
  ],
  responseSample: {
    developer: 'api.baniw-space.my.id',
    status: 'success',
    data: {
      email: 'test@ndhello.us',
      total_messages: 1,
      messages: [{ from: 'noreply@service.com', subject: 'Your OTP Code', date: '2 minutes ago', link: 'inbox/xxx' }],
      otp: '418450',
      verification_link: 'https://service.com/verify?token=xxx'
    }
  }
};

export const tempmailMessageEndpoint: ApiEndpoint = {
  id: 'tools-tempmail-message',
  name: 'Temp Mail Read Message',
  nameId: 'Temp Mail Baca Pesan',
  category: 'tools',
  method: 'GET',
  path: '/api/tempmail/message',
  summary: 'Read a specific email message by its link',
  summaryId: 'Baca pesan email tertentu berdasarkan link-nya',
  description: 'Reads a single email message from temp mailbox. Requires the email address and the message link (obtained from /inbox response). Returns parsed OTP and verification link if present.',
  descriptionId: 'Baca satu pesan email dari temp mailbox. Butuh alamat email dan link pesan (didapat dari response /inbox). Kembalikan OTP dan link verifikasi yang ter-parse kalau ada.',
  tags: ['Tools', 'TempMail', 'Message'],
  queryParams: [
    {
      name: 'email',
      type: 'string',
      required: true,
      defaultValue: 'test@ndhello.us',
      description: 'Temp email address',
      descriptionId: 'Alamat email temp'
    },
    {
      name: 'link',
      type: 'string',
      required: true,
      defaultValue: 'inbox/xxx',
      description: 'Message link from /inbox response',
      descriptionId: 'Link pesan dari response /inbox'
    }
  ],
  responseSample: {
    developer: 'api.baniw-space.my.id',
    status: 'success',
    data: {
      email: 'test@ndhello.us',
      from: 'noreply@service.com',
      subject: 'Your OTP Code',
      date: '2026-10-02 15:49:00',
      otp: '418450',
      verification_link: 'https://service.com/verify?token=xxx',
      body: '<div>...</div>'
    }
  }
};

export const tempmailOtpEndpoint: ApiEndpoint = {
  id: 'tools-tempmail-otp',
  name: 'Temp Mail Wait OTP',
  nameId: 'Temp Mail Tunggu OTP',
  category: 'tools',
  method: 'GET',
  path: '/api/tempmail/otp',
  summary: 'Poll inbox until an OTP arrives (up to N seconds)',
  summaryId: 'Polling inbox sampai OTP dateng (maksimal N detik)',
  description: 'Polls the inbox every 2.5 seconds until an OTP code is detected or timeout. Default 60 seconds, maximum 180 seconds.',
  descriptionId: 'Polling inbox tiap 2.5 detik sampai kode OTP terdeteksi atau timeout. Default 60 detik, maksimal 180 detik.',
  tags: ['Tools', 'TempMail', 'OTP', 'Polling'],
  queryParams: [
    {
      name: 'email',
      type: 'string',
      required: true,
      defaultValue: 'test@ndhello.us',
      description: 'Temp email address',
      descriptionId: 'Alamat email temp'
    },
    {
      name: 'timeout',
      type: 'number',
      required: false,
      defaultValue: '60',
      description: 'Max seconds to wait (max 180)',
      descriptionId: 'Maksimal detik nunggu (maks 180)'
    }
  ],
  responseSample: {
    developer: 'api.baniw-space.my.id',
    status: 'success',
    data: {
      email: 'test@ndhello.us',
      otp: '418450',
      subject: 'Your OTP Code'
    }
  }
};

export const tempmailLinkEndpoint: ApiEndpoint = {
  id: 'tools-tempmail-link',
  name: 'Temp Mail Wait Verification Link',
  nameId: 'Temp Mail Tunggu Link Verifikasi',
  category: 'tools',
  method: 'GET',
  path: '/api/tempmail/link',
  summary: 'Poll inbox until a verification link arrives (up to N seconds)',
  summaryId: 'Polling inbox sampai link verifikasi dateng (maksimal N detik)',
  description: 'Polls the inbox every 2.5 seconds until a verification link is detected or timeout. Default 60 seconds, maximum 180 seconds.',
  descriptionId: 'Polling inbox tiap 2.5 detik sampai link verifikasi terdeteksi atau timeout. Default 60 detik, maksimal 180 detik.',
  tags: ['Tools', 'TempMail', 'Link', 'Polling'],
  queryParams: [
    {
      name: 'email',
      type: 'string',
      required: true,
      defaultValue: 'test@ndhello.us',
      description: 'Temp email address',
      descriptionId: 'Alamat email temp'
    },
    {
      name: 'timeout',
      type: 'number',
      required: false,
      defaultValue: '60',
      description: 'Max seconds to wait (max 180)',
      descriptionId: 'Maksimal detik nunggu (maks 180)'
    }
  ],
  responseSample: {
    developer: 'api.baniw-space.my.id',
    status: 'success',
    data: {
      email: 'test@ndhello.us',
      verification_link: 'https://service.com/verify?token=xxx'
    }
  }
};

export const tempmailEndpoints: ApiEndpoint[] = [
  tempmailStatusEndpoint,
  tempmailDomainsEndpoint,
  tempmailGenerateEndpoint,
  tempmailInboxEndpoint,
  tempmailMessageEndpoint,
  tempmailOtpEndpoint,
  tempmailLinkEndpoint
];