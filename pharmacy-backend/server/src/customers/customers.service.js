const { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } = require('@nestjs/common');
const { Op } = require('sequelize');
const { Customer, Sales } = require('../../models');

class CustomersService {
  async list() { return Customer.findAll(); }
  async search(query) { return Customer.findAll({ where: { [Op.or]: [{ name: { [Op.like]: `%${query}%` } }, { phone: { [Op.like]: `%${query}%` } }] } }); }
  async create(body) { try { return await Customer.create(body); } catch (error) { throw new BadRequestException('Failed to add customer'); } }
  async get(id) {
    try {
      const customer = await Customer.findByPk(id, { include: [Sales] });
      if (!customer) throw new NotFoundException('Customer not found');
      return customer;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Error fetching customer');
    }
  }
}

Injectable()(CustomersService);
module.exports = CustomersService;