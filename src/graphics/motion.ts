/** Visual travel is shared with the gait so planted feet do not slide. */
export const visualTravel = (seconds: number, metres: number) => metres + seconds * (10 / 9);
export const visualSpeed = (mph: number) => 10 / 9 + mph * 1609.344 / 3600;

export function footPose(seconds: number, mph: number, side: number) {
  const cadence = 1.4 + mph * .11;
  const phase = (seconds * cadence + (side === 1 ? .5 : 0)) % 1;
  const contact = .45, stride = visualSpeed(mph) * contact / cadence;
  if (phase < contact) return { z: stride * (.5 - phase / contact), y: .05, pitch: -.12 + phase / contact * .36, planted: true };
  const swing = (phase - contact) / (1 - contact);
  const ease = swing * swing * (3 - 2 * swing);
  return { z: stride * (ease - .5), y: .05 + Math.sin(swing * Math.PI) * .24, pitch: -.2 * Math.sin(swing * Math.PI), planted: false };
}
