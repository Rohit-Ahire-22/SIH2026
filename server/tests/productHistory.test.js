import { test, describe, mock, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { listProducts, getProductStats } from '../src/controllers/productController.js';
import Product from '../src/models/Product.js';

describe('Product History & Stats Controller', () => {

  const createMockReqRes = (query = {}) => {
    const req = { query };
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

  test('listProducts calculates pagination correctly', async () => {
    // Mock Product.find
    const mockFind = mock.fn(() => ({
      select: mock.fn(() => ({
        sort: mock.fn(() => ({
          skip: mock.fn(() => ({
            limit: mock.fn(() => ({
              lean: mock.fn(async () => [{ _id: '1' }, { _id: '2' }])
            }))
          }))
        }))
      }))
    }));
    
    mock.method(Product, 'find', mockFind);
    mock.method(Product, 'countDocuments', async () => 25);

    const { req, res, next } = createMockReqRes({ page: '2', limit: '10' });

    await listProducts(req, res, next);

    assert.equal(res.statusValue, 200);
    assert.equal(res.jsonValue.success, true);
    assert.equal(res.jsonValue.data.length, 2);
    
    const pagination = res.jsonValue.pagination;
    assert.equal(pagination.page, 2);
    assert.equal(pagination.limit, 10);
    assert.equal(pagination.total, 25);
    assert.equal(pagination.totalPages, 3);
    assert.equal(pagination.hasNext, true); // page 2 < 3
    assert.equal(pagination.hasPrevious, true); // page 2 > 1
    
    mock.restoreAll();
  });

  test('listProducts handles invalid pagination input', async () => {
    const mockFind = mock.fn(() => ({
      select: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [] }) }) }) })
    }));
    mock.method(Product, 'find', mockFind);
    mock.method(Product, 'countDocuments', async () => 0);

    // Provide absurd inputs
    const { req, res, next } = createMockReqRes({ page: '-5', limit: '500' });

    await listProducts(req, res, next);

    assert.equal(res.statusValue, 200);
    const pagination = res.jsonValue.pagination;
    // page should be clamped to 1
    assert.equal(pagination.page, 1);
    // limit should be clamped to 100
    assert.equal(pagination.limit, 100);
    
    mock.restoreAll();
  });

  test('listProducts escapes search regex', async () => {
    let capturedQuery;
    const mockFind = mock.fn((query) => {
      capturedQuery = query;
      return {
        select: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [] }) }) }) })
      }
    });
    mock.method(Product, 'find', mockFind);
    mock.method(Product, 'countDocuments', async () => 0);

    const { req, res, next } = createMockReqRes({ search: 'hello.*world' });

    await listProducts(req, res, next);
    
    // Ensure regex string is escaped so it literally matches "hello.*world"
    const orClauses = capturedQuery.$or;
    assert.ok(orClauses);
    assert.equal(orClauses[0].productName.source, 'hello\\.\\*world');
    
    mock.restoreAll();
  });

  test('getProductStats computes metrics', async () => {
    mock.method(Product, 'countDocuments', async (query) => {
      if (!query) return 100; // total
      if (query.complianceStatus === 'PASS') return 70;
      if (query.complianceStatus === 'FAIL') return 20;
      if (query.complianceStatus === 'REVIEW') return 10;
      return 0;
    });

    const { req, res, next } = createMockReqRes();

    await getProductStats(req, res, next);

    assert.equal(res.statusValue, 200);
    assert.equal(res.jsonValue.data.total, 100);
    assert.equal(res.jsonValue.data.pass, 70);
    assert.equal(res.jsonValue.data.fail, 20);
    assert.equal(res.jsonValue.data.review, 10);
    
    mock.restoreAll();
  });
});
