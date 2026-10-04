import {beforeEach,describe,it,expect,vi} from 'vitest';
const mock=vi.hoisted(()=>({role:'controller',active:true,valid:true}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({
 auth:{getUser:async()=>({data:{user:mock.valid?{id:'verified-user',email:'test@example.invalid',user_metadata:{role:'admin'}}:null},error:null})},
 from:()=>({select:()=>({eq:()=>({single:async()=>({data:{role:mock.role,is_active:mock.active},error:null})})})})
})}));
import {authenticate} from '@/lib/auth';
import {GET as health} from '@/app/api/health/route';
import inventory from '@/docs/api-route-inventory.json';
const handlers=import.meta.glob('../../app/api/**/route.ts',{eager:true}) as Record<string,Record<string,Function>>;

beforeEach(()=>{mock.role='controller';mock.active=true;mock.valid=true;process.env.NEXT_PUBLIC_SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_SECRET_KEY='test-only';});
describe('API compatibility and authorization',()=>{
 it('protects both grid endpoints before parsing or accessing data',async()=>{
  const grid=handlers['../../app/api/assurance-tickets/grid/route.ts'];
  for(const method of ['GET','POST']){
   const unauth=await grid[method](new Request('http://test/api/assurance-tickets/grid',{method}),{});
   expect(unauth.status).toBe(401);
   mock.role='technician';
   const denied=await grid[method](new Request('http://test/api/assurance-tickets/grid',{method,headers:{authorization:'Bearer test'}}),{});
   expect(denied.status).toBe(403);
  }
 });
 it('keeps every original route method with authorization before body parsing or database access',async()=>{
  for(const route of inventory){
   const file=`../../app/api/${route.route?route.route+'/':''}route.ts`;
   const handler=handlers[file]?.[route.method];expect(handler,`${route.method} ${route.route}`).toBeTypeOf('function');
   if(!route.roles.length)continue;
   const response=await handler(new Request('http://test/api/'+route.route,{method:route.method}),{params:Promise.resolve({id:'invalid',kind:'ont'})});
   expect(response.status,`${route.method} ${route.route}`).toBe(401);
   expect(await response.json()).toEqual({message:'No token provided',error:'Unauthorized',statusCode:401});
  }
 });
 it('has a public health check without database credentials',async()=>{expect(await health().json()).toEqual({status:'ok'});});
 it('uses the database role rather than mutable JWT metadata',async()=>{
  mock.role='technician';await expect(authenticate(new Request('http://test',{headers:{authorization:'Bearer test'}}),['admin','controller'])).rejects.toMatchObject({status:403});
 });
 it('passes verified identity to authorized controllers',async()=>{
  expect(await authenticate(new Request('http://test',{headers:{authorization:'Bearer test'}}),['admin','controller'])).toMatchObject({userId:'verified-user',role:'controller'});
 });
 it('rejects inactive users and invalid tokens',async()=>{
  const request=new Request('http://test',{headers:{authorization:'Bearer test'}});
  mock.active=false;await expect(authenticate(request,['controller'])).rejects.toMatchObject({status:403});
  mock.active=true;mock.valid=false;await expect(authenticate(request,['controller'])).rejects.toMatchObject({status:401});
 });
 it('denies technician access to equipment and Audit route handlers',async()=>{
  mock.role='technician';
  for(const file of ['equipment/[kind]','project-audit/[id]','assurance-submissions/audit','material-inventory/[projectId]','assurance-tickets/grid']){
   const response=await handlers[`../../app/api/${file}/route.ts`].GET(new Request('http://test/api/'+file,{headers:{authorization:'Bearer test'}}),{params:Promise.resolve({id:'invalid',kind:'ont'})});expect(response.status).toBe(403);
  }
 });
});
