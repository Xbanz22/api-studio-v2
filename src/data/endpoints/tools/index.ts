import { ApiEndpoint } from '../../../types';
import { netflixEndpoint } from './netflix';
import { stalkTiktokEndpoint } from './stalktiktok';
import { qrEndpoint } from './qr';
import { uuidEndpoint } from './uuid';
import { hashEndpoint } from './hash';
import { passwordEndpoint } from './password';
import { ipEndpoint } from './ip';
import { scrapeEndpoint } from './scrape';
import { pinterestEndpoint } from './pinterest';
import { nftokenEndpoint } from './nftoken';
import { tiktokDownloaderEndpoint } from './tiktok';
import { alightMotionEndpoint } from './alightmotion';

export const toolsEndpoints: ApiEndpoint[] = [
  netflixEndpoint,
  stalkTiktokEndpoint,
  qrEndpoint,
  uuidEndpoint,
  hashEndpoint,
  passwordEndpoint,
  ipEndpoint,
  scrapeEndpoint,
  pinterestEndpoint,
  nftokenEndpoint,
  tiktokDownloaderEndpoint,
  alightMotionEndpoint
];

export {
  netflixEndpoint,
  stalkTiktokEndpoint,
  qrEndpoint,
  uuidEndpoint,
  hashEndpoint,
  passwordEndpoint,
  ipEndpoint,
  scrapeEndpoint,
  pinterestEndpoint,
  nftokenEndpoint,
  tiktokDownloaderEndpoint,
  alightMotionEndpoint
};
