import { apiHealthPath } from './api';

const { targetPathFromRequest } = require('../../api');

describe('same-origin health proxy routing', () => {
  test('uses the direct health route when a backend base URL is configured', () => {
    expect(apiHealthPath('https://pharmacy-backend.example')).toBe('/health');
  });

  test('uses the same-origin API proxy when no backend base URL is configured', () => {
    expect(apiHealthPath('')).toBe('/api/health');
  });

  test('maps proxied health checks to backend health while preserving API paths', () => {
    expect(targetPathFromRequest({ url: '/?path=health', query: { path: 'health' } })).toBe('/health');
    expect(targetPathFromRequest({ url: '/?path=health/database', query: { path: 'health/database' } }))
      .toBe('/health/database');
    expect(targetPathFromRequest({ url: '/?path=products/categories', query: { path: 'products/categories' } }))
      .toBe('/api/products/categories');
  });
});
