const {
  Injectable,
  BadRequestException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} = require('@nestjs/common');
const { Op } = require('sequelize');
const { Customer, Sales, sequelize } = require('../../models');
const { paginatedResponse, parsePagination } = require('../common/pagination');
const { logUnexpectedError, safePersistenceException } = require('../common/error-handling');

const ALLOWED_GENDERS = new Map([
  ['female', 'Female'],
  ['male', 'Male'],
  ['other', 'Other'],
  ['prefer not to say', 'Prefer not to say'],
]);

function cleanText(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed || null;
}

function normalizePhoneDigits(phone) {
  if (typeof phone !== 'string') return '';
  return phone.replace(/\D/g, '');
}

function phoneComparisonKey(phone) {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return '';
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

function splitFullName(fullName) {
  const cleaned = cleanText(fullName);
  if (!cleaned) return { firstName: null, lastName: null };
  const parts = cleaned.split(' ');
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function validateDateOfBirth(rawDob) {
  const cleaned = cleanText(rawDob);
  if (!cleaned) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    throw new BadRequestException('Date of birth must use YYYY-MM-DD format');
  }
  const [year, month, day] = cleaned.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(parsed.getTime())
    || parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() + 1 !== month
    || parsed.getUTCDate() !== day
  ) {
    throw new BadRequestException('Date of birth is not a valid calendar date');
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  if (cleaned > todayStr) {
    throw new BadRequestException('Date of birth cannot be in the future');
  }
  return cleaned;
}

function validateGender(rawGender) {
  const cleaned = cleanText(rawGender);
  if (!cleaned) return null;
  const canonical = ALLOWED_GENDERS.get(cleaned.toLowerCase());
  if (!canonical) {
    throw new BadRequestException('Gender must be Female, Male, Other, or Prefer not to say');
  }
  return canonical;
}

function buildCaseInsensitiveLike(column, pattern) {
  if (sequelize.getDialect() === 'postgres') {
    return { [column]: { [Op.iLike]: pattern } };
  }
  return sequelize.where(
    sequelize.fn('LOWER', sequelize.col(`Customer.${column}`)),
    'LIKE',
    pattern.toLowerCase()
  );
}

function buildCustomerSearchWhere(rawQuery) {
  const cleaned = cleanText(rawQuery);
  if (!cleaned) return {};

  const pattern = `%${cleaned}%`;
  const orClauses = [
    buildCaseInsensitiveLike('name', pattern),
    buildCaseInsensitiveLike('firstName', pattern),
    buildCaseInsensitiveLike('lastName', pattern),
    buildCaseInsensitiveLike('phone', pattern),
    buildCaseInsensitiveLike('patientCode', pattern),
  ];

  // Allow searching by numeric ID or stripped patient code like "#12" / "MQP-000012"
  const idMatch = cleaned.match(/^(?:#|mqp-?)?0*(\d+)$/i);
  if (idMatch) {
    const numericId = Number(idMatch[1]);
    if (Number.isInteger(numericId) && numericId > 0) {
      orClauses.push({ id: numericId });
    }
  }

  const digits = normalizePhoneDigits(cleaned);
  if (digits.length >= 4) {
    orClauses.push({ phone: { [Op.like]: `%${digits.slice(-9)}%` } });
  }

  return { [Op.or]: orClauses };
}

function serializePatientSummary(customer) {
  if (!customer) return null;
  const plain = typeof customer.get === 'function' ? customer.get({ plain: true }) : customer;
  return {
    id: plain.id,
    patientCode: plain.patientCode || `MQP-${String(plain.id).padStart(6, '0')}`,
    firstName: plain.firstName || null,
    lastName: plain.lastName || null,
    name: plain.name,
    phone: plain.phone || null,
    gender: plain.gender || null,
    dateOfBirth: plain.dateOfBirth || null,
    address: plain.address || null,
    email: plain.email || null,
  };
}

class CustomersService {
  async list(query = {}) {
    const pagination = parsePagination(query);
    const searchTerm = cleanText(query?.q ?? query?.search);
    const where = searchTerm ? buildCustomerSearchWhere(searchTerm) : {};

    const result = await Customer.findAndCountAll({
      where,
      limit: pagination.limit,
      offset: pagination.offset,
      order: [['name', 'ASC'], ['id', 'ASC']],
    });
    return paginatedResponse(result.rows, result.count, pagination);
  }

  async search(query) {
    const searchTerm = cleanText(query);
    if (!searchTerm) {
      return Customer.findAll({
        order: [['name', 'ASC'], ['id', 'ASC']],
        limit: 25,
      });
    }
    return Customer.findAll({
      where: buildCustomerSearchWhere(searchTerm),
      order: [['name', 'ASC'], ['id', 'ASC']],
      limit: 50,
    });
  }

  async create(body = {}) {
    const hasStructuredName = body.firstName !== undefined || body.lastName !== undefined;
    let firstName = cleanText(body.firstName);
    let lastName = cleanText(body.lastName);
    let fullName = cleanText(body.name);

    if (hasStructuredName) {
      if (!firstName || !lastName) {
        throw new BadRequestException('First name and last name are required');
      }
      fullName = `${firstName} ${lastName}`;
    } else {
      if (!fullName) {
        throw new BadRequestException('Patient name is required');
      }
      const split = splitFullName(fullName);
      firstName = split.firstName;
      lastName = split.lastName;
    }

    const phone = cleanText(body.phone);
    if (phone && normalizePhoneDigits(phone).length < 6) {
      throw new BadRequestException('Phone number must contain at least 6 digits');
    }

    const gender = validateGender(body.gender);
    const dateOfBirth = validateDateOfBirth(body.dateOfBirth);
    const address = cleanText(body.address);
    const email = cleanText(body.email);
    const requestedPatientCode = cleanText(body.patientCode)?.toUpperCase() || null;

    const transaction = await sequelize.transaction();
    try {
      // 1. Duplicate check by patientCode if supplied
      if (requestedPatientCode) {
        const existingCode = await Customer.findOne({
          where: buildCaseInsensitiveLike('patientCode', requestedPatientCode),
          transaction,
        });
        if (existingCode) {
          throw new ConflictException({
            message: `Patient ID ${existingCode.patientCode} is already registered to ${existingCode.name}.`,
            code: 'DUPLICATE_PATIENT',
            existingCustomer: serializePatientSummary(existingCode),
          });
        }
      }

      // 2. Duplicate check by normalized phone number (handles spacing, hyphens, and +260 vs 0 prefixes)
      if (phone) {
        const key = phoneComparisonKey(phone);
        const candidates = await Customer.findAll({
          where: { phone: { [Op.ne]: null } },
          attributes: ['id', 'patientCode', 'firstName', 'lastName', 'name', 'phone', 'gender', 'dateOfBirth', 'address', 'email'],
          transaction,
        });
        const matchedByPhone = candidates.find(
          (candidate) => phoneComparisonKey(candidate.phone) === key
        );
        if (matchedByPhone) {
          throw new ConflictException({
            message: `A patient with phone number ${phone} is already registered (${matchedByPhone.name}).`,
            code: 'DUPLICATE_PATIENT',
            existingCustomer: serializePatientSummary(matchedByPhone),
          });
        }
      }

      // 3. Duplicate check by full name + date of birth (prevents accidental duplicate when phone is omitted)
      if (dateOfBirth) {
        const matchedByIdentity = await Customer.findOne({
          where: {
            [Op.and]: [
              sequelize.where(
                sequelize.fn('LOWER', sequelize.col('Customer.name')),
                fullName.toLowerCase()
              ),
              { dateOfBirth },
            ],
          },
          transaction,
        });
        if (matchedByIdentity) {
          throw new ConflictException({
            message: `${matchedByIdentity.name} (born ${dateOfBirth}) is already registered as ${matchedByIdentity.patientCode || `#${matchedByIdentity.id}`}.`,
            code: 'DUPLICATE_PATIENT',
            existingCustomer: serializePatientSummary(matchedByIdentity),
          });
        }
      }

      const created = await Customer.create({
        firstName,
        lastName,
        name: fullName,
        phone: phone || null,
        email: email || null,
        address: address || null,
        gender,
        dateOfBirth,
        patientCode: requestedPatientCode,
        allergies: cleanText(body.allergies),
        chronicConditions: cleanText(body.chronicConditions),
        insuranceProvider: cleanText(body.insuranceProvider),
        insuranceNumber: cleanText(body.insuranceNumber),
        notes: cleanText(body.notes),
      }, { transaction });

      if (!created.patientCode) {
        const generatedCode = `MQP-${String(created.id).padStart(6, '0')}`;
        await created.update({ patientCode: generatedCode }, { transaction });
      }

      await transaction.commit();
      return created;
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback().catch(() => {});
      }
      if (error instanceof HttpException) throw error;
      const publicError = safePersistenceException(
        error,
        'Failed to register patient',
        'Patient information is invalid or already registered'
      );
      if (publicError.getStatus() >= 500) logUnexpectedError('Customer creation failed:', error);
      throw publicError;
    }
  }

  async get(id) {
    try {
      const customer = await Customer.findByPk(id, { include: [Sales] });
      if (!customer) throw new NotFoundException('Customer not found');
      return customer;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      logUnexpectedError('Customer lookup failed:', error);
      throw new InternalServerErrorException('Error fetching customer');
    }
  }
}

Injectable()(CustomersService);
module.exports = CustomersService;
