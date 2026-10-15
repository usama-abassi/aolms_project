import {afterEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({options:[] as any[]}));
vi.mock('pg',()=>({Pool:class {
 end=vi.fn(async()=>{});on=vi.fn();
 constructor(options:any){state.options.push(options);}
}}));
vi.mock('@vercel/functions',()=>({attachDatabasePool:vi.fn()}));
import {getPool} from './db';
afterEach(()=>{vi.unstubAllEnvs();delete (globalThis as any).aolmsPool;delete (globalThis as any).aolmsPoolConfig;state.options=[];});
describe('PostgreSQL certificate configuration',()=>{
 it('loads escaped CA newlines with verification enabled',()=>{
  vi.stubEnv('DATABASE_URL','postgresql://test:example@localhost/postgres');
  vi.stubEnv('DATABASE_SSL_CA','certificate\\nline');
  getPool();expect(state.options[0].ssl).toEqual({ca:'certificate\nline',rejectUnauthorized:true});
 });
 it('reuses unchanged pools and replaces stale pools when the CA changes',()=>{
  vi.stubEnv('DATABASE_URL','postgresql://test:example@localhost/postgres');
  vi.stubEnv('DATABASE_SSL_CA','first');const old=getPool();expect(getPool()).toBe(old);
  vi.stubEnv('DATABASE_SSL_CA','second');expect(getPool()).not.toBe(old);expect(old.end).toHaveBeenCalledOnce();expect(state.options[1].ssl.ca).toBe('second');
 });
 it('allows verification to be disabled explicitly without a CA',()=>{
  vi.stubEnv('DATABASE_URL','postgresql://test:example@localhost/postgres');
  vi.stubEnv('DATABASE_SSL_CA',undefined);vi.stubEnv('DATABASE_SSL_REJECT_UNAUTHORIZED','false');
  const old=getPool();expect(state.options[0].ssl).toEqual({rejectUnauthorized:false});
  vi.stubEnv('DATABASE_SSL_REJECT_UNAUTHORIZED','true');
  expect(getPool()).not.toBe(old);expect(old.end).toHaveBeenCalledOnce();expect(state.options[1].ssl.rejectUnauthorized).toBe(true);
 });
});
