import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';

test('notification persistence, ownership, duplicate prevention and read controls', {
  skip: process.env.RUN_NOTIFICATION_INTEGRATION !== 'true'
}, async t => {
  const { env } = await import('../src/config/env.mjs');
  assert.equal(env.mongodbDatabaseName, 'tor_software_test', 'Integration fixtures are restricted to the test database');
  const { connectDatabase, closeDatabase } = await import('../src/config/database.mjs');
  const { createRegisteredUser, updateUserStatus } = await import('../src/repositories/user.repository.mjs');
  const { publishMatchNotifications } = await import('../src/repositories/notification.repository.mjs');
  const { signAccessToken } = await import('../src/utils/tokens.mjs');
  const { app } = await import('../src/app.mjs');
  const db = await connectDatabase();
  const fixtureIds = [];
  let server;
  t.after(async () => {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (fixtureIds.length) {
      await db.collection('notifications').deleteMany({ userId: { $in: fixtureIds } });
      await db.collection('users').deleteMany({ _id: { $in: fixtureIds } });
    }
    await closeDatabase();
  });
  const project = await db.collection('tor_announcements').findOne({ projectId: { $type:'string' } });
  assert(project, 'At least one existing TOR is needed; this test never creates or edits TORs');
  const companyId = new ObjectId();
  async function fixture(company) {
    const created = await createRegisteredUser({email:`notification-${new ObjectId()}@example.invalid`,
      passwordHash:'test-only-not-a-login-hash',firstName:'Notification',lastName:'Fixture',companyId:company});
    fixtureIds.push(created._id);
    await updateUserStatus(created._id, 'active');
    return created;
  }
  const owner = await fixture(companyId), optedOut = await fixture(companyId), stranger = await fixture(new ObjectId());
  await db.collection('users').updateOne({_id:optedOut._id},{$set:{'notificationPreferences.channels':['email']}});
  const match = {companyId,torId:project._id,torVersion:1,resultType:'requirement_match',status:'compared',score:75};
  await Promise.all([publishMatchNotifications([match],[project]),publishMatchNotifications([match],[project])]);
  assert.equal(await db.collection('notifications').countDocuments({userId:owner._id}),1);
  assert.equal(await db.collection('notifications').countDocuments({userId:optedOut._id}),0);
  assert.equal(await db.collection('notifications').countDocuments({userId:stranger._id}),0);
  server = await new Promise(resolve => { const listener = app.listen(0,'127.0.0.1',()=>resolve(listener)); });
  const base = `http://127.0.0.1:${server.address().port}/api/notifications`;
  async function request(user,path='',method='GET') {
    const headers = user ? {cookie:`tor_access=${signAccessToken({sub:String(user._id),companyId:String(user.companyId),role:'company_admin'})}`} : {};
    return fetch(base+path,{headers,method});
  }
  assert.equal((await request(null)).status,401);
  const initial = await (await request(owner)).json();
  assert.equal(initial.unreadCount,1);
  assert.equal(initial.items[0].projectId,project.projectId);
  const id = initial.items[0].id;
  assert.equal((await request(stranger,`/${id}/read`,'PATCH')).status,404);
  assert.equal((await (await request(stranger)).json()).items.length,0);
  assert.equal((await request(owner,`/${id}/read`,'PATCH')).status,200);
  const read = await (await request(owner)).json();
  assert.equal(read.unreadCount,0);
  assert.equal(read.items[0].isRead,true);
  assert.equal((await request(owner,`/${id}/read`,'PATCH')).status,200);
  assert.equal((await (await request(owner)).json()).items[0].readAt,read.items[0].readAt);
  await publishMatchNotifications([{...match,torVersion:2}],[project]);
  assert.equal((await (await request(owner)).json()).unreadCount,0);
  const stored = await db.collection('notifications').findOne({userId:owner._id});
  const {_id,...copy} = stored;
  await db.collection('notifications').insertMany([
    {...copy,eventKey:`fixture:${owner._id}:second`,status:'sent',readAt:null,torId:new ObjectId()},
    {...copy,eventKey:`fixture:${owner._id}:email`,channel:'email',status:'queued'}
  ]);
  const next = await (await request(owner,'?limit=1')).json();
  assert.equal(next.pagination.total,2);
  assert.equal(next.items.length,1);
  assert.equal(next.unreadCount,1);
  assert.equal((await request(owner,'?limit=500')).status,400);
  assert.equal((await request(owner,'/not-an-id/read','PATCH')).status,400);
  assert.equal((await request(owner,'/read-all','PATCH')).status,200);
  assert.equal((await (await request(owner)).json()).unreadCount,0);
});
