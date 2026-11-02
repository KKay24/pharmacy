const { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } = require('@nestjs/common');
const { Supplier } = require('../../models');
const { logUnexpectedError, safePersistenceException } = require('../common/error-handling');

class SuppliersService {
  async list() { try { return await Supplier.findAll({ order: [['name', 'ASC']] }); } catch (error) { logUnexpectedError('Supplier list failed:', error); throw new InternalServerErrorException('Failed to fetch suppliers'); } }
  async create(body) { try { return await Supplier.create(body); } catch (error) { const publicError = safePersistenceException(error, 'Failed to create supplier', 'Supplier data is invalid'); if (publicError.getStatus() >= 500) logUnexpectedError('Supplier creation failed:', error); throw publicError; } }
  async update(id, body) { try { const supplier = await Supplier.findByPk(id); if (!supplier) throw new NotFoundException('Supplier not found'); await supplier.update(body); return supplier; } catch (error) { const publicError = safePersistenceException(error, 'Failed to update supplier', 'Supplier data is invalid'); if (publicError.getStatus() >= 500) logUnexpectedError('Supplier update failed:', error); throw publicError; } }
  async remove(id) { const supplier = await Supplier.findByPk(id); if (!supplier) throw new NotFoundException('Supplier not found'); await supplier.destroy(); return { message: 'Supplier deleted successfully' }; }
}

Injectable()(SuppliersService);
module.exports = SuppliersService;
