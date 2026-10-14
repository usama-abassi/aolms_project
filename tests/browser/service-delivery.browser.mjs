import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import XLSX from 'xlsx';
import fs from 'node:fs';
dotenv.config({path:'.env.local',quiet:true});
const base=process.env.DELIVERY_TEST_URL||'http://localhost:3000';
const uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',project='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL),storage='sb-'+url.hostname.split('.')[0]+'-auth-token';
const user={id:uid,email:'test@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
const browser=await chromium.launch({channel:'msedge',headless:true});
let rows=[],savedOrders=[],formCalls=[],role='controller';
const ready={id,order:{ticket_number:'1001',work_date:'2026-10-14',actioned:'Delivered',order_type:'External',connection_type:'Home Connect',nce_sn:''},technician:'Test Technician',submission:{id,submitted_at:new Date().toISOString()},response:{E:'External',G:'Home Connect'},submitted:true,orderType:'Correct',closeType:'Correct',ontStatus:'Not applicable',poNumber:'',material:null,issues:[],mappingIssues:[],ready:true,internalOrderType:'External',externalOrderType:'External'};
let audits=[ready,{...ready,id:project,order:{...ready.order,ticket_number:'1002'},response:{E:'Internal',G:'Home Connect'},orderType:'Issue',issues:['Order Type Issue'],ready:false},{...ready,id:uid,order:{...ready.order,ticket_number:'1003'},submitted:false,submission:null,response:{},orderType:'Pending Submission',closeType:'Pending Submission',issues:['Pending Submission'],ready:false}];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 await context.addInitScript(({storage,user})=>{const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600}))+'.test';localStorage.setItem(storage,JSON.stringify({access_token:token,refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user}));},{storage,user});
 await context.route(url.origin+'/**',route=>route.fulfill({json:route.request().url().includes('/auth/')?user:{...user,role,is_active:true,full_name:'Test Technician'}}));
 await context.route('**/api/**',async route=>{const u=new URL(route.request().url()),path=u.pathname,method=route.request().method();let result=[];
 if(path==='/api/projects')result=[{id:project,name:'Service Delivery',code:'SERVICE_ASSURANCE',is_active:true}];
 else if(path==='/api/service-delivery/workflow'){
  if(method==='POST'){const b=route.request().postDataJSON();savedOrders.push(b);const row={id:b.id,version:1,spreadsheet_fields:{delivery:b.values}};rows=[row];result=row;}
  else if(u.searchParams.get('mode')==='metadata')result={technicians:[{id:uid,full_name:'Test Technician'}]};
  else if(u.searchParams.get('mode')==='audit')result=audits;
  else result=rows;
 }else if(path.startsWith('/api/service-delivery/workflow/')){
  if(method==='PATCH'){const b=route.request().postDataJSON();assert.equal(b.source,'technician');assert.equal(b.previous,'Internal');audits=audits.map(r=>r.id===project?{...r,response:{...r.response,E:b.value},orderType:'Correct',issues:[],ready:true}:r);result={};}
  else if(method==='POST'){const b=route.request().postDataJSON();formCalls.push(b);result={id,version:formCalls.length,status:b.intent==='submit'?'submitted':'draft',submitted_at:b.intent==='submit'?new Date().toISOString():null};}
  else if(u.searchParams.get('mode')==='history')result=[{id,created_at:new Date().toISOString(),modified_by:'Controller',table_name:'assurance_submissions',old_values:{value:'Internal'},new_values:{field:'order_type',value:'External'}}];
  else result={ticket:{id,ticket_number:'1001'},submission:null,can_edit:true,values:{B:'test@example.invalid',C:'Test Technician',D:'1001',E:'External',F:'Package',G:'Home Connect',BN:'Customer Existing ONT'}};
 }else if(path.includes('/assurance-submissions/tasks'))result={rows:[],counts:{pending:0,completed:0}};
 await route.fulfill({json:result});});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/controller/projects');await page.getByRole('button',{name:'Add order',exact:true}).click();
 assert.equal(await page.locator('thead th').count(),45);
 for(const [label,value]of [['Date row 1','2026-10-14'],['Order row 1','1001'],['Actioned row 1','Delivered']]){const cell=page.getByLabel(label,{exact:true});await cell.dblclick();await cell.fill(value);await cell.press('Tab');}
 await page.getByLabel('Team row 1',{exact:true}).selectOption(uid);await page.getByRole('button',{name:'Save rows',exact:true}).click();await page.waitForFunction(()=>document.body.textContent.includes('0 unsaved'));assert.equal(savedOrders.length,1);assert.equal(savedOrders[0].values.technician_id,uid);assert.equal(Object.keys(savedOrders[0].values).length,44);
 console.log('PASS Controller columns, dynamic Team and save');
 await page.goto(base+'/controller/audit');await page.getByRole('button',{name:/Total Orders\s*3/}).waitFor();assert.equal(await page.locator('tbody tr').count(),3);await page.getByRole('button',{name:/^Submitted\s*2$/}).click();assert.equal(await page.locator('tbody tr').count(),2);await page.getByRole('button',{name:'Issue: 1',exact:true}).click();assert.equal(await page.locator('tbody tr').count(),1);await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByLabel('Source',{exact:true}).selectOption('technician');await page.getByLabel('Corrected value',{exact:true}).fill('External');await page.getByRole('button',{name:'Save correction',exact:true}).click();await page.getByRole('button',{name:'Clear filters',exact:true}).click();await page.getByRole('button',{name:'Export ready records (2)',exact:true}).waitFor();
 console.log('PASS Audit counts, combined filters and correction revalidation');
 await page.getByRole('button',{name:'Delivery preview',exact:true}).click();assert.equal(await page.locator('thead th').count(),76);const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export ready records (2)',exact:true}).click();const download=await downloadPromise;const sheet=XLSX.read(fs.readFileSync(await download.path())).Sheets.Delivery;assert.equal(sheet['!ref'],'A1:BW6');assert.equal(sheet.D5.v,'External');
 console.log('PASS Preview and Excel download excludes pending record');
 role='technician';await page.goto(base+'/technician/assurance-form/'+id);await page.getByRole('heading',{name:'Service Delivery Form · 1001'}).waitFor();assert.equal(await page.locator('fieldset input').count(),74);await page.getByLabel('Patch Chord HC (1000172)',{exact:true}).fill('3');await page.waitForTimeout(2500);assert.equal(formCalls.at(-1).intent,'draft');assert.equal(formCalls.at(-1).values.BR,'3');await page.getByRole('button',{name:'Submit',exact:true}).click();await page.getByText('Submitted successfully',{exact:true}).waitFor();assert.equal(formCalls.at(-1).intent,'submit');console.log('PASS Technician field order, material totals, autosave and Submit');
 assert.deepEqual(errors,[]);await context.close();
}finally{await browser.close();}
