(function (global) {
  'use strict';

  var BUTTONS = ['up', 'down', 'left', 'right', 'a', 'b'];

  function makeState() {
    return { up: false, down: false, left: false, right: false, a: false, b: false };
  }

  var sources = {
    keyboard: makeState(),
    gamepad:  makeState(),
    touch:    makeState(),
    tilt:     makeState(),
  };

  function merge() {
    for (var i = 0; i < BUTTONS.length; i++) {
      var btn = BUTTONS[i];
      GamePlate.input[btn] =
        sources.keyboard[btn] || sources.gamepad[btn] ||
        sources.touch[btn]    || sources.tilt[btn];
    }
  }

  // ─── Fullscreen ──────────────────────────────────────────────────────────────

  function setupFullscreen() {
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      var meta = document.createElement('meta');
      meta.name = 'apple-mobile-web-app-capable';
      meta.content = 'yes';
      document.head.appendChild(meta);
    }

    var style = document.createElement('style');
    style.textContent = [
      'html,body{',
        'margin:0;padding:0;',
        'width:100vw;height:100dvh;',
        'overflow:hidden;',
        'touch-action:none;',
        '-webkit-user-select:none;user-select:none;',
      '}'
    ].join('');
    document.head.appendChild(style);

    // Attempt real fullscreen on first user gesture (Android Chrome / desktop)
    document.addEventListener('pointerdown', function () {
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(function () {});
      }
    }, { once: true });
  }

  // ─── Orientation ─────────────────────────────────────────────────────────────

  function setupOrientation(orientation) {
    if (orientation === 'auto') return;
    var lockValue = orientation === 'landscape' ? 'landscape-primary'
                  : orientation === 'portrait'  ? 'portrait-primary'
                  : orientation;
    document.addEventListener('pointerdown', function () {
      try { screen.orientation.lock(lockValue).catch(function () {}); } catch (e) {}
    }, { once: true });
  }

  // ─── Keyboard ────────────────────────────────────────────────────────────────

  function setupKeyboard() {
    var map = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      z: 'a', Z: 'a', x: 'b', X: 'b'
    };
    document.addEventListener('keydown', function (e) {
      var btn = map[e.key];
      if (btn) { sources.keyboard[btn] = true; merge(); }
    });
    document.addEventListener('keyup', function (e) {
      var btn = map[e.key];
      if (btn) { sources.keyboard[btn] = false; merge(); }
    });
  }

  // ─── Gamepad ─────────────────────────────────────────────────────────────────

  function setupGamepad() {
    var DEADZONE = 0.3;

    function poll() {
      var gps = navigator.getGamepads ? navigator.getGamepads() : [];
      var s = sources.gamepad;
      for (var k = 0; k < BUTTONS.length; k++) s[BUTTONS[k]] = false;

      for (var i = 0; i < gps.length; i++) {
        var gp = gps[i];
        if (!gp) continue;
        s.up    = s.up    || !!(gp.buttons[12] && gp.buttons[12].pressed) || gp.axes[1] < -DEADZONE;
        s.down  = s.down  || !!(gp.buttons[13] && gp.buttons[13].pressed) || gp.axes[1] >  DEADZONE;
        s.left  = s.left  || !!(gp.buttons[14] && gp.buttons[14].pressed) || gp.axes[0] < -DEADZONE;
        s.right = s.right || !!(gp.buttons[15] && gp.buttons[15].pressed) || gp.axes[0] >  DEADZONE;
        s.a     = s.a     || !!(gp.buttons[0]  && gp.buttons[0].pressed);
        s.b     = s.b     || !!(gp.buttons[1]  && gp.buttons[1].pressed);
      }
      merge();
      requestAnimationFrame(poll);
    }
    poll();
  }

  // ─── Tilt ────────────────────────────────────────────────────────────────────

  function setupTilt() {
    function start() {
      var THRESHOLD = 15;
      window.addEventListener('deviceorientation', function (e) {
        var s = sources.tilt;
        var type = screen.orientation ? screen.orientation.type : '';
        if (type === 'landscape-primary') {
          s.left  = e.beta  < -THRESHOLD;
          s.right = e.beta  >  THRESHOLD;
          s.up    = e.gamma >  THRESHOLD;
          s.down  = e.gamma < -THRESHOLD;
        } else if (type === 'landscape-secondary') {
          s.left  = e.beta  >  THRESHOLD;
          s.right = e.beta  < -THRESHOLD;
          s.up    = e.gamma < -THRESHOLD;
          s.down  = e.gamma >  THRESHOLD;
        } else {
          s.left  = e.gamma < -THRESHOLD;
          s.right = e.gamma >  THRESHOLD;
          s.up    = e.beta  < -THRESHOLD;
          s.down  = e.beta  >  THRESHOLD;
        }
        merge();
      });
    }

    // iOS 13+ requires a permission request triggered by a user gesture
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function') {
      document.addEventListener('pointerdown', function () {
        DeviceMotionEvent.requestPermission().then(function (result) {
          if (result === 'granted') start();
        }).catch(function () {});
      }, { once: true });
    } else {
      start();
    }
  }

  // ─── Virtual NES Controller ───────────────────────────────────────────────────

  function setupVirtualController() {
    var style = document.createElement('style');
    style.textContent = [
      '#gp-overlay{',
        'position:fixed;bottom:0;left:0;right:0;height:200px;',
        'display:flex;align-items:center;justify-content:space-between;',
        'padding:0 32px 20px;box-sizing:border-box;',
        'pointer-events:none;z-index:9999;',
        '-webkit-user-select:none;user-select:none;',
      '}',
      '#gp-dpad{',
        'width:152px;height:152px;position:relative;',
        'pointer-events:all;touch-action:none;',
      '}',
      '.gp-arm{',
        'position:absolute;',
        'background:rgba(255,255,255,0.12);',
        'border:2px solid rgba(255,255,255,0.25);',
        'border-radius:6px;box-sizing:border-box;',
      '}',
      '.gp-arm-h{left:0;top:33.33%;width:100%;height:33.34%;}',
      '.gp-arm-v{top:0;left:33.33%;width:33.34%;height:100%;}',
      '.gp-arm-center{',
        'position:absolute;left:33.33%;top:33.33%;',
        'width:33.34%;height:33.34%;',
        'background:rgba(255,255,255,0.18);border-radius:4px;',
      '}',
      '.gp-arrow{',
        'position:absolute;width:0;height:0;',
        'border:9px solid transparent;pointer-events:none;',
        'transition:opacity 0.05s;',
      '}',
      '.gp-arrow.up{border-bottom-color:rgba(255,255,255,0.45);top:7px;left:50%;transform:translateX(-50%);}',
      '.gp-arrow.down{border-top-color:rgba(255,255,255,0.45);bottom:7px;left:50%;transform:translateX(-50%);}',
      '.gp-arrow.left{border-right-color:rgba(255,255,255,0.45);left:7px;top:50%;transform:translateY(-50%);}',
      '.gp-arrow.right{border-left-color:rgba(255,255,255,0.45);right:7px;top:50%;transform:translateY(-50%);}',
      '.gp-arrow.lit.up{border-bottom-color:rgba(255,255,255,0.9);}',
      '.gp-arrow.lit.down{border-top-color:rgba(255,255,255,0.9);}',
      '.gp-arrow.lit.left{border-right-color:rgba(255,255,255,0.9);}',
      '.gp-arrow.lit.right{border-left-color:rgba(255,255,255,0.9);}',
      '#gp-buttons{',
        'display:flex;flex-direction:row;gap:16px;',
        'align-items:center;pointer-events:all;touch-action:none;',
      '}',
      '.gp-btn{',
        'width:68px;height:68px;border-radius:50%;',
        'border:2px solid rgba(255,255,255,0.3);',
        'display:flex;align-items:center;justify-content:center;',
        'font-family:sans-serif;font-size:20px;font-weight:bold;',
        'color:rgba(255,255,255,0.65);pointer-events:all;touch-action:none;',
        'transition:filter 0.05s,transform 0.05s;',
      '}',
      '.gp-btn-b{background:rgba(50,120,220,0.35);}',
      '.gp-btn-a{background:rgba(220,50,50,0.35);}',
      '.gp-btn.lit{filter:brightness(2);transform:scale(0.92);}',
    ].join('');
    document.head.appendChild(style);

    var overlay = document.createElement('div');
    overlay.id = 'gp-overlay';
    overlay.innerHTML = [
      '<div id="gp-dpad">',
        '<div class="gp-arm gp-arm-h"></div>',
        '<div class="gp-arm gp-arm-v"></div>',
        '<div class="gp-arm-center"></div>',
        '<div class="gp-arrow up" id="gp-arr-up"></div>',
        '<div class="gp-arrow down" id="gp-arr-down"></div>',
        '<div class="gp-arrow left" id="gp-arr-left"></div>',
        '<div class="gp-arrow right" id="gp-arr-right"></div>',
      '</div>',
      '<div id="gp-buttons">',
        '<div class="gp-btn gp-btn-b" id="gp-btn-b">B</div>',
        '<div class="gp-btn gp-btn-a" id="gp-btn-a">A</div>',
      '</div>',
    ].join('');

    function insert() { document.body.appendChild(overlay); }
    if (document.body) { insert(); }
    else { document.addEventListener('DOMContentLoaded', insert); }

    // ── D-pad ──
    var dpad = overlay.querySelector('#gp-dpad');
    var activeDpadTouches = new Map(); // identifier → string[]

    function dpadDirs(clientX, clientY) {
      var rect = dpad.getBoundingClientRect();
      var dx = clientX - (rect.left + rect.width  / 2);
      var dy = clientY - (rect.top  + rect.height / 2);
      var dead = rect.width * 0.1;
      if (Math.abs(dx) < dead && Math.abs(dy) < dead) return [];
      var a = Math.atan2(dy, dx) * 180 / Math.PI; // right=0, down=90, left=±180, up=-90
      if (a > -22.5  && a <=  22.5) return ['right'];
      if (a >  22.5  && a <=  67.5) return ['right', 'down'];
      if (a >  67.5  && a <= 112.5) return ['down'];
      if (a > 112.5  && a <= 157.5) return ['left', 'down'];
      if (a >  157.5 || a <= -157.5) return ['left'];
      if (a > -157.5 && a <= -112.5) return ['left', 'up'];
      if (a > -112.5 && a <=  -67.5) return ['up'];
      return ['right', 'up'];
    }

    function flushDpad() {
      sources.touch.up = sources.touch.down = sources.touch.left = sources.touch.right = false;
      activeDpadTouches.forEach(function (dirs) {
        dirs.forEach(function (d) { sources.touch[d] = true; });
      });
      merge();
      ['up','down','left','right'].forEach(function (d) {
        var el = overlay.querySelector('#gp-arr-' + d);
        if (el) el.classList.toggle('lit', !!sources.touch[d]);
      });
    }

    dpad.addEventListener('touchstart', function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        activeDpadTouches.set(t.identifier, dpadDirs(t.clientX, t.clientY));
      }
      flushDpad();
    }, { passive: false });

    dpad.addEventListener('touchmove', function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (activeDpadTouches.has(t.identifier)) {
          activeDpadTouches.set(t.identifier, dpadDirs(t.clientX, t.clientY));
        }
      }
      flushDpad();
    }, { passive: false });

    function dpadEnd(e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        activeDpadTouches.delete(e.changedTouches[i].identifier);
      }
      flushDpad();
    }
    dpad.addEventListener('touchend',    dpadEnd, { passive: false });
    dpad.addEventListener('touchcancel', dpadEnd, { passive: false });

    // ── A / B buttons ──
    var btnEls = {
      a: overlay.querySelector('#gp-btn-a'),
      b: overlay.querySelector('#gp-btn-b')
    };
    var activeBtnTouches = new Map(); // identifier → Set<'a'|'b'>
    var AB_HYSTERESIS_MS = 30;
    var buttonFlushRaf = 0;
    var buttonFlushTimer = 0;
    var stableButtons = { a: false, b: false };
    var dualTransitionTarget = null;
    var dualTransitionSince = 0;

    function getButtonAtPoint(x, y) {
      for (var name in btnEls) {
        var r = btnEls[name].getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return name;
      }
      return null;
    }

    function getButtonsAtTouch(t) {
      var result = new Set();
      var MIN_CONTACT = 20;
      var landscape = window.innerWidth > window.innerHeight;
      var eRX = Math.max(landscape ? (t.radiusY || 0) : (t.radiusX || 0), MIN_CONTACT);
      var eRY = Math.max(landscape ? (t.radiusX || 0) : (t.radiusY || 0), MIN_CONTACT);
      var cx  = t.clientX;
      var cy  = t.clientY;
      for (var name in btnEls) {
        var rect = btnEls[name].getBoundingClientRect();
        if (cx - eRX < rect.right  && cx + eRX > rect.left &&
            cy - eRY < rect.bottom && cy + eRY > rect.top) {
          result.add(name);
        }
      }
      return result;
    }

    function computePressedButtons() {
      var pressed = { a: false, b: false };
      activeBtnTouches.forEach(function (names) {
        names.forEach(function (n) { pressed[n] = true; });
      });
      return pressed;
    }

    function updateStableButtons(rawPressed, nowMs) {
      var rawBoth = rawPressed.a && rawPressed.b;
      var stableBoth = stableButtons.a && stableButtons.b;

      if (rawBoth !== stableBoth) {
        if (dualTransitionTarget !== rawBoth) {
          dualTransitionTarget = rawBoth;
          dualTransitionSince = nowMs;
        }
        if (nowMs - dualTransitionSince >= AB_HYSTERESIS_MS) {
          stableButtons.a = rawPressed.a;
          stableButtons.b = rawPressed.b;
          dualTransitionTarget = null;
          return 0;
        }
        return AB_HYSTERESIS_MS - (nowMs - dualTransitionSince);
      }

      // Keep single-button transitions responsive when not changing dual-press mode.
      dualTransitionTarget = null;
      stableButtons.a = rawPressed.a;
      stableButtons.b = rawPressed.b;
      return 0;
    }

    function flushButtons(nowMs) {
      var rawPressed = computePressedButtons();
      var pendingMs = updateStableButtons(rawPressed, nowMs || performance.now());

      for (var name in btnEls) {
        btnEls[name].classList.toggle('lit', stableButtons[name]);
      }

      var didChange =
        sources.touch.a !== stableButtons.a ||
        sources.touch.b !== stableButtons.b;
      if (!didChange) {
        if (pendingMs > 0) {
          scheduleButtonFlush(pendingMs);
        }
        return;
      }

      sources.touch.a = stableButtons.a;
      sources.touch.b = stableButtons.b;
      merge();

      if (pendingMs > 0) {
        scheduleButtonFlush(pendingMs);
      }
    }

    function scheduleButtonFlush(delayMs) {
      if (delayMs && delayMs > 0) {
        if (buttonFlushTimer) return;
        buttonFlushTimer = setTimeout(function () {
          buttonFlushTimer = 0;
          scheduleButtonFlush();
        }, Math.ceil(delayMs));
        return;
      }
      if (buttonFlushRaf) return;
      buttonFlushRaf = requestAnimationFrame(function (ts) {
        buttonFlushRaf = 0;
        flushButtons(ts);
      });
    }

    var btnsContainer = overlay.querySelector('#gp-buttons');

    btnsContainer.addEventListener('touchstart', function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        activeBtnTouches.set(t.identifier, getButtonsAtTouch(t));
      }
      scheduleButtonFlush();
    }, { passive: false });

    btnsContainer.addEventListener('touchmove', function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (!activeBtnTouches.has(t.identifier)) continue;
        activeBtnTouches.set(t.identifier, getButtonsAtTouch(t));
      }
      scheduleButtonFlush();
    }, { passive: false });

    function btnsEnd(e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        activeBtnTouches.delete(e.changedTouches[i].identifier);
      }
      scheduleButtonFlush();
    }
    btnsContainer.addEventListener('touchend',    btnsEnd, { passive: false });
    btnsContainer.addEventListener('touchcancel', btnsEnd, { passive: false });
  }

  // ─── Pause Menu ──────────────────────────────────────────────────────────────

  function setupPauseMenu(orientation) {
    var lockValue = orientation === 'landscape' ? 'landscape-primary'
                  : orientation === 'portrait'  ? 'portrait-primary'
                  : null;

    var style = document.createElement('style');
    style.textContent = [
      '#gp-menu-btn{',
        'display:none;position:fixed;top:14px;left:14px;',
        'width:44px;height:44px;border-radius:50%;',
        'background:rgba(0,0,0,0.45);',
        'border:2px solid rgba(255,255,255,0.25);',
        'color:rgba(255,255,255,0.8);font:22px/1 sans-serif;',
        'align-items:center;justify-content:center;',
        'cursor:pointer;z-index:10000;',
        '-webkit-user-select:none;user-select:none;',
      '}',
      '#gp-menu-btn.gp-active{display:flex;}',
      '#gp-pause-overlay{',
        'display:none;position:fixed;inset:0;z-index:20000;',
        'background:rgba(0,0,0,0.72);',
        'align-items:center;justify-content:center;',
      '}',
      '#gp-pause-overlay.gp-visible{display:flex;}',
      '#gp-pause-dialog{',
        'display:flex;flex-direction:column;align-items:center;',
        'gap:20px;padding:40px 48px;',
        'background:rgba(10,10,16,0.97);',
        'border:2px solid rgba(255,255,255,0.18);border-radius:12px;',
      '}',
      '#gp-pause-dialog h2{',
        'margin:0;font:700 28px/1 sans-serif;',
        'letter-spacing:0.08em;text-transform:uppercase;',
        'color:rgba(255,255,255,0.9);',
      '}',
      '.gp-pause-btn{',
        'padding:14px 40px;width:100%;box-sizing:border-box;',
        'font:600 16px/1 sans-serif;color:rgba(255,255,255,0.85);',
        'text-transform:uppercase;letter-spacing:0.07em;',
        'background:rgba(255,255,255,0.08);',
        'border:2px solid rgba(255,255,255,0.2);',
        'border-radius:8px;cursor:pointer;',
      '}',
      '.gp-pause-btn:hover{background:rgba(255,255,255,0.16);}',
    ].join('');
    document.head.appendChild(style);

    var menuBtn = document.createElement('button');
    menuBtn.id = 'gp-menu-btn';
    menuBtn.setAttribute('aria-label', 'Menu');
    menuBtn.innerHTML = '&#9776;';

    var pauseOverlay = document.createElement('div');
    pauseOverlay.id = 'gp-pause-overlay';
    pauseOverlay.innerHTML = [
      '<div id="gp-pause-dialog">',
        '<h2>Paused</h2>',
        '<button class="gp-pause-btn" id="gp-btn-resume">Resume</button>',
        '<button class="gp-pause-btn" id="gp-btn-reset">Reset</button>',
      '</div>',
    ].join('');

    var resumeBtn = pauseOverlay.querySelector('#gp-btn-resume');
    var resetBtn  = pauseOverlay.querySelector('#gp-btn-reset');

    function insert() {
      document.body.appendChild(menuBtn);
      document.body.appendChild(pauseOverlay);
    }
    if (document.body) { insert(); }
    else { document.addEventListener('DOMContentLoaded', insert); }

    function showPause() {
      GamePlate.paused = true;
      pauseOverlay.classList.add('gp-visible');
    }

    menuBtn.addEventListener('click', function () {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(function () {});
      } else {
        showPause();
      }
    });

    resumeBtn.addEventListener('click', function () {
      pauseOverlay.classList.remove('gp-visible');
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(function () {});
      }
      if (lockValue) {
        try { screen.orientation.lock(lockValue).catch(function () {}); } catch (e) {}
      }
      GamePlate.paused = false;
    });

    resetBtn.addEventListener('click', function () {
      location.reload();
    });

    document.addEventListener('fullscreenchange', function () {
      if (!document.fullscreenElement) showPause();
    });

    menuBtn.classList.add('gp-active');
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  var GamePlate = {
    input:  makeState(),
    paused: false,

    init: function (config) {
      config = config || {};
      var orientation = config.orientation !== undefined ? config.orientation : 'landscape';
      var controller  = config.controller  !== undefined ? config.controller  : 'auto';
      var fullscreen  = config.fullscreen  !== undefined ? config.fullscreen  : true;

      if (fullscreen) setupFullscreen();
      setupOrientation(orientation);
      setupKeyboard();
      setupGamepad();
      setupPauseMenu(orientation);

      var hasTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

      if (controller === 'tilt') {
        setupTilt();
      } else if (controller === 'nes' || (controller === 'auto' && hasTouch)) {
        setupVirtualController();
      }
    }
  };

  global.GamePlate = GamePlate;

}(window));
