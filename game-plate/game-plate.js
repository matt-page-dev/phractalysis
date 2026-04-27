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

    function getButtonAtPoint(x, y) {
      for (var name in btnEls) {
        var r = btnEls[name].getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return name;
      }
      return null;
    }

    function flushButtons() {
      var pressed = { a: false, b: false };
      activeBtnTouches.forEach(function (names) {
        names.forEach(function (n) { pressed[n] = true; });
      });
      for (var name in btnEls) {
        sources.touch[name] = pressed[name];
        btnEls[name].classList.toggle('lit', pressed[name]);
      }
      merge();
    }

    var btnsContainer = overlay.querySelector('#gp-buttons');

    btnsContainer.addEventListener('touchstart', function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        var s = new Set();
        var n = getButtonAtPoint(t.clientX, t.clientY);
        if (n) s.add(n);
        activeBtnTouches.set(t.identifier, s);
      }
      flushButtons();
    }, { passive: false });

    btnsContainer.addEventListener('touchmove', function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (!activeBtnTouches.has(t.identifier)) continue;
        var n = getButtonAtPoint(t.clientX, t.clientY);
        var s = new Set();
        if (n) s.add(n);
        activeBtnTouches.set(t.identifier, s);
      }
      flushButtons();
    }, { passive: false });

    function btnsEnd(e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        activeBtnTouches.delete(e.changedTouches[i].identifier);
      }
      flushButtons();
    }
    btnsContainer.addEventListener('touchend',    btnsEnd, { passive: false });
    btnsContainer.addEventListener('touchcancel', btnsEnd, { passive: false });
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  var GamePlate = {
    input: makeState(),

    init: function (config) {
      config = config || {};
      var orientation = config.orientation !== undefined ? config.orientation : 'landscape';
      var controller  = config.controller  !== undefined ? config.controller  : 'auto';
      var fullscreen  = config.fullscreen  !== undefined ? config.fullscreen  : true;

      if (fullscreen) setupFullscreen();
      setupOrientation(orientation);
      setupKeyboard();
      setupGamepad();

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
