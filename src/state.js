import * as THREE from 'three';

export const MODEL_PATH = '/models/neznamvise5.glb';

// ── Camera / intro constants ──────────────────────────────────────────────
export const ORBIT_TC            = 0.12;
export const LOOK_TC             = 0.05;
export const ORBIT_SPEED         = 0.19;   // rad/s — one 360° every ~33 s
export const ORBIT_DISTANCE      = 7.0;
export const ORBIT_HEIGHT        = 1.4;
export const ORBIT_FOV           = 42;
export const INTRO_ZOOM_IN_DUR   = 2.8;
export const INTRO_HOLD_DUR      = 0.5;
export const INTRO_ZOOM_OUT_DUR  = 2.2;
export const INTRO_FAR_DIST      = 12.0;
export const INTRO_CLOSE_DIST    = 3.5;
export const INTRO_ANGLE         = 0.42;
export const INTRO_HEIGHT        = 1.3;
export const INTRO_FOV           = 28;
export const CAMERA_TARGET_HEIGHT   = -0.3;
export const VISIBLE_PART_DISTANCE  = 5.5;
export const FADE_PART_DISTANCE     = 9;
export const ANIMATION_START_TIME   = 0;

// ── Mutable runtime state ─────────────────────────────────────────────────
export const state = {
  rideStarted:         false,
  displayAngle:        0,
  cameraFollowEnabled: true,
  elapsedTime:         0,
  introPhase:          0,
  introTimer:          0,
  liveAngle:           INTRO_ANGLE,
  liveDistance:        INTRO_FAR_DIST,
  liveHeight:          INTRO_HEIGHT,
  liveFov:             INTRO_FOV,
  mixer:               null,
  model:               null,
  followTarget:        null,
  currentAction:       null,
  activeActions:       [],
  animationClips:      [],
  fadedMeshes:         [],
};

// ── Reusable vectors — zero per-frame heap allocation ─────────────────────
export const followPosition       = new THREE.Vector3();
export const prevFollowPosition   = new THREE.Vector3();
export const smoothedOrbitCenter  = new THREE.Vector3();
export const smoothedLookTarget   = new THREE.Vector3();
export const desiredLook          = new THREE.Vector3();
export const meshWP               = new THREE.Vector3();
export const lastFadePos          = new THREE.Vector3(Infinity, 0, 0);
export const loopDisplace         = new THREE.Vector3();
export const loopStartPos         = new THREE.Vector3();

export function smoothstep(t) { return t * t * (3 - 2 * t); }
