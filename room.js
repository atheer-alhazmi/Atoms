import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function randomSource(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function canvasTexture(paint, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  paint(canvas.getContext('2d'), size);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

const material = (color, roughness = .86, extra = {}) => new T.MeshStandardMaterial({ color, roughness, ...extra });
const standardBox = new T.BoxGeometry(1, 1, 1);

export function box(parent, mat, x, y, z, width, height, depth, radius = 0) {
  const object = new T.Mesh(radius ? new RoundedBoxGeometry(width, height, depth, 3, radius) : standardBox, mat);
  if (!radius) object.scale.set(width, height, depth);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function vessel(parent, mat, x, y, z, top, base, height) {
  const object = new T.Mesh(new T.CylinderGeometry(top, base, height, 22), mat);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function woodTexture() {
  const random = randomSource(13);
  return canvasTexture((context, size) => {
    context.fillStyle = '#846449';
    context.fillRect(0, 0, size, size);
    for (let edge = 0; edge < 5; edge++) {
      const y = edge * size / 5;
      const shade = 105 + Math.round(random() * 33);
      context.fillStyle = `rgb(${shade + 37},${shade + 6},${shade - 19})`;
      context.fillRect(0, y, size, size / 5);
      for (let i = 0; i < 115; i++) {
        const row = y + random() * size / 5;
        context.strokeStyle = random() > .5 ? '#30170a20' : '#fcd7a122';
        context.beginPath();
        context.moveTo(0, row);
        context.bezierCurveTo(72, row + random() * 4, 109, row - random() * 5, size, row);
        context.stroke();
      }
      context.fillStyle = '#372419a2';
      context.fillRect(0, y, size, 1.7);
      context.fillRect(edge % 2 ? size * .29 : size * .73, y, 1.6, size / 5);
    }
  });
}

function textileTexture(tone, scale = 192) {
  const rand = randomSource(164);
  return canvasTexture((context, size) => {
    context.fillStyle = tone;
    context.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 2) {
      for (let x = 0; x < size; x += 2) {
        context.fillStyle = (rand() > .53 ? '#ffffff' : '#342321') + (rand() > .5 ? '21' : '13');
        context.fillRect(x, y, 1 + (y % 4 === 0), 1);
      }
    }
  }, scale);
}

function floorCover(parent, mat, x, z, w, d, height = .018) {
  const cover = new T.Mesh(new T.PlaneGeometry(w, d), mat);
  cover.rotation.x = -Math.PI / 2;
  cover.position.set(x, height, z);
  cover.name = "ground";
  cover.receiveShadow = true;
  parent.add(cover);
}

function plaidTexture(base, crossband) {
  return canvasTexture((context, size) => {
    const stripe = (color, offset, width) => {
      context.fillStyle = color;
      context.fillRect(offset, 0, width, size);
      context.fillRect(0, offset, size, width);
    };
    context.fillStyle = base;
    context.fillRect(0, 0, size, size);
    for (let offset = 0; offset < size; offset += 64) {
      stripe(crossband, offset + 5, 23);
      stripe('#fff7e380', offset + 9, 2);
      stripe('#fff7e35b', offset + 33, 3);
      stripe('#413d3150', offset + 39, 2);
    }
    const rand = randomSource(183);
    for (let row = 0; row < size; row += 2) {
      for (let x = row % 4; x < size; x += 3) {
        context.fillStyle = rand() > .5 ? '#ffffff32' : '#352b262a';
        context.fillRect(x, row, 1, 1);
      }
    }
  });
}

function throwPillow(parent, mat, x, y, z, width, height, depth, tilt, twist) {
  const pillow = box(parent, mat, x, y, z, width, height, depth, depth * .45);
  const shape = pillow.geometry;
  const points = shape.attributes.position;
  for (let i = 0; i < points.count; i++) {
    const u = points.getX(i) / (width / 2);
    const v = points.getY(i) / (height / 2);
    const bulge = Math.max(0, (1 - u * u) * (1 - v * v));
    const pinch = .045 * height * Math.pow(1 - Math.abs(u), 2) * v ** 7;
    points.setY(i, points.getY(i) - pinch);
    points.setZ(i, points.getZ(i) * (.52 + .8 * bulge));
  }
  shape.computeVertexNormals();
  pillow.rotation.set(-.27, twist, tilt);
}

function rugTexture() {
  const rand = randomSource(292);
  return canvasTexture((ctx, size) => {
    ctx.fillStyle = '#bd9490';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#a8797958';
    ctx.fillRect(9, 10, size - 18, size - 20);
    ctx.fillStyle = '#d3ada483';
    ctx.fillRect(26, 27, size - 52, size - 54);
    ctx.strokeStyle = '#f0d6c49a';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 15, size - 28, size - 30);
    ctx.strokeRect(22, 23, size - 44, size - 46);
    ctx.strokeStyle = '#925d613a';
    for (let y = 50; y < size - 35; y += 36) {
      for (let x = 49; x < size - 36; x += 46) {
        ctx.beginPath();
        ctx.moveTo(x - 9, y);
        ctx.quadraticCurveTo(x - 3, y - 1, x, y - 9);
        ctx.quadraticCurveTo(x + 3, y - 1, x + 9, y);
        ctx.quadraticCurveTo(x + 2, y + 1, x, y + 9);
        ctx.quadraticCurveTo(x - 3, y + 2, x - 9, y);
        ctx.stroke();
      }
    }
    for (let y = 0; y < size; y += 2) {
      for (let x = y % 4; x < size; x += 3) {
        ctx.fillStyle = rand() > .53 ? '#fff1dc32' : '#58373b34';
        ctx.fillRect(x, y, 1 + rand() * 2, 1);
      }
    }
  }, 512);
}

function drapeThrow(sofa) {
  const textile = textileTexture('#eee0c7', 256);
  const cloth = material('#d9c4a9', .98, { map: textile, bumpMap: textile, bumpScale: .013, side: T.DoubleSide });
  const mat = material('#d6c2a5', .98);
  const geometry = new T.PlaneGeometry(1, 1, 32, 32);
  const points = geometry.attributes.position;
  function onThrow(u, v) {
    const fold = Math.sin(u * 25 + v * 4) * .024 + Math.sin(u * 45 - v * 5) * .012;
    const fall = T.MathUtils.smoothstep(v, .72, 1);
    const edge = Math.sin(u * 7.2 + .5) * .028 * fall;
    return new T.Vector3(
      1.43 + (u - .5) * (.30 + fall * .10) - .047 * Math.sin(v * Math.PI),
      1.028 + fold - .453 * fall + edge,
      -.26 + .86 * Math.sin(v * Math.PI * .48) + fold * fall,
    );
  }
  for (let i = 0; i < points.count; i++) {
    const point = onThrow(points.getX(i) + .5, points.getY(i) + .5);
    points.setXYZ(i, point.x, point.y, point.z);
  }
  geometry.computeVertexNormals();
  const blanket = new T.Mesh(geometry, cloth);
  blanket.castShadow = blanket.receiveShadow = true;
  sofa.add(blanket);
  const up = new T.Vector3(0, 1, 0);
  for (let i = 1; i < 18; i++) {
    const end = onThrow(i / 18, 1);
    const fringe = vessel(sofa, mat, end.x, end.y - .021, end.z, .0037, .0025, .043 + (i % 3) * .006);
    fringe.quaternion.setFromUnitVectors(up, new T.Vector3((i % 3 - 1) * .11, 1, -.15).normalize());
  }
}

function couch(parent, fabric, wood) {
  const sofa = new T.Group();
  sofa.position.set(-3.15, 0, 3.85);
  sofa.rotation.y = 1.03;
  parent.add(sofa);
  box(sofa, fabric, 0, .39, 0, 3.1, .45, 1.06, .14);
  box(sofa, fabric, 0, .88, -.39, 3.02, .73, .33, .15);
  for (const x of [-.91, 0, .91]) {
    box(sofa, fabric, x, .65, .07, .89, .23, .82, .105);
    const back = box(sofa, fabric, x, .96, -.25, .885, .58, .24, .114);
    back.rotation.x = -.14;
  }
  for (const x of [-1.48, 1.48]) {
    box(sofa, fabric, x, .73, .01, .26, .5, 1.01, .115);
    for (const z of [-.345, .35]) box(sofa, wood, x * .89, .12, z, .085, .22, .085, .017);
  }
  const weave = textileTexture('#f6f1e7', 256);
  const solid = color => material(color, .98, { map: weave, bumpMap: weave, bumpScale: .012 });
  const flax = material('#ffffff', .98, { map: plaidTexture('#a29b84', '#5b5a454e'), bumpMap: weave, bumpScale: .011 });
  const rosePlaid = material('#ffffff', .98, { map: plaidTexture('#bc928a', '#8059574b'), bumpMap: weave, bumpScale: .011 });
  const pillows = [
    [solid('#bb8280'), -1.06, 1.048, .04, .61, .64, .25, .13, .07],
    [solid('#9eae92'), -.70, .988, .194, .51, .49, .23, -.10, .13],
    [rosePlaid, -.43, .913, .33, .49, .32, .19, -.05, -.08],
    [solid('#efe4cd'), 1.02, 1.065, .035, .60, .66, .24, -.12, -.10],
    [solid('#e7b0a9'), .72, 1.002, .215, .53, .53, .24, .13, -.12],
    [flax, .38, .927, .336, .64, .32, .20, -.10, .07],
  ];
  for (const spec of pillows) throwPillow(sofa, ...spec);
  drapeThrow(sofa);
}

function chair(parent, textile, wood) {
  const frame = new T.Group();
  frame.position.set(3.6, 0, 1.98);
  frame.rotation.y = -.75;
  parent.add(frame);
  box(frame, textile, 0, .52, .04, 1.02, .32, .98, .13);
  const back = box(frame, textile, 0, .98, -.37, .91, .73, .29, .14);
  back.rotation.x = .19;
  for (const x of [-.51, .51]) {
    box(frame, wood, x, .77, .02, .09, .074, .9, .025);
    const frontLeg = box(frame, wood, x, .39, .35, .08, .77, .08, .017);
    frontLeg.rotation.x = .05;
    const rearLeg = box(frame, wood, x, .385, -.33, .075, .76, .074, .017);
    rearLeg.rotation.x = -.13;
  }
}

function curvedLeafGeometry() {
  const geometry = new T.PlaneGeometry(1, 1, 6, 15);
  const points = geometry.attributes.position;
  for (let i = 0; i < points.count; i++) {
    const u = points.getX(i) * 2;
    const v = points.getY(i) + .5;
    const width = .52 * Math.pow(Math.sin(Math.PI * v), .82);
    points.setXYZ(i, u * width * (1 - .2 * v), v, .17 * Math.sin(v * Math.PI * .9) - .12 * v ** 4 - .11 * u * u * width);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function plant(parent, x, y, z, scale, seed, slender = false) {
  const rand = randomSource(seed);
  const group = new T.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  parent.add(group);
  const ceramic = material(slender ? '#a49e87' : '#b3a184', .61);
  vessel(group, ceramic, 0, .16, 0, .218, .157, .32);
  vessel(group, ceramic, 0, .316, 0, .222, .212, .032);
  vessel(group, material('#473b2a'), 0, .328, 0, .199, .196, .013);

  const veins = canvasTexture((context, size) => {
    const shade = context.createLinearGradient(0, 0, size, 0);
    shade.addColorStop(0, '#b8c1a2');
    shade.addColorStop(.46, '#eff7ce');
    shade.addColorStop(.54, '#e5edbf');
    shade.addColorStop(1, '#c4d2a9');
    context.fillStyle = shade;
    context.fillRect(0, 0, size, size);
    context.strokeStyle = '#f4f2b799';
    context.lineWidth = 1.2;
    for (let row = size * .25; row < size * .97; row += 13) {
      context.beginPath();
      context.moveTo(size * .15, row - 17);
      context.quadraticCurveTo(size * .3, row - 16, size / 2, row);
      context.quadraticCurveTo(size * .68, row - 13, size * .9, row - 22);
      context.stroke();
    }
    context.fillStyle = '#f2efb79c';
    context.fillRect(size / 2 - 1, 0, 2, size);
  }, 128);
  const foliage = ['#38583c', '#427148', '#5d7a49', '#496343', '#698248'].map(color =>
    material(color, .68, { map: veins, side: T.DoubleSide }));
  const stem = material('#68724a');
  const geometry = curvedLeafGeometry();
  const root = new T.Vector3(0, .328, 0);
  const up = new T.Vector3(0, 1, 0);
  for (let i = 0; i < 12; i++) {
    const angle = i * 2.39996 + rand() * .27;
    const length = .34 + rand() * .74;
    const spread = .12 + rand() * (slender ? .26 : .42);
    const end = new T.Vector3(Math.cos(angle) * spread, root.y + length, Math.sin(angle) * spread);
    const twig = vessel(group, stem, 0, 0, 0, .009, .014, root.distanceTo(end));
    twig.position.copy(root).lerp(end, .5);
    twig.quaternion.setFromUnitVectors(up, end.clone().sub(root).normalize());
    for (const [j, distance] of [.61, .81, 1].entries()) {
      const direction = angle + (j - 1) * 1.12;
      const leaf = new T.Mesh(geometry, foliage[(i + j * 2) % foliage.length]);
      leaf.position.copy(root).lerp(end, distance);
      leaf.scale.set((slender ? .13 : .24) + rand() * .11, .25 + rand() * .23, .26);
      leaf.rotation.order = 'YXZ';
      leaf.rotation.set(.76 + rand() * .78, Math.PI / 2 - direction, (rand() - .5) * .43);
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      group.add(leaf);
    }
  }
}

function curtain(parent, x, width) {
  const geometry = new T.PlaneGeometry(width, 3.97, 26, 20);
  const points = geometry.attributes.position;
  for (let i = 0; i < points.count; i++) {
    const u = (points.getX(i) / width + .5);
    const v = points.getY(i) / 3.97 + .5;
    points.setXYZ(i, points.getX(i) * (.88 + .12 * v), points.getY(i) + Math.sin(u * 35) * .018, Math.sin(u * 39 + v * .72) * (.10 - v * .035));
  }
  geometry.computeVertexNormals();
  const mesh = new T.Mesh(geometry, material('#d6cab6', .95, { map: textileTexture('#f0e8d8'), side: T.DoubleSide }));
  mesh.position.set(x, 2.02, .29);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  const rest = points.array.slice();
  const uv = geometry.attributes.uv;
  const phase = x < 0 ? .35 : 1.65;
  points.setUsage(T.DynamicDrawUsage);
  geometry.attributes.normal.setUsage(T.DynamicDrawUsage);
  geometry.computeBoundingSphere();
  geometry.boundingSphere.radius += .5;
  function sway(time, airflow) {
    const beat = time * 1.72;
    for (let i = 0; i < points.count; i++) {
      const u = uv.getX(i);
      const down = 1 - uv.getY(i);
      const strength = airflow * down ** 1.42;
      const wave = Math.sin(beat - down * 3 + phase + u * .7);
      const flutter = Math.sin(beat * 2.3 - down * 6 + u * 8 + phase);
      const at = i * 3;
      points.setXYZ(i,
        rest[at] + strength * (.10 + .22 * wave + .048 * flutter),
        rest[at + 1] + strength * (.12 + .075 * wave),
        rest[at + 2] + strength * (.11 + .14 * wave + .038 * flutter),
      );
    }
    points.needsUpdate = true;
    geometry.computeVertexNormals();
  }
  return { mesh, sway };
}

function artPrint(kind) {
  return canvasTexture((ctx, size) => {
    ctx.scale(size / 400, size / 400);
    ctx.fillStyle = '#e5d6c3';
    ctx.fillRect(0, 0, 400, 400);
    function oval(x, y, w, h, angle, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x, y, w, h, angle, 0, Math.PI * 2);
      ctx.fill();
    }
    if (kind === 'landscape') {
      oval(272, 124, 44, 43, 0, '#c78778');
      for (const [index, color] of ['#ada287', '#8f977e', '#717d5c', '#a98877'].entries()) {
        const y = 220 + 32 * index;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(93, y - 60 + 16 * index, 117, y + 36, 217, y - 14);
        ctx.bezierCurveTo(293, y - 44, 333, y - 18 * index, 400, y - 35);
        ctx.lineTo(400, 400);
        ctx.lineTo(0, 400);
        ctx.fill();
      }
    } else if (kind === 'study') {
      oval(186, 230, 104, 149, -.32, '#b59078');
      oval(232, 168, 85, 108, .45, '#e1b5a5');
      oval(154, 245, 59, 89, -.28, '#7b8262');
      ctx.strokeStyle = '#72674d';
      ctx.lineWidth = 2.7;
      ctx.beginPath();
      ctx.moveTo(94, 338);
      ctx.bezierCurveTo(122, 262, 264, 238, 277, 113);
      ctx.bezierCurveTo(286, 69, 343, 122, 340, 208);
      ctx.stroke();
    } else {
      oval(165, 218, 112, 156, -.25, '#d3a195');
      oval(281, 141, 74, 101, .29, '#c4b08c');
      const colors = ['#6d7854', '#8d9572', '#59684d', '#a4a178'];
      ctx.strokeStyle = '#5d664c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(147, 365);
      ctx.quadraticCurveTo(236, 242, 212, 71);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const side = i % 2 ? 1 : -1;
        const y = 107 + i * 29;
        const x = (220 + 5 * Math.sin(i)) + side * (26 + i * 2.4);
        oval(x, y + 4, 49 + i * 1.7, 14 + i * 1.1, side * -.50, colors[i % colors.length]);
      }
      oval(107, 171, 24, 23, 0, '#d8b995');
    }
    const rand = randomSource(52);
    for (let i = 0; i < 11500; i++) {
      ctx.fillStyle = rand() > .55 ? '#fff3d423' : '#45352716';
      ctx.fillRect(rand() * 400, rand() * 400, 1 + rand() * 2, 1);
    }
  }, 420);
}

function framedPrint(wall, x, y, width, height, kind, frameColor = '#594133') {
  box(wall, material(frameColor, .67), x, y, .135, width, height, .052, .014);
  box(wall, material('#d9cbba'), x, y, .166, width - .058, height - .061, .016);
  box(wall, material('#fffdf0', .93, { map: artPrint(kind) }), x, y, .177, width - .19, height - .202, .012);
}

function roomArt(room) {
  framedPrint(room, -4.69, 2.75, .98, 1.43, 'botanical');
  const sofaWall = new T.Group();
  sofaWall.position.set(-6.06, 0, 1.78);
  sofaWall.rotation.y = Math.PI / 2;
  room.add(sofaWall);
  framedPrint(sofaWall, .96, 2.60, 1.27, 1.03, 'landscape');
  framedPrint(sofaWall, -.10, 2.79, .58, .67, 'study', '#795c43');
  framedPrint(sofaWall, -.10, 2.13, .58, .51, 'botanical');
}

function turnedCeramic(parent, mat, x, y, z, profile) {
  const shape = new T.LatheGeometry(profile.map(([radius, height]) => new T.Vector2(radius, height)), 32);
  const mesh = new T.Mesh(shape, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function decorBook(parent, x, y, z, width, depth, thickness, angle, color) {
  const book = new T.Group();
  book.position.set(x, y, z);
  book.rotation.y = angle;
  parent.add(book);
  const cover = material(color, .91);
  box(book, cover, 0, .005, 0, width, .010, depth, .004);
  box(book, material('#e7dbc5', .96), .008, thickness / 2, 0, width - .025, thickness - .016, depth - .023, .007);
  box(book, cover, 0, thickness - .003, 0, width, .011, depth, .005);
  box(book, cover, -width / 2 + .007, thickness / 2, 0, .020, thickness, depth, .008);
  const foil = material('#d1b293', .64);
  box(book, foil, -.02, thickness + .003, -.044, width * .53, .0015, .011);
  box(book, foil, -.04, thickness + .003, -.025, width * .35, .0015, .005);
}

function foliageStem(parent, mat, start, end, radius = .009) {
  const stem = vessel(parent, mat, 0, 0, 0, radius * .62, radius, start.distanceTo(end));
  stem.position.copy(start).lerp(end, .5);
  stem.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), end.clone().sub(start).normalize());
}

function flowerVase(table, x, y, z) {
  const bouquet = new T.Group();
  bouquet.position.set(x, y, z);
  table.add(bouquet);
  const glaze = material('#dfc7b1', .46, { map: textileTexture('#e9dfd1', 128), metalness: .04 });
  const stem = material('#717a4d', .79);
  const leaf = material('#638053', .84, { side: T.DoubleSide });
  const flowerProfile = [[0, 0], [.095, 0], [.125, .04], [.158, .12], [.167, .24], [.138, .32], [.095, .365], [.071, .40], [.073, .46], [.06, .46], [.059, .414], [.051, .371]];
  turnedCeramic(bouquet, glaze, 0, 0, 0, flowerProfile);
  const rand = randomSource(86);
  const bloomMat = new T.MeshStandardMaterial({ roughness: .88 });
  const petal = new T.SphereGeometry(1, 10, 7);
  const count = 12;
  const petalsPerFlower = 12;
  const petals = new T.InstancedMesh(petal, bloomMat, count * petalsPerFlower);
  petals.castShadow = petals.receiveShadow = true;
  bouquet.add(petals);
  const dummy = new T.Object3D();
  const palette = ['#dfab94', '#eed3b1', '#d07d7d', '#e5adad', '#be7777', '#ebc0a3'].map(color => new T.Color(color));
  const heart = material('#aa7860', .91);
  const leafGeometry = curvedLeafGeometry();
  for (let i = 0; i < count; i++) {
    const direction = i * 2.39996;
    const spread = i < 4 ? .055 + rand() * .07 : .13 + rand() * .12;
    const height = i < 4 ? .79 + rand() * .13 : .63 + rand() * .13;
    const tip = new T.Vector3(Math.cos(direction) * spread, height, Math.sin(direction) * spread);
    const base = new T.Vector3(Math.cos(direction) * .024, .395, Math.sin(direction) * .024);
    foliageStem(bouquet, stem, base, tip, .007);
    if (i % 2 === 0) {
      const greenery = new T.Mesh(leafGeometry, leaf);
      greenery.position.copy(base).lerp(tip, .53);
      greenery.rotation.order = 'YXZ';
      greenery.rotation.set(1.18, Math.PI / 2 - direction, .07);
      greenery.scale.set(.087, .21, .10);
      greenery.castShadow = true;
      bouquet.add(greenery);
    }
    const color = palette[i % palette.length];
    const size = .063 + rand() * .016;
    for (let j = 0; j < petalsPerFlower; j++) {
      const inner = j >= 8;
      const angle = j * (inner ? Math.PI / 2 : Math.PI / 4) + i * .31;
      const spread = size * (inner ? .29 : .65);
      dummy.position.set(tip.x + Math.cos(angle) * spread, tip.y + (inner ? .022 : 0), tip.z + Math.sin(angle) * spread);
      dummy.rotation.set(.23 * Math.sin(angle), -angle, .21 * Math.cos(angle));
      dummy.scale.set(size * (inner ? .43 : .66), size * (inner ? .43 : .29), size * .42);
      dummy.updateMatrix();
      const slice = i * petalsPerFlower + j;
      petals.setMatrixAt(slice, dummy.matrix);
      petals.setColorAt(slice, color.clone().multiplyScalar(.89 + rand() * .23));
    }
    vessel(bouquet, heart, tip.x, tip.y + .029, tip.z, .018, .015, .015);
  }
}

function coffeeTableDecor(table) {
  const top = .572;
  flowerVase(table, .50, top, -.24);
  decorBook(table, -.29, top, -.13, .44, .31, .058, -.16, '#6e796a');
  decorBook(table, -.28, top + .058, -.14, .373, .268, .037, -.02, '#ba8c83');

  const clay = material('#c49b8d', .59);
  turnedCeramic(table, clay, -.25, top, .30, [[0, 0], [.094, 0], [.126, .027], [.168, .06], [.180, .09], [.166, .09], [.145, .056], [.099, .034], [0, .034]]);
  const ornament = new T.SphereGeometry(1, 11, 8);
  for (const [x, z, size, color] of [[-.29, .28, .048, '#dac4ac'], [-.21, .32, .039, '#a98c7f'], [-.20, .26, .027, '#cf9e93']]) {
    const bead = new T.Mesh(ornament, material(color, .57));
    bead.position.set(x, top + .066, z);
    bead.scale.set(size, size * .77, size);
    bead.castShadow = true;
    table.add(bead);
  }
  const candle = material('#cfb39d', .54);
  turnedCeramic(table, candle, .27, top, .32, [[0, 0], [.072, 0], [.079, .012], [.077, .118], [.067, .119], [.063, .099]]);
  vessel(table, material('#f6e0ba'), .27, top + .102, .32, .065, .065, .012);
  vessel(table, material('#5a4638'), .27, top + .113, .32, .004, .004, .018);
  const pebble = new T.Mesh(ornament, material('#e2c7b5', .52));
  pebble.position.set(.48, top + .023, .23);
  pebble.scale.set(.044, .025, .035);
  pebble.castShadow = true;
  table.add(pebble);
}

function branchVase(table, x, y, z) {
  const glaze = material('#bf8f82', .52);
  turnedCeramic(table, glaze, x, y, z, [[0, 0], [.045, 0], [.069, .032], [.073, .09], [.047, .138], [.035, .165], [.027, .165], [.027, .152]]);
  const stem = material('#746b4e');
  const leaves = material('#8c9471', .86, { side: T.DoubleSide });
  const geometry = curvedLeafGeometry();
  for (const [angle, length, spread] of [[0, .22, .053], [2.25, .20, .085], [4.47, .32, .069]]) {
    const root = new T.Vector3(x, y + .139, z);
    const tip = new T.Vector3(x + Math.cos(angle) * spread, root.y + length, z + Math.sin(angle) * spread);
    foliageStem(table, stem, root, tip, .0048);
    for (let i = 0; i < 3; i++) {
      const leaf = new T.Mesh(geometry, leaves);
      leaf.position.copy(root).lerp(tip, .44 + i * .24);
      leaf.rotation.order = 'YXZ';
      leaf.rotation.set(1.10, angle + i * 2.4, .23);
      leaf.scale.set(.038, .084, .030);
      leaf.castShadow = true;
      table.add(leaf);
    }
  }
}

function chairCorner(room, woodMap) {
  const table = new T.Group();
  table.position.set(2.48, 0, 1.84);
  room.add(table);
  const walnut = material('#594032', .56, { map: woodMap });
  const base = material('#533a2b', .71);
  vessel(table, walnut, 0, .663, 0, .415, .402, .074);
  vessel(table, base, 0, .615, 0, .287, .219, .052);
  turnedCeramic(table, base, 0, 0, 0, [[0, 0], [.24, 0], [.247, .032], [.163, .075], [.116, .145], [.081, .478], [.105, .616], [0, .616]]);
  const top = .702;
  const lampX = -.135, lampZ = -.124;
  const stone = material('#cbb7a1', .56);
  turnedCeramic(table, stone, lampX, top, lampZ, [[0, 0], [.080, 0], [.085, .033], [.083, .095], [.061, .170], [.028, .213], [0, .213]]);
  const brass = material('#99774f', .40, { metalness: .57 });
  vessel(table, brass, lampX, top + .226, lampZ, .016, .016, .055);
  const linen = textileTexture('#efe0c3', 256);
  const fabric = material('#dbc29e', .94, { map: linen, bumpMap: linen, bumpScale: .015, emissive: '#e8aa66', emissiveIntensity: .08, side: T.DoubleSide });
  const shade = new T.Mesh(new T.CylinderGeometry(.136, .210, .215, 32, 1, true), fabric);
  shade.position.set(lampX, top + .357, lampZ);
  shade.castShadow = shade.receiveShadow = true;
  table.add(shade);
  branchVase(table, .225, top, .035);
  decorBook(table, -.058, top, .222, .275, .146, .030, -.10, '#b98d81');
  decorBook(table, -.064, top + .03, .221, .224, .128, .024, -.02, '#d1bba7');
  vessel(table, brass, .028, top + .065, .202, .035, .028, .022);
}

export function buildRoom(scene) {
  const room = new T.Group();
  scene.add(room);
  const plaster = material('#c5bcaa', .96, { map: textileTexture('#f4f0e8') });
  const charcoal = material('#303931', .54, { metalness: .18 });
  const innerMetal = material('#62685a', .48, { metalness: .31 });
  const wood = material('#8d6b49', .71);
  const oak = woodTexture();
  const floorMap = oak.clone();
  floorMap.wrapS = floorMap.wrapT = T.RepeatWrapping;
  floorMap.repeat.set(4, 8);
  floorMap.needsUpdate = true;
  const floor = new T.Mesh(new T.PlaneGeometry(12.2, 11.5), material('#eee0c7', .78, { map: floorMap }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 5.66);
  floor.receiveShadow = true;
  floor.name = "ground";
  room.add(floor);
  const rug = rugTexture();
  floorCover(room, material('#a97676', .98, { map: textileTexture('#eee1d8') }), -.3, 4.1, 6.15, 3.95);
  floorCover(room, material('#f3e7df', .98, { map: rug, bumpMap: rug, bumpScale: .012 }), -.3, 4.1, 5.93, 3.75, .022);
  const left = -3.73, right = 4.49, low = .64, high = 4.02;
  const middle = (left + right) / 2;
  const width = right - left;
  const height = high - low;
  box(room, plaster, (-6.2 + left) / 2, 2.25, 0, left + 6.2, 4.5, .24);
  box(room, plaster, (6.2 + right) / 2, 2.25, 0, 6.2 - right, 4.5, .24);
  box(room, plaster, middle, low / 2, 0, width, low, .24);
  box(room, plaster, middle, (4.5 + high) / 2, 0, width, 4.5 - high, .24);
  box(room, material('#b2ac9b'), -6.06, 2.25, 4.06, .16, 4.5, 8.12);
  box(room, plaster, 6.06, 2.25, 3.75, .16, 4.5, 7.5);
  box(room, material('#ceccbc'), 0, 4.48, 3.8, 12.2, .12, 7.7);
  box(room, material('#a19983'), 0, .069, .157, 12.0, .139, .073, .015);
  const slats = material('#81684d', .86, { map: oak });
  {
    const wallWood = material('#604d39');
    box(room, wallWood, -5.71, 2.24, .133, .73, 4.45, .038);
    for (let i = 0; i < 7; i++) box(room, slats, -6.036 + i * .105, 2.25, .176, .073, 4.5, .051, .01);
  }
  roomArt(room);
  for (const y of [low, high]) box(room, charcoal, middle, y, .0, width + .16, .131, .149, .018);
  for (const x of [left, right]) box(room, charcoal, x, (low + high) / 2, 0, .12, height, .149, .018);
  box(room, material('#b1a184', .65, { map: oak }), middle, low - .05, .103, width + .47, .118, .44, .022);
  box(room, innerMetal, middle, low + .07, -.046, width - .16, .021, .10, .006);
  box(room, charcoal, middle, high + .125, .252, width + .81, .042, .049, .018);
  const curtains = [curtain(room, left - .18, .64), curtain(room, right + .37, .91)];

  const opening = width / 2 - .096;
  const sashHeight = height - .13;
  const panes = [];
  for (const direction of [1, -1]) {
    const pivot = new T.Group();
    pivot.position.set(direction === 1 ? left + .06 : right - .06, (low + high) / 2, -.031);
    room.add(pivot);
    const center = opening * direction / 2;
    for (const y of [-sashHeight / 2, sashHeight / 2]) box(pivot, charcoal, center, y, 0, opening, .079, .076, .011);
    for (const side of [0, direction * opening]) box(pivot, charcoal, side, 0, 0, .068, sashHeight, .075, .01);
    const glass = new T.Mesh(new T.PlaneGeometry(opening - .07, sashHeight - .07), new T.MeshPhysicalMaterial({
      color: '#abc7c2', emissive: '#84b5af', emissiveIntensity: .13, transparent: true, opacity: .095,
      roughness: .18, metalness: .23, depthWrite: false, side: T.DoubleSide,
    }));
    glass.position.x = center;
    glass.renderOrder = 3;
    pivot.add(glass);
    box(pivot, innerMetal, direction * (opening - .111), -.14, .069, .067, .23, .039, .019);
    box(pivot, charcoal, direction * (opening - .104), -.11, .126, .038, .16, .067, .016);
    panes.push({ pivot, direction, center, width: opening - .14, height: sashHeight - .14 });
  }

  const upholstery = textileTexture('#f3eddb', 256);
  const olive = material('#797447', .98, { map: upholstery, bumpMap: upholstery, bumpScale: .015 });
  couch(room, olive, wood);
  chair(room, material('#82866d', 1, { map: textileTexture('#e9e0ca') }), wood);

  const table = new T.Group();
  table.position.set(-.55, 0, 3.57);
  room.add(table);
  const top = vessel(table, material('#c8af8e', .62, { map: oak }), 0, .53, 0, .82, .815, .083);
  top.scale.set(1.18, 1, .79);
  for (const [x, z] of [[-.58, -.27], [.58, -.27], [0, .43]]) {
    const leg = box(table, wood, x, .274, z, .085, .51, .085, .021);
    leg.rotation.z = -x * .17;
  }
  coffeeTableDecor(table);
  chairCorner(room, oak);
  plant(room, 4.98, 0, 1.33, 1.74, 401);
  plant(room, -4.91, 0, 1.03, 1.15, 13, true);
  plant(room, 1.87, low + .03, .153, .36, 26);
  plant(room, 3.6, low + .03, .143, .43, 62, true);

  const lamp = new T.Group();
  lamp.position.set(-4.86, 0, 3.55);
  room.add(lamp);
  vessel(lamp, charcoal, 0, .042, 0, .25, .25, .048);
  vessel(lamp, charcoal, 0, 1.18, 0, .025, .025, 2.28);
  const shade = material('#ded0ab', .88, { emissive: '#f8b66a', emissiveIntensity: .06, side: T.DoubleSide });
  const shadeMesh = new T.Mesh(new T.CylinderGeometry(.24, .40, .34, 32, 1, true), shade);
  shadeMesh.position.y = 2.23;
  lamp.add(shadeMesh);
  const bulb = new T.PointLight('#ffd2a1', 0, 7);
  bulb.position.set(0, 2.15, 0);
  lamp.add(bulb);
  return { panes, curtains, bulb, shade };
}
