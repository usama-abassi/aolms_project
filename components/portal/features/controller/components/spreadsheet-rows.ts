export const hasCellData=(values:Record<string,string>)=>Object.values(values).some(value=>value.trim().length>0);

// Keep one reusable empty row. Editing overlays keep a just-typed row mounted
// until its value is committed, without counting it as a record yet.
export function withEmptyRow<T extends {id:string;values:Record<string,string>}>(rows:T[],stored:(row:T)=>boolean,create:()=>T,editing:Record<string,Record<string,string>>={},preferred?:string):T[]{
 const populated=rows.filter(row=>stored(row)||hasCellData(row.values)||hasCellData({...row.values,...editing[row.id]}));
 const ids=new Set(populated.map(row=>row.id));
 const empty=rows.filter(row=>!ids.has(row.id));
 return [...populated,empty.find(row=>row.id===preferred)||empty.at(-1)||create()];
}

export function gridDestination(row:number,col:number,key:string,shift:boolean,columns:number){
 if(key==='Tab'){
  const index=row*columns+col+(shift?-1:1);
  return index<0?null:{row:Math.floor(index/columns),col:index%columns};
 }
 const next={row:row+((key==='Enter'?shift?-1:1:key==='ArrowDown'?1:key==='ArrowUp'?-1:0)),col:col+(key==='ArrowRight'?1:key==='ArrowLeft'?-1:0)};
 return next.row<0||next.col<0||next.col>=columns?null:next;
}

// The extra empty row belongs to the last real page, even at exact multiples of 25.
export const gridPage=(row:number,recordCount:number)=>Math.min(Math.floor(row/25),Math.max(0,Math.ceil(recordCount/25)-1));
