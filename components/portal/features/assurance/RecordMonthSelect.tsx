const monthFormat=new Intl.DateTimeFormat('en',{month:'long',year:'numeric',timeZone:'UTC'});
export default function RecordMonthSelect({months,value,onChange}:{months:string[];value:string;onChange:(value:string)=>void}){
 const options=[...new Set([...months,...(value?[value]:[])])].sort().reverse();
 return <label className="inline-flex flex-wrap items-center gap-2 text-sm">Month
  <select value={value} onChange={event=>onChange(event.target.value)} className="rounded-lg border bg-transparent p-2 dark:border-neutral-600">
   <option value="">All months</option>
   {options.map(month=><option value={month} key={month}>{/^\d{4}-(0[1-9]|1[0-2])$/.test(month)?monthFormat.format(new Date(month+'-01T00:00:00Z')):month}</option>)}
  </select></label>;
}
