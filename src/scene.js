import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function createScene() {
  const canvas = document.querySelector('#scene');

  const scene = new THREE.Scene();
  scene.fog   = new THREE.FogExp2(0xcfe3ee, 0.035);

  // Sky gradient backdrop
  const bgCanvas      = document.createElement('canvas');
  bgCanvas.width      = 2; bgCanvas.height = 512;
  const bgCtx         = bgCanvas.getContext('2d');
  const bgGrad        = bgCtx.createLinearGradient(0, 0, 0, 512);
  bgGrad.addColorStop(0.00, '#3f8fd6');
  bgGrad.addColorStop(0.35, '#79b8e6');
  bgGrad.addColorStop(0.65, '#bfe0ef');
  bgGrad.addColorStop(0.85, '#e4f0e6');
  bgGrad.addColorStop(1.00, '#eef2e2');
  bgCtx.fillStyle     = bgGrad;
  bgCtx.fillRect(0, 0, 2, 512);
  scene.background    = new THREE.CanvasTexture(bgCanvas);

  const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.05, 90);

  const dpr      = Math.min(window.devicePixelRatio, 2);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: dpr < 2 });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace    = THREE.SRGBColorSpace;
  renderer.toneMapping         = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.shadowMap.enabled   = true;
  renderer.shadowMap.type      = THREE.PCFShadowMap;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan     = false;
  controls.minDistance   = 1.8;
  controls.maxDistance   = 16;
  controls.target.set(0, 0.8, 0);
  controls.update();

  // Lighting
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c9b0, 2.6));

  const keyLight = new THREE.DirectionalLight(0xfff6e0, 3.6);
  keyLight.position.set(4, 5, 3);
  keyLight.castShadow              = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.bias             = -0.0001;
  keyLight.shadow.camera.near      = 0.5;
  keyLight.shadow.camera.far       = 20;
  keyLight.shadow.camera.left      = -4;
  keyLight.shadow.camera.right     = 4;
  keyLight.shadow.camera.top       = 4;
  keyLight.shadow.camera.bottom    = -4;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x87d8ff, 1.5);
  rimLight.position.set(-4, 2.5, -3);
  scene.add(rimLight);

  const backFill = new THREE.DirectionalLight(0xffe8cc, 1.0);
  backFill.position.set(0, 3, -5);
  scene.add(backFill);

  const clock = new THREE.Clock();

  return { scene, camera, renderer, controls, clock };
}
