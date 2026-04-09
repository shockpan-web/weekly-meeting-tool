/* ============================================================
   FocusBoard — confetti.js
   Confetti animation triggered when 🟢 On Track is selected
   No external libraries · Vanilla JS
   ============================================================ */

(function () {
  const PARTICLE_COUNT = 60;
  const DURATION_MS    = 1500;
  const COLORS         = ['#2ea043', '#3fb950', '#1f6feb', '#58a6ff', '#d29922'];

  /**
   * Launch confetti
   * Falls gently from the top of the screen and fades out
   */
  function launchConfetti() {
    const container = document.createElement('div');
    container.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'width:100%',
      'height:100%',
      'pointer-events:none',
      'overflow:hidden',
      'z-index:9999',
    ].join(';');
    document.body.appendChild(container);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Generate particles with slight time offsets
      setTimeout(() => createParticle(container), i * (DURATION_MS / PARTICLE_COUNT / 2));
    }

    // Remove container after animation ends
    setTimeout(() => {
      if (container.parentNode) container.parentNode.removeChild(container);
    }, DURATION_MS + 500);
  }

  function createParticle(container) {
    const el = document.createElement('div');

    // Random values
    const x       = Math.random() * 100;           // Horizontal position (vw%)
    const size    = 6 + Math.random() * 6;          // 6–12px
    const color   = COLORS[Math.floor(Math.random() * COLORS.length)];
    const shape   = Math.random() > 0.4 ? 'circle' : 'rect';
    const rotateStart = Math.random() * 360;
    const rotateEnd   = rotateStart + (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 180);
    const fallDist = 35 + Math.random() * 45;       // Fall distance (vh)
    const delay    = Math.random() * 200;            // Start delay (ms)

    el.style.cssText = [
      'position:absolute',
      `left:${x}vw`,
      `top:-${size}px`,
      `width:${size}px`,
      `height:${size * (shape === 'rect' ? 0.5 : 1)}px`,
      `background:${color}`,
      `border-radius:${shape === 'circle' ? '50%' : '2px'}`,
      'opacity:1',
      `transform:rotate(${rotateStart}deg)`,
      `transition:transform ${DURATION_MS}ms ease-out,`
        + `top ${DURATION_MS}ms ease-out,`
        + `opacity ${DURATION_MS * 0.6}ms ease-in ${DURATION_MS * 0.4}ms`,
    ].join(';');

    container.appendChild(el);

    // Move on next frame (to trigger transition)
    setTimeout(() => {
      el.style.top     = `${fallDist}vh`;
      el.style.opacity = '0';
      el.style.transform = `rotate(${rotateEnd}deg)`;
    }, delay + 16);
  }

  // Expose globally
  window.launchConfetti = launchConfetti;
})();
