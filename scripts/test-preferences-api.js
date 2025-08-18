#!/usr/bin/env node
// API test for /api/user/preferences/:key using Supertest
// Bypasses Firebase verification via TEST_BYPASS_AUTH=1

require('dotenv').config();
process.env.TEST_BYPASS_AUTH = '1';
process.env.TEST_BYPASS_UID = process.env.TEST_BYPASS_UID || `test-api-${Date.now()}`;
process.env.TEST_BYPASS_EMAIL = process.env.TEST_BYPASS_EMAIL || 'api-test@example.com';

const request = require('supertest');
const app = require('../server');

(async () => {
  const key = 'onboarding.dismissed';
  const value = true;

  try {
    // PUT preference
    const putRes = await request(app)
      .put(`/api/user/preferences/${encodeURIComponent(key)}`)
      .set('Authorization', 'Bearer test-token') // ignored in bypass
      .send({ value })
      .expect(200);

    if (!putRes.body || putRes.body.success !== true) {
      throw new Error('PUT did not return success:true');
    }

    // GET preference
    const getRes = await request(app)
      .get(`/api/user/preferences/${encodeURIComponent(key)}`)
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    if (!getRes.body || getRes.body.value !== value) {
      throw new Error(`GET did not return expected value. Got: ${JSON.stringify(getRes.body)}`);
    }

    console.log('\n✅ API PASS: preferences GET/PUT round-trip successful');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ API FAIL:', err.message);
    process.exit(1);
  }
})();
