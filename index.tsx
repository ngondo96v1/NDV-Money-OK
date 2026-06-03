import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Global API routing handler for Capacitor / Android Native environment
const getResolvedApiHost = (): string => {
  // Check if custom environment variable is defined
  const envApiUrl = (import.meta.env && import.meta.env.VITE_API_URL) || (import.meta.env && import.meta.env.VITE_APP_URL);
  if (envApiUrl) return envApiUrl;

  // Default fallback to the registered live domain of your system
  return "https://ndv-money-ok.vercel.app";
};

const isNativeOrLocalWebview = (): boolean => {
  if (typeof window === 'undefined') return false;

  // Capacitor Check
  const isCap = !!(window as any).Capacitor;
  const isCapNative = isCap && (window as any).Capacitor.isNativePlatform?.();

  // Special URL schemes when running inside the local Android webview (capacitor://, file://, or standalone localhost)
  const isSpecialScheme =
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'file:' ||
    ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '3000');

  return !!(isCapNative || isSpecialScheme);
};

if (isNativeOrLocalWebview()) {
  const apiHost = getResolvedApiHost().replace(/\/$/, ""); // Trim trailing slash
  console.log(`[API ENHANCEMENT] Running in Native/WebView mode. Prepending API Host: ${apiHost}`);

  const originalFetch = window.fetch;
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    let url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);

    // If starting with relative slash /api, resolve to absolute API host
    if (url.startsWith('/api')) {
      url = `${apiHost}${url}`;
    } else if (url.startsWith('api') || url.startsWith('./api')) {
      const cleanPath = url.startsWith('.') ? url.slice(1) : '/' + url;
      url = `${apiHost}${cleanPath}`;
    }

    if (typeof input === 'string') {
      return originalFetch(url, init);
    } else if (input instanceof URL) {
      return originalFetch(new URL(url), init);
    } else {
      const newRequest = new Request(url, input);
      return originalFetch(newRequest, init);
    }
  };
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);