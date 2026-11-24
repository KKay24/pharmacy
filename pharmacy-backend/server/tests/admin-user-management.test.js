const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const tempDirectory = mkdtempSync(join(tmpdir(), 'mediquick-admin-users-test-'));

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.POSTGRES_URL = '';
process.env.SQLITE_STORAGE_PATH = join(tempDirectory, 'admin-users.sqlite');
process.env.ENABLE_DEMO_SEEDING = 'false';
process.env.JWT_SECRET = 'admin-users-test-secret-12345';

let sequelize;
let User;
let Sales;
let SaleRefund;
let AuthAuditLog;
let AuthService;
let hashPassword;
let verifyPassword;

describe('Admin user password reset and safe user deletion', () => {
  let service;
  let adminUser;

  before(async () => {
    const { ensureApplicationReady } = require('../src/app.module');
    await ensureApplicationReady();

    const models = require('../models');
    sequelize = models.sequelize;
    User = models.User;
    Sales = models.Sales;
    SaleRefund = models.SaleRefund;
    AuthAuditLog = models.AuthAuditLog;
    AuthService = require('../src/auth/auth.service');
    ({ hashPassword, verifyPassword } = require('../lib/auth/passwords'));

    service = new AuthService();
    adminUser = await User.create({
      username: 'admin-owner@example.test',
      email: 'admin-owner@example.test',
      password: hashPassword('AdminPassword1234!'),
      role: 'admin',
      status: 'active',
    });
  });

  after(async () => {
    if (sequelize) await sequelize.close();
    rmSync(tempDirectory, { recursive: true, force: true });
  });

  test('admin can reset a non-admin user password via resetUserPassword and old password is invalidated', async () => {
    const created = await service.createUser({
      username: 'staff-reset-target',
      email: 'staff-reset@example.test',
      password: 'OldStaffPassword123!',
      role: 'user',
    });

    const resetResult = await service.resetUserPassword(
      created.user.id,
      { newPassword: 'NewStaffPassword456!' },
      adminUser
    );

    assert.equal(resetResult.success, true);
    assert.equal(resetResult.user.username, 'staff-reset-target');
    assert.equal('password' in resetResult.user, false);

    const reloaded = await User.findByPk(created.user.id);
    assert.equal(verifyPassword('OldStaffPassword123!', reloaded.password), false);
    assert.equal(verifyPassword('NewStaffPassword456!', reloaded.password), true);
    assert.equal(reloaded.mustChangePassword, false);

    // Login succeeds with new password and fails with old password
    const loginOk = await service.login('staff-reset-target', 'NewStaffPassword456!');
    assert.equal(loginOk.success, true);
    await assert.rejects(
      () => service.login('staff-reset-target', 'OldStaffPassword123!'),
      (err) => err.getStatus?.() === 401
    );
  });

  test('updateUser supports optional password change and validates minimum length and admin protections', async () => {
    const created = await service.createUser({
      username: 'manager-update-pw',
      email: '',
      password: 'InitialManagerPass123!',
      role: 'manager',
    });

    // Rejects short password
    await assert.rejects(
      () => service.resetUserPassword(created.user.id, { newPassword: 'short' }, adminUser),
      (err) => err.getStatus?.() === 400
    );

    // Rejects self password reset through admin reset endpoint
    await assert.rejects(
      () => service.resetUserPassword(adminUser.id, { newPassword: 'AnotherAdminPass123!' }, adminUser),
      (err) => err.getStatus?.() === 400
    );

    // Rejects resetting another admin account
    const otherAdmin = await User.create({
      username: 'second-admin@example.test',
      email: 'second-admin@example.test',
      password: hashPassword('SecondAdminPass123!'),
      role: 'admin',
      status: 'active',
    });
    await assert.rejects(
      () => service.resetUserPassword(otherAdmin.id, { newPassword: 'HackedAdminPass123!' }, adminUser),
      (err) => err.getStatus?.() === 403
    );

    // Optional password update via PUT updateUser works and normalizes blank email to null
    const updated = await service.updateUser(
      created.user.id,
      { email: '   ', password: 'UpdatedManagerPass789!' },
      adminUser
    );
    assert.equal(updated.user.email, null);
    const reloaded = await User.findByPk(created.user.id);
    assert.equal(verifyPassword('UpdatedManagerPass789!', reloaded.password), true);
  });

  test('admin can delete a user with nullable sales/audit references while preserving historical records', async () => {
    const created = await service.createUser({
      username: 'staff-to-delete',
      email: 'delete-me@example.test',
      password: 'DeleteTargetPass123!',
      role: 'user',
    });

    const sale = await Sales.create({
      name: 'Paracetamol 500mg',
      quantity: 2,
      pricePerUnit: 10,
      totalPrice: 20,
      soldByUserId: created.user.id,
      date: new Date(),
    });
    const auditEntry = await AuthAuditLog.create({
      userId: created.user.id,
      attemptedEmail: 'staff-to-delete',
      ipAddress: '127.0.0.1',
      status: 'SUCCESS',
      suspicious: false,
      suspiciousFlags: [],
    });

    // Self-delete and admin-delete remain blocked
    await assert.rejects(
      () => service.deleteUser(adminUser.id, adminUser),
      (err) => err.getStatus?.() === 400
    );

    const deletion = await service.deleteUser(created.user.id, adminUser);
    assert.equal(deletion.success, true);

    assert.equal(await User.findByPk(created.user.id), null);
    const preservedSale = await Sales.findByPk(sale.id);
    assert.ok(preservedSale, 'Historical sale must remain intact');
    assert.equal(preservedSale.soldByUserId, null);

    const preservedAudit = await AuthAuditLog.findByPk(auditEntry.id);
    assert.ok(preservedAudit, 'Auth audit log must remain intact');
    assert.equal(preservedAudit.userId, null);
  });

  test('deleting a user with immutable refund audit records returns 409 Conflict instead of corrupting financial history', async () => {
    const created = await service.createUser({
      username: 'staff-with-refund',
      email: 'refund-staff@example.test',
      password: 'RefundStaffPass123!',
      role: 'manager',
    });

    const sale = await Sales.create({
      name: 'Amoxicillin 500mg',
      quantity: 1,
      pricePerUnit: 30,
      totalPrice: 30,
      soldByUserId: created.user.id,
      date: new Date(),
    });
    await SaleRefund.create({
      saleId: sale.id,
      amountMinor: 3000,
      method: 'Cash',
      financialDate: new Date(),
      reason: 'Customer return',
      processedByUserId: created.user.id,
    });

    await assert.rejects(
      () => service.deleteUser(created.user.id, adminUser),
      (err) => err.getStatus?.() === 409
    );

    assert.ok(await User.findByPk(created.user.id), 'User should remain intact when blocked by financial audit history');
  });
});
