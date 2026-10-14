import * as XLSX from 'xlsx';
import {deliveryRow,deliveryTemplate,type AuditOrder} from './model';
import format from './template-format.json';
export function deliveryWorkbook(rows:AuditOrder[]){
 const valid=rows.filter(r=>r.ready);
 const sheet=XLSX.utils.aoa_to_sheet([...deliveryTemplate.headers,...valid.map(deliveryRow)]);
 sheet['!merges']=deliveryTemplate.merges;
 sheet['!cols']=deliveryTemplate.cols.length?deliveryTemplate.cols:Array.from({length:75},()=>({wch:22}));
 sheet['!rows']=deliveryTemplate.rows;
 sheet['!autofilter']={ref:`A4:BW${Math.max(4,valid.length+4)}`};
 for(let i=0;i<valid.length;i++)if(sheet[`A${i+5}`])sheet[`A${i+5}`].z='d-mmm';
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Delivery');return book;
}
// Retain the customer's fonts, fills, borders and number formats. Only formatting
// metadata is retained from the reference file, never its customer records.
export function deliveryFile(rows:AuditOrder[]):Uint8Array {
 const buffer=XLSX.write(deliveryWorkbook(rows),{type:'buffer',bookType:'xlsx'});
 const archive=XLSX.CFB.read(buffer,{type:'buffer'}),encode=new TextEncoder();
 const entry=archive.FileIndex[archive.FullPaths.indexOf('Root Entry/xl/worksheets/sheet1.xml')];
 let xml=new TextDecoder().decode(entry.content as Uint8Array);
 xml=xml.replace(/<c\b([^>]+)>/g,(tag,attrs:string)=>{
  const match=attrs.match(/\br="([A-Z]+)(\d+)"/);if(!match)return tag;
  const address=match[1]+(Number(match[2])<=4?match[2]:'5');
  const style=(format.styles as Record<string,number>)[address];
  return style==null?tag:`<c${attrs.replace(/\s+s="\d+"/,'')} s="${style}">`;
 });
 XLSX.CFB.utils.cfb_add(archive,'xl/worksheets/sheet1.xml',encode.encode(xml));
 XLSX.CFB.utils.cfb_add(archive,'xl/styles.xml',encode.encode(format.stylesXML));
 XLSX.CFB.utils.cfb_add(archive,'xl/theme/theme1.xml',encode.encode(format.themeXML));
 return new Uint8Array(XLSX.CFB.write(archive,{type:'buffer',fileType:'zip'}));
}
