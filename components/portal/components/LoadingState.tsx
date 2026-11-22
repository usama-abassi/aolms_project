import { Skeleton } from './Skeleton';

export function LoadingState({message='Loading data…'}:{message?:string}){
 return <div role="status" className="min-h-24 space-y-3 rounded-lg px-4 py-5">
  <span className="sr-only">{message}</span>
  <Skeleton aria-hidden="true" width="min(14rem, 65%)" height={16}/>
  <Skeleton aria-hidden="true" width="100%" height={32} variant="rectangular"/>
 </div>;
}
