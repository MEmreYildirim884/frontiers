import { env } from 'cloudflare:workers';
import {RoomRouter,D1Store} from '../../../server/rooms.js';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function handle(request:Request){
 try{
  if(!env.DB)return json({error:'Ortak kayıt sistemi henüz hazır değil. Biraz sonra tekrar dene.'},503);
  const router=new RoomRouter(new D1Store(env.DB));
  const token=request.headers.get('Authorization')?.replace(/^Bearer /,'')??'';
  if(request.method==='GET'){const q=new URL(request.url).searchParams;return json(await router.handle('GET',token,{probe:q.get('probe')==='1'},q.get('code')));}
  if(Number(request.headers.get('content-length')??0)>12000)return json({error:'İstek çok büyük.'},413);
  const text=await request.text();if(text.length>12000)return json({error:'İstek çok büyük.'},413);
  const input=JSON.parse(text);
  const status=input.op==='create'||input.op==='join'?201:200;
  return json(await router.handle('POST',token,input),status);
 }catch(e:any){return json({error:e.status?e.message:(e instanceof SyntaxError?'Geçersiz istek.':'İşlem tamamlanamadı. Yenileyip tekrar dene.')},e.status??(e instanceof SyntaxError?400:500));}
}
export const GET=handle;export const POST=handle;
