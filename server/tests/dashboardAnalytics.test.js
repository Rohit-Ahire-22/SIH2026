import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import { getAnalytics } from '../src/controllers/productController.js';
import Product from '../src/models/Product.js';

describe('Dashboard Analytics Controller', () => {

  const createMockReqRes = (query = {}) => {
    const req = { query, user: { userId: 'test-user' } };
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

  test('getAnalytics gracefully handles invalid days parameter', async () => {
    const { req, res, next } = createMockReqRes({ days: '-5' });
    await getAnalytics(req, res, next);
    
    assert.equal(res.statusValue, 400);
    assert.equal(res.jsonValue.success, false);
    assert.match(res.jsonValue.message, /Invalid days parameter/);
  });

  test('getAnalytics processes aggregations correctly with valid data', async () => {
    const { req, res, next } = createMockReqRes({ days: '30' });

    mock.method(Product, 'aggregate', async (pipeline) => {
      // Mock different responses based on the pipeline stage characteristics
      const groupStage = pipeline.find(stage => stage.$group);
      
      // 1. Summary
      if (groupStage.$group._id === null) {
        return [{ total: 100, pass: 60, fail: 25, review: 10, pending: 5 }];
      }
      // 2. Compliance Distribution
      if (groupStage.$group._id === '$complianceStatus') {
        return [
          { _id: 'PASS', count: 60 },
          { _id: 'FAIL', count: 25 },
          { _id: 'REVIEW', count: 10 }
        ];
      }
      // 3. Category Breakdown
      if (groupStage.$group._id === '$category') {
        return [
          { _id: 'food', total: 50, pass: 30, fail: 15, review: 5 },
          { _id: 'beverage', total: 50, pass: 30, fail: 10, review: 5 }
        ];
      }
      // 4. Trend (Date based)
      if (typeof groupStage.$group._id === 'object' && groupStage.$group._id.$dateToString) {
        return [
          { _id: '2026-09-01', total: 10, pass: 6, fail: 2, review: 2 },
          { _id: '2026-09-02', total: 15, pass: 10, fail: 3, review: 2 }
        ];
      }
      
      return [];
    });

    await getAnalytics(req, res, next);

    assert.equal(res.statusValue, 200);
    assert.equal(res.jsonValue.success, true);
    
    const { summary, complianceDistribution, categoryBreakdown, trend } = res.jsonValue.data;
    
    // Check summary
    assert.equal(summary.total, 100);
    assert.equal(summary.pass, 60);
    
    // Check distribution map
    assert.equal(complianceDistribution.PASS, 60);
    assert.equal(complianceDistribution.FAIL, 25);
    assert.equal(complianceDistribution.PENDING, 0); // Not in mock result, should fall back to 0
    
    // Check categories
    assert.equal(categoryBreakdown.length, 2);
    assert.equal(categoryBreakdown[0]._id, 'food');
    
    // Check trend
    assert.equal(trend.length, 2);
    assert.equal(trend[0]._id, '2026-09-01');

    mock.restoreAll();
  });

  test('getAnalytics processes empty database gracefully', async () => {
    const { req, res, next } = createMockReqRes({ days: 'all' });

    mock.method(Product, 'aggregate', async () => []); // DB is empty

    await getAnalytics(req, res, next);

    assert.equal(res.statusValue, 200);
    const { summary, complianceDistribution, categoryBreakdown, trend } = res.jsonValue.data;
    
    assert.equal(summary.total, 0);
    assert.equal(complianceDistribution.PASS, 0);
    assert.equal(categoryBreakdown.length, 0);
    assert.equal(trend.length, 0);

    mock.restoreAll();
  });

});
