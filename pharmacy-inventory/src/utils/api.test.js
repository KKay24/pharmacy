import { apiHealthPath, apiUrl, resolveApiBaseUrl } from './api';

const { shouldForwardResponseHeader, targetPathFromRequest } = require('../../api');

describe('same-origin health proxy routing', () => {
  test('uses the direct health route only for local development', () => {
    expect(apiHealthPath('https://pharmacy-backend.example')).toBe('/health');
    expect(apiHealthPath('https://pharmacy-backend.example', false)).toBe('/api/health');
  });

  test('uses the same-origin API proxy when no backend base URL is configured', () => {
    expect(apiHealthPath('')).toBe('/api/health');
    expect(apiUrl('/api/health')).toBe('/api/health');
  });

  test('uses direct API URLs only for local browser development', () => {
    expect(resolveApiBaseUrl('https://pharmacy-backend.example', 'localhost'))
      .toBe('https://pharmacy-backend.example');
    expect(resolveApiBaseUrl('https://pharmacy-backend.example', 'www.mediquick.online')).toBe('');
    expect(resolveApiBaseUrl('', '127.0.0.1')).toBe('http://localhost:5001');
  });

  test('maps proxied health checks to backend health while preserving API paths', () => {
    expect(targetPathFromRequest({ url: '/?path=health', query: { path: 'health' } })).toBe('/health');
    expect(targetPathFromRequest({ url: '/?path=health/database', query: { path: 'health/database' } }))
      .toBe('/health/database');
    expect(targetPathFromRequest({ url: '/?path=products/categories', query: { path: 'products/categories' } }))
      .toBe('/api/products/categories');
  });

  test('does not forward content-encoding for decoded proxy response bodies', () => {
    expect(shouldForwardResponseHeader('content-encoding')).toBe(false);
    expect(shouldForwardResponseHeader('Content-Type')).toBe(true);
  });
});
