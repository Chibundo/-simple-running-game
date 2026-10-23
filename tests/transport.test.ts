import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/index';
import { DEFAULT_LOOK } from '../shared/config';
import type { ServerMessage } from '../shared/protocol';
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function client(url:string){
  const ws=new WebSocket(url),messages:ServerMessage[]=[];ws.on('message',data=>messages.push(JSON.parse(data.toString())));
  await new Promise<void>((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject)});
  return {ws,messages,send:(v:unknown)=>ws.send(JSON.stringify(v)),wait:async(predicate:(m:ServerMessage)=>boolean)=>{
    const deadline=Date.now()+3000;while(Date.now()<deadline){const m=messages.find(predicate);if(m)return m;await delay(10)}throw Error('Message timeout');
  }};
}
async function fixture(){
  const game=createGameServer({settings:{durationMs:250,countdownMs:100,reconnectGraceMs:200}});
  await new Promise<void>(resolve=>game.server.listen(0,'127.0.0.1',resolve));
  const address=game.server.address();if(!address||typeof address==='string')throw Error('No port');
  return{...game,base:`http://127.0.0.1:${address.port}`,url:`ws://127.0.0.1:${address.port}/ws`};
}
const runner=(alias:string)=>({alias,speed:1,earned:0,look:{...DEFAULT_LOOK}});
test('real WebSockets: malformed/forged actions fail, two clients race and only server calculates results',async()=>{
  const game=await fixture();
  try{
    const a=await client(game.url),b=await client(game.url);
    a.ws.send('{broken');assert.equal((await a.wait(m=>m.type==='error')).type,'error');
    a.send({type:'create',player:runner('<b>A</b>')});const session=await a.wait(m=>m.type==='session');assert.equal(session.type,'session');if(session.type!=='session')throw Error();
    b.send({type:'join',code:session.code,player:runner('B')});await b.wait(m=>m.type==='session');
    a.send({type:'results',distance:1e10});await a.wait(m=>m.type==='error'&&m.message==='Unsupported message.');
    a.send({type:'ready',ready:true,player:runner('A')});b.send({type:'ready',ready:true,player:runner('B')});
    await a.wait(m=>m.type==='state'&&m.room.players.every(p=>p.ready));a.send({type:'start'});
    const result=await b.wait(m=>m.type==='state'&&m.room.phase==='results');if(result.type!=='state')throw Error();
    assert.deepEqual(result.room.players.map(p=>p.place),[1,1]);assert.ok(Math.abs(result.room.players[0].distance-1609.344*.25/3600)<1e-9);
    assert.equal(JSON.stringify(result).includes(session.token),false);
    const health=await fetch(game.base+'/health');assert.deepEqual(await health.json(),{ok:true});
  }finally{await game.close()}
});
test('transport limits message rates and oversized payloads and blocks other browser origins',async()=>{
  const game=await fixture();
  try{
    const a=await client(game.url);const closed=new Promise<number>(resolve=>a.ws.once('close',code=>resolve(code)));
    for(let i=0;i<25;i++)a.send({type:'start'});assert.equal(await closed,1008);
    const b=await client(game.url);const largeClosed=new Promise<number>(resolve=>b.ws.once('close',code=>resolve(code)));b.ws.send('x'.repeat(5000));assert.equal(await largeClosed,1009);
    const bad=new WebSocket(game.url,{origin:'https://unrelated.example'});
    const rejected=await new Promise<string>(resolve=>bad.once('error',error=>resolve(error.message)));assert.match(rejected,/403/);
  }finally{await game.close()}
});
