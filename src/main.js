import './style.css';
import { createScene }          from './scene.js';
import { createEnvironment }    from './environment.js';
import { createGround }         from './ground.js';
import { loadBike, fadeBackgroundParts } from './bike.js';
import { updateCamera }         from './camera.js';
import { createUI, createLoadingScreen } from './ui.js';
import { createComposer }       from './postprocessing.js';
import {
  state,
  CAMERA_TARGET_HEIGHT,
  followPosition, prevFollowPosition,
  smoothedOrbitCenter, smoothedLookTarget,
  lastFadePos,
} from './state.js';

// ── Boot ──────────────────────────────────────────────────────────────────
const { scene, camera, renderer, controls, clock } = createScene();
const { bgGroup, dust }                             = createEnvironment(scene);
const { asphaltTex, asphaltPlane, shadowCatcher }   = createGround(scene);
const composer                                      = createComposer(renderer, scene, camera);

// ── Loading screen ────────────────────────────────────────────────────────
const { setProgress, hide: hideLoading } = createLoadingScreen();

loadBike({
  scene, camera, controls, clock, bgGroup, dust, shadowCatcher,
  onProgress: setProgress,
  onReady:    hideLoading,
});

// ── UI ────────────────────────────────────────────────────────────────────
createUI({
  onRide: () => {
    if (!state.followTarget) return;
    state.rideStarted = true;
    state.followTarget.getWorldPosition(followPosition);
    smoothedOrbitCenter.copy(followPosition);
    smoothedLookTarget.set(followPosition.x, followPosition.y + CAMERA_TARGET_HEIGHT, followPosition.z);
    lastFadePos.copy(followPosition);
    state.introPhase = 0;
    state.introTimer = 0;
    clock.getDelta();
  },
  onStop: () => {
    state.rideStarted  = false;
    state.displayAngle = state.liveAngle;
  },
});

// ── FPS display ───────────────────────────────────────────────────────────
const _fpsDom = document.createElement('div');
Object.assign(_fpsDom.style, {
  position: 'fixed', top: '16px', left: '16px',
  color: '#ffaa33', fontFamily: 'monospace', fontSize: '12px',
  background: 'rgba(0,0,0,0.35)', padding: '3px 8px', borderRadius: '3px',
  zIndex: '100', opacity: '0.65', pointerEvents: 'none',
});
document.body.appendChild(_fpsDom);
let _fpsFrames = 0, _fpsAccum = 0;

// ── Render loop ───────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);

  // FPS counter — update every 0.5 s to avoid flicker
  _fpsFrames++;
  _fpsAccum += delta;
  if (_fpsAccum >= 0.5) {
    _fpsDom.textContent = `${Math.round(_fpsFrames / _fpsAccum)} FPS`;
    _fpsFrames = 0;
    _fpsAccum  = 0;
  }

  if (state.rideStarted && state.mixer) state.mixer.update(delta);

  if (state.followTarget && !state.rideStarted) {
    // Showcase: slow 360° orbit, bike frozen
    state.followTarget.getWorldPosition(followPosition);
    smoothedOrbitCenter.copy(followPosition);
    smoothedLookTarget.set(followPosition.x, followPosition.y + CAMERA_TARGET_HEIGHT, followPosition.z);
    bgGroup.position.set(followPosition.x, 0, followPosition.z);
    shadowCatcher.position.set(followPosition.x, -0.02, followPosition.z);
    state.displayAngle += delta * 0.38;

    // Guard: only call updateProjectionMatrix when FOV actually changed
    if (camera.fov !== 42) {
      camera.fov = 42;
      camera.updateProjectionMatrix();
    }

    camera.position.set(
      followPosition.x + Math.sin(state.displayAngle) * 6.2,
      followPosition.y + 1.1,
      followPosition.z + Math.cos(state.displayAngle) * 6.2,
    );
    camera.lookAt(smoothedLookTarget);
    controls.update();

  } else if (state.followTarget && state.cameraFollowEnabled) {
    state.followTarget.getWorldPosition(followPosition);
    updateCamera(delta, { camera, controls });

    shadowCatcher.position.set(followPosition.x, -0.02, followPosition.z);
    bgGroup.position.set(followPosition.x, 0, followPosition.z);
    asphaltPlane.position.set(followPosition.x, -0.06, followPosition.z);

    if (state.rideStarted) {
      asphaltTex.offset.x += (followPosition.x - prevFollowPosition.x) * 0.2;
      asphaltTex.offset.y -= (followPosition.z - prevFollowPosition.z) * 0.2;
    }
    prevFollowPosition.copy(followPosition);

    if (followPosition.distanceTo(lastFadePos) > 2.5) {
      fadeBackgroundParts();
      lastFadePos.copy(followPosition);
    }

  } else {
    controls.update();
  }

  dust.rotation.y += delta * 0.025;
  composer.render();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setSize(window.innerWidth, window.innerHeight);
});

animate();
