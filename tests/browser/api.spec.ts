import {readdirSync} from 'node:fs';
import {test,expect} from '@playwright/test';
test('production Next server serves pages and protected APIs from one origin',async({request})=>{
 const health=await request.get('/api/health');expect(health.status()).toBe(200);expect(await health.json()).toEqual({status:'ok'});
 const login=await request.get('/login');expect(login.status()).toBe(200);expect(await login.text()).toContain('AOLMS');
 expect(login.headers()['x-frame-options']).toBe('DENY');
 expect(login.headers()['x-content-type-options']).toBe('nosniff');
 expect((await request.get('/api/cron/sheets')).status()).toBe(401);
 for(const path of ['/api/projects','/api/profiles','/api/equipment/ont','/api/staff','/api/assurance-submissions/audit']){
  const response=await request.get(path);expect(response.status()).toBe(401);expect(await response.json()).toMatchObject({message:'No token provided',statusCode:401});
 }
 expect((await request.post('/api/health')).status()).toBe(405);
});


test('all app pages respond on the production server',async({request})=>{
 const sample='11111111-1111-4111-8111-111111111111';
 const paths=readdirSync('app',{recursive:true,encoding:'utf8'})
  .map(path=>path.replaceAll('\\','/')).filter(path=>path==='page.tsx'||path.endsWith('/page.tsx'))
  .map(path=>'/'+path.replace(/(?:^|\/)page\.tsx$/,'').replace(/\[[^\]]+\]/g,sample));
 expect(paths.length).toBeGreaterThan(25);
 for(const path of paths)expect((await request.get(path)).status(),path).toBe(200);
});
