import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAME, canEnter } from '../shared/config';
import { advance, newProfile, newRun, upgrade, ranking } from '../shared/game';
import { load, persist, SAVE_KEY } from '../src/storage';
const near = (a: number, b: number) => assert.ok(Math.abs(a-b) < 1e-7, `${a} != ${b}`);
test('fresh runner and active-time rewards; duplicate advances after exhaustion do nothing', () => {
  const p = newProfile(), r = newRun();
  assert.equal(p.speed, 1); assert.equal(p.earned, 0); assert.equal(r.energy, 100);
  advance(p, r, 10); assert.equal(p.earned, 0);
  r.phase = 'running'; advance(p, r, 2);
  assert.equal(p.earned, 40); assert.equal(r.energy, 96); near(r.distance, 1609.344 * 2 / 3600);
  advance(p, r, 1000); assert.equal(p.earned, 1000); assert.equal(r.phase, 'tired'); assert.equal(r.energy, 0);
  const distance = r.distance; advance(p, r, 1); assert.equal(r.distance, distance); assert.equal(p.earned, 1000);
  const fresh = newRun(); assert.equal(fresh.distance, 0); assert.equal(fresh.energy, 100); assert.equal(p.earned, 1000);
});
test('30, 60, 144 FPS and one large step produce the same active-time progression', () => {
  for (const fps of [30, 60, 144]) {
    const p = newProfile(), r = newRun(); r.phase = 'running';
    for (let i=0;i<fps*12;i++) advance(p,r,1/fps);
    near(p.earned,240); near(r.energy,76); near(r.seconds,12);
  }
  const p=newProfile(),r=newRun();r.phase='running';advance(p,r,12);near(p.earned,240);
});
test('all upgrades are sequential, cumulative, capped at 10; 100000 is required', () => {
  const p=newProfile();p.earned=99;assert.equal(upgrade(p,'ready'),false);
  p.earned=100;assert.equal(upgrade(p,'running'),false);assert.equal(upgrade(p,'paused'),false);
  assert.equal(upgrade(p,'ready'),true);assert.equal(p.speed,2);assert.equal(p.earned,100);
  for(const u of GAME.upgrades.slice(1)) {
    p.earned=u.threshold-1;assert.equal(upgrade(p,'ready'),false);
    p.earned=u.threshold;assert.equal(upgrade(p,'ready'),true);assert.equal(p.speed,u.speed);assert.equal(p.earned,u.threshold);
  }
  assert.equal(upgrade(p,'ready'),false);assert.equal(p.speed,10);
  const q=newProfile();q.earned=100000;upgrade(q,'ready');assert.equal(q.speed,2);
});
test('world requires speed AND earned MPH; entering preserves progression', () => {
  assert.equal(canEnter('twilight',9,100000),false);assert.equal(canEnter('twilight',10,99999),false);
  const p=newProfile();p.earned=100000;for(let i=0;i<9;i++)upgrade(p,'ready');
  assert.equal(p.unlocked.includes('twilight'),true);p.world='twilight';assert.equal(p.earned,100000);assert.equal(p.speed,10);
});
test('paused and ready phases earn nothing; cosmetics change no statistics', () => {
  const a=newProfile(),b=newProfile(),ra=newRun(),rb=newRun();
  b.look={color:'purple',hat:'crown',glasses:'sun',outfit:'jersey'};ra.phase=rb.phase='running';
  advance(a,ra,15);advance(b,rb,15);assert.equal(a.earned,b.earned);assert.deepEqual(ra,rb);
  ra.phase='paused';advance(a,ra,200);assert.equal(a.earned,300);assert.equal(ra.energy,70);
});
test('rankings use earnings then speed, shared ranks and independent profiles', () => {
  const a=newProfile('A'),b=newProfile('B'),c=newProfile('C');a.earned=b.earned=200;b.speed=2;c.earned=50;
  assert.deepEqual(ranking([a,b,c]).map(x=>[x.alias,x.rank]),[['B',1],['A',2],['C',3]]);
  a.speed=2;assert.deepEqual(ranking([a,b,c]).map(x=>x.rank),[1,1,3]);assert.equal(c.speed,1);
});
test('versioned save restores profiles and cosmetics, derives unlocks, clamps invalid values', () => {
  const p=newProfile();p.earned=100000;p.speed=10;p.world='twilight';p.look.hat='cap';
  let raw='';const storage={getItem:()=>raw,setItem:(_k:string,v:string)=>{raw=v;}};
  assert.equal(persist(storage,{version:1,active:p.id,profiles:[p]}),true);
  const result=load(storage);assert.equal(result.warning,false);assert.equal(result.data.profiles[0].earned,100000);
  assert.equal(result.data.profiles[0].world,'twilight');assert.equal(result.data.profiles[0].look.hat,'cap');
  raw=JSON.stringify({version:1,active:p.id,profiles:[{...p,earned:-5,speed:100,look:{color:'invalid'}}]});
  const bad=load(storage).data.profiles[0];assert.equal(bad.earned,0);assert.equal(bad.speed,1);assert.equal(bad.world,'meadow');assert.equal(bad.look.color,'ink');
  assert.equal(SAVE_KEY,'simple-running-game.v1');
});
test('corrupt saves, unknown versions, duplicates and unavailable storage recover', () => {
  for(const raw of ['{','null','{"version":2,"profiles":[]}','{"version":1,"profiles":[null]}']) {
    const r=load({getItem:()=>raw,setItem:()=>{}});assert.equal(r.warning,true);assert.equal(r.data.profiles.length,1);
  }
  const storage={getItem:()=>{throw Error('disabled');},setItem:()=>{throw Error('disabled');}};
  assert.equal(load(storage).warning,true);const p=newProfile();assert.equal(persist(storage,{version:1,active:p.id,profiles:[p]}),false);
  const p1=newProfile();const d=load({getItem:()=>JSON.stringify({version:1,active:'other',profiles:[p1,p1]}),setItem:()=>{}});
  assert.equal(d.data.profiles.length,1);assert.equal(d.data.active,p1.id);
});
