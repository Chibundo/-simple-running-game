# Graphics and asset provenance

The game bundles its graphics code and creates its art locally. It does not download art or models while playing.

- `src/graphics/human.ts`: original procedural human model, sports clothing, shoes, facial features, hair and cosmetic accessories; articulated running pose.
- `src/graphics/world.ts`: original terrain, branching/instanced trees, foliage placement, lighting, sky shader, shadows and camera.
- `src/graphics/textures.ts`: deterministic, original Canvas-generated grass, dirt/gravel, bark, foliage, clouds and lunar surface textures. Seeds make the artwork repeatable. Texture pixels are created in the browser and are not photos of people or copied stock images.
- `src/graphics/avatar.ts`: original shaded human SVG portraits for menus, race lanes, logo and fallback.
- `src/art.ts`: original fallback landscape and interface icons.
- `public/favicon.svg`: original landscape icon.

These original assets are covered by the repository's MIT `LICENSE`. The rendering dependency `three` is MIT licensed; its license is distributed with the npm package and in `public/THIRD-PARTY-LICENSES.txt` (copied into the built site). Type declarations are supplied by `@types/three` for development. No third-party character model or stock-asset attribution is required.

The main scene uses real-time 3D rendering; the smaller human portraits and unsupported-WebGL fallback use SVG. Saved cosmetic IDs remain compatible with the earlier stickman version. Shirt colour replaces the former body-line colour without changing game statistics.
