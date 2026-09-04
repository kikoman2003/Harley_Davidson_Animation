import * as THREE from 'three';

export function createEnvironment(scene) {
  // Floating dust
  const DUST_COUNT = 380;
  const dPos       = new Float32Array(DUST_COUNT * 3);
  for (let i = 0; i < DUST_COUNT; i++) {
    const th = Math.random() * Math.PI * 2;
    const r  = 3 + Math.random() * 20;
    dPos[i*3]   = Math.cos(th) * r;
    dPos[i*3+1] = Math.random() * 14;
    dPos[i*3+2] = Math.sin(th) * r;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xe8dcb8, size: 0.055, transparent: true, opacity: 0.50, depthWrite: false,
  }));
  scene.add(dust);

  // Atmosphere beams (night-only — additive blending doesn't read well
  // against a bright day sky, so these stay hidden in the day scene)
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x2244aa, transparent: true, opacity: 0.038,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const beamGeo = new THREE.ConeGeometry(3.5, 14, 18, 1, true);
  [[-6, -3], [6, 4]].forEach(([x, z]) => {
    const b = new THREE.Mesh(beamGeo, beamMat);
    b.position.set(x, 10, z);
    b.visible = false;
    scene.add(b);
  });

  // Background group: mountains, stars, moon
  const bgGroup = new THREE.Group();
  scene.add(bgGroup);

  [
    { r: 44, h: 8,  col: 0x9fb8c9, segs: 48 },
    { r: 62, h: 12, col: 0xb3c9d6, segs: 56 },
  ].forEach(({ r, h, col, segs }) => {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r * 1.08, h, segs, 1, true),
      new THREE.MeshBasicMaterial({ color: col, side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    m.position.y  = h * 0.3;
    m.renderOrder = -3;
    bgGroup.add(m);
  });

  // Stars
  const STAR_COUNT = 2200;
  const sPos = new Float32Array(STAR_COUNT * 3);
  const sCol = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const th  = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1) * 0.45;
    const r   = 55 + Math.random() * 10;
    sPos[i*3]   = r * Math.sin(phi) * Math.cos(th);
    sPos[i*3+1] = r * Math.cos(phi) * 0.5 + 6;
    sPos[i*3+2] = r * Math.sin(phi) * Math.sin(th);
    const br  = 0.5 + Math.random() * 0.5;
    const hue = Math.random();
    if      (hue < 0.6) { sCol[i*3]=br*0.9; sCol[i*3+1]=br*0.9; sCol[i*3+2]=br; }
    else if (hue < 0.8) { sCol[i*3]=br; sCol[i*3+1]=br*0.85; sCol[i*3+2]=br*0.7; }
    else                { sCol[i*3]=br; sCol[i*3+1]=br*0.7;  sCol[i*3+2]=br*0.7; }
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  starGeo.setAttribute('color',    new THREE.BufferAttribute(sCol, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    size: 0.28, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, fog: false,
  }));
  stars.renderOrder = -2;
  stars.visible      = false; // night-only
  bgGroup.add(stars);

  // Bright stars
  const BS   = 70;
  const bPos = new Float32Array(BS * 3);
  for (let i = 0; i < BS; i++) {
    const th  = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1) * 0.38;
    const r   = 56;
    bPos[i*3]   = r * Math.sin(phi) * Math.cos(th);
    bPos[i*3+1] = r * Math.cos(phi) * 0.5 + 8;
    bPos[i*3+2] = r * Math.sin(phi) * Math.sin(th);
  }
  const bStarGeo = new THREE.BufferGeometry();
  bStarGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  const brightStars = new THREE.Points(bStarGeo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.55, transparent: true, opacity: 0.95, depthWrite: false, fog: false,
  }));
  brightStars.renderOrder = -2;
  brightStars.visible      = false; // night-only
  bgGroup.add(brightStars);

  // Moon
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xf0e8d0, fog: false }),
  );
  moon.position.set(22, 28, -38);
  moon.visible = false; // night-only
  bgGroup.add(moon);

  // Moon glow
  const mgCvs      = document.createElement('canvas');
  mgCvs.width      = mgCvs.height = 64;
  const mgCtx      = mgCvs.getContext('2d');
  const mgGr       = mgCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  mgGr.addColorStop(0, 'rgba(240,235,200,0.35)');
  mgGr.addColorStop(1, 'rgba(0,0,0,0)');
  mgCtx.fillStyle  = mgGr;
  mgCtx.fillRect(0, 0, 64, 64);
  const moonGlow   = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(mgCvs),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  moonGlow.position.copy(moon.position);
  moonGlow.scale.set(8, 8, 1);
  moonGlow.visible = false; // night-only
  bgGroup.add(moonGlow);

  // City horizon glow
  const cgCvs      = document.createElement('canvas');
  cgCvs.width      = 4; cgCvs.height = 128;
  const cgCtx      = cgCvs.getContext('2d');
  const cgGr       = cgCtx.createLinearGradient(0, 0, 0, 128);
  cgGr.addColorStop(0,   'rgba(0,0,0,0)');
  cgGr.addColorStop(0.6, 'rgba(40,18,5,0.18)');
  cgGr.addColorStop(1,   'rgba(80,35,5,0.32)');
  cgCtx.fillStyle  = cgGr;
  cgCtx.fillRect(0, 0, 4, 128);
  const cityGlow   = new THREE.Mesh(
    new THREE.CylinderGeometry(55, 55, 10, 48, 1, true),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(cgCvs), transparent: true, opacity: 1,
      side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }),
  );
  cityGlow.position.y  = -3;
  cityGlow.renderOrder = -2;
  cityGlow.visible     = false; // night-only
  bgGroup.add(cityGlow);

  return { bgGroup, dust };
}
