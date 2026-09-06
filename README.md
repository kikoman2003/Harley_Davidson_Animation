# Harley-Davidson 3D Showcase

An interactive 3D web experience built with Three.js. A Harley-Davidson motorcycle model is displayed in a bright daytime scene. Pressing **RIDE** starts the animation and an orbiting camera that follows the bike as it rides its full curved route, down a street built to match its actual path, with a grass shoulder on each side.

---

## Live Features

| Feature | Detail |
|---|---|
| 3D model | GLB format, loaded via GLTFLoader |
| Animations | All embedded clips play simultaneously and loop forever |
| Infinite forward movement | The bike never reaches the end of the road |
| Showcase orbit | Slow 360° camera rotation while the bike is stationary |
| Cinematic intro | Zoom-in → hold → zoom-out sequence when RIDE is pressed |
| Orbiting camera | Smooth 360° orbit with gentle height breathing during the ride |
| Street | A curved road ribbon built to match the bike's actual sampled path (not just a straight strip), with a dashed centre line and grass shoulders |
| Part fading | Model parts far from the camera fade out to reduce clutter |
| Day atmosphere | Sky gradient, mountains, floating dust, fog |

---

## Controls

| Action | How |
|---|---|
| **RIDE** | Click the amber button — starts animation and intro sequence |
| **STOP** | Click the amber button — freezes the bike |
| Rotate camera | Click and drag (OrbitControls active during showcase) |
| Zoom | Scroll wheel |

---

## Tech Stack

- **[Vite](https://vitejs.dev/)** — dev server and bundler
- **[Three.js](https://threejs.org/)** — 3D rendering, scene graph, animation mixer
- **[GLTFLoader](https://threejs.org/docs/#examples/en/loaders/GLTFLoader)** — loads the `.glb` model
- **[OrbitControls](https://threejs.org/docs/#examples/en/controls/OrbitControls)** — mouse camera interaction

---

## Running Locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) (or the port Vite picks if that is in use).

```bash
npm run build    # production bundle → dist/
```

---

## Project Structure

```
src/
├── main.js          Entry point — wires all modules, owns the render loop
├── state.js         All shared constants and mutable runtime state
├── scene.js         Renderer, camera, OrbitControls, lighting
├── environment.js   Day sky: mountains, dust (stars/moon/city-glow kept but hidden)
├── ground.js        Road strip, grass terrain, and shadow catcher
├── bike.js          GLB loader, animation mixer, infinite forward movement
├── camera.js        Intro sequence logic + continuous orbit update
└── ui.js            RIDE / STOP buttons

public/
└── models/
    └── Bobber harley.glb   Harley-Davidson 3D model
```

---

## File-by-File Breakdown

### `src/state.js`
Single source of truth for the entire app. Contains:

- **Constants** — all camera tuning values (`ORBIT_SPEED`, `ORBIT_DISTANCE`, `ORBIT_HEIGHT`, `ORBIT_FOV`), intro sequence timings (`INTRO_ZOOM_IN_DUR`, `INTRO_HOLD_DUR`, `INTRO_ZOOM_OUT_DUR`), fade distances, animation start time, model path.
- **`state` object** — mutable runtime flags: `rideStarted`, `displayAngle`, `introPhase`, `introTimer`, `liveAngle/Distance/Height/Fov`, references to the Three.js `mixer`, `model`, `followTarget`, `activeActions`, `animationClips`, `fadedMeshes`.
- **Reusable `THREE.Vector3` instances** — `followPosition`, `prevFollowPosition`, `smoothedOrbitCenter`, `smoothedLookTarget`, `desiredLook`, `meshWP`, `lastFadePos`, `loopDisplace`, `loopStartPos`. Pre-allocated at startup so the render loop never allocates on the heap.
- **`smoothstep(t)`** — easing function used by the intro sequence.

---

### `src/scene.js`
`createScene()` returns `{ scene, camera, renderer, controls, clock }`.

- Creates the Three.js `WebGLRenderer` targeting the `#scene` canvas with anti-aliasing, SRGB colour space, PCF soft shadows.
- Creates a `PerspectiveCamera` (34° FOV, near 0.05, far 90).
- Builds the sky gradient background using a 2×512 canvas painted with six colour stops (deep black-blue at top, warm orange at horizon).
- Attaches `OrbitControls` with damping, pan disabled, distance clamped 1.8–16.
- Adds three lights:
  - `HemisphereLight` (white sky / dark-teal ground, intensity 2.1)
  - `DirectionalLight` key light (white, 3.2 intensity, casts shadows with 1024² shadow map)
  - `DirectionalLight` rim light (cool blue, 1.5 intensity, from upper-left-back)
  - `DirectionalLight` back fill (warm amber, 1.0 intensity, from behind)

---

### `src/environment.js`
`createEnvironment(scene)` returns `{ bgGroup, dust }`.

- **Floating dust** — 380 `Points` in a random ring 3–23 units out, slowly rotating in the render loop (`dust.rotation.y += delta * 0.025`).
- **Atmosphere beams** — two `ConeGeometry` meshes with additive blending; hidden (`visible = false`) since additive blending doesn't read well against a bright day sky.
- **`bgGroup`** — a `THREE.Group` that follows the bike's XZ position every frame so the background never runs out. Contains:
  - Two light blue-grey mountain cylinders (open-top `CylinderGeometry`, `BackSide` material, render order −3)
  - Stars, bright stars, moon (+ glow sprite), and city horizon glow — all built but hidden (`visible = false`); toggle them back on for a night look

---

### `src/ground.js`
`createGround(scene)` returns `{ shadowCatcher }`. The road and terrain aren't built here — they depend on the bike's actual animated path, which isn't known until the model and its clips have loaded (see `sampleBikePath` in `bike.js`).

- **`makeAsphaltTexture(512)`** — procedurally generates one road tile (512×512 canvas):
  1. Dark grey base fill (`#1c1c1e`)
  2. Pixel-level noise (±12 brightness per channel)
  3. 420 random ellipses for aggregate stones
  4. 7 random crack lines with low-opacity stroke
  5. A dashed white centre-line segment — one dash per tile, so it repeats seamlessly along the road
  - Returns a `THREE.CanvasTexture` with `RepeatWrapping`.
- **`buildRoadAndTerrain(scene, pathPoints)`** — called once, after `bike.js` samples the bike's path:
  - Walks the sampled points (a closed loop) and, at each one, offsets left/right by `ROAD_WIDTH / 2` along the local perpendicular (from a central-difference tangent) to build a ribbon that hugs the path's actual curves.
  - UVs: `u = 0/1` across the width (so the texture's centre line always lands dead centre — no tiling seams even on curves) and `v = cumulativeDistanceAlongPath / TILE_SIZE` along the length (so the dash spacing stays consistent regardless of how sharply the path curves).
  - Builds one `BufferGeometry` directly (positions, uvs, flat-up normals, indices) rather than a primitive shape, and closes the strip back to point 0 since the path is a loop.
  - Also sizes and centres a plain green terrain plane around the path's bounding box (plus a padding margin), so the grass shoulder comfortably covers the whole track.
- **Shadow catcher** — 5-unit-radius `CircleGeometry` with `ShadowMaterial` (opacity 0.35), follows the bike XZ position every frame (built in `createGround`, unlike the road/terrain this one still needs to track the bike since it casts the bike's own shadow).

---

### `src/bike.js`
Owns the model and animation system. Exports: `bikeContainer`, `loadBike()`, `playAllAnimations()`, `playAnimation()`, `fadeBackgroundParts()`, `frameCameraOnBike()`, `resumeBikeCameraFollow()`.

#### `bikeContainer` (THREE.Group)
The model is placed inside this group rather than directly in the scene. Every time the animation loops, the container's position is shifted forward by `loopDisplace` — the net world displacement of one full animation cycle — making the bike appear to travel forward indefinitely without any position reset visible in the animation.

#### Path sampling (`sampleBikePath`)
On load, a temporary `AnimationMixer` (`sampleMixer`) plays the longest clip and samples `followTarget.getWorldPosition()` at 200 evenly-spaced times across its duration, recording the XZ path the bike actually travels — including any curves. This array is handed to `buildRoadAndTerrain()` (in `ground.js`) to build the road mesh, and its first/last points are subtracted to get `loopDisplace` (the old two-sample approach is now just the first and last points of this same array). Runs synchronously before the real mixer starts.

#### `mixer.addEventListener('loop', ...)`
Fires every time the animation mixer completes one cycle. Shifts `bikeContainer.position` by `loopDisplace`, then snaps `smoothedOrbitCenter` and `smoothedLookTarget` to the new position so the camera shows zero visible jump. Also resets `prevFollowPosition` so the camera's speed calculation doesn't spike on the jump frame.

#### `fadeBackgroundParts()`
Throttled to fire only when the bike moves more than 2.5 units from `_lastFadePos`. Iterates `fadedMeshes` (all mesh nodes collected during `prepareModel`). Uses `setMaterialOpacity()` which has an early-out guard (`abs(current - target) < 0.005`) to avoid triggering Three.js render-list re-sorts — this was the fix for the periodic "ping" stutter.

#### `frameCameraOnBike()`
Hard-snaps camera, controls target, bgGroup, dust, and shadowCatcher to the bike's current world position. Called once right after load, before the path has been sampled and the road built.

---

### `src/camera.js`
`updateCamera(delta, { camera, controls })` — called every frame during the ride.

#### Intro sequence (phases 0 → 1 → 2 → 3)
| Phase | Duration | What happens |
|---|---|---|
| 0 | 2.8 s | Smooth zoom-in from 12 units to 3.5 units using `smoothstep` easing |
| 1 | 0.5 s (or until motion detected) | Hold at close distance, waiting for bike to start moving |
| 2 | 2.2 s | Zoom back out to orbit distance (7 units), transitioning FOV 28°→42° |
| 3 | ∞ | Continuous orbit |

#### Continuous orbit (phase 3)
- `state.liveAngle += delta * ORBIT_SPEED` — accumulates at 0.19 rad/s, completing one full 360° in ~33 seconds
- `state.liveHeight = ORBIT_HEIGHT + sin(elapsedTime * 0.11) * 0.45` — gentle height breathing at ~0.017 Hz, so the camera slowly rises and dips every ~60 seconds
- Exponential smoothing: `smoothedOrbitCenter.lerp(followPosition, 1 - exp(-delta / 0.12))` so the camera center follows the bike with a 120 ms time constant

#### `controls.update()` ordering
`controls.update()` is called **before** `camera.position.set(...)`. If it were called after, the damping would overwrite the cinematic position each frame.

---

### `src/ui.js`
`createUI({ onRide, onStop })` creates two amber-styled fixed buttons.

- **RIDE** — visible at startup. Clicking calls `onRide()` and swaps to STOP.
- **STOP** — hidden at startup. Clicking calls `onStop()` and swaps back to RIDE.
- Both buttons have hover colour transitions (`rgba(255,170,51,0.18)` on hover).
- Swapping uses CSS `opacity` + `pointerEvents` with a 0.55 s transition.

---

### `src/main.js`
Entry point. Responsibilities:
1. Calls all `create*` factory functions and passes their outputs to the modules that need them.
2. Passes `onRide` / `onStop` callbacks to `createUI`, which snap camera targets, reset intro state, and toggle `state.rideStarted`.
3. Owns the `animate()` render loop, which:
   - Calls `mixer.update(delta)` only when `rideStarted` is true.
   - Showcase mode (bike frozen): slow 360° `displayAngle` orbit at 0.38 rad/s.
   - Ride mode: calls `updateCamera(delta, ...)`, moves `bgGroup` and `shadowCatcher` to track the bike XZ, calls `fadeBackgroundParts()` when the bike moves more than 2.5 units. The road and terrain are static meshes built once at load time (see `sampleBikePath`/`buildRoadAndTerrain` below) — they don't need to be moved or scrolled each frame, since they already cover the bike's whole path.
4. Handles `window.resize`.

---

## Customising

### Swap the 3D model
Update `MODEL_PATH` in `src/state.js` to point at any GLB file (URL or local path) that has embedded animations. The loader picks the longest animation clip, samples its loop displacement, and everything else adapts automatically.

### Camera tuning
All camera constants live in `src/state.js`:
```js
ORBIT_SPEED    = 0.19   // rad/s  — lower = slower orbit
ORBIT_DISTANCE = 7.0    // units  — distance from bike
ORBIT_HEIGHT   = 1.4    // units  — base camera height
ORBIT_FOV      = 42     // degrees
```

---

## How the Road Works

The bike's animation isn't a straight line — it's a closed loop with a wide curve partway through (the heading swings by over 150° before straightening out again). Earlier versions of the road assumed straight-line travel, which made the bike look like it was drifting off the road through the curve. Fixing that properly meant building the road to match the bike's actual path rather than faking an "infinite straight road" illusion:

1. On load, `sampleBikePath()` scrubs a temporary mixer across the whole clip (200 samples) and records the bike's real XZ position at each one — this is the same loop the animation repeats forever, so one lap's worth of samples describes the entire road.
2. `buildRoadAndTerrain()` (in `ground.js`) turns those samples into an actual curved ribbon mesh: at each point it offsets left/right along the path's local perpendicular to build the road's edges, and stitches the strip back to its start since the path is a closed loop.
3. Because the road is a real static mesh that already covers the bike's whole path, it needs no per-frame scrolling or re-centering trick — unlike the camera, background, and shadow catcher, which still track the bike's live position every frame since they only need to frame whatever's immediately around it.
4. `loopDisplace` (the very first and last of those 200 samples, subtracted) still lets `bikeContainer` accumulate any net per-loop drift on the `AnimationMixer`'s `loop` event — for this particular clip it's ~0 since the path returns almost exactly to its start, but the mechanism holds for any clip that doesn't.
