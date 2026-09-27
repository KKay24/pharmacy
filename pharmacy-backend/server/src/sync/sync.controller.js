const { Body, Controller, Inject, Post, Req, UseGuards } = require('@nestjs/common');
const SyncService = require('./sync.service');
const AuthGuard = require('../auth/auth.guard');
const { applyClassDecorator, applyMethodDecorator, applyParameterDecorator } = require('../common/decorate');

class SyncController {
  constructor(service) {
    this.service = service;
  }

  sync(body, req) {
    return this.service.processSync(body, req?.user);
  }
}

applyClassDecorator(Controller, SyncController, 'api/sync');
Inject(SyncService)(SyncController, undefined, 0);
applyMethodDecorator(Post, SyncController.prototype, 'sync');
applyMethodDecorator(UseGuards, SyncController.prototype, 'sync', AuthGuard);
applyParameterDecorator(Body, SyncController.prototype, 'sync', 0);
applyParameterDecorator(Req, SyncController.prototype, 'sync', 1);

module.exports = SyncController;
