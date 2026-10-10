import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Code2,
  Send,
  Loader2,
  Clock,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Key,
  ShieldCheck,
  Tag,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowRight,
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  Wand2,
  Wrench,
  Database,
  Activity,
  Layers
} from 'lucide-react';
import { ApiEndpoint, ApiExecutionResult, ApiKeyItem, HttpMethod, MockRouteItem, UserProfile } from '../types';
import { JsonViewer } from './JsonViewer';
import { CATEGORIES, BUILTIN_ENDPOINTS } from '../data/endpoints';

interface ApiExplorerProps {
  endpoint: ApiEndpoint;
  selectedMockRoute?: MockRouteItem | null;
  onUpdateMockRoute?: (mockId: string, updates: Partial<MockRouteItem>) => void;
  apiKeys: ApiKeyItem[];
  selectedApiKey?: string;
  onSelectApiKey?: (key: string) => void;
  currentUser?: UserProfile | null;
  lang: 'id' | 'en';
  onLogNewRequest?: () => void;
  onBackToList?: () => void;
  endpointTiers?: Record<string, string>;
  onSelectEndpoint?: (endpoint: ApiEndpoint) => void;
}

export const ApiExplorer: React.FC<ApiExplorerProps> = ({
  endpoint,
  selectedMockRoute,
  onUpdateMockRoute,
  apiKeys,
  selectedApiKey: propSelectedApiKey,
  onSelectApiKey,
  currentUser,
  lang,
  onLogNewRequest,
  onBackToList,
  endpointTiers,
  onSelectEndpoint,
}) => {
  const [explorerViewMode, setExplorerViewMode] = useState<'categories' | 'category-endpoints' | 'playground'>('categories');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [categorySearchQuery, setCategorySearchQuery] = useState<string>('');

  const prevEndpointIdRef = useRef<string>(endpoint.id);
  useEffect(() => {
    if (prevEndpointIdRef.current !== endpoint.id) {
      prevEndpointIdRef.current = endpoint.id;
      setExplorerViewMode('playground');
    }
  }, [endpoint.id]);

  const getCategoryIcon = (catId: string) => {
    switch (catId) {
      case 'ai': return Sparkles;
      case 'tools': return Wrench;
      case 'data': return Database;
      case 'keys': return Key;
      case 'system': return Activity;
      default: return Code2;
    }
  };

  const [method, setMethod] = useState<HttpMethod>(endpoint.method);
  const [queryParams, setQueryParams] = useState<Record<string, any>>({});
  const [customParamsList, setCustomParamsList] = useState<Array<{ id: string; key: string; value: string; description?: string }>>([]);
  const [isSavingMock, setIsSavingMock] = useState(false);
  const [saveMockSuccess, setSaveMockSuccess] = useState(false);
  const [pathParams, setPathParams] = useState<Record<string, any>>({});
  const [headers, setHeaders] = useState<Record<string, string>>({
    'Content-Type': 'application/json',
    Accept: 'application/json'
  });
  const [internalApiKey, setInternalApiKey] = useState<string>('');
  
  // Use controlled or uncontrolled key
  const activeApiKey = propSelectedApiKey !== undefined ? propSelectedApiKey : internalApiKey;
  const setActiveApiKey = (k: string) => {
    if (onSelectApiKey) onSelectApiKey(k);
    setInternalApiKey(k);
  };

  const activeKeyObj = apiKeys.find((k) => k.key === activeApiKey);
  const [requestBodyText, setRequestBodyText] = useState<string>('');
  const [bodyError, setBodyError] = useState<string | null>(null);

  const [activeReqTab, setActiveReqTab] = useState<'params' | 'headers' | 'body'>('params');
  const [activeResTab, setActiveResTab] = useState<'body' | 'headers' | 'preview'>('body');
  const [activeSnippetLang, setActiveSnippetLang] = useState<'curl' | 'javascript' | 'python' | 'axios' | 'node' | 'php'>('curl');

  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [result, setResult] = useState<ApiExecutionResult | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 1-Click Mandatory Key Generation for Users
  const handleQuickGenerateKey = async () => {
    if (!currentUser?.email) return;
    setIsGeneratingKey(true);
    setBodyError(null);
    try {
      const res = await fetch('/api/keys/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email,
          'x-user-role': currentUser.role || 'user'
        },
        body: JSON.stringify({
          name: `${currentUser.name || 'User'}'s ${currentUser.tier || 'Free'} Key`,
          tier: currentUser.tier || 'Free',
          ownerEmail: currentUser.email
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        onSelectApiKey?.(data.data.key);
        setInternalApiKey(data.data.key);
        onLogNewRequest?.();
      } else {
        alert(data.error || 'Gagal membuat API Key');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleCancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  // Sync state whenever endpoint changes
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setMethod(endpoint.method);
    setIsLoading(false);
    
    // Init query params
    const initialQuery: Record<string, any> = {};
    endpoint.queryParams?.forEach((p) => {
      if (p.defaultValue !== undefined) {
        initialQuery[p.name] = p.defaultValue;
      }
    });
    setQueryParams(initialQuery);
    setCustomParamsList([]);

    // Init path params
    const initialPath: Record<string, any> = {};
    if (endpoint.path.includes(':')) {
      const match = endpoint.path.match(/:([a-zA-Z0-9_]+)/g);
      match?.forEach((m) => {
        const key = m.replace(':', '');
        initialPath[key] = key === 'id' ? 'usr_1' : '1';
      });
    }
    setPathParams(initialPath);

    // Init request body
    if (endpoint.requestBodySample) {
      setRequestBodyText(
        typeof endpoint.requestBodySample === 'string'
          ? endpoint.requestBodySample
          : JSON.stringify(endpoint.requestBodySample, null, 2)
      );
      setActiveReqTab('body');
    } else {
      setRequestBodyText('');
      setActiveReqTab('params');
    }

    setResult(null);
  }, [endpoint.id]);

  // Construct current URL
  const computeUrl = () => {
    let resolvedPath = endpoint.path;
    Object.entries(pathParams).forEach(([k, v]) => {
      resolvedPath = resolvedPath.replace(`:${k}`, encodeURIComponent(String(v)));
    });

    const url = new URL(resolvedPath, window.location.origin);
    Object.entries(queryParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        url.searchParams.set(k, String(v));
      }
    });

    customParamsList.forEach((cp) => {
      if (cp.key.trim() && cp.value !== undefined && cp.value !== null && String(cp.value).trim() !== '') {
        url.searchParams.set(cp.key.trim(), String(cp.value).trim());
      }
    });

    if (activeApiKey) {
      url.searchParams.set('apiKey', activeApiKey);
    }
    return url.pathname + url.search;
  };

  // Prettify / Format JSON Body
  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(requestBodyText);
      setRequestBodyText(JSON.stringify(parsed, null, 2));
      setBodyError(null);
    } catch (err: any) {
      setBodyError(err.message);
    }
  };

  // Execute API Call Live
  const handleExecute = async () => {
    setIsLoading(true);
    setResult(null);
    setBodyError(null);

    if (!activeApiKey) {
      setBodyError(lang === 'id' ? 'Kunci API wajib dipilih untuk menjalankan request. Mode tanpa API Key (publik) telah dinonaktifkan demi keamanan.' : 'An active API Key is required to send requests. Public mode has been disabled.');
      setIsLoading(false);
      return;
    }

    const fullUrl = computeUrl();
    const startTime = performance.now();

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current === controller) {
        controller.abort();
      }
    }, 60000);

    const reqHeaders: Record<string, string> = { ...headers };
    reqHeaders['x-internal-request'] = 'true';
    if (activeApiKey) {
      reqHeaders['x-api-key'] = activeApiKey;
    }
    if (currentUser) {
      reqHeaders['x-user-role'] = currentUser.role;
      reqHeaders['x-user-email'] = currentUser.email;
    }

    let parsedBody: any = undefined;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && requestBodyText.trim()) {
      try {
        parsedBody = JSON.parse(requestBodyText);
        reqHeaders['Content-Type'] = 'application/json';
      } catch (err: any) {
        setBodyError(lang === 'id' ? 'Format JSON Request Body tidak valid: ' + err.message : 'Invalid JSON Request Body: ' + err.message);
        clearTimeout(timeoutId);
        abortControllerRef.current = null;
        setIsLoading(false);
        return;
      }
    }

    try {
      const response = await fetch(fullUrl, {
        method,
        headers: reqHeaders,
        body: parsedBody ? JSON.stringify(parsedBody) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const latencyMs = Math.round(performance.now() - startTime);

      // Collect response headers
      const resHeaders: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        resHeaders[key] = val;
      });

      let resData: any = null;
      let rawText = '';
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        resData = await response.json();
        rawText = JSON.stringify(resData);
      } else {
        rawText = await response.text();
        resData = rawText;
      }

      const payloadSizeKb = Math.round((new Blob([rawText]).size / 1024) * 100) / 100;

      setResult({
        status: response.status,
        statusText: response.statusText || (response.status === 200 ? 'OK' : 'Response'),
        latencyMs,
        payloadSizeKb,
        headers: resHeaders,
        data: resData,
        timestamp: new Date().toISOString(),
        requestUrl: fullUrl,
        requestMethod: method,
        requestBody: parsedBody,
        requestHeaders: reqHeaders
      });

      if (onLogNewRequest) {
        onLogNewRequest();
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - startTime);
      const isAbort = err.name === 'AbortError' || err.message?.includes('aborted');
      setResult({
        status: isAbort ? 408 : 500,
        statusText: isAbort ? 'Request Timeout / Aborted' : 'Network Error',
        latencyMs,
        payloadSizeKb: 0,
        headers: {},
        data: {
          success: false,
          error: isAbort
            ? (lang === 'id' ? 'Request dibatalkan atau waktu tunggu server habis (timeout 60 detik). Silakan coba lagi.' : 'Request timed out (60s limit) or was canceled.')
            : (err.message || 'Gagal mengirim permintaan ke server.'),
          hint: isAbort
            ? (lang === 'id' ? 'Koneksi jaringan mungkin sedang lambat atau server sedang memproses beban tinggi.' : 'Network connection may be slow or server busy.')
            : 'Pastikan server REST API sedang berjalan normal.'
        },
        timestamp: new Date().toISOString(),
        requestUrl: fullUrl,
        requestMethod: method
      });
    } finally {
      clearTimeout(timeoutId);
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  // Generate Code Snippets
  const generateSnippet = (langType: string) => {
    const fullUrl = `${window.location.origin}${computeUrl()}`;
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(method) && requestBodyText.trim();
    const bodyObj = hasBody ? requestBodyText : '';

    switch (langType) {
      case 'curl':
        return `curl -X ${method} "${fullUrl}" \\
  -H "Content-Type: application/json"${activeApiKey ? ` \\\n  -H "x-api-key: ${activeApiKey}"` : ''}${hasBody ? ` \\\n  -d '${bodyObj.replace(/\n\s*/g, ' ')}'` : ''}`;

      case 'javascript':
        return `// Modern JavaScript (Fetch API)
const response = await fetch("${fullUrl}", {
  method: "${method}",
  headers: {
    "Content-Type": "application/json",${activeApiKey ? `\n    "x-api-key": "${activeApiKey}",` : ''}
  },${hasBody ? `\n  body: JSON.stringify(${requestBodyText})` : ''}
});

const data = await response.json();
console.log(data);`;

      case 'axios':
        return `// Node.js or Browser with Axios
import axios from 'axios';

const response = await axios({
  method: '${method.toLowerCase()}',
  url: '${fullUrl}',
  headers: {
    'Content-Type': 'application/json',${activeApiKey ? `\n    'x-api-key': '${activeApiKey}',` : ''}
  },${hasBody ? `\n  data: ${requestBodyText}` : ''}
});

console.log(response.data);`;

      case 'python':
        return `# Python 3 with requests
import requests
import json

url = "${fullUrl}"
headers = {
    "Content-Type": "application/json",${activeApiKey ? `\n    "x-api-key": "${activeApiKey}",` : ''}
}
${hasBody ? `payload = ${requestBodyText}\nresponse = requests.${method.toLowerCase()}(url, headers=headers, json=payload)` : `response = requests.${method.toLowerCase()}(url, headers=headers)`}

print(response.status_code)
print(response.json())`;

      case 'node':
        return `// Node.js Native HTTP / Fetch
const res = await fetch("${fullUrl}", {
  method: "${method}",
  headers: { "Content-Type": "application/json"${activeApiKey ? `, "x-api-key": "${activeApiKey}"` : ''} },${hasBody ? `\n  body: JSON.stringify(${requestBodyText})` : ''}
});
const result = await res.json();
console.log(result);`;

      case 'php':
        return `<?php
// PHP cURL snippet
$curl = curl_init();

curl_setopt_array($curl, array(
  CURLOPT_URL => '${fullUrl}',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CUSTOMREQUEST => '${method}',${hasBody ? `\n  CURLOPT_POSTFIELDS => '${bodyObj.replace(/'/g, "\\'")}',` : ''}
  CURLOPT_HTTPHEADER => array(
    'Content-Type: application/json'${activeApiKey ? `,\n    'x-api-key: ${activeApiKey}'` : ''}
  ),
));

$response = curl_exec($curl);
curl_close($curl);
echo $response;`;

      default:
        return '';
    }
  };

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(generateSnippet(activeSnippetLang));
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (status >= 300 && status < 400) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
    if (status >= 400 && status < 500) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  // MODE 1: Categories View
  if (explorerViewMode === 'categories') {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-800 dark:text-slate-100">
        {/* Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/20">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {lang === 'id' ? 'Katalog Kategori API' : 'API Category Catalog'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                {lang === 'id' ? 'Pilih salah satu kategori di bawah ini untuk melihat daftar endpoint API yang tersedia' : 'Select a category below to browse available API endpoints'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 px-3.5 py-1 text-xs font-extrabold text-indigo-600 dark:text-indigo-400 shadow-xs">
              ⚡ {BUILTIN_ENDPOINTS.length} Total Endpoint API
            </span>
          </div>
        </div>

        {/* Grid of Category Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {CATEGORIES.map((cat) => {
            const catEndpoints = cat.id === 'mock'
              ? (selectedMockRoute ? [selectedMockRoute] : [])
              : BUILTIN_ENDPOINTS.filter(e => e.category === cat.id);
            const Icon = getCategoryIcon(cat.id);

            return (
              <div
                key={cat.id}
                onClick={() => {
                  setSelectedCategoryFilter(cat.id);
                  setExplorerViewMode('category-endpoints');
                }}
                className="group cursor-pointer flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-5.5 shadow-xs transition-all duration-200 hover:border-indigo-500/60 hover:shadow-md hover:-translate-y-1"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3.5">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-transform group-hover:scale-105 ${
                      cat.id === 'ai' ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' :
                      cat.id === 'tools' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                      cat.id === 'data' ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400' :
                      cat.id === 'keys' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                      cat.id === 'system' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' :
                      'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                    }`}>
                      <Icon className="h-5.5 w-5.5" />
                    </div>
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 px-3 py-1 text-xs font-extrabold text-slate-700 dark:text-slate-300">
                      {cat.id === 'mock' ? `${catEndpoints.length} Route` : `${catEndpoints.length} Endpoint`}
                    </span>
                  </div>

                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {lang === 'id' ? cat.nameId : cat.nameEn}
                  </h2>
                  <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed min-h-[36px]">
                    {lang === 'id' ? cat.descriptionId : cat.descriptionEn}
                  </p>

                  {/* Preview Endpoint Badges */}
                  {catEndpoints.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {catEndpoints.slice(0, 4).map((ep: any) => (
                        <span
                          key={ep.id || ep.path}
                          className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300"
                        >
                          {ep.nameId || ep.name || ep.path}
                        </span>
                      ))}
                      {catEndpoints.length > 4 && (
                        <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-500">
                          +{catEndpoints.length - 4} lainnya
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-3.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  <span>{lang === 'id' ? 'Buka Kategori Ini' : 'Open Category'}</span>
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // MODE 2: Specific Category Endpoints View
  if (explorerViewMode === 'category-endpoints' && selectedCategoryFilter) {
    const currentCatObj = CATEGORIES.find(c => c.id === selectedCategoryFilter) || CATEGORIES[0];
    const rawCatEndpoints = BUILTIN_ENDPOINTS.filter(e => e.category === selectedCategoryFilter);
    const catEndpoints = rawCatEndpoints.filter(ep => {
      if (!categorySearchQuery) return true;
      const q = categorySearchQuery.toLowerCase();
      return ep.name.toLowerCase().includes(q) ||
        ep.nameId.toLowerCase().includes(q) ||
        ep.path.toLowerCase().includes(q) ||
        ep.summary.toLowerCase().includes(q) ||
        ep.tags.some(t => t.toLowerCase().includes(q));
    });
    const Icon = getCategoryIcon(selectedCategoryFilter);

    return (
      <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-800 dark:text-slate-100">
        {/* Back Button */}
        <div>
          <button
            type="button"
            onClick={() => setExplorerViewMode('categories')}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 shadow-xs transition"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>{lang === 'id' ? '← Kembali ke Semua Kategori' : '← Back to All Categories'}</span>
          </button>
        </div>

        {/* Category Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
              selectedCategoryFilter === 'ai' ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' :
              selectedCategoryFilter === 'tools' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
              selectedCategoryFilter === 'data' ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400' :
              selectedCategoryFilter === 'keys' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
              selectedCategoryFilter === 'system' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' :
              'bg-purple-500/15 text-purple-600 dark:text-purple-400'
            }`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                {lang === 'id' ? currentCatObj.nameId : currentCatObj.nameEn}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'id' ? currentCatObj.descriptionId : currentCatObj.descriptionEn}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={categorySearchQuery}
                onChange={(e) => setCategorySearchQuery(e.target.value)}
                placeholder={lang === 'id' ? 'Cari endpoint di kategori ini...' : 'Search endpoints in this category...'}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 py-1.5 pl-8 pr-3 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>
            <span className="rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300">
              {catEndpoints.length} Endpoint
            </span>
          </div>
        </div>

        {/* Grid of Endpoints */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {catEndpoints.map((ep) => {
            const reqTier = endpointTiers?.[ep.path] || 'Free';
            return (
              <div
                key={ep.id}
                onClick={() => {
                  onSelectEndpoint?.(ep);
                  setExplorerViewMode('playground');
                }}
                className="group cursor-pointer flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-5 shadow-xs transition-all duration-200 hover:border-indigo-500/60 hover:shadow-md hover:-translate-y-0.5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] font-extrabold tracking-wider ${
                      ep.method === 'GET' ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                      ep.method === 'POST' ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' :
                      ep.method === 'PUT' ? 'border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                      'border-rose-500/40 bg-rose-500/15 text-rose-600 dark:text-rose-400'
                    }`}>
                      {ep.method}
                    </span>

                    {reqTier !== 'Free' && (
                      <span className="rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-extrabold uppercase">
                        🔑 Min Tier: {reqTier}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {lang === 'id' ? ep.nameId : ep.name}
                  </h3>
                  <p className="mt-1 font-mono text-xs text-cyan-600 dark:text-cyan-400 font-semibold truncate">
                    {ep.path}
                  </p>
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                    {lang === 'id' ? ep.summaryId : ep.summary}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {ep.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-0.5 text-[10px] font-medium text-slate-500"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-3">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline flex items-center gap-1">
                    ⚡ {lang === 'id' ? 'Tes Endpoint Ini' : 'Test Endpoint'}
                  </span>
                  <ChevronRight className="h-4 w-4 text-indigo-500 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // MODE 3: Playground View Mode
  const currentCatObj = CATEGORIES.find(c => c.id === endpoint.category);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-800 dark:text-slate-100">
      
      {/* Top Header Bar with Navigation Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-3.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExplorerViewMode('category-endpoints')}
            className="flex items-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50 dark:bg-indigo-950/60 px-3.5 py-1.5 text-xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 shadow-xs transition"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>
              {lang === 'id'
                ? `← Kembali ke Endpoint ${currentCatObj ? currentCatObj.nameId : ''}`
                : `← Back to ${currentCatObj ? currentCatObj.nameEn : 'Category'} Endpoints`}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setExplorerViewMode('categories')}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <Layers className="h-3.5 w-3.5 text-indigo-500" />
            <span>{lang === 'id' ? 'Pilih Kategori Lain' : 'Select Other Category'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 font-mono text-xs">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
            endpoint.method === 'GET' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
          }`}>
            {endpoint.method}
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {endpoint.path}
          </span>
        </div>
      </div>

      {/* Mobile Back Button */}
      {onBackToList && (
        <div className="flex items-center justify-between lg:hidden -mb-2">
          <button
            type="button"
            onClick={onBackToList}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white"
          >
            <ChevronLeft className="h-4 w-4 text-indigo-500" />
            <span>{lang === 'id' ? 'Kembali ke Daftar' : 'Back to List'}</span>
          </button>
        </div>
      )}

      {/* Category Selection Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {lang === 'id' ? 'Kategori API' : 'API Category'}
            </span>
          </div>
          <span className="text-[11px] font-medium text-slate-500">
            {lang === 'id' ? 'Pilih kategori untuk memfilter endpoint' : 'Select category to filter endpoints'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => {
            const isCurrentCat = endpoint.category === cat.id && !selectedMockRoute;
            const catEndpoints = cat.id === 'mock'
              ? []
              : BUILTIN_ENDPOINTS.filter(e => e.category === cat.id);
            const Icon = getCategoryIcon(cat.id);

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  if (catEndpoints.length > 0 && onSelectEndpoint) {
                    onSelectEndpoint(catEndpoints[0]);
                  }
                }}
                className={`shrink-0 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                  isCurrentCat
                    ? 'border-indigo-500/60 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-900 dark:text-white shadow-xs ring-1 ring-indigo-500/30'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${
                  cat.id === 'ai' ? 'text-indigo-500' :
                  cat.id === 'tools' ? 'text-emerald-500' :
                  cat.id === 'data' ? 'text-cyan-500' :
                  cat.id === 'keys' ? 'text-amber-500' :
                  cat.id === 'system' ? 'text-rose-500' : 'text-purple-500'
                }`} />
                <span>{lang === 'id' ? cat.nameId : cat.nameEn}</span>
                {cat.id !== 'mock' && (
                  <span className="rounded-full bg-slate-200 dark:bg-slate-800 px-1.5 py-0.2 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                    {catEndpoints.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. Endpoint Header Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4 sm:p-5 backdrop-blur shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-lg border px-2.5 py-1 font-mono text-xs font-extrabold tracking-wider ${
                method === 'GET'
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : method === 'POST'
                  ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                  : method === 'PUT'
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'border-rose-500/40 bg-rose-500/15 text-rose-600 dark:text-rose-400'
              }`}
            >
              {method}
            </span>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              {lang === 'id' ? endpoint.nameId : endpoint.name}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {endpoint.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-400"
              >
                <Tag className="h-2.5 w-2.5 text-indigo-500" />
                {tag}
              </span>
            ))}
            {(() => {
              const reqTier = endpointTiers?.[endpoint.path] || 'Free';
              if (reqTier === 'Free') return null;
              return (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider ${
                    reqTier === 'Pro'
                      ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/35'
                      : reqTier === 'Developer'
                      ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/35'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/35'
                  }`}
                >
                  🔑 {lang === 'id' ? 'Tier Minimal' : 'Min Tier'}: {reqTier}
                </span>
              );
            })()}
          </div>
        </div>

        <p className="mt-2 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
          {lang === 'id' ? endpoint.descriptionId : endpoint.description}
        </p>

        {/* Live URL & Execute Bar */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90 px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus-within:border-indigo-500/60 focus-within:ring-1 focus-within:ring-indigo-500/30">
              <span className="text-slate-400 dark:text-slate-500 select-none hidden sm:inline">
                {window.location.origin}
              </span>
              <span className="font-semibold text-cyan-600 dark:text-cyan-400 break-all pl-1">
                {computeUrl()}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              if (!activeApiKey) {
                handleQuickGenerateKey();
                return;
              }
              handleExecute();
            }}
            disabled={isLoading || isGeneratingKey}
            className={`flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-md transition active:scale-[0.98] disabled:opacity-50 ${
              !activeApiKey
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-amber-500/20'
                : 'bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 shadow-indigo-500/20'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>{lang === 'id' ? 'Mengirim...' : 'Sending...'}</span>
              </>
            ) : !activeApiKey ? (
              <>
                <Sparkles className="h-4 w-4 text-white" />
                <span>{isGeneratingKey ? 'Membuat Key...' : (lang === 'id' ? '⚡ Generate Key Dulu' : '⚡ Generate Key First')}</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4 text-white" />
                <span>{lang === 'id' ? 'Jalankan Request' : 'Send Request'}</span>
              </>
            )}
          </button>
        </div>

        {/* Mandatory API Key Requirement Warning Banner */}
        {!activeApiKey && (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <p className="font-bold text-amber-200">
                  {lang === 'id' ? 'Kunci API Wajib Di-generate Terlebih Dahulu' : 'Personal API Key Required'}
                </p>
                <p className="text-[11px] text-amber-300/80">
                  {lang === 'id'
                    ? 'Sebelum mengirim request ke endpoint ini, Anda wajib men-generate kunci API pribadi sesuai tier akun Anda. Tidak diizinkan memakai API Key role atau tier lain.'
                    : 'Before sending requests, you must generate a personal API key matching your account tier.'}
                </p>
              </div>
            </div>
            <button
              onClick={handleQuickGenerateKey}
              disabled={isGeneratingKey}
              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-3.5 py-1.5 font-bold text-white shadow hover:from-amber-600 transition text-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isGeneratingKey ? 'Membuat...' : (lang === 'id' ? '⚡ Generate Key Sekarang' : '⚡ Generate Key Now')}</span>
            </button>
          </div>
        )}

        {/* Active Key & Realtime Quota Status Bar */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <Key className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
            <span className="text-slate-600 dark:text-slate-400">{lang === 'id' ? 'API Key Anda:' : 'Your API Key:'}</span>
            {activeKeyObj ? (
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white font-mono">{activeKeyObj.name}</span>
                <span className="rounded bg-indigo-500/10 dark:bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-300 border border-indigo-500/30">
                  {activeKeyObj.tier}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  {activeKeyObj.rateLimit === -1 ? '⚡ Unlimited Rate' : `⚡ ${activeKeyObj.rateLimit} req/min`}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-amber-600 dark:text-amber-400 italic text-[11px] font-medium">
                  {lang === 'id' ? '⚠️ Belum ada API Key' : '⚠️ No API Key active'}
                </span>
                <button
                  type="button"
                  onClick={handleQuickGenerateKey}
                  disabled={isGeneratingKey}
                  className="rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold hover:bg-amber-500/30 transition flex items-center gap-1"
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  <span>{lang === 'id' ? 'Generate 1-Click' : '1-Click Generate'}</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {activeKeyObj && (
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">{lang === 'id' ? 'Pemakaian:' : 'Usage:'}</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                  {activeKeyObj.requestCount.toLocaleString()} / {activeKeyObj.totalLimit === -1 ? '∞' : activeKeyObj.totalLimit.toLocaleString()} req
                </span>
              </div>
            )}
            
            <select
              value={activeApiKey}
              onChange={(e) => setActiveApiKey(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
            >
              {apiKeys.length === 0 ? (
                <option value="">{lang === 'id' ? '-- Belum ada API Key (Wajib Generate) --' : '-- No API Key (Generation Required) --'}</option>
              ) : (
                apiKeys.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.name} ({k.requestCount} / {k.totalLimit === -1 ? '∞' : k.totalLimit} req)
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {/* 2. Request Configuration Tabs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Request Builder (7 cols) */}
        <div className="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/30 p-4 lg:col-span-7 space-y-4">
          
          {/* Tab Navigation */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveReqTab('params')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  activeReqTab === 'params'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {lang === 'id' ? 'Parameter' : 'Parameters'}
                {(endpoint.queryParams?.length || 0) > 0 && (
                  <span className="ml-1.5 rounded-full bg-white/20 dark:bg-slate-700 px-1.5 py-0.2 text-[10px] text-white">
                    {endpoint.queryParams?.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveReqTab('headers')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  activeReqTab === 'headers'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Headers & Auth
              </button>

              {['POST', 'PUT', 'PATCH'].includes(method) && (
                <button
                  onClick={() => setActiveReqTab('body')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    activeReqTab === 'body'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Request Body (JSON)
                </button>
              )}
            </div>

            {activeReqTab === 'body' && (
              <button
                onClick={handleFormatJson}
                className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Format & Prettify JSON"
              >
                <Sparkles className="h-3 w-3" />
                <span>Format JSON</span>
              </button>
            )}
          </div>

          {/* Tab 1: Query & Path Params */}
          {activeReqTab === 'params' && (
            <div className="space-y-4">
              {/* Path Parameters if present */}
              {Object.keys(pathParams).length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                    Path Variables (:id, :param)
                  </span>
                  <div className="space-y-2">
                    {Object.entries(pathParams).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="w-24 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono text-xs text-amber-700 dark:text-amber-300">
                          :{k}
                        </span>
                        <input
                          type="text"
                          value={v}
                          onChange={(e) =>
                            setPathParams({ ...pathParams, [k]: e.target.value })
                          }
                          className="flex-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Query Parameters */}
              {endpoint.queryParams && endpoint.queryParams.length > 0 && (
                <div className="space-y-3">
                  <span className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                    Built-in Query Parameters (?key=value)
                  </span>
                  <div className="space-y-2.5">
                    {endpoint.queryParams.filter((p: any) => !p.showWhen || (queryParams[p.showWhen.param] !== undefined && (Array.isArray(p.showWhen.equals) ? p.showWhen.equals : [p.showWhen.equals]).includes(queryParams[p.showWhen.param]))).map((param) => {
                      const val = queryParams[param.name] ?? '';
                      return (
                        <div
                          key={param.name}
                          className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60 p-3 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-cyan-700 dark:text-cyan-400">
                                {param.name}
                              </span>
                              <span className="rounded bg-slate-200 dark:bg-slate-900 px-1.5 py-0.2 text-[10px] text-slate-600 dark:text-slate-500 uppercase">
                                {param.type}
                              </span>
                              {param.required && (
                                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                  required
                                </span>
                              )}
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            {lang === 'id' ? param.descriptionId || param.description : param.description}
                          </p>

                          {param.type === 'enum' && param.options ? (
                            <select
                              value={val}
                              onChange={(e) =>
                                setQueryParams({ ...queryParams, [param.name]: e.target.value })
                              }
                              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                            >
                              {param.options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt === '' ? '(empty / all)' : opt}
                                </option>
                              ))}
                            </select>
                          ) : param.type === 'boolean' ? (
                            <select
                              value={String(val)}
                              onChange={(e) =>
                                setQueryParams({ ...queryParams, [param.name]: e.target.value === 'true' })
                              }
                              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                            >
                              <option value="true">true</option>
                              <option value="false">false</option>
                            </select>
                          ) : (
                            <input
                              type={param.type === 'number' ? 'number' : 'text'}
                              value={val}
                              placeholder={`Contoh: ${param.defaultValue ?? ''}`}
                              onChange={(e) =>
                                setQueryParams({ ...queryParams, [param.name]: e.target.value })
                              }
                              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dynamic Custom Query Parameters Section */}
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold tracking-wider text-cyan-700 dark:text-cyan-400 uppercase flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      {lang === 'id' ? 'Parameter & Filter Kustom URL' : 'Custom URL Parameters'}
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {lang === 'id'
                        ? 'Tambahkan parameter pencarian seperti ?q=pinterest+aesthetic, ?limit=10, ?category=fashion'
                        : 'Add URL query parameters like ?q=pinterest+aesthetic, ?limit=10'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCustomParamsList((prev) => [
                        ...prev,
                        { id: `p_${Date.now()}`, key: 'limit', value: '10', description: 'Jumlah data' }
                      ])
                    }
                    className="flex items-center gap-1 rounded-lg border border-cyan-300 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-950/30 px-2.5 py-1 text-xs font-semibold text-cyan-800 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{lang === 'id' ? 'Tambah Param' : 'Add Param'}</span>
                  </button>
                </div>

                {/* Preset Chips */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="text-slate-500 font-medium">{lang === 'id' ? 'Preset Cepat:' : 'Quick Presets:'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!customParamsList.some(p => p.key === 'q')) {
                        setCustomParamsList(prev => [...prev, { id: `p_${Date.now()}`, key: 'q', value: 'aesthetic wallpaper', description: 'Kata kunci pencarian' }]);
                      }
                    }}
                    className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 text-cyan-700 dark:text-cyan-400 hover:border-cyan-400 dark:hover:border-cyan-500/50"
                  >
                    + q (Kata Kunci)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!customParamsList.some(p => p.key === 'limit')) {
                        setCustomParamsList(prev => [...prev, { id: `p_${Date.now()}`, key: 'limit', value: '10', description: 'Jumlah hasil' }]);
                      }
                    }}
                    className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 text-cyan-700 dark:text-cyan-400 hover:border-cyan-400 dark:hover:border-cyan-500/50"
                  >
                    + limit (Jumlah)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!customParamsList.some(p => p.key === 'page')) {
                        setCustomParamsList(prev => [...prev, { id: `p_${Date.now()}`, key: 'page', value: '1', description: 'Halaman ke' }]);
                      }
                    }}
                    className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 text-cyan-700 dark:text-cyan-400 hover:border-cyan-400 dark:hover:border-cyan-500/50"
                  >
                    + page (Halaman)
                  </button>
                </div>

                {/* Parameter Inputs List */}
                {customParamsList.length > 0 ? (
                  <div className="space-y-2">
                    {customParamsList.map((cp) => (
                      <div
                        key={cp.id}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 p-2"
                      >
                        <input
                          type="text"
                          value={cp.key}
                          onChange={(e) => {
                            const newKey = e.target.value;
                            setCustomParamsList((prev) =>
                              prev.map((item) => (item.id === cp.id ? { ...item, key: newKey } : item))
                            );
                          }}
                          placeholder="Nama Param (Contoh: q, limit)"
                          className="w-1/3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1 text-xs font-mono font-bold text-cyan-700 dark:text-cyan-400 outline-none focus:border-cyan-500"
                        />
                        <span className="text-slate-400 font-mono text-xs">=</span>
                        <input
                          type="text"
                          value={cp.value}
                          onChange={(e) => {
                            const newVal = e.target.value;
                            setCustomParamsList((prev) =>
                              prev.map((item) => (item.id === cp.id ? { ...item, value: newVal } : item))
                            );
                          }}
                          placeholder="Nilai Parameter (Contoh: anime aesthetic)"
                          className="flex-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-cyan-500"
                        />
                        <button
                          type="button"
                          onClick={() => setCustomParamsList((prev) => prev.filter((item) => item.id !== cp.id))}
                          className="p-1 text-slate-400 hover:text-rose-500"
                          title="Hapus Parameter"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-800 p-3 text-center text-xs text-slate-500">
                    {lang === 'id'
                      ? 'Belum ada parameter kustom. Klik tombol "+ Tambah Param" di atas.'
                      : 'No custom parameters added yet.'}
                  </div>
                )}

                {/* Save to Mock Route Banner (If testing a Custom Mock Endpoint) */}
                {(selectedMockRoute || endpoint.id.startsWith('mock-')) && onUpdateMockRoute && (
                  <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/30 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wand2 className="h-4 w-4 text-indigo-400" />
                        <span className="text-xs font-bold text-indigo-300">
                          {lang === 'id' ? 'Simpan Parameter ke Custom Mock Endpoint' : 'Sync Parameters to Mock Route'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const mockId = selectedMockRoute?.id || endpoint.id.replace('mock-', '');
                          if (!mockId) return;
                          setIsSavingMock(true);
                          setSaveMockSuccess(false);

                          const formattedParams = customParamsList
                            .filter((p) => p.key.trim() !== '')
                            .map((p) => ({
                              name: p.key.trim(),
                              type: 'string' as const,
                              required: false,
                              defaultValue: p.value,
                              description: p.description || 'Parameter kustom'
                            }));

                          await onUpdateMockRoute(mockId, {
                            queryParams: formattedParams
                          });
                          setIsSavingMock(false);
                          setSaveMockSuccess(true);
                          setTimeout(() => setSaveMockSuccess(false), 3000);
                        }}
                        disabled={isSavingMock}
                        className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-bold text-white shadow hover:bg-indigo-500 disabled:opacity-50"
                      >
                        {isSavingMock ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : saveMockSuccess ? (
                          <Check className="h-3.5 w-3.5 text-emerald-300" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {saveMockSuccess
                            ? (lang === 'id' ? 'Tersimpan!' : 'Saved!')
                            : (lang === 'id' ? 'Simpan ke Mock Route' : 'Save to Mock Route')}
                        </span>
                      </button>
                    </div>
                    <p className="text-[11px] text-indigo-200/80 leading-relaxed">
                      {lang === 'id'
                        ? 'Klik tombol di atas untuk menyimpan spesifikasi parameter ini ke Mock Route secara permanen di server, sehingga siap digunakan oleh cURL / Postman.'
                        : 'Save these query parameter specifications to the server mock route permanently.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Headers & Auth */}
          {activeReqTab === 'headers' && (
            <div className="space-y-4">
              {/* API Key Selector */}
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-950/20 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-300">
                    <Key className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span>{lang === 'id' ? 'Gunakan API Key Kustom' : 'Use Custom API Key'}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Header: x-api-key</span>
                </div>
                
                <select
                  value={activeApiKey}
                  onChange={(e) => setActiveApiKey(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="">{lang === 'id' ? '-- Tanpa API Key (Mode Publik) --' : '-- No API Key (Public Mode) --'}</option>
                  {apiKeys.map((k) => (
                    <option key={k.key} value={k.key}>
                      {k.name} ({k.tier} Tier - {k.rateLimit} req/min) - {k.key.substring(0, 18)}... [{k.requestCount} req used]
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  {lang === 'id'
                    ? 'Pilih API Key untuk menguji otentikasi dan batas kuota rate limit server.'
                    : 'Select an API Key to test authentication and server quota limits.'}
                </p>
              </div>

              {/* Standard Headers Table */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                  HTTP Request Headers
                </span>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-32 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono text-xs text-slate-700 dark:text-slate-300">
                      Content-Type
                    </span>
                    <input
                      type="text"
                      value={headers['Content-Type']}
                      onChange={(e) => setHeaders({ ...headers, 'Content-Type': e.target.value })}
                      className="flex-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-1 text-xs text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-32 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono text-xs text-slate-700 dark:text-slate-300">
                      Accept
                    </span>
                    <input
                      type="text"
                      value={headers['Accept']}
                      onChange={(e) => setHeaders({ ...headers, Accept: e.target.value })}
                      className="flex-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-1 text-xs text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Request Body Editor */}
          {activeReqTab === 'body' && (
            <div className="space-y-2">
              <div className="relative">
                <textarea
                  value={requestBodyText}
                  onChange={(e) => {
                    setRequestBodyText(e.target.value);
                    setBodyError(null);
                  }}
                  rows={9}
                  placeholder="{\n  // Enter JSON request body...\n}"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 p-3.5 font-mono text-xs text-slate-800 dark:text-slate-200 leading-relaxed outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/30"
                />
              </div>

              {bodyError && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-700 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{bodyError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Live Response Panel (5 cols) */}
        <div className="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/30 p-4 lg:col-span-5 space-y-4">
          
          {/* Response status header */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {lang === 'id' ? 'Hasil Respons Server' : 'Server Response'}
              </span>
              {result && (
                <span
                  className={`rounded-full border px-2 py-0.5 font-mono text-[11px] font-bold ${getStatusColor(
                    result.status
                  )}`}
                >
                  {result.status} {result.statusText}
                </span>
              )}
            </div>

            {result && (
              <div className="flex items-center gap-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  {result.latencyMs}ms
                </span>
                <span className="flex items-center gap-1">
                  <HardDrive className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
                  {result.payloadSizeKb} KB
                </span>
              </div>
            )}
          </div>

          {/* Response Content View */}
          {isLoading ? (
            <div className="flex h-72 flex-col items-center justify-center space-y-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
              <p className="text-xs font-medium">
                {lang === 'id' ? 'Mengirim request ke live backend...' : 'Sending request to live backend...'}
              </p>
              <button
                type="button"
                onClick={handleCancelRequest}
                className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-[11px] font-semibold text-rose-400 hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-300 transition"
              >
                {lang === 'id' ? 'Batalkan Request' : 'Cancel Request'}
              </button>
            </div>
          ) : result ? (
            <div className="space-y-3">
              {/* Maintenance Mode Visual Lockdown Alert */}
              {(result.status === 503 || result.data?.code === 'MAINTENANCE_MODE_ACTIVE') && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-400 text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                    <span>{lang === 'id' ? 'Platform Sedang Dalam Mode Pemeliharaan (503)' : 'Platform in Maintenance Mode (503)'}</span>
                  </div>
                  <p className="text-xs text-amber-200/90 leading-relaxed">
                    {lang === 'id'
                      ? 'Layanan API publik dan tier Developer (Free & Pro) sedang dinonaktifkan sementara oleh Administrator demi peningkatan sistem. Hanya role Admin yang dapat melewati penguncian ini.'
                      : 'Public and developer tier (Free & Pro) endpoints are temporarily locked by Administrator for system maintenance. Only Admin roles can bypass this lockdown.'}
                  </p>
                  <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-amber-300/80">
                    <span className="rounded bg-amber-950/60 px-2 py-0.5 border border-amber-500/30">
                      HTTP 503 Service Unavailable
                    </span>
                    <span>• Status Code Active</span>
                  </div>
                </div>
              )}

              {/* QR Image visualizer preview if QR DataURL present */}
              {result.data?.qrDataUrl && (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-center space-y-2">
                  <p className="text-xs font-semibold text-slate-300">
                    {lang === 'id' ? 'Pratinjau Hasil QR Code:' : 'Live QR Code Preview:'}
                  </p>
                  <img
                    src={result.data.qrDataUrl}
                    alt="Generated QR"
                    className="mx-auto h-40 w-40 rounded-lg border border-slate-700 bg-white p-2 shadow-lg"
                  />
                  <a
                    href={result.data.qrDataUrl}
                    download="qrcode.png"
                    className="inline-flex items-center gap-1 rounded bg-indigo-600 px-3 py-1 text-xs font-bold text-white hover:bg-indigo-700"
                  >
                    Download PNG
                  </a>
                </div>
              )}

              <JsonViewer data={result.data} maxHeight="360px" />
            </div>
          ) : (
            <div className="flex h-72 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/40 p-6 text-center space-y-3 text-slate-600 dark:text-slate-500">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                <Play className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-300">
                  {lang === 'id' ? 'Siap Dijalankan' : 'Ready to Execute'}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-500 mt-1 max-w-xs">
                  {lang === 'id'
                    ? 'Klik tombol "Jalankan Request" di atas untuk mengirim permintaan ke server live Express.'
                    : 'Click the "Send Request" button above to send a real HTTP call to the Express backend.'}
                </p>
              </div>
              <button
                onClick={handleExecute}
                className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-300 hover:border-indigo-400 dark:hover:border-slate-700 hover:text-indigo-600 dark:hover:text-white"
              >
                {lang === 'id' ? 'Kirim Sekarang' : 'Send Now'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Multi-Language Code Snippet Generator */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4 sm:p-5 backdrop-blur space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              {lang === 'id' ? 'Snippet Kode Klien (Siap Pakai)' : 'Client Code Snippets'}
            </h3>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto">
            {(['curl', 'javascript', 'axios', 'python', 'node', 'php'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setActiveSnippetLang(l)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold uppercase transition ${
                  activeSnippetLang === l
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {l === 'javascript' ? 'Fetch JS' : l}
              </button>
            ))}

            <button
              onClick={handleCopySnippet}
              className="ml-2 flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              {copiedSnippet ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 text-slate-700 dark:text-slate-300" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>
        </div>

        <pre className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 font-mono text-xs text-slate-900 dark:text-indigo-200 leading-relaxed font-semibold">
          {generateSnippet(activeSnippetLang)}
        </pre>
      </div>

    </div>
  );
};
