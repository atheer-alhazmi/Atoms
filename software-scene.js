import * as T from 'three';
import { randomSource } from './room.js';
import { createRasterTarget, drawStaticMeshes } from './software-raster.js';

const clamp = (value,min=0,max=1) => Math.min(max,Math.max(min,value));
const lerp = (a,b,t) => a+(b-a)*t;
const soft = (a,b,value) => { const t=clamp((value-a)/(b-a)); return t*t*(3-2*t); };
const rgb = (a,b,t) => 'rgb('+a.map((value,i)=>Math.round(lerp(value,b[i],t))).join(',')+')';

function clouds() {
  const rand = randomSource(375);
  const grid = Float32Array.from({length:128*128},rand);
  function noise(x,y) {
    const i=Math.floor(x), j=Math.floor(y);
    const k=(j&127)*128, l=((j+1)&127)*128;
    const a=soft(0,1,x-i), b=soft(0,1,y-j);
    return lerp(lerp(grid[k+(i&127)],grid[k+((i+1)&127)],a),lerp(grid[l+(i&127)],grid[l+((i+1)&127)],a),b);
  }
  function fBm(x,y) {
    return noise(x,y)*.5+noise(x*2.07+5,y*2.07)*.257+noise(x*4.2,y*4.2-2)*.13+noise(x*8.5-4,y*8.5)*.071+noise(x*17.5,y*17.5)*.042;
  }
  const canvas=document.createElement('canvas');
  canvas.width=382; canvas.height=116;
  const context=canvas.getContext('2d');
  const image=context.createImageData(canvas.width,canvas.height);
  let previous=-10;
  return (time,aspect,drift,coverage,day,rain)=>{
    if (Math.abs(time-previous)<.078) return canvas;
    previous=time;
    const {width,height}=canvas;
    for(let row=0;row<height;row++){
      const v=row/height, perspective=.70+v*.75;
      for(let col=0;col<width;col++){
        const u=(col/width-.5)*aspect;
        const x=u*3.06*perspective+8.43-drift;
        const y=v*4.2+8.2+drift*.07;
        const value=fBm(x,y);
        const edge=fBm(x-.12,y-.15);
        const high=fBm(x*1.7+4.2+drift*.33,y*1.6-3);
        const threshold=lerp(.69,.35,coverage);
        const shape=soft(threshold-.04,threshold+.085,value);
        const wisps=soft(.54,.72,high)*(.25+.23*coverage);
        const edgeWeight=clamp(.57+(value-edge)*4.7+(value-threshold)*.7);
        const brightness=lerp(163,255,edgeWeight);
        const shade=lerp(53,105,edgeWeight);
        const daylight=lerp(brightness,shade,rain*.91);
        const taper=1-soft(.76,1,v);
        const i=(row*width+col)*4;
        image.data[i]=lerp(35,daylight,day);
        image.data[i+1]=lerp(49,daylight+rain*9-1,day);
        image.data[i+2]=lerp(73,daylight+rain*21-7,day);
        image.data[i+3]=255*clamp(Math.max(shape,wisps)*taper*.97);
      }
    }
    context.putImageData(image,0,0);
    return canvas;
  };
}

export function createSoftwareRenderer(host) {
  const canvas=document.createElement('canvas');
  const screen=canvas.getContext('2d',{alpha:false});
  if (!screen) throw new Error('Canvas 2D unavailable');
  const stage=document.createElement('canvas');
  const context=stage.getContext('2d',{alpha:false});
  host.append(canvas);
  const cloudCanvas=clouds();
  const rand=randomSource(74);
  const rainDrops=Array.from({length:620},()=>[rand(),rand(),rand(),rand(),rand()]);
  const stars=Array.from({length:100},()=>[rand(),rand(),rand()]);
  const tintCanvas=document.createElement('canvas');
  const tintContext=tintCanvas.getContext('2d');
  const beamCanvas=document.createElement('canvas');
  const beam=beamCanvas.getContext('2d');
  let width=1,height=1,camera,roomLayer,gardenLayer,focal=1,padX=0,padY=0,viewWidth=1,viewHeight=1;
  let curtainLayers = [], curtainTime = -Infinity, rotorLayer;
  const v=new T.Vector3();
  const point=(x,y,z)=>{
    v.set(x,y,z).project(camera);
    return [(v.x*.5+.5)*width,(.5-v.y*.5)*height];
  };

  function resize(w,h,newCamera,roomRoot,environment,room,sensorScreen,anemometer){
    const scale=Math.min(1,1024/w,640/h);
    viewWidth=Math.max(1,Math.floor(w*scale));
    viewHeight=Math.max(1,Math.floor(h*scale));
    const outputScale=Math.min(1,1600/w,1000/h);
    canvas.width=Math.max(1,Math.floor(w*outputScale));
    canvas.height=Math.max(1,Math.floor(h*outputScale));
    focal=viewHeight/(2*Math.tan(T.MathUtils.degToRad(newCamera.fov/2)));
    padX=Math.ceil(.29*focal)+2;
    padY=Math.ceil(.18*focal)+2;
    width=viewWidth+2*padX;
    height=viewHeight+2*padY;
    camera=newCamera.clone();
    camera.aspect=width/height;
    camera.fov=T.MathUtils.radToDeg(2*Math.atan(height/(2*focal)));
    camera.updateProjectionMatrix();
    stage.width=tintCanvas.width=beamCanvas.width=width;
    stage.height=tintCanvas.height=beamCanvas.height=height;
    const excluded = [sensorScreen, ...room.panes.map(pane => pane.pivot), ...room.curtains.map(curtain => curtain.mesh)];
    roomLayer = drawStaticMeshes(roomRoot, camera, width, height, new Set(excluded), false, true);
    curtainTime = -Infinity;
    curtainLayers = room.curtains.flatMap(curtain => {
      const layer = movingLayer(curtain.mesh, .48, roomLayer.depths);
      return layer ? [{ ...layer, curtain }] : [];
    });
    const garden = createRasterTarget(width, height);
    gardenLayer = drawStaticMeshes(environment, camera, width, height, new Set([anemometer]), true, false, { target: garden });
    rotorLayer = movingLayer(anemometer, .24, garden.depths);
  }

  function movingLayer(mesh, padding, occlusion) {
    const bounds = new T.Box3().setFromObject(mesh).expandByScalar(padding);
    const corners = [];
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) corners.push(point(x, y, z));
      }
    }
    const xs = corners.map(([x]) => x), ys = corners.map(([, y]) => y);
    const x = Math.max(0, Math.floor(Math.min(...xs)));
    const y = Math.max(0, Math.floor(Math.min(...ys)));
    const w = Math.min(width, Math.ceil(Math.max(...xs))) - x;
    const h = Math.min(height, Math.ceil(Math.max(...ys))) - y;
    if (w < 1 || h < 1) return null;
    return { mesh, x, y, width: w, height: h, target: createRasterTarget(w, h), occlusion };
  }

  function path(points,ctx=context){
    ctx.beginPath();
    for(let i=0;i<points.length;i++) {
      const [x,y]=points[i];
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.closePath();
  }

  function glassPane(pane,time,rain) {
    pane.pivot.updateMatrixWorld(true);
    const { width:w,height:h,center,pivot }=pane;
    function local(x,y,z=.003){
      const coord=new T.Vector3(x,y,z).applyMatrix4(pivot.matrixWorld);
      return point(coord.x,coord.y,coord.z);
    }
    const x0=center-w*.5,x1=center+w*.5,y0=-h*.5,y1=h*.5;
    const points=[local(x0,y0),local(x1,y0),local(x1,y1),local(x0,y1)];
    path(points);
    context.fillStyle='rgba(166,201,193,.10)';
    context.fill();
    context.save();
    context.clip();
    const reflection=context.createLinearGradient(0,height*.27,width*.67,height*.70);
    reflection.addColorStop(0,'rgba(216,236,225,0)');
    reflection.addColorStop(.39,'rgba(216,236,225,.11)');
    reflection.addColorStop(.51,'rgba(216,236,225,.04)');
    reflection.addColorStop(1,'rgba(216,236,225,0)');
    context.fillStyle=reflection;
    context.fillRect(0,0,width,height);
    if(rain>.04){
      context.strokeStyle='rgba(203,227,235,'+clamp(rain*.78,0,.62)+')';
      context.lineWidth=.85;
      context.beginPath();
      for(let i=0;i<100;i++){
        const [u,v,s,l]=rainDrops[(i+100*Number(pane.direction===1))];
        const x=x0+u*w, y=y0+((v-time*(.095+s*.20))%1+1)%1*h;
        const [ax,ay]=local(x,y), [bx,by]=local(x+.007,y+.043+l*.14);
        context.moveTo(ax,ay);context.lineTo(bx,by);
      }
      context.stroke();
    }
    context.restore();
    context.lineJoin='round';
    context.strokeStyle='#242c29';
    context.lineWidth=Math.max(3.4,height*.0128);
    path(points);
    context.stroke();
    context.strokeStyle='rgba(199,204,181,.33)';
    context.lineWidth=1;
    path(points);
    context.stroke();
    const handleX=pane.direction===1?x1-.08:x0+.08;
    const [ax,ay]=local(handleX,-.16,.052), [bx,by]=local(handleX,.045,.052);
    context.strokeStyle='#31332b';context.lineWidth=Math.max(3,height*.008);
    context.beginPath();context.moveTo(ax,ay);context.lineTo(bx,by);context.stroke();
    context.strokeStyle='#adb19a';context.lineWidth=1;
    context.beginPath();context.moveTo(ax-1,ay);context.lineTo(bx-1,by);context.stroke();
  }

  function drawSensorTexture(display, left, top) {
    const [tl, tr, br, bl] = display.projectCorners(point);
    const { width: sourceWidth, height: sourceHeight } = display.image;
    const scaleX = canvas.width / viewWidth, scaleY = canvas.height / viewHeight;
    screen.save();
    screen.setTransform(scaleX, 0, 0, scaleY, -left * scaleX, -top * scaleY);
    screen.imageSmoothingQuality = 'high';
    const drawTriangle = (a, b, c, origin, topRight, bottomLeft) => {
      screen.save();
      path([a, b, c], screen);
      screen.clip();
      screen.transform(
        (topRight[0] - origin[0]) / sourceWidth, (topRight[1] - origin[1]) / sourceWidth,
        (bottomLeft[0] - origin[0]) / sourceHeight, (bottomLeft[1] - origin[1]) / sourceHeight,
        origin[0], origin[1],
      );
      screen.drawImage(display.image, 0, 0);
      screen.restore();
    };
    drawTriangle(tl, tr, bl, tl, tr, bl);
    drawTriangle(tr, br, bl, [tr[0] + bl[0] - br[0], tr[1] + bl[1] - br[1]], tr, bl);
    screen.restore();
  }

  function draw({room,time,drift,rippleTime,cloud,day,solarDirection,rain,rainShade,sunlight,flash,golden,wind,position,view,sensorDisplay,airflow}) {
    if(!roomLayer) return;
    const horizon=point(0,0,-120)[1];
    const upper=context.createLinearGradient(0,0,0,Math.max(1,horizon*1.18));
    const skyMix=clamp(rainShade*.83+Math.max(0,cloud-.57)*.66);
    upper.addColorStop(0,rgb([13,26,48],[lerp(94,61,skyMix),lerp(157,75,skyMix),lerp(194,95,skyMix)],day));
    upper.addColorStop(1,rgb([41,60,78],[lerp(215,108,skyMix),lerp(229,121,skyMix),lerp(219,139,skyMix)],day));
    context.fillStyle=upper;context.fillRect(0,0,width,height);
    if(day<.75) {
      context.fillStyle='rgba(215,230,252,'+(1-day)*.7+')';
      for(const [x,y,a] of stars) {
        context.beginPath();context.arc(x*width,y*horizon, .18+a*.65,0,Math.PI*2);context.fill();
      }
    }

    const shouldSun=day>.09, scale=140;
    const [sx,sy]=shouldSun?point(solarDirection.x*scale,solarDirection.y*scale,solarDirection.z*scale):point(32,24,-105);
    const radius=height*(shouldSun?.21:.14);
    const sunOpacity=shouldSun?day:1-day;
    const halo=context.createRadialGradient(sx,sy,0,sx,sy,radius);
    halo.addColorStop(0,shouldSun?'rgba(255,251,209,'+sunOpacity*.87+')':'rgba(194,221,255,.45)');
    halo.addColorStop(.18,shouldSun?'rgba(255,229,173,'+sunOpacity*.34+')':'rgba(132,177,223,.12)');
    halo.addColorStop(1,'rgba(220,209,191,0)');
    context.fillStyle=halo;context.fillRect(sx-radius,sy-radius,radius*2,radius*2);
    if(shouldSun&&solarDirection.y>0 || !shouldSun) {
      context.fillStyle=shouldSun?'#fff9db':'#d5e1fa';context.beginPath();context.arc(sx,sy,height*(shouldSun?.016:.012),0,Math.PI*2);context.fill();
    }
    const clouds=cloudCanvas(time,width/height,drift,cloud,day,rainShade);
    context.drawImage(clouds,0,-height*.16,width,horizon+height*.36);

    const waterLine=Math.min(height,Math.max(0,point(0,-1.64,-140)[1]));
    const lake=context.createLinearGradient(0,waterLine,0,Math.max(waterLine+1,height));
    lake.addColorStop(0,rgb([23,39,52],[129,161,163],day*(1-rainShade*.43)));
    lake.addColorStop(1,rgb([11,29,42],[70,119,113],day*(1-rainShade*.62)));
    context.fillStyle=lake; context.fillRect(0,waterLine,width,height-waterLine);
    context.lineWidth=.6;
    for(let i=0;i<108;i++) {
      const [u,v,s,l]=rainDrops[i];
      const y=waterLine+height*.4*v*v;
      const x=((u+rippleTime*.003*(s+.4))%1)*width;
      context.strokeStyle='rgba(223,233,222,'+(.055+l*.16)*(.5+day*.5)+')';
      context.beginPath();context.moveTo(x,y);context.lineTo(x+width*(.016+l*.10)*(.35+v),y);context.stroke();
    }

    context.drawImage(gardenLayer,0,0);
    if (rotorLayer) {
      const { mesh, target, x, y } = rotorLayer;
      if (rotorLayer.angle !== mesh.rotation.y) {
        drawStaticMeshes(mesh, camera, width, height, undefined, true, false, rotorLayer);
        rotorLayer.angle = mesh.rotation.y;
      }
      context.drawImage(target.canvas, x, y);
    }
    if(day<.999||rainShade>.01) {
      context.fillStyle='rgba(23,38,59,'+clamp((1-day)*.71+rainShade*.27,0,.83)+')';
      context.fillRect(0,0,width,height);
    }

    if(flash>.01) {
      context.fillStyle='rgba(197,216,255,'+flash*.27+')';context.fillRect(0,0,width,height);
      const [x,y]=point(-10,10.5,-43);
      const [endX,endY]=point(-7,2,-43);
      context.strokeStyle='rgba(243,248,255,'+clamp(flash*2)+')';context.lineWidth=1.6;
      context.beginPath();context.moveTo(x,y);
      for(let i=1;i<=12;i++){
        context.lineTo(lerp(x,endX,i/12)+Math.sin(i*4.2)*9,lerp(y,endY,i/12));
      }
      context.stroke();
    }

    if(rain>.018){
      const count=Math.floor(rainDrops.length*clamp(Math.sqrt(rain)*.91));
      context.strokeStyle='rgba(189,216,233,'+clamp(rain*.45,0,.39)+')';context.lineWidth=.85;
      context.beginPath();
      for(let i=0;i<count;i++){
        const [u,v,s,l,d]=rainDrops[i];
        const y=((v+time*(.74+s*.47))%1)*height;
        const slope=.105+wind*.29;
        const x=((u+y/height*slope)%1)*width;
        const length=height*(.021+l*l*.063)*(d+.38);
        context.moveTo(x,y);context.lineTo(x-slope*length,y-length);
      }
      context.stroke();
    }

    const ordered=room.panes.slice().sort((a,b)=>a.pivot.position.x-b.pivot.position.x);
    for(const pane of ordered) glassPane(pane,time,rain);

    tintContext.clearRect(0,0,width,height);
    tintContext.globalCompositeOperation='source-over';
    tintContext.drawImage(roomLayer.canvas,0,0);
    if (Math.abs(time - curtainTime) >= .035) {
      for (const layer of curtainLayers) {
        layer.curtain.sway(time, airflow);
        drawStaticMeshes(layer.curtain.mesh, camera, width, height, undefined, false, false, layer);
      }
      curtainTime = time;
    }
    for (const layer of curtainLayers) tintContext.drawImage(layer.target.canvas, layer.x, layer.y);
    tintContext.globalCompositeOperation='source-atop';
    const warm=tintContext.createRadialGradient(width*.46,height*.73,height*.11,width*.58,height*.64,width*.7);
    const dim=clamp(.09+(1-day)*.64+rainShade*.29);
    warm.addColorStop(0,'rgba(20,20,26,'+dim*.62+')');
    warm.addColorStop(1,'rgba(15,23,33,'+clamp(dim+.16)+')');
    tintContext.fillStyle=warm;tintContext.fillRect(0,0,width,height);
    const glow=tintContext.createRadialGradient(width*.62,height*.81,0,width*.62,height*.81,height*.56);
    glow.addColorStop(0,'rgba(255,224,163,'+day*sunlight*(1-rainShade)*.21+')');
    glow.addColorStop(1,'rgba(245,201,144,0)');
    tintContext.fillStyle=glow;tintContext.fillRect(0,0,width,height);
    if(flash>.01) {
      tintContext.fillStyle='rgba(197,216,255,'+flash*.17+')';
      tintContext.fillRect(0,0,width,height);
    }

    if(golden>.01 || day<.7) {
      const [x,y]=point(-4.86,2.23,3.55);
      const lamp=tintContext.createRadialGradient(x,y,0,x,y,height*.26);
      lamp.addColorStop(0,'rgba(255,199,121,'+(1-day)*.58+')');
      lamp.addColorStop(1,'rgba(255,196,135,0)');
      tintContext.fillStyle=lamp;tintContext.fillRect(0,0,width,height);
    }
    context.drawImage(tintCanvas,0,0);
    const direct=day*Math.pow(sunlight,1.65)*(1-rainShade);
    if(direct>.08 && solarDirection.y>.05){
      const left=-3.66,right=4.4;
      const xDrift=solarDirection.x/solarDirection.z;
      const zAt=(y)=>Math.min(7.1,y*-solarDirection.z/solarDirection.y);
      const start=zAt(.67),end=zAt(3.97);
      if(start<end-.015){
        beam.clearRect(0,0,width,height);
        beam.globalCompositeOperation='source-over';
        const shape=(a,b)=>[point(a+start*xDrift,.025,start),point(b+start*xDrift,.025,start),point(b+end*xDrift,.025,end),point(a+end*xDrift,.025,end)];
        const bar=.045+(100-position)*.0011;
        const sunwash=beam.createLinearGradient(0,height*.48,0,height*.99);
        sunwash.addColorStop(0,'rgba(255,228,173,'+direct*.30+')');
        sunwash.addColorStop(1,'rgba(255,215,151,'+direct*.23+')');
        beam.fillStyle=sunwash;
        for(const [a,b] of [[left,.38-bar],[.38+bar,right]]){
          path(shape(a,b),beam);
          beam.fill();
        }
        beam.globalCompositeOperation='destination-in';
        beam.drawImage(roomLayer.floorMask,0,0);
        context.drawImage(beamCanvas,0,0);
      }
    }
    const left=padX-focal*Math.tan(view.yaw);
    const top=padY-focal*Math.tan(view.pitch);
    screen.drawImage(stage,left,top,viewWidth,viewHeight,0,0,canvas.width,canvas.height);
    drawSensorTexture(sensorDisplay,left,top);
  }

  return {resize,draw,remove:()=>canvas.remove()};
}
