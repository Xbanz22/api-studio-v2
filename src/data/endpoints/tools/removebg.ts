import { ApiEndpoint } from '../../../types';

export const removebgEndpoint: ApiEndpoint = {
  id: 'tools-removebg',
  name: 'Remove Background',
  nameId: 'Hapus Background',
  category: 'tools',
  method: 'POST',
  path: '/api/tools/removebg',
  summary: 'Remove image background and return transparent PNG (via iLoveIMG)',
  summaryId: 'Hapus background gambar dan kembalikan PNG transparan (via iLoveIMG)',
  description: 'AI-powered background removal via iLoveIMG. Accepts image URL or file upload. Returns transparent PNG (base64 by default, or raw PNG with ?raw=true). Max 2MB input, up to 4.4 megapixels output.',
  descriptionId: 'Hapus background bertenaga AI via iLoveIMG. Terima URL gambar atau upload file. Kembalikan PNG transparan (base64 by default, atau PNG binary dengan ?raw=true). Max 2MB input, output sampai 4.4 megapiksel.',
  tags: ['Tools', 'Image', 'Background', 'Remove', 'iLoveIMG', 'AI'],
  queryParams: [
    {
      name: 'url',
      type: 'string',
      required: false,
      defaultValue: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      description: 'Image URL to process (alternative to file upload via multipart field "image")',
      descriptionId: 'URL gambar untuk diproses (alternatif dari upload file via field "image")',
    },
    {
      name: 'raw',
      type: 'boolean',
      required: false,
      defaultValue: false,
      description: 'If true, returns raw PNG binary. Otherwise JSON with base64.',
      descriptionId: 'Kalau true, kembalikan PNG binary. Kalau false, JSON dengan base64.',
    },
  ],
  responseSample: {
    creator: 'baniw',
    timestamp: '2026-10-10T10:08:25.348Z',
    success: true,
    data: {
      image_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...',
      width: 400,
      height: 400,
      size_bytes: 45678,
      server: 'api4g',
      transparent: true,
    },
  },
};
