import { test, expect, type Page, type Browser } from '@playwright/test';
const key='simple-running-game.v1';
async function fixture(page:Page, earned:number, speed:number) {
  await page.addInitScript(({key,earned,speed})=>{
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:1,active:'test-runner',profiles:[{id:'test-runner',alias:'Test Runner',earned,speed,world:'meadow',unlocked:['meadow'],look:{color:'ink',hat:'none',glasses:'none',outfit:'none'}}]}));
  },{key,earned,speed});
}
async function create(page:Page,alias:string){
  await page.goto('/');await page.getByRole('button',{name:/Better together/}).click();
  await page.getByLabel('Your racing alias').fill(alias);await page.getByRole('button',{name:'Create Race',exact:true}).click();
  await expect(page.locator('.room-code')).toBeVisible();return (await page.locator('.room-code').innerText()).trim();
}
async function join(page:Page,code:string,alias:string){
  await page.goto('/?room='+code);await page.getByLabel('Your racing alias').fill(alias);
  await page.getByRole('button',{name:'Join Race',exact:true}).click();await expect(page.locator('.room-code')).toHaveText(code);
}
async function pair(browser:Browser){
  const a=await browser.newContext(),b=await browser.newContext();
  const pa=await a.newPage(),pb=await b.newPage();const code=await create(pa,'Acorn');await join(pb,code,'Birch');
  return{a,b,pa,pb,code};
}
async function readyAndStart(pa:Page,pb:Page){
  await pa.getByRole('button',{name:'Ready to race',exact:true}).click();await pb.getByRole('button',{name:'Ready to race',exact:true}).click();
  await expect(pa.getByRole('button',{name:'Start race',exact:true})).toBeEnabled();
  await pa.getByRole('button',{name:'Start race',exact:true}).click();
}
test('fresh state, automatic earnings, pause, panel pause/resume and exhaustion',async({page})=>{
  await page.clock.install();await page.goto('/');
  await expect(page.locator('#speed')).toHaveText('1');await expect(page.locator('#earned')).toHaveText('0');await expect(page.locator('#energy')).toHaveText('100 / 100');
  await page.getByRole('button',{name:'Start running',exact:true}).click();await page.clock.fastForward(6000);
  expect(Number((await page.locator('#earned').innerText()).replaceAll(',',''))).toBeGreaterThanOrEqual(119);
  await page.getByRole('button',{name:'Pause',exact:true}).click();const earned=await page.locator('#earned').innerText();
  await page.clock.fastForward(5000);await expect(page.locator('#earned')).toHaveText(earned);
  await page.getByRole('button',{name:'Make it yours'}).click();await page.getByRole('button',{name:'Done',exact:true}).click();
  await expect(page.locator('#status')).toHaveText('Taking a breather');
  await page.getByRole('button',{name:'Resume',exact:true}).click();await page.clock.fastForward(1000);
  await page.getByRole('button',{name:'Make it yours'}).click();const stopped=await page.locator('#earned').innerText();
  await page.clock.fastForward(3000);await expect(page.locator('#earned')).toHaveText(stopped);
  await page.getByRole('button',{name:'Done',exact:true}).click();await expect(page.locator('#status')).toHaveText('Finding your stride');
  await page.clock.fastForward(44000);await expect(page.locator('#status')).toHaveText('Phew! Time to recharge.');
  await page.clock.fastForward(2000);await expect(page.locator('#energy')).toHaveText('100 / 100');await expect(page.locator('#earned')).toHaveText('1,000');await expect(page.locator('#distance')).toHaveText('0.0 m');
  await page.reload();await expect(page.locator('#earned')).toHaveText('1,000');await expect(page.locator('#status')).toHaveText('Ready when you are');
});
test('99 earned MPH keeps the first upgrade locked',async({page})=>{
  await fixture(page,99,1);await page.goto('/');await page.getByRole('button',{name:/View upgrade/}).click();
  await expect(page.getByRole('button',{name:'Upgrade to 2 MPH',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Close panel'}).click();
});
test('100 earned MPH upgrades exactly one speed and survives reload',async({page})=>{
  await fixture(page,100,1);await page.goto('/');await page.getByRole('button',{name:'Upgrade available',exact:true}).click();await page.getByRole('button',{name:'Upgrade to 2 MPH',exact:true}).click();
  await page.getByRole('button',{name:'Close panel'}).click();await expect(page.locator('#speed')).toHaveText('2');await expect(page.locator('#earned')).toHaveText('100');
  await page.reload();await expect(page.locator('#speed')).toHaveText('2');await expect(page.locator('#next-speed')).toHaveText('03');
});
test('late-game fixture requires the actual 10 MPH upgrade to enter world two',async({page})=>{
  await fixture(page,100000,9);await page.goto('/');await page.getByRole('button',{name:/A world of possibility/}).click();
  await expect(page.locator('.world-card.twilight button')).toBeDisabled();await page.getByRole('button',{name:'Close panel'}).click();
  await page.getByRole('button',{name:'Upgrade available',exact:true}).click();await page.getByRole('button',{name:'Upgrade to 10 MPH',exact:true}).click();await page.getByRole('button',{name:'Close panel'}).click();
  await expect(page.locator('#speed')).toHaveText('10');await expect(page.locator('#upgrade-label')).toHaveText('Max speed reached');
  await page.getByRole('button',{name:/A world of possibility/}).click();await page.getByRole('button',{name:'Explore world',exact:true}).click();await page.getByRole('button',{name:'Close panel'}).click();
  await expect(page.locator('#scene')).toHaveClass(/twilight/);await expect(page.locator('#earned')).toHaveText('100,000');
  await page.reload();await expect(page.locator('#scene')).toHaveClass(/twilight/);
});
test('cosmetics persist without stat effects, profiles are independent and aliases render as text',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Make it yours'}).click();await page.getByRole('button',{name:'Coral',exact:true}).click();await page.getByRole('button',{name:'Cap',exact:true}).click();await page.getByRole('button',{name:'Done',exact:true}).click();
  await expect(page.locator('#speed')).toHaveText('1');await expect(page.locator('#earned')).toHaveText('0');await expect(page.locator('#energy')).toHaveText('100 / 100');
  await page.reload();await page.getByRole('button',{name:'Make it yours'}).click();await expect(page.getByRole('button',{name:'Cap ✓',exact:true})).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'Done',exact:true}).click();
  await page.locator('.profile-button').click();await page.getByLabel('New runner’s alias').fill('<b>Scout</b>');await page.getByRole('button',{name:'Add runner',exact:true}).click();
  await expect(page.locator('#profile-name')).toHaveText('<b>Scout</b>');await expect(page.locator('.leader-row.you')).toContainText('<b>Scout</b>');await expect(page.locator('.leader-row.you b')).toHaveCount(0);
  await page.getByRole('button',{name:'Switch',exact:true}).click();await expect(page.locator('#profile-name')).toHaveText('Little Runner');
  await page.getByRole('button',{name:'Close panel'}).click();await page.getByRole('button',{name:/Your personal best/}).click();await expect(page.locator('.leader-row')).toHaveCount(2);await expect(page.locator('.rank')).toHaveText(['1','1']);
});
test('hidden-tab notification pauses solo and requires explicit resume',async({page})=>{
  await page.clock.install();await page.goto('/');await page.getByRole('button',{name:'Start running',exact:true}).click();await page.clock.fastForward(2000);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  const earned=await page.locator('#earned').innerText();await page.clock.fastForward(12000);await expect(page.locator('#earned')).toHaveText(earned);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await page.clock.fastForward(3000);await expect(page.locator('#status')).toHaveText('Taking a breather');await expect(page.locator('#earned')).toHaveText(earned);
  await page.getByRole('button',{name:'Resume',exact:true}).click();await page.clock.fastForward(1000);expect(await page.locator('#earned').innerText()).not.toBe(earned);
});
test('corrupt or inaccessible storage still permits a run',async({browser})=>{
  for(const unavailable of [false,true]){
    const context=await browser.newContext(),page=await context.newPage();
    await page.addInitScript(({unavailable,key})=>{
      if(unavailable)Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}});
      else localStorage.setItem(key,'corrupt data');
    },{unavailable,key});
    await page.clock.install();await page.goto('/');await expect(page.locator('#storage-warning')).toBeVisible();
    await page.getByRole('button',{name:'Start running',exact:true}).click();await page.clock.fastForward(1200);expect(Number(await page.locator('#earned').innerText())).toBeGreaterThan(0);
    await context.close();
  }
});
test('phone, tablet and desktop layouts, keyboard controls, focus trap and reduced motion',async({page})=>{
  for(const width of [360,390,768,1440]){
    await page.setViewportSize({width,height:900});await page.goto('/');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.getByRole('button',{name:'Make it yours'}).click();
    expect(await page.evaluate(()=>document.querySelector('dialog')!.scrollWidth<=document.querySelector('dialog')!.clientWidth)).toBe(true);
    await page.getByRole('button',{name:'Done',exact:true}).focus();await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Close panel'})).toBeFocused();
    await page.keyboard.press('Shift+Tab');await expect(page.getByRole('button',{name:'Done',exact:true})).toBeFocused();
    await page.keyboard.press('Escape');await expect(page.locator('dialog')).not.toBeVisible();
  }
  await page.getByRole('button',{name:'Start running',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.locator('#status')).toHaveText('Finding your stride');
  await page.getByRole('button',{name:'Pause',exact:true}).focus();await page.keyboard.press('Space');await expect(page.locator('#status')).toHaveText('Taking a breather');
  await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.track-dashes').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  await page.screenshot({path:'test-results/desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/phone.png',fullPage:true});
});
test('two isolated real clients share a start, live state, tied results and clean rematch',async({browser})=>{
  const {a,b,pa,pb}=await pair(browser);
  try{
    await expect(pa.getByRole('button',{name:'Start race',exact:true})).toBeDisabled();await readyAndStart(pa,pb);
    await expect(pa.locator('#race-clock')).toBeVisible();await expect(pb.locator('#race-clock')).toBeVisible();
    await expect(pa.locator('.lane-distance').first()).not.toHaveText('0.0 m');
    const d1=parseFloat(await pa.locator('.lane-distance').first().innerText()),d2=parseFloat(await pb.locator('.lane-distance').first().innerText());expect(Math.abs(d1-d2)).toBeLessThan(.5);
    await expect(pa.locator('#dialog-title')).toHaveText('What a little race!');await expect(pb.locator('#dialog-title')).toHaveText('What a little race!');
    await expect(pa.locator('.lane-label strong')).toHaveText(['#1 Acorn (you) · host','#1 Birch']);await expect(pa.locator('.lane-distance')).toHaveText(['1.3 m','1.3 m']);
    await expect(pa.locator('.lane-energy')).toHaveText(['94 / 100 energy','94 / 100 energy']);
    await expect(pa.locator('#earned')).toHaveText('0');await expect(pb.locator('#earned')).toHaveText('0');
    await pa.screenshot({path:'test-results/race-results.png',fullPage:true});
    await pa.getByRole('button',{name:'Race Again',exact:true}).click();await expect(pb.locator('#dialog-title')).toHaveText('The starting line');
    await expect(pa.locator('.lane-distance')).toHaveText(['0.0 m','0.0 m']);await expect(pa.getByRole('button',{name:'Start race',exact:true})).toBeDisabled();
    await readyAndStart(pa,pb);await expect(pb.locator('#dialog-title')).toHaveText('What a little race!');
    await pa.getByRole('button',{name:'Leave Room',exact:true}).click();await expect(pa.getByRole('button',{name:'Create Race',exact:true})).toBeVisible();
    await pa.getByRole('button',{name:'Close panel'}).click();await expect(pa.getByRole('button',{name:'Start running',exact:true})).toBeEnabled();
  }finally{await a.close();await b.close()}
});
test('reload reconnects the same runner and hidden tabs and closed panels do not pause a race',async({browser})=>{
  const {a,b,pa,pb}=await pair(browser);
  try{
    await readyAndStart(pa,pb);await expect(pb.locator('.lane-distance').first()).not.toHaveText('0.0 m');
    const before=await pa.evaluate(()=>JSON.parse(sessionStorage.getItem('simple-running-game.race-session')!));
    await pa.reload();await expect(pa.locator('.room-code')).toBeVisible();
    const after=await pa.evaluate(()=>JSON.parse(sessionStorage.getItem('simple-running-game.race-session')!));expect(after.playerId).toBe(before.playerId);await expect(pa.locator('.race-lane')).toHaveCount(2);
    await pb.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    await pa.getByRole('button',{name:'Back to game',exact:true}).click();
    await expect(pb.locator('#dialog-title')).toHaveText('What a little race!');
    await pa.getByRole('button',{name:/Better together/}).click();await expect(pa.locator('#dialog-title')).toHaveText('What a little race!');
    await expect(pa.locator('.lane-distance')).toHaveText(['1.3 m','1.3 m']);
  }finally{await a.close();await b.close()}
});
test('departing host cannot stop race; late join is a spectator, and invalid rooms give useful errors',async({browser})=>{
  const {a,b,pa,pb,code}=await pair(browser);const c=await browser.newContext(),pc=await c.newPage();
  try{
    await pc.goto('/?room='+code);await pc.getByLabel('Your racing alias').fill('Cedar');
    await readyAndStart(pa,pb);await pc.getByRole('button',{name:'Join Race',exact:true}).click();await expect(pc.getByText(/You joined after the start/)).toBeVisible();
    await pa.getByRole('button',{name:'Leave Room',exact:true}).click();
    await expect(pb.locator('#dialog-title')).toHaveText('What a little race!');await expect(pb.locator('.lane-label')).toContainText(['finished','forfeited','spectating']);
    await pc.getByRole('button',{name:'Leave Room',exact:true}).click();await pc.getByLabel('Invitation code').fill('XXXXXXXX');await pc.getByRole('button',{name:'Join Race',exact:true}).click();await expect(pc.locator('#race-error')).toContainText('Room not found');
  }finally{await a.close();await b.close();await c.close()}
});
test('an unavailable backend leaves solo playable with a useful lobby error',async({page})=>{
  await page.routeWebSocket('**/ws',ws=>ws.close({code:1013,reason:'Test outage'}));
  await page.goto('/');await page.getByRole('button',{name:/Better together/}).click();await page.getByRole('button',{name:'Create Race',exact:true}).click();await expect(page.locator('#race-error')).toContainText(/unavailable/);
  await page.getByRole('button',{name:'Close panel'}).click();await page.getByRole('button',{name:'Start running',exact:true}).click();await expect(page.locator('#status')).toHaveText('Finding your stride');
});
test('reset requires confirmation and affects only the active profile',async({page})=>{
  await fixture(page,500,3);await page.goto('/');await page.locator('.profile-button').click();await page.getByLabel('New runner’s alias').fill('Second');await page.getByRole('button',{name:'Add runner',exact:true}).click();await page.getByRole('button',{name:'Switch',exact:true}).click();await page.getByRole('button',{name:'Close panel'}).click();
  await page.getByRole('button',{name:'Settings and help'}).click();await page.getByText('Reset this runner’s progress',{exact:true}).click();await page.getByRole('button',{name:'Reset active profile',exact:true}).click();await expect(page.locator('#earned')).toHaveText('500');
  await page.getByLabel('I understand this can’t be undone').check();await page.getByRole('button',{name:'Reset active profile',exact:true}).click();await page.getByRole('button',{name:'Close panel'}).click();await expect(page.locator('#earned')).toHaveText('0');await expect(page.locator('#speed')).toHaveText('1');
  await page.locator('.profile-button').click();await expect(page.locator('.leader-row')).toHaveCount(2);
});
test('disconnect beyond grace forfeits the runner and rejects the expired reconnect in a browser',async({browser})=>{
  const a=await browser.newContext(),b=await browser.newContext();const pa=await a.newPage(),pb=await b.newPage();
  await pa.addInitScript(()=>{
    const Original=window.WebSocket;
    window.WebSocket=class extends Original {
      constructor(url:string|URL,protocols?:string|string[]){super(url,protocols);(window as unknown as {testSocket:WebSocket}).testSocket=this;}
    };
  });
  try{
    const code=await create(pa,'Acorn');await join(pb,code,'Birch');await readyAndStart(pa,pb);
    await expect(pb.locator('.lane-distance').first()).not.toHaveText('0.0 m');
    // Fault injection only: close the live transport and refuse replacement connections.
    let blockReconnect=true;
    await pa.routeWebSocket('**/ws',route=>{if(blockReconnect)route.close({code:1013,reason:'Test disconnect'});else route.connectToServer();});
    await pa.evaluate(()=>(window as unknown as {testSocket:WebSocket}).testSocket.close());
    await expect(pb.locator('.lane-label').filter({hasText:'Acorn'})).toContainText('forfeited');
    await expect(pb.locator('#dialog-title')).toHaveText('What a little race!');
    blockReconnect=false;await pa.reload();await expect(pa.locator('#race-error')).toContainText(/Reconnect window ended|Session expired/);
    expect(await pa.evaluate(()=>sessionStorage.getItem('simple-running-game.race-session'))).toBeNull();
  }finally{await a.close();await b.close()}
});
