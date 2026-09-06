import * as THREE from 'three';

const ROAD_WIDTH  = 9;   // world units across (X)
const ROAD_LENGTH = 500; // world units long (Z, direction of travel)
const TILE_SIZE   = 5;   // world units per texture tile along the length

// One tile of the road surface: asphalt speckle/cracks plus a dashed centre
// line. Stretched across the full road width (no horizontal tiling) so the
// line always lands dead centre, and repeated along the length for the dash
// pattern.
function makeAsphaltTexture(size = 512) {
  const c   = document.createElement('canvas');
  c.width   = c.height = size;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#1c1c1e';
  ctx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  const d   = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v  = 22 + Math.floor((Math.random() - 0.5) * 24);
    d[i]     = v; d[i+1] = v; d[i+2] = v + 3; d[i+3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  for (let k = 0; k < 420; k++) {
    const x  = Math.random() * size, y = Math.random() * size;
    const rx = 1.5 + Math.random() * 3.5, ry = 1.0 + Math.random() * 2.5;
    const v  = Math.floor(28 + Math.random() * 18);
    ctx.fillStyle = `rgb(${v},${v},${v+2})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let k = 0; k < 7; k++) {
    ctx.strokeStyle = 'rgba(10,10,12,0.55)';
    ctx.lineWidth   = 0.7;
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, Math.random() * size);
    for (let s = 0; s < 5; s++) ctx.lineTo(Math.random() * size, Math.random() * size);
    ctx.stroke();
  }

  // Dashed centre line — one dash per tile so it repeats seamlessly.
  ctx.fillStyle = '#e8e0c8';
  ctx.fillRect(size / 2 - size * 0.018, size * 0.08, size * 0.036, size * 0.4);

  const tex      = new THREE.CanvasTexture(c);
  tex.wrapS      = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createGround(scene) {
  const asphaltTex = makeAsphaltTexture(512);
  asphaltTex.repeat.set(1, ROAD_LENGTH / TILE_SIZE);

  const asphaltPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH, 1, 1),
    new THREE.MeshStandardMaterial({ map: asphaltTex, color: 0xcccccc, roughness: 0.97, metalness: 0.00 }),
  );
  asphaltPlane.rotation.x    = -Math.PI / 2;
  asphaltPlane.position.y    = -0.06;
  asphaltPlane.receiveShadow = true;
  scene.add(asphaltPlane);

  // Wide grass shoulder so the road reads as a distinct street rather than
  // an undifferentiated floor stretching to the horizon.
  const terrainPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x6b8f52, roughness: 1, metalness: 0 }),
  );
  terrainPlane.rotation.x    = -Math.PI / 2;
  terrainPlane.position.y    = -0.08;
  terrainPlane.receiveShadow = true;
  scene.add(terrainPlane);

  const shadowCatcher = new THREE.Mesh(
    new THREE.CircleGeometry(5, 48),
    new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.35 }),
  );
  shadowCatcher.rotation.x    = -Math.PI / 2;
  shadowCatcher.position.y    = -0.02;
  shadowCatcher.receiveShadow = true;
  scene.add(shadowCatcher);

  return { asphaltTex, asphaltPlane, terrainPlane, shadowCatcher };
}
