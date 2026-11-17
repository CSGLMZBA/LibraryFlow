import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseRegistration, parseLogin} from '../../apps/backend/src/schemas/auth-schema.ts';
import {createAuthGuard} from '../../apps/backend/src/middleware/auth-guard.ts';

const valid = {email:' Test@Example.com ', password:'Test1234!', requestedRole:'reader'};
test('S1-AUTH-01: valid reader register and normalization', () => {
  assert.deepEqual(parseRegistration(valid), {...valid,email:'test@example.com'});
});
test('S1-AUTH-01: publisher role allowed', () => {
  assert.equal(parseRegistration({...valid,requestedRole:'publisher'}).requestedRole,'publisher');
});
test('S1-AUTH-01: public moderator registration rejected', () => {
  assert.throws(()=>parseRegistration({...valid,requestedRole:'moderator'}), {code:'VALIDATION_ERROR',field:'requestedRole'});
});
test('S1-AUTH-01: email and password validation', () => {
  assert.throws(()=>parseRegistration({...valid,email:'bad'}),{code:'VALIDATION_ERROR',field:'email'});
  assert.throws(()=>parseRegistration({...valid,password:'123'}),{code:'VALIDATION_ERROR',field:'password'});
});
test('S1-AUTH-01: login wrong input does not disclose which field', () => {
  assert.throws(()=>parseLogin({email:'bad',password:''}),{code:'INVALID_CREDENTIALS'});
});
function fakeResponse() {
  return {statusCode:200,body:undefined,status(number){this.statusCode=number;return this;},json(data){this.body=data;return this;},locals:{}};
}
test('S1-AUTH-01: no bearer token => 401', async () => {
  const response=fakeResponse();let advanced=false;
  await createAuthGuard(async()=>({uid:'u1',role:'reader'}))({headers:{}},response,()=>{advanced=true;});
  assert.equal(response.statusCode,401);assert.equal(advanced,false);
});
test('S1-AUTH-01: verified wrong role => 403', async () => {
  const response=fakeResponse();let advanced=false;
  await createAuthGuard(async()=>({uid:'u1',role:'reader'}),'publisher')({headers:{authorization:'Bearer demo'}},response,()=>{advanced=true;});
  assert.equal(response.statusCode,403);assert.equal(advanced,false);
});
test('S1-AUTH-01: verified correct role => next with uid', async () => {
  const response=fakeResponse();let advanced=false;
  await createAuthGuard(async()=>({uid:'u1',role:'publisher'}),'publisher')({headers:{authorization:'Bearer verified'}},response,()=>{advanced=true;});
  assert.equal(advanced,true);assert.deepEqual(response.locals.auth,{uid:'u1',role:'publisher'});
});
test('S1-AUTH-01: guard never trusts user-provided role', async () => {
  const response=fakeResponse();let advanced=false;
  await createAuthGuard(async()=>null,'moderator')({headers:{authorization:'Bearer fake'},body:{role:'moderator'}},response,()=>{advanced=true;});
  assert.equal(response.statusCode,401);assert.equal(advanced,false);
});
