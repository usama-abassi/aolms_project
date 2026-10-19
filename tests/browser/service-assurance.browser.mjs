import {chromium,expect} from '@playwright/test'
import assert from 'node:assert/strict'
import dotenv from 'dotenv'
import fs from 'node:fs'
import XLSX from 'xlsx'

dotenv.config({path:'.env.local',quiet:true})
const base=process.env.ASSURANCE_TEST_URL||'http://127.0.0.1:3000'
const schema=JSON.parse(fs.readFileSync('lib/service-assurance-schema.json','utf8'))
const uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',project='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const origin=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
const storage='sb-'+new URL(origin).hostname.split('.')[0]+'-auth-token'
const user={id:uid,email:'test@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}
const browser=await chromium.launch({channel:'msedge',headless:true})
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true})
 let role='controller',records=[],saves=[],response={id,version:1,response_version:0,values:{'Team Name':'Test Technician','SR / Ticket number':'000123'},submitted_at:null}
 const report=Array(52).fill('')
 report[1]='000123'
 report[31]=1
 report[48]='SN001'
 report[49]='000099'
 const audit=[{id,ticket_number:'000123',team:'Test Technician',assigned_date:'2026-10-01',old_serial:'OLD',new_serial:'SN001',submitted_at:'2026-10-01T12:00:00Z',technician:'Test Technician',ont_replaced:true,po_number:'000099',po_status:'Found',report,issues:[],materials:[]},
  {id:project,ticket_number:'000124',team:'Test Technician',assigned_date:null,old_serial:'',new_serial:'',submitted_at:null,technician:'',ont_replaced:false,po_status:'Not required',report:null,issues:[]}]
 await context.addInitScript(({storage,user})=>{
  const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600}))+'.test'
  localStorage.setItem(storage,JSON.stringify({access_token:token,refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user}))
 },{storage,user})
 await context.route(origin+'/**',route=>route.fulfill({json:route.request().url().includes('/auth/')?user:{...user,role,is_active:true,full_name:'Test Technician'}}))
 await context.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname,post=route.request().method()==='POST'
  let result=[]
  if(path==='/api/projects')result=[{id:project,name:'Service Assurance',code:'SERVICE_DELIVERY',is_active:true}]
  else if(path==='/api/service-assurance/metadata')result={fields:schema.fields,technicians:[{id:uid,full_name:'Test Technician'}]}
  else if(path==='/api/service-assurance/audit')result=audit
  else if(path==='/api/service-assurance/tasks')result=[{id,ticket_number:'000123',team_name:'Test Technician',assigned_datetime:'',old_serial:'OLD',new_serial:'SN001',submitted_at:response.submitted_at}]
  else if(path.startsWith('/api/service-assurance/responses/')){
   if(post){
    const body=route.request().postDataJSON()
    saves.push(body)
    response={...response,values:body.values,response_version:response.response_version+1,submitted_at:body.draft?response.submitted_at:new Date().toISOString()}
   }
   result=response
  }else if(path==='/api/service-assurance/grid'&&post){
   const body=route.request().postDataJSON()
   records=[{...body.values,id:body.id,version:1,project_id:project,spreadsheet_fields:{}}]
   result={record:records[0],draft:{id:body.id,raw_values:body.values,record_version:1,version:1,state:'record',errors:{}}}
  }else if(path==='/api/service-assurance')result=records
  await route.fulfill({json:result})
 })
 const page=await context.newPage(),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(base+'/controller/projects')
 await expect(page.getByRole('button',{name:'Add row',exact:true})).toBeVisible()
 assert.equal(await page.locator('thead th').count(),42)
 for(const [column,value] of [[3,'000123'],[23,'Resolved'],[25,'Replaced Faulty ONT'],[32,'SN001']]){
  const cell=page.locator(`[data-cell="0:${column}"]`)
  await cell.dblclick()
  await cell.fill(value)
  await cell.press('Tab')
 }
 await page.getByLabel('Team, row 1',{exact:true}).selectOption(uid)
 await page.getByRole('button',{name:'Submit rows',exact:true}).click()
 await expect(page.getByText('All committed changes saved',{exact:true})).toBeVisible()
 assert.equal(records[0].ticket_number,'000123')
 assert.equal(records[0].team,uid)
 console.log('PASS October Controller columns, Team dropdown, text identifiers and save')
 await page.goto(base+'/controller/audit')
 await expect(page.getByRole('tab',{name:'Total Orders (2)',exact:true})).toBeVisible()
 await page.getByRole('tab',{name:'ONT Replaced (1)',exact:true}).click()
 await expect(page.locator('tbody tr')).toHaveCount(1)
 await page.getByRole('button',{name:'Inspect',exact:true}).click()
 await expect(page.getByRole('dialog').locator('th')).toHaveCount(52)
 await page.keyboard.press('Escape')
 const downloading=page.waitForEvent('download')
 await page.getByRole('button',{name:'Export filtered report',exact:true}).click()
 const download=await downloading
 const sheet=XLSX.read(fs.readFileSync(await download.path())).Sheets['Material Consumption']
 assert.equal(sheet['!ref'],'A1:AZ6')
 assert.equal(sheet.B6.v,'000123')
 assert.equal(sheet.B6.t,'s')
 assert.equal(sheet.AX6.v,'000099')
 assert.equal(sheet.AX6.t,'s')
 assert.equal(sheet.AF3.v,'10000471')
 assert.equal(sheet.AW5.v,'ONT S/N')
 console.log('PASS audit filters, detailed output and A:AZ Excel export with string identifiers')
 role='technician'
 await page.goto(base+'/technician/projects')
 await page.getByRole('button',{name:'Fill response',exact:true}).click()
 const dialog=page.getByRole('dialog')
 await expect(dialog.getByLabel('SR / Ticket number',{exact:true})).toHaveValue('000123')
 await expect(dialog.getByLabel('Team Name',{exact:true})).toHaveValue('Test Technician')
 await expect(dialog.getByLabel('SR / Ticket number',{exact:true})).toHaveAttribute('readonly','')
 await dialog.getByLabel('Patch Chord',{exact:true}).fill('2')
 await page.reload()
 await page.getByRole('button',{name:'Fill response',exact:true}).click()
 await expect(dialog.getByLabel('Patch Chord',{exact:true})).toHaveValue('2')
 await dialog.getByRole('button',{name:'Save draft',exact:true}).click()
 await expect.poll(()=>saves.length).toBe(1)
 assert.equal(saves[0].draft,true)
 assert.equal(saves[0].values['Patch Chord'],'2')
 await expect(dialog.getByRole('button',{name:'Submit response',exact:true})).toBeEnabled()
 await dialog.getByRole('button',{name:'Submit response',exact:true}).click()
 await expect(dialog).not.toBeVisible()
 assert.equal(saves.at(-1).draft,false)
 console.log('PASS Technician project, prefilled identifiers, cached edits, draft and submission')
 role='admin'
 await page.goto(base+'/admin/audit')
 await expect(page.getByRole('tab',{name:'Total Orders (2)',exact:true})).toBeVisible()
 console.log('PASS Admin audit access')
 assert.deepEqual(errors,[])
 await context.close()
}finally{await browser.close()}
