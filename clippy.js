/*
 * Clippy-style paperclip assistant: floats near a corner of the screen
 * and can be dragged anywhere. No functionality beyond being fun.
 */
(function () {
  if (window.__clippyInit) return;
  window.__clippyInit = true;

  var STYLE_ID = 'clippy-styles';
  var STORE_KEY = 'clippyPos';
  var WIDTH = 90, HEIGHT = 130;
  var MARGIN = 24;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!document.getElementById(STYLE_ID)) {
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.clippy-anchor{position:fixed;top:0;left:0;width:' + WIDTH + 'px;height:' + HEIGHT + 'px;' +
      'z-index:2147483000;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;}' +
      '.clippy-anchor.dragging{cursor:grabbing;}' +
      '.clippy-anchor.dragging .clippy-float{animation-play-state:paused;}' +
      '.clippy-float{position:relative;width:100%;height:100%;' +
      (reduceMotion ? '' : 'animation:clippy-bob 3.2s ease-in-out infinite;') + '}' +
      '@keyframes clippy-bob{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}' +
      '.clippy-svg{position:absolute;top:0;left:0;overflow:visible;filter:drop-shadow(0 3px 3px rgba(0,0,0,.18));}' +
      '.clippy-eye{position:absolute;width:10px;height:12px;background:#fff;border-radius:50%;' +
      'border:1px solid #9aa0aa;overflow:hidden;transition:transform .12s ease;}' +
      '.clippy-eye-l{top:22px;left:30px;}' +
      '.clippy-eye-r{top:22px;left:44px;}' +
      '.clippy-eye.clippy-blink{transform:scaleY(.12);}' +
      '.clippy-pupil{position:absolute;top:3px;left:2px;width:5px;height:5px;background:#20242c;' +
      'border-radius:50%;transition:transform .5s ease;}';
    document.head.appendChild(style);
  }

  var anchor = document.createElement('div');
  anchor.className = 'clippy-anchor';
  anchor.setAttribute('aria-hidden', 'true');
  anchor.innerHTML =
    '<div class="clippy-float">' +
    '<svg class="clippy-svg" viewBox="0 0 24 24" width="' + WIDTH + '" height="' + HEIGHT + '">' +
    '<defs><linearGradient id="clippy-grad" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#dee2e8"/><stop offset="1" stop-color="#9aa0aa"/>' +
    '</linearGradient></defs>' +
    '<g transform="rotate(135 12 12)">' +
    '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.19 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" ' +
    'fill="none" stroke="url(#clippy-grad)" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</g>' +
    '</svg>' +
    '<div class="clippy-eye clippy-eye-l"><div class="clippy-pupil"></div></div>' +
    '<div class="clippy-eye clippy-eye-r"><div class="clippy-pupil"></div></div>' +
    '</div>';
  document.body.appendChild(anchor);

  var pupils = anchor.querySelectorAll('.clippy-pupil');
  var eyes = anchor.querySelectorAll('.clippy-eye');

  function rand(min, max) { return Math.random() * (max - min) + min; }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function defaultPos() {
    return {
      x: window.innerWidth - WIDTH - MARGIN,
      y: window.innerHeight - HEIGHT - MARGIN
    };
  }

  function loadPos() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (typeof p.x !== 'number' || typeof p.y !== 'number') return null;
      return p;
    } catch (e) { return null; }
  }

  function savePos(x, y) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ x: x, y: y })); } catch (e) {}
  }

  var startPos = loadPos() || defaultPos();
  var curX = clamp(startPos.x, 0, Math.max(0, window.innerWidth - WIDTH));
  var curY = clamp(startPos.y, 0, Math.max(0, window.innerHeight - HEIGHT));

  function setAnchorPos(x, y) {
    curX = x; curY = y;
    anchor.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
  }
  setAnchorPos(curX, curY);

  window.addEventListener('resize', function () {
    setAnchorPos(
      clamp(curX, 0, Math.max(0, window.innerWidth - WIDTH)),
      clamp(curY, 0, Math.max(0, window.innerHeight - HEIGHT))
    );
  });

  // dragging
  var dragging = false, offsetX = 0, offsetY = 0;

  anchor.addEventListener('pointerdown', function (e) {
    dragging = true;
    anchor.classList.add('dragging');
    try { anchor.setPointerCapture(e.pointerId); } catch (err) {}
    offsetX = e.clientX - curX;
    offsetY = e.clientY - curY;
  });

  anchor.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var x = clamp(e.clientX - offsetX, 0, Math.max(0, window.innerWidth - WIDTH));
    var y = clamp(e.clientY - offsetY, 0, Math.max(0, window.innerHeight - HEIGHT));
    setAnchorPos(x, y);
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    anchor.classList.remove('dragging');
    try { anchor.releasePointerCapture(e.pointerId); } catch (err) {}
    savePos(curX, curY);
  }
  anchor.addEventListener('pointerup', endDrag);
  anchor.addEventListener('pointercancel', endDrag);

  // personality: blinking + idle eye movement
  if (!reduceMotion) {
    (function blinkLoop() {
      setTimeout(function () {
        eyes.forEach(function (eye) { eye.classList.add('clippy-blink'); });
        setTimeout(function () {
          eyes.forEach(function (eye) { eye.classList.remove('clippy-blink'); });
        }, 120);
        blinkLoop();
      }, rand(2500, 6000));
    })();

    (function lookLoop() {
      setTimeout(function () {
        var dx = rand(-2, 2), dy = rand(-1.5, 1.5);
        pupils.forEach(function (p) { p.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; });
        lookLoop();
      }, rand(1800, 4000));
    })();
  }
})();
