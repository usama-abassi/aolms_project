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
