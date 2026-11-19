import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {config} from 'dotenv';
import fs from 'node:fs';
config({path:'.env.local',quiet:true});
const fields=JSON.parse(fs.readFileSync('lib/service-assurance-schema.json','utf8')).fields;
const base=process.env.SPREADSHEET_TEST_URL||'http://127.0.0.1:3187';
const uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',project='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const origin=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
const storage='sb-'+new URL(origin).hostname.split('.')[0]+'-auth-token';
const user={id:uid,email:'test@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const assurance of [false,true]){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  let records=[],calls=[],fail=false,configurations=[];
  const key=assurance?`aolms:service-assurance:v2:${uid}:${project}`:`delivery-sheet:${uid}:${project}`;
  await context.addInitScript(({storage,user})=>{const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600}))+'.test';localStorage.setItem(storage,JSON.stringify({access_token:token,refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user}));},{storage,user});
  await context.route(origin+'/**',route=>route.fulfill({json:route.request().url().includes('/auth/')?user:{...user,role:'controller',is_active:true,full_name:'Test Controller'}}));
  await context.route('**/api/**',async route=>{
   const u=new URL(route.request().url()),path=u.pathname,post=route.request().method()==='POST';let result=[];
   if(path==='/api/sheet-configurations'){
    const method=route.request().method();
    if(method==='POST'){const b=route.request().postDataJSON();if(!b.id&&configurations.length)return route.fulfill({status:409,json:{message:'This project already has a configuration for this month'}});const c={...b,id:b.id||project,version:(b.version||0)+1,project_name:'Service Delivery',month_key:b.month,sync_status:'not_started',pending_changes:0};configurations=[c];result=c;}else if(method==='DELETE'){configurations=[];result={deleted:true};}else result=configurations;
   }else if(path==='/api/projects')result=[{id:project,name:assurance?'Service Assurance':'Service Delivery',code:assurance?'SERVICE_DELIVERY':'SERVICE_ASSURANCE',is_active:true}];
   else if(path==='/api/service-delivery/workflow'||path.startsWith('/api/service-assurance')){
    if(post){const b=route.request().postDataJSON();calls.push(b);if(fail)return route.fulfill({status:503,json:{message:'Temporary test outage'}});const record=assurance?{id:b.id,project_id:project,version:(b.base_version||0)+1,...b.values,spreadsheet_fields:{}}:{id:b.id,project_id:project,version:(b.base_version||0)+1,spreadsheet_fields:{delivery:b.values}};records=[...records.filter(r=>r.id!==b.id),record];result=assurance?{record,draft:{id:b.id,raw_values:b.values,record_version:record.version,version:record.version,state:'record',errors:{}}}:record;}
    else if(path.endsWith('/metadata')||u.searchParams.get('mode')==='metadata')result={fields,technicians:[{id:uid,full_name:'Test Technician'}]};else if(!path.endsWith('/grid'))result=records;
   }
   await route.fulfill({json:result});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/controller/projects');
  const cell=page.locator('[data-cell="0:0"]');await expect(cell).toBeVisible({timeout:60000});
  await expect(page.getByRole('button',{name:/^(Save rows|Submit rows)$/})).toHaveCount(0);
  await cell.click();await page.keyboard.type('2026-10-10');await page.reload();
  await expect.poll(()=>calls.length,{timeout:8000}).toBe(1);
  assert.equal(calls[0].values[assurance?'date':'work_date'],'2026-10-10');
  await expect.poll(()=>page.evaluate(({key,assurance})=>{const c=JSON.parse(localStorage.getItem(key)||(assurance?'{}':'[]'));return assurance?(c.rows||[]).length:c.length;},{key,assurance})).toBe(0);
  fail=true;await page.locator('[data-cell="0:2"]').click();await page.keyboard.type('retained');await page.keyboard.press('Tab');
  await expect.poll(()=>calls.length,{timeout:8000}).toBe(2);
  await expect(page.getByText('Temporary test outage',{exact:false})).toBeVisible();
  assert.ok((await page.evaluate(key=>localStorage.getItem(key),key)).includes('retained'));
  fail=false;
  if(assurance)await page.evaluate(()=>window.dispatchEvent(new Event('online')));else await page.getByRole('button',{name:'Retry save',exact:true}).click();
  await expect.poll(()=>calls.length,{timeout:8000}).toBe(3);assert.equal(calls[1].mutation_id,calls[2].mutation_id);
  await expect(page.getByText('Temporary test outage',{exact:false})).toHaveCount(0);
  const aside=page.locator('#main-sidebar');await page.mouse.move(900,300);await expect(aside).toHaveCSS('width','64px');await aside.hover();await expect(aside).toHaveCSS('width','256px');await page.mouse.move(900,300);await expect(aside).toHaveCSS('width','64px');
  await page.setViewportSize({width:390,height:844});await expect(aside).toHaveCSS('width','64px');await aside.getByRole('button',{name:'Expand sidebar'}).click();await expect(aside).toHaveCSS('width','256px');await page.getByRole('button',{name:'Close sidebar',exact:true}).click({position:{x:375,y:400}});await expect(aside).toHaveCSS('width','64px');
  if(!assurance){
   await page.goto(base+'/controller/configuration');await expect(page.getByRole('heading',{name:'Configuration',exact:true,level:1})).toBeVisible();
   await page.getByLabel('Month',{exact:true}).fill('2026-10');await page.getByLabel('Google Sheet URL',{exact:true}).fill('https://docs.google.com/spreadsheets/d/test/edit');await page.getByLabel('Sheet/Tab Name',{exact:true}).fill('October');await page.getByRole('button',{name:'Add configuration',exact:true}).click();await expect(page.getByRole('cell',{name:'October',exact:true})).toBeVisible();
   await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByLabel('Sheet/Tab Name',{exact:true}).fill('October renamed');await page.getByRole('button',{name:'Update configuration',exact:true}).click();await expect(page.getByRole('cell',{name:'October renamed',exact:true})).toBeVisible();
   page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Delete',exact:true}).click();await expect(page.getByText('No configurations yet for Service Delivery.',{exact:true})).toBeVisible();assert.equal(records.length,1);console.log('Configuration: add, edit and remove UI passed; operational records retained');
  }
  assert.deepEqual(errors,[]);await context.close();console.log((assurance?'Service Assurance':'Service Delivery')+': autosave, failed-save recovery, cache reconciliation, responsive sidebar passed');
 }
}finally{await browser.close();}
