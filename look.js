const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));

export function attachLookControls(host) {
  const yawLimit = .27;
  const pitchLimit = .16;
  let targetYaw = 0, targetPitch = 0, yaw = 0, pitch = 0;
  let pointer = null, lastX = 0, lastY = 0;
  const held = new Set();
  const supported = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home']);

  function start(event) {
    if (!event.isPrimary || event.button !== 0 || pointer !== null) return;
    pointer = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    host.focus({ preventScroll: true });
    host.setPointerCapture(pointer);
    host.classList.add('looking');
  }

  function move(event) {
    if (event.pointerId !== pointer) return;
    targetYaw = clamp(targetYaw + (event.clientX - lastX) * .0022, yawLimit);
    targetPitch = clamp(targetPitch + (event.clientY - lastY) * .0022, pitchLimit);
    lastX = event.clientX;
    lastY = event.clientY;
  }

  function end(event) {
    if (event.pointerId !== pointer) return;
    pointer = null;
    host.classList.remove('looking');
  }

  function reset() {
    targetYaw = 0;
    targetPitch = 0;
  }

  function keydown(event) {
    if (!supported.has(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') reset();
    else held.add(event.key);
  }

  function keyup(event) {
    held.delete(event.key);
  }

  const blur = () => held.clear();
  const events = {
    pointerdown: start, pointermove: move, pointerup: end, pointercancel: end, lostpointercapture: end,
    keydown, keyup, blur, dblclick: reset,
  };
  for (const [name, listener] of Object.entries(events)) host.addEventListener(name, listener);

  return {
    update(dt) {
      const dx = Number(held.has('ArrowLeft')) - Number(held.has('ArrowRight'));
      const dy = Number(held.has('ArrowUp')) - Number(held.has('ArrowDown'));
      targetYaw = clamp(targetYaw + dx * dt * .54, yawLimit);
      targetPitch = clamp(targetPitch + dy * dt * .44, pitchLimit);
      const damping = 1 - Math.exp(-13 * dt);
      yaw += (targetYaw - yaw) * damping;
      pitch += (targetPitch - pitch) * damping;
      return { yaw, pitch };
    },
    remove() {
      for (const [name, listener] of Object.entries(events)) host.removeEventListener(name, listener);
      if (pointer !== null && host.hasPointerCapture(pointer)) host.releasePointerCapture(pointer);
    },
  };
}
