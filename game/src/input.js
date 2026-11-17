// Keyboard and mouse input: pointer lock for looking, a key set for movement,
// and an action queue the sim drains once per step. Pointer lock needs a user
// gesture, so the game asks for it from the start click, never on load.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RELOAD = 4;
export const ACTION_GRENADE = 8;
export const ACTION_BUY = 16;
export const ACTION_MUTE = 32;
export const ACTION_SWITCH_1 = 64;
export const ACTION_SWITCH_2 = 128;
export const ACTION_SWITCH_3 = 256;
export const ACTION_BUY_GRENADE = 512;
export const ACTION_BUY_ARMOUR = 1024;

export function createInput(canvas) {
  const keys = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let actions = 0;
  let mouseDown = false;
  let locked = false;

  function keyName(event) {
    return event.code;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(keyName(event));
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyR') actions |= ACTION_RELOAD;
    if (event.code === 'KeyG') actions |= ACTION_GRENADE;
    if (event.code === 'KeyB') actions |= ACTION_BUY;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
    if (event.code === 'Digit1') actions |= ACTION_SWITCH_1;
    if (event.code === 'Digit2') actions |= ACTION_SWITCH_2;
    if (event.code === 'Digit3') actions |= ACTION_SWITCH_3;
    if (event.code === 'Digit4') actions |= ACTION_BUY_GRENADE;
    if (event.code === 'Digit5') actions |= ACTION_BUY_ARMOUR;
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(keyName(event));
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (!locked) mouseDown = false;
  });
  document.addEventListener('mousemove', (event) => {
    if (!locked) return;
    mouseDX += event.movementX || 0;
    mouseDY += event.movementY || 0;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) mouseDown = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
  });
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });

  return {
    get locked() {
      return locked;
    },
    lock() {
      try {
        canvas.requestPointerLock();
      } catch {
        // Pointer lock can fail if the tab just left it; the next click retries.
      }
    },
    unlock() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
    // WASD / arrows as a -1..1 pair; Shift slows, Ctrl or C crouches.
    move() {
      let x = 0;
      let z = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      const len = Math.hypot(x, z);
      if (len > 1) {
        x /= len;
        z /= len;
      }
      return { x, z };
    },
    get slow() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    get crouch() {
      return keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
    },
    get jump() {
      return keys.has('Space');
    },
    get plantHeld() {
      return keys.has('KeyE');
    },
    get firing() {
      return mouseDown;
    },
    takeMouse() {
      const out = { dx: mouseDX, dy: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return out;
    },
    takeActions() {
      const out = actions;
      actions = 0;
      return out;
    },
    // Overlay clicks (title, pause, match end) confirm through the same queue
    // the sim drains, so a click starts the game exactly like Space does.
    queueConfirm() {
      actions |= ACTION_CONFIRM;
    },
  };
}
