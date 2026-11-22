import * as T from 'three';

const light = new T.Vector3(.26,.78,-.55).normalize();
const neutral = new T.Color('white');
const textures = new WeakMap();

function texturePixels(texture) {
  if (!texture?.image) return null;
  if (!textures.has(texture)) {
    const { width, height } = texture.image;
    const pixels = texture.image.getContext('2d').getImageData(0,0,width,height).data;
    textures.set(texture,{ width,height,pixels });
  }
  return textures.get(texture);
}

function clipNear(points, near) {
  const output = [];
  for(let i=0;i<points.length;i++) {
    const a=points[i], b=points[(i+1)%points.length];
    const insideA=a[2]>=near, insideB=b[2]>=near;
    if(insideA) output.push(a);
    if(insideA!==insideB) {
      const f=(near-a[2])/(b[2]-a[2]);
      output.push(a.map((value,j)=>value+(b[j]-value)*f));
    }
  }
  return output;
}

export function createRasterTarget(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  return {
    canvas, context, image: context.createImageData(width, height),
    depths: new Float32Array(width * height),
  };
}

export function drawStaticMeshes(root, camera, viewportWidth, viewportHeight, skip = new Set(), fog = false, maskFloor = false, crop) {
  const { x: left = 0, y: top = 0, width = viewportWidth, height = viewportHeight } = crop ?? {};
  const { canvas, context, image, depths } = crop?.target ?? createRasterTarget(width, height);
  const buffer = image.data;
  if (crop?.target) {
    buffer.fill(0);
    depths.fill(0);
  }
  const floor = maskFloor ? new Uint8Array(width * height) : null;
  const focal = viewportHeight / (2 * Math.tan(T.MathUtils.degToRad(camera.fov * .5)));
  const viewport = vertex => [
    viewportWidth * .5 + vertex[0] * focal / vertex[2] - left,
    viewportHeight * .5 - vertex[1] * focal / vertex[2] - top,
    1 / vertex[2],
    ...vertex.slice(3).map(value => value / vertex[2]),
  ];

  function triangle(a,b,c,texture,surface,repeat,pattern) {
    const x0=Math.max(0,Math.ceil(Math.min(a[0],b[0],c[0])));
    const x1=Math.min(width-1,Math.floor(Math.max(a[0],b[0],c[0])));
    const y0=Math.max(0,Math.ceil(Math.min(a[1],b[1],c[1])));
    const y1=Math.min(height-1,Math.floor(Math.max(a[1],b[1],c[1])));
    const ax=a[0]-c[0], ay=a[1]-c[1], bx=b[0]-c[0], by=b[1]-c[1];
    const area=ax*by-ay*bx;
    if (Math.abs(area)<.0001) return;
    const mul=1/area;
    for(let y=y0;y<=y1;y++) {
      for(let x=x0;x<=x1;x++) {
        const dx=x-c[0], dy=y-c[1];
        const wa=(dx*by-dy*bx)*mul, wb=(ax*dy-ay*dx)*mul, wc=1-wa-wb;
        if(wa<-.00001||wb<-.00001||wc<-.00001) continue;
        const reciprocal=a[2]*wa+b[2]*wb+c[2]*wc;
        const i=y*width+x;
        if(reciprocal<=depths[i]) continue;
        const backgroundDepth = crop?.occlusion?.[(y + top) * viewportWidth + x + left] ?? 0;
        if (reciprocal <= backgroundDepth) continue;
        depths[i]=reciprocal;
        if(floor) floor[i]=Number(pattern);
        const depth=1/reciprocal;
        const sample=channel=>(a[channel]*wa+b[channel]*wb+c[channel]*wc)*depth;
        const shade=sample(5);
        let red=surface[0], green=surface[1], blue=surface[2];
        if(texture) {
          const u=sample(3)*repeat.x, v=sample(4)*repeat.y;
          const j=(Math.min(texture.height-1,Math.floor((1-(v-Math.floor(v)))*texture.height))*texture.width+Math.floor((u-Math.floor(u))*texture.width))*4;
          red*=texture.pixels[j]/255;green*=texture.pixels[j+1]/255;blue*=texture.pixels[j+2]/255;
        }
        let tint=shade;
        if(pattern) {
          const wx=sample(6), wz=sample(7);
          const seam=Math.sin(wx*4.6+wz*.7)*Math.sin(wz*8.5+wx)*.022;
          const nearby=(x,z,sx,sz)=>Math.exp(-((wx-x)**2/sx+(wz-z)**2/sz));
          tint+=seam-nearby(-3.15,3.85,1.8,2.9)*.25-nearby(3.6,1.98,.85,.72)*.20-nearby(-.55,3.57,1.1,.67)*.17;
        }
        const haze=fog?Math.min(.58,Math.max(0,(depth-13)/128)*.66):0;
        const k=i*4;
        buffer[k]=red*tint*(1-haze)+160*haze;
        buffer[k+1]=green*tint*(1-haze)+183*haze;
        buffer[k+2]=blue*tint*(1-haze)+190*haze;
        buffer[k+3]=255;
      }
    }
  }

  function renderObject(mesh,matrix,surface) {
    const geometry=mesh.geometry;
    const { position,normal,uv,color }=geometry.attributes;
    const indices=geometry.index;
    if(!position || !normal) return;
    const world=new T.Vector3(), point=new T.Vector3(), n=new T.Vector3();
    const normalMatrix=new T.Matrix3().getNormalMatrix(matrix);
    const transformed=Array.from({ length:position.count },(_,i)=>{
      world.fromBufferAttribute(position,i).applyMatrix4(matrix);
      point.copy(world).applyMatrix4(camera.matrixWorldInverse);
      n.fromBufferAttribute(normal,i).applyMatrix3(normalMatrix).normalize();
      const form=mesh.material.side===T.DoubleSide?Math.abs(n.dot(light))*.23:Math.max(0,n.dot(light))*.36;
      const shade=.73+form+n.y*.09;
      return [point.x,point.y,-point.z,uv?.getX(i)||0,uv?.getY(i)||0,shade,world.x,world.z];
    });
    const texture=texturePixels(mesh.material.map);
    const repeat=mesh.material.map?.repeat;
    const both=mesh.material.side===T.DoubleSide;
    for(let i=0;i<(indices?.count??position.count);i+=3){
      const ia=indices?.getX(i)??i, ib=indices?.getX(i+1)??i+1, ic=indices?.getX(i+2)??i+2;
      const points=[transformed[ia],transformed[ib],transformed[ic]];
      let pitch=surface;
      if(color){
        pitch=surface.map((value,channel)=>{
          const sum=color.array[ia*3+channel]+color.array[ib*3+channel]+color.array[ic*3+channel];
          return value*Math.pow(sum/3,.45);
        });
      }
      const visible=points.every(p=>p[2]>.12)?points:clipNear(points,.12);
      if(visible.length<3) continue;
      const projected=visible.map(viewport);
      const [a,b,c]=projected;
      if(!both && (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>=0) continue;
      for(let j=1;j<projected.length-1;j++) triangle(a,projected[j],projected[j+1],texture,pitch,repeat,mesh.name==='ground');
    }
  }

  root.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  root.traverse(object=>{
    if(!object.isMesh || !object.visible || !object.material.color || object.material.transparent) return;
    for(let parent=object;parent;parent=parent.parent) if(skip.has(parent)) return;
    const base=object.material.color;
    const surface=base.clone().convertLinearToSRGB().toArray().map(value=>value*255);
    if(object.isInstancedMesh){
      const instance=new T.Matrix4(), world=new T.Matrix4(), tint=new T.Color();
      for(let i=0;i<object.count;i++){
        object.getMatrixAt(i,instance);
        world.multiplyMatrices(object.matrixWorld,instance);
        tint.copy(neutral);
        if(object.instanceColor) object.getColorAt(i,tint);
        tint.convertLinearToSRGB();
        renderObject(object,world,[surface[0]*tint.r,surface[1]*tint.g,surface[2]*tint.b]);
      }
    } else renderObject(object,object.matrixWorld,surface);
  });
  context.putImageData(image,0,0);
  if(!floor) return canvas;
  const floorMask=document.createElement('canvas');
  floorMask.width=width;floorMask.height=height;
  const maskContext=floorMask.getContext('2d');
  const mask=maskContext.createImageData(width,height);
  for(let i=0;i<floor.length;i++) mask.data[i*4+3]=floor[i]*255;
  maskContext.putImageData(mask,0,0);
  return {canvas,floorMask,depths};
}
