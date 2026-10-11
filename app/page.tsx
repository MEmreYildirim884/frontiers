import {redirect} from 'next/navigation';
export default async function Home({searchParams}:{searchParams:Promise<{room?:string}>}){
 const {room}=await searchParams;
 redirect('/game/index.html'+(room?'?room='+encodeURIComponent(room):''));
}
