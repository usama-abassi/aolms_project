import {describe,it,expect} from 'vitest';
import * as XLSX from 'xlsx';
import {auditOrder,compare,controllerFields,responseFields,deliveryTemplate,deliveryRow,orderValues} from './model';
import {deliveryWorkbook,deliveryFile} from './export';
const ticket={id:'order-1',ticket_number:'00123',technician_id:'tech-1',technician_name:'Team',status:'Resolved',spreadsheet_fields:{delivery:{actioned:'Delivered',order_type:'External',connection_type:'Home Connect',nce_sn:'ABC'}}};
const submission={id:'response-1',technician_id:'tech-1',status:'submitted',submitted_at:'2026-10-01T10:00:00Z',response_order_type:'External',response_connection_type:'Home Connect',delivery_fields:{E:'External',G:'Home Connect',BN:'Customer Existing ONT',S:'2',AA:'3',AR:'4',BA:'5'}};
describe('reference structure',()=>{
 it('preserves all controller columns and duplicate Remarks headings',()=>{expect(controllerFields).toHaveLength(44);expect(controllerFields[1].label).toBe('Team');expect(controllerFields[21].label).toBe('Actioned');expect(controllerFields[37].label).toBe('Nce SN');expect(controllerFields.filter(f=>f.label==='Remarks')).toHaveLength(3);expect(new Set(controllerFields.map(f=>f.key)).size).toBe(44);});
 it('preserves all response fields and the row-four delivery headings',()=>{expect(responseFields).toHaveLength(74);expect(responseFields[4].label.trim()).toBe('FTTR Order Type');expect(deliveryTemplate.headers[3]).toHaveLength(75);expect(deliveryTemplate.headers[3][30]).toMatch(/^ONT Reservation Number/);});
});
describe('submission audit and corrections',()=>{
 it('counts drafts as pending, even if response fields are present',()=>{const a=auditOrder(ticket,[{...submission,status:'draft',submitted_at:null}],[]);expect(a.submitted).toBe(false);expect(a.orderType).toBe('Pending Submission');expect(a.ready).toBe(false);});
 it('only normalizes whitespace and case, never business aliases',()=>{expect(compare(' NEW ','new',true)).toBe('Correct');expect(compare('New','New (Provide) with FTTR',true)).toBe('Issue');expect(compare('','',true)).toBe('Issue');});
 it('reports simultaneous discrepancies',()=>{const a=auditOrder(ticket,[{...submission,delivery_fields:{E:'Internal',G:'Home Pass'}}],[]);expect(a.issues).toEqual(expect.arrayContaining(['Order Type Issue','Close Type Issue']));});
 it('uses corrected source values in output',()=>{const t={...ticket,spreadsheet_fields:{delivery:{...ticket.spreadsheet_fields.delivery,order_type:'Internal'}}};const a=auditOrder(t,[{...submission,delivery_fields:{...submission.delivery_fields,E:'Internal'}}],[]);expect(a.ready).toBe(true);expect(deliveryRow(a)[3]).toBe('Internal');expect(a.internalOrderType).toBe(a.externalOrderType);});
 it('preserves historic submissions but blocks revoked assignments from export',()=>{const a=auditOrder({...ticket,spreadsheet_fields:{delivery:{...ticket.spreadsheet_fields.delivery,actioned:'Rejected'}}},[submission],[]);expect(a.submitted).toBe(true);expect(a.ready).toBe(false);expect(a.issues).toContain('Actioned is not Delivered');});
 it('chooses the current Technician response without multiplying orders or deleting history',()=>{const a=auditOrder(ticket,[submission,{...submission,id:'response-2',technician_id:'tech-2'}],[]);expect(a.submission.id).toBe('response-1');expect(a.ready).toBe(true);});
 it('never fills missing submitted answers with Controller values',()=>{const a=auditOrder(ticket,[{...submission,response_order_type:null,response_connection_type:null,delivery_fields:{}}],[]);expect(a.orderType).toBe('Issue');expect(a.closeType).toBe('Issue');});
 it('retains legacy fields without treating another business status as Delivered',()=>{expect(orderValues({...ticket,spreadsheet_fields:{wbs_type:'New'},status:'Open'}).actioned).toBe('Open');expect(orderValues({...ticket,spreadsheet_fields:{wbs_type:'New'}}).order_type).toBe('New');});
});
describe('ONT lookup and reproducible output',()=>{
 const t={...ticket,spreadsheet_fields:{delivery:{...ticket.spreadsheet_fields.delivery,order_type:'New'}}};
 const s={...submission,delivery_fields:{...submission.delivery_fields,E:'NEW'}};
 const ont={serial_number:'ABC',po_number:'PO-123',item_code:'10000646'};
 it('uses an exact normalized serial and associated PO',()=>{const a=auditOrder(t,[s],[ont]);expect(a.ontStatus).toBe('Correct');expect(deliveryRow(a)[30]).toBe('PO-123');expect(a.material?.quantity).toBe(1);expect(a.mappingIssues).toEqual([]);expect(a.ready).toBe(true);expect(deliveryRow(a)[27]).toBe(1);expect(deliveryRow(a)[61]).toBe(0);});
 it.each([[[], 'Serial not found'],[[{...ont,serial_number:'ABCD'}],'Serial not found'],[[ont,{...ont,po_number:'OTHER'}],'Ambiguous serial'],[[{...ont,po_number:''}],'Missing PO Number']])('blocks failed ONT lookup %j',(inventory,status)=>{const a=auditOrder(t,[s],inventory as any[]);expect(a.ontStatus).toBe(status);expect(a.ready).toBe(false);expect(a.poNumber).toBe('');});
 it('groups Wi-Fi 6 and F50 ONTs in AB without changing the AP quantity',()=>{
  const ap={...s,delivery_fields:{...s.delivery_fields,BC:'2'}};
  for(const item_code of ['10000471','10000646']){
   const a=auditOrder(t,[ap],[{...ont,item_code}]);
   expect(a.material?.code).toBe(item_code);
   expect(deliveryRow(a)[27]).toBe(1);
   expect(deliveryRow(a)[61]).toBe(1);
  }
 });
 it('treats repeated X8 inventory rows with the same PO as one lookup',()=>{
  const x8={...ont,model:'X8',item_code:''};
  const legacy={...x8,model:'8X ONT ',item_code:null};
  expect(auditOrder(t,[s],[x8,x8,legacy,legacy]).poNumber).toBe('PO-123');
  expect(auditOrder(t,[s],[x8,{...legacy,po_number:'DIFFERENT'}]).ontStatus).toBe('Ambiguous serial');
 });
 it('handles a missing serial explicitly',()=>{const a=auditOrder({...t,spreadsheet_fields:{delivery:{...t.spreadsheet_fields.delivery,nce_sn:''}}},[s],[ont]);expect(a.ontStatus).toBe('Missing Nce SN');});
 it('does not increment materials or modify source records on repeated generation',()=>{const before=JSON.stringify([t,s,ont]);expect(deliveryRow(auditOrder(t,[s],[ont]))).toEqual(deliveryRow(auditOrder(t,[s],[ont])));expect(JSON.stringify([t,s,ont])).toBe(before);});
 it('sums invisible fiber by this response, not erroneous workbook row offsets',()=>{expect(deliveryRow(auditOrder(ticket,[submission],[]))[66]).toBe(14);});
 it('retains the customer-confirmed BP and BW formula mappings',()=>{const a=auditOrder(ticket,[{...submission,delivery_fields:{...submission.delivery_fields,BJ:'2',BK:'1',K:'3',W:'4'}}],[]);expect(a.ready).toBe(true);expect(deliveryRow(a)[67]).toBe(3);expect(deliveryRow(a)[74]).toBe(7);});
 it('counts entered AP serials and preserves them in the export',()=>{
  const a=auditOrder(ticket,[{...submission,delivery_fields:{...submission.delivery_fields,BC:'SERIAL123',BD:'008765',BH:'-',BI:'0'}}],[]);
  expect(a.ready).toBe(true);
  expect(deliveryRow(a).slice(61,66)).toEqual([2,'SERIAL123','008765','-','0']);
 });
 it('preserves template styles in the final file without importing customer records',()=>{const bytes=deliveryFile([auditOrder(ticket,[submission],[])]);const book=XLSX.read(bytes,{cellStyles:true});expect(book.SheetNames).toEqual(['Delivery']);expect(book.Sheets.Delivery['!ref']).toBe('A1:BW5');expect(book.Sheets.Delivery.A5.z).toBe('d-mmm');const zip=XLSX.CFB.read(bytes,{type:'buffer'});for(const path of ['xl/worksheets/sheet1.xml','xl/styles.xml','xl/theme/theme1.xml'])expect(zip.FullPaths.filter(name=>name==='Root Entry/'+path)).toHaveLength(1);const index=zip.FullPaths.indexOf('Root Entry/xl/styles.xml');expect(new TextDecoder().decode(zip.FileIndex[index].content as Uint8Array)).toContain('<fonts');});
 it('exports only ready records with exact four header rows and text order identifiers',()=>{const ready=auditOrder(ticket,[submission],[]),pending=auditOrder({...ticket,id:'pending'},[],[]);const book=deliveryWorkbook([ready,pending]);const bytes=XLSX.write(book,{type:'buffer',bookType:'xlsx'});const sheet=XLSX.read(bytes).Sheets.Delivery;expect(sheet['!ref']).toBe('A1:BW5');expect(sheet.AE4.v).toBe(deliveryTemplate.headers[3][30]);expect(sheet.C5.v).toBe('00123');expect(sheet.D5.v).toBe('External');expect(sheet['!merges']).toEqual(deliveryTemplate.merges);});
});

it.each([
 ['External','External - Shift (Modify)','Correct'],
 ['Internal - Shift (Modify)','Internal','Correct'],
 ['External - Shift (Modify)','Internal','Issue'],
 ['New','New (Provide) with FTTR','Issue'],
])('compares shift variants by their order type family (%s / %s)',(controller,technician,expected)=>{
 const result=auditOrder({...ticket,spreadsheet_fields:{delivery:{order_type:controller}}},[
  {...submission,response_order_type:technician,delivery_fields:{...submission.delivery_fields,E:technician}}
 ],[]);
 expect(result.orderType).toBe(expected);
});


it.each([
 ['New with FTTR','   ','New','New'],
 ['New with FTTR','F50','New','New with FTTR'],
 ['New','F50','New with FTTR','New with FTTR'],
 ['New','F50','New','New with FTTR'],
 ['New','','New with FTTR','New'],
 ['External','F50','External','External'],
])('uses controller FTTR details to classify new orders (%s / %s)',(order_type,fttr_type,response,expected)=>{
 const order={...ticket,spreadsheet_fields:{delivery:{...ticket.spreadsheet_fields.delivery,order_type,fttr_type}}};
 const audit=auditOrder(order,[{...submission,delivery_fields:{...submission.delivery_fields,E:response}}],[{serial_number:'ABC',po_number:'123',item_code:'10000471'}]);
 expect(audit.orderType).toBe('Correct');
 expect(audit.controllerOrderType).toBe(expected);
 expect(deliveryRow(audit)[3]).toBe(expected);
 expect(orderValues(order).order_type).toBe(order_type);
});


it.each([['10000527','BR',69],['10000526','BS',70]] as const)('exports one matched %s ONT in %s',(item_code,_column,index)=>{
 const t={...ticket,spreadsheet_fields:{delivery:{...ticket.spreadsheet_fields.delivery,order_type:'New',fttr_type:'F30'}}};
 const response={...submission,delivery_fields:{...submission.delivery_fields,E:'New',BO:'SERIAL123'}};
 const a=auditOrder(t,[response],[{serial_number:'ABC',po_number:'PO-1',item_code}]);
 const row=deliveryRow(a);
 expect(a.ready).toBe(true);
 expect(row[index]).toBe(1);
 expect(row[index===69?70:69]).toBe('');
 expect(row[59]).toBe('SERIAL123');
});

it('includes monthly ledger balances as a separate Excel dashboard',()=>{
 const order=auditOrder(ticket,[submission],[]);
 const bytes=deliveryFile([order],[{month:'2026-11',rows:[{item_code:'10000527',name:'F30',unit:'piece',opening:20,received:2,used:14,faulty:1,remaining:7}]}]);
 const book=XLSX.read(bytes);
 expect(book.SheetNames).toEqual(['Delivery','Stock Dashboard']);
 expect(XLSX.utils.sheet_to_json(book.Sheets['Stock Dashboard'],{header:1})[1]).toEqual(['2026-11','10000527','F30','piece',20,2,14,1,7]);
 expect(book.Sheets.Delivery.C5.v).toBe('00123');
});
