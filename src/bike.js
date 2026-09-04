import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  MODEL_PATH, ANIMATION_START_TIME, CAMERA_TARGET_HEIGHT,
  VISIBLE_PART_DISTANCE, FADE_PART_DISTANCE,
  state,
  followPosition, prevFollowPosition, smoothedOrbitCenter, smoothedLookTarget,
  loopDisplace, loopStartPos, lastFadePos, meshWP,
} from './state.js';

const loader = new GLTFLoader();

export const bikeContainer = new THREE.Group();

// Headlight glow — warm point light at lamp position
const headlight = new THREE.PointLight(0xfff2cc, 6, 8, 2);
headlight.position.set(0, 0.9, 0.5);
bikeContainer.add(headlight);

// Road beam — narrow spot illuminating the asphalt ahead
const headBeam = new THREE.SpotLight(0xfff8e8, 10, 16, Math.PI / 9, 0.45, 1.8);
headBeam.position.set(0, 0.9, 0.5);
headBeam.target.position.set(0, -0.5, 6);
headBeam.castShadow = false;
bikeContainer.add(headBeam);
bikeContainer.add(headBeam.target);

const _camLightRe = /^(camera|cam|light|lamp|sun|spot|area|point|bulb|omni|direct)/i;

function removeEmbeddedCamerasAndLights(root) {
  const unwanted = [];
  root.traverse((o) => {
    if (o.isCamera || o.isLight) { unwanted.push(o); return; }
    // Blender GLB exports often include mesh stand-ins for cameras/lights
    if (_camLightRe.test(o.name.trim())) unwanted.push(o);
  });
  unwanted.forEach((o) => o.parent?.remove(o));
}

// Glossy body-panel paint (tank, fenders) — re-tinted from the model's
// stock near-black glossy finish.
const PAINT_MATERIAL_NAME = 'Sjajna';
const PAINT_COLOR = 0x2f8f46; // green

function prepareModel(root) {
  removeEmbeddedCamerasAndLights(root);
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow    = true;
    o.receiveShadow = true;
    o.frustumCulled = false;
    if (o.material) {
      o.material = Array.isArray(o.material)
        ? o.material.map((m) => m.clone())
        : o.material.clone();
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      materials.forEach((m) => {
        if (m.name === PAINT_MATERIAL_NAME) m.color.setHex(PAINT_COLOR);
      });
    }
    state.fadedMeshes.push(o);
  });
}

function getFollowTarget(root) {
  return root.getObjectByName('BIKE_TARGET') || root.getObjectByName('Sketchfab_model') || root;
}

export function frameCameraOnBike({ camera, controls, bgGroup, dust, shadowCatcher }) {
  if (!state.followTarget) return;
  state.followTarget.getWorldPosition(followPosition);
  prevFollowPosition.copy(followPosition);
  smoothedOrbitCenter.copy(followPosition);
  smoothedLookTarget.set(followPosition.x, followPosition.y + CAMERA_TARGET_HEIGHT, followPosition.z);

  bgGroup.position.set(followPosition.x, 0, followPosition.z);
  dust.position.set(followPosition.x, 0, followPosition.z);
  shadowCatcher.position.set(followPosition.x, -0.02, followPosition.z);

  camera.position.set(
    followPosition.x + Math.sin(state.liveAngle) * state.liveDistance,
    followPosition.y + state.liveHeight,
    followPosition.z + Math.cos(state.liveAngle) * state.liveDistance,
  );
  camera.fov  = state.liveFov;
  camera.near = 0.05;
  camera.far  = 90;
  camera.updateProjectionMatrix();

  controls.target.copy(smoothedLookTarget);
  controls.update();
}

// Early-out guard prevents Three.js render-list re-sorts (removes periodic stutter).
function setMaterialOpacity(mat, o) {
  if (Math.abs(mat.opacity - o) < 0.005) return;
  mat.transparent = o < 0.98;
  mat.opacity     = o;
  mat.depthWrite  = o > 0.25;
}

export function fadeBackgroundParts() {
  if (!state.followTarget) return;
  state.fadedMeshes.forEach((mesh) => {
    const dist = mesh.getWorldPosition(meshWP).distanceTo(followPosition);
    let opacity = 1;
    if (dist > VISIBLE_PART_DISTANCE) {
      const t = THREE.MathUtils.clamp(
        (dist - VISIBLE_PART_DISTANCE) / (FADE_PART_DISTANCE - VISIBLE_PART_DISTANCE), 0, 1,
      );
      opacity = THREE.MathUtils.lerp(1, 0.015, t);
    }
    if (Array.isArray(mesh.material)) mesh.material.forEach((m) => setMaterialOpacity(m, opacity));
    else setMaterialOpacity(mesh.material, opacity);
  });
}

export function playAllAnimations() {
  if (!state.mixer || state.animationClips.length === 0) return;
  state.mixer.stopAllAction();
  state.activeActions = state.animationClips.map((clip) => {
    const action = state.mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.reset().play();
    return action;
  });
  state.mixer.setTime(ANIMATION_START_TIME);
  state.currentAction = state.activeActions[0];
  console.log(`Playing ${state.activeActions.length} clip(s).`);
}

export function playAnimation(nameOrIndex = 0) {
  if (!state.mixer || state.animationClips.length === 0) return;
  const clip = typeof nameOrIndex === 'number'
    ? state.animationClips[nameOrIndex]
    : THREE.AnimationClip.findByName(state.animationClips, nameOrIndex);
  if (!clip) return;
  state.mixer.stopAllAction();
  state.activeActions = [];
  const action = state.mixer.clipAction(clip);
  action.setLoop(THREE.LoopRepeat, Infinity).reset().play();
  state.currentAction = action;
}

export function resumeBikeCameraFollow() { state.cameraFollowEnabled = true; }

// Road markings / street lights — disabled, preserved for future use
function buildRoadMarkings() { return; } // eslint-disable-line no-unused-vars

export function loadBike({ scene, camera, controls, clock, bgGroup, dust, shadowCatcher, onProgress, onReady }) {
  scene.add(bikeContainer);

  const deps = { camera, controls, bgGroup, dust, shadowCatcher };

  loader.load(
    MODEL_PATH,
    (gltf) => {
      state.model = gltf.scene;
      prepareModel(state.model);
      bikeContainer.add(state.model);
      state.followTarget = getFollowTarget(state.model);
      frameCameraOnBike(deps);

      state.animationClips = gltf.animations;
      console.log('Clips:', state.animationClips.map((a) => `${a.name} (${a.duration.toFixed(2)}s)`));

      if (state.animationClips.length > 0) {
        state.mixer = new THREE.AnimationMixer(state.model);

        // Sample displacement of one full animation loop so the container can
        // accumulate it each cycle, making the bike move forward indefinitely.
        {
          const sampleMixer = new THREE.AnimationMixer(state.model);
          const clip = state.animationClips.reduce((a, b) => a.duration > b.duration ? a : b);
          sampleMixer.clipAction(clip).play();
          sampleMixer.setTime(0);
          state.followTarget.getWorldPosition(loopStartPos);
          sampleMixer.setTime(clip.duration);
          state.followTarget.getWorldPosition(loopDisplace);
          loopDisplace.sub(loopStartPos);
          sampleMixer.stopAllAction();
        }

        state.mixer.addEventListener('loop', () => {
          if (!state.followTarget) return;
          bikeContainer.position.add(loopDisplace);
          state.followTarget.getWorldPosition(followPosition);
          smoothedOrbitCenter.copy(followPosition);
          smoothedLookTarget.set(
            followPosition.x, followPosition.y + CAMERA_TARGET_HEIGHT, followPosition.z,
          );
          lastFadePos.copy(followPosition);
          prevFollowPosition.copy(followPosition); // prevent texture scroll spike on loop jump
        });

        playAllAnimations();
        // Reset after sampling so followPosition is correct on frame 1
        state.mixer.setTime(ANIMATION_START_TIME);
        frameCameraOnBike(deps);
        clock.getDelta(); // eat time accumulated during load
      } else {
        console.warn('GLB has no animations.');
      }
      onReady?.();
    },
    (e) => {
      if (e.total > 0) {
        const pct = Math.round((e.loaded / e.total) * 100);
        console.log(`Loading: ${pct}%`);
        onProgress?.(pct);
      }
    },
    (e) => { console.error('Load error:', e); },
  );
}
