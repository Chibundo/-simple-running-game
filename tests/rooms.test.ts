import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LOOK } from '../shared/config';
import { Rooms, type Peer, type Settings } from '../server/rooms';
import type { ServerMessage, RoomView } from '../shared/protocol';
class Client implements Peer {
  messages: ServerMessage[]=[];closed=false;
  send(m:ServerMessage){this.messages.push(m)}close(){this.closed=true}
  state(){const m=[...this.messages].reverse().find(m=>m.type==='state');if(m?.type!=='state')throw Error('No state');return m.room}
  session(){const m=[...this.messages].reverse().find(m=>m.type==='session');if(m?.type!=='session')throw Error('No session');return m}
  error(){return [...this.messages].reverse().find(m=>m.type==='error')}
}
const input=(alias='Runner',speed=1,earned=0)=>({alias,speed,earned,look:{...DEFAULT_LOOK}});
function fixture(settings:Partial<Settings>={}){
  let now=1000000;const rooms=new Rooms(settings,()=>now),a=new Client(),b=new Client();
  rooms.receive(a,{type:'create',player:input('A')});const code=a.session().code;
  rooms.receive(b,{type:'join',code,player:input('B')});
  const ready=(c:Client,speed=1,earned=0)=>rooms.receive(c,{type:'ready',ready:true,player:input(c===a?'A':'B',speed,earned)});
  const step=(ms:number)=>{now+=ms;rooms.tick();rooms.broadcastAll();};
  return{rooms,a,b,code,ready,step};
}
test('server requires two connected ready runners, host authority and immutable race settings',()=>{
  const {rooms,a,b,code,ready}=fixture();
  rooms.receive(a,{type:'start'});assert.match(a.error()!.message,/ready/);
  ready(a);ready(b);rooms.receive(b,{type:'start'});assert.match(b.error()!.message,/host/);
  rooms.receive(a,{type:'start'});assert.equal(a.state().phase,'countdown');
  rooms.receive(a,{type:'ready',ready:true,player:input('A',10,100000)});assert.match(a.error()!.message,/lobby/);
  rooms.receive(b,{type:'world',world:'twilight'});assert.match(b.error()!.message,/host/);
  const publicState=JSON.stringify(rooms.view(rooms.rooms.get(code)!));assert.equal(publicState.includes(a.session().token),false);assert.equal(publicState.includes('token'),false);
  const alone=new Rooms(),one=new Client();alone.receive(one,{type:'create',player:input()});alone.receive(one,{type:'ready',ready:true,player:input()});alone.receive(one,{type:'start'});assert.equal(one.state().phase,'lobby');
});
test('server timing is authoritative, equal speeds tie and results are produced once',()=>{
  const {rooms,a,b,ready,step}=fixture();ready(a);ready(b);rooms.receive(a,{type:'start'});
  const start=a.state().startAt;step(1000);assert.equal(a.state().players[0].distance,0);
  step(2000);assert.equal(a.state().phase,'racing');assert.equal(a.state().startAt,start);
  step(10000);const state=a.state();assert.equal(state.elapsedMs,10000);assert.equal(state.players[0].energy,80);assert.equal(state.players[0].distance,state.players[1].distance);
  assert.ok(Math.abs(state.players[0].distance-1609.344*10/3600)<1e-9);
  assert.deepEqual(state,b.state());
  rooms.receive(a,{type:'distance',distance:999999});assert.match(a.error()!.message,/Unsupported/);
  rooms.receive(a,{type:'start',distance:999999});assert.match(a.error()!.message,/Unsupported/);
  step(35000);assert.equal(a.state().phase,'results');assert.deepEqual(a.state().players.map(x=>x.place),[1,1]);
  const results=structuredClone(a.state().players);step(50000);assert.deepEqual(a.state().players,results);
});
test('different speeds rank by distance, energy exhaustion clamps the race',()=>{
  const {rooms,a,b,ready,step}=fixture({durationMs:90000});ready(a,2);ready(b,1);rooms.receive(a,{type:'start'});step(80000);
  assert.equal(a.state().phase,'results');assert.deepEqual(a.state().players.map(x=>x.place),[1,2]);
  assert.equal(a.state().players[0].energy,0);assert.equal(a.state().players[0].status,'exhausted');
  assert.ok(Math.abs(a.state().players[0].distance-2*50*1609.344/3600)<1e-8);
});
test('disconnect reconnect keeps same runner and time; host transfers without pausing',()=>{
  const {rooms,a,b,code,ready,step}=fixture();ready(a);ready(b);rooms.receive(a,{type:'start'});step(5000);
  const session=a.session(),old=a.state().players[0];rooms.disconnect(a);step(5000);
  assert.equal(b.state().hostId,b.session().playerId);assert.equal(b.state().phase,'racing');assert.ok(b.state().players[0].distance>old.distance);
  const replacement=new Client();rooms.receive(replacement,{type:'reconnect',code,token:session.token});
  assert.equal(replacement.session().playerId,session.playerId);assert.equal(replacement.state().players.length,2);assert.equal(replacement.state().players[0].energy,86);
  assert.equal(replacement.state().startAt,b.state().startAt);
});
test('grace expiry forfeits exactly at cutoff; wrong or expired tokens fail',()=>{
  const {rooms,a,b,code,ready,step}=fixture({reconnectGraceMs:2000});ready(a);ready(b);rooms.receive(a,{type:'start'});step(4000);rooms.disconnect(a);step(5000);
  const runner=b.state().players.find(x=>x.id===a.session().playerId)!;assert.equal(runner.status,'forfeited');assert.equal(runner.energy,94);
  const distance=runner.distance;step(1000);assert.equal(b.state().players.find(x=>x.id===runner.id)!.distance,distance);
  for(const token of ['wrong',a.session().token]){const c=new Client();rooms.receive(c,{type:'reconnect',code,token});assert.equal(c.error()!.fatal,true)}
});
test('a disconnect grace after the deadline cannot retroactively forfeit a finished runner',()=>{
  const {rooms,a,b,ready,step}=fixture({durationMs:1000,reconnectGraceMs:15000});ready(a);ready(b);rooms.receive(a,{type:'start'});step(3200);rooms.disconnect(a);step(20000);
  assert.equal(b.state().players[0].status,'finished');
});
test('late joins spectate and rematch resets readiness, positions and energy',()=>{
  const {rooms,a,b,code,ready,step}=fixture({durationMs:1000});ready(a);ready(b);rooms.receive(a,{type:'start'});
  const c=new Client();rooms.receive(c,{type:'join',code,player:input('C')});assert.equal(c.state().players[2].spectator,true);
  step(4000);assert.equal(c.state().players[2].place,undefined);rooms.receive(b,{type:'lobby'});assert.match(b.error()!.message,/host/);
  rooms.receive(a,{type:'lobby'});assert.equal(c.state().phase,'lobby');assert.equal(c.state().players[2].spectator,false);
  assert.ok(c.state().players.every(x=>!x.ready&&x.energy===100&&x.distance===0));
  ready(a);ready(b);rooms.receive(c,{type:'ready',ready:true,player:input('C')});rooms.receive(a,{type:'start'});assert.equal(a.state().raceId,2);
});
test('validation, membership, capacity, invalid rooms and world requirements',()=>{
  const {rooms,a,b,code,ready}=fixture({capacity:2});const c=new Client();
  rooms.receive(c,{type:'join',code,player:input('C')});assert.match(c.error()!.message,/full/);
  rooms.receive(c,{type:'join',code:'XXXXXXXX',player:input()});assert.match(c.error()!.message,/not found/);
  rooms.receive(c,{type:'start'});assert.match(c.error()!.message,/Join/);
  for(const player of [input('',1),input('A',11),input('A',1.5),{...input(),look:{color:'x'}},input('A',NaN)]){rooms.receive(c,{type:'create',player});assert.match(c.error()!.message,/alias/)}
  rooms.receive(a,{type:'world',world:'twilight'});assert.match(a.error()!.message,/requirements/);
  ready(a,10,100000);ready(b,10,100000);rooms.receive(a,{type:'world',world:'twilight'});assert.equal(a.state().world,'twilight');assert.ok(a.state().players.every(x=>!x.ready));
});
test('host leaving lobby transfers; empty and idle rooms expire and invalid sessions cannot return',()=>{
  const {rooms,a,b,code,step}=fixture({emptyRoomMs:1000,idleRoomMs:5000,reconnectGraceMs:200});
  rooms.receive(a,{type:'leave'});assert.equal(b.state().hostId,b.session().playerId);
  rooms.disconnect(b);step(1200);assert.equal(rooms.rooms.has(code),false);
  const x=new Client();rooms.receive(x,{type:'reconnect',code,token:b.session().token});assert.equal(x.error()!.fatal,true);
  rooms.receive(x,{type:'create',player:input()});step(6000);assert.equal(x.closed,true);assert.match(x.error()!.message,/expired/);
});
test('host leaving mid race forfeits but remaining runner finishes; solo data is not mutated',()=>{
  const {rooms,a,b,ready,step}=fixture({durationMs:1000});ready(a);ready(b);rooms.receive(a,{type:'start'});step(3300);rooms.receive(a,{type:'leave'});step(700);
  assert.equal(b.state().phase,'results');assert.equal(b.state().players[0].status,'forfeited');assert.equal(b.state().players[1].status,'finished');
  assert.equal(b.state().players[1].earned,0);assert.equal(b.state().players[1].speed,1);
});
test('final results retain a runner after leaving; returning to lobby clears departed slots',()=>{
  const {rooms,a,b,ready,step}=fixture({durationMs:1000});ready(a);ready(b);rooms.receive(a,{type:'start'});step(4000);
  const results=a.state().players.map(p=>({id:p.id,distance:p.distance,place:p.place,status:p.status}));
  rooms.receive(a,{type:'leave'});assert.deepEqual(b.state().players.map(p=>({id:p.id,distance:p.distance,place:p.place,status:p.status})),results);
  rooms.receive(b,{type:'lobby'});assert.equal(b.state().players.length,1);assert.equal(b.state().players[0].ready,false);
});
