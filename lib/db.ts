import 'server-only';
import { Pool, type PoolClient } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import {createHash} from 'node:crypto';

const globalDb=globalThis as typeof globalThis & {aolmsPool?:Pool;aolmsPoolConfig?:string};
export function getPool(){
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
 const ca=process.env.DATABASE_SSL_CA?.replace(/\\n/g,'\n');
 const rejectUnauthorized=ca?true:process.env.DATABASE_SSL_REJECT_UNAUTHORIZED!=='false';
 const config=createHash('sha256').update(JSON.stringify([process.env.DATABASE_URL,ca,rejectUnauthorized,process.env.DATABASE_POOL_MAX])).digest('hex');
 if(!globalDb.aolmsPool||globalDb.aolmsPoolConfig!==config){
  const previous=globalDb.aolmsPool;
  globalDb.aolmsPool=new Pool({connectionString:process.env.DATABASE_URL,max:Number(process.env.DATABASE_POOL_MAX||4),idleTimeoutMillis:5000,connectionTimeoutMillis:15000,
   ssl:{...(ca?{ca}:{}),rejectUnauthorized}});
  globalDb.aolmsPoolConfig=config;
  attachDatabasePool(globalDb.aolmsPool);
  globalDb.aolmsPool.on('error',error=>console.error('Idle database connection failed',error.message));
  if(previous)void previous.end().catch(()=>console.error('Previous database pool could not close cleanly'));
 }
 return globalDb.aolmsPool;
}
export class Database {
 constructor(private client?:PoolClient){}
 async query(sql:string,values?:any[]):Promise<any[]>{return (await (this.client||getPool()).query(sql,values)).rows;}
 async transaction<T>(work:(db:Database)=>Promise<T>):Promise<T>{
  const client=await getPool().connect();
  try{await client.query('BEGIN');const result=await work(new Database(client));await client.query('COMMIT');return result;}
  catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
}
export const db=new Database();
