import { test, describe, mock, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { register, login, me } from '../src/controllers/authController.js';
import User from '../src/models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

describe('Auth Controller & Security', () => {
  before(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  const createMockReqRes = (body = {}, headers = {}, user = null) => {
    const req = { body, headers, user };
    const res = {
      statusValue: null,
      jsonValue: null,
      status(val) {
        this.statusValue = val;
        return this;
      },
      json(val) {
        this.jsonValue = val;
        return this;
      }
    };
    const next = mock.fn();
    return { req, res, next };
  };

  test('register validates inputs and defaults to INSPECTOR', async () => {
    mock.method(User, 'findOne', async () => null); // Email not in use
    mock.method(User, 'create', async (data) => ({
      _id: '123',
      ...data
    }));
    mock.method(bcrypt, 'hash', async () => 'hashed-password');

    const { req, res, next } = createMockReqRes({
      name: 'John Doe',
      email: 'john@test.com',
      password: 'strongpassword123',
      role: 'ADMIN' // Malicious attempt
    });

    await register(req, res, next);

    assert.equal(res.statusValue, 201);
    assert.equal(res.jsonValue.success, true);
    assert.equal(res.jsonValue.data.role, 'INSPECTOR'); // Ensure role was overridden
    
    mock.restoreAll();
  });

  test('login rejects invalid credentials', async () => {
    mock.method(User, 'findOne', async () => null); // User not found

    const { req, res, next } = createMockReqRes({
      email: 'john@test.com',
      password: 'wrong'
    });

    await login(req, res, next);

    assert.equal(res.statusValue, 401);
    assert.equal(res.jsonValue.success, false);
    
    mock.restoreAll();
  });

  test('login issues HttpOnly cookie without returning password', async () => {
    mock.method(User, 'findOne', async () => ({
      _id: '123',
      name: 'Jane',
      email: 'jane@test.com',
      passwordHash: 'hashed',
      role: 'INSPECTOR',
      isActive: true,
      save: async () => {}
    }));
    mock.method(bcrypt, 'compare', async () => true);

    const { req, res, next } = createMockReqRes({
      email: 'jane@test.com',
      password: 'password123'
    });

    res.cookiesSet = [];
    res.cookie = function(name, value, options) {
      this.cookiesSet.push({ name, value, options });
    };

    await login(req, res, next);

    assert.equal(res.statusValue, 200);
    assert.equal(res.cookiesSet.length, 1);
    assert.equal(res.cookiesSet[0].name, 'jwt');
    assert.equal(res.cookiesSet[0].options.httpOnly, true);
    assert.equal(res.jsonValue.data.passwordHash, undefined); // Password never returned
    
    mock.restoreAll();
  });

  test('me returns current user based on token payload', async () => {
    mock.method(User, 'findById', () => ({
      select: async () => ({
        _id: '123',
        name: 'Jane',
        email: 'jane@test.com',
        role: 'INSPECTOR',
        isActive: true
      })
    }));

    const { req, res, next } = createMockReqRes({}, {}, { userId: '123' });

    await me(req, res, next);

    assert.equal(res.statusValue, 200);
    assert.equal(res.jsonValue.data.email, 'jane@test.com');
    assert.equal(res.jsonValue.data.passwordHash, undefined);
    
    mock.restoreAll();
  });
});
