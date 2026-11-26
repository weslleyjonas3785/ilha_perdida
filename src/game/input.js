// Entrada: teclado + mouse (pointer lock) e controles de toque (joystick virtual, câmera e botões).
export class Input {
  constructor(canvas, ui) {
    this.canvas = canvas; this.keys = new Set(); this.pressed = new Set(); this.mouse = { dx: 0, dy: 0, wheel: 0, left: false, right: false, leftPressed: false };
    this.move = [0, 0]; this.touchActive = false; this.clickUse = true; this.enabled = true; this.sens = 1; this.invertY = false;
    this.touch = { joyId: null, joyOrigin: [0, 0], joyVec: [0, 0], camId: null, camLast: [0, 0], buttons: new Set(), btnPressed: new Set() };
    window.addEventListener('keydown', (e) => {
      if (e.repeat) { if (['Tab', 'Space'].includes(e.code)) e.preventDefault(); return; }
      this.keys.add(e.code); this.pressed.add(e.code); if (e.code === 'CapsLock') this._capsT = performance.now();
      // qualquer tecla (menos Esc) também trava o mouse de novo: a setinha só volta com Esc
      if (e.code !== 'Escape' && !this.touchActive && !this.mobile && this.wantLock && !document.pointerLockElement && (!this.canLock || this.canLock()) && (!this._relockT || performance.now() - this._relockT > 1200)) { this._relockT = performance.now(); this.requestLock(true); }
      if (['Tab', 'Space', 'ControlLeft', 'ControlRight', 'AltLeft'].includes(e.code) || (e.ctrlKey && ['KeyW', 'KeyS', 'KeyD', 'KeyA'].includes(e.code))) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); if (e.code === 'CapsLock' && performance.now() - (this._capsT || 0) > 900) this.pressed.add('CapsLock'); }); // Mac: desligar o Caps Lock só manda keyup
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });
    canvas.addEventListener('mousedown', (e) => {
      // sempre tenta travar o mouse de verdade (o navegador recusa logo depois do Esc; aí entra no mouse livre e tenta de novo no próximo clique)
      if ((!this.locked || this.free) && !this.touchActive && !this.mobile && this.wantLock) { if (this.free) { if (!this._relockT || performance.now() - this._relockT > 1200) { this._relockT = performance.now(); this.requestLock(true); } } else this.requestLock(); }
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; } if (e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; } if (e.button === 1) { this.mouse.midPressed = true; e.preventDefault(); }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.left = false; if (e.button === 2) this.mouse.right = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // soma o movimento de todos os eventos do quadro; ignora só os saltos falsos do navegador (um evento isolado enorme ao travar/destravar)
    window.addEventListener('mousemove', (e) => { this._cx = e.clientX; this._cy = e.clientY; if (this.free && this.wantLock && !this.mobile && (!this._relockT || performance.now() - this._relockT > 1500) && navigator.userActivation && navigator.userActivation.isActive && (!this.canLock || this.canLock())) { this._relockT = performance.now(); this.requestLock(true); } if (!(this.locked || this.dragCam || this.free)) return; const mx = e.movementX || 0, my = e.movementY || 0; if ((performance.now() - (this._lockT || 0) < 160 && (Math.abs(mx) > 250 || Math.abs(my) > 250)) || Math.abs(mx) > 2500 || Math.abs(my) > 2500) return; this.mouse.dx += mx; this.mouse.dy += my; });
    canvas.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    document.addEventListener('pointerlockchange', () => { const L = document.pointerLockElement === canvas; this._lockT = performance.now(); if (L) { this._rlN = 0; clearTimeout(this._rlT); this.free = false; this.noLock = false; this.canvas.style.cursor = ''; this.locked = true; return; } if (this.free) return; this.locked = false; if (this.onUnlock) this.onUnlock(); });
    // Sem pointer lock (iframe restrito): arrastar com o botão direito/esquerdo gira a câmera
    canvas.addEventListener('mousedown', () => { if (!this.locked && !this.touchActive) this.dragCam = true; });
    window.addEventListener('mouseup', () => { this.dragCam = false; });
    this._initTouch(ui);
  }
  // trava o mouse no jogo (a setinha some e o mouse gira a câmera). Se o navegador/site não deixar (alguns sites
  // abrem o jogo numa moldura restrita), entra no modo "mouse livre": a setinha some do mesmo jeito e o movimento
  // do mouse gira a câmera; Esc solta.
  requestLock(quiet) {
    const fail = () => { if (document.pointerLockElement === this.canvas) return; this._schedRelock(); if (quiet) return; if (this.locked && !this.free) return; this.noLock = true; this._freeOn(); };
    try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(fail); } catch (e) { fail(); return; }
    if (!this._plErr) { this._plErr = true; document.addEventListener('pointerlockerror', fail); }
    clearTimeout(this._plT); this._plT = setTimeout(() => { if (!this.locked && !document.pointerLockElement && this.wantLock) fail(); }, 700);
  }
  // o navegador recusa travar de novo logo depois de soltar (Esc/painel): tenta outra vez sozinho em ~1,2 s,
  // enquanto ainda vale o último clique/tecla (ativação do usuário) — assim o mouse volta a girar a câmera sem limite
  _schedRelock() { clearTimeout(this._rlT); if ((this._rlN = (this._rlN || 0) + 1) > 6) return; this._rlT = setTimeout(() => { if (document.pointerLockElement === this.canvas || !this.wantLock || this.touchActive || this.mobile) return; if (this.canLock && !this.canLock()) return; const ua = navigator.userActivation; if (ua && !ua.isActive) return; this._relockT = performance.now(); this.requestLock(true); }, 1200); }
  _freeOn() { if (this.touchActive || !this.wantLock) return; this.free = true; this.locked = true; this.canvas.style.cursor = 'none';
    if (this.noLock && !this._freeWarned) { this._freeWarned = true; const g = window.__game; if (g && g.ui) g.ui.toast('🖱️ Esta página não deixou travar o mouse — o giro para na borda da tela. Clique no jogo de novo para travar, ou abra o arquivo direto no navegador para girar 360°.', 'warn'); } }
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); if (this.free) { this.free = false; this.locked = false; this.canvas.style.cursor = ''; if (this.onUnlock) this.onUnlock(); } }
  _initTouch(ui) {
    const zone = ui.touchZone, joy = ui.joy, knob = ui.joyKnob; const T = this.touch;
    let move = null; const start = (e) => {
      this.touchActive = true; document.body.classList.add('touch');
      for (const t of e.changedTouches) {
        if (t.target.closest && t.target.closest('.tbtn')) continue;
        const jr = this.mobile && joy.getBoundingClientRect(); const inJoy = jr && Math.hypot(t.clientX - (jr.left + jr.width / 2), t.clientY - (jr.top + jr.height / 2)) < jr.width * 0.85;
        if (this.mobile && inJoy && T.joyId === null) { // celular: joystick fixo (posição configurável)
          T.joyId = t.identifier; T.joyOrigin = [jr.left + jr.width / 2, jr.top + jr.height / 2]; T.joyR = jr.width * 0.42; T.autoRun = false; T.runLock = false; joy.classList.add('active'); move({ changedTouches: [t], preventDefault() {} });
        } else if (!this.mobile && t.clientX < window.innerWidth * 0.42 && T.joyId === null) {
          T.joyId = t.identifier; T.joyOrigin = [t.clientX, t.clientY]; T.joyVec = [0, 0]; T.joyR = 55;
          joy.style.left = t.clientX - 60 + 'px'; joy.style.top = t.clientY - 60 + 'px'; joy.classList.add('active'); knob.style.transform = 'translate(0px,0px)';
        } else if (T.camId === null) { T.camId = t.identifier; T.camLast = [t.clientX, t.clientY]; }
      }
      e.preventDefault();
    };
    move = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === T.joyId) { let dx = t.clientX - T.joyOrigin[0], dy = t.clientY - T.joyOrigin[1]; const l = Math.hypot(dx, dy), m = T.joyR || 55;
          // celular: puxar a bola para cima e arrastar além do círculo trava a corrida (o personagem segue correndo ao soltar)
          if (this.mobile) { const up = -dy / m, side = Math.abs(dx) / m; T.runNear = up > 1.05 && side < 0.8; T.runLock = up > 1.7 && side < 0.9; }
          if (l > m) { dx *= m / l; dy *= m / l; }
          T.joyVec = [dx / m, dy / m]; const k = this.mobile ? 1 / (parseFloat(joy.dataset.sc) || 1) : 1; knob.style.transform = `translate(${dx * k}px,${dy * k}px)`; }
        else if (t.identifier === T.camId) { this.mouse.dx += (t.clientX - T.camLast[0]) * 1.3; this.mouse.dy += (t.clientY - T.camLast[1]) * 1.3; T.camLast = [t.clientX, t.clientY]; }
      }
      e.preventDefault();
    };
    const end = (e) => { for (const t of e.changedTouches) { if (t.identifier === T.joyId) { T.joyId = null; T.joyVec = [0, 0]; T.sprintOn = false; T.autoRun = !!T.runLock; T.runNear = false; joy.classList.remove('active'); knob.style.transform = 'translate(0px,0px)'; } if (t.identifier === T.camId) T.camId = null; } };
    joy.addEventListener('touchstart', (e) => { if (this.mobile) { start(e); e.stopPropagation(); } }, { passive: false }); joy.addEventListener('touchmove', (e) => { if (this.mobile) move(e); }, { passive: false }); joy.addEventListener('touchend', (e) => end(e)); joy.addEventListener('touchcancel', (e) => end(e));
    zone.addEventListener('touchstart', start, { passive: false }); zone.addEventListener('touchmove', move, { passive: false });
    zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);
    for (const b of ui.touchButtons) {
      // no celular, com arma na mão o botão USAR vira ATIRAR (bala)
      const cur = () => (b.dataset.act === 'interact' && document.body.classList.contains('gunUse') ? 'attack' : b.dataset.act);
      const press = () => { const act = cur(); b._act = act; T.buttons.add(act); T.btnPressed.add(act); if (act === 'sprint') T.sprintOn = !T.sprintOn; };
      b.addEventListener('touchstart', (e) => { this.touchActive = true; document.body.classList.add('touch'); press(); b.classList.add('down'); e.preventDefault(); e.stopPropagation(); }, { passive: false });
      const up = (e) => { T.buttons.delete(b._act || cur()); b.classList.remove('down'); e.preventDefault(); };
      b.addEventListener('touchend', up); b.addEventListener('touchcancel', up);
      // permite testar os botões com mouse também
      b.addEventListener('mousedown', (e) => { press(); e.stopPropagation(); });
      b.addEventListener('mouseup', () => T.buttons.delete(b._act || cur()));
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
    const runLocked = this.enabled && (this.touch.autoRun || (this.touch.joyId !== null && this.touch.runLock));
    if (this.touch.autoRun && this.touch.joyId === null && this.enabled) { mx = 0; mz = 1; analog = 1; } // corrida travada
    else if (this.touch.joyId !== null && this.enabled) { mx = this.touch.joyVec[0]; mz = -this.touch.joyVec[1]; analog = Math.min(1, Math.hypot(mx, mz)); }
    else { const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; } }
    return {
      mx, mz, analog,
      sprint: k('ShiftLeft') || k('ShiftRight') || (this.enabled && !!this.touch.sprintOn && this.touch.joyId !== null) || runLocked,
      walk: k('AltLeft'), mic: h('CapsLock') || this.btnHit('mic'),
      jump: h('Space') || this.btnHit('jump'),
      crouch: h('KeyC') || this.btnHit('crouch'), slide: this.btnHit('slide'), // agachar só no C (Ctrl ficou livre)
      interact: h('KeyE') || this.btnHit('interact'),
      use: h('KeyF') || (this.enabled && this.mouse.leftPressed && (this.locked || this.touchActive || this.clickUse)) || this.btnHit('attack'),
      useHeld: k('KeyF') || (this.enabled && this.mouse.left && (this.locked || this.clickUse)) || this.btn('attack'),
      pin: h('KeyF') || this.btnHit('pin'), throwHeld: (this.enabled && this.mouse.left && (this.locked || this.clickUse)) || this.btn('attack'), touchUse: this.touchActive && this.btnHit('attack'),
      block: (this.enabled && this.mouse.right) || this.btn('block'), shoulder: h('KeyQ') || this.btnHit('shoulder'),
      inventory: h('Tab') || this.btnHit('inventory'), map: h('KeyM') || this.btnHit('map'), equipment: h('KeyI'), nvg: h('KeyN'), build: h('KeyB') || this.btnHit('build'),
      pause: h('Escape') || h('KeyP') || this.btnHit('pause'), rotate: h('KeyR') || this.btnHit('rotate'), reload: h('KeyR') || this.btnHit('reload'), demolish: h('KeyX'), ammoNext: h('KeyT'),
      slot: [1, 2, 3, 4, 5, 6, 7, 8].find((n) => h('Digit' + n)) || 0, unequip: h('Digit0') || h('KeyH') || this.btnHit('unequip'),
      ping: (this.enabled && this.mouse.midPressed) || this.btnHit('ping'),
      cancel: h('Escape') || (this.enabled && this.mouse.rightPressed) || this.btnHit('cancel'),
    };
  }
  endFrame() { this.pressed.clear(); this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0; this.mouse.leftPressed = false; this.mouse.rightPressed = false; this.mouse.midPressed = false; this.touch.btnPressed.clear(); }
}
