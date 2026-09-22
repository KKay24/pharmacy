const { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } = require('@nestjs/common');
const { Prescription, Customer } = require('../../models');

class PrescriptionsService {
  async list() { try { return await Prescription.findAll({ include: [Customer], order: [['date', 'DESC']] }); } catch { throw new InternalServerErrorException('Failed to fetch prescriptions'); } }
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