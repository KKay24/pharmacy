const {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
} = require('@nestjs/common');
const { UniqueConstraintError, ValidationError } = require('sequelize');
const { DuplicateResourceException } = require('./errors');

function logUnexpectedError(context, error) {
  // Avoid logging request bodies, SQL text, credentials, or personally
  // identifiable values. Error type/code are enough to correlate operations.
  console.error(context, error?.name || 'UnknownError', error?.parent?.code || error?.code || '');
}

function safePersistenceException(error, fallbackMessage, validationMessage = 'Request data is invalid') {
  if (error instanceof HttpException) return error;
  if (error instanceof UniqueConstraintError || error?.name === 'SequelizeUniqueConstraintError') {
    return new DuplicateResourceException('A record with these details already exists');
  }
  if (error instanceof ValidationError || error?.name === 'SequelizeValidationError') {
    return new BadRequestException(validationMessage);
  }
  return new InternalServerErrorException(fallbackMessage);
}

function safePublicMessage(error, fallbackMessage) {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'string') return response;
    if (typeof response?.message === 'string') return response.message;
  }
  return fallbackMessage;
}

module.exports = { logUnexpectedError, safePersistenceException, safePublicMessage };
