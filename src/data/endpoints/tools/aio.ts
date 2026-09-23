import { ApiEndpoint } from '../../../types';

export const aioDownloaderEndpoint: ApiEndpoint = {
  id: 'tools-aio',
  name: 'All-In-One Downloader',
  nameId: 'All-In-One Downloader',
  category: 'tools',
  method: 'GET',
  path: '/api/tools/aio',
  summary: 'Auto-detect the platform from any URL and return downloadable media',
  summaryId: 'Deteksi platform otomatis dari URL apa pun dan kembalikan media yang dapat diunduh',
  description: 'Universal media downloader. Just pass a URL and the endpoint detects the platform automatically (TikTok, Instagram, YouTube, Facebook, Twitter/X, Threads, Pinterest, Reddit, Dailymotion, Snapchat, Likee). TikTok uses a native scraper for the best reliability; other platforms try the cobalt.tools service first, then fall back to OpenGraph meta-tag extraction.',
  descriptionId: 'Downloader media universal. Cukup kirim URL dan endpoint akan mendeteksi platform-nya secara otomatis (TikTok, Instagram, YouTube, Facebook, Twitter/X, Threads, Pinterest, Reddit, Dailymotion, Snapchat, Likee). TikTok memakai scraper native yang paling andal; platform lain mencoba layanan cobalt.tools terlebih dahulu, lalu fallback ke ekstraksi meta-tag OpenGraph.',
  tags: ['Tools', 'Downloader', 'AIO', 'Social Media', 'Video', 'Universal'],
  queryParams: [
    {
      name: 'url',
      type: 'string',
      required: true,
      defaultValue: 'https://vt.tiktok.com/ZSqJGDDKP/',
      description: 'URL of the post/video to download (any supported platform)',
      descriptionId: 'URL dari post/video yang ingin diunduh (platform apa pun yang didukung)'
    }
  ],
  requestBodySample: {
    url: 'https://www.instagram.com/reel/Cxxxxx/'
  },
  responseSample: {
    success: true,
    platform: 'tiktok',
    url: 'https://vt.tiktok.com/ZSqJGDDKP/',
    data: {
      title: 'Contoh video TikTok',
      author: { username: 'username', nickname: 'Nickname' },
      download: ['https://v16-webapp.tiktok.com/...'],
      stats: { diggCount: 1234, commentCount: 56, shareCount: 78 }
    },
    timestamp: '2026-09-23T12:00:00.000Z'
  }
};
