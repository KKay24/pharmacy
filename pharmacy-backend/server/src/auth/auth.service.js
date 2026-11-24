const {
  Injectable,
  Inject,
  Optional,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} = require('@nestjs/common');
const User = require('../../models/User');
const { hashPassword, verifyPassword } = require('../../lib/auth/passwords');
const { signAccessToken } = require('../../lib/auth/tokens');
const {
  VALID_ROLES,
  VALID_STATUSES,
  findUserByUsername,
  normalizeUsernameInput,
  serializeUser,
} = require('../../lib/users');
const AuthSecurityService = require('../security/auth-security.service');
const { extractRequestContext } = require('../security/request-context');

class AuthService {
  constructor(authSecurityService) {
    this.authSecurityService = authSecurityService || null;
  }

  async login(usernameInput, password, request = null) {
    const username = normalizeUsernameInput(usernameInput);
    const security = this.authSecurityService;

    if (!username || !password) {
      if (security) {
        await security.recordLoginAttempt({
          request,
          userId: null,
          attemptedEmail: username || 'missing',
          status: 'FAILED',
          failureReason: 'missing_credentials',
        });
      }
      throw new BadRequestException('Username and password are required');
    }

    if (security) {
      const { ipAddress } = extractRequestContext(request);
      const allowance = security.checkLoginAllowance({
        ipAddress,
        attemptedEmail: username,
      });

      if (!allowance.allowed) {
        await security.recordLoginAttempt({
          request,
          userId: null,
          attemptedEmail: username,
          status: 'FAILED',
          failureReason: 'rate_limited',
        });

        const retryMinutes = Math.max(1, Math.ceil(allowance.retryAfterSeconds / 60));
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            error: 'Too Many Requests',
            message: `Too many failed login attempts. Please wait about ${retryMinutes} minute${retryMinutes === 1 ? '' : 's'} and try again.`,
            retryAfterSeconds: allowance.retryAfterSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
    }

    const user = await findUserByUsername(username);
    if (!user) {
      if (security) {
        await security.recordLoginAttempt({
          request,
          userId: null,
          attemptedEmail: username,
          status: 'FAILED',
          failureReason: 'unknown_user',
        });
      }
      throw new UnauthorizedException('Invalid username or password');
    }

    if (!verifyPassword(password, user.password)) {
      if (security) {
        await security.recordLoginAttempt({
          request,
          userId: user.id,
          attemptedEmail: username,
          status: 'FAILED',
          failureReason: 'incorrect_password',
        });
      }
      throw new UnauthorizedException('Invalid username or password');
    }

    if (user.status !== 'active') {
      if (security) {
        await security.recordLoginAttempt({
          request,
          userId: user.id,
          attemptedEmail: username,
          status: 'FAILED',
          failureReason: 'disabled_account',
        });
      }
      throw new ForbiddenException('Account is suspended. Please contact administrator.');
    }

    user.lastLogin = new Date();
    await user.save();

    if (security) {
      await security.recordLoginAttempt({
        request,
        userId: user.id,
        attemptedEmail: username,
        status: 'SUCCESS',
        failureReason: null,
      });
    }

    return {
      success: true,
      message: 'Logged in successfully',
      token: signAccessToken(user),
      user: serializeUser(user),
    };
  }

  async changePassword(user, currentPassword, newPassword) {
    if (!currentPassword || typeof newPassword !== 'string' || newPassword.length < 12) {
      throw new BadRequestException('Current password and a new password of at least 12 characters are required');
    }

    if (!verifyPassword(currentPassword, user.password)) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    user.password = hashPassword(newPassword);
    user.mustChangePassword = false;
    await user.save();

    return {
      success: true,
      message: 'Password changed successfully',
      user: serializeUser(user),
    };
  }

  getCurrentUser(user) {
    return { user: serializeUser(user) };
  }

  async listUsers() {
    const users = await User.findAll({ order: [['createdAt', 'DESC']] });
    return users.map(serializeUser);
  }

  async createUser(body) {
    const username = normalizeUsernameInput(body?.username);
    const password = typeof body?.password === 'string' ? body.password.trim() : '';
    const role = typeof body?.role === 'string' ? body.role.trim().toLowerCase() : 'user';
    const email = typeof body?.email === 'string' && body.email.trim() ? body.email.trim() : null;
    const locations = Array.isArray(body?.locations) ? body.locations.filter(Boolean) : [];

    if (!username || !password) {
      throw new BadRequestException('Username and password are required');
    }
    if (!VALID_ROLES.includes(role)) {
      throw new BadRequestException('Invalid role supplied');
    }
    if (role === 'admin') {
      throw new ForbiddenException('Admin accounts must be created through the controlled seed script');
    }
    if (await findUserByUsername(username)) {
      throw new ConflictException('Username already exists');
    }

    const newUser = await User.create({
      username,
      password: hashPassword(password),
      role,
      email,
      locations,
      status: 'active',
    });

    return {
      success: true,
      message: 'User created successfully',
      user: serializeUser(newUser),
    };
  }

  async updateStatus(id, status, currentUser) {
    if (!VALID_STATUSES.includes(status)) {
      throw new BadRequestException('Invalid status');
    }
    const user = await User.findByPk(id);
    if (!user) throw new NotFoundException('User not found');
    if (user.id === currentUser.id) {
      throw new BadRequestException('You cannot change your own account status');
    }
    user.status = status;
    await user.save();
    return { success: true, message: `User status updated to ${status}` };
  }

  async resetUserPassword(id, body, currentUser) {
    const rawPassword = typeof body?.newPassword === 'string'
      ? body.newPassword
      : typeof body?.password === 'string'
        ? body.password
        : '';
    const nextPassword = rawPassword.trim();

    if (!nextPassword || nextPassword.length < 12) {
      throw new BadRequestException('New password must be at least 12 characters long');
    }

    const user = await User.findByPk(id);
    if (!user) throw new NotFoundException('User not found');
    if (user.id === currentUser.id) {
      throw new BadRequestException('Use Change Password to update your own account password');
    }
    if (user.role === 'admin') {
      throw new ForbiddenException('Admin account passwords cannot be reset from user management');
    }

    user.password = hashPassword(nextPassword);
    user.mustChangePassword = body?.mustChangePassword === true;
    await user.save();

    return {
      success: true,
      message: 'User password updated successfully',
      user: serializeUser(user),
    };
  }

  async updateUser(id, body, currentUser) {
    const user = await User.findByPk(id);
    if (!user) throw new NotFoundException('User not found');
    if (user.id === currentUser.id) {
      if (body.role && body.role !== user.role) throw new BadRequestException('You cannot change your own role');
      if (body.status && body.status !== user.status) throw new BadRequestException('You cannot change your own status');
    }
    if (body.role === 'admin' && user.role !== 'admin') {
      throw new ForbiddenException('Admin accounts must be created through the controlled seed script');
    }

    const rawPassword = typeof body?.newPassword === 'string'
      ? body.newPassword
      : typeof body?.password === 'string'
        ? body.password
        : '';
    const nextPassword = rawPassword.trim();
    if (nextPassword) {
      if (user.id === currentUser.id) {
        throw new BadRequestException('Use Change Password to update your own account password');
      }
      if (user.role === 'admin') {
        throw new ForbiddenException('Admin account passwords cannot be reset from user management');
      }
      if (nextPassword.length < 12) {
        throw new BadRequestException('New password must be at least 12 characters long');
      }
      user.password = hashPassword(nextPassword);
      user.mustChangePassword = body?.mustChangePassword === true;
    }

    if (body.email !== undefined) {
      const cleanedEmail = typeof body.email === 'string' ? body.email.trim() : '';
      user.email = cleanedEmail || null;
    }
    if (body.role && VALID_ROLES.includes(body.role)) user.role = body.role;
    if (Array.isArray(body.locations)) user.locations = body.locations;
    if (body.status && VALID_STATUSES.includes(body.status)) user.status = body.status;
    await user.save();
    return { success: true, message: 'User updated successfully', user: serializeUser(user) };
  }

  async deleteUser(id, currentUser) {
    const user = await User.findByPk(id);
    if (!user) throw new NotFoundException('User not found');
    if (user.id === currentUser.id) {
      throw new BadRequestException('You cannot delete your own account');
    }
    if (user.role === 'admin') {
      throw new ForbiddenException('Admin accounts cannot be deleted');
    }

    const [paymentCount, refundCount, reconciliationCount] = await Promise.all([
      SalePayment.count({ where: { confirmedByUserId: user.id } }),
      SaleRefund.count({ where: { processedByUserId: user.id } }),
      CashDrawerReconciliation.count({ where: { closedByUserId: user.id } }),
    ]);
    if (paymentCount > 0 || refundCount > 0 || reconciliationCount > 0) {
      throw new ConflictException(
        'This user has financial audit records (confirmed payments, refunds, or cash drawer closes) and cannot be permanently deleted. Suspend the account instead.'
      );
    }

    await sequelize.transaction(async (transaction) => {
      await Sales.update({ soldByUserId: null }, { where: { soldByUserId: user.id }, transaction });
      await Sales.update({ reversedByUserId: null }, { where: { reversedByUserId: user.id }, transaction });
      await Order.update({ userId: null }, { where: { userId: user.id }, transaction });
      await Order.update({ cancelledByUserId: null }, { where: { cancelledByUserId: user.id }, transaction });
      await Customer.update({ userId: null }, { where: { userId: user.id }, transaction });
      await Expense.update({ createdByUserId: null }, { where: { createdByUserId: user.id }, transaction });
      await Expense.update({ voidedByUserId: null }, { where: { voidedByUserId: user.id }, transaction });
      await Expense.update({ correctedByUserId: null }, { where: { correctedByUserId: user.id }, transaction });
      await AuthAuditLog.update({ userId: null }, { where: { userId: user.id }, transaction });
      await AuditLog.update({ userId: null }, { where: { userId: user.id }, transaction });
      await user.destroy({ transaction });
    });

    return { success: true, message: 'User deleted successfully' };
  }

  async registerCustomer(body) {
    const username = normalizeUsernameInput(body?.username || body?.email || body?.phone);
    const password = typeof body?.password === 'string' ? body.password.trim() : '';
    const email = typeof body?.email === 'string' && body.email.trim() ? body.email.trim() : null;
    const name = typeof body?.name === 'string' ? body.name.trim() : username;
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : null;
    const address = typeof body?.address === 'string' ? body.address.trim() : null;

    if (!username || !password) {
      throw new BadRequestException('Username and password are required');
    }
    if (password.length < 12) {
      throw new BadRequestException('Password must be at least 12 characters long');
    }

    if (await findUserByUsername(username)) {
      throw new ConflictException('An account with this username already exists');
    }

    const existingCustomer = phone
      ? await Customer.findOne({ where: { phone } })
      : null;
    if (existingCustomer) {
      throw new ConflictException('This phone number is already associated with a pharmacy customer. Please contact the pharmacy to verify account access.');
    }

    const newUser = await User.create({
      username,
      password: hashPassword(password),
      role: 'customer',
      email,
      locations: [],
      status: 'active',
    });

    const customer = await Customer.create({
      name: name || username,
      phone,
      email,
      address,
      userId: newUser.id,
    });

    return {
      success: true,
      message: 'Registration successful',
      token: signAccessToken(newUser),
      user: serializeUser(newUser),
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
      },
    };
  }

  async getProfile(currentUser) {
    const user = await User.findByPk(currentUser.id);
    if (!user) throw new NotFoundException('User not found');
    const customer = await Customer.findOne({ where: { userId: user.id } });
    return {
      user: serializeUser(user),
      customer: customer ? {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
      } : null,
    };
  }

  async updateProfile(currentUser, body) {
    const user = await User.findByPk(currentUser.id);
    if (!user) throw new NotFoundException('User not found');
    if (body.email) {
      user.email = body.email;
      await user.save();
    }

    let customer = await Customer.findOne({ where: { userId: user.id } });
    if (!customer && (body.phone || body.name)) {
      customer = await Customer.create({
        userId: user.id,
        name: body.name || user.username,
        phone: body.phone,
        email: body.email || user.email,
        address: body.address,
      });
    } else if (customer) {
      if (body.name) customer.name = body.name;
      if (body.phone) customer.phone = body.phone;
      if (body.address !== undefined) customer.address = body.address;
      if (body.email) customer.email = body.email;
      await customer.save();
    }

    return {
      success: true,
      message: 'Profile updated successfully',
      user: serializeUser(user),
      customer: customer ? {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
      } : null,
    };
  }
}

const {
  sequelize,
  AuditLog,
  AuthAuditLog,
  CashDrawerReconciliation,
  Customer,
  Expense,
  Order,
  SalePayment,
  SaleRefund,
  Sales,
} = require('../../models');

const { ConflictException, NotFoundException } = require('@nestjs/common');
Injectable()(AuthService);
Optional()(AuthService, undefined, 0);
Inject(AuthSecurityService)(AuthService, undefined, 0);

module.exports = AuthService;