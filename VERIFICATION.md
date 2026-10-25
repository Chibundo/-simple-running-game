# Verification — 25 October 2026

## Final results

A clean lockfile installation (`npm ci --cache /workspace/.npm-cache --no-audit --no-fund`) completed successfully. The saved installation script was executed from `/workspace/-simple-running-game` and built the application.

The final `npm run check` completed with:

- **21/21 unit and integration tests passed**, no failures or skips.
- **17/17 Chromium browser tests passed**, no failures or skips.
- **TypeScript checking passed** for frontend, shared logic, server, configurations, and tests.
- **Vite production build passed** (about 41.4 kB JavaScript and 31.6 kB CSS before gzip, plus HTML).

The browser test command builds and runs the production HTTP/WebSocket server on port 4174. It uses real, independent browser contexts connected to that server, with shortened race settings (3 seconds, 0.5-second countdown, 2-second reconnect grace). No fake opponents or client-calculated final results are used.

## Coverage

| Area | Verified behavior |
| --- | --- |
| Fresh state | 1 MPH, zero earned MPH, 100/100 energy; Start runs automatically |
| Simulation | Elapsed active time gives equivalent results at 30/60/144 FPS; exact exhaustion clamp; no rewards after exhaustion |
| Progression | 99 locked / 100 eligible; one sequential upgrade per click; every configured threshold; final 100,000 threshold; 10 MPH maximum |
| Run lifecycle | Pause/Resume, panel pause/resume, explicit resume after visibility pause, tired feedback, reset position/energy, retained progression |
| Worlds | Both speed and earned-MPH requirements; locked at 9 MPH even with 100,000 earned MPH; world selection survives reload |
| Cosmetics | Colour and cap selection persist; simulation statistics unchanged by appearance |
| Profiles / leaderboard | Independent profiles, alias text rendering, earnings/speed sort, shared ranks, reset confirmation and active-profile-only reset |
| Persistence | Reload restores progression without offline rewards; corrupt, unknown, duplicate, invalid, and unavailable saves recover |
| UI | No horizontal overflow at 360, 390, 768, and 1440 pixels; touch-sized main controls; keyboard Start/Pause; modal forward/reverse focus wrapping; Escape; reduced motion |
| Lobby | At least two connected ready runners; host authority; capacity; cosmetic/speed/schema validation; world eligibility; locked race settings |
| Synchronisation | Shared countdown/start; two real clients' live distances within 0.5 m at 1 MPH; exact displayed final distance agreement; equal-speed shared placements |
| Race lifecycle | Server-timed finish, exhaustion for longer races, clean rematch, fresh energy/readiness; solo progression remains separate |
| Interruptions | Reload restores the same runner; panel closure and hidden-tab notification do not stop a race; host departure transfers authority; late joins spectate |
| Reconnect | Same runner and time within grace; distance retained; expired grace causes forfeit; expired private token rejected, including browser verification |
| Room lifecycle | Invalid/full/expired rooms; empty/idle cleanup; result rows retained after departures; departed slots cleared for the next lobby |
| Transport | Real sockets reject forged results/distances, invalid JSON, unauthorized actions, excessive message rates, oversized payloads, and unrelated browser origins |
| Recovery | Backend outage shows a useful error and leaves solo play available |

## Redesign and scenery checks — 25 October

The play screen now uses a larger illustrated stage, bolder typography, brighter controls, more detailed day/night worlds, and a compact mobile layout. A new renderer scrolls five seamless scenery layers plus road details from active run time/distance; it does not depend on repeating CSS scenery animations.

Three additional browser tests verify meaningful foreground movement at 1 MPH, slower/faster parallax depths, pause/resume without drift, faster scenery at higher speeds, tile coverage after repeated wraps at widths up to 1920 pixels, and stationary scenery with reduced motion while rewards continue. Existing multiplayer, persistence, progression, keyboard and responsive-layout checks also pass.

Desktop and phone captures of both worlds were inspected using existing-save fixtures with 9 MPH / 19,030 earned MPH and 10 MPH / 100,000 earned MPH, including saved cosmetics. No browser page errors were observed. The fixtures are test-only; the production game exposes no cheat controls. Evidence is in `/workspace/scratch/running-game-redesign/` in this environment.

## Full-duration race check — 23 October baseline

A separate headless check used **two isolated Chromium contexts** against the development frontend/proxy and real backend, with the unmodified **45-second race / 3-second countdown / 15-second reconnect grace** defaults.

- Both 1 MPH participants showed about **4.0 m** at the live intermediate read.
- One participant reloaded and reconnected, then closed the multiplayer view and opened another panel while the race continued.
- Both clients finished with **20.1 m**, **10/100 energy**, and **shared first place**.
- Both solo earned-MPH totals stayed at **0**.
- There were **no browser page errors**.

The exact authoritative distance is `45 × 1609.344 / 3600 = 20.1168 m`, displayed to one decimal place. Evidence screenshots are in `/workspace/scratch/running-game-evidence/` in this prepared environment. Automated screenshot outputs are under ignored `test-results/` and can be regenerated.

Desktop, phone, and multiplayer-result screenshots were visually inspected. Main controls remain readable and contained; the second world has a distinct night palette. Reduced motion suppresses scenery/limb animations without changing simulation.

## Scope and limits

- Localhost multi-client play and the Vite WebSocket proxy were tested. Physical separate-device LAN play was **not** tested; instructions are in README.
- No internet host was provisioned and no app was published. Public HTTPS/WSS, DNS, and certificates remain untested. The nginx file is a deployment example, not a verified live deployment.
- Tests use Chromium on Linux. Physical touch devices, Safari, and Firefox were not tested. Visibility tests explicitly dispatch the browser visibility event; they do not claim OS sleep/throttling certification.
- Solo saves and device leaderboards are local/editable, and races are casual. There is no persistent global ranking or cross-device solo-save sync.
- Rooms are in-memory in one server process. A server restart discards them. Solo progress remains in the browser.
- npm emits an update notice and Playwright's runner reports an inherited colour-setting warning; neither affected test outcomes.

## Reusable cloud setup

`install_script` and `start_skill` were saved to the environment configuration draft. Installation and service startup were exercised in the current machine; `/health`, frontend HTML and transformed client source were fetched successfully after restart. The draft has not been published or tested in a newly restored task. Review/save it in environment settings, then publish the **environment snapshot** to make this prepared filesystem reusable. This does not deploy the game to the internet.
