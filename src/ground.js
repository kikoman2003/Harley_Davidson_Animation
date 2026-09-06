import * as THREE from 'three';

const ROAD_WIDTH  = 9; // world units across the road
const TILE_SIZE   = 5; // world units per texture tile along the road's length
const TERRAIN_PAD = 40; // grass margin around the track's bounding box

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
  const shadowCatcher = new THREE.Mesh(
    new THREE.CircleGeometry(5, 48),
    new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.35 }),
  );
  shadowCatcher.rotation.x    = -Math.PI / 2;
  shadowCatcher.position.y    = -0.02;
  shadowCatcher.receiveShadow = true;
  scene.add(shadowCatcher);

  return { shadowCatcher };
}

// Builds a road ribbon that hugs the bike's actual sampled path (a closed
// loop, since the animation returns to its start each cycle) instead of an
// arbitrary straight strip, so the road always points the way the bike is
// actually heading — including through curves. Also lays a grass terrain
// plane sized to comfortably cover the whole track.
export function buildRoadAndTerrain(scene, pathPoints) {
  const n = pathPoints.length;
  const left  = new Array(n);
  const right = new Array(n);
  const dist  = new Array(n);
  dist[0] = 0;

  for (let i = 0; i < n; i++) {
    const prev = pathPoints[(i - 1 + n) % n];
    const next = pathPoints[(i + 1) % n];
    let tx = next.x - prev.x;
    let tz = next.z - prev.z;
    const tLen = Math.hypot(tx, tz) || 1;
    tx /= tLen; tz /= tLen;

    const hw = ROAD_WIDTH / 2;
    const px = -tz * hw;
    const pz =  tx * hw;
    const p  = pathPoints[i];
    left[i]  = { x: p.x + px, z: p.z + pz };
    right[i] = { x: p.x - px, z: p.z - pz };

    if (i > 0) {
      dist[i] = dist[i - 1] + Math.hypot(p.x - pathPoints[i - 1].x, p.z - pathPoints[i - 1].z);
    }
  }

  const positions = new Float32Array(n * 2 * 3);
  const uvs       = new Float32Array(n * 2 * 2);
  const normals   = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i++) {
    const v = dist[i] / TILE_SIZE;
    const li = i * 2, ri = i * 2 + 1;
    positions[li * 3] = left[i].x;  positions[li * 3 + 1] = 0; positions[li * 3 + 2] = left[i].z;
    positions[ri * 3] = right[i].x; positions[ri * 3 + 1] = 0; positions[ri * 3 + 2] = right[i].z;
    uvs[li * 2] = 0; uvs[li * 2 + 1] = v;
    uvs[ri * 2] = 1; uvs[ri * 2 + 1] = v;
    normals[li * 3 + 1] = 1; normals[ri * 3 + 1] = 1;
  }

  const indices = [];
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const li = i * 2, ri = i * 2 + 1, ln = next * 2, rn = next * 2 + 1;
    indices.push(li, rn, ri);
    indices.push(li, ln, rn);
  }

  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  roadGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  roadGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  roadGeo.setIndex(indices);

  const asphaltTex = makeAsphaltTexture(512);
  const roadMesh = new THREE.Mesh(
    roadGeo,
    new THREE.MeshStandardMaterial({ map: asphaltTex, color: 0xcccccc, roughness: 0.97, metalness: 0.00 }),
  );
  roadMesh.position.y    = -0.06;
  roadMesh.receiveShadow = true;
  scene.add(roadMesh);

  const minX = Math.min(...pathPoints.map((p) => p.x)) - TERRAIN_PAD;
  const maxX = Math.max(...pathPoints.map((p) => p.x)) + TERRAIN_PAD;
  const minZ = Math.min(...pathPoints.map((p) => p.z)) - TERRAIN_PAD;
  const maxZ = Math.max(...pathPoints.map((p) => p.z)) + TERRAIN_PAD;

  const terrainPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(maxX - minX, maxZ - minZ, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x6b8f52, roughness: 1, metalness: 0 }),
  );
  terrainPlane.rotation.x    = -Math.PI / 2;
  terrainPlane.position.set((minX + maxX) / 2, -0.08, (minZ + maxZ) / 2);
  terrainPlane.receiveShadow = true;
  scene.add(terrainPlane);

  return { roadMesh, terrainPlane };
}
