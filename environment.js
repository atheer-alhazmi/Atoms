import * as T from 'three';
import { box, randomSource } from './room.js';

const color = value => new T.Color(value);

export function buildSky(scene) {
  const uniforms = {
    uSun: { value: new T.Vector3(-.2, .3, -1).normalize() },
    uCover: { value: .43 },
    uDrift: { value: 0 },
    uDay: { value: 1 },
    uTwilight: { value: 0 },
    uRain: { value: 0 },
    uFlash: { value: 0 },
  };
  const shader = new T.ShaderMaterial({
    uniforms, side: T.BackSide, depthWrite: false, fog: false,
    vertexShader: `
      varying vec3 vRay;
      void main() {
        vRay = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
      }`,
    fragmentShader: `
      varying vec3 vRay;
      uniform vec3 uSun;
      uniform float uCover, uDrift, uDay, uTwilight, uRain, uFlash;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
      }
      float fbm(vec2 p) {
        mat2 spin = mat2(.8,.6,-.6,.8);
        float value = 0.;
        float weight = .52;
        for(int i=0;i<5;i++){
          value += weight*noise(p);
          p = spin*p*2.06 + vec2(4.9,8.2);
          weight *= .49;
        }
        return value;
      }
      void main() {
        vec3 ray = normalize(vRay);
        float elevation = max(0.,ray.y);
        float falloff = pow(elevation,.48);
        vec3 daytime = mix(vec3(.74,.845,.87),vec3(.10,.37,.65), falloff);
        vec3 overcast = mix(vec3(.31,.385,.405),vec3(.088,.14,.19),falloff);
        vec3 base = mix(daytime,overcast,clamp(uRain*.78+max(uCover-.58,0.)*.94,0.,.95));
        float arc = max(dot(uSun,ray),0.);
        base += vec3(.30,.15,.03) * pow(arc,9.) * uTwilight;
        vec3 night = mix(vec3(.039,.072,.109),vec3(.006,.018,.047),falloff);
        base = mix(night,base,uDay);
        float visibleSun = smoothstep(-.03,.055,uSun.y)*uDay;
        float halo = pow(arc,28.)*.23 + pow(arc,210.)*.72;
        float disk = smoothstep(.9993,.99973,arc);
        base += vec3(1.,.72,.38)*(halo + disk*3.7)*visibleSun;
        vec3 moonDir = normalize(vec3(.33,.22,-.91));
        float moon = max(dot(moonDir,ray),0.);
        base += vec3(.60,.71,1.)*(pow(moon,170.)*.15+smoothstep(.99981,.99989,moon)*1.3)*(1.-uDay);
        vec2 starUv = vec2(atan(ray.x,-ray.z), ray.y)*470.;
        vec2 starCell = floor(starUv);
        float starId = hash(starCell);
        vec2 starCenter = vec2(hash(starCell+3.1),hash(starCell-4.8))*.50+.25;
        float spark = 1.-smoothstep(0.,.165,length(fract(starUv)-starCenter));
        base += vec3(.70,.79,1.)*spark*step(.988,starId)*(1.-uDay)*smoothstep(.04,.30,elevation);

        vec2 plane = ray.xz / (elevation + .31);
        vec2 offset = vec2(-uDrift, .10*uDrift);
        vec2 layer = plane*2.5+vec2(9.1,12.4)+offset*.58;
        float highCloud = fbm(layer*1.55+vec2(4.2,8.3));
        float highDensity = smoothstep(.51,.71,highCloud+(uCover-.43)*.36);
        float threshold = mix(.735,.345,uCover);
        vec2 nearLayer = plane*1.56 + vec2(12.3,7.1) + offset;
        float n = fbm(nearLayer);
        float nEdge = fbm(nearLayer + vec2(-.10,.12));
        float opacity = smoothstep(threshold-.036,threshold+.095,n);
        float ridges = clamp(.52+(n-nEdge)*4.4+(n-threshold)*1.55,0.,1.);
        vec3 skyCloud = mix(vec3(.43,.55,.64),vec3(1.07,1.07,1.04),ridges);
        vec3 rainCloud = mix(vec3(.073,.100,.127),vec3(.30,.35,.39),ridges);
        vec3 mist = mix(vec3(.63,.72,.80),vec3(.22,.29,.35),uRain);
        base = mix(base,mix(vec3(.035,.052,.077),mist,uDay),highDensity*.55);
        vec3 cloud = mix(skyCloud,rainCloud,clamp(uRain*.84+max(uCover-.67,0.)*.69,0.,1.));
        cloud += vec3(.19,.105,.036)*pow(arc,10.)*uTwilight;
        cloud = mix(vec3(.013,.025,.047)*(.8+ridges),cloud,uDay);
        base = mix(base,cloud,opacity*smoothstep(-.045,.10,ray.y));
        base += vec3(.38,.46,.64)*uFlash;
        gl_FragColor = vec4(base,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dome = new T.Mesh(new T.SphereGeometry(245, 36, 24), shader);
  dome.renderOrder = -3;
  scene.add(dome);
  return uniforms;
}

function terrainNoise(x, z, seed) {
  return Math.sin(x * .17 + z * .26 + seed) * .27 + Math.sin(x * .53 - z * .32 + seed) * .22 +
    Math.cos(x * .87 + z * .69) * .09 + Math.cos(x * 1.82 + z * 1.7) * .041;
}

function mountain(scene, depth, seed, scale, dark, light) {
  const geometry = new T.PlaneGeometry(265, 54, 146, 28);
  geometry.rotateX(-Math.PI / 2);
  const points = geometry.attributes.position;
  const colors = [];
  const a = color(dark), b = color(light);
  const temp = new T.Color();
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i), z = points.getZ(i);
    const ridge = Math.pow(.51 + .32 * Math.sin(x * .064 + seed) + .14 * Math.cos(x * .18 + seed * 1.3), 1.18);
    const shoulder = Math.pow(Math.max(0, 1 - Math.abs(z + Math.sin(x * .1 + seed) * 7) / 28), 1.6);
    const geom = terrainNoise(x, z, seed);
    const height = (ridge * shoulder * scale) + geom * shoulder * (scale * .13) - 2;
    points.setXYZ(i, x, height, z);
    const streak = .37 + .24 * Math.sin(x * .64 + height * .49) + geom*.52 + height / scale * .26;
    temp.copy(a).lerp(b, T.MathUtils.clamp(streak, 0, 1));
    colors.push(temp.r, temp.g, temp.b);
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({vertexColors:true, roughness:1}));
  mesh.position.z = depth;
  scene.add(mesh);
}

function lawnHeight(x, z) {
  return -.53 + terrainNoise(x, z, 3)*.48 - Math.max(0,(-z - 11))*.075;
}

function lawn(scene) {
  const geometry = new T.PlaneGeometry(105, 37, 110, 56);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = [];
  const deep = color('#4a6036'), bright = color('#83955a'), dirt = color('#827454');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i) - 16;
    positions.setXYZ(i, x, lawnHeight(x, z), z);
    const n = terrainNoise(x,z,3);
    const tint = deep.clone().lerp(bright, .38 + n * .56);
    if(z < -21) tint.lerp(dirt, Math.min(.72, (-z-21)*.3 + n*.7));
    colors.push(tint.r,tint.g,tint.b);
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({vertexColors:true,roughness:1}));
  mesh.receiveShadow = true;
  scene.add(mesh);
  const paving = new T.MeshStandardMaterial({color:'#a49b83', roughness:.86});
  const rand = randomSource(832);
  for (let i = 0; i < 12; i++) {
    const z = -.65 - i*.98;
    const x = 1.4 + Math.sin(i*.25)*1.55;
    box(scene, paving, x, lawnHeight(x,z)+.12, z, 1.12+rand()*.26, .10, .55+rand()*.23, .054).rotation.y = (rand()-.5)*.33;
  }
}

function buildWater(scene) {
  const uniforms = {
    uTime: { value: 0 }, uDay: { value: 1 }, uRain: { value: 0 }, uCloud: { value: .43 },
    uSun: { value: new T.Vector3() },
  };
  const plane = new T.Mesh(new T.PlaneGeometry(238, 145), new T.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 vWorld;
      void main(){
        vec4 world = modelMatrix * vec4(position,1.);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      varying vec3 vWorld;
      uniform float uTime,uDay,uRain,uCloud;
      uniform vec3 uSun;
      void main(){
        vec2 p = vWorld.xz;
        float ripples = sin(p.y*5.+sin(p.x*2.4+uTime*.75)+uTime*1.4)*.5 +
                        sin(p.x*7.+p.y*4.1-uTime*2.1)*.17 +
                        sin(p.y*16.+p.x*1.6-uTime*3.1)*.11;
        float reflected = smoothstep(.05,.78,ripples);
        vec3 view = normalize(cameraPosition-vWorld);
        float distanceFade = smoothstep(.02,.20,view.y);
        vec3 lake = mix(vec3(.38,.53,.53),vec3(.066,.234,.23),distanceFade);
        lake += reflected * vec3(.075,.096,.095);
        float glitter = pow(max(dot(reflect(-uSun,vec3(0.,1.,0.)),view),0.),11.);
        lake += vec3(.69,.48,.22)*glitter*reflected*(1.-uCloud)*1.35;
        lake = mix(lake,vec3(.13,.21,.245)+.032*reflected,uRain*.8);
        lake = mix(vec3(.012,.029,.044)+.016*reflected,lake,uDay);
        gl_FragColor = vec4(lake,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  plane.rotation.x = -Math.PI/2;
  plane.position.set(0,-1.64,-72);
  scene.add(plane);
  return uniforms;
}

function conifers(scene) {
  const rand = randomSource(55);
  const count = 270;
  const foliage = new T.MeshStandardMaterial({roughness:1, flatShading:true});
  const bark = new T.MeshStandardMaterial({color:'#65573f',roughness:1});
  const cone = new T.ConeGeometry(1,1,9,4);
  const vertex = cone.attributes.position;
  for (let i=0;i<vertex.count;i++){
    const x = vertex.getX(i), y = vertex.getY(i), z = vertex.getZ(i);
    const rough = Math.sin(x*25+z*18+y*33)*.14;
    vertex.setXYZ(i,x*(1+rough),y+rough*.17,z*(1+rough));
  }
  cone.computeVertexNormals();
  const leaves = new T.InstancedMesh(cone, foliage, count*5);
  const trunks = new T.InstancedMesh(new T.CylinderGeometry(.46,1,1,7), bark, count);
  const dummy = new T.Object3D();
  const green = color('#243b2d'), moss = color('#607958');
  for (let i=0;i<count;i++){
    let x, z, base, height;
    if(i<30) {
      x = (i%2===0 ? 1 : -1)*(4.5+rand()*13);
      z = -3.8-rand()*17;
      base = lawnHeight(x,z);
      height = 2.8+rand()*6.5;
    } else {
      x = (rand()-.5)*155;
      z = -54-rand()*26 + Math.cos(x*.1)*6;
      base = -1.66;
      height = 2.5+rand()*6.1;
    }
    dummy.position.set(x,base+height*.39,z);
    dummy.scale.set(height*.025,height*.78,height*.025);
    dummy.rotation.set(0,rand()*6.28,0);
    dummy.updateMatrix();
    trunks.setMatrixAt(i,dummy.matrix);
    const tint = green.clone().lerp(moss,rand()*.87);
    for(let j=0;j<5;j++){
      const fraction = j/5;
      const spread = height*(.24-fraction*.17)*(1+rand()*.18);
      dummy.position.set(x,base+height*(.32+fraction*.66),z);
      dummy.rotation.set((rand()-.5)*.10,rand()*6.28,(rand()-.5)*.11);
      dummy.scale.set(spread,height*(.43-fraction*.17),spread);
      dummy.updateMatrix();
      leaves.setMatrixAt(i*5+j,dummy.matrix);
      const shade = tint.clone().multiplyScalar(.8+fraction*.39+rand()*.11);
      leaves.setColorAt(i*5+j,shade);
    }
  }
  scene.add(leaves,trunks);
  leaves.receiveShadow = true;
}

function garden(scene) {
  const rand = randomSource(41);
  const bushGeometry = new T.IcosahedronGeometry(1, 2);
  const bushMaterial = new T.MeshStandardMaterial({roughness:.97,flatShading:true});
  const shrubs = new T.InstancedMesh(bushGeometry,bushMaterial,250);
  const dummy = new T.Object3D();
  const dark = color('#435b35'), light = color('#819450');
  for(let i=0;i<250;i++){
    const cluster = Math.floor(i/10);
    const x = Math.sin(cluster*2.21)*7.2 + (rand()-.5)*1.12;
    const z = -2.7 - cluster*.64 + (rand()-.5)*1.0;
    const scale = .16+rand()*.33;
    dummy.position.set(x,lawnHeight(x,z)+scale*.58,z);
    dummy.scale.set(scale*(.64+rand()*.8),scale*.84,scale);
    dummy.rotation.y = rand()*6.28;
    dummy.updateMatrix();
    shrubs.setMatrixAt(i,dummy.matrix);
    shrubs.setColorAt(i,dark.clone().lerp(light,rand()*.86));
  }
  shrubs.castShadow = true;
  shrubs.receiveShadow = true;
  scene.add(shrubs);

  const blade = new T.BufferGeometry();
  blade.setAttribute('position',new T.Float32BufferAttribute([-.038,0,0,.043,0,0,.06,.4,.045, -.028,0,.05,.035,0,-.05,.10,.32,.034],3));
  blade.computeVertexNormals();
  const grass = new T.InstancedMesh(blade,new T.MeshStandardMaterial({side:T.DoubleSide,roughness:1}),2400);
  for(let i=0;i<grass.count;i++){
    const x = (rand()-.5)*29;
    const z = -1.15-rand()*20;
    const scale = .45+rand()*.94;
    dummy.position.set(x,lawnHeight(x,z),z);
    dummy.scale.setScalar(scale);
    dummy.rotation.y = rand()*6.28;
    dummy.updateMatrix();
    grass.setMatrixAt(i,dummy.matrix);
    grass.setColorAt(i,dark.clone().lerp(light,rand()));
  }
  grass.receiveShadow = true;
  scene.add(grass);
}

function buildAnemometer(scene) {
  const x = 1.18, z = -3.15;
  const mount = new T.Group();
  mount.position.set(x, lawnHeight(x, z), z);
  scene.add(mount);

  const metal = new T.MeshStandardMaterial({ color: '#52645e', metalness: .44, roughness: .48 });
  const casing = new T.MeshStandardMaterial({ color: '#d0cfb9', roughness: .69, side: T.DoubleSide });
  const cap = new T.MeshStandardMaterial({ color: '#986543', roughness: .67 });
  const pole = new T.Mesh(new T.CylinderGeometry(.025, .032, 2.10, 12), metal);
  pole.position.y = 1.05;
  pole.castShadow = true;
  mount.add(pole);
  box(mount, metal, 0, .045, 0, .18, .09, .18, .014);
  box(mount, casing, .045, 1.31, 0, .142, .22, .118, .022);
  box(mount, cap, .045, 1.31, .061, .033, .096, .013, .005);
  const rotor = new T.Group();
  rotor.position.y = 2.10;
  mount.add(rotor);
  const hub = new T.Mesh(new T.CylinderGeometry(.086, .081, .134, 16), cap);
  rotor.add(hub);
  const cupShape = new T.SphereGeometry(.122, 16, 9, 0, 2 * Math.PI, 0, Math.PI / 2);
  for (let index = 0; index < 3; index++) {
    const arm = new T.Group();
    arm.rotation.y = index * 2 * Math.PI / 3;
    rotor.add(arm);
    box(arm, metal, .177, 0, 0, .355, .028, .034, .012);
    const cup = new T.Mesh(cupShape, casing);
    cup.position.set(.351, 0, 0);
    cup.rotation.x = Math.PI / 2;
    cup.castShadow = true;
    arm.add(cup);
  }
  return rotor;
}

export function buildEnvironment(scene) {
  const sky = buildSky(scene);
  const water = buildWater(scene);
  mountain(scene,-122,2.3,27,'#5b7580','#9da8a6');
  mountain(scene,-91,1.5,19,'#465f67','#788e8c');
  mountain(scene,-70,5.7,11.3,'#3c594f','#658071');
  lawn(scene);
  conifers(scene);
  garden(scene);
  return { sky, water, anemometer: buildAnemometer(scene) };
}
