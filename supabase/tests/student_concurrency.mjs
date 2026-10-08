// Integration check against the linked Supabase API. Uses only a disposable QA account.
// Run: node --env-file=.env.local supabase/tests/student_concurrency.mjs
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert(url && secret && anonKey, 'Supabase test configuration is missing');
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, secret, options);
  const email = `student-duplicate-qa-${randomUUID()}@example.invalid`;
  const password = randomUUID() + randomUUID();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(error);
  const userId = data.user.id;
  const teacher = createClient(url, anonKey, options);
  try {
    const login = await teacher.auth.signInWithPassword({ email, password });
    assert.ifError(login.error);
    const requests = Array.from({ length: 8 }, (_, index) => teacher.from('students').insert({
      user_id: userId, full_name: index % 2 ? '  nAMA   BERSAMA QA  ' : 'Nama Bersama QA',
      school_level: 'SD', grade_level: '4',
    }).select('id'));
    const responses = await Promise.all(requests);
    assert.equal(responses.filter((response) => !response.error).length, 1, 'Concurrent inserts must create exactly one student');
    assert.equal(responses.filter((response) => response.error?.code === '23505').length, 7, 'Every competing duplicate must be rejected');
    const preflight = await teacher.rpc('student_name_conflicts', { p_name: ' NAMA  bersama qa ' });
    assert.ifError(preflight.error);
    assert.equal(preflight.data, true);
    const count = await admin.from('students').select('id', { count: 'exact', head: true }).eq('user_id', userId);
    assert.ifError(count.error);
    assert.equal(count.count, 1);
    console.log('PASS: 8 simultaneous authenticated inserts created 1 student; 7 duplicates were rejected; preflight RPC works');
  } finally {
    await teacher.auth.signOut();
    const cleanup = await admin.auth.admin.deleteUser(userId);
    assert.ifError(cleanup.error);
    console.log('PASS: disposable QA account and its student were removed');
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
