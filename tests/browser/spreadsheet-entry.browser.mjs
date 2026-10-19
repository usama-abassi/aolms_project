import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {config} from 'dotenv';
import fs from 'node:fs'
const serviceAssuranceFields=JSON.parse(fs.readFileSync('lib/service-assurance-schema.json','utf8')).fields

config({path:'.env.local',quiet:true});
const base=process.env.SPREADSHEET_TEST_URL||'http://localhost:3000';
const uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',project='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const origin=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
const storage='sb-'+new URL(origin).hostname.split('.')[0]+'-auth-token';
const user={id:uid,email:'test@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const assurance of [false,true]){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const name=assurance?'Service Assurance':'Service Delivery',key=assurance?`aolms:service-assurance:v2:${uid}:${project}`:`delivery-sheet:${uid}:${project}`;
  let records=[],calls=[],conflict=false;
  await context.addInitScript(({storage,user})=>{
   const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600}))+'.test';
   localStorage.setItem(storage,JSON.stringify({access_token:token,refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user}));
  },{storage,user});
  await context.route(origin+'/**',route=>route.fulfill({json:route.request().url().includes('/auth/')?user:{...user,role:'controller',is_active:true,full_name:'Test Controller'}}));
  await context.route('**/api/**',async route=>{
   const u=new URL(route.request().url()),path=u.pathname,post=route.request().method()==='POST';let result=[];
   if(path==='/api/projects')result=[{id:project,name,code:assurance?'SERVICE_DELIVERY':'SERVICE_ASSURANCE',is_active:true}];
   else if(path==='/api/service-delivery/workflow'||path.startsWith('/api/service-assurance')){
    if(post){
     const b=route.request().postDataJSON();calls.push(b);
     if(conflict)return route.fulfill({status:409,json:{message:'Changed by another user'}});
     const record=assurance?{id:b.id,project_id:project,version:(b.base_version||0)+1,...b.values,spreadsheet_fields:{}}:{id:b.id,version:(b.base_version||0)+1,spreadsheet_fields:{delivery:b.values}};
     records=[...records.filter(r=>r.id!==b.id),record];
     result=assurance?{record,draft:{id:b.id,raw_values:b.values,record_version:record.version,version:1,state:'record',errors:{}}}:record;
    }else if(path.endsWith('/metadata')||u.searchParams.get('mode')==='metadata')result={fields:serviceAssuranceFields,technicians:[{id:uid,full_name:'Test Technician'}]};
    else if(path.endsWith('/grid'))result=[];
    else result=records;
   }
   await route.fulfill({json:result});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const cell=(r,c)=>page.locator(`[data-cell="${r}:${c}"]`);
  const save=()=>page.getByRole('button',{name:assurance?'Submit rows':'Save rows',exact:true});
  const add=()=>page.getByRole('button',{name:assurance?'Add row':'Add order',exact:true});
  const cacheRows=()=>page.evaluate(({key,assurance})=>{const cached=JSON.parse(localStorage.getItem(key)|| (assurance?'{}':'[]'));return assurance?cached.rows||[]:cached;},{key,assurance});
  await page.goto(base+'/controller/projects');await expect(cell(0,0)).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(1);assert.equal((await cacheRows()).length,0);assert.equal(calls.length,0);
  await add().click();await expect(cell(0,0)).toBeFocused();await add().click();await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.keyboard.type('first');await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.keyboard.press('ArrowRight');await expect(cell(0,1)).toBeFocused();await expect(cell(0,0)).toHaveValue('first');
  assert.equal(calls.length,0);assert.equal((await cacheRows()).length,1);
  // Team retains native selection (mouse/Alt+Down); arrows and Tab navigate the grid.
  await cell(0,1).selectOption(uid);await cell(0,1).press('ArrowDown');await expect(cell(1,1)).toBeFocused();
  await cell(1,1).press('ArrowUp');await expect(cell(0,1)).toBeFocused();
  await cell(0,1).press('Tab');await expect(cell(0,2)).toBeFocused();
  await page.keyboard.type('right');await page.keyboard.press('ArrowRight');await expect(cell(0,3)).toBeFocused();
  await page.keyboard.type('left');await page.keyboard.press('ArrowLeft');await expect(cell(0,2)).toBeFocused();
  await page.keyboard.type('down');await page.keyboard.press('ArrowDown');await expect(cell(1,2)).toBeFocused();
  await page.keyboard.type('up');await expect(page.locator('tbody tr')).toHaveCount(3);await page.keyboard.press('ArrowUp');await expect(cell(0,2)).toBeFocused();
  await page.keyboard.press('ArrowRight');await page.keyboard.type('fast-right');await page.keyboard.press('ArrowLeft');await page.keyboard.type('down');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowLeft');
  await expect(cell(0,3)).toHaveValue('fast-right');await expect(cell(0,2)).toHaveValue('down');
  // F2 and double click preserve text; arrow keys move the caret in both directions.
  await cell(0,2).press('F2');await page.keyboard.press('ArrowLeft');await expect(cell(0,2)).toBeFocused();
  assert.equal(await cell(0,2).evaluate(el=>el.selectionStart),3);
  await page.keyboard.press('ArrowRight');assert.equal(await cell(0,2).evaluate(el=>el.selectionStart),4);
  await page.keyboard.type('X');await page.keyboard.press('Escape');await expect(cell(0,2)).toHaveValue('down');
  await cell(0,2).dblclick();await page.keyboard.press('Alt+Enter');await page.keyboard.type('line');await page.keyboard.press('ArrowUp');await expect(cell(0,2)).toBeFocused();
  await page.keyboard.press('Enter');await expect(cell(1,2)).toBeFocused();await expect(cell(0,2)).toHaveValue('down\nline');
  await page.keyboard.press('Shift+Enter');await expect(cell(0,2)).toBeFocused();
  await page.keyboard.press('Shift+Tab');await expect(cell(0,1)).toBeFocused();
  // Clear a new row; its draft and extra placeholder disappear without a request.
  await cell(1,2).click();await page.keyboard.press('Delete');await expect(page.locator('tbody tr')).toHaveCount(2);
  assert.equal((await cacheRows()).length,1);assert.equal(calls.length,0);
  await cell(1,0).click();await page.keyboard.type('cancel-me');await expect(page.locator('tbody tr')).toHaveCount(3);
  await page.keyboard.press('Escape');await expect(page.locator('tbody tr')).toHaveCount(2);assert.equal((await cacheRows()).length,1);
  await cell(1,0).press('Control+;');await expect(cell(1,0)).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);await page.keyboard.press('Escape');
  // Dispatch a real plain-text clipboard event without depending on OS clipboard permissions.
  await cell(1,0).evaluate(el=>{const data=new DataTransfer();data.setData('text/plain','pasted');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});
  await cell(1,0).press('ArrowDown');await expect(cell(2,0)).toBeFocused();await expect(cell(1,0)).toHaveValue('pasted');
  await cell(1,0).click();await page.keyboard.press('Delete');await expect(page.locator('tbody tr')).toHaveCount(2);assert.equal((await cacheRows()).length,1);
  await page.reload();await expect(cell(0,0)).toHaveValue('first');await expect(page.locator('tbody tr')).toHaveCount(2);
  await save().click();await expect.poll(()=>calls.length).toBe(1);await expect(page.getByText(assurance?'All committed changes saved':'0 unsaved',{exact:true})).toBeVisible();
  assert.equal(calls[0].values.date||calls[0].values.work_date,'first');await expect(page.locator('tbody tr')).toHaveCount(2);
  // Save failures retain draft text and the existing review controls.
  conflict=true;await cell(0,2).click();await page.keyboard.type('conflict');await page.keyboard.press('Tab');await save().click();
  await expect(page.getByRole('button',{name:assurance?'Review draft':'Review latest',exact:true})).toBeVisible();
  await page.getByRole('button',{name:assurance?'Review draft':'Review latest',exact:true}).click();
  await expect(page.getByText('Your draft',{exact:true})).toBeVisible();
  if(assurance)await page.getByRole('button',{name:'Close review',exact:true}).click();else await page.getByRole('button',{name:'Keep draft against reviewed version',exact:true}).click();
  conflict=false;
  // Uncommitted text in a new placeholder survives reload, but an untouched one does not.
  await add().click();await page.keyboard.type('recover-me');await page.reload();
  if(assurance){await page.getByRole('button',{name:'Restore uncommitted text',exact:true}).click();}
  await expect(cell(1,0)).toHaveValue('recover-me');await expect(page.locator('tbody tr')).toHaveCount(3);
  await cell(1,0).click();await page.keyboard.press('Delete');await expect(page.locator('tbody tr')).toHaveCount(2);
  // At 25 records the placeholder stays on page 1; committing row 26 navigates to page 2.
  records=Array.from({length:25},(_,i)=>assurance?{id:`row-${i}`,project_id:project,version:1,date:`date-${i}`,ticket_number:`ticket-${i}`,spreadsheet_fields:{}}:{id:`row-${i}`,version:1,spreadsheet_fields:{delivery:{work_date:`date-${i}`,ticket_number:`ticket-${i}`}}});
  await page.evaluate(key=>{localStorage.removeItem(key);localStorage.removeItem(key+':editing');},key);await page.reload();
  await expect(cell(25,0)).toBeVisible();await expect(page.locator('tbody tr')).toHaveCount(26);
  await expect(page.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
  await cell(25,0).click();await page.keyboard.type('row26');await page.keyboard.press('ArrowDown');
  await expect(cell(26,0)).toBeFocused();await expect(cell(25,0)).toHaveValue('row26');await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.keyboard.press('ArrowUp');await expect(cell(25,0)).toBeFocused();await page.keyboard.press('ArrowUp');await expect(cell(24,0)).toBeFocused();
  await add().click();await expect(cell(26,0)).toBeFocused();
  if(!assurance){
   await page.getByLabel('Search orders',{exact:true}).fill('no-match');
   await expect(page.locator('tbody tr')).toHaveCount(2); // Current unsaved order plus placeholder.
   await add().click();await page.keyboard.type('filtered-entry');await page.keyboard.press('ArrowDown');
   await expect(cell(2,0)).toBeFocused();await expect(page.locator('tbody tr')).toHaveCount(3);
  }
  assert.deepEqual(errors,[]);console.log(`PASS ${name}: placeholders, draft recovery, explicit save, conflicts, editing modes, navigation, pagination${assurance?'':', filters'}`);
  await context.close();
 }
}finally{await browser.close();}
