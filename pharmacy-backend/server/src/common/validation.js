const { BadRequestException, Injectable } = require('@nestjs/common');
const { z } = require('zod');

const schemas = [
  { method: 'POST', path: '/api/auth/login', schema: z.object({ username: z.string().min(1), password: z.string().min(1) }).passthrough() },
  { method: 'POST', path: '/api/auth/change-password', schema: z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(12) }).passthrough() },
  { method: 'POST', path: '/api/auth/users', schema: z.object({ username: z.string().min(1), password: z.string().min(12), role: z.enum(['admin', 'manager', 'user']).optional(), email: z.string().email().nullable().optional(), locations: z.array(z.string()).optional() }).passthrough() },
  { method: 'POST', path: '/api/sales', schema: z.union([z.object({ quantity: z.coerce.number().positive(), totalPrice: z.coerce.number().nonnegative() }).passthrough(), z.array(z.object({ quantity: z.coerce.number().positive(), totalPrice: z.coerce.number().nonnegative() }).passthrough()).min(1)]) },
];

function schemaFor(request) {
  return schemas.find((item) => item.method === request.method && item.path === request.path)?.schema;
}

class RequestValidationMiddleware {
  use(request, response, next) {
    const schema = schemaFor(request);
    if (!schema) return next();
    const result = schema.safeParse(request.body);
    if (!result.success) throw new BadRequestException('Request validation failed');
    request.body = result.data;
    return next();
  }
}

Injectable()(RequestValidationMiddleware);
module.exports = RequestValidationMiddleware;