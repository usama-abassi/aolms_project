'use client'
import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react'
import {randomId} from '../../../lib/uuid'
import {bounds,boundary,currentRegion,parseClipboard,clipboardText,clipboardHtml,pasteRange,samePoint,validatedValue,MAX_BULK_CELLS,type CellPoint,type CellRange,type CellWrite,type CellChange,type SheetRow,type SheetField} from './spreadsheet-selection'

type Props={rows:SheetRow[],fields:SheetField[],technicians:Array<{id:string,full_name:string}>,apply:(writes:CellWrite[])=>CellChange[],focus:(row:number,col:number)=>void,disabled?:boolean,children:ReactNode}
type Drag={mode:'select'|'fill',source:CellRange,pointerId:number,x:number,y:number}
export default function SpreadsheetInteraction({rows,fields,technicians,apply,focus,disabled=false,children}:Props){
 const root=useRef<HTMLDivElement>(null),drag=useRef<Drag|null>(null),history=useRef<CellChange[][]>([]),future=useRef<CellChange[][]>([])
 const restoreFocus=useRef(false)
 const dropdownEdit=useRef<CellChange|null>(null)
 const [selection,setSelection]=useState<CellRange|null>(null),[preview,setPreview]=useState<CellRange|null>(null),[message,setMessage]=useState(''),[handle,setHandle]=useState<{left:number,top:number}|null>(null)
 const latest=useRef({rows,fields,technicians,apply,focus,disabled,selection,preview})
 const commitCell=useRef<(target:EventTarget|null,value:string)=>boolean>(()=>false)
 latest.current={rows,fields,technicians,apply,focus,disabled,selection,preview}
 const read=(r:number,c:number)=>rows[r]?.values[fields[c]?.key]??''
 function point(target:EventTarget|null){
  if(!(target instanceof Element))return null
  const el=target.closest('[data-cell]')||target.closest('td')?.querySelector('[data-cell]')
  if(!el||!root.current?.contains(el))return null
  const [row,col]=el.getAttribute('data-cell')!.split(':').map(Number)
  return {row,col}
 }
 function editing(target:EventTarget|null){
  return target instanceof HTMLElement&&(target.dataset.editing==='true'||target.dataset.gridEditing==='true')
 }
 function select(next:CellRange,move=true){
  const current=latest.current.selection
  if(!current||!samePoint(current.anchor,next.anchor)||!samePoint(current.end,next.end)){
   latest.current.selection=next
   setSelection(next)
  }
  setPreview(null)
  if(move){
   const cell=root.current?.querySelector<HTMLElement>(`[data-cell="${next.end.row}:${next.end.col}"]`)
   if(cell)cell.focus()
   else focus(next.end.row,next.end.col)
  }
 }
 function rememberChanges(changes:CellChange[]){
  if(!changes.length)return
  history.current.push(changes)
  future.current=[]
  while(history.current.length>50||history.current.length>1&&history.current.reduce((n,h)=>n+h.length,0)>100000)history.current.shift()
 }
 function operation(writes:CellWrite[],remember=true){
  if(disabled)return false
  try{
   if(writes.length>MAX_BULK_CELLS)throw new Error(`Change at most ${MAX_BULK_CELLS} cells at once`)
   const normalized=writes.map(w=>{
    const field=fields.find(f=>f.key===w.key)
    if(!field)throw new Error('This column is no longer available')
    return {...w,value:validatedValue(field,w.value,technicians)}
   })
   const focused=!!root.current?.contains(document.activeElement)
   const changes=apply(normalized)
   restoreFocus.current=changes.length>0&&focused
   if(remember)rememberChanges(changes)
   setMessage(changes.length?`${changes.length} cells changed`:'No values changed')
   return true
  }catch(e){
   setMessage((e as Error).message)
   return false
  }
 }
 function writeCells(cells:Array<CellPoint&{value:string}>){
  const newRows=new Map<number,string>()
  return operation(cells.map(cell=>{
   if(!newRows.has(cell.row))newRows.set(cell.row,rows[cell.row]?.id||randomId())
   return {id:newRows.get(cell.row)!,key:fields[cell.col].key,value:cell.value}
  }))
 }
 function beginDropdown(p:CellPoint){
  dropdownEdit.current={id:rows[p.row].id,key:fields[p.col].key,before:read(p.row,p.col),value:read(p.row,p.col)}
 }
 function finishDropdown(cancel=false){
  const edit=dropdownEdit.current
  dropdownEdit.current=null
  if(!edit||edit.value===edit.before)return
  if(cancel)operation([{id:edit.id,key:edit.key,value:edit.before}],false)
  else rememberChanges([edit])
 }
 commitCell.current=(target,value)=>{
  const p=point(target)
  return !!p&&writeCells([{...p,value}])
 }
 useEffect(()=>{
  const element=root.current
  const commit=(event:Event)=>{
   const detail=(event as CustomEvent<{value:string,accepted:boolean}>).detail
   event.preventDefault()
   detail.accepted=commitCell.current(event.target,detail.value)
  }
  element?.addEventListener('spreadsheet-commit',commit)
  return()=>element?.removeEventListener('spreadsheet-commit',commit)
 },[])
 function cells(range:CellRange){
  const b=bounds(range)
  if((b.bottom-b.top+1)*(b.right-b.left+1)>MAX_BULK_CELLS)throw new Error(`Select at most ${MAX_BULK_CELLS} cells for this operation`)
  return Array.from({length:b.bottom-b.top+1},(_,r)=>Array.from({length:b.right-b.left+1},(_,c)=>({row:b.top+r,col:b.left+c}))).flat()
 }
 function clear(){
  if(selection)try{return writeCells(cells(selection).map(p=>({...p,value:''})))}catch(e){setMessage((e as Error).message)}
  return false
 }
 function undo(redo=false){
  const source=redo?future.current:history.current,destination=redo?history.current:future.current,changes=source.at(-1)
  if(changes&&operation(changes.map(c=>({id:c.id,key:c.key,value:redo?c.value:c.before})),false)){
   source.pop()
   destination.push(changes)
  }
 }
 function fillDown(){
  if(!selection)return
  const b=bounds(selection)
  if(b.top===b.bottom&&b.top===0)return
  try{writeCells(cells(selection).filter(p=>b.top===b.bottom||p.row>b.top).map(p=>({...p,value:read(b.top===b.bottom?b.top-1:b.top,p.col)})))}catch(e){setMessage((e as Error).message)}
 }
 function copy(event:React.ClipboardEvent,cut=false){
  if(!selection||!point(event.target)||editing(event.target)||disabled)return
  event.preventDefault()
  try{
   const b=bounds(selection)
   cells(selection)
   const values=Array.from({length:b.bottom-b.top+1},(_,r)=>Array.from({length:b.right-b.left+1},(_,c)=>{
    const value=read(b.top+r,b.left+c)
    return fields[b.left+c].type==='technician'?technicians.find(t=>t.id===value)?.full_name||value:value
   }))
   const text=clipboardText(values)
   if(event.clipboardData){
    event.clipboardData.setData('text/plain',text)
    event.clipboardData.setData('text/html',clipboardHtml(values))
    if(cut&&!clear())return
   }
   else if(navigator.clipboard)void navigator.clipboard.writeText(text).then(()=>{if(cut)clear()}).catch(()=>setMessage('Clipboard access was denied. Use the browser copy command.'))
   else throw new Error('Clipboard access is unavailable in this browser')
   setMessage(cut?'Selection cut':'Selection copied')
  }catch(e){setMessage((e as Error).message)}
 }
 function paste(event:React.ClipboardEvent){
  if(!selection||!point(event.target)||editing(event.target)||disabled)return
  event.preventDefault()
  event.stopPropagation()
  try{
   const data=event.clipboardData.getData('text/plain')
   const targets=pasteRange(selection,parseClipboard(data),fields.length)
   if(writeCells(targets)){
    const first=targets[0],last=targets.at(-1)!
    select({anchor:first,end:last},false)
   }
  }catch(e){setMessage((e as Error).message)}
 }
 function key(event:React.KeyboardEvent){
  const p=point(event.target)
  if(!p||disabled||event.nativeEvent.isComposing)return
  const mod=event.ctrlKey||event.metaKey,k=event.key
  if(editing(event.target)){
   if(event.target instanceof HTMLSelectElement&&['Escape','Enter','Tab'].includes(k)){
    event.target.dataset.gridEditing='false'
    event.preventDefault()
    event.stopPropagation()
    finishDropdown(k==='Escape')
    if(k!=='Escape')navigate(p,k,event.shiftKey,false)
   }
   return
  }
  if(k==='F2'&&event.target instanceof HTMLSelectElement){
   beginDropdown(p)
   event.target.dataset.gridEditing='true'
   event.stopPropagation()
   return
  }
  if(event.altKey&&k==='ArrowDown'&&event.target instanceof HTMLSelectElement){
   beginDropdown(p)
   event.target.dataset.gridEditing='true'
   return
  }
  if(mod&&['c','v','x'].includes(k.toLowerCase()))return
  const handled=(action:()=>void)=>{
   event.preventDefault()
   event.stopPropagation()
   action()
  }
  if(mod&&k.toLowerCase()==='a')return handled(()=>{
   const region=currentRegion(p,rows.length,fields.length,read)
   const previous=selection&&bounds(selection),next=bounds(region)
   const full=!read(p.row,p.col)||previous&&JSON.stringify(previous)===JSON.stringify(next)
   select(full?{anchor:{row:0,col:0},end:{row:rows.length-1,col:fields.length-1}}:region,false)
  })
  if(mod&&k.toLowerCase()==='d')return handled(fillDown)
  if(mod&&k.toLowerCase()==='z')return handled(()=>undo(event.shiftKey))
  if(mod&&k.toLowerCase()==='y')return handled(()=>undo(true))
  if(k==='Escape')return handled(()=>select({anchor:p,end:p},false))
  if(k==='Delete'||k==='Backspace')return handled(clear)
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab','Enter'].includes(k)&&!event.altKey)return handled(()=>navigate(p,k,event.shiftKey,mod))
 }
 function navigate(p:CellPoint,key:string,shift:boolean,mod:boolean){
  const from=selection?.end||p
  let target=from
  if(key==='Tab'){
   const index=from.row*fields.length+from.col+(shift?-1:1)
   target={row:Math.floor(index/fields.length),col:((index%fields.length)+fields.length)%fields.length}
  }else if(key==='Enter')target={row:from.row+(shift?-1:1),col:from.col}
  else if(mod)target=boundary(from,key,rows.length,fields.length,read)
  else target={row:from.row+(key==='ArrowDown'?1:key==='ArrowUp'?-1:0),col:from.col+(key==='ArrowRight'?1:key==='ArrowLeft'?-1:0)}
  target={row:Math.max(0,Math.min(rows.length-1,target.row)),col:Math.max(0,Math.min(fields.length-1,target.col))}
  select({anchor:shift&&key.startsWith('Arrow')?(selection?.anchor||p):target,end:target})
 }
 function pointerDown(event:React.PointerEvent){
  if(disabled||event.button!==0||editing(event.target))return
  const p=point(event.target)
  if(!p)return
  const range={anchor:event.shiftKey&&selection?selection.anchor:p,end:p}
  select(range,false)
  if(event.target instanceof HTMLSelectElement&&!event.shiftKey)return
  event.preventDefault()
  focus(p.row,p.col)
  drag.current={mode:'select',source:range,pointerId:event.pointerId,x:event.clientX,y:event.clientY}
 }
 function fillStart(event:React.PointerEvent){
  if(!selection||disabled)return
  event.preventDefault()
  event.stopPropagation()
  drag.current={mode:'fill',source:selection,pointerId:event.pointerId,x:event.clientX,y:event.clientY}
  root.current?.setPointerCapture(event.pointerId)
 }
 function movePointer(x:number,y:number){
  const d=drag.current
  if(!d)return
  d.x=x
  d.y=y
  const scroller=root.current?.querySelector<HTMLElement>('[data-grid-scroll]')
  const rect=scroller?.getBoundingClientRect()
  const p=point(document.elementFromPoint(rect?Math.max(rect.left+2,Math.min(rect.right-2,x)):x,rect?Math.max(rect.top+35,Math.min(rect.bottom-2,y)):y))
  if(!p)return
  if(d.mode==='select')select({anchor:d.source.anchor,end:p},false)
  else{
   const b=bounds(d.source),vertical=Math.abs(p.row-b.bottom)>=Math.abs(p.col-b.right)
   const next={anchor:{row:vertical?Math.min(b.top,p.row):b.top,col:vertical?b.left:Math.min(b.left,p.col)},end:{row:vertical?Math.max(b.bottom,p.row):b.bottom,col:vertical?b.right:Math.max(b.right,p.col)}}
   const current=latest.current.preview
   if(!current||!samePoint(current.anchor,next.anchor)||!samePoint(current.end,next.end)){
    latest.current.preview=next
    setPreview(next)
   }
  }
 }
 function endPointer(cancel=false){
  const d=drag.current,target=latest.current.preview
  drag.current=null
  setPreview(null)
  if(!d)return
  if(root.current?.hasPointerCapture(d.pointerId))root.current.releasePointerCapture(d.pointerId)
  if(!cancel&&d.mode==='fill'&&target){
   const b=bounds(d.source),height=b.bottom-b.top+1,width=b.right-b.left+1
   try{
    const writes=cells(target).filter(p=>p.row<b.top||p.row>b.bottom||p.col<b.left||p.col>b.right).map(p=>{
     const sourceRow=b.top+((p.row-b.top)%height+height)%height,sourceCol=b.left+((p.col-b.left)%width+width)%width
     const value=read(sourceRow,sourceCol)
     return {...p,value:fields[sourceCol].type==='technician'&&fields[p.col].type!=='technician'?technicians.find(t=>t.id===value)?.full_name||value:value}
    })
    if(writeCells(writes))select(target,false)
   }catch(e){setMessage((e as Error).message)}
  }
 }
 useEffect(()=>{
  let frame=0
  const move=(event:PointerEvent)=>{
   movePointer(event.clientX,event.clientY)
   if(drag.current&&!frame)frame=requestAnimationFrame(scroll)
  }
  const up=()=>endPointer()
  const cancel=()=>endPointer(true)
  const scroll=()=>{
   frame=0
   const d=drag.current,el=root.current?.querySelector<HTMLElement>('[data-grid-scroll]')
   if(d&&el){
    const r=el.getBoundingClientRect(),speed=(pos:number,start:number,end:number)=>pos<start+28?-18:pos>end-28?18:0
    const dx=speed(d.x,r.left,r.right),dy=speed(d.y,r.top,r.bottom)
    if(dx||dy){el.scrollBy(dx,dy);movePointer(d.x,d.y)}
   }
   if(drag.current)frame=requestAnimationFrame(scroll)
  }
  if(drag.current)frame=requestAnimationFrame(scroll)
  window.addEventListener('pointermove',move)
  window.addEventListener('pointerup',up)
  window.addEventListener('pointercancel',cancel)
  return()=>{
   cancelAnimationFrame(frame)
   window.removeEventListener('pointermove',move)
   window.removeEventListener('pointerup',up)
   window.removeEventListener('pointercancel',cancel)
  }
 })
 useLayoutEffect(()=>{
  const container=root.current
  if(!container)return
  if(selection){
   const clamp=(p:CellPoint)=>({row:Math.max(0,Math.min(rows.length-1,p.row)),col:Math.max(0,Math.min(fields.length-1,p.col))})
   const next={anchor:clamp(selection.anchor),end:clamp(selection.end)}
   if(!samePoint(next.anchor,selection.anchor)||!samePoint(next.end,selection.end)){
    latest.current.selection=next
    setSelection(next)
    if(restoreFocus.current||container.contains(document.activeElement))focus(next.end.row,next.end.col)
   }
  }
  const paint=()=>{
   const active=latest.current.selection,area=latest.current.preview||active
   const b=area&&bounds(area)
   for(const el of container.querySelectorAll<HTMLElement>('[data-cell]')){
    const [row,col]=el.dataset.cell!.split(':').map(Number),td=el.closest('td')!
    const selected=!!b&&row>=b.top&&row<=b.bottom&&col>=b.left&&col<=b.right
    td.classList.toggle('spreadsheet-selected',selected)
    td.classList.toggle('spreadsheet-active',!!active&&samePoint({row,col},active.end))
    td.dataset.selected=String(selected)
    td.style.boxShadow=selected?[
     row===b!.top?'inset 0 2px #059669':'',row===b!.bottom?'inset 0 -2px #059669':'',
     col===b!.left?'inset 2px 0 #059669':'',col===b!.right?'inset -2px 0 #059669':'',
    ].filter(Boolean).join(','):''
   }
   const edge=b&&container.querySelector<HTMLElement>(`[data-cell="${b.bottom}:${b.right}"]`)?.closest('td')
   if(edge&&active){
    const cell=edge.getBoundingClientRect(),outer=container.getBoundingClientRect(),scroll=container.querySelector<HTMLElement>('[data-grid-scroll]')?.getBoundingClientRect()
    const shown=!scroll||cell.right<=scroll.right&&cell.right>=scroll.left&&cell.bottom<=scroll.bottom&&cell.bottom>=scroll.top
    const next=shown?{left:cell.right-outer.left-4,top:cell.bottom-outer.top-4}:null
    setHandle(previous=>previous?.left===next?.left&&previous?.top===next?.top?previous:next)
   }else setHandle(null)
  }
  paint()
  restoreFocus.current=false
  container.addEventListener('scroll',paint,true)
  window.addEventListener('resize',paint)
  return()=>{
   container.removeEventListener('scroll',paint,true)
   window.removeEventListener('resize',paint)
  }
 },[selection,preview,rows,fields])
 return <div ref={root} className="relative" onKeyDownCapture={key} onCopyCapture={e=>copy(e)} onCutCapture={e=>copy(e,true)} onPasteCapture={paste}
  onChangeCapture={e=>{
   if(e.target instanceof HTMLSelectElement&&point(e.target)){
    e.stopPropagation()
    if(e.target.dataset.gridEditing==='true'&&dropdownEdit.current){
     const edit=dropdownEdit.current,value=e.target.value
     if(operation([{id:edit.id,key:edit.key,value}],false))edit.value=value
     return
    }
    if(!commitCell.current(e.target,e.target.value)){
     const p=point(e.target)!
     e.target.value=read(p.row,p.col)
    }
   }
  }}
  onBlurCapture={e=>{
   if(e.target instanceof HTMLSelectElement&&e.target.dataset.gridEditing==='true'){
    e.target.dataset.gridEditing='false'
    finishDropdown()
   }
  }}
  onFocusCapture={e=>{
   const p=point(e.target),active=latest.current.selection
   if(p&&(!active||!samePoint(p,active.end)))select({anchor:p,end:p},false)
  }}
  onPointerDownCapture={pointerDown}>
  <style>{`.spreadsheet-selected{background-color:rgba(16,185,129,.09)!important}.spreadsheet-active{outline:2px solid #059669;outline-offset:-2px}.spreadsheet-selected textarea:not([data-editing="true"]){user-select:none}`}</style>
  {children}
  {handle&&!disabled&&<button type="button" tabIndex={-1} aria-label="Drag to fill selected cells" data-fill-handle className="absolute z-40 h-2 w-2 cursor-crosshair border border-white bg-emerald-600" style={handle} onPointerDown={fillStart}/>}
  {message&&<p role="status" className="mt-1 text-xs text-neutral-500">{message}</p>}
 </div>
}
