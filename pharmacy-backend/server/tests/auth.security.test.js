const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const tempDirectory = mkdtempSync(join(tmpdir(), 'mediquick-auth-sec-test-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.POSTGRES_URL = '';
process.env.SQLITE_STORAGE_PATH = join(tempDirectory, 'auth-security.sqlite');
process.env.ENABLE_DEMO_SEEDING = 'false';
process.env.JWT_SECRET = 'test-auth-security-secret-1234567890';

const test = require('node:test');
const assert = require('node:assert/strict');
const { UnauthorizedException, ForbiddenException } = require('@nestjs/common');

const { sequelize, User, AuthAuditLog } = require('../models');
const { runMigrations } = require('../lib/migrations');
const { hashPassword } = require('../lib/auth/passwords');
const AuthController = require('../src/auth/auth.controller');
const AuthService = require('../src/auth/auth.service');
const AuthSecurityService = require('../src/security/auth-security.service');
const IpGeolocationService = require('../src/security/ip-geolocation.service');
const SecurityController = require('../src/security/security.controller');
const { RolesGuard } = require('../src/auth/roles.guard');
const PermissionsGuard = require('../src/auth/permissions.guard');
const {
  extractClientIp,
  isPublicIp,
  normalizeIp,
  parseUserAgent,
  sanitizeLogValue,
} = require('../src/security/request-context');

function makeRequest({
  ip = '',
  remoteAddress = '127.0.0.1',
  xff = '',
  userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  trustProxy = 1,
  extraHeaders = {},
} = {}) {
  const headers = {
    'user-agent': userAgent,
    ...extraHeaders,
  };
  if (xff) {
    headers['x-forwarded-for'] = xff;
  }
  return {
    headers,
    ip,
    socket: { remoteAddress },
    app: {
      get(key) {
        if (key === 'trust proxy') return trustProxy;
        return undefined;
      },
    },
  };
}

let activeUser;
let suspendedUser;

test.before(async () => {
  await sequelize.authenticate();
  await runMigrations();

  activeUser = await User.create({
    username: 'pharmacist.admin@mediquick.test',
    email: 'pharmacist.admin@mediquick.test',
    password: hashPassword('StrongPassword!2026'),
    role: 'admin',
    status: 'active',
    locations: ['Main'],
  });

  suspendedUser = await User.create({
    username: 'suspended.staff@mediquick.test',
    email: 'suspended.staff@mediquick.test',
    password: hashPassword('StrongPassword!2026'),
    role: 'user',
    status: 'suspended',
    locations: ['Main'],
  });
});

test.after(async () => {
  await sequelize.close();
  rmSync(tempDirectory, { recursive: true, force: true });
});

test('1. Proxy header safety, IPv4/IPv6 normalization, and log injection sanitization', () => {
  // Direct request with trustProxy = 0 MUST ignore spoofed X-Forwarded-For
  const reqUntrusted = makeRequest({
    remoteAddress: '::ffff:198.51.100.20',
    xff: '1.2.3.4',
    trustProxy: 0,
  });
  assert.equal(extractClientIp(reqUntrusted), '198.51.100.20');

  // Single reverse proxy (Render, hops = 1): ignore client-spoofed left entry, take rightmost
  const reqRenderSpoofed = makeRequest({
    remoteAddress: '10.0.0.15',
    xff: '1.2.3.4, 203.0.113.55',
    trustProxy: 1,
  });
  assert.equal(extractClientIp(reqRenderSpoofed), '203.0.113.55');

  // Two reverse proxies (Vercel -> Render, hops = 2): take 2nd from right
  const reqTwoHops = makeRequest({
    remoteAddress: '10.0.0.15',
    xff: '9.9.9.9, 198.51.100.88, 76.76.21.5',
    trustProxy: 2,
  });
  assert.equal(extractClientIp(reqTwoHops), '198.51.100.88');

  // Verified shared proxy secret header (Vercel -> Render)
  const reqVerifiedProxy = makeRequest({
    remoteAddress: '10.0.0.15',
    xff: '76.76.21.5',
    trustProxy: 1,
    extraHeaders: {
      'x-mediquick-proxy-secret': 'super-secret-token',
      'x-mediquick-client-ip': '41.72.110.24',
    },
  });
  assert.equal(
    extractClientIp(reqVerifiedProxy, { proxySharedSecret: 'super-secret-token' }),
    '41.72.110.24'
  );
  // Wrong secret falls back to trusted Render hop
  assert.equal(
    extractClientIp(reqVerifiedProxy, { proxySharedSecret: 'different-secret' }),
    '76.76.21.5'
  );

  // IPv4 and IPv6 normalization
  assert.equal(normalizeIp('::ffff:41.72.110.24'), '41.72.110.24');
  assert.equal(normalizeIp('41.72.110.24:54321'), '41.72.110.24');
  assert.equal(normalizeIp('2001:4860:4860::8888'), '2001:4860:4860::8888');
  assert.equal(normalizeIp('[2001:4860:4860::8844]:443'), '2001:4860:4860::8844');
  assert.equal(normalizeIp('fe80::1%eth0'), 'fe80::1');
  assert.equal(normalizeIp('1.2.3.4\r\nFAKE'), null);

  assert.equal(isPublicIp('41.72.110.24'), true);
  assert.equal(isPublicIp('2001:4860:4860::8888'), true);
  assert.equal(isPublicIp('127.0.0.1'), false);
  assert.equal(isPublicIp('10.0.0.5'), false);
  assert.equal(isPublicIp('192.168.1.10'), false);
  assert.equal(isPublicIp('::1'), false);

  // Log injection sanitization
  assert.equal(sanitizeLogValue('user@test.com\r\n[AUTH] forged'), 'user@test.com [AUTH] forged');

  // User-Agent parsing
  const mobileUa = parseUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
  );
  assert.equal(mobileUa.browser, 'Safari');
  assert.equal(mobileUa.operatingSystem, 'iOS');
  assert.equal(mobileUa.deviceType, 'mobile');
});

test('2. Successful login, failed login, disabled account, and unknown email are recorded accurately with IPv4 and IPv6', async () => {
  await AuthAuditLog.destroy({ where: {} });
  const geo = new IpGeolocationService({
    env: { IP_GEO_ENABLED: 'true' },
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        success: true,
        country: 'Zambia',
        region: 'Lusaka Province',
        city: 'Lusaka',
        connection: { isp: 'Zamtel' },
      }),
    }),
  });
  const security = new AuthSecurityService(geo);
  const authService = new AuthService(security);

  // Successful IPv4 login
  const successReq = makeRequest({ xff: '41.72.110.24', trustProxy: 1 });
  const loginResult = await authService.login(activeUser.username, 'StrongPassword!2026', successReq);
  assert.equal(loginResult.success, true);
  await security.waitForPendingGeoUpdates();

  // Failed login (incorrect password) from IPv6
  const ipv6Req = makeRequest({
    xff: '2001:4860:4860::8888',
    trustProxy: 1,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  });
  await assert.rejects(
    () => authService.login(activeUser.username, 'WrongPassword123!', ipv6Req),
    UnauthorizedException
  );

  // Disabled account login attempt
  const disabledReq = makeRequest({ xff: '41.72.110.30', trustProxy: 1 });
  await assert.rejects(
    () => authService.login(suspendedUser.username, 'StrongPassword!2026', disabledReq),
    ForbiddenException
  );

  // Unknown email login attempt (matching incident pattern)
  const unknownReq = makeRequest({ xff: '41.72.110.99', trustProxy: 1 });
  await assert.rejects(
    () => authService.login('i.m.o.zoz.o.9.80@gmail.com', 'SomePassword123', unknownReq),
    UnauthorizedException
  );
  await security.waitForPendingGeoUpdates();

  const records = await AuthAuditLog.findAll({ order: [['id', 'ASC']] });
  assert.equal(records.length, 4);

  // Verify successful IPv4 record + geo enrichment + zero secrets stored
  assert.equal(records[0].status, 'SUCCESS');
  assert.equal(records[0].userId, activeUser.id);
  assert.equal(records[0].ipAddress, '41.72.110.24');
  assert.equal(records[0].failureReason, null);
  assert.equal(records[0].browser, 'Chrome');
  assert.equal(records[0].operatingSystem, 'macOS');
  assert.equal(records[0].deviceType, 'desktop');
  assert.equal(records[0].geoCountry, 'Zambia');
  assert.equal(records[0].geoCity, 'Lusaka');
  assert.equal(records[0].geoIsp, 'Zamtel');
  assert.equal(JSON.stringify(records[0].toJSON()).includes('StrongPassword!2026'), false);

  // Verify IPv6 incorrect password + unusual IP detection (since user previously succeeded from 41.72.110.24)
  assert.equal(records[1].status, 'FAILED');
  assert.equal(records[1].ipAddress, '2001:4860:4860::8888');
  assert.equal(records[1].failureReason, 'incorrect_password');
  assert.equal(records[1].operatingSystem, 'Android');
  assert.equal(records[1].deviceType, 'mobile');
  assert.equal(records[1].suspicious, true);
  assert.ok(records[1].suspiciousFlags.includes('unusual_ip_for_user'));

  // Verify disabled account
  assert.equal(records[2].status, 'FAILED');
  assert.equal(records[2].failureReason, 'disabled_account');
  assert.equal(records[2].userId, suspendedUser.id);

  // Verify unknown email
  assert.equal(records[3].status, 'FAILED');
  assert.equal(records[3].userId, null);
  assert.equal(records[3].attemptedEmail, 'i.m.o.zoz.o.9.80@gmail.com');
  assert.equal(records[3].ipAddress, '41.72.110.99');
  assert.equal(records[3].failureReason, 'unknown_user');
});

test('3. Repeated failed attempts trigger suspicious indicators, temporary 429 rate limiting, and recovery', async () => {
  await AuthAuditLog.destroy({ where: {} });
  const geo = new IpGeolocationService({ env: { IP_GEO_ENABLED: 'false' } });
  const security = new AuthSecurityService(geo, {
    env: {
      AUTH_RATE_LIMIT_WINDOW_MS: '60000',
      AUTH_LOCKOUT_DURATION_MS: '2000',
      AUTH_RATE_LIMIT_ACCOUNT_MAX_FAILURES: '3',
      AUTH_RATE_LIMIT_IP_MAX_FAILURES: '6',
      AUTH_SHORT_BURST_WINDOW_MS: '60000',
      AUTH_SHORT_BURST_MAX: '3',
      AUTH_MULTI_ACCOUNT_IP_THRESHOLD: '3',
    },
  });
  const authService = new AuthService(security);

  const req = makeRequest({ xff: '41.72.200.10', trustProxy: 1 });

  // 3 rapid failed attempts against the same unknown email (same pattern as the 14 Nov incident)
  for (let i = 0; i < 3; i += 1) {
    await assert.rejects(
      () => authService.login('i.m.o.zoz.o.9.80@gmail.com', `badpass-${i}`, req),
      UnauthorizedException
    );
  }

  // 4th attempt should trigger temporary HTTP 429 rate limit
  await assert.rejects(
    () => authService.login('i.m.o.zoz.o.9.80@gmail.com', 'badpass-3', req),
    (err) => err && typeof err.getStatus === 'function' && err.getStatus() === 429
  );

  const logs = await AuthAuditLog.findAll({ order: [['id', 'ASC']] });
  assert.equal(logs.length, 4);
  assert.ok(logs[2].suspiciousFlags.includes('repeated_ip_failures'));
  assert.ok(logs[2].suspiciousFlags.includes('account_failures'));
  assert.ok(logs[2].suspiciousFlags.includes('short_burst_attempts'));
  assert.equal(logs[3].failureReason, 'rate_limited');
  assert.ok(logs[3].suspiciousFlags.includes('rate_limited'));

  // Multi-account targeting from another IP
  const stuffingReq = makeRequest({ xff: '41.72.200.50', trustProxy: 1 });
  for (const target of ['a@test.com', 'b@test.com', 'c@test.com']) {
    await assert.rejects(
      () => authService.login(target, 'guess123', stuffingReq),
      UnauthorizedException
    );
  }
  const stuffingRecord = await AuthAuditLog.findOne({
    where: { ipAddress: '41.72.200.50', attemptedEmail: 'c@test.com' },
  });
  assert.equal(stuffingRecord.suspicious, true);
  assert.ok(stuffingRecord.suspiciousFlags.includes('credential_stuffing_multi_account'));

  // Success after failures detection
  const userReq = makeRequest({ xff: '41.72.200.77', trustProxy: 1 });
  await assert.rejects(() => authService.login(activeUser.username, 'wrong1', userReq), UnauthorizedException);
  await assert.rejects(() => authService.login(activeUser.username, 'wrong2', userReq), UnauthorizedException);
  const ok = await authService.login(activeUser.username, 'StrongPassword!2026', userReq);
  assert.equal(ok.success, true);

  const successRecord = await AuthAuditLog.findOne({
    where: { ipAddress: '41.72.200.77', status: 'SUCCESS' },
  });
  assert.equal(successRecord.suspicious, true);
  assert.ok(successRecord.suspiciousFlags.includes('success_after_failures'));
});

test('4. Geolocation service failures do not interrupt authentication', async () => {
  await AuthAuditLog.destroy({ where: {} });
  const brokenGeo = new IpGeolocationService({
    env: { IP_GEO_ENABLED: 'true', IP_GEO_TIMEOUT_MS: '300' },
    fetchImpl: async () => {
      throw new Error('Upstream geolocation service unreachable');
    },
  });
  const security = new AuthSecurityService(brokenGeo);
  const authService = new AuthService(security);

  const req = makeRequest({ xff: '41.72.111.11', trustProxy: 1 });
  const result = await authService.login(activeUser.username, 'StrongPassword!2026', req);
  assert.equal(result.success, true);
  await security.waitForPendingGeoUpdates();

  const record = await AuthAuditLog.findOne({ where: { ipAddress: '41.72.111.11' } });
  assert.ok(record);
  assert.equal(record.status, 'SUCCESS');
  assert.equal(record.geoCountry, null);
});

test('5. Admin SecurityController filtering, IP investigation, and strict RBAC enforcement', async () => {
  await AuthAuditLog.destroy({ where: {} });
  const geo = new IpGeolocationService({ env: { IP_GEO_ENABLED: 'false' } });
  const security = new AuthSecurityService(geo);
  const authService = new AuthService(security);
  const controller = new SecurityController(security);

  const attackerReq = makeRequest({ xff: '41.72.150.10', trustProxy: 1 });
  await assert.rejects(() => authService.login('i.m.o.zoz.o.9.80@gmail.com', 'bad1', attackerReq), UnauthorizedException);
  await assert.rejects(() => authService.login('i.m.o.zoz.o.9.80@gmail.com', 'bad2', attackerReq), UnauthorizedException);

  const staffReq = makeRequest({ xff: '41.72.150.20', trustProxy: 1 });
  await authService.login(activeUser.username, 'StrongPassword!2026', staffReq);

  // Filter by email
  const emailFiltered = await controller.listLoginActivity({ email: 'i.m.o.zoz' });
  assert.equal(emailFiltered.data.length, 2);
  assert.equal(emailFiltered.summary.failedAttempts, 2);

  // Filter by status
  const successOnly = await controller.listLoginActivity({ status: 'SUCCESS' });
  assert.equal(successOnly.data.length, 1);
  assert.equal(successOnly.data[0].ipAddress, '41.72.150.20');

  // IP investigation endpoint
  const investigation = await controller.investigateIp({ ipAddress: '41.72.150.10' }, {});
  assert.equal(investigation.ipAddress, '41.72.150.10');
  assert.equal(investigation.stats.totalAttempts, 2);
  assert.equal(investigation.stats.failedAttempts, 2);
  assert.equal(investigation.targetedAccounts[0].attemptedEmail, 'i.m.o.zoz.o.9.80@gmail.com');
  assert.match(investigation.approximateLocation.disclaimer, /Approximate/i);

  // RBAC guard verification: only admin has access to SecurityController endpoints
  const rolesGuard = new RolesGuard();
  const permissionsGuard = new PermissionsGuard();

  const makeContext = (role, handler) => ({
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { id: 1, role } : null }),
    }),
  });

  for (const methodName of ['listLoginActivity', 'investigateIp']) {
    const handler = SecurityController.prototype[methodName];

    // Admin allowed
    assert.equal(rolesGuard.canActivate(makeContext('admin', handler)), true);
    assert.equal(permissionsGuard.canActivate(makeContext('admin', handler)), true);

    // Manager, staff user, customer, and unauthenticated rejected
    for (const deniedRole of [null, 'customer', 'user', 'manager']) {
      assert.equal(rolesGuard.canActivate(makeContext(deniedRole, handler)), false);
      assert.throws(
        () => permissionsGuard.canActivate(makeContext(deniedRole, handler)),
        ForbiddenException
      );
    }
  }

  // Also confirm AuthController admin endpoints enforce Roles/Permissions on the method handler
  assert.equal(rolesGuard.canActivate(makeContext('admin', AuthController.prototype.listUsers)), true);
  assert.equal(rolesGuard.canActivate(makeContext('customer', AuthController.prototype.listUsers)), false);
  assert.throws(
    () => permissionsGuard.canActivate(makeContext('customer', AuthController.prototype.listUsers)),
    ForbiddenException
  );
});
