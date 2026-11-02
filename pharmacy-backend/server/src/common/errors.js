const { ConflictException, HttpStatus } = require('@nestjs/common');

/**
 * Domain errors keep expected business-rule failures distinct from persistence
 * failures. Their public payload is deliberately limited to a stable code and
 * a safe, actionable message.
 */
class BusinessRuleException extends ConflictException {
  constructor(message, code = 'BUSINESS_RULE_VIOLATION') {
    super({ statusCode: HttpStatus.CONFLICT, code, message });
  }
}

class InsufficientStockException extends BusinessRuleException {
  constructor(message = 'Insufficient stock is available to complete this operation.') {
    super(message, 'INSUFFICIENT_STOCK');
  }
}

class OrderStateException extends BusinessRuleException {
  constructor(message) {
    super(message, 'INVALID_ORDER_STATE');
  }
}

class DuplicateResourceException extends BusinessRuleException {
  constructor(message) {
    super(message, 'DUPLICATE_RESOURCE');
  }
}

module.exports = {
  BusinessRuleException,
  DuplicateResourceException,
  InsufficientStockException,
  OrderStateException,
};
