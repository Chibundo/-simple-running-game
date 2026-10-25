import './style.css';
import { GAME, canEnter, type WorldId } from '../shared/config';
import { advance, cleanAlias, newProfile, newRun, nextUpgrade, ranking, upgrade, type Profile } from '../shared/game';
import { load, persist, type StorageLike } from './storage';
import { icon, stickman, scene, escape as e } from './art';
import { RaceConnection } from './network';
import { Scenery } from './scenery';
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const number = (n: number) => Math.floor(n + 1e-7).toLocaleString('en-US');
let storage: StorageLike;
try { storage = localStorage; } catch { storage = { getItem: () => { throw new Error(); }, setItem: () => { throw new Error(); } }; }
const loaded = load(storage);
const save = loaded.data;
let storageWarning = loaded.warning;
let run = newRun();
let summary = '';
let panel = '';
let resumeOnClose = false;
let previous = performance.now(), lastSave = previous;
let tiredAt = 0;
let notice = '';
let noticeTimer: ReturnType<typeof setTimeout>;
let renderedRoomKey = '';
const p = () => save.profiles.find(p => p.id === save.active)!;
function commit() { if (!persist(storage, save)) storageWarning = true; }
let race: RaceConnection;
const app = $('#app');
app.innerHTML = `
<header class="site-header"><a class="brand" href="./" aria-label="Simple Running Game home"><span class="brand-mark">${stickman(p().look)}</span><span>SIMPLE<br>RUNNING GAME<span class="brand-dot">.</span></span></a><div class="header-right"><button class="header-race" data-action="multiplayer">${icon('people')} Race with friends</button><button class="profile-button" data-action="profiles">${icon('people')}<span id="profile-name"></span></button><button class="icon-button" aria-label="Settings and help" data-action="settings">${icon('settings')}</button></div></header>
<main><section class="intro"><div><div class="eyebrow"><span></span> A SMALL RUN. A BIG ADVENTURE.</div><h1>READY. SET. <em>RUN.</em></h1><p>Find your stride. Get a little faster. Make it your world.</p></div><button class="world-pill" data-action="worlds" aria-label="Tier and worlds" title="Choose a world">${icon('mountain')}<span id="world-name"></span><span>⌄</span></button></section>
<div id="storage-warning" class="notice" role="status" hidden></div><div id="notice" class="notice" role="status" hidden></div>
<section class="game-layout" aria-label="Your running game"><div class="run-card"><div class="stat-strip"><div class="stat"><span>RUNNING SPEED</span><strong><b id="speed">1</b><small>MPH</small></strong></div><div class="stat earned-stat"><span>EARNED MPH ${icon('star')}</span><strong id="earned">0</strong></div><div class="energy-stat"><div><span>${icon('bolt')} ENERGY</span><strong id="energy">100 / 100</strong></div><div class="meter" role="progressbar" aria-label="Energy" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><i id="energy-fill"></i></div></div></div>
${scene()}
<div class="run-controls"><div class="run-feedback"><span class="status-dot" id="status-dot"></span><div><strong id="status">Ready when you are</strong><small id="run-help">Press Start. Your stickman does the rest.</small></div></div><div class="run-actions"><button class="button secondary" id="pause" data-action="pause" hidden>${icon('pause')} Pause</button><button class="button primary" id="start" data-action="start">${icon('play')} Start running</button></div></div></div>
<aside class="upgrade-card"><div class="eyebrow">THE NEXT LEVEL</div><div class="upgrade-heading"><h2>A little more <em>zoom.</em></h2><span class="round-icon">${icon('bolt')}</span></div><div class="next-speed"><strong id="next-speed">2</strong><span>MPH<br><small>running speed</small></span></div><p id="upgrade-caption">More speed. Bigger adventures.</p><div class="speed-sticker" aria-hidden="true">${icon('bolt')}<span>LET’S<br>GO!</span></div><div class="upgrade-progress"><div><span>Earned MPH</span><strong id="threshold-progress"></strong></div><div class="meter"><i id="upgrade-fill"></i></div><small id="upgrade-remaining"></small></div><button class="button upgrade-button" data-action="upgrade" id="upgrade-open">${icon('bolt')}<span id="upgrade-label">View upgrade</span>${icon('arrow')}</button><p class="tiny">Your earned MPH stays yours. Always.</p><button class="world-teaser" data-action="worlds"><span class="teaser-art" aria-hidden="true">☾<i></i></span><span><small>UP NEXT · WORLD 02</small><strong>Twilight Trails</strong><span id="next-world-state">10 MPH + 100,000 earned MPH</span></span>${icon('arrow')}</button></aside></section>
<nav class="quick-actions" aria-label="Game activities"><button data-action="customise"><span class="action-icon peach">${icon('shirt')}</span><span><strong>Make it yours</strong><small>Customise your stickman</small></span>${icon('arrow')}</button><button data-action="worlds"><span class="action-icon lavender">${icon('mountain')}</span><span><strong>A world of possibility</strong><small>Explore your worlds</small></span>${icon('arrow')}</button><button data-action="leaderboard"><span class="action-icon yellow">${icon('trophy')}</span><span><strong>Your personal best</strong><small>Leaderboard · on this device</small></span>${icon('arrow')}</button><button data-action="multiplayer"><span class="action-icon mint">${icon('people')}</span><span><strong>Better together</strong><small>Race with friends</small></span>${icon('arrow')}</button></nav>
<section class="bottom-row"><div class="journey"><span class="little-flag">${icon('flag')}</span><div><span class="eyebrow">YOUR GAME. YOUR PACE.</span><p>Run → Recharge → Level up → Repeat.</p></div><div class="journey-steps"><span>1 <small>Start</small></span><i></i><span>2 <small>Earn MPH</small></span><i></i><span>3 <small>Upgrade</small></span></div></div><button class="help-link" data-action="settings">New here? <u>How to play ↗</u></button></section></main>
<footer><span>Made for little runners with big imaginations.</span><span>LITTLE LEGS. BIG ENERGY. <span class="footer-sun">☀</span></span></footer>
<dialog id="dialog" aria-labelledby="dialog-title"><div class="dialog-header"><div><span class="eyebrow" id="dialog-eyebrow">YOUR LITTLE ADVENTURE</span><h2 id="dialog-title"></h2></div><button class="icon-button" aria-label="Close panel" data-action="close">${icon('close')}</button></div><div id="panel-body"></div></dialog>`;
const scenery = new Scenery($('#scene'));
function showNotice(message: string) {
  clearTimeout(noticeTimer); notice = message; update();
  noticeTimer = setTimeout(() => { notice = ''; update(); }, 4000);
}
function openPanel(name: string) {
  if (run.phase === 'running') { run.phase = 'paused'; resumeOnClose = true; commit(); }
  panel = name; renderedRoomKey = ''; renderPanel();
  if (!$<HTMLDialogElement>('#dialog').open) $<HTMLDialogElement>('#dialog').showModal();
  update();
  if (name === 'multiplayer' && race.session && race.status === 'offline') race.connect();
}
function closePanel() {
  $<HTMLDialogElement>('#dialog').close(); panel = '';
  if (resumeOnClose && run.phase === 'paused' && !document.hidden && !race.session) run.phase = 'running';
  resumeOnClose = false; previous = performance.now(); update();
}
function update() {
  const player = p(), next = nextUpgrade(player.speed), busy = Boolean(race?.session);
  $('#profile-name').textContent = player.alias;
  $('#world-name').textContent = GAME.worlds.find(w => w.id === player.world)!.name;
  $('#speed').textContent = String(player.speed); $('#earned').textContent = number(player.earned);
  $('#energy').textContent = `${Math.ceil(run.energy)} / 100`;
  $('#energy-fill').style.width = `${run.energy}%`; $('.energy-stat .meter').setAttribute('aria-valuenow', String(Math.ceil(run.energy)));
  $('#scene').className = `scene ${player.world} ${run.phase}`;
  $('#scene').style.setProperty('--pace', `${Math.max(.8, 2 / Math.sqrt(player.speed))}s`);
  $('#scene').setAttribute('aria-label', `${player.alias}, ${run.phase === 'running' ? 'running' : run.phase}, in ${GAME.worlds.find(w => w.id === player.world)!.name}`);
  $('#scene-world').textContent = GAME.worlds.find(w => w.id === player.world)!.name.toUpperCase();
  $('#scene-caption').textContent = run.phase === 'running' ? '● ON THE MOVE' : run.phase === 'tired' ? 'PHEW! RECHARGING…' : run.phase === 'paused' ? 'Ⅱ PAUSED · PRESS RESUME' : 'READY TO ROLL';
  $('#distance').textContent = `${run.distance.toFixed(1)} m`;
  $('#run-label').textContent = run.phase === 'ready' ? 'YOUR NEXT ADVENTURE STARTS HERE' : `${run.seconds.toFixed(0)}s · +${number(run.earned)} EARNED MPH`;
  const running = run.phase === 'running', paused = run.phase === 'paused', tired = run.phase === 'tired';
  $('#status').textContent = tired ? 'Phew! Time to recharge.' : running ? 'Finding your stride' : paused ? 'Taking a breather' : busy ? 'Your race room is open' : 'Ready when you are';
  $('#status-dot').classList.toggle('active', running);
  $('#run-help').textContent = tired ? `You earned ${number(run.earned)} MPH. Great running!` : busy ? 'Leave the room to continue solo running.' : paused ? 'Resume whenever you’re ready.' : summary || 'Press Start. Your stickman does the rest.';
  const start = $<HTMLButtonElement>('#start');
  start.hidden = running || tired; start.disabled = busy;
  start.innerHTML = paused ? `${icon('play')} Resume` : `${icon('play')} Start running`;
  $('#pause').hidden = !running;
  $('#next-speed').textContent = next ? String(next.speed).padStart(2, '0') : '10';
  $('#next-world-state').textContent = player.unlocked.includes('twilight') ? 'Unlocked. Go explore! ↗' : '10 MPH + 100,000 earned MPH';
  $('#upgrade-caption').textContent = next ? 'More speed. Bigger adventures.' : 'Top speed. All the good views.';
  $('#threshold-progress').textContent = next ? `${number(player.earned)} / ${number(next.threshold)}` : 'All steps complete';
  $('#upgrade-fill').style.width = `${next ? Math.min(100, player.earned / next.threshold * 100) : 100}%`;
  $('#upgrade-remaining').textContent = !next ? 'Max speed reached. You did it!' : player.earned >= next.threshold ? 'Your next upgrade is ready!' : `${number(Math.ceil(next.threshold - player.earned))} earned MPH to your next step`;
  $('#upgrade-label').textContent = !next ? 'Max speed reached' : run.phase !== 'ready' || busy ? 'Upgrade between runs' : player.earned >= next.threshold ? 'Upgrade available' : 'View upgrade';
  $('#upgrade-open').classList.toggle('eligible', Boolean(next && player.earned >= next.threshold && run.phase === 'ready' && !busy));
  $('#storage-warning').hidden = !storageWarning;
  $('#storage-warning').textContent = 'Saving is unavailable or a saved profile could not be loaded. You can keep playing in this session.';
  $('#notice').hidden = !notice; $('#notice').textContent = notice;
}
function renderRunner() { $('#runner').innerHTML = '<div class="speed-trails" aria-hidden="true"><i></i><i></i><i></i></div>' + stickman(p().look); }
function title(text: string) { $('#dialog-title').textContent = text; }
function renderPanel() {
  const player = p(), next = nextUpgrade(player.speed), body = $('#panel-body');
  if (panel === 'upgrade') {
    title('Your next step');
    body.innerHTML = `<div class="upgrade-preview">${stickman(player.look, 'preview-run')}<div><span class="muted">${player.speed} MPH →</span><strong>${next ? next.speed + ' MPH' : 'Max speed reached'}</strong></div></div><p>${next ? `The next speed needs <strong>${number(next.threshold)} lifetime earned MPH</strong>. You have ${number(player.earned)}.` : 'You’ve reached 10 MPH! Both worlds are yours to explore.'}</p>${next ? `<p class="panel-note">${run.phase !== 'ready' ? 'Finish this run before upgrading. Paused runs are still in progress.' : race.session ? 'Leave your race room before upgrading.' : player.earned < next.threshold ? `Keep going! ${number(Math.ceil(next.threshold - player.earned))} more earned MPH needed.` : 'Ready for a little more speed? Your earned MPH stays yours.'}</p><button class="button primary full" data-action="apply-upgrade" ${run.phase !== 'ready' || race.session || player.earned < next.threshold ? 'disabled' : ''}>${icon('bolt')} Upgrade to ${next.speed} MPH</button>` : ''}`;
  } else if (panel === 'worlds') {
    title('A world of possibility');
    body.innerHTML = `<p>New views. Same little runner. Your progress comes along.</p><div class="world-cards">${GAME.worlds.map(w => `<div class="world-card ${w.id}"><div class="world-art"><span>${w.icon}</span></div><h3>${w.name}</h3><p>${w.description}</p><ul class="requirements"><li>${player.speed >= w.speed ? '✓' : '○'} ${w.speed} MPH running speed</li><li>${player.earned >= w.earned ? '✓' : '○'} ${number(w.earned)} earned MPH</li></ul><button class="button secondary full" data-action="select-world" data-world="${w.id}" ${!player.unlocked.includes(w.id) || run.phase !== 'ready' || race.session ? 'disabled' : ''}>${player.world === w.id ? 'Selected ✓' : player.unlocked.includes(w.id) ? 'Explore world' : 'Locked'}</button></div>`).join('')}</div>${run.phase !== 'ready' || race.session ? '<p class="panel-note">You can switch worlds between runs, outside a race room.</p>' : ''}`;
  } else if (panel === 'customise') {
    title('Make it yours');
    body.innerHTML = `<p>A little personality for your little runner. Every look is free.</p><div class="cosmetic-preview">${stickman(player.look)}</div>${(['color', 'hat', 'glasses', 'outfit'] as const).map(key => `<fieldset class="cosmetic-group"><legend>${key === 'color' ? 'Body colour' : key[0].toUpperCase() + key.slice(1)}</legend><div class="option-row">${(key === 'color' ? GAME.colors.map(c => c.id) : key === 'hat' ? GAME.hats : key === 'glasses' ? GAME.glasses : GAME.outfits).map(value => `<button data-action="look" data-key="${key}" data-value="${value}" aria-pressed="${player.look[key] === value}" class="look-option ${player.look[key] === value ? 'selected' : ''}" ${race.session ? 'disabled' : ''}>${key === 'color' ? `<span class="swatch" style="background:${GAME.colors.find(c => c.id === value)!.value}"></span>${GAME.colors.find(c => c.id === value)!.name}` : value[0].toUpperCase() + value.slice(1)}${player.look[key] === value ? ' ✓' : ''}</button>`).join('')}</div></fieldset>`).join('')}<p class="panel-note">Just for looks. Cosmetics never change speed, energy, earnings, or rankings.${race.session ? ' Leave the race room to change your look.' : ''}</p><button class="button primary full" data-action="close">Done</button>`;
  } else if (panel === 'leaderboard' || panel === 'profiles') {
    title(panel === 'profiles' ? 'Your little running club' : 'Every step counts');
    body.innerHTML = `<span class="scope-label">${icon('trophy')} ON THIS DEVICE</span><p>Profiles saved in this browser only. Live races have their own standings.</p><div class="leaderboard">${ranking(save.profiles).map(x => `<div class="leader-row ${x.id === save.active ? 'you' : ''}"><strong class="rank">${x.rank}</strong><span class="avatar">${stickman(x.look)}</span><div><strong>${e(x.alias)} ${x.id === save.active ? '<small>YOU</small>' : ''}</strong><span>${x.speed} MPH · ${x.unlocked.includes('twilight') ? 'Twilight Trails' : 'Sunny Meadows'}</span></div><strong>${number(x.earned)}<small>earned MPH</small></strong>${panel === 'profiles' && x.id !== save.active ? `<button class="button small" data-action="switch-profile" data-id="${e(x.id)}" ${run.phase !== 'ready' || race.session ? 'disabled' : ''}>Switch</button>` : ''}</div>`).join('')}</div>${save.profiles.length === 1 ? '<p class="panel-note">Your club starts with you. Add another profile for someone sharing this device.</p>' : ''}${panel === 'profiles' ? `<form id="profile-form"><label for="new-alias">New runner’s alias</label><div class="input-row"><input id="new-alias" name="alias" maxlength="20" required placeholder="e.g. Sunny Sprinter" autocomplete="off"><button class="button primary" ${run.phase !== 'ready' || race.session || save.profiles.length >= GAME.maxProfiles ? 'disabled' : ''}>Add runner</button></div></form><p class="tiny">Up to ${GAME.maxProfiles} profiles. Switch or add runners between runs, outside a race room.</p>` : '<button class="button secondary full" data-action="profiles">Manage profiles</button>'}`;
  } else if (panel === 'settings') {
    title('A little guide');
    body.innerHTML = `<div class="help-content"><h3>Find your stride</h3><p>Press Start and your stickman runs automatically. Running earns <strong>earned MPH</strong>, your lifetime progress. <strong>Running speed</strong> is how fast you move.</p><p>Energy lasts about 50 seconds. When you get tired, you return to the start with fresh energy. Your progress stays. Press Start for another run.</p><h3>Take your next step</h3><p>Upgrade between runs, one speed at a time. The first upgrade needs 100 earned MPH. The 10 MPH upgrade needs 100,000, and unlocks Twilight Trails.</p><h3>Make time for a breather</h3><p>Pause at any time in solo mode. Panels pause solo runs and resume them when closed. Hiding the tab pauses until you explicitly resume. There are no offline rewards.</p><h3>Race together</h3><p>Private rooms for 2–8 friends. Default races last 45 seconds with a shared countdown. Distance and energy come from the server. Equal distances tie. Race rewards and results stay separate from solo progress.</p><p><strong>Multiplayer keeps running when a panel is open or a tab is hidden.</strong> A disconnected runner has 15 seconds to reconnect before forfeiting. Speeds come from editable solo saves, so races are casual.</p><h3>Your saved progress</h3><p>Saved on this browser and device. Clearing browser data removes it. Aliases only—no personal details needed.</p><form id="alias-form"><label for="edit-alias">Your alias</label><div class="input-row"><input id="edit-alias" name="alias" value="${e(player.alias)}" maxlength="20" required><button class="button secondary" ${race.session ? 'disabled' : ''}>Save alias</button></div></form><details class="reset-section"><summary>Reset this runner’s progress</summary><p>Only ${e(player.alias)} will be reset. Other profiles stay.</p><label class="checkbox-label"><input type="checkbox" id="confirm-reset"> I understand this can’t be undone</label><button class="button danger" data-action="reset" ${race.session || run.phase !== 'ready' ? 'disabled' : ''}>Reset active profile</button></details></div>`;
  } else if (panel === 'multiplayer') renderMultiplayer(true);
}
function playerInput(alias = p().alias) { return { alias, speed: p().speed, earned: p().earned, look: { ...p().look } }; }
function roomKey() {
  const room = race.room;
  return JSON.stringify([race.status, race.error, room && [room.code, room.hostId, room.phase, room.raceId, room.world, room.players.map(x => [x.id, x.alias, x.speed, x.look, x.ready, x.connected, x.spectator, x.status, x.place])]]);
}
function renderMultiplayer(force = false) {
  if (panel !== 'multiplayer') return;
  const key = roomKey();
  if (!force && key === renderedRoomKey) return;
  renderedRoomKey = key;
  const room = race.room, me = race.session?.playerId;
  title(room ? room.phase === 'results' ? 'What a little race!' : room.phase === 'lobby' ? 'The starting line' : 'Off we go!' : 'Better together');
  const error = `<p id="race-error" role="status" class="${race.error ? 'panel-note error' : ''}">${e(race.error)}</p>`;
  if (!room) {
    // Keep partially typed aliases/codes when connection status changes.
    const alias = document.querySelector<HTMLInputElement>('#race-alias')?.value ?? p().alias;
    const code = document.querySelector<HTMLInputElement>('#room-code')?.value ?? new URLSearchParams(location.search).get('room') ?? '';
    $('#panel-body').innerHTML = `<div class="multiplayer-art">${icon('people')}<span>A little friendly competition.</span></div><p>Invite your friends to a private race. Real runners, one starting line.</p><p class="panel-note">Races keep running if you hide the tab. Solo progress stays separate. Casual races use your saved speed.</p>${error}${run.phase !== 'ready' ? '<p class="panel-note">Finish your solo run before joining a race.</p>' : ''}<label for="race-alias">Your racing alias</label><input id="race-alias" maxlength="20" value="${e(alias)}" autocomplete="off"><button class="button primary full" data-action="create-race" ${run.phase !== 'ready' || race.status === 'connecting' || race.status === 'reconnecting' ? 'disabled' : ''}>${icon('flag')} ${race.status === 'connecting' ? 'Connecting…' : 'Create Race'}</button><div class="or-divider"><span>or join your friends</span></div><form id="join-form"><label for="room-code">Invitation code</label><div class="input-row"><input id="room-code" name="code" maxlength="8" value="${e(code)}" placeholder="8-character code" autocomplete="off" autocapitalize="characters" required><button class="button secondary" ${run.phase !== 'ready' ? 'disabled' : ''}>Join Race</button></div></form>${race.session ? '<button class="text-button" data-action="leave-race">Forget session and leave</button>' : ''}`;
    return;
  }
  const host = room.hostId === me, self = room.players.find(x => x.id === me), racing = room.phase === 'racing' || room.phase === 'countdown';
  const sorted = room.phase === 'results' ? [...room.players].sort((a, b) => (a.place ?? 99) - (b.place ?? 99)) : room.players;
  const invite = new URL(location.href); invite.search = ''; invite.searchParams.set('room', room.code); invite.hash = '';
  $('#panel-body').innerHTML = `<div class="room-top"><div><span class="eyebrow">PRIVATE ROOM</span><strong class="room-code">${e(room.code)}</strong></div><button class="button small secondary" data-action="copy-invite">Copy invite</button></div><p class="connection-state">${race.status === 'connected' ? '● Connected' : '○ Reconnecting…'} · ${room.players.length}/${room.rules.capacity} runners · ${GAME.worlds.find(w => w.id === room.world)!.name}</p>${error}<p class="race-rules">${room.rules.durationMs / 1000}-second distance race · 100 energy · 2 energy/second · equal distances tie</p>${racing ? '<div class="race-clock" id="race-clock" role="timer"></div><p class="panel-note">The race continues in hidden tabs and while this panel is closed.</p>' : ''}${self?.spectator ? '<p class="panel-note">You joined after the start. You’re watching this race; join the next one from the lobby.</p>' : ''}<div class="race-lanes ${room.world}" id="race-lanes">${sorted.map(x => `<div class="race-lane" data-runner-id="${e(x.id)}"><div class="lane-label"><strong>${x.place ? '#' + x.place + ' ' : ''}${e(x.alias)}${x.id === me ? ' (you)' : ''}${x.id === room.hostId ? ' · host' : ''}</strong><span>${x.speed} MPH · ${x.spectator ? 'spectating' : room.phase === 'lobby' ? x.connected ? x.ready ? 'ready ✓' : 'not ready' : 'disconnected' : x.status}${!x.connected && room.phase !== 'lobby' ? ' · disconnected' : ''}</span></div><div class="lane-track"><div class="lane-runner ${racing && x.status === 'running' ? 'running' : ''}">${stickman(x.look)}</div></div><div class="lane-stats"><span class="lane-distance">${x.distance.toFixed(1)} m</span><span class="lane-energy">${Math.ceil(x.energy)} / 100 energy</span></div></div>`).join('')}</div>${room.phase === 'lobby' ? `<div class="race-world-select"><label for="race-world">Race world ${host ? '(host chooses)' : ''}</label><select id="race-world" ${!host ? 'disabled' : ''}>${GAME.worlds.map(w => `<option value="${w.id}" ${room.world === w.id ? 'selected' : ''} ${room.players.some(x => !canEnter(w.id, x.speed, x.earned)) ? 'disabled' : ''}>${w.name}</option>`).join('')}</select></div><div class="lobby-actions"><button class="button ${self?.ready ? 'secondary' : 'primary'}" data-action="ready-race">${self?.ready ? 'Unready' : 'Ready to race'}</button>${host ? `<button class="button primary" data-action="start-race" ${room.players.length < 2 || room.players.some(x => !x.ready || !x.connected) ? 'disabled' : ''}>Start race</button>` : '<span class="tiny">The host starts when everyone is ready.</span>'}</div><p class="tiny">Ready locks your speed and look for the race. You need at least two connected, ready runners.</p>` : room.phase === 'results' ? `<p class="panel-note">${sorted.filter(x => x.place === 1).length > 1 ? 'A shared first place. A tie is a great race, too!' : 'Every step counts. Well run!'} Race statistics never change solo progress.</p>${host ? '<div class="lobby-actions"><button class="button primary" data-action="race-again">Race Again</button><button class="button secondary" data-action="race-again">Return to Lobby</button></div>' : '<p>The host can return everyone to the lobby for a fresh readiness check.</p>'}` : ''}<div class="room-bottom"><button class="text-button" data-action="close">Back to game</button><button class="text-button danger-text" data-action="leave-race">Leave Room</button></div>`;
}
function raceChange() {
  if (panel === 'multiplayer') {
    const active = document.activeElement as HTMLElement | null;
    const action = active?.dataset.action;
    const key = roomKey();
    if (key !== renderedRoomKey) {
      renderMultiplayer();
      if (action) document.querySelector<HTMLElement>(`[data-action="${action}"]`)?.focus({ preventScroll: true });
    }
  }
  update();
}
race = new RaceConnection(raceChange);
function renderRaceMotion(now: number) {
  const room = race.room;
  if (!room || panel !== 'multiplayer') return;
  const delta = Math.min(250, now - race.receivedAt);
  const elapsed = room.phase === 'racing' ? Math.min(room.rules.durationMs, room.elapsedMs + delta) : room.elapsedMs;
  const clock = document.querySelector('#race-clock');
  if (clock) clock.textContent = room.phase === 'countdown' ? `Starting in ${Math.max(1, Math.ceil((room.startAt - room.serverNow - delta) / 1000))}…` : `${Math.max(0, Math.ceil((room.rules.durationMs - elapsed) / 1000))}s to go`;
  const maximum = 10 * Math.min(room.rules.durationMs / 1000, 50) * 1609.344 / 3600;
  for (const x of room.players) {
    const lane = document.querySelector<HTMLElement>(`[data-runner-id="${x.id}"]`);
    if (!lane) continue;
    const distance = x.distance + (room.phase === 'racing' && x.status === 'running' && x.energy > 0 ? x.speed * Math.min(delta / 1000, x.energy / 2, (room.rules.durationMs - room.elapsedMs) / 1000) * 1609.344 / 3600 : 0);
    lane.querySelector<HTMLElement>('.lane-runner')!.style.left = `${Math.min(90, distance / maximum * 90)}%`;
    lane.querySelector('.lane-distance')!.textContent = `${distance.toFixed(1)} m`;
    lane.querySelector('.lane-energy')!.textContent = `${Math.ceil(x.energy)} / 100 energy`;
    lane.querySelector('.lane-runner')!.classList.toggle('running', room.phase === 'racing' && x.status === 'running');
  }
}
app.addEventListener('click', event => {
  const target = (event.target as Element).closest<HTMLButtonElement>('[data-action]');
  if (!target || target.disabled) return;
  const action = target.dataset.action!;
  if (['customise', 'worlds', 'leaderboard', 'profiles', 'settings', 'upgrade', 'multiplayer'].includes(action)) { openPanel(action); return; }
  if (action === 'close') { closePanel(); return; }
  if (action === 'start' && !race.session && (run.phase === 'ready' || run.phase === 'paused')) { run.phase = 'running'; summary = ''; previous = performance.now(); }
  if (action === 'pause' && run.phase === 'running') { run.phase = 'paused'; resumeOnClose = false; commit(); }
  if (action === 'apply-upgrade' && !race.session && upgrade(p(), run.phase)) { commit(); renderPanel(); showNotice(`A little faster! You’re now running at ${p().speed} MPH.`); }
  if (action === 'select-world' && run.phase === 'ready' && !race.session) {
    const world = target.dataset.world as WorldId;
    if (p().unlocked.includes(world)) { p().world = world; commit(); renderPanel(); }
  }
  if (action === 'look' && !race.session) {
    const key = target.dataset.key as keyof Profile['look'], value = target.dataset.value!;
    p().look[key] = value; commit(); renderRunner(); renderPanel();
    document.querySelector<HTMLElement>(`[data-key="${key}"][data-value="${value}"]`)?.focus();
  }
  if (action === 'switch-profile' && run.phase === 'ready' && !race.session && save.profiles.some(x => x.id === target.dataset.id)) {
    save.active = target.dataset.id!; run = newRun(); summary = ''; commit(); renderRunner(); renderPanel();
  }
  if (action === 'reset' && run.phase === 'ready' && !race.session) {
    if (!$<HTMLInputElement>('#confirm-reset').checked) { showNotice('Tick the confirmation box before resetting.'); return; }
    const old = p(); save.profiles[save.profiles.indexOf(old)] = newProfile(old.alias, old.id); run = newRun(); summary = ''; commit(); renderRunner(); renderPanel(); showNotice('This runner has a fresh start.');
  }
  if (action === 'create-race' && run.phase === 'ready') {
    const alias = cleanAlias($<HTMLInputElement>('#race-alias').value);
    if (!alias) { race.error = 'Choose a racing alias first.'; renderMultiplayer(true); return; }
    race.connect({ type: 'create', player: playerInput(alias) });
  }
  if (action === 'ready-race') race.send({ type: 'ready', ready: !race.room?.players.find(x => x.id === race.session?.playerId)?.ready, player: playerInput(race.room?.players.find(x => x.id === race.session?.playerId)?.alias) });
  if (action === 'start-race') race.send({ type: 'start' });
  if (action === 'race-again') race.send({ type: 'lobby' });
  if (action === 'leave-race') { race.leave(); renderedRoomKey = ''; renderMultiplayer(true); }
  if (action === 'copy-invite' && race.room) {
    const url = new URL(location.href); url.search = ''; url.hash = ''; url.searchParams.set('room', race.room.code);
    void navigator.clipboard?.writeText(url.toString()).then(() => { target.textContent = 'Copied!'; }).catch(() => { race.error = `Share the room code: ${race.room!.code}`; renderMultiplayer(true); });
    if (!navigator.clipboard) { race.error = `Share the room code: ${race.room.code}`; renderMultiplayer(true); }
  }
  update();
  if (panel && document.activeElement === document.body) document.querySelector<HTMLElement>('[aria-label="Close panel"]')?.focus();
});
app.addEventListener('submit', event => {
  event.preventDefault(); const form = event.target as HTMLFormElement;
  if (form.id === 'profile-form' && run.phase === 'ready' && !race.session && save.profiles.length < GAME.maxProfiles) {
    const alias = cleanAlias(new FormData(form).get('alias'));
    if (alias) { const profile = newProfile(alias); save.profiles.push(profile); save.active = profile.id; commit(); renderRunner(); renderPanel(); }
  }
  if (form.id === 'alias-form' && !race.session) {
    const alias = cleanAlias(new FormData(form).get('alias'));
    if (alias) { p().alias = alias; commit(); showNotice('Alias saved.'); }
  }
  if (form.id === 'join-form' && run.phase === 'ready') {
    const alias = cleanAlias($<HTMLInputElement>('#race-alias').value);
    if (!alias) { race.error = 'Choose a racing alias first.'; renderMultiplayer(true); return; }
    race.connect({ type: 'join', code: String(new FormData(form).get('code')).trim().toUpperCase(), player: playerInput(alias) });
  }
  update();
});
app.addEventListener('change', event => { const input = event.target as HTMLSelectElement; if (input.id === 'race-world') race.send({ type: 'world', world: input.value as WorldId }); });
$<HTMLDialogElement>('#dialog').addEventListener('cancel', event => { event.preventDefault(); closePanel(); });
$<HTMLDialogElement>('#dialog').addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const items = Array.from($('#dialog').querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, a[href], [tabindex="0"]')).filter(el => el.getClientRects().length > 0);
  const first = items[0], last = items[items.length - 1];
  if (!first) return;
  if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
    event.preventDefault(); (event.shiftKey ? last : first).focus();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (run.phase === 'running') run.phase = 'paused'; resumeOnClose = false; commit(); update(); }
  previous = performance.now();
});
window.addEventListener('pagehide', commit);
let lastDraw = 0;
function frame(now: number) {
  const dt = Math.max(0, (now - previous) / 1000); previous = now;
  if (!document.hidden) advance(p(), run, dt);
  if (run.phase === 'tired') {
    if (!tiredAt) { tiredAt = now; commit(); }
    if (now - tiredAt >= GAME.tiredMs) { summary = `Last run: +${number(run.earned)} earned MPH · ${run.distance.toFixed(1)} m. Nice work!`; run = newRun(); tiredAt = 0; commit(); }
  }
  if (now - lastSave > 2000 && run.phase === 'running') { commit(); lastSave = now; }
  if (now - lastDraw >= 80) { update(); lastDraw = now; }
  scenery.render(run);
  renderRaceMotion(now);
  requestAnimationFrame(frame);
}
renderRunner(); update(); requestAnimationFrame(frame);
if (race.session) { openPanel('multiplayer'); }
else if (new URLSearchParams(location.search).has('room')) openPanel('multiplayer');
