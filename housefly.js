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
      'transition:transform .4s ease-out;}' +
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

    var safety = setTimeout(remove, 22000);

    // fly in and land
    setTimeout(function () {
      if (removed) return;
      var landX = rand(margin, vw - margin);
      var landY = rand(margin, vh - margin);
      fly.style.transition = 'transform .5s ease-out';
      setPos(fly, landX, landY, landX < x);
      x = landX; y = landY;

      setTimeout(walk, rand(150, 400));
    }, 500);

    // wander around like a real fly: short quick steps in a
    // semi-persistent heading, punctuated by little pauses (grooming)
    function walk() {
      if (removed) return;
      var heading = rand(0, Math.PI * 2);
      var stepsLeft = Math.floor(rand(16, 30));

      (function step() {
        if (removed) return;
        if (stepsLeft <= 0) { flyAway(); return; }
        stepsLeft--;

        // occasional pause, as if grooming or looking around
        if (Math.random() < 0.25) {
          setTimeout(step, rand(400, 950));
          return;
        }

        heading += rand(-0.7, 0.7);
        var dist = rand(4, 11);
        var dx = Math.cos(heading) * dist;
        var dy = Math.sin(heading) * dist;

        var nx = clamp(x + dx, margin, vw - margin);
        var ny = clamp(y + dy, margin, vh - margin);
        // bounce heading off the walls instead of getting stuck on an edge
        if (nx === margin || nx === vw - margin) heading = Math.PI - heading;
        if (ny === margin || ny === vh - margin) heading = -heading;
        x = nx; y = ny;

        var stepDuration = rand(220, 420);
        fly.style.transition = 'transform ' + stepDuration + 'ms linear';
        setPos(fly, x, y, Math.cos(heading) < 0);

        setTimeout(step, stepDuration + rand(80, 220));
      })();
    }

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
