import { Badge } from '../../../components/Badge';

export function GridSaveStatus({pending,saving=false,failed=false}:{pending:number;saving?:boolean;failed?:boolean}){
 return <span role="status" className="inline-flex min-h-8 items-center">
  {failed?<Badge size="sm" variant="danger" dot>Save needs attention</Badge>:
   saving?<Badge size="sm" variant="info" dot>Saving…</Badge>:
   pending>0?<Badge size="sm" variant="warning" dot>{pending} {pending===1?'row':'rows'} to save</Badge>:
   <span className="text-xs text-neutral-500 dark:text-neutral-400">All changes saved</span>}
 </span>;
}
