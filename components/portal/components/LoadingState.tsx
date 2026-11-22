export function LoadingState({message='Loading data…'}:{message?:string}){
 return <div role="status" className="flex min-h-24 items-center justify-center gap-3 rounded-lg px-4 py-5 text-sm font-medium text-neutral-600 dark:text-neutral-300">
  <span aria-hidden="true" className="size-5 shrink-0 rounded-full border-2 border-primary-200 border-t-primary-600 motion-safe:animate-spin dark:border-primary-900 dark:border-t-primary-300"/>
  <span>{message}</span>
 </div>;
}
