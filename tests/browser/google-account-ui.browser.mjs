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
 const context=await browser.newContext({viewport:{width:1366,height:900}});
 const profile={...user,role:'controller',is_active:true,full_name:'Test User'};
 let ready=true,connected=false,removed=0,starts=0;
 const configurations=[{id:'existing',project_id:project,project_name:'Service Delivery',month_key:'2026-10',sheet_url:'https://docs.google.com/spreadsheets/d/test/edit',tab_name:'October',version:1,sync_status:'success',pending_changes:0}];
 await context.addInitScript(({storage,user})=>{const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600}))+'.test';localStorage.setItem(storage,JSON.stringify({access_token:token,refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user}));},{storage,user});
 await context.route(origin+'/**',route=>route.fulfill({json:route.request().url().includes('/auth/')?user:profile}));
 await context.route('https://accounts.google.com/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Mock Google consent screen</h1>'}));
 await context.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname,method=route.request().method();let result=[];
  if(path==='/api/projects')result=[{id:project,name:'Service Delivery',code:'SERVICE_ASSURANCE'},{id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',name:'Service Assurance',code:'SERVICE_DELIVERY'}];
  else if(path==='/api/sheet-configurations')result=configurations;
  else if(path==='/api/google-account/connect'){starts++;result={url:'https://accounts.google.com/o/oauth2/v2/auth?client_id=mock'};}
  else if(path==='/api/google-account'){if(method==='DELETE'){removed++;connected=false;result={removed:true,revoked:true};}else result={ready,connected,email:connected?'my-google@example.com':null,connected_at:'2026-11-01T00:00:00Z',can_remove:connected,service_account_active:false};}
  return route.fulfill({json:result});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/controller/configuration');await expect(page.getByRole('tab',{name:'Service Delivery',exact:true})).toHaveAttribute('aria-selected','true');
 const tabs=page.getByRole('tab');await expect(tabs.last()).toHaveText('Google Account');
 await page.getByRole('tab',{name:'Google Account',exact:true}).click();await expect(page.getByRole('button',{name:'Connect Google account',exact:true})).toBeEnabled();await expect(page.getByRole('table')).toHaveCount(0);
 await page.getByRole('button',{name:'Connect Google account',exact:true}).click();await expect(page).toHaveURL(/accounts.google.com/);assert.equal(starts,1);
 connected=true;await page.goto(base+'/controller/configuration?google=connected');await expect(page.getByRole('tab',{name:'Google Account',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.getByText('my-google@example.com',{exact:true})).toBeVisible();await expect(page.getByText('Google account connected.',{exact:true})).toBeVisible();
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Remove account',exact:true}).click();assert.equal(removed,0);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Remove account',exact:true}).click();await expect(page.getByRole('button',{name:'Connect Google account',exact:true})).toBeEnabled();await expect(page.getByText('my-google@example.com',{exact:true})).toHaveCount(0);assert.equal(removed,1);
 await page.getByRole('tab',{name:'Service Delivery',exact:true}).click();await expect(page.getByRole('cell',{name:'October',exact:true})).toBeVisible();assert.equal(configurations.length,1);
 await page.getByRole('tab',{name:'Google Account',exact:true}).click();await page.getByRole('button',{name:'Connect Google account',exact:true}).click();await expect(page).toHaveURL(/accounts.google.com/);assert.equal(starts,2);
 ready=false;await page.goto(base+'/controller/configuration?google=cancelled');await expect(page.getByText('Google authorization was cancelled. Your existing settings were retained.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Connect Google account',exact:true})).toBeDisabled();
 await page.setViewportSize({width:390,height:844});await page.getByRole('tab',{name:'Google Account',exact:true}).scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'test-results/google-account-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('Google Account UI: last tab, consent navigation, callback selection, connected email, remove cancellation/removal, reconnect, retained configurations, missing setup and mobile layout passed');await context.close();
}finally{await browser.close();}
