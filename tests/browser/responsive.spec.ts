import { test, expect, type Page } from '@playwright/test';

const uid = '11111111-1111-4111-8111-111111111111';
const ticketId = '22222222-2222-4222-8222-222222222222';
const orderId = '33333333-3333-4333-8333-333333333333';
const projectId = '44444444-4444-4444-8444-444444444444';
const project = { id: projectId, name: 'Service Delivery', code: 'SERVICE_ASSURANCE', display_order: 1, is_active: true };
const profile = { id: uid, full_name: 'Test Technician', email: 'test@example.invalid', employee_code: 'TEST-01', is_active: true, created_at: new Date().toISOString() };

async function fixtures(page: Page, role: string, theme: string) {
  const user = { id: uid, email: profile.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: profile.created_at };
  await page.addInitScript(({ user, theme }) => {
    localStorage.setItem('theme', theme);
    const token = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) + '.' + btoa(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now()/1000)+3600 })) + '.test';
    localStorage.setItem('sb-dmgchmokpdcahbdfrulu-auth-token', JSON.stringify({ access_token: token, refresh_token: 'test', expires_at: Math.floor(Date.now()/1000)+3600, expires_in: 3600, token_type: 'bearer', user }));
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
  }, { user, theme });
  const order = { id: orderId, order_number: 'DEL-1001', technician_id: uid, action: 'Delivered', exchange: 'North Exchange', project_id: projectId, work_date: '2026-09-26' };
  const ticket = { id: ticketId, ticket_number: 'SA-1001', circuit: 'CIRCUIT-1001', work_date: '2026-09-26', exchange: 'North Exchange', service_type: 'Broadband', technician_id: uid, status: 'Resolved', technician_name: profile.full_name, active_assignment: true, completed: false, can_edit: true, submitted_at: null, edit_deadline: null };
  await page.route('https://*.supabase.co/**', async route => {
    const url = new URL(route.request().url());
    const table = url.pathname.split('/').pop();
    let data: unknown = [];
    if (url.pathname.includes('/auth/')) data = user;
    else if (table === 'profiles') data = url.searchParams.has('id') ? { ...profile, role } : [{ ...profile, role: 'technician' }];
    else if (table === 'projects') data = [project];
    else if (table === 'orders') data = url.searchParams.has('id') ? order : [order];
    else if (table === 'delivery_submissions') data = [];
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': '0-0/1' }, body: JSON.stringify(data) });
  });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path === '/api/projects') data = [project];
    else if(path==='/api/assurance-tickets/grid'&&route.request().method()==='POST'){
      const b=route.request().postDataJSON();data={draft:{user_id:uid,id:b.id,project_id:b.project_id,raw_values:b.values,errors:{},version:b.draft_version+1,record_version:b.base_version,state:'draft',mutation_id:b.mutation_id},record:null};
    }
    else if (path.includes('/material-inventory/')) data = {rows:[],history:[]};
    else if (/\/equipment\/.*\/meta$/.test(path)) data = {categories:[{category:'Delivery Assurance',count:1},{category:'Huawei',count:1}],years:['2026','2023']};
    else if (path.includes('/equipment/')) data = {rows:[{id:ticketId,category:path.includes('/ont')?'Huawei':'Delivery Assurance',version:1,source_sheet:'2026 Delivery Assurance',source_row:3,source_year:'2026',data:{serial_number:'485754431E9962B3',model:'Huawei',quantity:1,order_number:'2708459'}}],total:1};
    else if (/assurance-submissions\/(tasks|audit)$/.test(path)) data = { rows: [ticket, { ...ticket, id: orderId, ticket_number: 'SA-1002', completed: true, submitted_at: new Date().toISOString(), edit_deadline: new Date(Date.now()+86400000).toISOString(), submission_technician_id: uid }], counts: { completed: 1, pending: 1 }, server_time: new Date().toISOString() };
    else if (path.endsWith('/save')) data = { id: ticketId, technician_id: uid, version: 1, submitted_at: new Date().toISOString(), status: 'submitted' };
    else if (path.includes('/assurance-submissions/')) data = { ticket, submission: null, can_edit: true, server_time: new Date().toISOString(), options: { root_cause: ['Cable'], resolution: ['Repaired'] } };
    else if (path.endsWith('/metadata')) data = { fields: [{ key: 'ticket_number', label: 'Ticket number', excelColumn: 'A', storage: 'ticket_number', type: 'text' }], technicians: [{ id: uid, full_name: profile.full_name }] };
    else if (path === '/api/staff') data = { data: [], total: 0, page: 1, limit: 100 };
    else if (path === '/api/staff/stats') data = { total: 0, totalStaff: 0, statuses: [], nationalities: [], categories: [], byStatus: [], byNationality: [] };
    else if (path === '/api/logistics') data = {success:true,data:[],allDates:[],selectedDate:''};
    else if (path === '/api/service-delivery/status') data = {success:true,data:{wbsLoaded:true,responseLoaded:true,wbsRecordCount:1,responseRecordCount:1,selectedDate:'2026-01-01',allDates:['2026-01-01']}};
    else if (path.endsWith('/status')) data = { ready: true };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),page.url()).toBe(true);
}

for(const width of [768,1366])test(`shortcuts guide preserves grid focus ${width}`,async({page})=>{
 await fixtures(page,'controller','light');await page.setViewportSize({width,height:900});
 await page.addInitScript(()=>{window.print=()=>{document.body.dataset.printRequested='true';};});
 await page.goto('/controller/projects');
 await page.getByRole('button',{name:'Add row',exact:true}).click();
 const cell=page.getByRole('textbox',{name:'Ticket number, row 1',exact:true});
 await cell.press('F2');await cell.fill('001234');await cell.press('ArrowLeft');
 const cursor=await cell.evaluate((el:HTMLInputElement)=>el.selectionStart);
 await cell.press('Control+/');
 const guide=page.getByRole('dialog',{name:'Shortcuts Guide'});
 await expect(guide).toBeVisible();
 await page.getByLabel('Search shortcuts').fill('Alt+Arrow');
 await expect(guide.getByText('Move left / right between grid cells while editing',{exact:true})).toBeVisible();
 await expect(guide.getByText('Move down / up',{exact:true})).toHaveCount(0);
 await page.keyboard.press('Control+/');await expect(guide).toHaveCount(0);await expect(cell).toBeFocused();
 expect(await cell.evaluate((el:HTMLInputElement)=>el.selectionStart)).toBe(cursor);
 await cell.press('Control+/');await expect(guide).toBeVisible();await page.keyboard.press('Escape');await expect(cell).toBeFocused();
 await page.getByRole('button',{name:'Shortcuts',exact:true}).click();await expect(guide).toBeVisible();
 await page.keyboard.press('Escape');await expect(cell).toBeFocused();
 await page.getByRole('menuitem',{name:'Help',exact:true}).click();await page.getByRole('menuitem',{name:'Keyboard shortcuts'}).click();
 await expect(guide.getByText('Things that work differently here',{exact:true})).toBeVisible();
 await expect(guide.getByText('Not implemented',{exact:true})).toBeVisible();
 await expect(guide.getByRole('button',{name:'Print / Save as PDF'})).toBeVisible();
 await guide.getByRole('button',{name:'Print / Save as PDF'}).click();
 await expect(page.frameLocator('iframe[title="Printable shortcuts guide"]').locator('body')).toHaveAttribute('data-print-requested','true');
 await expect(page.frameLocator('iframe[title="Printable shortcuts guide"]').getByRole('heading',{name:'Quick start, 5 steps'})).toBeAttached();
 await page.getByLabel('Search shortcuts').focus();
 await noOverflow(page);await page.screenshot({path:`test-results/shortcuts-guide-${width}.png`,fullPage:true});
 await page.keyboard.press('Escape');await expect(cell).toBeFocused();await expect(cell).toHaveValue('001234');
 await cell.press('Meta+/');await expect(guide).toBeVisible();await page.keyboard.press('Meta+/');await expect(cell).toBeFocused();
 await expect(page.getByRole('note')).toContainText('Press Ctrl+/');
 await page.getByRole('button',{name:'Dismiss shortcuts tip'}).click();await page.reload();await expect(page.getByRole('note')).toHaveCount(0);
});

for(const theme of ['light','dark'])test(`inventory receipts and project tabs ${theme}`,async({page})=>{
 await fixtures(page,'controller',theme);await page.setViewportSize({width:375,height:850});
 await page.route('**/api/projects',r=>r.fulfill({json:[project,{...project,id:orderId,code:'SERVICE_DELIVERY',name:'Service Assurance'}]}));
 let received=0;
 await page.route('**/api/material-inventory/*',async route=>{
  if(route.request().method()==='POST'){
   const data=route.request().postDataJSON();expect(data.kind).toBe('received');expect(data.quantity).toBe(25.5);expect(data.mutation_id).toBeTruthy();received+=data.quantity;
   await route.fulfill({status:201,json:{id:ticketId}});return;
  }
  await route.fulfill({json:{rows:[{id:ticketId,item_code:'10000276',name:'Outdoor fiber cable',unit:'Meter',opening:100,received,used:0,faulty:0,remaining:100+received}],history:[]}});
 });
 await page.goto('/controller/inventory');
 await expect(page.getByRole('cell',{name:'Outdoor fiber cable',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Add stock',exact:true}).click();
 await page.getByLabel('Quantity (Meter)').fill('25.5');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('Stock entry saved.');
 await expect(page.getByRole('cell',{name:'125.5',exact:true})).toBeVisible();
 await page.getByLabel('Search materials').fill('unknown');await expect(page.getByText('No materials match your search.')).toBeVisible();
 await page.getByLabel('Search materials').fill('');await noOverflow(page);
 await page.screenshot({path:`test-results/inventory-${theme}-mobile.png`,fullPage:true});
 await page.setViewportSize({width:1366,height:900});await noOverflow(page);
 await page.screenshot({path:`test-results/inventory-${theme}-desktop.png`,fullPage:true});
 await page.getByRole('tab',{name:'Service Assurance',exact:true}).click();await expect(page.getByRole('button',{name:'Add stock',exact:true})).toHaveCount(0);
 await page.getByRole('tab',{name:'Service Delivery',exact:true}).click();await expect(page.getByRole('cell',{name:'125.5',exact:true})).toBeVisible();
});

for(const theme of ['light','dark'])test(`project audit workflow ${theme}`,async({page})=>{
 await fixtures(page,'controller',theme);await page.setViewportSize({width:375,height:850});
 const delivery={...project,id:orderId,code:'SERVICE_DELIVERY',name:'Service Assurance'};
 await page.route('**/api/projects',r=>r.fulfill({json:[project,delivery]}));
 await page.route('**/api/project-audit/*',r=>r.fulfill({json:{
  verification:Array.from({length:51},(_,i)=>({date:'2026-09-28',wbsOrder:`ORDER-${i+1}`,wbsType:'New',responseFttrOrderType:'New',wbsConnectionType:'Home Pass',responseConnectionType:'Home Pass',orderMatch:i!==0,typeMatch:i!==0,connectionMatch:true})),
  crossVerification:[{date:'2026-09-28',orderNumber:'ORDER-2',scenario:'A',foundInOnt:true,status:'Investigate',notes:'Order not found in CPE Database'},{date:'2026-09-28',orderNumber:'ORDER-3',foundInOnt:false,status:'OK',notes:''}],
  finalOutput:[{date:'2026-09-28',orderNumber:'ORDER-2',wbsType:'New',labourCharge:20,cpeCharge:15,warnings:[]},{date:'2026-09-28',orderNumber:'ORDER-3',wbsType:'New',labourCharge:0,cpeCharge:0,warnings:['Missing PO mapping']}]
 }}));
 await page.goto('/controller/audit');
 await expect(page.getByRole('tablist',{name:'Audit projects'}).getByRole('tab').first()).toHaveText('Service Delivery');
 await expect(page.getByText('Showing 1–50 of 51 records · 50 per page')).toBeVisible();
 await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByText('ORDER-51', {exact:true})).toBeVisible();
 const counts=page.getByRole('group',{name:'Audit count filters'});
 await counts.getByRole('button',{name:'Not filled 1',exact:true}).click();await expect(page.getByText('ORDER-1',{exact:true})).toBeVisible();
 await expect(counts.getByRole('button',{name:'Not filled 1',exact:true})).toHaveAttribute('aria-pressed','true');
 await counts.getByRole('button',{name:'Filled 50',exact:true}).click();await expect(page.getByRole('cell',{name:'ORDER-1',exact:true})).toHaveCount(0);
 await counts.getByRole('button',{name:'Total 51',exact:true}).click();await expect(page.getByText('Showing 1–50 of 51 records · 50 per page')).toBeVisible();
 await page.getByRole('tab',{name:'Cross Verification & ONT Check',exact:true}).click();await expect(page.getByRole('cell',{name:'Investigate',exact:true})).toBeVisible();
 await counts.getByRole('button',{name:'Found in ONT 1',exact:true}).click();await expect(page.getByRole('cell',{name:'ORDER-3',exact:true})).toHaveCount(0);
 await counts.getByRole('button',{name:'OK 1',exact:true}).click();await expect(page.getByRole('cell',{name:'ORDER-2',exact:true})).toHaveCount(0);
 await counts.getByRole('button',{name:'Investigate 1',exact:true}).click();await expect(page.getByRole('cell',{name:'ORDER-2',exact:true})).toBeVisible();
 await counts.getByRole('button',{name:'Total 2',exact:true}).click();await expect(page.getByRole('cell',{name:'ORDER-3',exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Final Output',exact:true}).click();await expect(page.getByText('Labour total: 20.00 · CPE total: 15.00')).toBeVisible();
 await counts.getByRole('button',{name:'Clean 1',exact:true}).click();await expect(page.getByRole('cell',{name:'ORDER-3',exact:true})).toHaveCount(0);
 await counts.getByRole('button',{name:'Warning 1',exact:true}).click();await expect(page.getByRole('cell',{name:'Missing PO mapping',exact:true})).toBeVisible();await expect(page.getByRole('cell',{name:'ORDER-2',exact:true})).toHaveCount(0);
 await counts.getByRole('button',{name:'Total 2',exact:true}).click();await expect(page.getByRole('cell',{name:'ORDER-2',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Export customer template'})).toBeDisabled();await noOverflow(page);
 await page.getByRole('tab',{name:'Service Assurance',exact:true}).click();await expect(page.getByRole('tablist',{name:'Audit stages'})).toHaveCount(0);
 await page.goto('/controller/inventory');await expect(page.getByRole('heading',{name:'Inventory',exact:true})).toBeVisible();await noOverflow(page);
});

for (const theme of ['light', 'dark']) {
  for (const width of [320, 375, 768, 1366]) {
    test(`technician pages ${theme} ${width}px`, async ({ page }) => {
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      await page.setViewportSize({ width, height: 850 }); await fixtures(page, 'technician', theme);
      for (const path of ['/technician/todo', '/technician/submitted', `/technician/assurance-form/${ticketId}`, `/technician/delivery-form/${orderId}`]) {
        await page.goto(path); await expect(page.locator('main')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Account: Test Technician' })).toBeVisible();
        await expect(page.locator('main').getByText(/Loading/)).toHaveCount(0);
        await noOverflow(page);
        if (path.endsWith('/todo') && width < 768) {
          const card = page.locator('.task-card').first();
          const action = card.getByRole('link', { name: 'Edit SA-1001' });
          await expect(action).toBeVisible();
          const box = await action.boundingBox(); const cardBox = await card.boundingBox();
          expect(box!.height).toBeGreaterThanOrEqual(44); expect(box!.x - cardBox!.x).toBeLessThan(25);
          expect(box!.y - cardBox!.y).toBeLessThan(25);
          await expect(page.getByRole('navigation', { name: 'Technician pages' })).toBeVisible();
        }
        if (path.includes('assurance-form')) {
          const font = await page.getByLabel('Resolution Description', { exact: true }).evaluate(el => parseFloat(getComputedStyle(el).fontSize));
          expect(font).toBeGreaterThanOrEqual(16);
        }
      }
      expect(errors).toEqual([]);
      if (width === 375) { await page.goto('/technician/todo'); await expect(page.locator('.task-card')).toHaveCount(1); await page.screenshot({ path: `test-results/technician-${theme}.png`, fullPage: true }); }
    });
  }
  for (const role of ['admin', 'controller']) {
    test(`${role} screens ${theme}`, async ({ page }) => {
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      await fixtures(page, role, theme);
      const routes = role === 'admin' ? ['dashboard', 'profiles', 'projects', 'profile/me', 'operations-data', 'legacy-operations'] : ['projects', 'audit', 'ont-db', 'cpe-db', 'legacy-operations'];
      for (const width of [375, 1024]) {
        await page.setViewportSize({ width, height: 850 });
        for (const route of routes) {
          await page.goto(`/${role}/${route}`); await expect(page.locator('main')).toBeVisible();
          await expect(page.getByRole('button', { name: 'Account: Test Technician' })).toBeVisible();
          await expect(page.locator('main').getByText(/^Loading/)).toHaveCount(0);
          await noOverflow(page);
          if(route==='legacy-operations') {
            await page.getByRole('button',{name:'Service assurance',exact:true}).click();
            await noOverflow(page);
          }
        }
      }
      expect(errors).toEqual([]);
    });
  }
}

test('mobile submission returns to To-Do and works without randomUUID', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 }); await fixtures(page, 'technician', 'dark');
  await page.goto(`/technician/assurance-form/${ticketId}`);
  await page.getByLabel('Root Cause', { exact: true }).selectOption('Cable');
  await page.getByLabel('Resolution', { exact: true }).selectOption('Repaired');
  await page.getByLabel('Resolution Description', { exact: true }).fill('Connection restored.');
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page).toHaveURL(/\/technician\/todo$/);
});

test('manual theme overrides system preference and mobile modal fits', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' }); await page.setViewportSize({ width: 320, height: 640 });
  await fixtures(page, 'admin', 'light'); await page.goto('/admin/profiles');
  await page.getByRole('button', { name: 'Add User' }).click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  expect(await dialog.locator('input').first().evaluate(el => getComputedStyle(el).color)).toBe('rgb(17, 36, 58)');
  await page.getByRole('button', { name: 'Close modal' }).click();
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Add User' }).click();
  const input = dialog.locator('input').first();
  expect(await input.evaluate(el => getComputedStyle(el).color)).toBe('rgb(243, 248, 252)');
  await noOverflow(page);
});

test('controller equipment filters, editing and save errors on mobile',async({page})=>{
 await fixtures(page,'controller','dark');await page.setViewportSize({width:375,height:850});
 await page.goto('/controller/cpe-db');
 await page.getByRole('button',{name:'Delivery Assurance (1)',exact:true}).click();
 await page.getByRole('combobox',{name:'Source year',exact:true}).selectOption('2023');
 const request=page.waitForRequest(r=>r.url().includes('/equipment/cpe?')&&r.url().includes('search=SN'));
 await page.getByPlaceholder('Serial, order, PO or any field').fill('SN');await request;
 await page.getByRole('button',{name:'Edit',exact:true}).click();
 await page.getByLabel('Quantity',{exact:true}).fill('2');
 await noOverflow(page);
 await page.route('**/api/equipment/cpe/*',async route=>{
  if(route.request().method()==='PATCH')await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({message:'Record changed. Close and refresh before editing again.'})});else await route.fallback();
 });
 await page.getByRole('button',{name:'Save record',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Record changed'})).toContainText('Record changed');
 await expect(page.getByLabel('Quantity',{exact:true})).toHaveValue('2');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Add record',exact:true}).click();
 await page.getByLabel('Serial Number',{exact:true}).fill('NEW-SERIAL');
 const saved=page.waitForRequest(r=>r.url().endsWith('/equipment/cpe')&&r.method()==='POST');
 await page.getByRole('button',{name:'Save record',exact:true}).click();
 expect((await saved).postDataJSON().category).toBe('Delivery Assurance');
 await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Operations Center loads database records without Excel upload controls',async({page})=>{
 await fixtures(page,'admin','light');
 await page.goto('/admin/legacy-operations');
 await expect(page.getByRole('button',{name:'Refresh records',exact:true})).toBeVisible();
 await expect(page.locator('input[type=file]')).toHaveCount(0);
 await page.getByRole('button',{name:'Logistics',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Logistics Management'})).toBeVisible();
 await expect(page.locator('input[type=file]')).toHaveCount(0);
 await page.getByRole('button',{name:'Service assurance',exact:true}).click();
 await expect(page.getByText('Delivery orders',{exact:false}).last()).toBeVisible();
 await expect(page.getByRole('button',{name:'▶ Verify Data',exact:true})).toBeVisible();
 await expect(page.locator('input[type=file]')).toHaveCount(0);
});

for(const mod of ['Control','Meta'])test(`Phase 1 typing autosave and all shortcuts ${mod}`,async({page})=>{
 await fixtures(page,'controller','light');await page.setViewportSize({width:1366,height:900});
 await page.clock.setFixedTime(new Date('2026-10-02T09:34:56Z'));
 const fields=[
  {key:'work_date',label:'Date',type:'date'},
  {key:'ticket_number',label:'Ticket No',type:'text'},
  {key:'mobile',label:'Mobile',type:'text'},
  {key:'controller_id',label:'Controller',type:'controller'},
  {key:'status',label:'Status',type:'select',options:['Open','Resolved']},
  {key:'resolution_description',label:'Description',type:'text'},
  {key:'sla_from_creation',label:'SLA',type:'computed'},
 ].map((f,i)=>({...f,storage:f.key,excelColumn:String.fromCharCode(65+i)}));
 await page.route('**/api/assurance-tickets/metadata',r=>r.fulfill({json:{fields,technicians:[]}}));
 const db=new Map<string,any>(),posts:any[]=[];
 let fail=false;
 await page.route('**/api/assurance-tickets/grid*',async route=>{
  if(route.request().method()==='GET'){await route.fulfill({json:[...db.values()]});return;}
  const b=route.request().postDataJSON();posts.push(b);
  if(fail){await route.fulfill({status:503,json:{message:'Test offline'}});return;}
  await new Promise(resolve=>setTimeout(resolve,100));
  const old=db.get(b.id);
  if(old?.mutation_id===b.mutation_id){await route.fulfill({json:{draft:old,record:null}});return;}
  const errors:any={};for(const field of ['work_date','ticket_number','status'])if(!b.values[field])errors[field]='Required';
  const valid=!Object.keys(errors).length;
  const draft={id:b.id,user_id:uid,project_id:projectId,raw_values:b.values,errors,version:(old?.version||0)+1,record_version:valid?(b.base_version||0)+1:b.base_version,state:valid?'record':'draft',mutation_id:b.mutation_id};db.set(b.id,draft);
  await route.fulfill({json:{draft,record:valid?{id:b.id,project_id:projectId,version:draft.record_version,controller_id:uid,controller_name:'Test Controller',...b.values}:null}});
 });
 await page.goto('/controller/projects');await page.getByRole('button',{name:'Add row',exact:true}).click();
 const cell=(label:string,row=1)=>page.getByRole('textbox',{name:`${label}, row ${row}`,exact:true});
 const grid=page.getByRole('table',{name:'Service Delivery spreadsheet'});
 await expect(grid.locator('select,input[type=date],input[type=datetime-local]')).toHaveCount(0);
 await expect(page.getByRole('button',{name:/^Save .*rows/})).toHaveCount(0);
 // Type to replace, raw leading zeros and whitespace, then the Tab chain returns to column A.
 await cell('Date').pressSequentially('02/10/2026');await cell('Date').press('Tab');await expect(cell('Ticket No')).toBeFocused();
 await cell('Ticket No').pressSequentially('000123');await cell('Ticket No').press('Tab');await expect(cell('Mobile')).toBeFocused();
 await cell('Mobile').pressSequentially('001122');await cell('Mobile').press('Tab');await expect(cell('Controller')).toBeFocused();
 await cell('Controller').press('Enter');await expect(cell('Date',2)).toBeFocused();
 await cell('Date',2).press('Shift+Enter');await expect(cell('Date')).toBeFocused();
 await cell('Ticket No').click();await cell('Ticket No').press('Shift+Tab');await expect(cell('Date')).toBeFocused();
 // Protected values cannot be typed, cleared, or changed using date insertion.
 await cell('Controller').click();const protectedText=await cell('Controller').inputValue();
 await cell('Controller').press('F2');await cell('Controller').pressSequentially('BAD');await cell('Controller').press('Delete');await cell('Controller').press(`${mod}+;`);await expect(cell('Controller')).toHaveValue(protectedText);
 // Complete a valid record, without disabling the next cell or moving its focus when the response arrives.
 await cell('Status').click();await cell('Status').pressSequentially('Open');await cell('Status').press('Tab');
 await expect(cell('Description')).toBeFocused();await expect.poll(()=>[...db.values()][0]?.state).toBe('record');await expect(cell('Description')).toBeFocused();
 // F2 edits existing text and Escape restores without saving the cancelled value.
 await cell('Ticket No').click();await cell('Ticket No').press('F2');await cell('Ticket No').pressSequentially('9');await expect(cell('Ticket No')).toHaveValue('0001239');
 await cell('Ticket No').press('Escape');await expect(cell('Ticket No')).toHaveValue('000123');
 expect(posts.some(p=>p.values.ticket_number==='0001239')).toBe(false);
 await cell('Mobile').dblclick();await cell('Mobile').pressSequentially('7');await cell('Mobile').press('Tab');
 await expect.poll(()=>[...db.values()][0]?.raw_values.mobile).toBe('0011227');
 // Date, time and both, using Control or Meta. Inserted text is committed unchanged.
 await cell('Description').click();await cell('Description').press(`${mod}+;`);await expect(cell('Description')).toHaveValue('2026-10-02');await cell('Description').press('Tab');
 await cell('Description').click();await cell('Description').press(`${mod}+Shift+;`);await expect(cell('Description')).toHaveValue('12:34:56');await cell('Description').press('Tab');
 await cell('Description').click();await cell('Description').press(`${mod}+Alt+Shift+;`);await expect(cell('Description')).toHaveValue('2026-10-02 12:34:56');await cell('Description').press('Tab');
 // Alt/Option+Enter adds a newline while editing. Spaces and newlines survive saving and reload.
 await cell('Description').click();await cell('Description').pressSequentially('  first');await cell('Description').press('Alt+Enter');await cell('Description').pressSequentially('second  ');await cell('Description').press('Tab');
 await expect.poll(()=>[...db.values()][0]?.raw_values.resolution_description).toBe('  first\nsecond  ');
 // Clear the selected cell with each key; no range selection is introduced in Phase 1.
 await cell('Mobile').click();await cell('Mobile').press('Delete');await expect.poll(()=>[...db.values()][0]?.raw_values.mobile).toBe('');
 await cell('Mobile').pressSequentially('0009');await cell('Mobile').press('Tab');await cell('Mobile').click();await cell('Mobile').press('Backspace');await expect.poll(()=>[...db.values()][0]?.raw_values.mobile).toBe('');
 await cell('Mobile').pressSequentially('0077');await cell('Mobile').press('Tab');await expect.poll(()=>[...db.values()][0]?.raw_values.mobile).toBe('0077');
 // A failed request keeps the text, focus and retryable mutation, and subsequent typing still works.
 fail=true;await cell('Ticket No').click();await cell('Ticket No').pressSequentially('000999');await cell('Ticket No').press('Tab');await expect(cell('Mobile')).toBeFocused();
 await expect(page.getByText('Test offline',{exact:false})).toBeVisible();await expect(cell('Mobile')).toBeFocused();
 fail=false;await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect.poll(()=>[...db.values()][0]?.raw_values.ticket_number).toBe('000999');
 await page.screenshot({path:`test-results/phase1-${mod}.png`,fullPage:true});
 await cell('Description').press(`${mod}+/`);await expect(page.getByRole('dialog',{name:'Shortcuts Guide'}).getByText('Ctrl+Alt+Shift+;',{exact:true})).toBeVisible();await page.keyboard.press('Escape');
 await page.reload();await expect(cell('Ticket No')).toHaveValue('000999');await expect(cell('Date')).toHaveValue('02/10/2026');await expect(cell('Description')).toHaveValue('  first\nsecond  ');
 await expect(cell('Mobile')).toHaveValue('0077');
});
