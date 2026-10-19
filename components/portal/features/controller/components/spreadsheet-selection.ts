export type CellPoint={row:number,col:number}
export type CellRange={anchor:CellPoint,end:CellPoint}
export type CellWrite={id:string,key:string,value:string}
export type CellChange=CellWrite&{before:string}
export type SheetRow={id:string,values:Record<string,string>}
export type SheetField={key:string,label:string,type?:string,options?:string[],readOnly?:boolean}
export const MAX_BULK_CELLS=50000
export function bounds(range:CellRange){
 return {top:Math.min(range.anchor.row,range.end.row),bottom:Math.max(range.anchor.row,range.end.row),left:Math.min(range.anchor.col,range.end.col),right:Math.max(range.anchor.col,range.end.col)}
}
export function samePoint(a:CellPoint,b:CellPoint){return a.row===b.row&&a.col===b.col}
export function parseClipboard(text:string){
 const rows:string[][]=[],row:string[]=[]
 let value='',quoted=false
 for(let i=0;i<text.length;i++){
  const char=text[i]
  if(char==='"'&&(quoted||value==='')){
   if(quoted&&text[i+1]==='"'){
    value+='"'
    i++
   }else quoted=!quoted
  }else if(!quoted&&(char==='\t'||char==='\n'||char==='\r')){
   row.push(value)
   value=''
   if(char!=='\t'){
    rows.push([...row])
    if(rows.length>MAX_BULK_CELLS)throw new Error(`Paste at most ${MAX_BULK_CELLS} cells at once`)
    row.length=0
    if(char==='\r'&&text[i+1]==='\n')i++
   }
  }else value+=char
 }
 if(quoted)throw new Error('Clipboard text contains an unclosed quoted cell')
 if(value!==''||row.length||!rows.length){
  row.push(value)
  rows.push(row)
 }
 const width=rows.reduce((n,r)=>Math.max(n,r.length),0)
 if(width*rows.length>MAX_BULK_CELLS)throw new Error(`Select or paste at most ${MAX_BULK_CELLS} cells at once`)
 return rows.map(r=>Array.from({length:width},(_,i)=>r[i]??''))
}
export function clipboardText(values:string[][]){
 return values.map(row=>row.map(value=>/[\t\r\n"]/.test(value)?`"${value.replaceAll('"','""')}"`:value).join('\t')).join('\r\n')
}
export function clipboardHtml(values:string[][]){
 const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))
 return `<table xmlns:x="urn:schemas-microsoft-com:office:excel">${values.map(row=>`<tr>${row.map(value=>`<td x:str style="mso-number-format:'\\@';white-space:pre-wrap">${escape(value)}</td>`).join('')}</tr>`).join('')}</table>`
}
export function boundary(point:CellPoint,key:string,rowCount:number,columnCount:number,read:(row:number,col:number)=>string):CellPoint{
 const dr=key==='ArrowDown'?1:key==='ArrowUp'?-1:0,dc=key==='ArrowRight'?1:key==='ArrowLeft'?-1:0
 if(!dr&&!dc)return point
 const valid=(r:number,c:number)=>r>=0&&c>=0&&r<rowCount&&c<columnCount
 let row=point.row,col=point.col
 if(!valid(row+dr,col+dc))return point
 const contiguous=!!read(row,col)&&!!read(row+dr,col+dc)
 while(valid(row+dr,col+dc)){
  const next=!!read(row+dr,col+dc)
  if(contiguous&&!next)break
  row+=dr
  col+=dc
  if(!contiguous&&next)break
 }
 return {row,col}
}
export function currentRegion(point:CellPoint,rowCount:number,columnCount:number,read:(row:number,col:number)=>string):CellRange{
 let top=point.row,bottom=point.row,left=point.col,right=point.col,changed=true
 while(changed){
  changed=false
  if(top>0&&Array.from({length:right-left+1},(_,i)=>read(top-1,left+i)).some(Boolean)){
   top--
   changed=true
  }
  if(bottom+1<rowCount&&Array.from({length:right-left+1},(_,i)=>read(bottom+1,left+i)).some(Boolean)){
   bottom++
   changed=true
  }
  if(left>0&&Array.from({length:bottom-top+1},(_,i)=>read(top+i,left-1)).some(Boolean)){
   left--
   changed=true
  }
  if(right+1<columnCount&&Array.from({length:bottom-top+1},(_,i)=>read(top+i,right+1)).some(Boolean)){
   right++
   changed=true
  }
 }
 return {anchor:{row:top,col:left},end:{row:bottom,col:right}}
}
export function pasteRange(selection:CellRange,values:string[][],columnCount:number){
 const area=bounds(selection),height=area.bottom-area.top+1,width=area.right-area.left+1
 const sourceHeight=values.length,sourceWidth=values[0]?.length||1
 const single=height===1&&width===1
 if(!single&&(height%sourceHeight||width%sourceWidth))throw new Error('The destination must match the copied range or contain whole repetitions of it')
 const targetHeight=single?sourceHeight:height,targetWidth=single?sourceWidth:width
 if(area.left+targetWidth>columnCount)throw new Error('The pasted range extends beyond the last column')
 if(targetHeight*targetWidth>MAX_BULK_CELLS)throw new Error(`Select or paste at most ${MAX_BULK_CELLS} cells at once`)
 return Array.from({length:targetHeight},(_,r)=>Array.from({length:targetWidth},(_,c)=>({row:area.top+r,col:area.left+c,value:values[r%sourceHeight][c%sourceWidth]}))).flat()
}
export function validatedValue(field:SheetField,value:string,technicians:Array<{id:string,full_name:string}>){
 if(field.readOnly||field.type==='computed'||field.type==='controller')throw new Error(`${field.label} is read-only`)
 if(field.type==='technician'&&value){
  const matches=technicians.filter(t=>t.id===value||t.full_name.trim().toLowerCase()===value.trim().toLowerCase())
  if(matches.length!==1)throw new Error(`Select a valid, unambiguous ${field.label}: ${value}`)
  return matches[0].id
 }
 if(field.options?.length&&value&&!field.options.includes(value))throw new Error(`${field.label}: choose one of the allowed values`)
 return value
}
