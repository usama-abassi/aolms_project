import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {config} from 'dotenv';
config({path:'.env.local',quiet:true});
const base=process.env.SPREADSHEET_TEST_URL||'http://localhost:3000';
const uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',project='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const origin=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
const storage='sb-'+new URL(origin).hostname.split('.')[0]+'-auth-token';
const user={id:uid,email:'test@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const role of ['admin','controller','technician'].filter(role=>!process.argv[2]||role===process.argv[2])){
  const context=await browser.newContext({viewport:{width:1366,height:900}});
  const profile={...user,full_name:'Test User',role,is_active:true,employee_code:'T1'};
  const projects=[{id:project,name:'Service Delivery',code:'SERVICE_ASSURANCE',is_active:true},{id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',name:'Service Assurance',code:'SERVICE_DELIVERY',is_active:true}];
  let configs=[{id:'oct',project_id:project,project_name:'Service Delivery',month_key:'2026-10',sheet_url:'https://docs.google.com/spreadsheets/d/oct/edit',tab_name:'October',version:1,sync_status:'success',pending_changes:0,last_success_at:'2026-10-31T10:00:00Z'},{id:'nov',project_id:project,project_name:'Service Delivery',month_key:'2026-11',sheet_url:'https://docs.google.com/spreadsheets/d/nov/edit',tab_name:'November',version:1,sync_status:'not_started',pending_changes:0},{id:'sa',project_id:projects[1].id,project_name:'Service Assurance',month_key:'2026-10',sheet_url:'https://docs.google.com/spreadsheets/d/sa/edit',tab_name:'Assurance October',version:1,sync_status:'success',pending_changes:2}];
  let mutations=0,profileFailure=false;
  await context.addInitScript(({storage,user})=>{const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600}))+'.test';localStorage.setItem(storage,JSON.stringify({access_token:token,refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user}));},{storage,user});
  await context.route(origin+'/**',route=>{const url=new URL(route.request().url());if(profileFailure&&url.pathname.includes('/profiles')&&url.searchParams.get('select')==='*'&&url.searchParams.has('id'))return route.fulfill({status:403,json:{message:'Test profile unavailable'}});return route.fulfill({json:url.pathname.includes('/auth/')?user:url.pathname.includes('/profiles')?(url.searchParams.has('id')?profile:[profile]):[]});});
  await context.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname,method=route.request().method();let result=[];
   if(path==='/api/projects')result=projects;
   else if(path==='/api/sheet-configurations'){
    if(method==='POST'){mutations++;const b=route.request().postDataJSON();if(configs.some(c=>c.project_id===b.project_id&&c.month_key===b.month&&c.id!==b.id))return route.fulfill({status:409,json:{message:'Duplicate'}});const c={...b,id:b.id||'new',month_key:b.month,version:(b.version||0)+1,sync_status:'not_started'};configs=[...configs.filter(c=>c.id!==b.id),c];result=c;}
    else if(method==='DELETE'){mutations++;const b=route.request().postDataJSON();configs=configs.filter(c=>c.id!==b.id);result={deleted:true};}else result=configs;
   }
   await route.fulfill({json:result});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+(role==='admin'?'/admin/profiles':role==='controller'?'/controller/configuration':'/technician/todo'));
  const aside=page.locator('#main-sidebar');await expect(aside).toBeVisible({timeout:60000});
  const links=aside.locator('nav a');const count=await links.count();assert.ok(count>0);
  for(let i=0;i<count;i++){
   const link=links.nth(i);await aside.hover();await expect(aside).toHaveCSS('width','256px');
   // Exercise each real sidebar click handler without loading unrelated workflows.
   await link.evaluate(el=>el.addEventListener('click',e=>e.preventDefault(),{once:true}));await link.click();await page.mouse.move(1100,400);await expect(aside).toHaveCSS('width','64px');
  }
  // Keyboard access remains available without treating pointer focus as keyboard focus.
  await page.keyboard.press('Tab');await aside.locator('nav a').first().focus();await expect(aside).toHaveCSS('width','256px');await page.locator('main').click({position:{x:500,y:10}});await page.mouse.move(1100,400);await expect(aside).toHaveCSS('width','64px');
  if(role==='admin'){
   await page.getByRole('button',{name:'Account: Test User'}).click();await page.getByRole('button',{name:'Profile',exact:true}).click();await expect(page).toHaveURL(/admin\/profile\/me$/);await expect(page.getByRole('heading',{name:'My Profile',level:1})).toBeVisible();await page.mouse.move(1100,400);await expect(aside).toHaveCSS('width','64px');
   await page.getByRole('button',{name:'Account: Test User'}).click();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Sign out',exact:true})).toHaveCount(0);
   profileFailure=true;await page.reload();await expect(page.getByText('User profile not found',{exact:true})).toBeVisible();profileFailure=false;
  }
  if(role==='controller'){
   const tab=name=>page.getByRole('tab',{name,exact:true});
   await expect(tab('Service Delivery')).toHaveAttribute('aria-selected','true');await expect(page.getByRole('cell',{name:'October',exact:true})).toBeVisible();await expect(page.getByRole('cell',{name:'November',exact:true})).toBeVisible();await expect(page.getByRole('cell',{name:'Assurance October',exact:true})).toHaveCount(0);
   await tab('Service Assurance').click();await expect(page.getByRole('cell',{name:'Assurance October',exact:true})).toBeVisible();await expect(page.getByRole('cell',{name:'November',exact:true})).toHaveCount(0);assert.equal(configs.length,3);
   await tab('Service Assurance').press('ArrowLeft');await expect(tab('Service Delivery')).toHaveAttribute('aria-selected','true');
   const fill=async(month,name)=>{await page.getByLabel('Month',{exact:true}).fill(month);await page.getByLabel('Google Sheet URL',{exact:true}).fill('https://docs.google.com/spreadsheets/d/test/edit');await page.getByLabel('Sheet/Tab Name',{exact:true}).fill(name);};
   await fill('2026-10','Duplicate');await page.getByRole('button',{name:'Add configuration',exact:true}).click();await expect(page.locator('main').getByRole('alert')).toContainText('already has');assert.equal(mutations,0);
   await fill('2026-12','December');await page.getByRole('button',{name:'Add configuration',exact:true}).click();await expect(page.getByRole('cell',{name:'December',exact:true})).toBeVisible();assert.equal(configs.at(-1).project_id,project);
   const row=page.getByRole('row').filter({has:page.getByRole('cell',{name:'December',exact:true})});await row.getByRole('button',{name:'Edit',exact:true}).click();await page.getByLabel('Sheet/Tab Name',{exact:true}).fill('December edited');await page.getByRole('button',{name:'Update configuration'}).click();await expect(page.getByRole('cell',{name:'December edited',exact:true})).toBeVisible();
   const edited=page.getByRole('row').filter({has:page.getByRole('cell',{name:'December edited',exact:true})});page.once('dialog',d=>d.accept());await edited.getByRole('button',{name:'Delete',exact:true}).click();await expect(page.getByRole('cell',{name:'December edited',exact:true})).toHaveCount(0);assert.equal(configs.length,3);
   await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await expect(page.getByLabel('Google Sheet URL',{exact:true})).toBeVisible();
   await page.screenshot({path:'test-results/configuration-project-tabs-mobile.png',fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});await expect(aside).toHaveCSS('width','64px');await aside.getByRole('button',{name:'Expand sidebar'}).click();await expect(aside).toHaveCSS('width','256px');
  await links.first().evaluate(el=>el.addEventListener('click',e=>e.preventDefault(),{once:true}));await links.first().click();await expect(aside).toHaveCSS('width','64px');
  assert.deepEqual(errors,[]);console.log(`${role}: ${count} sidebar links, keyboard/mobile interactions${role==='admin'?', actual Profile navigation and Escape menu close':''}${role==='controller'?', project tabs, retained configurations, duplicates, monthly CRUD and mobile layout':''} passed`);await context.close();
 }
}finally{await browser.close();}
