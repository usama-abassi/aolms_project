'use client';
import {LoadingState} from '@/components/portal/components/LoadingState';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api} from '../../assurance/api';
import {Button} from '../../../components/Button';
import {Card} from '../../../components/Card';
type Account={ready:boolean;connected:boolean;email:string|null;connected_at:string|null;can_remove:boolean;service_account_active:boolean};
export default function GoogleAccount(){
 const account=useQuery({queryKey:['google-account'],queryFn:()=>api<Account>('/google-account'),refetchOnWindowFocus:true});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const callback=typeof window!=='undefined'?new URLSearchParams(window.location.search).get('google'):null;
 async function connect(){setBusy(true);setError('');setNotice('');try{const result=await api<{url:string}>('/google-account/connect',{method:'POST'});const url=new URL(result.url);if(url.protocol!=='https:'||url.hostname!=='accounts.google.com')throw new Error('Invalid Google authorization URL');window.location.assign(url.href);}catch(e){setError((e as Error).message);setBusy(false);}}
 async function remove(){if(!window.confirm('Remove this Google account and pause Google synchronization? Existing configurations and AOLMS data will be retained.'))return;setBusy(true);setError('');setNotice('');try{const result=await api<{removed:boolean;revoked:boolean}>('/google-account',{method:'DELETE'});setNotice(result.revoked?'Google account removed. Google synchronization is paused.':'Account removed locally. Google could not confirm revocation; remove AOLMS access in your Google Account permissions as well.');await account.refetch();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <Card title="Google Account"><div className="space-y-4">
  <p className="text-sm text-neutral-500">Connect one Google account for all project and monthly spreadsheet connections. Use an account with Editor access to the configured sheets. Removing it pauses Google synchronization and keeps your configurations, saved AOLMS data, and technician responses.</p>
  {(error||account.error)&&<p role="alert" className="text-sm text-danger-600 dark:text-danger-400">{error||account.error?.message}</p>}
  {notice?<p role="status" className="text-sm">{notice}</p>:callback==='connected'&&account.data?.connected?<p role="status" className="text-sm">Google account connected.</p>:callback==='cancelled'?<p role="status" className="text-sm">Google authorization was cancelled. Your existing settings were retained.</p>:callback==='error'?<p role="alert" className="text-sm text-danger-600">Google authorization could not be completed. Try connecting again and approve the requested permissions.</p>:null}
  {account.isPending?<LoadingState message="Loading Google account…"/>:account.data&&<>
   <dl className="space-y-2 text-sm"><div><dt className="font-medium">Status</dt><dd>{account.data.connected?'Connected':'Not connected'}</dd></div>{account.data.connected&&<><div><dt className="font-medium">Google email</dt><dd className="break-all">{account.data.email}</dd></div><div><dt className="font-medium">Connected on</dt><dd>{account.data.connected_at?new Date(account.data.connected_at).toLocaleString():'—'}</dd></div></>}</dl>
   {!account.data.ready&&<p className="text-sm text-neutral-500">Google sign-in is not set up on this server yet. Ask an administrator to complete the one-time Google OAuth setup.</p>}
   {account.data.service_account_active&&<p className="text-sm text-neutral-500">The server service account is currently in use. Connecting here switches synchronization to your Google account.</p>}
   {account.data.connected?<><Button variant="danger" disabled={busy||!account.data.can_remove} onClick={()=>void remove()}>{busy?'Removing…':'Remove account'}</Button>{!account.data.can_remove&&<p className="text-sm text-neutral-500">The person who connected this account or an administrator can remove it.</p>}</>:<Button disabled={busy||!account.data.ready} onClick={()=>void connect()}>{busy?'Opening Google…':'Connect Google account'}</Button>}
  </>}
 </div></Card>;
}
