#!/usr/bin/env node
// Simple integration test for onboarding persistence (M1)
// Verifies that setUserPreference/getUserPreference round-trip for a user-scoped key

require('dotenv').config();
const db = require('../server/database');

(async () => {
  const uid = `test-uid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `test+${Date.now()}@example.com`;
  const key = 'onboarding.dismissed';
  const value = true;

  try {
    process.stdout.write('Ensuring database connection... ');
    // Quick ping
    await db.pool.query('SELECT 1');
    console.log('OK');

    process.stdout.write(`Setting preference [${key}] for user ${uid}... `);
    await db.setUserPreference(uid, email, key, value);
    console.log('OK');

    process.stdout.write(`Getting preference [${key}] for user ${uid}... `);
    const read = await db.getUserPreference(uid, key);
    console.log('OK');

    if (read === value) {
      console.log(`\n✅ PASS: Preference round-trip successful (value=${read})`);
      process.exit(0);
    } else {
      console.error(`\n❌ FAIL: Expected ${value} but got ${read}`);
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    process.exit(1);
  } finally {
    try { await db.close(); } catch(_) {}
  }
})();
