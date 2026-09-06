# Harley-Davidson 3D Showcase

An interactive 3D web experience built with Three.js. A Harley-Davidson motorcycle model is displayed in a bright daytime scene. Pressing **RIDE** starts the animation and an orbiting camera that follows the bike as it rides its full curved route, down a two-lane street built to match its exact trajectory, with curbs and a grass shoulder on each side.

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
| Street | A curved two-lane road (via a Catmull-Rom spline) built to match the bike's actual sampled trajectory, with curbs, a dashed centre line, edge lines, and grass shoulders |
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
├── ground.js        Curved road/curbs/terrain (built from the bike's path) and shadow catcher
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
`createGround(scene)` returns `{ shadowCatcher }`. The road, curbs, and terrain aren't built here — they depend on the bike's actual animated trajectory, which isn't known until `bike.js` has loaded the model and sampled its clips (see `sampleBikePath`, below).

- **`makeAsphaltTexture(512)`** — procedurally generates one road tile (512×512 canvas): dark grey base fill, pixel-level noise, 420 random ellipses for aggregate stones, 7 random crack-line strokes, a dashed centre-line segment (one dash per tile, so it repeats seamlessly), and two solid white edge lines inset from where the curbs begin. Returns a `THREE.CanvasTexture` with `RepeatWrapping`.
- **`sampleSmoothPath(pathPoints, divisions)`** — fits an **open** `THREE.CatmullRomCurve3` through the raw sampled points and calls `curve.getSpacedPoints()` for evenly arc-length-spaced points plus `curve.getTangentAt()` for the exact analytical tangent at each one. Open, not closed: the raw samples run from the animation's start to a point ~90 units short of a full lap, then the clip hard-teleports back to its start rather than smoothly curving back (see `loopDisplace`, below) — fitting a *closed* spline here would fabricate a fake road segment bridging that teleport gap. This is what makes the road a genuinely smooth spline through the curve rather than a faceted polyline between the raw, unevenly-time-spaced samples.
- **`buildRibbon(points, tangents, width, material, y)`** — the shared ribbon-builder: offsets each point left/right by `width / 2` along its tangent's perpendicular to build one open-ended `BufferGeometry` (positions, UVs, flat-up normals, indices) in a single draw call. UVs use `u = 0/1` across the width (so markings always land in the same place relative to the edges, even through curves) and `v = cumulativeDistanceAlongPath / TILE_SIZE` along the length (so dash/texture spacing stays consistent regardless of how sharply the path bends). Reused for the road surface and both curbs so all three bend identically.
- **`buildRoadAndTerrain(parent, pathPoints)`** — called once after `bike.js` samples the path, with `bikeContainer` passed as `parent` (**not** the top-level scene — see below): builds the asphalt ribbon (`ROAD_WIDTH = 10`), a light-grey curb ribbon on each side (raised `CURB_HEIGHT` above the road), and a plain green terrain plane sized and centred on the path's bounding box (plus a padding margin) so the grass shoulder comfortably covers the arc. All of this is static, built once.
  - **Why `bikeContainer` and not `scene`:** the sampled points are local coordinates within `bikeContainer`, captured before it has accumulated any drift. `bikeContainer.position` gets shifted by `loopDisplace` every time the animation loops (a large shift here — see below), and parenting the road there means it inherits that same shift for free, automatically staying under the bike on every repetition of the arc. Adding it to `scene` directly was an earlier bug: it only ever covered the very first lap's stretch of world space, so the bike would drive clean off the end of the road on lap two.
- **Shadow catcher** — 5-unit-radius `CircleGeometry` with `ShadowMaterial` (opacity 0.35), built in `createGround` and added to the scene directly (unlike the road/terrain) since it needs to keep tracking the bike's live position every frame to catch its shadow correctly.

---

### `src/bike.js`
Owns the model and animation system. Exports: `bikeContainer`, `loadBike()`, `playAllAnimations()`, `playAnimation()`, `fadeBackgroundParts()`, `frameCameraOnBike()`, `resumeBikeCameraFollow()`.

#### `bikeContainer` (THREE.Group)
The model is placed inside this group rather than directly in the scene. Every time the animation loops, the container's position is shifted forward by `loopDisplace` — the net world displacement of one full animation cycle — making the bike appear to travel forward indefinitely without any position reset visible in the animation.

#### `sampleBikePath()` — path sampling
On load, a temporary `AnimationMixer` (`sampleMixer`) plays the longest clip and samples `followTarget.getWorldPosition()` — the exact same object `frameCameraOnBike()` and the live camera-follow system already track — at 200 evenly-spaced times across its duration. This records the bike's real local XZ trajectory, curves included, and is the single source of truth handed to `buildRoadAndTerrain()` (`ground.js`) to build the road. `loopDisplace` is the first and last of these same 200 points, subtracted (previously a separate two-sample measurement; now free as a byproduct of the fuller sampling) — for the current clip this comes out to roughly 90 units, since the sampled path is an *open* arc, not a loop that closes on itself (see "How the Road Works"). Runs synchronously before the real mixer starts.

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
   - Ride mode: calls `updateCamera(delta, ...)`, moves `bgGroup` and `shadowCatcher` to track the bike XZ, calls `fadeBackgroundParts()` when the bike moves more than 2.5 units. The road, curbs, and terrain are static meshes built once at load time (see "How the Road Works" below) — they cover the bike's whole path already, so they don't need to be moved, scrolled, or regenerated each frame.
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

The bike's animation isn't a straight line — sampling its follow target across the clip shows it holds straight for ~6.6s, then sweeps through a curve that swings its heading by over 150° before straightening out on a new diagonal, ending about 90 units from where it started. At that point the clip hard-teleports back to its start (confirmed by sampling exactly at the clip's duration) rather than smoothly curving back — it's an *open* arc, not a loop that closes on itself. This is exactly what the pre-existing `loopDisplace`/`bikeContainer` mechanism is for: on every `'loop'` event, `bikeContainer.position` is shifted by that ~90-unit gap so the *bike* looks like it keeps driving forward seamlessly, even though the local animation just teleported.

A road that re-centers a straight strip under the bike's XZ position looks fine on the straight section but makes the bike look like it's drifting once its heading diverges from the strip's fixed orientation. A first attempt at fixing that built a curved mesh from the sampled path but added it directly to the scene, treating the path as a closed loop — both wrong: the fabricated "closing" segment cut straight across the 90-unit teleport gap, and because the road never moved, the bike would sail clean off the end of it on lap two (once `bikeContainer` had shifted by that same 90 units). The working version:

1. `sampleBikePath()` (`bike.js`) scrubs a temporary mixer across the whole clip (200 samples) and records the bike's real local XZ position at each one — this is the same `followTarget` the live camera-follow system already tracks, not a separate/new path. Local, because bikeContainer.position is (0,0,0) at sample time.
2. `buildRoadAndTerrain()` (`ground.js`) fits those samples to an **open** `THREE.CatmullRomCurve3` (no fake closing segment), re-samples it into evenly arc-length-spaced points with exact analytical tangents, and builds a ribbon `BufferGeometry` that offsets left/right along those tangents — a real curved mesh hugging the path, not a re-oriented straight primitive. Curbs are the same ribbon shape, offset further out and raised slightly.
3. Crucially, the road/curbs/terrain are added as children of **`bikeContainer`**, not the scene. Since the sampled points are already local to `bikeContainer`, and `bikeContainer.position` accumulates `loopDisplace` on every loop, parenting the road there means it inherits that exact same shift for free — it stays under the bike on every repetition of the arc, lap after lap, with no extra code needed in the loop handler.
4. Built once as static geometry — no per-frame scrolling, re-centering, or regeneration — unlike the camera, background, and shadow catcher, which stay top-level scene objects tracking the bike's live position every frame since they only need to frame whatever's immediately around it.
