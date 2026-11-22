import * as T from 'three';
import { buildRoom } from './room.js';
import { buildEnvironment } from './environment.js';
import { buildPrecipitation } from './precipitation.js';
import { createSoftwareRenderer } from './software-scene.js';
import { attachLookControls } from './look.js';
import { buildSensorDisplay } from './sensor-display.js';
import { createWeatherSimulation } from './simulation.js';

const dayFog = new T.Color('#adc4cb');
const nightFog = new T.Color('#172537');
const weatherFog = new T.Color('#737f87');
const daylight = new T.Color('#fff0d5');
const sunset = new T.Color('#ffc183');
const stormlight = new T.Color('#bad4ea');
const skyFill = new T.Color('#e1eefc');
const darkFill = new T.Color('#738eb5');

export function mountScene(host, state, reportTelemetry) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
  const renderer = context ? new T.WebGLRenderer({ canvas, context, antialias: true, alpha: false }) : null;
  const software = renderer ? null : createSoftwareRenderer(host);
  if (renderer) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    host.append(renderer.domElement);
  }

  const scene = new T.Scene();
  scene.fog = new T.FogExp2(dayFog.clone(), .009);
  const camera = new T.PerspectiveCamera(45, 1, .08, 290);
  const rest = new T.Quaternion();
  const orientation = new T.Euler(0, 0, 0, 'YXZ');
  const rotation = new T.Quaternion();
  const look = attachLookControls(host);
  const simulate = createWeatherSimulation();
  const roomRoot = new T.Group(), environmentRoot = new T.Group();
  scene.add(roomRoot, environmentRoot);
  const room = buildRoom(roomRoot);
  const sensorDisplay = buildSensorDisplay(roomRoot);
  const { sky, water, anemometer } = buildEnvironment(environmentRoot);
  function resize() {
    const width = host.clientWidth, height = host.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    const portrait = Math.max(0, Math.min(1, (1.43 - camera.aspect) / .58));
    camera.position.set(2.3 - portrait * 1.04, 2.42 + portrait * .11, 7.7 + portrait * 1.35);
    const standardFov = 45 + 13 * portrait;
    const horizontalTangent = .43 + .265 * T.MathUtils.smoothstep(camera.aspect, .58, 1.42);
    const narrowFov = T.MathUtils.radToDeg(2 * Math.atan(horizontalTangent / camera.aspect));
    camera.fov = Math.max(standardFov, Math.min(87, narrowFov));
    camera.lookAt(.07, 1.98, -.3);
    rest.copy(camera.quaternion);
    camera.updateProjectionMatrix();
    renderer?.setSize(width, height, false);
    software?.resize(width,height,camera,roomRoot,environmentRoot,room,sensorDisplay.screen,anemometer);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const precipitate = buildPrecipitation(scene,room.panes);
  const hemisphere = new T.HemisphereLight(skyFill, '#9b8067', 1.24);
  scene.add(hemisphere);
  const sun = new T.DirectionalLight('#fff0d5', 2.35);
  sun.target.position.set(0,1.1,.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.camera.left = -11;
  sun.shadow.camera.right = 11;
  sun.shadow.camera.top = 9;
  sun.shadow.camera.bottom = -8;
  sun.shadow.camera.near = .5;
  sun.shadow.camera.far = 48;
  sun.shadow.bias = -.00022;
  sun.shadow.normalBias = .024;
  sun.shadow.radius = 3;
  scene.add(sun,sun.target);

  const bounce = new T.PointLight('#e8d4b2', 17, 12, 2);
  bounce.position.set(1, 2.5, 3.0);
  scene.add(bounce);
  const outsideLight = new T.DirectionalLight('#c3d8ed', .32);
  outsideLight.position.set(-3,6,-12);
  scene.add(outsideLight);

  let prior = performance.now(), frameId = 0, uiClock = .12, shadowClock = 0;
  const solarDirection = new T.Vector3();

  function render(now) {
    frameId = requestAnimationFrame(render);
    const dt = Math.min(.16, (now - prior) / 1000);
    prior = now;
    const input = state.current;
    const step = input.running ? dt * input.speed : 0;
    const frame = simulate(step, input);
    const { cloud, rain, position, hour, drift, rippleTime, time, wind, storm, breeze } = frame;
    const view = look.update(dt);
    anemometer.rotation.y = frame.rotorAngle;
    if (renderer) {
      orientation.set(view.pitch, view.yaw, 0);
      camera.quaternion.copy(rest).multiply(rotation.setFromEuler(orientation));
    }
    for (const pane of room.panes) pane.pivot.rotation.y = pane.direction * position * .0106;
    const airflow = breeze * (.10 + .90 * position / 100);
    if (renderer && step > 0) {
      for (const curtain of room.curtains) curtain.sway(time, airflow);
    }

    uiClock += dt;
    if (uiClock >= .10) {
      sensorDisplay.update(frame);
      reportTelemetry(frame);
      uiClock = 0;
    }

    const solarArc = (hour - 6) / 12 * Math.PI;
    const elevation = Math.sin(solarArc);
    const day = T.MathUtils.smoothstep(elevation, -.13, .27);
    const golden = 1 - T.MathUtils.smoothstep(Math.abs(elevation), .08, .58);
    solarDirection.set(-.55 - Math.cos(solarArc) * .46, elevation * .30 - .085, -1.17).normalize();
    const rainShade = Math.min(1, rain * .88);
    const sunlight = frame.sun;
    const flash = precipitate(step, time, rain, storm > .48, wind, position);
    sky.uSun.value.copy(solarDirection);
    sky.uDay.value = day;
    sky.uTwilight.value = golden * day;
    sky.uRain.value = rainShade;
    sky.uCover.value = cloud;
    sky.uDrift.value = drift;
    sky.uFlash.value = flash;
    water.uTime.value = rippleTime;
    water.uDay.value = day;
    water.uRain.value = rainShade;
    water.uCloud.value = cloud;
    water.uSun.value.copy(solarDirection);
    scene.fog.color.copy(nightFog).lerp(dayFog,day).lerp(weatherFog,rainShade * day*.76);
    scene.fog.density = .008 + rainShade*.014;
    hemisphere.color.copy(darkFill).lerp(skyFill,day);
    hemisphere.intensity = .27 + day*(1.09-rainShade*.52) + flash*.86;
    sun.position.copy(solarDirection).multiplyScalar(23).add(sun.target.position);
    sun.position.y = Math.max(1.2,sun.position.y);
    sun.color.copy(daylight).lerp(sunset,golden*.9).lerp(stormlight, rainShade*.76);
    sun.intensity = Math.max(0,elevation)*sunlight*2.75*(1-rainShade*.87) + flash*1.34;
    outsideLight.intensity = .085 + day*.32 + flash*.53;
    bounce.intensity = 12 + day * sunlight*12 + flash*21;
    room.bulb.intensity = (1-day)*43 + rainShade*9 + 4;
    room.shade.emissiveIntensity = (1-day)*.45 + .085;
    shadowClock += dt;
    if (shadowClock>.05) {
      if (renderer) renderer.shadowMap.needsUpdate = true;
      shadowClock = 0;
    }
    if (renderer) renderer.render(scene,camera);
    else software.draw({ room, time, drift, rippleTime, cloud, day, solarDirection, rain, rainShade, sunlight, flash, golden, wind, position, view, sensorDisplay, airflow });
  }
  if (renderer) {
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
  }
  frameId = requestAnimationFrame(render);
  return () => {
    cancelAnimationFrame(frameId);
    observer.disconnect();
    look.remove();
    scene.traverse(object => {
      object.geometry?.dispose();
      if(object.material) {
        object.material.map?.dispose();
        object.material.dispose();
      }
    });
    renderer?.dispose();
    renderer?.domElement.remove();
    software?.remove();
  };
}
