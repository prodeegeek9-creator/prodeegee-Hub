/*
 * Housefly easter-egg: an SVG-free emoji fly that occasionally wanders
 * onto the page, walks around for a bit, then flies off again.
 */
(function () {
  if (window.__houseflyInit) return;
  window.__houseflyInit = true;

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var STYLE_ID = 'housefly-styles';
  if (!document.getElementById(STYLE_ID)) {
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.housefly{position:fixed;top:0;left:0;font-size:18px;line-height:1;' +
      'pointer-events:none;z-index:2147483000;will-change:transform;' +
      'transition:transform .35s ease-in-out;}' +
      '.housefly-body{display:inline-block;animation:housefly-wiggle .15s ease-in-out infinite;}' +
      '@keyframes housefly-wiggle{0%,100%{transform:rotate(-6deg) scale(1);}50%{transform:rotate(6deg) scale(.94);}}';
    document.head.appendChild(style);
  }

  function rand(min, max) { return Math.random() * (max - min) + min; }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function setPos(el, x, y, flip) {
    el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) scaleX(' + (flip ? -1 : 1) + ')';
  }

  function spawnHousefly() {
    if (document.hidden) { scheduleNext(); return; }

    var fly = document.createElement('div');
    fly.className = 'housefly';
    fly.setAttribute('aria-hidden', 'true');
    var body = document.createElement('span');
    body.className = 'housefly-body';
    body.textContent = '\u{1FAB0}';
    fly.appendChild(body);
    document.body.appendChild(fly);

    var vw = window.innerWidth, vh = window.innerHeight;
    var margin = 40;

    var edge = Math.floor(rand(0, 4));
    var x, y;
    if (edge === 0) { x = -30; y = rand(margin, vh - margin); }
    else if (edge === 1) { x = vw + 30; y = rand(margin, vh - margin); }
    else if (edge === 2) { x = rand(margin, vw - margin); y = -30; }
    else { x = rand(margin, vw - margin); y = vh + 30; }
    setPos(fly, x, y, x > vw / 2);

    var removed = false;
    function remove() {
      if (removed) return;
      removed = true;
      fly.remove();
      scheduleNext();
    }

    var safety = setTimeout(remove, 20000);

    setTimeout(function () {
      var landX = rand(margin, vw - margin);
      var landY = rand(margin, vh - margin);
      setPos(fly, landX, landY, landX < x);
      x = landX; y = landY;

      var steps = Math.floor(rand(4, 9));
      var i = 0;
      (function step() {
        if (removed) return;
        if (i >= steps) { flyAway(); return; }
        i++;
        var dx = rand(-18, 18);
        var dy = rand(-18, 18);
        x = clamp(x + dx, margin, vw - margin);
        y = clamp(y + dy, margin, vh - margin);
        setPos(fly, x, y, dx < 0);
        setTimeout(step, rand(250, 700));
      })();
    }, 500);

    function flyAway() {
      if (removed) return;
      var exitEdge = Math.floor(rand(0, 4));
      var exitX, exitY;
      if (exitEdge === 0) { exitX = -40; exitY = rand(0, vh); }
      else if (exitEdge === 1) { exitX = vw + 40; exitY = rand(0, vh); }
      else if (exitEdge === 2) { exitX = rand(0, vw); exitY = -40; }
      else { exitX = rand(0, vw); exitY = vh + 40; }

      fly.style.transition = 'transform .9s ease-in';
      setPos(fly, exitX, exitY, exitX < x);
      clearTimeout(safety);
      setTimeout(remove, 950);
    }
  }

  function scheduleNext() {
    setTimeout(spawnHousefly, rand(20000, 75000));
  }

  setTimeout(spawnHousefly, rand(4000, 15000));
})();
