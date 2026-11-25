import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEBUG_TAP_THRESHOLD,
  canViewDeveloperInfo,
  canViewStaffWorkspace,
  formatRoleBadgeLabel,
  shouldRevealDeveloperInfo,
} from './accountAccess.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(__dirname, '..');

describe('mobile Account screen role & security helpers', () => {
  test('canViewStaffWorkspace allows only staff roles and hides from customers/guests', () => {
    for (const role of ['admin', 'ADMIN', 'manager', 'user', 'cashier', 'pharmacist']) {
      assert.equal(canViewStaffWorkspace({ role }), true, `Expected ${role} to see Staff Workspace`);
    }

    for (const user of [null, undefined, {}, { role: '' }, { role: 'customer' }, { role: 'patient' }]) {
      assert.equal(
        canViewStaffWorkspace(user),
        false,
        `Expected ${JSON.stringify(user)} NOT to see Staff Workspace`
      );
    }
  });

  test('developer server info is restricted strictly to admin accounts behind 5 taps', () => {
    assert.equal(DEBUG_TAP_THRESHOLD, 5);
    assert.equal(canViewDeveloperInfo(null), false);
    assert.equal(canViewDeveloperInfo({ role: 'customer' }), false);
    assert.equal(canViewDeveloperInfo({ role: 'cashier' }), false);
    assert.equal(canViewDeveloperInfo({ role: 'pharmacist' }), false);
    assert.equal(canViewDeveloperInfo({ role: 'manager' }), false);
    assert.equal(canViewDeveloperInfo({ role: 'admin' }), true);

    assert.equal(shouldRevealDeveloperInfo({ role: 'customer' }, 10), false);
    assert.equal(shouldRevealDeveloperInfo({ role: 'cashier' }, 10), false);
    assert.equal(shouldRevealDeveloperInfo({ role: 'admin' }, 0), false);
    assert.equal(shouldRevealDeveloperInfo({ role: 'admin' }, 4), false);
    assert.equal(shouldRevealDeveloperInfo({ role: 'admin' }, 5), true);
  });

  test('formatRoleBadgeLabel renders clean labels for staff and customer roles', () => {
    assert.equal(formatRoleBadgeLabel('admin'), 'ADMIN');
    assert.equal(formatRoleBadgeLabel('manager'), 'MANAGER');
    assert.equal(formatRoleBadgeLabel('pharmacist'), 'PHARMACIST');
    assert.equal(formatRoleBadgeLabel('cashier'), 'CASHIER');
    assert.equal(formatRoleBadgeLabel('user'), 'STAFF');
    assert.equal(formatRoleBadgeLabel('customer'), 'CUSTOMER');
  });

  test('profile screen wraps content in SafeAreaView(top), puts Sign Out at bottom, and gates staff/dev cards', () => {
    const profileSource = readFileSync(join(mobileRoot, 'app', '(tabs)', 'profile.tsx'), 'utf8');

    assert.equal(profileSource.includes('<SafeAreaView'), true);
    assert.equal(profileSource.includes("edges={['top']}"), true);
    assert.equal(profileSource.includes('canViewStaffWorkspace(user)'), true);
    assert.equal(profileSource.includes('shouldRevealDeveloperInfo(user, debugTapCount)'), true);

    const customerServicesIdx = profileSource.indexOf('CUSTOMER SERVICES');
    const appInfoIdx = profileSource.indexOf('APP INFORMATION');
    const signOutBtnIdx = profileSource.indexOf('accessibilityLabel="Sign out"');

    assert.ok(customerServicesIdx > 0, 'CUSTOMER SERVICES heading should exist');
    assert.ok(appInfoIdx > customerServicesIdx, 'APP INFORMATION should follow CUSTOMER SERVICES');
    assert.ok(
      signOutBtnIdx > appInfoIdx,
      'Sign Out button must be placed at the bottom of the screen below APP INFORMATION'
    );
  });
});
