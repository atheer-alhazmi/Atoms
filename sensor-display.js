import * as T from 'three';
import { box } from './room.js';

const WIDTH = .69;
const HEIGHT = .43;
const formatLux = new Intl.NumberFormat('en');

export function buildSensorDisplay(parent) {
  const device = new T.Group();
  device.position.set(-2.96, .65, .374);
  parent.add(device);

  const housing = new T.MeshStandardMaterial({ color: '#343e3a', metalness: .21, roughness: .66 });
  const bezel = new T.MeshStandardMaterial({ color: '#18201e', metalness: .12, roughness: .58 });
  const indicator = new T.MeshBasicMaterial({ color: '#77e0b8', toneMapped: false });
  box(device, housing, .042, -.036, -.041, WIDTH + .18, .107, .081, .011);
  box(device, housing, .043, 0, .002, WIDTH + .19, HEIGHT + .095, .107, .032);
  box(device, bezel, .042, 0, .049, WIDTH + .16, HEIGHT + .045, .030, .020);
  box(device, indicator, WIDTH / 2 + .067, .156, .065, .022, .022, .008, .006);

  const image = document.createElement('canvas');
  image.width = 600;
  image.height = 368;
  const ctx = image.getContext('2d');
  const texture = new T.CanvasTexture(image);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  const screen = new T.Mesh(new T.PlaneGeometry(WIDTH, HEIGHT), new T.MeshBasicMaterial({
    map: texture, toneMapped: false, fog: false,
  }));
  screen.position.z = .067;
  device.add(screen);
  const outline = ([x, y]) => new T.Vector3(x * WIDTH / 2, y * HEIGHT / 2, 0);
  const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(outline);
  let previous = '';

  function update(frame) {
    const humidity = [frame.indoorHumidity, frame.outdoorHumidity].map(Math.round);
    const climate = [frame.indoor, frame.outdoor].map((value, index) => `${value.toFixed(1)}°C / ${humidity[index]}%`);
    const reading = frame.wet ? 'WET' : 'DRY';
    const lux = `${formatLux.format(frame.lux)} lx`;
    const wind = `${frame.windSpeed.toFixed(1)} km/h`;
    const opening = `${Math.round(frame.position)}%`;
    const key = [reading, lux, wind, ...climate, frame.command.label, opening].join('|');
    if (key === previous) return;
    previous = key;

    const background = ctx.createLinearGradient(0, 0, 600, 368);
    background.addColorStop(0, '#172f2e');
    background.addColorStop(1, '#101e25');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 600, 368);

    function txt(value, x, y, size, color = '#effaf4', weight = 650, align = 'left') {
      ctx.fillStyle = color;
      ctx.font = `${weight} ${size}px system-ui, sans-serif`;
      ctx.textAlign = align;
      ctx.fillText(value, x, y);
    }

    const muted = '#b0cbc5';
    const green = '#92e8be';
    txt('FC-37', 24, 36, 28, muted);
    txt('WINDOW', 575, 36, 28, muted, 650, 'right');
    txt(reading, 24, 113, 76, frame.wet ? '#9ad8ff' : green, 740);
    txt(opening, 575, 113, 76, green, 740, 'right');

    ctx.fillStyle = '#ffffff34';
    for (const y of [128, 214, 290]) ctx.fillRect(24, y, 552, 2);

    txt('LIGHT', 24, 163, 28, muted);
    txt('WIND', 304, 163, 28, muted);
    txt(lux, 24, 202, 35);
    txt(wind, 304, 202, 35);
    txt('IN', 24, 248, 27, muted);
    txt('OUT', 304, 248, 27, muted);
    txt(climate[0], 24, 279, 30);
    txt(climate[1], 304, 279, 30);
    txt(frame.command.label, 24, 337, 36);
    texture.needsUpdate = true;
  }

  function projectCorners(project) {
    screen.updateWorldMatrix(true, false);
    return corners.map(corner => {
      const { x, y, z } = corner.clone().applyMatrix4(screen.matrixWorld);
      return project(x, y, z);
    });
  }

  return { image, screen, update, projectCorners };
}
