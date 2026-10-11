import { env } from 'cloudflare:workers';
import {RoomService,D1Store} from '../../../server/rooms.js';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function handle(request:Request){
 try{
  if(!env.DB)return json({error:'Ortak kayıt sistemi henüz hazır değil. Biraz sonra tekrar dene.'},503);
  const service=new RoomService(new D1Store(env.DB));
  const token=request.headers.get('Authorization')?.replace(/^Bearer /,'')??'';
  if(request.method==='GET')return json(await service.get(new URL(request.url).searchParams.get('code'),token));
  if(Number(request.headers.get('content-length')??0)>12000)return json({error:'İstek çok büyük.'},413);
  const text=await request.text();if(text.length>12000)return json({error:'İstek çok büyük.'},413);
  const input=JSON.parse(text);
  if(input.op==='create')return json(await service.create(input),201);
  if(input.op==='join')return json(await service.join(input.code,input),201);
  return json(await service.act(input.code,token,input));
 }catch(e:any){return json({error:e.status?e.message:(e instanceof SyntaxError?'Geçersiz istek.':'İşlem tamamlanamadı. Yenileyip tekrar dene.')},e.status??(e instanceof SyntaxError?400:500));}
}
export const GET=handle;export const POST=handle;
