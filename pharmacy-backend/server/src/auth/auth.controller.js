const {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Req,
  SetMetadata,
  UseGuards,
} = require('@nestjs/common');
const AuthService = require('./auth.service');
const AuthGuard = require('./auth.guard');
const Roles = require('./roles.decorator');
const { RolesGuard } = require('./roles.guard');
const RequirePermissions = require('./permissions.decorator');
const { Permissions } = require('./permissions');
const PermissionsGuard = require('./permissions.guard');

class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  login(body) { return this.authService.login(body?.username, body?.password); }
  changePassword(body, request) { return this.authService.changePassword(request.user, body?.currentPassword, body?.newPassword); }
  me(request) { return this.authService.getCurrentUser(request.user); }
  listUsers() { return this.authService.listUsers(); }
  createUser(body) { return this.authService.createUser(body); }
  updateStatus(params, body, request) { return this.authService.updateStatus(params.id, body?.status, request.user); }
  updateUser(params, body, request) { return this.authService.updateUser(params.id, body, request.user); }
  deleteUser(params, request) { return this.authService.deleteUser(params.id, request.user); }

  // Customer-facing endpoints
  registerCustomer(body) { return this.authService.registerCustomer(body); }
  getMyProfile(request) { return this.authService.getProfile(request.user); }
  updateMyProfile(body, request) { return this.authService.updateProfile(request.user, body); }
}

Controller('api/auth')(AuthController);
Inject(AuthService)(AuthController, undefined, 0);
Post('login')(AuthController.prototype, 'login', Object.getOwnPropertyDescriptor(AuthController.prototype, 'login'));
HttpCode(200)(AuthController.prototype, 'login', Object.getOwnPropertyDescriptor(AuthController.prototype, 'login'));
Post('change-password')(AuthController.prototype, 'changePassword', Object.getOwnPropertyDescriptor(AuthController.prototype, 'changePassword'));
HttpCode(200)(AuthController.prototype, 'changePassword', Object.getOwnPropertyDescriptor(AuthController.prototype, 'changePassword'));
Get('me')(AuthController.prototype, 'me', Object.getOwnPropertyDescriptor(AuthController.prototype, 'me'));
Get('users')(AuthController.prototype, 'listUsers', Object.getOwnPropertyDescriptor(AuthController.prototype, 'listUsers'));
Post('users')(AuthController.prototype, 'createUser', Object.getOwnPropertyDescriptor(AuthController.prototype, 'createUser'));
Patch('users/:id/status')(AuthController.prototype, 'updateStatus', Object.getOwnPropertyDescriptor(AuthController.prototype, 'updateStatus'));
Put('users/:id')(AuthController.prototype, 'updateUser', Object.getOwnPropertyDescriptor(AuthController.prototype, 'updateUser'));
Delete('users/:id')(AuthController.prototype, 'deleteUser', Object.getOwnPropertyDescriptor(AuthController.prototype, 'deleteUser'));

Body()(AuthController.prototype, 'login', 0);
Body()(AuthController.prototype, 'changePassword', 0);
Req()(AuthController.prototype, 'changePassword', 1);
Req()(AuthController.prototype, 'me', 0);
Body()(AuthController.prototype, 'createUser', 0);
Param()(AuthController.prototype, 'updateStatus', 0);
Body()(AuthController.prototype, 'updateStatus', 1);
Req()(AuthController.prototype, 'updateStatus', 2);
Param()(AuthController.prototype, 'updateUser', 0);
Body()(AuthController.prototype, 'updateUser', 1);
Req()(AuthController.prototype, 'updateUser', 2);
Param()(AuthController.prototype, 'deleteUser', 0);
Req()(AuthController.prototype, 'deleteUser', 1);

UseGuards(AuthGuard)(AuthController.prototype, 'changePassword', Object.getOwnPropertyDescriptor(AuthController.prototype, 'changePassword'));
UseGuards(AuthGuard)(AuthController.prototype, 'me', Object.getOwnPropertyDescriptor(AuthController.prototype, 'me'));
for (const method of ['listUsers', 'createUser', 'updateStatus', 'updateUser', 'deleteUser']) UseGuards(AuthGuard, RolesGuard, PermissionsGuard)(AuthController.prototype, method, Object.getOwnPropertyDescriptor(AuthController.prototype, method));

Roles('admin')(AuthController.prototype, 'listUsers');
Roles('admin')(AuthController.prototype, 'createUser');
Roles('admin')(AuthController.prototype, 'updateStatus');
Roles('admin')(AuthController.prototype, 'updateUser');
Roles('admin')(AuthController.prototype, 'deleteUser');
RequirePermissions(Permissions.USERS_READ)(AuthController.prototype, 'listUsers');
for (const method of ['createUser', 'updateStatus', 'updateUser', 'deleteUser']) RequirePermissions(Permissions.USERS_WRITE)(AuthController.prototype, method);

// Customer-facing route wiring
Post('register')(AuthController.prototype, 'registerCustomer', Object.getOwnPropertyDescriptor(AuthController.prototype, 'registerCustomer'));
Body()(AuthController.prototype, 'registerCustomer', 0);

Get('profile')(AuthController.prototype, 'getMyProfile', Object.getOwnPropertyDescriptor(AuthController.prototype, 'getMyProfile'));
Req()(AuthController.prototype, 'getMyProfile', 0);
UseGuards(AuthGuard)(AuthController.prototype, 'getMyProfile', Object.getOwnPropertyDescriptor(AuthController.prototype, 'getMyProfile'));

Put('profile')(AuthController.prototype, 'updateMyProfile', Object.getOwnPropertyDescriptor(AuthController.prototype, 'updateMyProfile'));
Body()(AuthController.prototype, 'updateMyProfile', 0);
Req()(AuthController.prototype, 'updateMyProfile', 1);
UseGuards(AuthGuard)(AuthController.prototype, 'updateMyProfile', Object.getOwnPropertyDescriptor(AuthController.prototype, 'updateMyProfile'));

module.exports = AuthController;