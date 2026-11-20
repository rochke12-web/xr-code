import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDailyMessage, DEFAULT_DAILY_MESSAGES } from '../src/lib/daily-message-policy.mjs';
const now = new Date('2026-11-19T12:00:00Z');
const base = { now, usedDay: '2026-11-19', usedCount: 0, dailyLimit: DEFAULT_DAILY_MESSAGES, disabled: false };
test('first and last permitted message', () => {
 assert.equal(evaluateDailyMessage(base).count, 1);
 assert.equal(evaluateDailyMessage({ ...base, usedCount: 99 }).count, 100);
});
test('blocks after limit and disabled users', () => {
 assert.equal(evaluateDailyMessage({ ...base, usedCount: 100 }).reason, 'daily_limit');
 assert.equal(evaluateDailyMessage({ ...base, disabled: true }).reason, 'disabled');
});
test('resets on the next UTC day and accepts an admin-defined limit', () => {
 assert.equal(evaluateDailyMessage({ ...base, usedDay: '2026-11-18', usedCount: 100 }).count, 1);
 assert.equal(evaluateDailyMessage({ ...base, dailyLimit: 2, usedCount: 2 }).allowed, false);
});
test('fails closed on invalid limits or usage', () => {
 assert.throws(() => evaluateDailyMessage({ ...base, dailyLimit: -1 }));
 assert.throws(() => evaluateDailyMessage({ ...base, usedCount: NaN }));
});

test('reservation runs through a server transaction and writes only on allowance', async () => {
 const { reserveDailyMessage } = await import('../src/lib/daily-message-policy.mjs');
 let record = { usageDay: '2026-11-19', messageCount: 99, dailyLimit: 100, disabled: false };
 const ref = {};
 const db = { collection: () => ({ doc: () => ref }), runTransaction: async (cb) => cb({
   get: async () => ({ exists: true, data: () => ({ ...record }) }),
   set: (_ref, value, options) => { assert.equal(options.merge, true); record = { ...record, ...value }; },
 }) };
 assert.equal((await reserveDailyMessage(db, 'user-1', now)).count, 100);
 assert.equal((await reserveDailyMessage(db, 'user-1', now)).reason, 'daily_limit');
 assert.equal(record.messageCount, 100);
 await assert.rejects(reserveDailyMessage(db, '../other', now));
});
