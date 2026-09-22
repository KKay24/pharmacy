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
UseGuards(AuthGuard, RolesGuard)(AuthController.prototype, 'listUsers', Object.getOwnPropertyDescriptor(AuthController.prototype, 'listUsers'));
UseGuards(AuthGuard, RolesGuard)(AuthController.prototype, 'createUser', Object.getOwnPropertyDescriptor(AuthController.prototype, 'createUser'));
UseGuards(AuthGuard, RolesGuard)(AuthController.prototype, 'updateStatus', Object.getOwnPropertyDescriptor(AuthController.prototype, 'updateStatus'));
UseGuards(AuthGuard, RolesGuard)(AuthController.prototype, 'updateUser', Object.getOwnPropertyDescriptor(AuthController.prototype, 'updateUser'));
UseGuards(AuthGuard, RolesGuard)(AuthController.prototype, 'deleteUser', Object.getOwnPropertyDescriptor(AuthController.prototype, 'deleteUser'));

Roles('admin')(AuthController.prototype, 'listUsers');
Roles('admin')(AuthController.prototype, 'createUser');
Roles('admin')(AuthController.prototype, 'updateStatus');
Roles('admin')(AuthController.prototype, 'updateUser');
Roles('admin')(AuthController.prototype, 'deleteUser');

module.exports = AuthController;