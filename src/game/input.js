// Entrada: teclado + mouse (pointer lock) e controles de toque (joystick virtual, câmera e botões).
export class Input {
  constructor(canvas, ui) {
    this.canvas = canvas; this.keys = new Set(); this.pressed = new Set(); this.mouse = { dx: 0, dy: 0, wheel: 0, left: false, right: false, leftPressed: false };
    this.move = [0, 0]; this.touchActive = false; this.clickUse = true; this.enabled = true; this.sens = 1; this.invertY = false;
    this.touch = { joyId: null, joyOrigin: [0, 0], joyVec: [0, 0], camId: null, camLast: [0, 0], buttons: new Set(), btnPressed: new Set() };
    window.addEventListener('keydown', (e) => {
      if (e.repeat) { if (['Tab', 'Space'].includes(e.code)) e.preventDefault(); return; }
      this.keys.add(e.code); this.pressed.add(e.code);
      if (['Tab', 'Space', 'ControlLeft', 'ControlRight', 'AltLeft'].includes(e.code) || (e.ctrlKey && ['KeyW', 'KeyS', 'KeyD', 'KeyA'].includes(e.code))) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked && !this.touchActive && this.wantLock) { this.requestLock(); }
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; } if (e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.left = false; if (e.button === 2) this.mouse.right = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => { if (this.locked || this.dragCam) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; } });
    canvas.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; if (!this.locked && this.onUnlock) this.onUnlock(); });
    // Sem pointer lock (iframe restrito): arrastar com o botão direito/esquerdo gira a câmera
    canvas.addEventListener('mousedown', () => { if (!this.locked && !this.touchActive) this.dragCam = true; });
    window.addEventListener('mouseup', () => { this.dragCam = false; });
    this._initTouch(ui);
  }
  requestLock() {
    try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* fallback: arrastar */ }
  }
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }
  _initTouch(ui) {
    const zone = ui.touchZone, joy = ui.joy, knob = ui.joyKnob; const T = this.touch;
    const start = (e) => {
      this.touchActive = true; document.body.classList.add('touch');
      for (const t of e.changedTouches) {
        if (t.target.closest && t.target.closest('.tbtn')) continue;
        if (t.clientX < window.innerWidth * 0.42 && T.joyId === null) {
          T.joyId = t.identifier; T.joyOrigin = [t.clientX, t.clientY]; T.joyVec = [0, 0];
          joy.style.left = t.clientX - 60 + 'px'; joy.style.top = t.clientY - 60 + 'px'; joy.classList.add('active'); knob.style.transform = 'translate(0px,0px)';
        } else if (T.camId === null) { T.camId = t.identifier; T.camLast = [t.clientX, t.clientY]; }
      }
      e.preventDefault();
    };
    const move = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === T.joyId) { let dx = t.clientX - T.joyOrigin[0], dy = t.clientY - T.joyOrigin[1]; const l = Math.hypot(dx, dy), m = 55; if (l > m) { dx *= m / l; dy *= m / l; }
          T.joyVec = [dx / m, dy / m]; knob.style.transform = `translate(${dx}px,${dy}px)`; }
        else if (t.identifier === T.camId) { this.mouse.dx += (t.clientX - T.camLast[0]) * 1.3; this.mouse.dy += (t.clientY - T.camLast[1]) * 1.3; T.camLast = [t.clientX, t.clientY]; }
      }
      e.preventDefault();
    };
    const end = (e) => { for (const t of e.changedTouches) { if (t.identifier === T.joyId) { T.joyId = null; T.joyVec = [0, 0]; joy.classList.remove('active'); knob.style.transform = 'translate(0px,0px)'; } if (t.identifier === T.camId) T.camId = null; } };
    zone.addEventListener('touchstart', start, { passive: false }); zone.addEventListener('touchmove', move, { passive: false });
    zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);
    for (const b of ui.touchButtons) {
      const act = b.dataset.act;
      b.addEventListener('touchstart', (e) => { this.touchActive = true; document.body.classList.add('touch'); T.buttons.add(act); T.btnPressed.add(act); b.classList.add('down'); e.preventDefault(); e.stopPropagation(); }, { passive: false });
      const up = (e) => { T.buttons.delete(act); b.classList.remove('down'); e.preventDefault(); };
      b.addEventListener('touchend', up); b.addEventListener('touchcancel', up);
      // permite testar os botões com mouse também
      b.addEventListener('mousedown', (e) => { T.buttons.add(act); T.btnPressed.add(act); e.stopPropagation(); });
      b.addEventListener('mouseup', () => T.buttons.delete(act));
    }
  }
  down(code) { return this.enabled && this.keys.has(code); }
  hit(code) { return this.enabled && this.pressed.has(code); }
  btn(a) { return this.enabled && this.touch.buttons.has(a); }
  btnHit(a) { return this.enabled && this.touch.btnPressed.has(a); }
  // Estado consolidado de ações para o frame
  actions() {
    const k = (c) => this.down(c), h = (c) => this.hit(c);
    let mx = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
    let mz = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
    let analog = 1;
    if (this.touch.joyId !== null && this.enabled) { mx = this.touch.joyVec[0]; mz = -this.touch.joyVec[1]; analog = Math.min(1, Math.hypot(mx, mz)); }
    else { const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; } }
    return {
      mx, mz, analog,
      sprint: k('ShiftLeft') || k('ShiftRight') || this.btn('sprint'),
      walk: k('AltLeft') || k('CapsLock'),
      jump: h('Space') || this.btnHit('jump'),
      crouch: h('KeyC') || this.btnHit('crouch'), // agachar só no C (Ctrl ficou livre)
      interact: h('KeyE') || this.btnHit('interact'),
      use: h('KeyF') || (this.enabled && this.mouse.leftPressed && (this.locked || this.touchActive || this.clickUse)) || this.btnHit('attack'),
      useHeld: k('KeyF') || (this.enabled && this.mouse.left && (this.locked || this.clickUse)) || this.btn('attack'),
      pin: h('KeyF'), throwHeld: (this.enabled && this.mouse.left && (this.locked || this.clickUse)) || this.btn('attack'), touchUse: this.touchActive && this.btnHit('attack'),
      block: (this.enabled && this.mouse.right) || this.btn('block'), shoulder: h('KeyQ') || this.btnHit('shoulder'),
      inventory: h('Tab') || this.btnHit('inventory'), map: h('KeyM') || this.btnHit('map'), equipment: h('KeyI'), nvg: h('KeyN'), build: h('KeyB') || this.btnHit('build'),
      pause: h('Escape') || h('KeyP') || this.btnHit('pause'), rotate: h('KeyR') || this.btnHit('rotate'), reload: h('KeyR') || this.btnHit('reload'), demolish: h('KeyX'), ammoNext: h('KeyT'),
      slot: [1, 2, 3, 4, 5, 6, 7, 8].find((n) => h('Digit' + n)) || 0, unequip: h('Digit0') || h('KeyH'),
      cancel: h('Escape') || (this.enabled && this.mouse.rightPressed) || this.btnHit('cancel'),
    };
  }
  endFrame() { this.pressed.clear(); this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0; this.mouse.leftPressed = false; this.mouse.rightPressed = false; this.touch.btnPressed.clear(); }
}
