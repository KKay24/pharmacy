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
    if (user.id === currentUser.id) throw new BadRequestException('You cannot delete your own account');
    await user.destroy();
    return { success: true, message: 'User deleted successfully' };
  }
}

const { ConflictException, NotFoundException } = require('@nestjs/common');
Injectable()(AuthService);

module.exports = AuthService;