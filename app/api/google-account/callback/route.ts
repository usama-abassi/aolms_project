import {googleAccount,googleOAuthSettings,googleStateCookie} from '@/lib/services/google-sheets/google-account';
export async function GET(request:Request){
 let origin:string;try{origin=googleOAuthSettings().origin;}catch{return new Response('Google sign-in is not configured on this server.',{status:503,headers:{'Cache-Control':'no-store'}});}
 const query=new URL(request.url).searchParams;
 const cookie=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(googleStateCookie+'='))?.slice(googleStateCookie.length+1)||'';
 let result='error';try{result=await googleAccount.complete(query.get('state')||'',cookie,query.get('code'),query.has('error'));}catch{/* Never place OAuth codes, tokens or provider errors in redirects or logs. */}
 return new Response(null,{status:303,headers:{Location:`${origin}/controller/configuration?google=${result}`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Set-Cookie':`${googleStateCookie}=; HttpOnly; SameSite=Lax; Path=/api/google-account; Max-Age=0${new URL(origin).protocol==='https:'?'; Secure':''}`}});
}
