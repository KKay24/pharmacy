const {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} = require('@nestjs/common');
const StoreService = require('./store.service');
const AuthGuard = require('../auth/auth.guard');
const Roles = require('../auth/roles.decorator');
const { RolesGuard } = require('../auth/roles.guard');
const {
  applyClassDecorator,
  applyMethodDecorator,
  applyParameterDecorator,
} = require('../common/decorate');

class StoreController {
  constructor(service) {
    this.service = service;
  }

  // Products
  listProducts(query) {
    return this.service.listProducts(query);
  }

  popularProducts(query) {
    return this.service.getPopularProducts(query?.limit);
  }

  categories() {
    return this.service.getCategories();
  }

  getProduct(params) {
    return this.service.getProduct(params.id);
  }

  // Orders
  createOrder(body, req) {
    return this.service.createOrder(body, req?.user || null);
  }

  listOrders(query, req) {
    return this.service.listOrders(query, req?.user || null);
  }

  getOrder(params) {
    return this.service.getOrder(params.id);
  }

  updateOrderStatus(params, body) {
    return this.service.updateOrderStatus(params.id, body.status);
  }

  // Prescriptions
  uploadPrescription(body, req) {
    return this.service.uploadPrescription(body, req?.user || null);
  }

  trackPrescription(params) {
    return this.service.trackPrescription(params.ref);
  }

  getMyPrescriptions(req) {
    return this.service.getCustomerPrescriptions(req.user);
  }

  // Support
  createSupportInquiry(body) {
    return this.service.createSupportInquiry(body);
  }
}

applyClassDecorator(Controller, StoreController, 'api');
Inject(StoreService)(StoreController, undefined, 0);

// Products routes
applyMethodDecorator(Get, StoreController.prototype, 'listProducts', 'products');
applyParameterDecorator(Query, StoreController.prototype, 'listProducts', 0);

applyMethodDecorator(Get, StoreController.prototype, 'popularProducts', 'products/popular');
applyParameterDecorator(Query, StoreController.prototype, 'popularProducts', 0);

applyMethodDecorator(Get, StoreController.prototype, 'categories', 'products/categories');

applyMethodDecorator(Get, StoreController.prototype, 'getProduct', 'products/:id');
applyParameterDecorator(Param, StoreController.prototype, 'getProduct', 0);

// Orders routes
applyMethodDecorator(Post, StoreController.prototype, 'createOrder', 'orders');
applyParameterDecorator(Body, StoreController.prototype, 'createOrder', 0);
applyParameterDecorator(Req, StoreController.prototype, 'createOrder', 1);

applyMethodDecorator(Get, StoreController.prototype, 'listOrders', 'orders');
applyParameterDecorator(Query, StoreController.prototype, 'listOrders', 0);
applyParameterDecorator(Req, StoreController.prototype, 'listOrders', 1);

applyMethodDecorator(Get, StoreController.prototype, 'getOrder', 'orders/:id');
applyParameterDecorator(Param, StoreController.prototype, 'getOrder', 0);
applyMethodDecorator(UseGuards, StoreController.prototype, 'getOrder', AuthGuard, RolesGuard);
Roles('admin', 'manager')(StoreController.prototype, 'getOrder');

applyMethodDecorator(Put, StoreController.prototype, 'updateOrderStatus', 'orders/:id/status');
applyParameterDecorator(Param, StoreController.prototype, 'updateOrderStatus', 0);
applyParameterDecorator(Body, StoreController.prototype, 'updateOrderStatus', 1);
applyMethodDecorator(UseGuards, StoreController.prototype, 'updateOrderStatus', AuthGuard, RolesGuard);
Roles('admin', 'manager')(StoreController.prototype, 'updateOrderStatus');

// Prescription customer routes
applyMethodDecorator(Post, StoreController.prototype, 'uploadPrescription', 'prescriptions/upload');
applyParameterDecorator(Body, StoreController.prototype, 'uploadPrescription', 0);
applyParameterDecorator(Req, StoreController.prototype, 'uploadPrescription', 1);

applyMethodDecorator(Get, StoreController.prototype, 'trackPrescription', 'prescriptions/track/:ref');
applyParameterDecorator(Param, StoreController.prototype, 'trackPrescription', 0);

applyMethodDecorator(Get, StoreController.prototype, 'getMyPrescriptions', 'prescriptions/my');
applyParameterDecorator(Req, StoreController.prototype, 'getMyPrescriptions', 0);
applyMethodDecorator(UseGuards, StoreController.prototype, 'getMyPrescriptions', AuthGuard);

// Support inquiry
applyMethodDecorator(Post, StoreController.prototype, 'createSupportInquiry', 'support/inquiries');
applyParameterDecorator(Body, StoreController.prototype, 'createSupportInquiry', 0);

module.exports = StoreController;
