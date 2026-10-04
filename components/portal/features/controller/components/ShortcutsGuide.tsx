'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '../../../components/Button';
import {Modal} from '../../../components/Modal';

const sections = [
 {title:'Entering data',rows:[['Start typing in a selected cell','Just type (replaces content)'],['Edit without erasing','F2 or double-click'],['Commit and save, move down / up','Enter / Shift+Enter'],['Commit and save, move right / left','Tab / Shift+Tab'],['Return to the starting column on the next row','Enter after a sequence of Tabs'],['Cancel the current edit','Esc'],['New line inside a cell','Alt+Enter'],['Clear the selected cell','Delete / Backspace'],["Insert today's date (Bahrain)",'Ctrl+;'],['Insert current time (Bahrain)','Ctrl+Shift+;'],['Insert date and time (Bahrain)','Ctrl+Alt+Shift+;']]},
 {title:'Moving around',rows:[['Move between selected cells','Arrow keys'],['Move left / right between grid cells while editing','Alt+Arrow Left / Alt+Arrow Right'],['Move within text while editing','Arrow Left / Arrow Right'],['Beginning / end of text while editing','Home / End']]},
 {title:'Selecting text',rows:[['Extend text selection while editing','Shift+Arrow Left / Shift+Arrow Right'],['Select all text in the focused input','Ctrl+A']]},
 {title:'Copy and paste text',rows:[['Copy selected text','Ctrl+C'],['Cut selected text while editing','Ctrl+X'],['Paste text into the focused cell','Ctrl+V']]},
 {title:'Guide',rows:[['Open / close this guide','Ctrl+/'],['Close this guide','Esc'],['Search this guide','Type in Search shortcuts'],['Print the guide or save a PDF','Print / Save as PDF button']]},
];
const quickStart=[
 'Click Add row, select an editable cell and start typing.',
 'Press Tab to move right, then Enter to return to the starting column on the next row.',
 "Use Ctrl+; to insert today's Bahrain date. Commit with Enter or Tab.",
 'Use F2 or double-click to edit existing text. Esc cancels the current uncommitted edit.',
 'Committed changes save automatically. Valid drafts become official records; red corner notes explain fields that need attention.',
];
const differences=[
 'Grey cells with a lock icon (Controller, SLA and KPI) are read-only. Their automatic values cannot be overwritten by typing.',
 'A red corner marker means a required field is missing or text cannot be matched. Hover over the cell to read the note. Your exact typed text is saved.',
 'The colored strip and row label show draft, pending or saved status. Drafts become official records automatically when valid.',
 'An invalid edit to an existing record stays as a draft. Technician tasks and reports continue using the last valid official record.',
 'Dates are kept exactly as typed. For validation, use YYYY-MM-DD or DD/MM/YYYY, with HH:mm for time. The grid uses Bahrain time.',
 'Every committed edit saves automatically; there is no Save button. Failed requests retain the text and retry. Uncommitted typing can be cancelled with Esc.',
 'Delete and Backspace clear one selected cell in Phase 1. While editing, they delete text normally. Multi-cell selection and clearing are coming in Phase 2.',
 'Row archiving, column hiding and View > Hidden columns are not available yet.',
];
const unsupported='Not available yet: Name Box, data-edge jumps, multi-cell/range selection, multi-cell paste, fill shortcuts and fill handle, grid undo/redo, row/column insertion or deletion shortcuts, grid find/replace, spreadsheet context menus, and cell formatting. Ctrl+F, Ctrl+H and some other keys may invoke browser features instead. These remain for phases 2–4.';
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

export default function ShortcutsGuide({userId}:{userId:string}){
 const [open,setOpen]=useState(false),[search,setSearch]=useState(''),[help,setHelp]=useState(false),[tip,setTip]=useState(false),[mac,setMac]=useState(false);
 const lastCell=useRef<HTMLElement|null>(null),restore=useRef<HTMLElement|null>(null);
 const selection=useRef<[number|null,number|null]|null>(null);
 const openRef=useRef(false);
 const printFrame=useRef<HTMLIFrameElement|null>(null);
 const searchInput=useRef<HTMLInputElement|null>(null);
 const keys=(s:string)=>mac?s.replaceAll('Ctrl','Cmd').replaceAll('Alt','Option'):s;
 function close(){
  setOpen(false);openRef.current=false;
  requestAnimationFrame(()=>{
   const target=restore.current;
   if(target?.isConnected){target.focus({preventScroll:true});if((target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement)&&selection.current){try{target.setSelectionRange(...selection.current);}catch{/* Date inputs do not expose a text selection. */}}}
  });
 }
 function show(){
  const focused=document.activeElement instanceof HTMLElement?document.activeElement:null;
  restore.current=focused?.matches('[data-cell]')?focused:lastCell.current||focused;
  const target=restore.current;
  selection.current=target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement?[target.selectionStart,target.selectionEnd]:null;
  setHelp(false);setSearch('');setOpen(true);openRef.current=true;
 }
 useEffect(()=>{
  setMac(/Mac|iPhone|iPad/.test(navigator.platform));
  const key=`aolms:shortcuts-tip:v1:${userId}`;
  try{if(!localStorage.getItem(key)){setTip(true);localStorage.setItem(key,'seen');}}catch{/* Storage restrictions must not interrupt entry. */}
  const focus=(e:FocusEvent)=>{if(e.target instanceof HTMLElement&&e.target.matches('[data-cell]'))lastCell.current=e.target;};
  const keyboard=(e:KeyboardEvent)=>{
   if((e.ctrlKey||e.metaKey)&&!e.altKey&&!e.shiftKey&&(e.key==='/'||e.code==='Slash')){e.preventDefault();if(openRef.current)close();else show();}
  };
  document.addEventListener('focusin',focus);document.addEventListener('keydown',keyboard);
  return()=>{document.removeEventListener('focusin',focus);document.removeEventListener('keydown',keyboard);printFrame.current?.remove();};
 },[userId]);
 function print(){
  printFrame.current?.remove();
  const frame=document.createElement('iframe');printFrame.current=frame;frame.title='Printable shortcuts guide';
  frame.style.cssText='position:fixed;width:0;height:0;border:0;';
  const list=(items:string[])=>items.map(item=>`<li>${escapeHtml(keys(item))}</li>`).join('');
  frame.srcdoc=`<!doctype html><html><head><title>Service Delivery shortcuts guide</title><style>body{font:12px Arial,sans-serif;color:#172033;margin:24px}h1{font-size:22px}h2{font-size:15px;margin-top:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:7px;text-align:left}tr{break-inside:avoid}li{margin:5px 0}.note{background:#fff7e0;padding:12px} @page{margin:15mm}</style></head><body><h1>Service Delivery shortcuts guide</h1><h2>Quick start, 5 steps</h2><ol>${list(quickStart)}</ol><div class="note"><h2>Things that work differently here</h2><ul>${list(differences)}</ul></div>${sections.map(section=>`<h2>${escapeHtml(section.title)}</h2><table><thead><tr><th>Action</th><th>Shortcut</th></tr></thead><tbody>${section.rows.map(([action,key])=>`<tr><td>${escapeHtml(action)}</td><td>${escapeHtml(keys(key))}</td></tr>`).join('')}</tbody></table>`).join('')}<h2>Not implemented</h2><p>${escapeHtml(unsupported)}</p><h2>Mac users</h2><p>Use Cmd instead of Ctrl, and Option instead of Alt. Native text editing keys may depend on your keyboard and browser.</p></body></html>`;
  frame.onload=()=>{if(frame.contentWindow)frame.contentWindow.onafterprint=()=>searchInput.current?.focus();frame.contentWindow?.focus();frame.contentWindow?.print();searchInput.current?.focus();};document.body.appendChild(frame);
 }
 const term=search.trim().toLowerCase();
 const matches=(s:string)=>keys(s).toLowerCase().includes(term);
 const filtered=sections.map(s=>({...s,rows:s.rows.filter(row=>matches(s.title)||matches(row.join(' ')))})).filter(s=>s.rows.length);
 return <>
 <Button variant="outline" onClick={show}>Shortcuts</Button>
 <div className="relative" role="menubar" aria-label="Data entry help"><Button variant="ghost" role="menuitem" aria-haspopup="menu" aria-expanded={help} onClick={()=>setHelp(v=>!v)} onKeyDown={e=>{if(e.key==='Escape')setHelp(false);}}>Help</Button>{help&&<div role="menu" className="absolute right-0 top-full z-30 rounded-lg border bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"><button role="menuitem" className="whitespace-nowrap rounded px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={show}>Keyboard shortcuts</button></div>}</div>
 {tip&&<div className="fixed bottom-3 right-3 z-40 flex max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-lg border bg-white px-3 py-2 text-xs shadow-sm dark:border-neutral-700 dark:bg-neutral-900" role="note"><span>Press {mac?'Cmd':'Ctrl'}+/ to see all shortcuts</span><button className="p-1" aria-label="Dismiss shortcuts tip" onClick={()=>setTip(false)}>×</button></div>}
 <Modal isOpen={open} onClose={close} title="Shortcuts Guide" size="full">
 <div className="space-y-5"><div className="flex flex-wrap items-end gap-3"><label className="flex-1 text-sm">Search shortcuts<input ref={searchInput} type="text" className="mt-1 block w-full rounded-lg border bg-transparent p-2 dark:border-neutral-600" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search actions or keys"/></label><Button variant="outline" onClick={print}>Print / Save as PDF</Button></div>
 {(!term||quickStart.some(matches)||matches('Quick start'))&&<section><h3 className="font-semibold">Quick start, 5 steps</h3><ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{quickStart.map(item=><li key={item}>{keys(item)}</li>)}</ol></section>}
 {(!term||differences.some(matches)||matches('Things that work differently here'))&&<section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100"><h3 className="font-semibold">Things that work differently here</h3><ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{differences.map(item=><li key={item}>{item}</li>)}</ul></section>}
 {filtered.map(section=><section key={section.title}><h3 className="mb-2 font-semibold">{section.title}</h3><table className="w-full text-left text-sm"><thead><tr className="border-b dark:border-neutral-700"><th className="p-2">Action</th><th className="p-2">Shortcut</th></tr></thead><tbody>{section.rows.map(([action,key])=><tr key={action} className="border-b dark:border-neutral-800"><td className="p-2">{action}</td><td className="p-2"><kbd className="inline-block rounded border bg-neutral-50 px-2 py-1 font-sans text-xs dark:border-neutral-600 dark:bg-neutral-800">{keys(key)}</kbd></td></tr>)}</tbody></table></section>)}
 {(!term||matches(unsupported))&&<section><h3 className="font-semibold">Not implemented</h3><p className="mt-2 text-sm">{unsupported}</p></section>}
 {!!term&&!filtered.length&&!quickStart.some(matches)&&!differences.some(matches)&&!matches(unsupported)&&<p role="status">No matching shortcuts.</p>}
 {!term&&<section><h3 className="font-semibold">Mac users</h3><p className="mt-2 text-sm">Use Cmd instead of Ctrl, and Option instead of Alt. Native text editing keys may depend on your keyboard and browser.</p></section>}
 </div></Modal></>;
}
