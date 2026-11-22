import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, ChevronDown, ChevronUp, Cloud, CloudLightning, CloudRain, Cpu,
  Droplet, Gauge, Pause, Play, RotateCcw, SlidersHorizontal, Sun, Thermometer, Wind, X,
} from 'lucide-react';
import { mountScene } from './scene.js';
import { weather } from './simulation.js';
import './style.css';

const icons = { auto: RotateCcw, sun: Sun, windy: Wind, cloud: Cloud, rain: CloudRain, storm: CloudLightning };
const speeds = [.5, 1, 2, 4];
const initialSettings = { preset: 'auto', intensity: 70, speed: 1, running: true, resetToken: 0 };
const initialTelemetry = {
  kind: 'windy', wet: false, lux: 35400, windSpeed: 49.2, indoor: 23, outdoor: 24,
  indoorHumidity: 51, outdoorHumidity: 55, position: 100, command: { position: 100, label: 'Fresh air ventilation' },
};
const luxFormat = new Intl.NumberFormat('en');

function SensorOverlay({ telemetry, close }) {
  const { wet, lux, windSpeed, indoor, outdoor, indoorHumidity, outdoorHumidity, command, position } = telemetry;
  return <section className="glass sensors" id="sensor-overlay" aria-label="Live sensor readings">
    <header className="sensor-header"><h2><Activity size={16} /> Live sensors</h2><button type="button" className="icon-button close" onClick={close} aria-label="Hide live sensors"><X size={17} /></button></header>
    <dl>
      <div><dt><Droplet /> FC-37</dt><dd className={wet ? 'wet' : 'dry'}>{wet ? 'WET' : 'DRY'}</dd></div>
      <div><dt><Wind /> Anemometer</dt><dd>{windSpeed.toFixed(1)} <small>km/h</small></dd></div>
      <div><dt><Sun /> BH1750</dt><dd>{luxFormat.format(lux)} <small>lx</small></dd></div>
      <div className="climate"><dt><Thermometer /> DHT22</dt><dd><span>In <b>{indoor.toFixed(1)}°C</b> · {Math.round(indoorHumidity)}% RH</span><span>Out <b>{outdoor.toFixed(1)}°C</b> · {Math.round(outdoorHumidity)}% RH</span></dd></div>
      <div><dt><Cpu /> Arduino Uno R3</dt><dd>{command.label}</dd></div>
      <div><dt><Gauge /> MG996R</dt><dd>{Math.round(position)}% <small>open</small></dd></div>
    </dl>
  </section>;
}

function App() {
  const [settings, setSettings] = useState(initialSettings);
  const [telemetry, setTelemetry] = useState(initialTelemetry);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [sensorsOpen, setSensorsOpen] = useState(false);
  const [sceneError, setSceneError] = useState('');
  const sceneHost = useRef(null);
  const sceneState = useRef(initialSettings);
  const sensorToggle = useRef(null);
  sceneState.current = settings;

  useEffect(() => {
    try {
      return mountScene(sceneHost.current, sceneState, setTelemetry);
    } catch (error) {
      console.error(error);
      setSceneError('The 3D scene could not load on this device.');
    }
  }, []);

  useEffect(() => {
    const close = event => {
      if (event.key === 'Escape') {
        setControlsOpen(false);
        setSensorsOpen(false);
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);

  const patch = (key, value) => setSettings(current => ({ ...current, [key]: value }));
  const WeatherIcon = icons[telemetry.kind];
  const intensityLabel = settings.preset === 'auto' ? 'Weather intensity' :
    settings.preset === 'sun' ? 'Sunlight intensity' :
    settings.preset === 'windy' ? 'Wind strength' :
    settings.preset === 'cloud' ? 'Cloud density' : 'Rainfall intensity';

  function restartWeather() {
    setSettings(current => ({ ...current, preset: 'auto', running: true, resetToken: current.resetToken + 1 }));
  }

  return <main className="experience" aria-label="Atmos Smart Weather-Adaptive Window simulator">
    <div className="scene" ref={sceneHost} tabIndex={0}
      aria-label="3D living room. Drag or use the arrow keys to look around. Press Home to recenter." />
    {sceneError && <p className="scene-error" role="alert">{sceneError}</p>}
    {sensorsOpen && <SensorOverlay telemetry={telemetry} close={() => { setSensorsOpen(false); sensorToggle.current?.focus(); }} />}
    <aside className="glass console" aria-label="Simulation controls">
      <div className="console-bar">
        <button className="weather-trigger" type="button" onClick={() => setControlsOpen(value => !value)}
          aria-expanded={controlsOpen} aria-controls="weather-controls" aria-label="Weather controls">
          <span className="weather-icon"><WeatherIcon size={20} strokeWidth={1.7} /></span>
          <span className="weather-name"><strong>{weather[telemetry.kind].label}</strong><small>{settings.running ? (settings.preset === 'auto' ? 'Auto sequence' : 'Weather preset') : 'Paused'}</small></span>
          {controlsOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
        <button className="icon-button sensor-toggle" type="button" ref={sensorToggle} title="Live sensors"
          aria-label="Live sensors" aria-expanded={sensorsOpen} aria-controls="sensor-overlay" onClick={() => setSensorsOpen(value => !value)}>
          <Activity size={17} />
        </button>
      </div>
      {controlsOpen && <div className="console-body" id="weather-controls">
        <div className="control-title"><SlidersHorizontal size={14} /> <h2>Weather</h2></div>
        <div className="presets" role="group" aria-label="Weather presets">
          {[['auto', { label: 'Auto sequence' }], ...Object.entries(weather)].map(([key, option]) => {
            const Icon = icons[key];
            return <button type="button" key={key} aria-label={key === 'auto' ? 'Auto Weather Sequence' : undefined} aria-pressed={settings.preset === key} onClick={() => patch('preset', key)}>
              <Icon size={14} /> {option.label}
            </button>;
          })}
        </div>
        <label className="intensity">
          <span>{intensityLabel}<output>{settings.intensity}%</output></span>
          <input type="range" min="0" max="100" value={settings.intensity} aria-label={intensityLabel}
            onChange={event => patch('intensity', Number(event.target.value))} />
        </label>
        <div className="speed">
          <h3>Simulation speed</h3>
          <div className="speed-buttons" role="group" aria-label="Simulation speed">
            {speeds.map(value => <button key={value} type="button" aria-pressed={settings.speed === value} onClick={() => patch('speed', value)}>{value}×</button>)}
          </div>
        </div>
        <div className="playback">
          <button type="button" onClick={() => patch('running', !settings.running)}>{settings.running ? <Pause size={15} /> : <Play size={15} />} {settings.running ? 'Pause' : 'Resume'}</button>
          <button type="button" onClick={restartWeather}><RotateCcw size={15} /> Restart sequence</button>
        </div>
      </div>}
    </aside>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
