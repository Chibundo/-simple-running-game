import * as THREE from 'three';
import { GAME, type Cosmetics } from '../../shared/config';
import { footPose } from './motion';

/** A proportioned human, with two-bone leg placement and coordinated arm swing. */
export class HumanRunner {
  readonly root = new THREE.Group();
  private upperBody = new THREE.Group();
  private skin = new THREE.MeshStandardMaterial({ color: '#ad7859', roughness: .8 });
  private shirt = new THREE.MeshStandardMaterial({ color: '#263e3c', roughness: .87 });
  private shorts = new THREE.MeshStandardMaterial({ color: '#222d31', roughness: .95 });
  private hair = new THREE.MeshStandardMaterial({ color: '#24201c', roughness: 1 });
  private shoe = new THREE.MeshStandardMaterial({ color: '#d9ded8', roughness: .8 });
  private trim = new THREE.MeshStandardMaterial({ color: '#a5b4aa', roughness: .8 });
  private limbs: { upper: THREE.Mesh; lower: THREE.Mesh; foot: THREE.Group; side: number }[] = [];
  private arms: { upper: THREE.Mesh; lower: THREE.Mesh; hand: THREE.Mesh; side: number }[] = [];
  private accessories = new THREE.Group();
  private lookKey = '';
  private up = new THREE.Vector3(0, 1, 0);
  private delta = new THREE.Vector3();

  constructor(look: Cosmetics) {
    this.root.rotation.y = Math.PI / 2;
    this.root.add(this.upperBody);
    const rings = [new THREE.Vector2(.125, 0), new THREE.Vector2(.14, .12), new THREE.Vector2(.16, .3), new THREE.Vector2(.185, .4), new THREE.Vector2(.14, .45), new THREE.Vector2(.07, .48)];
    const torso = this.mesh(new THREE.LatheGeometry(rings, 16), this.shirt);
    torso.position.y = .96; torso.scale.z = .7; this.upperBody.add(torso);
    const hips = this.mesh(new THREE.SphereGeometry(1, 16, 12), this.shorts);
    hips.scale.set(.16, .13, .11); hips.position.y = .94; this.upperBody.add(hips);
    const neck = this.mesh(new THREE.CylinderGeometry(.047, .058, .11, 12), this.skin);
    neck.position.y = 1.48; this.upperBody.add(neck);
    const head = this.mesh(new THREE.SphereGeometry(1, 24, 20), this.skin);
    head.scale.set(.082, .117, .091); head.position.set(0, 1.61, .025); this.upperBody.add(head);
    const hair = this.mesh(new THREE.SphereGeometry(.09, 20, 14, 0, Math.PI * 2, 0, Math.PI * .56), this.hair);
    hair.scale.set(1, 1.14, 1.05); hair.position.set(0, 1.64, .015); this.upperBody.add(hair);
    for (const side of [-1, 1]) {
      const ear = this.mesh(new THREE.SphereGeometry(.018, 10, 8), this.skin); ear.scale.set(.7, 1.4, 1); ear.position.set(side * .079, 1.61, .018); this.upperBody.add(ear);
      const eye = this.mesh(new THREE.SphereGeometry(.01, 8, 8), new THREE.MeshStandardMaterial({ color: '#eee9de' }));
      eye.scale.set(1, .7, .45); eye.position.set(side * .03, 1.635, .109); this.upperBody.add(eye);
      const pupil = this.mesh(new THREE.SphereGeometry(.0045, 8, 8), this.hair); pupil.position.set(side * .03, 1.635, .113); this.upperBody.add(pupil);
    }
    const nose = this.mesh(new THREE.SphereGeometry(.017, 10, 8), this.skin); nose.scale.set(.65, 1, 1.25); nose.position.set(0, 1.613, .115); this.upperBody.add(nose);
    const mouth = this.mesh(new THREE.CapsuleGeometry(.0025, .022, 3, 6), new THREE.MeshStandardMaterial({ color: '#754b3b' }));
    mouth.rotation.z = Math.PI / 2; mouth.position.set(0, 1.582, .108); this.upperBody.add(mouth);
    for (const side of [-1, 1]) {
      const upper = this.mesh(new THREE.CylinderGeometry(.056, .07, 1, 12), this.skin);
      const lower = this.mesh(new THREE.CylinderGeometry(.03, .052, 1, 12), this.skin);
      const foot = new THREE.Group();
      const sole = this.mesh(new THREE.BoxGeometry(.085, .026, .22), this.trim); sole.position.set(0, -.015, .045); foot.add(sole);
      const trainer = this.mesh(new THREE.SphereGeometry(1, 12, 10), this.shoe); trainer.scale.set(.043, .045, .112); trainer.position.z = .045; foot.add(trainer);
      const sock = this.mesh(new THREE.CylinderGeometry(.03, .034, .07, 10), this.shoe); sock.position.y = .04; foot.add(sock);
      this.root.add(upper, lower, foot); this.limbs.push({ upper, lower, foot, side });
      const sleeve = this.mesh(new THREE.CylinderGeometry(.063, .075, 1, 12), this.shirt);
      const forearm = this.mesh(new THREE.CylinderGeometry(.027, .038, 1, 12), this.skin);
      const hand = this.mesh(new THREE.SphereGeometry(1, 12, 8), this.skin); hand.scale.set(.032, .047, .025);
      this.root.add(sleeve, forearm, hand); this.arms.push({ upper: sleeve, lower: forearm, hand, side });
      const shortLeg = this.mesh(new THREE.CylinderGeometry(.087, .08, .2, 12), this.shorts);
      shortLeg.position.set(side * .09, .87, 0); this.upperBody.add(shortLeg);
    }
    this.upperBody.add(this.accessories); this.setLook(look); this.pose(0, 1, false, false);
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material) {
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
  }
  private bone(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
    this.delta.subVectors(b, a); mesh.position.copy(a).addScaledVector(this.delta, .5);
    mesh.scale.y = this.delta.length(); mesh.quaternion.setFromUnitVectors(this.up, this.delta.normalize());
  }
  setLook(look: Cosmetics) {
    const key = JSON.stringify(look); if (key === this.lookKey) return; this.lookKey = key;
    this.shirt.color.set(GAME.colors.find(c => c.id === look.color)?.value ?? '#263e3c');
    for (const child of [...this.accessories.children]) { child.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(m => m.dispose()); } }); this.accessories.remove(child); }
    const capMaterial = new THREE.MeshStandardMaterial({ color: '#ca7d3d', roughness: .9 });
    if (look.hat === 'cap') {
      const cap = this.mesh(new THREE.SphereGeometry(.096, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), capMaterial); cap.position.set(0, 1.652, .02); this.accessories.add(cap);
      const bill = this.mesh(new THREE.SphereGeometry(1, 14, 8), capMaterial); bill.scale.set(.097, .008, .105); bill.position.set(0, 1.657, .08); this.accessories.add(bill);
    } else if (look.hat === 'crown') {
      const gold = new THREE.MeshStandardMaterial({ color: '#d2a84c', metalness: .6, roughness: .35 });
      const crown = this.mesh(new THREE.CylinderGeometry(.092, .087, .04, 16, 1, true), gold); crown.position.set(0, 1.72, .02); this.accessories.add(crown);
      for (let i = 0; i < 5; i++) { const angle = i / 5 * Math.PI * 2; const tip = this.mesh(new THREE.ConeGeometry(.021, .055, 4), gold); tip.position.set(Math.sin(angle) * .083, 1.758, .02 + Math.cos(angle) * .083); this.accessories.add(tip); }
    } else capMaterial.dispose();
    if (look.glasses !== 'none') {
      const dark = new THREE.MeshStandardMaterial({ color: look.glasses === 'sun' ? '#1e2b31' : '#788b8d', metalness: .3, roughness: .3 });
      for (const side of [-1, 1]) {
        const geometry = look.glasses === 'sun' ? new THREE.BoxGeometry(.046, .028, .009) : new THREE.TorusGeometry(.021, .0025, 5, 16);
        const lens = this.mesh(geometry, dark); lens.position.set(side * .03, 1.636, .116); this.accessories.add(lens);
      }
      const bridge = this.mesh(new THREE.BoxGeometry(.024, .004, .006), dark); bridge.position.set(0, 1.636, .119); this.accessories.add(bridge);
    }
    if (look.outfit === 'scarf') {
      const cloth = new THREE.MeshStandardMaterial({ color: '#d16d40', roughness: 1 });
      const scarf = this.mesh(new THREE.TorusGeometry(.063, .018, 8, 16), cloth); scarf.rotation.x = Math.PI / 2; scarf.position.set(0, 1.465, 0); this.accessories.add(scarf);
      const end = this.mesh(new THREE.BoxGeometry(.05, .17, .012), cloth); end.position.set(-.04, 1.38, -.045); end.rotation.z = -.25; this.accessories.add(end);
    }
    if (look.outfit === 'jersey') {
      const seam = this.mesh(new THREE.BoxGeometry(.019, .31, .012), new THREE.MeshStandardMaterial({ color: '#d8e6dd', roughness: .9 })); seam.position.set(-.035, 1.21, .11); this.accessories.add(seam);
    }
  }
  pose(seconds: number, speed: number, moving: boolean, tired: boolean) {
    const phase = moving ? seconds * (1.4 + speed * .11) * Math.PI * 2 : 0;
    const bob = moving ? -Math.cos(phase * 2) * .018 : 0;
    const hipBase = moving ? .87 - .012 * (speed - 1) : .94;
    const hipY = hipBase + bob;
    this.upperBody.position.y = bob + hipBase - .94;
    this.upperBody.rotation.x = tired ? .22 : moving ? .05 + speed * .01 : 0;
    this.upperBody.position.z = -.94 * Math.sin(this.upperBody.rotation.x);
    this.upperBody.position.y += .94 * (1 - Math.cos(this.upperBody.rotation.x));
    this.upperBody.updateMatrix();
    for (const leg of this.limbs) {
      const target = moving ? footPose(seconds, speed, leg.side) : { z: leg.side * .035, y: .05, pitch: 0 };
      const hip = new THREE.Vector3(leg.side * .09, hipY, 0);
      const foot = new THREE.Vector3(leg.side * .09, target.y, target.z);
      const d = Math.min(.894, hip.distanceTo(foot)), a = .46, b = .44;
      const line = Math.atan2(foot.z - hip.z, hip.y - foot.y);
      const bend = Math.acos(THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
      const knee = new THREE.Vector3(hip.x, hip.y - Math.cos(line + bend) * a, hip.z + Math.sin(line + bend) * a);
      this.bone(leg.upper, hip, knee); this.bone(leg.lower, knee, foot);
      leg.foot.position.copy(foot); leg.foot.rotation.x = target.pitch;
    }
    for (const arm of this.arms) {
      const swing = moving ? Math.cos(phase + (arm.side === 1 ? Math.PI : 0)) * .6 : -.12;
      const shoulder = new THREE.Vector3(arm.side * .185, 1.385, .025);
      const elbow = new THREE.Vector3(arm.side * .2, shoulder.y - .27 * Math.cos(swing), -.27 * Math.sin(swing));
      const wrist = new THREE.Vector3(arm.side * .18, elbow.y + (moving ? .045 : -.21), elbow.z + (moving ? .23 : .035));
      [shoulder, elbow, wrist].forEach(point => point.applyMatrix4(this.upperBody.matrix));
      this.bone(arm.upper, shoulder, elbow); this.bone(arm.lower, elbow, wrist); arm.hand.position.copy(wrist);
    }
  }
}
