import type { Run } from '../shared/game';

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
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');

  constructor(root: HTMLElement) {
    this.layers = Array.from(root.querySelectorAll<HTMLElement>('[data-scenery-layer]'))
      .map(element => ({ element, depth: DEPTHS[element.dataset.sceneryLayer!] }));
    this.road = root.querySelector('.track-dashes')!;
    this.specks = root.querySelector('.track-specks')!;
  }

  render(run: Run) {
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
