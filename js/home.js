// Behind the Decks: home.js
// When a button is clicked, the title and buttons rush towards the viewer, as if the camera
// were passing through the screen. The next page then starts with the camera far back and
// moves in to the setup. The two pages are joined by a note kept in the browser's session storage.

const main = document.getElementById('home-main');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.querySelectorAll('.choice').forEach((link) => {
  link.addEventListener('click', (e) => {
    // Let the browser handle it normally if motion is switched off, or if a modifier key is held (new tab, etc.)
    if (reduceMotion || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    const r = link.getBoundingClientRect();
    main.style.transformOrigin = `${r.left + r.width / 2}px ${r.top + r.height / 2}px`;
    document.body.classList.add('leaving');
    try { sessionStorage.setItem('deck-arriving', '1'); } catch (err) { /* no storage: the next page simply appears */ }
    setTimeout(() => { window.location.href = link.href; }, 900);
  });
});

// If the visitor comes back with the browser's back button, show the home page normally again
window.addEventListener('pageshow', (e) => {
  if (e.persisted) document.body.classList.remove('leaving');
});
