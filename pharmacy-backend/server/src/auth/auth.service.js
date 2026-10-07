const {
  Injectable,
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

class AuthService {
  async login(usernameInput, password) {
    const username = normalizeUsernameInput(usernameInput);
    if (!username || !password) {
      throw new BadRequestException('Username and password are required');
    }

    console.log(`[AUTH] Login attempt for user: "${username}"`);
    const user = await findUserByUsername(username);
    if (!user || !verifyPassword(password, user.password)) {
      throw new UnauthorizedException('Invalid username or password');
    }

    if (user.status !== 'active') {
      throw new ForbiddenException('Account is suspended. Please contact administrator.');
    }

    user.lastLogin = new Date();
    await user.save();

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
    const email = typeof body?.email === 'string' ? body.email.trim() : null;
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
    if (body.email !== undefined) user.email = body.email;
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
    await user.destroy();
    return { success: true, message: 'User deleted successfully' };
  }

  async registerCustomer(body) {
    const username = normalizeUsernameInput(body?.username || body?.email || body?.phone);
    const password = typeof body?.password === 'string' ? body.password.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim() : null;
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

const Customer = require('../../models/Customer');

const { ConflictException, NotFoundException } = require('@nestjs/common');
Injectable()(AuthService);

module.exports = AuthService;