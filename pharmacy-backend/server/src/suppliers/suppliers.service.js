const { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } = require('@nestjs/common');
const { Supplier } = require('../../models');

class SuppliersService {
  async list() { try { return await Supplier.findAll({ order: [['name', 'ASC']] }); } catch { throw new InternalServerErrorException('Failed to fetch suppliers'); } }
  async create(body) { try { return await Supplier.create(body); } catch (error) { throw new BadRequestException(error.message); } }
  async update(id, body) { try { const supplier = await Supplier.findByPk(id); if (!supplier) throw new NotFoundException('Supplier not found'); await supplier.update(body); return supplier; } catch (error) { if (error instanceof NotFoundException) throw error; throw new BadRequestException(error.message); } }
  async remove(id) { const supplier = await Supplier.findByPk(id); if (!supplier) throw new NotFoundException('Supplier not found'); await supplier.destroy(); return { message: 'Supplier deleted successfully' }; }
}

Injectable()(SuppliersService);
module.exports = SuppliersService;