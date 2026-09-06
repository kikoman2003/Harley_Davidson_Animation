import * as THREE from 'three';

const ROAD_WIDTH   = 10;  // world units across the two-lane road surface
const CURB_WIDTH   = 0.5; // world units, each side
const CURB_HEIGHT  = 0.06;
const TILE_SIZE    = 5;   // world units per texture tile along the road's length
const TERRAIN_PAD  = 40;  // grass margin around the track's bounding box
const CURVE_TENSION = 0.5;

// One tile of the road surface: asphalt speckle/cracks, a dashed centre line,
// and solid white edge lines. Stretched across the full road width (no
// horizontal tiling) so the markings always land in the same place relative
// to the edges, and repeated along the length for the dash pattern.
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

  // Solid white edge lines, inset slightly from where the curb begins.
  const edgeInset = size * 0.06;
  ctx.fillRect(edgeInset, 0, size * 0.02, size);
  ctx.fillRect(size - edgeInset - size * 0.02, 0, size * 0.02, size);

  const tex      = new THREE.CanvasTexture(c);
  tex.wrapS      = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Builds N evenly (arc-length) spaced samples plus per-sample tangents along
// a closed Catmull-Rom spline fitted through pathPoints. Reused for the road
// surface and both curbs so they all bend identically through every curve.
function sampleSmoothPath(pathPoints, divisions) {
  const curve = new THREE.CatmullRomCurve3(
    pathPoints.map((p) => new THREE.Vector3(p.x, 0, p.z)),
    true, // closed loop — the animation returns to its start every cycle
    'catmullrom',
    CURVE_TENSION,
  );
  const points = curve.getSpacedPoints(divisions);
  const tangents = [];
  for (let i = 0; i < divisions; i++) {
    tangents.push(curve.getTangentAt(i / divisions));
  }
  return { points, tangents }; // points has divisions+1 entries (last === first)
}

// Builds a flat ribbon of given width hugging (points, tangents), with UVs
// driven by cumulative arc length so texture tiling stays consistent through
// curves. Returns a THREE.Mesh.
function buildRibbon(points, tangents, width, material, y) {
  const n = tangents.length; // == points.length - 1, closed loop
  const left = new Array(n);
  const right = new Array(n);
  const dist = new Array(n);
  dist[0] = 0;

  for (let i = 0; i < n; i++) {
    const t = tangents[i];
    const hw = width / 2;
    const px = -t.z * hw;
    const pz =  t.x * hw;
    const p  = points[i];
    left[i]  = { x: p.x + px, z: p.z + pz };
    right[i] = { x: p.x - px, z: p.z - pz };
    if (i > 0) {
      dist[i] = dist[i - 1] + Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z);
    }
  }

  const positions = new Float32Array(n * 2 * 3);
  const uvs       = new Float32Array(n * 2 * 2);
  const normals   = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i++) {
    const v = dist[i] / TILE_SIZE;
    const li = i * 2, ri = i * 2 + 1;
    positions[li * 3] = left[i].x;  positions[li * 3 + 1] = y; positions[li * 3 + 2] = left[i].z;
    positions[ri * 3] = right[i].x; positions[ri * 3 + 1] = y; positions[ri * 3 + 2] = right[i].z;
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

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setIndex(indices);

  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
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

// Builds the road, curbs, and grass terrain from the bike's actual sampled
// trajectory (see sampleBikePath in bike.js) — the road centreline IS that
// trajectory, smoothed through a closed Catmull-Rom spline so it bends
// exactly where the bike bends, with no separate/unrelated path. Built once,
// as static geometry, since the path is a closed loop the bike repeats
// forever: the whole road is always "ahead and behind" wherever the bike
// currently is, so no chunking/recycling or per-frame regeneration is
// needed.
export function buildRoadAndTerrain(scene, pathPoints) {
  const divisions = Math.max(pathPoints.length * 2, 300);
  const { points, tangents } = sampleSmoothPath(pathPoints, divisions);

  const asphaltTex = makeAsphaltTexture(512);
  const roadMesh = buildRibbon(
    points, tangents, ROAD_WIDTH,
    new THREE.MeshStandardMaterial({ map: asphaltTex, color: 0xcccccc, roughness: 0.97, metalness: 0.00 }),
    -0.06,
  );
  scene.add(roadMesh);

  const curbMaterial = new THREE.MeshStandardMaterial({ color: 0xb8b4ac, roughness: 0.9, metalness: 0 });
  const curbHalfSpan = ROAD_WIDTH / 2 + CURB_WIDTH;
  // Re-derive left/right curb centrelines by offsetting the road's own
  // centreline points outward, then ribbon those at CURB_WIDTH.
  const leftCurbPoints = points.slice(0, -1).map((p, i) => {
    const t = tangents[i];
    return { x: p.x - t.z * (curbHalfSpan - CURB_WIDTH / 2), z: p.z + t.x * (curbHalfSpan - CURB_WIDTH / 2) };
  });
  const rightCurbPoints = points.slice(0, -1).map((p, i) => {
    const t = tangents[i];
    return { x: p.x + t.z * (curbHalfSpan - CURB_WIDTH / 2), z: p.z - t.x * (curbHalfSpan - CURB_WIDTH / 2) };
  });
  scene.add(buildRibbon(leftCurbPoints.concat(leftCurbPoints[0]), tangents, CURB_WIDTH, curbMaterial, -0.06 + CURB_HEIGHT));
  scene.add(buildRibbon(rightCurbPoints.concat(rightCurbPoints[0]), tangents, CURB_WIDTH, curbMaterial, -0.06 + CURB_HEIGHT));

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
