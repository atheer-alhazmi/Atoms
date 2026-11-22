import * as T from 'three';
import { randomSource } from './room.js';

function wetGlass(pane) {
  const uniforms = { uTime: { value: 0 }, uWet: { value: 0 } };
  const mesh = new T.Mesh(new T.PlaneGeometry(pane.width, pane.height), new T.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, side: T.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv=uv;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime,uWet;
      float id(vec2 p) { return fract(sin(dot(p,vec2(14.61,72.56)))*43153.52); }
      float drops(vec2 uv) {
        vec2 grid = vec2(76.,11.);
        float column = floor(uv.x * grid.x);
        float r = id(vec2(column,3.));
        uv.y += uTime * (.15 + .19*r);
        vec2 cell = floor(uv*grid);
        vec2 f = fract(uv*grid);
        float seed = id(cell);
        float x = f.x - (.19 + .62*seed);
        float y = f.y - (.22+.38*id(cell+7.5));
        float head = 1. - smoothstep(.035,.16,length(vec2(x*.95,y*4.2)));
        float streak = (1.-smoothstep(.028,.107,abs(x))) *
          smoothstep(-.015,.03,y)*(1.-smoothstep(.10,.48,y));
        return max(head*.82,streak*.62) * smoothstep(.18,.62,seed);
      }
      void main() {
        vec2 cell = floor(vUv * vec2(110.,88.));
        float seed = id(cell);
        vec2 f = fract(vUv * vec2(110.,88.)) - vec2(.3+.4*seed,.4);
        float bead = (1.-smoothstep(.075,.24,length(f))) * step(.86,seed) * .35;
        float clear = drops(vUv);
        gl_FragColor = vec4(.72,.84,.88,clamp((clear + bead + .042) * uWet,0.,.7));
        #include <colorspace_fragment>
      }`,
  }));
  mesh.position.set(pane.center, 0, .009);
  mesh.renderOrder = 4;
  pane.pivot.add(mesh);
  return { mesh, uniforms };
}

function lightning(scene) {
  const rand = randomSource(8231);
  const group = new T.Group();
  const metal = new T.MeshBasicMaterial({color:'#eaf4ff',transparent:true,depthWrite:false,toneMapped:false});
  const glow = new T.MeshBasicMaterial({color:'#abbfff',transparent:true,depthWrite:false,toneMapped:false, blending:T.AdditiveBlending});
  const origin = new T.Vector3();
  const up = new T.Vector3(0,1,0);
  function segment(from,to,width,mat) {
    const mesh = new T.Mesh(new T.CylinderGeometry(width*.64,width,from.distanceTo(to),5),mat);
    mesh.position.copy(from).lerp(to,.5);
    mesh.quaternion.setFromUnitVectors(up,to.clone().sub(from).normalize());
    group.add(mesh);
  }
  for(let i=0;i<11;i++){
    const point = origin.clone().set((rand()-.5)*3,-i*1.05,(rand()-.5)*.4);
    if(i>0){
      segment(origin,point,.031,metal);
      segment(origin,point,.135,glow);
    }
    if(i===3 || i===6){
      let branch = point.clone();
      for(let j=0;j<4;j++){
        const end=branch.clone().add(new T.Vector3((i===3?-1:1)*(.36+rand()*.56),-rand()*.9-.21,0));
        segment(branch,end,.021-j*.004,metal);
        branch=end;
      }
    }
    origin.copy(point);
  }
  group.position.set(-9,15,-43);
  group.visible = false;
  scene.add(group);
  return { group, metal, glow };
}

export function buildPrecipitation(scene, panes) {
  const drops = 4600;
  const positions = new Float32Array(drops * 6);
  const data = new Float32Array(drops * 5);
  const rand = randomSource(902);
  for (let i=0;i<drops;i++) {
    data.set([(rand()-.5)*40,rand()*19,-.53-rand()*35,8+rand()*8,.22+rand()*.38],i*5);
  }
  const geometry = new T.BufferGeometry();
  const attribute = new T.BufferAttribute(positions,3);
  attribute.setUsage(T.DynamicDrawUsage);
  geometry.setAttribute('position',attribute);
  const material = new T.LineBasicMaterial({ color:'#c1d6e3', transparent:true, depthWrite:false, opacity:0 });
  const rain = new T.LineSegments(geometry,material);
  rain.frustumCulled = false;
  rain.renderOrder = 1;
  scene.add(rain);
  const glass = panes.map(wetGlass);
  const bolt = lightning(scene);
  let untilStrike = 1.9;
  let strikeAge = 0;
  let wetness = 0;

  return function animate(dt,time,amount,storm,wind,position) {
    const density = T.MathUtils.clamp(amount,0,1.36)/1.36;
    const count = Math.floor(drops * density);
    rain.visible = count > 3;
    if (rain.visible) {
      geometry.setDrawRange(0,count*2);
      const slant = .11 + .15*wind;
      for(let i=0;i<count;i++){
        const index = i*5;
        const offset = i*6;
        const height = ((data[index+1]-time*data[index+3])%19+19)%19-1;
        const x = data[index] + (15-height)*slant;
        const z = data[index+2];
        const length = data[index+4]*(.74+density*.84);
        positions[offset] = x;
        positions[offset+1] = height;
        positions[offset+2] = z;
        positions[offset+3] = x-length*slant;
        positions[offset+4] = height+length;
        positions[offset+5] = z;
      }
      attribute.needsUpdate = true;
      material.opacity = Math.min(.44,.19+density*.2) * Math.min(1,amount*7);
    }
    wetness = T.MathUtils.damp(wetness,Math.min(1,amount*1.25),amount>wetness?1.7:.78,dt);
    for(const pane of glass) {
      pane.mesh.visible = wetness>.007;
      pane.uniforms.uTime.value = time;
      pane.uniforms.uWet.value = wetness * (1-position*.0037);
    }
    strikeAge = Math.max(0,strikeAge-dt);
    if(storm && amount>.3) {
      untilStrike -= dt;
      if(untilStrike<=0) {
        untilStrike = 4.6 + rand()*6;
        strikeAge = .51;
        bolt.group.position.x = (rand()-.5)*34;
      }
    } else if (untilStrike>2.15) {
      untilStrike=2.15;
    }
    const age = .51 - strikeAge;
    const flash = strikeAge > 0 ? Math.max(0, Math.cos(age * 48)) * Math.exp(-age * 6.8) : 0;
    bolt.group.visible = flash>.045;
    bolt.metal.opacity = Math.min(1,flash*1.9);
    bolt.glow.opacity = flash*.32;
    return flash;
  };
}
