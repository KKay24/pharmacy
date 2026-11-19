const {
  Body,
  Controller,
  Delete,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} = require('@nestjs/common');
const AiService = require('./ai.service');
const OptionalAuthGuard = require('../auth/optional-auth.guard');
const {
  applyClassDecorator,
  applyMethodDecorator,
  applyParameterDecorator,
} = require('../common/decorate');
const { extractClientIp } = require('../security/request-context');

class AiController {
  constructor(service) {
    this.service = service;
  }

  chat(body, req) {
    return this.service.chat(body, {
      clientIp: extractClientIp(req),
      user: req?.user || null,
    });
  }

  clearSession(params) {
    return this.service.clearSession(params?.sessionId);
  }
}

applyClassDecorator(Controller, AiController, 'api/ai');
Inject(AiService)(AiController, undefined, 0);

applyMethodDecorator(Post, AiController.prototype, 'chat', 'chat');
applyParameterDecorator(Body, AiController.prototype, 'chat', 0);
applyParameterDecorator(Req, AiController.prototype, 'chat', 1);
applyMethodDecorator(UseGuards, AiController.prototype, 'chat', OptionalAuthGuard);

applyMethodDecorator(Delete, AiController.prototype, 'clearSession', 'sessions/:sessionId');
applyParameterDecorator(Param, AiController.prototype, 'clearSession', 0);

module.exports = AiController;
