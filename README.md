# Simple Running Game

A playable running game with a human athlete, 3D outdoor worlds, saved solo progression and private, real-time multiplayer races. TypeScript, Vite, Three.js/WebGL, locally generated artwork, and a small Node.js WebSocket server. No accounts, paid services, external credentials, hotlinked assets, or fabricated opponents.

## Run it

Use **Node.js 24** (`.nvmrc`) and npm.

```sh
npm ci
npm run dev
```

The frontend runs on port **5173** and the race server on **3001**. Open the frontend in a browser. `npm run dev` starts both processes; Ctrl+C stops them together. Vite proxies `/ws` and `/health` to the race server. You can also run `npm run dev:client` and `npm run dev:server` in separate terminals.

For the production build, served by the same Node process as multiplayer:

```sh
npm run build
npm start
```

Open port **3001** in your browser. `/health` must return `{"ok":true}`. Use `npm ci` with development dependencies included: `tsx` runs the TypeScript server. All runtime commands assume the repository root. In this cloud workspace the checkout is `/workspace/-simple-running-game`. If npm's default cache is not writable, use `npm ci --cache /workspace/.npm-cache`.

## How to play

- **Start running** begins automatic movement at 1 MPH. You do not need to tap, jump, or steer.
- **Earned MPH** is cumulative lifetime progress; **running speed** is the actual speed, capped at 10 MPH. They are different quantities.
- Every active second earns `running speed × 20` earned MPH and uses 2 energy. A full solo run lasts about 50 seconds.
- At zero energy the runner gets tired, shows a summary, returns to the beginning, and refills to 100/100. Progress survives. Start the next run yourself.
- Upgrade between completed runs, one speed per click. Earned MPH is never spent. Pausing a run does not make it a completed run.
- Pause/Resume works in solo mode. Opening a panel pauses and closing it resumes only if it was running. A hidden tab pauses until you explicitly resume. Reloading returns to Ready with saved progression and no offline rewards.
- Free shirt colours, hats, glasses, and outfits change appearance only.
- Twilight Trails requires both the **10 MPH upgrade** and **100,000 earned MPH**. Worlds have different scenery and no statistical multipliers. Switching worlds retains progress.
- The device leaderboard ranks up to 20 independent alias profiles in this browser, by lifetime earned MPH, then speed. Equal scores and speeds share rank. Manage profiles with the header's runner button.
- Settings explains the rules, lets you edit an alias, and contains a confirmation checkbox for resetting only the active profile.

## Race with real friends

1. Open the game in two **separate browser sessions** (for example, one normal window and one private window, two separate browser profiles, or two devices).
2. In **Better together**, choose an alias and **Create Race**. Share the 8-character room code or use **Copy invite**. The invitation contains only the room code.
3. The other player chooses **Join Race**, enters the code, and joins. A room accommodates 2–8 runners. There are no bots or sample users.
4. Everyone presses **Ready to race**. The host can start only when at least two runners are connected and everyone is ready.
5. A shared 3-second countdown starts a **45-second distance race**. Runners use their solo speed, frozen at readiness. Equal distances get shared places.
6. The host can choose **Race Again** or **Return to Lobby** after results. Both return the room to a clean lobby and require everyone to ready again. Anyone can leave.

All players see live lanes, connection state, speed, energy, distance, and authoritative results. The starter world is always available. The host can choose Twilight Trails only if every participant meets both requirements. Changing worlds clears readiness. Late joiners spectate until the next lobby.

**Multiplayer does not pause** for hidden tabs or panels. The server owns membership, countdown, timing, distance, energy, forfeits, and shared standings. Updates are sent at 10 Hz, with at most 250 ms of bounded client interpolation between updates. Browser tests allow a 0.5 m difference between client reads at 1 MPH (reads occur at slightly different times); final distances must agree exactly to the displayed 0.1 m. If a tab was hidden or networking was interrupted, the next snapshot resynchronises it.

Reconnecting within 15 seconds restores the same runner without resetting time, energy, or distance. A reload uses a private token stored in `sessionStorage`; this token is never included in invites or broadcast to other players. After the grace period a disconnected racer forfeits and stops. An explicit leave forfeits immediately. Host departure transfers host status and never stops the race. Runners keep their final distances until results; a race finishes at its deadline or when all runners are exhausted/forfeited. Exhaustion stops a runner after 50 active seconds if a longer race is configured.

Race state and statistics are separate from solo progression. Races do not award, spend, or reset solo earned MPH. Speeds come from locally editable solo saves: these are **casual races**, not verified competitive rankings. The device leaderboard is separate from room standings; there is no global all-time leaderboard.

### Two devices on the same local network

Run `npm run dev` on one computer. On **both** devices open the host computer's LAN address on port 5173, e.g. `http://<host-LAN-IP>:5173`. Allow incoming port 5173 in the host's firewall and keep both devices on a network that permits communication. The server/proxy is already bound to `0.0.0.0`; clients use the frontend origin, so do not change the code or hard-code a machine address. Open port 3001 instead if using `npm run build && npm start`.

An invite made on `localhost` only works on that computer. For separate devices, create the invite while viewing the LAN address. A browser's Clipboard API may be unavailable over plain LAN HTTP; the room code remains usable. Devices on guest Wi-Fi may be isolated by the router.

### Internet hosting (configuration provided; not deployed)

For **Vercel frontend + Render multiplayer**, see [DEPLOYMENT.md](DEPLOYMENT.md). The repository includes `vercel.json` and `render.yaml`. Vercel alone cannot run the required persistent race server.

Use a long-running Node 24 host that supports HTTP and persistent WebSocket upgrades, plus HTTPS/WSS through a reverse proxy. Build the frontend, run `npm start`, route both `/` and `/ws` to this same process, and route `/health` for health checks. A static-only host or request-limited serverless function is not sufficient for the race backend.

`deploy/nginx.conf.example` shows the same-origin proxy configuration. Replace the hostname and supply the host's TLS certificate. Export `ALLOWED_ORIGINS=https://your-game.example` on the server for an exact browser-origin allowlist. Default origin checks permit the same hostname (including different development ports). Proxy timeouts must support persistent WebSockets.

See `.env.example`. Server settings must be exported by your shell or hosting platform; the Node server does not automatically load `.env`. Vite loads its usual `.env.local` file at startup/build time. Do not commit credentials.

| Setting | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | HTTP + WebSocket server port |
| `HOST` | `0.0.0.0` | Bind address |
| `ALLOWED_ORIGINS` | Same hostname | Comma-separated exact browser origins, including scheme and port |
| `VITE_SERVER_URL` | Same-origin `/ws` | Optional build-time full WebSocket URL, e.g. `wss://races.example/ws`; HTTPS pages always use WSS |
| `RACE_DURATION_MS` | `45000` | Server race duration; bounded to 100–300000 ms |
| `RACE_COUNTDOWN_MS` | `3000` | Countdown; 100–10000 ms |
| `RACE_RECONNECT_GRACE_MS` | `15000` | Reconnect grace; 100–120000 ms |

The server keeps rooms in memory in a **single process**. A restart loses live rooms, not browser solo saves. Empty rooms expire after 60 seconds; inactive lobbies/results after 30 minutes. Limits include 8 runners/room, 500 rooms, 1000 connections, 4 KiB messages, and 20 messages/second/connection. JSON schemas, membership, state transitions, cosmetics, aliases, speeds, and world requirements are validated. Clients cannot submit race distances or results. Pings detect dead sockets within about 10 seconds; the reconnect grace begins when the server detects disconnection. No IP-based abuse mitigation or persistent trusted progression service is included. Use a suitable reverse proxy for a public deployment; multi-instance hosting would require shared room coordination.

Nothing has been published, and internet play has not been claimed as live.

## Rules and provisional assumptions

The balancing data lives in **`shared/config.ts`**: speed thresholds, energy and earnings rates, tired duration, worlds, cosmetics, profile limit, room capacity, race duration, grace period, and cleanup limits. There are no second-world multipliers.

Confirmed design rules include starting at 1 MPH, starting energy at 100, manually upgrading, needing 100 earned MPH for 2 MPH, and **100,000 for the final 10 MPH upgrade**. The intermediate sequence is provisional:

| Upgrade speed | Lifetime earned MPH | Status |
| --- | ---: | --- |
| 2 MPH | 100 | Confirmed |
| 3 MPH | 150 | Provisional |
| 4 MPH | 300 | Provisional |
| 5 MPH | 500 | Provisional |
| 6 MPH | 1,500 | Provisional |
| 7 MPH | 3,000 | Provisional |
| 8 MPH | 10,000 | Provisional |
| 9 MPH | 15,000 | Provisional |
| 10 MPH | 100,000 | Confirmed final correction |

These implementation assumptions are defaults, **not decisions already confirmed by the child**:

- Earned MPH is a cumulative resource, distinct from running speed. Thresholds are lifetime requirements, not purchase prices. Fractional precision is retained, and the display floors to whole earned MPH.
- Returning to the beginning resets position/distance and refills energy after a 1.8-second tired state, without erasing progression or starting automatically.
- Upgrades happen between runs, one per click; 10 MPH is the maximum. No background or offline solo earnings.
- 2 energy/second and `speed × 20` earned MPH/second are prototype balancing values. Distance in metres uses actual MPH conversion and is separate from the resource.
- Sunny Meadows and Twilight Trails are proposed world names/artwork. There are two worlds, no further progression or statistical multipliers. Entering the second world consumes nothing.
- Colours, caps, crowns, glasses, scarves, and jerseys are proposed, free appearance options with no statistics.
- The optional device profiles and leaderboard ranking (earned MPH, speed, shared ties) are local defaults.
- Races are private, for 2–8 people, with 45 seconds of racing, a 3-second countdown, equal energy rules, shared ties, and a 15-second detected-disconnect grace. Race statistics stay separate from solo rewards.

**Open balancing question:** a 20,000 earned MPH threshold was mentioned without an agreed placement. It is deliberately not inserted into the schedule and does not create another upgrade.

## Saves, privacy, and accessibility

`localStorage` key `simple-running-game.v1` stores a versioned set of independent profiles (alias, lifetime earned MPH, sequential speed, unlocks, selected world, and appearance). It saves periodically during runs and at meaningful changes/page exit, rather than every animation frame. Loaded data is validated and clamped; unlocks are derived from non-decreasing lifetime progression. Corrupt, unavailable, or incompatible storage displays a notice and leaves the current session playable. Reloads never restore active run time. Clearing browser data loses solo progress. Simultaneous solo tabs do not merge saves; use separate sessions/profiles for races. Local saves are editable and are not proof of earned competitive speed.

No emails, dates of birth, or real names are needed. Use aliases. Solo profiles stay on the device; the room server temporarily receives racing aliases, speed, look, and earned MPH to check world eligibility. Tokens are private session credentials. Do not share a browser session or copy its storage if you want independent runners.

Controls support keyboard, mouse, and touch, visible focus, named controls, modal focus wrapping, numeric energy, text lock states, and reduced-motion preferences. The UI fits phone, tablet, and desktop widths. Human models, environment geometry, textures, and SVG portraits are authored in this repository and covered by its MIT license. Three.js is an MIT-licensed dependency. See `ASSETS.md`. No remote assets or sound permissions are needed.

## Graphics and scene movement

The main play world uses a **3D human runner and outdoor landscape**. The human has proportioned anatomy, skin, hair, sportswear, trainers, articulated arms, and two-bone leg placement with ground-contact timing matched to trail movement. Existing colour selections now tint the shirt. Caps, crowns, glasses, scarves and jerseys remain free cosmetic options with no effect on statistics. The human character replaces the original stickman at the user's later request; existing save identifiers and cosmetics remain compatible.

Trees use textured trunks, branching geometry and instanced foliage. Ground, gravel, grass, clouds and moon textures are generated locally in the browser. Terrain has surface detail, fog, daylight/moonlight, and cast shadows. The two worlds have different sky and lighting conditions. No downloaded character models, hotlinked images, paid asset services, or credentials are required.

World movement follows active run time and distance. Pausing freezes the world, resuming continues, and exhaustion returns it to the beginning. Screen travel is deliberately exaggerated and does not alter actual metres, energy or earned MPH. Reduced motion holds the human and scenery still while gameplay continues.

The graphics engine is loaded separately from the game controls and caps rendering at 30 frames/second and device pixel ratio 1.5. It redraws only when needed. Multiplayer lobby/reconnection takes priority: the obscured 3D world is not warmed up or animated while that panel is open. Modern WebGL2-capable browsers render the 3D scene; an animated 2D human/scenery fallback keeps gameplay working if WebGL is unavailable or the context is lost. Menus and race lanes use lightweight human SVG portraits.

Upgrade feedback appears briefly as a toast without pushing the play area down. Existing version-1 profiles, aliases, worlds, cosmetics and progression remain compatible. Browser tests exercise real WebGL using Chromium's software renderer, in addition to the fallback. Physical-device GPU performance is not certified by those checks.

## Validate

```sh
npm test                 # Simulation, persistence, room engine and real socket tests
npm run typecheck        # All source and tests
npm run build            # Type check + production bundle
npm run test:browser     # Isolated Chromium sessions against the actual backend
npm run check            # All of the above
```

Browser tests use `/usr/bin/chromium` when present, otherwise Playwright's managed Chromium. Install it with `npx playwright install chromium` if necessary, or set `CHROMIUM_PATH` to your Chromium executable. Linux may also need browser system dependencies (`npx playwright install-deps chromium`, with appropriate OS permissions). Browser tests build and start a dedicated production server on port **4174**, use 3-second races, a 0.5-second countdown and 2-second grace for speed, and shut it down afterward. Keep that port free. Unit/room tests also check the default 45-second rules using a deterministic server clock, including exhaustion at 50 seconds in a longer race.

`tests/browser/game.spec.ts` contains **test-only local-save fixtures** for the late-game thresholds. They are not bundled into production, provide no production cheat controls, and never post global scores. Solo browser tests advance a controlled browser clock in elapsed-time steps (without drawing every skipped frame); multiplayer tests use actual independent clients, real sockets, and server time. Browser visibility checks dispatch the visibility event explicitly; there is also a full-duration manual headless check described in `VERIFICATION.md`.

Screenshots/traces are generated under ignored `test-results/`. See **`VERIFICATION.md`** for the checks performed and their limits. Physical-device LAN and hosted internet verification are separate from localhost multi-client verification.

## Source map

- `shared/config.ts`: central rules, worlds, cosmetics, and provisional constants.
- `shared/game.ts`: pure active-time solo simulation, sequential upgrades, save validation, local ranking.
- `shared/protocol.ts`: shared room and wire-message types.
- `src/storage.ts`: resilient versioned browser persistence.
- `src/art.ts`, `src/style.css`: scene shell, human previews, game UI and fallback animation.
- `src/scenery.ts`: lazy 3D lifecycle, active-time movement, reduced motion, and fallback.
- `src/graphics/world.ts`: WebGL world, terrain, trees, lighting, shadows and responsive camera.
- `src/graphics/human.ts`: articulated human model, two-bone legs, running pose and accessories.
- `src/graphics/motion.ts`: shared visual trail speed and ground-contact gait.
- `src/graphics/textures.ts`, `src/graphics/avatar.ts`: generated textures and human SVG portraits.
- `src/main.ts`: solo state machine, panels, accessible controls, live race presentation.
- `src/network.ts`: WebSocket intentions/snapshots, private session persistence, reconnection.
- `server/rooms.ts`: authoritative room lifecycle, timing, distances, energy, host transfer, results.
- `server/index.ts`: bounded WebSocket transport, origin validation, health check, production static serving.
- `tests/`: focused unit, socket integration, and browser acceptance tests.
