# Deploy with Vercel + Render

Vercel hosts the Vite frontend. A Render Node web service hosts the authoritative WebSocket server. Both are needed for the complete game: Vercel Functions cannot run this persistent WebSocket server. No hosting resources have been created by adding these files.

`vercel.json` sets the frontend build and output directory. `render.yaml` declares a single Render web service, health check and free plan. It does not provision anything until an account owner applies it. Check the host's current plan limits before creating the service. A sleeping/restarted free service loses its in-memory rooms; solo browser saves remain.

## 1. Make the source available

The application must be in the GitHub branch selected by Render. Local uncommitted files are not visible to either provider's Git integration. Review and commit the game and deployment files, then push that branch. Vercel's CLI can also upload a local checkout directly when authenticated.

## 2. Create the multiplayer service on Render

In the Render account, create a Blueprint from this repository and the branch containing `render.yaml`. Alternatively create a Node Web Service with these settings:

- Build command: `npm ci --include=dev && npm run build`.
- Start command: `npm start`.
- Runtime: Node 24.
- Health check: `/health`.
- One instance. Keep the free plan unless a different plan is explicitly wanted.
- Leave `PORT` to Render; the server reads it and binds to `0.0.0.0`.

Set `ALLOWED_ORIGINS` to the exact public frontend origin, e.g. `https://your-game.vercel.app`. There is no trailing slash or path. If the Vercel project's final domain is not known yet, create the Vercel project first to get its assigned domain, then finish this setting. Do not allow all Vercel domains. To also play through Render's own frontend, list its origin too, separated by a comma.

After deployment, the public `https://<render-service>/health` must return `{"ok":true}`. The WebSocket endpoint is `wss://<render-service>/ws`. Its real URL is assigned by Render; example hostnames in these instructions are not live deployments.

## 3. Deploy the frontend to Vercel

Import the same GitHub repository/branch into the Vercel account, or deploy the local source with an authenticated Vercel CLI. Select the Vite preset and the repository root. The included `vercel.json` sets:

- Install: `npm ci --include=dev`.
- Build: `npm run build`.
- Output: `dist`.

Set the **Production** build environment variable `VITE_SERVER_URL` to the actual `wss://<render-service>/ws` URL before building. This is a public endpoint, not a credential. Redeploy the frontend after changing it: Vite embeds the value at build time. Set Node.js 24 in the project settings.

Vercel preview deployments have separate origins. Multiplayer on a preview works only if its exact origin is added to the backend's `ALLOWED_ORIGINS` and `VITE_SERVER_URL` is configured for that preview environment. Keep production invites on the stable production domain.

There are no Vercel serverless endpoints here. Frontend HTTP and backend WebSocket traffic use their respective hosts directly. The existing client automatically uses WSS from HTTPS pages.

## 4. Verify the public deployment

- Check Render's `/health` and load the Vercel production frontend with no missing JS/CSS or console errors.
- Start/pause a solo run and verify earned MPH rises, energy falls, and a reload preserves progress.
- Open two independent browsers or isolated profiles on the **public Vercel origin**. Create and join one room, ready up, and complete a race.
- Verify both clients see matching distances and the same result. Reload one mid-race to exercise reconnection.
- Create/copy invites from the production Vercel URL, not localhost.

Do not call the deployment complete until both public HTTPS and WSS behavior are verified. A local build does not establish hosted connectivity.

## Account access

This cloud environment currently has no Vercel or Render account connection, deployment token, or existing linked Vercel project. A hosting account connection is required to perform the remote deployment. Authenticate through the provider's supported secure flow or environment settings; never paste deployment tokens into chat. No paid resource is authorized by these files.

## Simpler alternative

To use one host instead, Render can serve both the frontend and the race server with the same `render.yaml`. Include the Render app's own origin in `ALLOWED_ORIGINS`; leave `VITE_SERVER_URL` unset for same-origin `/ws`. Vercel is then unnecessary.
