import {CFB,utils,write} from 'xlsx';
import template from './inventory-export-template.json';

export type InventoryExportRow={item_code:string;name:string;unit:string;opening:number;used:number;received:number;faulty:number;remaining:number};
// XML 1.0 cannot contain these control characters in user-entered material names.
// eslint-disable-next-line no-control-regex
const xml=(value:string)=>value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const key=(value:string)=>value.trim().toLowerCase().replace(/\s+/g,' ');

// Use the supplied dashboard's actual style definitions. SheetJS's ordinary writer
// does not preserve its fills/borders, so replace the worksheet and style ZIP parts.
export function exportInventory(month:string,rows:InventoryExportRow[]):Uint8Array{
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Choose a valid month');
 if(rows.length>16383)throw new Error('Too many materials for an Excel sheet');
 const remaining=[...rows],ordered:Array<{item:InventoryExportRow;styles:number[]}>=[];
 for(const column of template.columns.slice(1)){
  const index=remaining.findIndex(item=>key(item.name)===key(column.name)&&key(item.item_code)===key(column.code==='None'?'':column.code));
  if(index>=0)ordered.push({item:remaining.splice(index,1)[0],styles:column.styles});
 }
 for(const item of remaining)ordered.push({item,styles:template.columns[1].styles});
 const last=utils.encode_col(Math.max(1,ordered.length));
 const period=new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
 const data=Array.from({length:9},(_,r)=>{
  const label=r===0?`${template.headers[0]} - ${period}`:template.headers[r];
  let cells=`<c r="A${r+1}" s="${template.columns[0].styles[r]}" t="inlineStr"><is><t>${xml(label)}</t></is></c>`;
  for(const [{item,styles},i] of ordered.map((v,i)=>[v,i] as const)){
   const col=utils.encode_col(i+1),ref=`${col}${r+1}`;
   const value=[null,item.item_code,item.unit,item.name,item.opening,item.used,item.received,item.faulty,item.remaining][r];
   if(r===0){cells+=`<c r="${ref}" s="${styles[r]}"/>`;continue;}
   if(typeof value==='number'){
    if(!Number.isFinite(value))throw new Error(`Invalid inventory amount for ${item.name}`);
    const formula=r===8?`<f>${col}5+${col}7-${col}6-${col}8</f>`:'';
    cells+=`<c r="${ref}" s="${styles[r]}">${formula}<v>${value}</v></c>`;
   }else cells+=`<c r="${ref}" s="${styles[r]}" t="inlineStr"><is><t xml:space="preserve">${xml(value||'')}</t></is></c>`;
  }
  return `<row r="${r+1}" ht="${template.heights[r]}" customHeight="1">${cells}</row>`;
 }).join('');
 const cols=Array.from({length:ordered.length+1},(_,i)=>{
  const width=template.widths.find(c=>i+1>=Number(c.min)&&i+1<=Number(c.max))?.width||'9.5';
  return `<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`;
 }).join('');
 const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><outlinePr summaryBelow="0" summaryRight="0"/></sheetPr><dimension ref="A1:${last}9"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultColWidth="12.6296296296296" defaultRowHeight="15.75"/><cols>${cols}</cols><sheetData>${data}</sheetData><mergeCells count="1"><mergeCell ref="A1:${last}1"/></mergeCells><conditionalFormatting sqref="A9:${last}9"><cfRule type="cellIs" dxfId="0" priority="1" operator="lessThan"><formula>0</formula></cfRule></conditionalFormatting><printOptions horizontalCentered="1" gridLines="1"/><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0" footer="0"/><pageSetup paperSize="1" pageOrder="overThenDown" orientation="landscape" cellComments="atEnd"/></worksheet>`;
 const book=utils.book_new();utils.book_append_sheet(book,utils.aoa_to_sheet([['']]),`Dashboard ${month.slice(0,4)}`);
 const archive=CFB.read(new Uint8Array(write(book,{type:'array',bookType:'xlsx'})),{type:'array'});
 for(const [path,value] of [['xl/worksheets/sheet1.xml',sheet],['xl/styles.xml',template.styles],['xl/theme/theme1.xml',template.theme]]){
  const entry=CFB.find(archive,archive.FullPaths[0]+path);entry.content=new TextEncoder().encode(value);entry.size=entry.content.length;
 }
 return new Uint8Array(CFB.write(archive,{type:'array',fileType:'zip',compression:true}));
}
