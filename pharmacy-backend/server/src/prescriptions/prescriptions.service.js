const { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } = require('@nestjs/common');
const { Prescription, Customer } = require('../../models');
const { paginatedResponse, parsePagination } = require('../common/pagination');

class PrescriptionsService {
  async list(query) {
    try {
      const pagination = parsePagination(query);
      const result = await Prescription.findAndCountAll({ include: [Customer], order: [['date', 'DESC']], distinct: true, limit: pagination.limit, offset: pagination.offset });
      return paginatedResponse(result.rows, result.count, pagination);
    } catch { throw new InternalServerErrorException('Failed to fetch prescriptions'); }
  }
  async create(body) { try { return await Prescription.create(body); } catch { throw new BadRequestException('Failed to create prescription'); } }
  async updateStatus(id, status) {
    try {
      const item = await Prescription.findByPk(id);
      if (!item) throw new NotFoundException('Not found');
      await item.update({ status });
      return item;
    } catch (error) { if (error instanceof NotFoundException) throw error; throw new InternalServerErrorException('Update failed'); }
  }
}

Injectable()(PrescriptionsService);
module.exports = PrescriptionsService;