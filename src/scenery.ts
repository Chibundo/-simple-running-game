import type { Run } from '../shared/game';
import { DEFAULT_LOOK, type Cosmetics, type WorldId } from '../shared/config';
import type { World3D } from './graphics/world';

const TILE_WIDTH = 960;
const DEPTHS: Record<string, number> = {
  clouds: 0.06,
  mountains: 0.13,
  hills: 0.32,
  trees: 0.85,
  foreground: 1.25,
};

/** Scenery follows active run time, so pausing never advances or resets it. */
export class Scenery {
  private layers: { element: HTMLElement; depth: number }[];
  private road: HTMLElement;
  private specks: HTMLElement;
  private lastTravel = NaN;
  private graphics?: World3D;
  private suspended = false;
  private startGraphics?: () => void;
  private latest?: { run: Run; look: Cosmetics; world: WorldId; speed: number };
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');

  constructor(root: HTMLElement) {
    this.layers = Array.from(root.querySelectorAll<HTMLElement>('[data-scenery-layer]'))
      .map(element => ({ element, depth: DEPTHS[element.dataset.sceneryLayer!] }));
    this.road = root.querySelector('.track-dashes')!;
    this.specks = root.querySelector('.track-specks')!;
    root.dataset.renderer = 'loading';
    void import('./graphics/world').then(({ World3D }) => {
      this.startGraphics = () => {
        if (this.suspended || this.graphics) return;
        try {
          this.graphics = new World3D(root, this.latest?.look ?? DEFAULT_LOOK);
          if (this.latest) this.graphics.render(this.latest.run, this.latest.look, this.latest.world, this.latest.speed, true);
        } catch {
          this.graphics?.dispose(); this.graphics = undefined;
          root.dataset.renderer = 'fallback';
          this.startGraphics = undefined;
        }
      };
      this.startGraphics();
    }).catch(() => { root.dataset.renderer = 'fallback'; });
    window.addEventListener('pagehide', () => this.graphics?.dispose());
  }

  /** Room networking takes priority over warming an obscured 3D scene. */
  suspend(value: boolean) {
    this.suspended = value;
    if (!value) this.startGraphics?.();
  }

  render(run: Run, look: Cosmetics = DEFAULT_LOOK, world: WorldId = 'meadow', speed = 1) {
    this.latest = { run, look, world, speed };
    if (this.suspended) return;
    if (this.graphics?.available) {
      this.graphics.render(run, look, world, speed);
      return;
    }
    // Artistic screen distance: intentionally exaggerated so 1 MPH still feels alive.
    // Actual metres, earned MPH, and energy continue to use the shared simulation.
    const travel = this.reduced.matches ? 0 : run.seconds * 50 + run.distance * 65;
    if (travel === this.lastTravel) return;
    this.lastTravel = travel;
    for (const { element, depth } of this.layers) {
      element.style.transform = `translate3d(-${(travel * depth) % TILE_WIDTH}px, 0, 0)`;
    }
    this.road.style.transform = `translate3d(-${travel % 80}px, 0, 0)`;
    this.specks.style.transform = `translate3d(-${travel % 160}px, 0, 0)`;
  }
}
