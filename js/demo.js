// Behind the Decks: demo.js
// The guided "DJ mode". It walks a beginner through a first mix, one step at a time. Every step tells the visitor what to do
// and waits until it has really been done (the website watches the controls), then "Next" lights up. If a step takes too
// long, the thing to use is ringed and an arrow bobs above it.
export function createDemo({ THREE, camera, canvas, viewer, play, goTo, page, say }) {
  const D = play.demo;
  const digital = page === 'digital';
  const decks = D.decks;                                       // the two players, left then right
  const left = decks[0], right = decks[1];
  const K = D.K, ch = D.channelOf;
  const playing = (d) => !!(d && K(d).record != null && K(d).playing);
  
  const loaded = (d) => K(d).record != null;
  const pause = { stop: 'headphones+mixer', title: 'Plug in the headphones', text: 'A DJ never guesses: they listen first, in headphones, before the crowd hears anything. Drag the headphones (first arrow) onto the round gold jack on the mixer (second arrow).', guide: true, task: () => D.plugged(), target: () => (D.plugged() ? null : D.target('phones')), target2: () => D.target('jack'), done: 'Plugged in. Now only you hear what goes into the headphones.' };
  const cueStep = (d, what) => ({ stop: 'mixer', title: 'Listen in the headphones', text: `Press the CUE button of channel ${ch(d) + 1}, just under its fader. When the ${what} starts, you will hear it in your headphones even though the fader is down and the room hears nothing.`, task: () => D.cueOn(ch(d)), target: () => D.target('cue', ch(d)), done: `That is cueing: you will hear the ${what} privately.` });
  const lowsOff = (d, what) => ({ stop: 'mixer', title: 'Switch the lows off first', text: `Two songs both playing their bass at once sound muddy. Before you mix, turn the LOW knob of channel ${ch(d) + 1} (the bottom knob of its EQ) all the way down, so the new ${what} comes in without any bass.`, task: () => D.lo(ch(d)) < 0.15, target: () => D.target('lo', ch(d)), done: 'The bass is out of the new one. Only the first song has bass now.' });
  const bassSwap = (n, o, what) => ({ stop: 'mixer', title: 'Swap the bass', text: `Now the classic move: turn the LOW of channel ${ch(n) + 1} back up and, at the same time, turn the LOW of channel ${ch(o) + 1} all the way down. The bass changes hands from one ${what} to the other and the mix stays clean.`, task: () => D.lo(ch(n)) > 0.6 && D.lo(ch(o)) < 0.25, target: () => (D.lo(ch(n)) <= 0.6 ? D.target('lo', ch(n)) : D.target('lo', ch(o))), done: 'The bass has been swapped. That is the heart of a smooth mix.' });
  const steps = digital ? [
    { stop: 'mixer', title: 'Welcome to your first mix', text: 'A DJ plays two songs at once and slowly swaps from one to the other so the dance floor never goes quiet. You will do that now, on a real club setup. All the channel faders are down, so the room is silent. Press Next to begin.' },
    { stop: 'usb', title: 'Plug in the USB drive', text: 'The songs live on a USB drive. Drag the drive onto the blue USB port of a media player. Watch it stand up as it gets close.', task: () => D.usbAt() != null, target: () => (D.usbAt() ? null : D.target('usb')), target2: () => D.target('slot', left.id), done: 'The drive is in. Because the two players are joined by a link cable, both can read it.' },
    { stop: left.id, title: 'Choose a song', text: 'Turn the rotary selector next to the screen to choose a song, then press it to load it into this player.', task: () => loaded(left), target: () => D.target('control', left.id, 'cj_browse'), done: 'Song loaded. The screen now shows its waveform.' },
    pause,
    cueStep(left, 'song'),
    { stop: left.id, title: 'Press PLAY', text: 'Press the big green PLAY button. The song starts: the time on the screen counts down and the waveform moves. The jog wheel stays still, because on a real player it only moves when the DJ touches it.', task: () => playing(left), target: () => D.target('control', left.id, 'cj_play'), done: 'It is playing, and you hear it in the headphones. The room cannot hear it yet.' },
    { stop: 'mixer', title: 'Bring the sound up', text: `Every song comes into the room through a channel fader on the mixer. Push the fader of channel ${ch(left) + 1} up to let it through.`, task: () => D.fader(ch(left)) > 0.45, target: () => D.target('fader', ch(left)), done: 'Now the room can hear it.' },
    { stop: left.id, loop: true, title: 'Loop it to buy time', text: 'To get time for the next song, make the first one repeat. Press the 4-BEAT loop button (the small one under IN / OUT, on the left): the same four beats repeat until you release the loop.', task: () => D.loopOn(left), target: () => D.target('loopbtn', left.id, 3), done: 'The loop keeps the room dancing while you prepare the next song. (The loop buttons are always lit; the screen shows the loop.)' },
    { stop: right.id, title: 'Load a second song', text: 'On the other player, turn the rotary selector, choose a different song and press it. The drive is shared through the link cable.', task: () => loaded(right), target: () => D.target('control', right.id, 'cj_browse'), done: 'Second song ready, but not playing yet.' },
    { stop: right.id, title: 'Match the speeds first', text: 'Before you press play, bring this song to the same speed as the one playing. Move this player\'s tempo slider the way the arrow points (down speeds up, up slows down) until the arrow turns into a green tick. New to this? Press “Use SYNC for me” and the player does it.', assist: 'Use SYNC for me', task: () => D.matched(), target: () => null, done: 'Same speed. This is called beat matching.' },
    lowsOff(right, 'song'),
    { stop: right.id, title: 'Now press PLAY', text: 'Press PLAY on this player. Its channel fader is still down, so the room cannot hear it. You can, with its CUE button.', task: () => playing(right), target: () => D.target('control', right.id, 'cj_play'), done: 'Both songs are running at the same speed.' },
    { stop: 'mixer', title: 'Bring in the second song', text: `Raise the fader of channel ${ch(right) + 1} so both songs are in the room. The new one has no bass yet.`, task: () => D.fader(ch(right)) > 0.45, target: () => D.target('fader', ch(right)), done: 'Both are playing together. It sounds clean because the bass is only in one of them.' },
    bassSwap(right, left, 'song'),
    { stop: left.id, title: 'Let the first song go', text: `Release the loop on the first player (press RELOOP / EXIT) and pull the fader of channel ${ch(left) + 1} down. The second song now carries the room.`, task: () => !D.loopOn(left) && D.fader(ch(left)) < 0.2, target: () => D.target('loopbtn', left.id, 2), done: 'The mix is done: one song handed over to the other.' },
    { stop: 'mixer', title: 'You are a DJ', text: 'That is the whole idea. Now switch DJ mode off and use Play mode to try the rest: the crossfader, effects, filters and more. Press Finish.', last: true }
  ] : [
    { stop: 'mixer', title: 'Welcome to your first mix', text: 'A DJ plays two records at once and slowly swaps from one to the other so the dance floor never goes quiet. You will do that now, on a real analog setup. All the channel faders are down, so the room is silent. Press Next to begin.' },
    { stop: 'bag', title: 'Take a record out of the bag', text: 'Drag a record out of the bag and carry it to the left turntable. It tilts flat as it gets close. Let go over the platter.', task: () => D.onDeck(left.id) != null, target: () => D.target('bagrec'), target2: () => D.target('platter', left.id), done: 'The record is on the platter.' },
    pause,
    cueStep(left, 'record'),
    { stop: left.id, title: 'Power on and start', text: 'Turn the power knob (bottom left of the turntable), then press START/STOP. The platter spins up and the arm lowers onto the record by itself.', task: () => playing(left), target: () => D.target('power', left.id), done: 'The needle is in the groove. You hear it in the headphones; the room cannot hear it yet.' },
    { stop: 'mixer', title: 'Bring the sound up', text: `Every record reaches the room through a channel fader on the mixer. Push the fader of channel ${ch(left) + 1} up.`, task: () => D.fader(ch(left)) > 0.45, target: () => D.target('fader', ch(left)), done: 'Now the room can hear it.' },
    { stop: 'bag+ttL+mixer+ttR', title: 'Fetch a second record', text: 'The camera has pulled back so you can see both turntables. Take another record out of the bag and carry it all the way to the right turntable.', task: () => D.onDeck(right.id) != null, target: () => D.target('bagrec'), target2: () => D.target('platter', right.id), done: 'Second record ready, but not turning yet.' },
    { stop: right.id, title: 'Match the speeds first', text: 'Before you start it, bring this record to the same speed as the one playing. Slide the pitch fader of this turntable the way the arrow points until the arrow turns into a green tick. New to this? Press “Match it for me”.', assist: 'Match it for me', task: () => D.matched(), target: () => null, done: 'Same speed. This is called beat matching.' },
    lowsOff(right, 'record'),
    { stop: right.id, title: 'Now start it', text: 'Turn on the power and press START/STOP. Its channel fader is still down, so the room cannot hear it. You can, with its CUE button.', task: () => playing(right), target: () => D.target('power', right.id), done: 'Both records are turning at the same speed.' },
    { stop: 'mixer', title: 'Bring in the second record', text: `Raise the fader of channel ${ch(right) + 1} so both records are in the room. The new one has no bass yet.`, task: () => D.fader(ch(right)) > 0.45, target: () => D.target('fader', ch(right)), done: 'Both are playing together. It sounds clean because the bass is only in one of them.' },
    bassSwap(right, left, 'record'),
    { stop: 'mixer', title: 'Let the first record go', text: `Pull the fader of channel ${ch(left) + 1} down. The second record now carries the room. (A turntable has no loop button, so DJs on vinyl wait for a long intro or outro instead.)`, task: () => D.fader(ch(left)) < 0.2, target: () => D.target('fader', ch(left)), done: 'The mix is done: one record handed over to the other.' },
    { stop: 'mixer', title: 'You are a DJ', text: 'That is the whole idea. Now switch DJ mode off and use Play mode to try the rest: the crossfader, effects, filters and more. Press Finish.', last: true }
  ];

  // ---- the card ----
  const card = document.createElement('section');
  card.className = 'demo-card'; card.hidden = true; card.setAttribute('aria-live', 'polite');
  card.innerHTML = '<p class="demo-step"></p><h2 class="demo-title"></h2><p class="demo-text"></p><p class="demo-done" hidden></p><div class="demo-actions"><button type="button" class="btn demo-exit">Exit DJ mode</button><span class="demo-right"><button type="button" class="btn demo-assist" hidden></button><button type="button" class="btn demo-back">Back</button><button type="button" class="btn demo-skip" title="Skip this step if something went wrong">Skip</button><button type="button" class="btn demo-next">Next</button></span></div>';
  viewer.appendChild(card);
  const $ = (q) => card.querySelector(q);
  const ptr = document.createElement('div');
  ptr.className = 'demo-pointer'; ptr.hidden = true; ptr.innerHTML = '<span class="demo-ring"></span><svg viewBox="0 0 24 36" width="30" height="44" aria-hidden="true"><path d="M12 34 L2 20 H8 V2 H16 V20 H22 Z"/></svg>';
  viewer.appendChild(ptr);
  const ptr2 = ptr.cloneNode(true); ptr2.hidden = true; viewer.appendChild(ptr2);

  let i = -1, active = false, since = 0, doneAt = 0, raf = 0, onEnd = null;

  function show(n) {
    i = n; const s = steps[n];
    since = performance.now(); doneAt = 0; 
    $('.demo-step').textContent = `Step ${n + 1} of ${steps.length}`;
    $('.demo-title').textContent = s.title;
    $('.demo-text').textContent = s.text;
    $('.demo-done').hidden = true;
    $('.demo-next').textContent = s.last ? 'Finish' : 'Next';
    $('.demo-next').disabled = !!s.task;
    $('.demo-back').hidden = n === 0; $('.demo-skip').hidden = !s.task;
    $('.demo-assist').hidden = !s.assist; $('.demo-assist').textContent = s.assist || '';
    goTo(s.stop);
    say(`${s.title}. ${s.text}`);
  }
  function stepDone() {
    const s = steps[i];
    doneAt = performance.now();
    $('.demo-done').textContent = '✓ ' + (s.done || 'Done.'); $('.demo-done').hidden = false;
    $('.demo-next').disabled = false;
    $('.demo-next').classList.add('ready'); $('.demo-skip').hidden = true;
  }
  const proj = (v) => { const p = v.clone().project(camera), r = canvas.getBoundingClientRect(), vr = viewer.getBoundingClientRect(); return { x: (p.x + 1) / 2 * r.width + r.left - vr.left, y: (1 - p.y) / 2 * r.height + r.top - vr.top, z: p.z }; };
  // Keep the card away from whatever the visitor has to use: it sits at the top or the bottom, whichever covers less of
  // the controls (and the arrows) for this step. It only moves when the current place actually covers something.
  let cardPos = 'top', idle = 0;
  function placeCard(s) {
    if (performance.now() - lastPlace < 250) return;
    lastPlace = performance.now();
    const vr = viewer.getBoundingClientRect(), pts = [];
    [s.target, s.target2].forEach((f) => { const v = f && f(); if (v) { const p = proj(v); if (p.z < 1) pts.push(p); } });
    viewer.querySelectorAll('.pitch-hint:not([hidden])').forEach((h) => { const r = h.getBoundingClientRect(); pts.push({ x: r.left + r.width / 2 - vr.left, y: r.top + r.height / 2 - vr.top }); });
    const cw = Math.min(card.offsetWidth || 480, vr.width), ch2 = card.offsetHeight || 160, x0 = (vr.width - cw) / 2, M = 70;
    const hits = (pos) => { const y0 = pos === 'top' ? 12 : vr.height - 56 - ch2; return pts.filter((p) => p.x > x0 - M && p.x < x0 + cw + M && p.y > y0 - M && p.y < y0 + ch2 + M).length; };
    const cur = hits(cardPos), alt = hits(cardPos === 'top' ? 'bottom' : 'top');
    if (cur > alt) { cardPos = cardPos === 'top' ? 'bottom' : 'top'; card.dataset.pos = cardPos; }
  }
  let lastPlace = 0;
  function tick() {
    if (!active) return;
    raf = requestAnimationFrame(tick);
    const s = steps[i];
    if (!s) return;
    if (s.task && !doneAt && s.task()) stepDone();
    // the loop step needs a song that is playing: if it ran out (or was paused) in the meantime, start it again from the top
    if (s.loop && !doneAt && loaded(left) && !playing(left)) { if (!idle) idle = performance.now(); else if (performance.now() - idle > 2000) { D.restart(left); idle = 0; } } else idle = 0;
    // if the step takes too long, point at what to use
    const waiting = s.task && !doneAt && performance.now() - since > 9000;
    let t = null;
    if (waiting) {
      const a = s.target ? s.target : null, b = s.target2 || null, first = D.dragging() ? (b || a) : (a || b), second = first === a ? b : a;
      t = (first && first()) || (second && second()) || null;
    }
    if (s.guide && !doneAt) {                                         // a guided step points at both things straight away
      const a1 = !D.dragging() && s.target && s.target(), a2 = s.target2 && s.target2();
      [[ptr, a1], [ptr2, a2]].forEach(([el, v]) => { if (v) { const p = proj(v); el.hidden = p.z > 1; el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; } else el.hidden = true; });
    } else {
      ptr2.hidden = true;
      if (t) { const p = proj(t); ptr.hidden = p.z > 1; ptr.style.left = p.x + 'px'; ptr.style.top = p.y + 'px'; } else ptr.hidden = true;
    }
    card.classList.toggle('nudge', !!waiting && !t);
    placeCard(s);
  }
  $('.demo-next').addEventListener('click', () => { const s = steps[i]; if (s.last) { stop(true); return; } if (i < steps.length - 1) { $('.demo-next').classList.remove('ready'); show(i + 1); } });
  $('.demo-assist').addEventListener('click', () => { D.autoMatch(right); });
  $('.demo-back').addEventListener('click', () => { if (i > 0) { $('.demo-next').classList.remove('ready'); show(i - 1); } });
  $('.demo-skip').addEventListener('click', () => { if (i < steps.length - 1) { $('.demo-next').classList.remove('ready'); show(i + 1); } });
  $('.demo-exit').addEventListener('click', () => stop(true));

  function start() {
    if (active) return;
    active = true; card.hidden = false;
    cardPos = 'top'; card.dataset.pos = 'top';
    play.resetAll && play.resetAll();
    D.faderDown();                                   // every channel fader starts down: the room hears nothing until a fader goes up
    show(0);
    raf = requestAnimationFrame(tick);
  }
  function stop(fromUi) {
    if (!active) return;
    active = false; card.hidden = true; ptr.hidden = true; ptr2.hidden = true; D.phonesHome(); cancelAnimationFrame(raf);
    if (fromUi && onEnd) onEnd();
  }
  return { start, stop, get active() { return active; }, set onEnd(f) { onEnd = f; }, steps, show };
}
