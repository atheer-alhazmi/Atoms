export const weather = {
  sun: { label: 'Sunny', cloud: .13, rain: 0, sun: 1, outdoor: 34, humidity: 35, storm: 0, breeze: 0 },
  windy: { label: 'Windy', cloud: .43, rain: 0, sun: .79, outdoor: 24, humidity: 55, storm: 0, breeze: .82 },
  cloud: { label: 'Cloudy', cloud: .82, rain: 0, sun: .36, outdoor: 25, humidity: 65, storm: 0, breeze: 0 },
  rain: { label: 'Rainy', cloud: .90, rain: .67, sun: .17, outdoor: 20, humidity: 87, storm: 0, breeze: 0 },
  storm: { label: 'Stormy', cloud: .99, rain: 1, sun: .06, outdoor: 18, humidity: 95, storm: 1, breeze: 0 },
};

const stages = [
  [0, 'windy', weather.windy],
  [6, 'windy', { ...weather.windy, cloud: .32, sun: .84 }],
  [13, 'sun', weather.sun],
  [23, 'sun', weather.sun],
  [30, 'cloud', { ...weather.cloud, cloud: .63, sun: .58, outdoor: 28 }],
  [37, 'cloud', { ...weather.cloud, cloud: .91, sun: .24, humidity: 77 }],
  [41, 'rain', { ...weather.rain, rain: .11, outdoor: 23, humidity: 80 }],
  [49, 'rain', weather.rain],
  [56, 'storm', weather.storm],
  [63, 'storm', { ...weather.storm, rain: .90 }],
  [70, 'rain', { ...weather.rain, rain: .46, outdoor: 21 }],
  [77, 'cloud', { ...weather.cloud, cloud: .78, rain: 0, outdoor: 22, humidity: 72 }],
  [86, 'windy', weather.windy],
  [94, 'windy', weather.windy],
];

export const sequenceDuration = stages.at(-1)[0];
const clamp = (number, min, max) => Math.max(min, Math.min(max, number));
const mix = (a, b, weight) => a + (b - a) * weight;
const approach = (value, target, rate, dt) => mix(value, target, 1 - Math.exp(-rate * dt));
const fields = ['cloud', 'rain', 'sun', 'outdoor', 'humidity', 'storm', 'breeze'];

export function sampleWeather(elapsed, preset, intensity) {
  const strength = intensity / 70;
  let kind = preset;
  let current;
  if (preset === 'auto') {
    const time = ((elapsed % sequenceDuration) + sequenceDuration) % sequenceDuration;
    const index = stages.findIndex(([end]) => end > time);
    const [start, from, a] = stages[index - 1];
    const [end, to, b] = stages[index];
    const fraction = (time - start) / (end - start);
    const weight = fraction * fraction * (3 - 2 * fraction);
    current = Object.fromEntries(fields.map(key => [key, mix(a[key], b[key], weight)]));
    kind = fraction < .55 ? from : to;
  } else {
    current = { ...weather[preset] };
  }

  current.breeze = clamp(current.breeze * strength, 0, 1.2);
  if (current.rain > 0) {
    current.rain = Math.min(1.4, current.rain * strength);
    current.storm *= clamp(strength, 0, 1);
  } else if (kind === 'sun') {
    current.sun = clamp(current.sun * (.18 + .82 * strength), .05, 1.3);
  } else if (kind === 'cloud') {
    current.cloud = clamp(current.cloud * (.2 + .8 * strength), .05, 1);
    current.sun = clamp(current.sun + (1 - strength) * .28, .07, 1.12);
  }
  return { ...current, kind };
}

export function readFC37(rain, previouslyWet) {
  return rain >= (previouslyWet ? .013 : .035);
}

// The web demo calibrates its normalized wind input to a simulated speed in km/h.
export function readAnemometer({ breeze, storm }) {
  return Math.max(breeze * 60, storm * 64);
}

export function readBH1750(sun, cloud, rain, daylight) {
  const transmission = 1 - cloud * .44;
  return Math.round(2 + 60000 * daylight * sun * transmission * (1 - Math.min(.93, rain * .65)));
}

export function readDHT22(previous, atmosphere, lux, window, dt) {
  const ventilation = window / 100;
  const indoorTarget = mix(23 + Math.max(0, atmosphere.outdoor - 24) * .52 + lux / 58000 * 2.1, atmosphere.outdoor, ventilation * .42);
  const indoorHumidity = mix(47, atmosphere.humidity, .18 + ventilation * .54);
  return {
    indoor: approach(previous.indoor, indoorTarget, .087 + ventilation * .10, dt),
    outdoor: atmosphere.outdoor,
    indoorHumidity: approach(previous.indoorHumidity, indoorHumidity, .11 + ventilation * .19, dt),
    outdoorHumidity: atmosphere.humidity,
  };
}

export function decideArduino({ wet, windLocked, lux, indoor, outdoor }) {
  if (wet) return { position: 0, label: 'Rain protection' };
  if (windLocked) return { position: 0, label: 'Wind protection' };
  if (lux >= 39000 && outdoor >= 30) return { position: 35, label: 'Solar heat protection' };
  if (indoor >= 27 && outdoor <= indoor - 2) return { position: 100, label: 'Cooling ventilation' };
  if (outdoor >= 16 && outdoor <= 29) return { position: 100, label: 'Fresh air ventilation' };
  return { position: 35, label: 'Limited ventilation' };
}

export function driveMG996R(position, target, dt) {
  const delta = target - position;
  if (dt === 0) return position;
  if (Math.abs(delta) <= .25) return target;
  return position + clamp(delta * (1 - Math.exp(-3.1 * dt)), -48 * dt, 48 * dt);
}

export function createWeatherSimulation() {
  let time = 0;
  let hour = 13.4;
  let hourTarget = hour;
  let elapsed = 0;
  let drift = 0;
  let rippleTime = 0;
  let rotorAngle = 0;
  let resetToken = 0;
  let atmosphere = { ...weather.windy };
  let temperature = { indoor: 23, outdoor: 24, indoorHumidity: 51, outdoorHumidity: 55 };
  let wet = false;
  let windLocked = false;
  let position = 100;

  return function tick(dt, settings) {
    if (settings.resetToken !== resetToken) {
      resetToken = settings.resetToken;
      elapsed = 0;
      hourTarget = 13.4;
    }
    time += dt;
    hourTarget = (hourTarget + dt * .020) % 24;
    const hourDelta = (hourTarget - hour + 36) % 24 - 12;
    hour = (hour + hourDelta * (1 - Math.exp(-2 * dt)) + 24) % 24;
    if (settings.preset === 'auto') elapsed = (elapsed + dt) % sequenceDuration;
    const target = sampleWeather(elapsed, settings.preset, settings.intensity);
    for (const key of fields) {
      atmosphere[key] = approach(atmosphere[key], target[key], key === 'rain' ? 1.55 : 1.18, dt);
    }
    const wind = .48 + .32 * atmosphere.storm + .07 * atmosphere.rain;
    drift += dt * (.12 * wind + .19 * atmosphere.breeze);
    rippleTime += dt * (1 + 1.2 * atmosphere.breeze);

    const elevation = Math.sin((hour - 6) / 12 * Math.PI);
    wet = readFC37(atmosphere.rain, wet);
    const windSpeed = readAnemometer(atmosphere);
    windLocked = windSpeed >= (windLocked ? 51 : 55);
    rotorAngle = (rotorAngle + windSpeed * .13 * dt) % (2 * Math.PI);
    const lux = readBH1750(atmosphere.sun, atmosphere.cloud, atmosphere.rain, Math.max(0, elevation));
    temperature = readDHT22(temperature, atmosphere, lux, position, dt);
    const command = decideArduino({ wet, windLocked, lux, ...temperature });
    position = driveMG996R(position, command.position, dt);
    return {
      ...atmosphere, ...temperature, lux, wet, position, command, time, hour, elapsed, drift, rippleTime, wind, windSpeed, rotorAngle,
      kind: target.kind,
    };
  };
}
