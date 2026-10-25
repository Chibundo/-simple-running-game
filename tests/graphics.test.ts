import { test } from 'node:test';
import assert from 'node:assert/strict';
import { footPose, visualTravel } from '../src/graphics/motion';

test('human feet stay anchored to the moving trail during ground contact at every speed', () => {
  for (let speed = 1; speed <= 10; speed++) {
    const a = .01 / (1.4 + speed * .11), b = .35 / (1.4 + speed * .11);
    const first = footPose(a, speed, -1), second = footPose(b, speed, -1);
    assert.equal(first.planted, true); assert.equal(second.planted, true);
    const worldA = first.z + visualTravel(a, speed * a * 1609.344 / 3600);
    const worldB = second.z + visualTravel(b, speed * b * 1609.344 / 3600);
    assert.ok(Math.abs(worldA - worldB) < 1e-8, 'planted foot slid over the trail');
    for (let step = 0; step < 100; step++) {
      const pose = footPose(step / 100, speed, 1);
      assert.ok(pose.y >= .05 && pose.y <= .29 + 1e-9);
      assert.ok(Number.isFinite(pose.z));
    }
  }
});
