import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { newMatchEvents, serializeNotification } from '../src/services/notification-events.mjs';

const companyId = new ObjectId(), torId = new ObjectId(), userId = new ObjectId();
const project = { _id: torId, projectId: 'TOR-001', title: 'Software services' };
const user = { _id: userId, companyId, status: 'active', notificationPreferences: { channels: ['in_app'], alertTypes: ['new_match'] } };
const match = { companyId, torId, torVersion: 1, resultType: 'requirement_match', status: 'compared', score: 65 };

test('positive coverage generates a schema-compatible in-app alert with an honest explanation', () => {
  const now = new Date();
  const [event] = newMatchEvents([match], [project], [user], now);
  assert.equal(event.userId, userId);
  assert.equal(event.channel, 'in_app');
  assert.equal(event.type, 'new_match');
  assert.equal(event.status, 'sent');
  assert.equal(event.createdAt, now);
  assert.match(event.message, /65% requirement coverage/);
  assert.match(event.message, /missing requirements/);
  assert.equal(event.attemptCount, 0);
  assert.equal(event.deliveryError, null);
});

test('repeated recalculations and TOR versions share the same idempotency key', () => {
  const first = newMatchEvents([match, match], [project], [user]);
  const next = newMatchEvents([{ ...match, torVersion: 2, score: 80 }], [project], [user]);
  assert.equal(first.length, 1);
  assert.equal(first[0].eventKey, next[0].eventKey);
});

test('zero, missing, invalid, unavailable and AI recommendation results do not trigger match alerts', () => {
  for (const variant of [{score:0},{score:-1},{score:NaN},{score:Infinity},{score:undefined},
    {status:'unavailable'},{resultType:'ai_recommendation'}]) {
    assert.deepEqual(newMatchEvents([{...match,...variant}], [project], [user]), []);
  }
});

test('only active, opted-in members of the matching company receive an alert', () => {
  for (const variant of [{status:'suspended'},{deletedAt:new Date()}, {companyId:new ObjectId()},
    {notificationPreferences:{channels:['email'],alertTypes:['new_match']}},
    {notificationPreferences:{channels:['in_app'],alertTypes:['deadline_reminder']}},
    {notificationPreferences:undefined}]) {
    assert.deepEqual(newMatchEvents([match], [project], [{...user,...variant}]), []);
  }
  const second = {...user,_id:new ObjectId()};
  assert.equal(newMatchEvents([match], [project], [user,second]).length, 2);
});

test('missing or deleted projects cannot generate a broken project alert', () => {
  assert.deepEqual(newMatchEvents([match], [], [user]), []);
  assert.deepEqual(newMatchEvents([match], [{_id:torId}], [user]), []);
});

test('public notification serialization omits internal IDs, event keys, recipient details and retry metadata', () => {
  const event = newMatchEvents([match], [project], [user])[0];
  const result = serializeNotification({...event,_id:new ObjectId(),project});
  assert.equal(result.projectId,'TOR-001');
  assert.equal(result.isRead,false);
  for (const key of ['userId','companyId','torId','eventKey','deliveryError']) assert.equal(result[key],undefined);
  assert.equal(serializeNotification({...event,_id:new ObjectId(),status:'read'}).projectId,null);
});
