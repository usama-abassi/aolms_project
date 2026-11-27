import * as XLSX from 'xlsx';
import {deliveryRow,deliveryTemplate,type AuditOrder} from './model';
import format from './template-format.json';
export type DeliveryStockRow={item_code:string|null;name:string;unit:string;opening:number;received:number;used:number;faulty:number;remaining:number};
export type DeliveryStockMonth={month:string;rows:DeliveryStockRow[]};

function stockDashboard(data:DeliveryStockMonth[]){
 const headings=['Month','Material code','Material','Unit','Opening stock','Received','Used','Faulty','Remaining'];
 const entries=data.flatMap(({month,rows})=>rows.length?rows.map(r=>[month,r.item_code??'',r.name,r.unit,r.opening,r.received,r.used,r.faulty,r.remaining]):[[month,'','No inventory records for this month']]);
 const sheet=XLSX.utils.aoa_to_sheet([headings,...entries]);
 sheet['!cols']=[12,17,46,13,16,14,14,14,16].map(wch=>({wch}));
 sheet['!autofilter']={ref:`A1:I${entries.length+1}`};
 return sheet;
}

export function deliveryWorkbook(rows:AuditOrder[],stock?:DeliveryStockMonth[]){
 const valid=rows.filter(r=>r.ready);
 const sheet=XLSX.utils.aoa_to_sheet([...deliveryTemplate.headers,...valid.map(deliveryRow)]);
 sheet['!merges']=deliveryTemplate.merges;
 sheet['!cols']=deliveryTemplate.cols.length?deliveryTemplate.cols:Array.from({length:75},()=>({wch:22}));
 sheet['!rows']=deliveryTemplate.rows;
 sheet['!autofilter']={ref:`A4:BW${Math.max(4,valid.length+4)}`};
 for(let i=0;i<valid.length;i++)if(sheet[`A${i+5}`])sheet[`A${i+5}`].z='d-mmm';
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Delivery');
 if(stock)XLSX.utils.book_append_sheet(book,stockDashboard(stock),'Stock Dashboard');
 return book;
}
// Retain the customer's fonts, fills, borders and number formats. Only formatting
// metadata is retained from the reference file, never its customer records.
export function deliveryFile(rows:AuditOrder[],stock?:DeliveryStockMonth[]):Uint8Array {
 const buffer=XLSX.write(deliveryWorkbook(rows,stock),{type:'buffer',bookType:'xlsx'});
 const archive=XLSX.CFB.read(buffer,{type:'buffer'}),encode=new TextEncoder();
 const part=(path:string)=>{
  const index=archive.FullPaths.indexOf('Root Entry/'+path);
  if(index<0)throw new Error('Missing Excel package part: '+path);
  return archive.FileIndex[index];
 };
 const replacePart=(path:string,value:string)=>{
  const entry=part(path),content=encode.encode(value);
  entry.content=content;
  entry.size=content.length;
 };
 const entry=part('xl/worksheets/sheet1.xml');
 let xml=new TextDecoder().decode(entry.content as Uint8Array);
 xml=xml.replace(/<c\b([^>]+)>/g,(tag,attrs:string)=>{
  const match=attrs.match(/\br="([A-Z]+)(\d+)"/);if(!match)return tag;
  const address=match[1]+(Number(match[2])<=4?match[2]:'5');
  const style=(format.styles as Record<string,number>)[address];
  return style==null?tag:`<c${attrs.replace(/\s+s="\d+"/,'')} s="${style}">`;
 });
 // Update the original ZIP parts in place: adding a second copy triggers Excel repair.
 replacePart('xl/worksheets/sheet1.xml',xml);
 replacePart('xl/styles.xml',format.stylesXML);
 replacePart('xl/theme/theme1.xml',format.themeXML);
 return new Uint8Array(XLSX.CFB.write(archive,{type:'buffer',fileType:'zip'}));
}
