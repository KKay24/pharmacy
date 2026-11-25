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
  Res,
  UseGuards,
} = require('@nestjs/common');
const StoreService = require('./store.service');
const AuthGuard = require('../auth/auth.guard');
const OptionalAuthGuard = require('../auth/optional-auth.guard');
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

  autocomplete(query) {
    return this.service.getAutocomplete(query);
  }

  searchAnalytics(query) {
    return this.service.getSearchAnalytics(query);
  }

  recordSearchClick(body) {
    return this.service.recordSearchClick(body);
  }

  getProductAlternatives(params) {
    return this.service.getProductAlternatives(params.id);
  }

  getProductImage(params, req, res) {
    return this.service.getProductImage(params.id, req, res);
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

  updateOrderStatus(params, body, req) {
    return this.service.updateOrderStatus(params.id, body?.status, body?.reason, req?.user || null);
  }

  // Prescriptions
  uploadPrescription(body, req) {
    return this.service.uploadPrescription(body, req?.user || null);
  }

  trackPrescription(params) {
    return this.service.trackPrescription(params.ref);
  }

  getMyPrescriptions(req, query) {
    return this.service.getCustomerPrescriptions(req.user, query);
  }

  getMyPrescriptionDocument(params, req) {
    return this.service.getCustomerPrescriptionDocument(params.id, req.user);
  }

  // Support
  createSupportInquiry(body) {
    return this.service.createSupportInquiry(body);
  }

  listSupportInquiries(query) {
    return this.service.listSupportInquiries(query);
  }

  updateSupportInquiryStatus(params, body) {
    return this.service.updateSupportInquiryStatus(params.id, body?.status);
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

applyMethodDecorator(Get, StoreController.prototype, 'autocomplete', 'products/autocomplete');
applyParameterDecorator(Query, StoreController.prototype, 'autocomplete', 0);

applyMethodDecorator(Get, StoreController.prototype, 'searchAnalytics', 'products/search/analytics');
applyParameterDecorator(Query, StoreController.prototype, 'searchAnalytics', 0);
applyMethodDecorator(UseGuards, StoreController.prototype, 'searchAnalytics', AuthGuard, RolesGuard);
applyMethodDecorator(Roles, StoreController.prototype, 'searchAnalytics', 'admin', 'manager');

applyMethodDecorator(Post, StoreController.prototype, 'recordSearchClick', 'products/search/click');
applyParameterDecorator(Body, StoreController.prototype, 'recordSearchClick', 0);

applyMethodDecorator(Get, StoreController.prototype, 'getProductAlternatives', 'products/:id/alternatives');
applyParameterDecorator(Param, StoreController.prototype, 'getProductAlternatives', 0);

applyMethodDecorator(Get, StoreController.prototype, 'getProductImage', 'products/:id/image');
applyParameterDecorator(Param, StoreController.prototype, 'getProductImage', 0);
applyParameterDecorator(Req, StoreController.prototype, 'getProductImage', 1);
applyParameterDecorator(Res, StoreController.prototype, 'getProductImage', 2);

applyMethodDecorator(Get, StoreController.prototype, 'getProduct', 'products/:id');
applyParameterDecorator(Param, StoreController.prototype, 'getProduct', 0);

// Orders routes
applyMethodDecorator(Post, StoreController.prototype, 'createOrder', 'orders');
applyParameterDecorator(Body, StoreController.prototype, 'createOrder', 0);
applyParameterDecorator(Req, StoreController.prototype, 'createOrder', 1);
applyMethodDecorator(UseGuards, StoreController.prototype, 'createOrder', OptionalAuthGuard);

applyMethodDecorator(Get, StoreController.prototype, 'listOrders', 'orders');
applyParameterDecorator(Query, StoreController.prototype, 'listOrders', 0);
applyParameterDecorator(Req, StoreController.prototype, 'listOrders', 1);
applyMethodDecorator(UseGuards, StoreController.prototype, 'listOrders', OptionalAuthGuard);

applyMethodDecorator(Get, StoreController.prototype, 'getOrder', 'orders/:id');
applyParameterDecorator(Param, StoreController.prototype, 'getOrder', 0);
applyMethodDecorator(UseGuards, StoreController.prototype, 'getOrder', AuthGuard, RolesGuard);
Roles('admin', 'manager')(StoreController.prototype, 'getOrder');

applyMethodDecorator(Put, StoreController.prototype, 'updateOrderStatus', 'orders/:id/status');
applyParameterDecorator(Param, StoreController.prototype, 'updateOrderStatus', 0);
applyParameterDecorator(Body, StoreController.prototype, 'updateOrderStatus', 1);
applyParameterDecorator(Req, StoreController.prototype, 'updateOrderStatus', 2);
applyMethodDecorator(UseGuards, StoreController.prototype, 'updateOrderStatus', AuthGuard, RolesGuard);
Roles('admin', 'manager', 'user')(StoreController.prototype, 'updateOrderStatus');

// Prescription customer routes
applyMethodDecorator(Post, StoreController.prototype, 'uploadPrescription', 'prescriptions/upload');
applyParameterDecorator(Body, StoreController.prototype, 'uploadPrescription', 0);
applyParameterDecorator(Req, StoreController.prototype, 'uploadPrescription', 1);
applyMethodDecorator(UseGuards, StoreController.prototype, 'uploadPrescription', OptionalAuthGuard);

applyMethodDecorator(Get, StoreController.prototype, 'trackPrescription', 'prescriptions/track/:ref');
applyParameterDecorator(Param, StoreController.prototype, 'trackPrescription', 0);

applyMethodDecorator(Get, StoreController.prototype, 'getMyPrescriptions', 'prescriptions/my');
applyParameterDecorator(Req, StoreController.prototype, 'getMyPrescriptions', 0);
applyParameterDecorator(Query, StoreController.prototype, 'getMyPrescriptions', 1);
applyMethodDecorator(UseGuards, StoreController.prototype, 'getMyPrescriptions', AuthGuard);

applyMethodDecorator(Get, StoreController.prototype, 'getMyPrescriptionDocument', 'prescriptions/my/:id/document');
applyParameterDecorator(Param, StoreController.prototype, 'getMyPrescriptionDocument', 0);
applyParameterDecorator(Req, StoreController.prototype, 'getMyPrescriptionDocument', 1);
applyMethodDecorator(UseGuards, StoreController.prototype, 'getMyPrescriptionDocument', AuthGuard);

// Support inquiry
applyMethodDecorator(Post, StoreController.prototype, 'createSupportInquiry', 'support/inquiries');
applyParameterDecorator(Body, StoreController.prototype, 'createSupportInquiry', 0);

applyMethodDecorator(Get, StoreController.prototype, 'listSupportInquiries', 'support/inquiries');
applyParameterDecorator(Query, StoreController.prototype, 'listSupportInquiries', 0);
applyMethodDecorator(UseGuards, StoreController.prototype, 'listSupportInquiries', AuthGuard, RolesGuard);
Roles('admin', 'manager', 'user')(StoreController.prototype, 'listSupportInquiries');

applyMethodDecorator(Put, StoreController.prototype, 'updateSupportInquiryStatus', 'support/inquiries/:id/status');
applyParameterDecorator(Param, StoreController.prototype, 'updateSupportInquiryStatus', 0);
applyParameterDecorator(Body, StoreController.prototype, 'updateSupportInquiryStatus', 1);
applyMethodDecorator(UseGuards, StoreController.prototype, 'updateSupportInquiryStatus', AuthGuard, RolesGuard);
Roles('admin', 'manager', 'user')(StoreController.prototype, 'updateSupportInquiryStatus');

module.exports = StoreController;
