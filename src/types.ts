export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type EndpointCategory = 'ai' | 'tools' | 'data' | 'keys' | 'mock' | 'system';

export interface ApiParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'json';
  required?: boolean;
  defaultValue?: string | number | boolean;
  description: string;
  descriptionId?: string;
  options?: string[];
  showWhen?: { param: string; equals: string | string[] };
}

export interface ApiEndpoint {
  id: string;
  name: string;
  nameId: string;
  category: EndpointCategory;
  method: HttpMethod;
  path: string;
  summary: string;
  summaryId: string;
  description: string;
  descriptionId: string;
  tags: string[];
  queryParams?: ApiParam[];
  pathParams?: ApiParam[];
  headers?: ApiParam[];
  requestBodySample?: Record<string, any> | string;
  responseSample: Record<string, any>;
  requiresApiKey?: boolean;
}

export interface ApiExecutionResult {
  status: number;
  statusText: string;
  latencyMs: number;
  payloadSizeKb: number;
  headers: Record<string, string>;
  data: any;
  timestamp: string;
  requestUrl: string;
  requestMethod: string;
  requestBody?: any;
  requestHeaders?: Record<string, string>;
}

export type AccountTier = 'Free' | 'Basic' | 'Pro' | 'Developer' | 'Enterprise';

export interface ApiKeyItem {
  key: string;
  name: string;
  tier: AccountTier;
  rateLimit: number;
  requestCount: number;
  totalLimit: number;
  createdAt: string;
  lastUsedAt?: string;
  ownerEmail?: string;
  status?: 'active' | 'suspended' | 'revoked';
  allowedIps?: string[];
  allowedOrigins?: string[];
}

export type UserRole = 'user' | 'admin';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  tier: AccountTier;
  company?: string;
  createdAt: string;
  lastLoginAt: string;
  subscriptionExpiresAt?: string;
}

export interface SecuritySettings {
  maintenanceMode: boolean;
  blockedIps: string[];
  globalRateMultiplier: number;
  requireAuthForPublicEndpoints: boolean;
  corsOrigins: string[];
  endpointTiers?: Record<string, string>;
  captchaEnabled?: boolean;
  requireCaptchaRegister?: boolean;
  requireCaptchaForgot?: boolean;
  requireCaptchaLogin?: boolean;
  requireCaptchaGoogle?: boolean;
  captchaMode?: 'mixed' | 'text' | 'math' | 'turnstile';
  captchaProvider?: 'turnstile' | 'distortion' | 'math' | 'all';
}

export interface MockRouteItem {
  id: string;
  path: string;
  method: string;
  status: number;
  delayMs: number;
  responseBody: any;
  queryParams?: ApiParam[];
  headers?: ApiParam[];
  requestBodySample?: any;
  description?: string;
  createdAt: string;
}

export interface ApiLogItem {
  id: string;
  method: string;
  url: string;
  status: number;
  latencyMs: number;
  ip: string;
  timestamp: string;
  userAgent?: string;
  bodyPreview?: string;
}

export interface VisitorStats {
  totalVisitors: number;
  uniqueVisitors: number;
  todayVisitors: number;
  onlineNow: number;
}

export interface ServerStats {
  totalRequests: number;
  requestsToday: number;
  requestsThisWeek: number;
  requestsThisMonth: number;
  avgLatencyMs: number;
  successRatePercent: number;
  statusBreakdown: Record<string, number>;
  methodBreakdown: Record<string, number>;
  topEndpoints: Record<string, number>;
  activeApiKeys: number;
  activeMockRoutes: number;
  visitorStats?: VisitorStats;
}

export interface SiteSettings {
  title: string;
  tagline: string;
  description: string;
  faviconUrl: string;
  thumbnailUrl: string;
  logoIcon: string;
  supportWhatsapp?: string;
  supportTelegram?: string;
  heroVideoUrl?: string;
  enableHeroVideo?: boolean;
}

export interface TierRateLimitConfig {
  tier: 'Free' | 'Pro' | 'Enterprise';
  requestsPerMinute: number; // -1 for unlimited
  requestsPerDay: number; // -1 for unlimited
  requestsPerWeek: number; // -1 for unlimited
  requestsPerMonth: number; // -1 for unlimited
  burstLimit: number; // max burst or -1
  enabled: boolean;
  description?: string;
}

export interface RateLimitManagerSettings {
  enabled: boolean;
  globalMultiplier: number;
  emergencyThrottle: boolean;
  totalViolationsBlocked: number;
  lastUpdated?: string;
  tiers: {
    Free: TierRateLimitConfig;
    Pro: TierRateLimitConfig;
    Enterprise: TierRateLimitConfig;
  };
}

export interface RateLimitUsageStats {
  tier: 'Free' | 'Pro' | 'Enterprise';
  activeUsers: number;
  activeKeys: number;
  requestsToday: number;
  requestsThisWeek: number;
  requestsThisMonth: number;
  minuteLimit: number;
  dayLimit: number;
  weekLimit: number;
  monthLimit: number;
  dayUtilizationPercent: number;
  monthUtilizationPercent: number;
  violationsBlocked: number;
}

export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  rateLimit: number; // requests per minute
  totalLimit: number; // max requests per month
  description: string;
  features: string[];
  isPopular?: boolean;
  isDefault?: boolean;
  badgeColor?: string;
  createdAt?: string;
}

export interface SystemAnnouncement {
  enabled: boolean;
  message: string;
  type: 'info' | 'warning' | 'success';
  updatedAt?: string;
}

export interface WebhookDeliveryItem {
  id: string;
  targetUrl: string;
  event: string;
  status: number;
  statusText: string;
  latencyMs: number;
  payload: any;
  headers: Record<string, string>;
  responseBodyPreview?: string;
  signature: string;
  success: boolean;
  timestamp: string;
}

export interface SpeedtestRegion {
  id: string;
  name: string;
  country: string;
  flag: string;
  baseLatencyMs: number;
  provider: string;
}

export interface TelegramSettings {
  enabled: boolean;
  botToken: string;
  chatId: string;
  sendOnErrors: boolean;
  sendOnSecurityAlerts: boolean;
  sendOnAllRequests: boolean;
  sendOnKeyActivity: boolean;
  autoBackupEnabled?: boolean;
  autoBackupIntervalHours?: number;
  lastAutoBackupAt?: string | null;
  lastTestStatus?: {
    success: boolean;
    message: string;
    timestamp: string;
  } | null;
}

export interface SystemBackupData {
  version: string;
  timestamp: string;
  exportedBy: string;
  stats: {
    totalUsers: number;
    totalApiKeys: number;
    totalMockRoutes: number;
    totalPricingPlans: number;
    totalPaymentRequests: number;
    totalLogs: number;
  };
  users: any[];
  apiKeys: any[];
  mockRoutes: any[];
  pricingPlans: any[];
  paymentRequests: any[];
  securitySettings: any;
  systemAnnouncement: any;
  telegramSettings: any;
}

export interface ManualPaymentMethod {
  id: string;
  type: 'bank' | 'ewallet' | 'qris';
  name: string;
  accountNumber: string;
  accountHolder: string;
  instructions: string;
  iconName?: string;
  qrImageUrl?: string;
}

export interface ManualPaymentRequest {
  id: string; // INV-YYYYMMDD-XXXX
  userEmail: string;
  userName: string;
  planId: string;
  planName: string;
  targetTier: AccountTier;
  amount: number;
  uniqueCode: number;
  totalAmount: number;
  paymentMethodId: string;
  paymentMethodName: string;
  senderAccountName: string;
  senderAccountNumber?: string;
  proofImageUrl?: string;
  notes?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminNotes?: string;
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
}

