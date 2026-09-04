# Harley-Davidson 3D Showcase

An interactive 3D web experience built with Three.js. A Harley-Davidson motorcycle model is displayed in a cinematic night-time scene. Pressing **RIDE** starts the animation, chill ambient music, and an orbiting camera that follows the bike as it rides forward indefinitely across a scrolling asphalt ground.

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
| Scrolling ground | Asphalt texture UV scrolls so it looks like the bike is actually driving |
| Chill music | Synthesised Am7–Fmaj7–Cmaj7–G ambient pad progression (or drop your own MP3) |
| Part fading | Model parts far from the camera fade out to reduce clutter |
| Night atmosphere | Stars, moon, city horizon glow, mountains, floating dust, fog |

---

## Controls

| Action | How |
|---|---|
| **RIDE** | Click the amber button — starts animation, intro sequence, and music |
| **STOP** | Click the amber button — freezes the bike and fades out music |
| Rotate camera | Click and drag (OrbitControls active during showcase) |
| Zoom | Scroll wheel |

---

## Tech Stack

- **[Vite](https://vitejs.dev/)** — dev server and bundler
- **[Three.js](https://threejs.org/)** — 3D rendering, scene graph, animation mixer
- **[GLTFLoader](https://threejs.org/docs/#examples/en/loaders/GLTFLoader)** — loads the `.glb` model
- **[OrbitControls](https://threejs.org/docs/#examples/en/controls/OrbitControls)** — mouse camera interaction
- **Web Audio API** — synthesised ambient music, no external library

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
├── environment.js   Night sky: stars, moon, mountains, dust, atmosphere beams
├── ground.js        Asphalt plane and shadow catcher
├── bike.js          GLB loader, animation mixer, infinite forward movement
├── camera.js        Intro sequence logic + continuous orbit update
├── audio.js         Chill ambient music (synthesis + optional MP3 file)
└── ui.js            RIDE / STOP buttons

public/
├── models/
│   └── neznamvise5.glb   Harley-Davidson 3D model
└── sounds/
    └── music.mp3             (optional) — drop your own track here
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
- **Atmosphere beams** — two `ConeGeometry` meshes with additive blending, very low opacity (0.038), producing subtle light shafts.
- **`bgGroup`** — a `THREE.Group` that follows the bike's XZ position every frame so the background never runs out. Contains:
  - Two dark mountain cylinders (open-top `CylinderGeometry`, `BackSide` material, render order −3)
  - 2 200 stars (`Points` with per-vertex colour — blue-white, warm-white, red-white tinted)
  - 70 bright stars (larger point size)
  - A moon sphere with a radial-gradient canvas glow sprite using additive blending
  - City horizon glow — a cylinder with a vertical gradient canvas texture, additive blending, render order −2

---

### `src/ground.js`
`createGround(scene)` returns `{ asphaltTex, asphaltPlane, shadowCatcher }`.

- **`makeAsphaltTexture(512)`** — procedurally generates a 512×512 canvas:
  1. Dark grey base fill (`#1c1c1e`)
  2. Pixel-level noise (±12 brightness per channel)
  3. 420 random ellipses for aggregate stones
  4. 7 random crack lines with low-opacity stroke
  5. A faint central lane strip
  - Returns a `THREE.CanvasTexture` with `RepeatWrapping`.
- **Asphalt plane** — 500×500 `PlaneGeometry`, `MeshStandardMaterial` with the procedural texture repeated 100×100 times, receives shadows.
- **Shadow catcher** — 5-unit-radius `CircleGeometry` with `ShadowMaterial` (opacity 0.35), positioned just above the asphalt.
- Both follow the bike XZ position in the render loop so the ground never ends.

---

### `src/bike.js`
Owns the model and animation system. Exports: `bikeContainer`, `loadBike()`, `playAllAnimations()`, `playAnimation()`, `fadeBackgroundParts()`, `frameCameraOnBike()`, `resumeBikeCameraFollow()`.

#### `bikeContainer` (THREE.Group)
The model is placed inside this group rather than directly in the scene. Every time the animation loops, the container's position is shifted forward by `loopDisplace` — the net world displacement of one full animation cycle — making the bike appear to travel forward indefinitely without any position reset visible in the animation.

#### Loop displacement sampling
On load, a temporary `AnimationMixer` (`sampleMixer`) plays the longest clip, samples `followTarget.getWorldPosition()` at time 0 and at clip end, subtracts them to get `loopDisplace`. This runs synchronously before the real mixer starts.

#### `mixer.addEventListener('loop', ...)`
Fires every time the animation mixer completes one cycle. Shifts `bikeContainer.position` by `loopDisplace`, then snaps `smoothedOrbitCenter` and `smoothedLookTarget` to the new position so the camera shows zero visible jump. Also resets `prevFollowPosition` so the asphalt texture scroll doesn't spike on the jump frame.

#### `fadeBackgroundParts()`
Throttled to fire only when the bike moves more than 2.5 units from `_lastFadePos`. Iterates `fadedMeshes` (all mesh nodes collected during `prepareModel`). Uses `setMaterialOpacity()` which has an early-out guard (`abs(current - target) < 0.005`) to avoid triggering Three.js render-list re-sorts — this was the fix for the periodic "ping" stutter.

#### `frameCameraOnBike()`
Hard-snaps camera, controls target, bgGroup, dust, and shadowCatcher to the bike's current world position. Called once after load and once after `buildRoadMarkings()` resets the mixer time.

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

### `src/audio.js`
Exports `startMusic()` and `stopMusic()`.

#### File playback
On `startMusic()`, first tries `fetch('/sounds/music.mp3')`. If the file exists and decodes successfully, it plays as a looping `AudioBufferSourceNode` through the master gain. Put any music file (MP3/OGG/WAV) at `public/sounds/music.mp3` to use it.

#### Synthesised chill music (fallback)
When no file is found, generates an Am7 – Fmaj7 – Cmaj7 – G ambient pad progression:

- **Tempo**: 75 BPM, 8 beats per chord = 6.4 s per chord, 25.6 s full loop
- **Pad voices**: 3 detuned sawtooth oscillators per chord tone (−4, 0, +4 cents), through a lowpass filter at 900 Hz. Slow attack (1.2 s) and release (1.0 s) give a floating, spacious feel.
- **Bass**: sine oscillator on the root note, one octave below the chord, with a quick attack and long decay.
- **Melody**: a single soft sine oscillator plays an arpeggiated pattern (one note per beat, octave above the chord tones).
- **Reverb**: four parallel feedback delay lines (0.17 s, 0.24 s, 0.33 s, 0.43 s) each with a lowpass-filtered feedback path, producing a dense hall reverb tail.
- 30 loops (~12.8 minutes) are pre-scheduled at load so playback is perfectly gapless with no JavaScript callbacks needed during the ride.

#### Fade in / out
`startMusic()` ramps master gain 0 → 0.70 over 2.5 s. `stopMusic()` ramps 0.70 → 0 over 2.0 s, then closes the `AudioContext` after 2.2 s.

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
   - Ride mode: calls `updateCamera(delta, ...)`, moves `bgGroup`, `shadowCatcher`, and `asphaltPlane` to track the bike XZ, scrolls the asphalt texture UV by the bike's per-frame displacement, calls `fadeBackgroundParts()` when the bike moves more than 2.5 units.
4. Handles `window.resize`.

#### Asphalt texture scrolling
Each frame: `asphaltTex.offset.x += (followPosition.x - prevFollowPosition.x) * 0.2` and `asphaltTex.offset.y -= (followPosition.z - prevFollowPosition.z) * 0.2`. The scale factor 0.2 equals `repeat / planeSize = 100 / 500`, ensuring the scroll speed exactly matches real world-space movement. Because the texture tiles, offset wraps seamlessly — the loop jump frame is also seamless as the displacement is snapped in the loop handler.

---

## Customising

### Add your own music
Place any audio file at:
```
public/sounds/music.mp3
```
Supported formats: MP3, OGG, WAV. The synthesised fallback is skipped automatically.

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

## How the Infinite Road Works

1. On load, a `sampleMixer` scrubs the animation from time 0 to clip end and records `loopDisplace` = end position − start position.
2. The real `AnimationMixer` fires a `loop` event each cycle.
3. The loop handler adds `loopDisplace` to `bikeContainer.position`.
4. From the camera's point of view the bike never stops — it just keeps going forward.
5. The asphalt texture UV scrolls each frame by the actual world-space movement, so the ground looks like it's passing under the bike.
6. The `bgGroup`, `shadowCatcher`, and `asphaltPlane` follow the bike XZ position each frame, so the environment never runs out.
