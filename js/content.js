// Behind the Decks: content.js
// All the words and all the measurements live here, so they are easy to find and edit.
//
//   DEVICES : every kind of equipment: which file it comes from, and its parts.
//   SCENES  : which devices stand where on the "digital" and the "analog" page.
//
// A part can be found on a model in three ways:
//   meshes  : the model is made of separate pieces and the part is one or more of them (by name)
//   regions : the part is an area measured on the model:
//               ['c', x, z, radius]        circle seen from above
//               ['r', x1, z1, x2, z2]      rectangle seen from above
//               ['a', x, z, r1, r2]        ring seen from above
//   boxes   : the part is a block of 3D space: ['b', x1, y1, z1, x2, y2, z2]
// Every measurement is in the model's own units, measured from the model's own centre.

const CH = [-0.588, -0.276, 0.041, 0.355];             // the x position of the four mixer channels
const perChannel = (fn) => CH.map(fn);

export const DEVICES = {
  /* ======================= MEDIA PLAYER (drawn in code) ======================= */
  cdj: {
    label: 'Media player',
    build: 'cdj',
    center: true,
    summary: 'Plays the digital tracks, and is where the DJ controls each one by hand. This is a look-alike of a club-standard media player, drawn for this project. Songs are loaded from a USB drive, shown on the screen and played with the jog wheel, the play and cue buttons and the tempo slider.',
    parts: [
      {
        id: 'media', name: 'Media slots and eject button', meshes: ['cj_media', 'cj_eject'],
        what: 'The USB and SD card slots where music is loaded into the player, and the button that releases the drive.',
        use: 'The DJ prepares tracks on a drive in advance and plugs it in here. Before taking the drive out, the DJ presses the eject button so the player can finish reading it and nothing is damaged.',
        crowd: 'Nothing visible. A set played from a prepared drive means fewer things that can go wrong in the middle of a track.'
      },
      {
        id: 'display', name: 'Screen', meshes: ['cj_display'],
        what: 'The screen shows the loaded track: its name, its remaining time, its tempo (BPM) and its waveform, which is the shape of the track. It is also where the DJ browses the library.',
        use: 'The waveform shows a breakdown or a drop coming, so the DJ can line up the beats of the next track with the one that is playing.',
        crowd: 'The crowd never sees it, but it is how the DJ times a change to the exact moment the energy shifts.'
      },
      {
        id: 'nav', name: 'Source, browse, tag list, playlist, search and menu buttons', meshes: ['cj_nav'],
        what: 'A row of buttons along the top of the screen. SOURCE chooses where music comes from (USB, SD card or another player). BROWSE opens the library. TAG LIST shows tracks marked for later. PLAYLIST shows playlists. SEARCH looks for a track by name. MENU opens the settings.',
        use: 'They get the DJ to the next track without a laptop. A tag list is a short list of tracks picked in advance for the next part of the set.',
        crowd: 'Nothing visible. Finding the right track quickly keeps the music moving.'
      },
      {
        id: 'browse', name: 'Rotary selector, back and time mode', meshes: ['cj_browse', 'cj_back', 'cj_timemode'],
        what: 'A rotary knob for scrolling through folders and tracks. Pressing it selects a folder or loads the highlighted track. BACK goes up one level. TIME MODE switches the screen between time elapsed and time remaining, and a long press turns auto cue on or off.',
        use: 'The DJ turns the knob to find the next track, presses to load it, and listens to it in the headphones before the crowd hears anything.',
        crowd: 'This is where the next track is chosen, so it is where the DJ responds to the mood of the room.'
      },
      {
        id: 'slip', name: 'Slip and quantize buttons', meshes: ['cj_slip', 'cj_quantize'],
        what: 'SLIP lets the track carry on silently in the background while the DJ scratches, loops or holds a cue, so that when they let go the track is exactly where it would have been. QUANTIZE snaps cues and loops to the nearest beat.',
        use: 'With slip on, a DJ can do a quick loop or a stutter and drop back into the track without losing the beat. With quantize on, a loop set a little late still lands on the beat.',
        crowd: 'Effects and loops that stay in time, because the track underneath never lost its place.'
      },
      {
        id: 'tagtrack', name: 'Tag track, track filter and shortcut buttons', meshes: ['cj_tagtrack', 'cj_trackfilter', 'cj_shortcut'],
        what: 'Buttons beside the rotary selector. TAG TRACK adds the highlighted track to a short list for later. TRACK FILTER narrows the library by tags such as genre or mood. SHORTCUT jumps straight to a place in the library that the DJ chose in advance.',
        use: 'They help find the next track quickly, without scrolling through thousands of songs while the music is playing.',
        crowd: 'Nothing directly. The right next track arrives sooner.'
      },
      {
        id: 'vinylspeed', name: 'Vinyl speed adjust knob', meshes: ['cj_vinylspeed'],
        what: 'Sets how quickly the track slows down and stops when the top of the jog wheel is touched, and how quickly it speeds back up when it is released, in vinyl mode.',
        use: 'A slow setting gives the long wind-down of a record switched off. A fast setting stops the track at once, for sharper scratches and stops.',
        crowd: 'A long slow-down is a dramatic effect that the whole room hears. A quick stop is a sharp punctuation.'
      },
      {
        id: 'direction', name: 'Direction switch', meshes: ['cj_direction'],
        what: 'Chooses whether the track plays forwards or backwards. In the middle position it plays forwards, and in the other positions it plays in reverse, or in reverse with slip on.',
        use: 'A DJ can reverse a track for a short effect, such as a rewind before the drop.',
        crowd: 'A sudden rewind is easy to recognise and tends to raise the energy right before the beat comes back.'
      },
      {
        id: 'keysync', name: 'Key sync button', meshes: ['cj_keysync'],
        what: 'Matches the musical key of this track to the track on the other player. Tracks in the same or neighbouring keys sound good together.',
        use: 'Mixing two tracks in clashing keys can sound out of tune. Key sync shifts one of them slightly so that the two blend.',
        crowd: 'Two tracks that sound like one piece of music, instead of two melodies fighting.'
      },
      {
        id: 'pads', name: 'Performance pads (hot cues)', meshes: ['cj_pad'],
        what: 'Eight coloured pads. In hot cue mode each pad stores a marker in a track. Pressing a lit pad jumps straight to its marker and plays from there.',
        use: 'While preparing, the DJ marks key moments such as the first beat, a vocal or the drop. In the set, one press jumps there, useful for repeating or skipping a section.',
        crowd: 'A jump straight to the drop changes the energy of the room with no pause or silence.'
      },
      {
        id: 'loop', name: 'Loop in, loop out and reloop', meshes: ['cj_loop'],
        what: 'Buttons that make a section of the track repeat. LOOP IN sets where the loop starts, LOOP OUT sets where it ends, and RELOOP/EXIT leaves the loop or returns to the last one.',
        use: 'A DJ can loop the end of a track to get more time for a transition, or loop a short section to build tension before letting it play on.',
        crowd: 'A repeating phrase builds anticipation. When the loop is released, the music moves forward again and it feels like a release.'
      },
      {
        id: 'call', name: 'Cue/loop call, delete and memory', meshes: ['cj_call', 'cj_delete', 'cj_memory'],
        what: 'MEMORY saves the current point or loop as a marker. The two arrows (CUE/LOOP CALL) jump to the previous or next saved marker. DELETE removes a saved marker.',
        use: 'A DJ saves markers at home, such as the start of a chorus, and jumps between them in the set.',
        crowd: 'Nothing directly. It lets the DJ move around a track without losing the beat.'
      },
      {
        id: 'jog', name: 'Jog wheel', meshes: ['cj_jog', 'cj_jogdisplay'],
        what: 'The large wheel in the centre. Turning the top moves the track forward or back, depending on the mode. Touching the top slows or holds the track. The small round display in the middle shows the position in the track. The top does not spin by itself while a song plays; it only moves when the DJ touches it (in this website it stays still, and is not yet touchable).',
        use: 'Fine adjustment of the beat: when two tracks are slightly out of time, the DJ nudges the wheel until the beats line up. It is also used to search through a track and to scratch.',
        crowd: 'When the beats line up, the crowd hears one steady rhythm instead of two overlapping ones.'
      },
      {
        id: 'jogring', name: 'Jog wheel outer ring', meshes: ['cj_jogring'],
        what: 'The edge of the wheel. Turning the outer ring speeds up or slows down the track a little, and it lets go of the track when released.',
        use: 'The DJ pushes the ring forward or back to pull a track into time with another one, without stopping it.',
        crowd: 'Two tracks that drift apart and then settle together, without a gap.'
      },
      {
        id: 'jogmode', name: 'Jog mode button', meshes: ['cj_jogmode'],
        what: 'Switches the wheel between a vinyl-like mode, where touching the top stops the track like a record, and a lighter mode, where the top only nudges the speed.',
        use: 'A DJ who learned on vinyl usually wants the wheel to behave like a record. A DJ who uses it only to nudge the beat may prefer the lighter mode.',
        crowd: 'Nothing directly. It is about how the equipment feels under the DJ’s hands.'
      },
      {
        id: 'jogadjust', name: 'Jog adjust knob', meshes: ['cj_jogadjust'],
        what: 'Sets how heavy the wheel feels and how quickly the music slows or stops when the top is touched.',
        use: 'A heavier feel is steadier for beat nudging. A lighter feel is quicker for scratching.',
        crowd: 'Nothing directly.'
      },
      {
        id: 'tsearch', name: 'Track search buttons', meshes: ['cj_tsearch'],
        what: 'Two buttons that skip to the start of the previous or the next track.',
        use: 'Handy for restarting a track, or for jumping to the next one in a playlist.',
        crowd: 'Nothing.'
      },
      {
        id: 'search', name: 'Search buttons', meshes: ['cj_search'],
        what: 'Two buttons that move quickly through the track, backwards or forwards, for as long as they are held.',
        use: 'The DJ uses them to find a section of a track fast, for example to hear how a track ends before choosing it.',
        crowd: 'Nothing, because the DJ does this in the headphones and the crowd hears only the track that is playing.'
      },
      {
        id: 'cue', name: 'Cue button', meshes: ['cj_cue'],
        what: 'Sets a starting point in the track and sends the track back to it whenever it is pressed. Holding it plays the track for as long as the button is held.',
        use: 'The DJ places the cue point on the first beat of the next track, then starts it at the right moment while the current track plays, checking the timing in the headphones.',
        crowd: 'A new track that starts on the beat slots into the rhythm and the crowd never notices the join.'
      },
      {
        id: 'play', name: 'Play and pause', meshes: ['cj_play'],
        what: 'Starts and pauses the track. It blinks while the track is paused.',
        use: 'Played at the right moment, this is how the next track enters the mix. Pressing it on the beat is half of the skill of a clean transition.',
        crowd: 'A track that starts exactly on the beat joins the music without a gap.'
      },
      {
        id: 'sync', name: 'Sync and master buttons', meshes: ['cj_sync', 'cj_master'],
        what: 'SYNC matches this player’s tempo, and its beat position, to another player automatically. MASTER makes this player the one that others follow.',
        use: 'Sync saves time and lets the DJ focus on track choice and the crowd. Some DJs prefer to match tempos by hand, and people disagree about how much to rely on it.',
        crowd: 'Smooth transitions. Whether done by hand or with sync, what the crowd hears is the same: two tracks in time.'
      },
      {
        id: 'range', name: 'Tempo range and master tempo', meshes: ['cj_range', 'cj_mastertempo'],
        what: 'TEMPO RANGE chooses how far the tempo slider can change the speed (for example 6, 10 or 16 percent, or a wide range). MASTER TEMPO keeps the pitch (the key) the same when the speed changes.',
        use: 'A smaller range makes the slider more precise. With master tempo on, a track sped up for mixing does not sound higher and squeaky.',
        crowd: 'A track that still sounds natural, even though it has been sped up or slowed down.'
      },
      {
        id: 'temporeset', name: 'Tempo reset button', meshes: ['cj_temporeset'],
        what: 'A button that switches the tempo slider on or off. With it off, the track plays at its original speed, whatever position the slider is in.',
        use: 'A DJ who has moved the slider far from its middle can press it to hear the track at its normal speed again, then press it once more to return to the slider setting.',
        crowd: 'Nothing directly. It is a quick way back to the original speed of a track.'
      },
      {
        id: 'tempo', name: 'Tempo slider', meshes: ['cj_tempo', 'cj_tslot'],
        what: 'A slider that changes how fast the track plays, and with it the tempo in beats per minute (BPM). Pulling it towards you speeds the track up and pushing it away slows it down. It clicks into place at the middle, which is the original speed.',
        use: 'To blend two tracks their tempos must match. If one is at 124 BPM and the next at 126, the DJ moves the slider until they agree. This is called beatmatching.',
        crowd: 'A steady beat. When tempos drift apart, the two kick drums stop landing together and the rhythm feels unsteady.'
      },
      {
        id: 'rear', name: 'Back panel: line out and connections', meshes: ['cr_out', 'cr_digital', 'cr_link', 'cr_mains'],
        what: 'On the back are the audio output (a pair of line out sockets, left and right), a digital output, a network (link) socket for connecting several players, and the power socket.',
        use: 'A pair of cables runs from the line out sockets to a channel on the mixer. The link socket lets players share the contents of their drives.',
        crowd: 'Nothing. Good cabling means no hum or crackle.'
      }
    ]
  },

  /* ======================= MIXER (digital, drawn in code) ======================= */
  mixer: {
    label: 'Mixer',
    build: 'djm',
    center: true,
    summary: 'The centre of the digital setup. Both media players plug into it. It balances and blends them with equalisers, colour effects and faders, adds beat-synced effects, and sends the result to the speakers and the DJ’s headphones. This one is a look-alike of a four-channel digital club mixer, drawn for this project. Every control is grouped by what it does.',
    parts: [
      {
        id: 'usb', name: 'USB ports (A and B)', meshes: ['dj_usb'],
        what: 'Two USB ports, marked A and B, for connecting laptops. Through them the mixer also works as the laptop’s sound card, and it can send MIDI messages to DJ software.',
        use: 'Two ports mean two DJs can set up their laptops before the handover. The music in the software then arrives on a channel like any other source.',
        crowd: 'Nothing visible, but a handover that needs no unplugging means no silence between two DJs.'
      },
      {
        id: 'miclevel', name: 'Microphone level knobs (1 and 2)', meshes: ['dj_miclevel'],
        what: 'One knob for each of the two microphone inputs. It sets how loud that microphone is in the mix.',
        use: 'Turn it up slowly: turned too far it gets loud very quickly and can cause a squeal (feedback) if the microphone is near a speaker.',
        crowd: 'A voice that sits clearly on top of the music, loud enough to hear but not so loud that it hurts.'
      },
      {
        id: 'miceq', name: 'Microphone EQ (HI and LOW)', meshes: ['dj_miceq'],
        what: 'Two tone knobs for the microphones: one for the high frequencies and one for the low ones. Each can cut or boost by up to 12 dB.',
        use: 'Cutting the lows removes rumble and boominess from a voice; boosting the highs makes speech clearer against loud music.',
        crowd: 'A voice that is easy to understand.'
      },
      {
        id: 'talkover', name: 'Talkover button', meshes: ['dj_talkover'],
        what: 'Turns talkover on and off. While it is on and someone speaks into the microphone, the music (everything except the microphone) is turned down automatically.',
        use: 'An MC or the DJ announces something without touching a fader: the music dips while the voice is there and returns when it stops.',
        crowd: 'The announcement is clear, and the music comes back by itself.'
      },
      {
        id: 'micfx', name: 'Microphone effect buttons', meshes: ['dj_micfx'],
        what: 'Three buttons that choose an effect for the microphone: ECHO repeats the voice several times, getting quieter each time; PITCH changes the pitch of the voice; MEGAPHONE makes it sound as if it comes through a megaphone.',
        use: 'Used on a single word or phrase at a key moment, for example an echo on the last word before a drop.',
        crowd: 'A voice with a trail that feels part of the music, not just talking over it.'
      },
      {
        id: 'micparam', name: 'Microphone effect parameter knobs', meshes: ['dj_micparam', 'dj_micparam2'],
        what: 'The upper knob adjusts the effect chosen with the microphone effect buttons (for example, how long an echo lasts). The lower knob adjusts the microphone reverb.',
        use: 'A small amount of reverb makes a voice sound natural in a big room. A large amount makes it sound distant.',
        crowd: 'A voice that fits the size of the room.'
      },
      {
        id: 'micreverb', name: 'Microphone reverb button', meshes: ['dj_micreverb'],
        what: 'Turns the microphone reverb on and off. The button lights up when it is on.',
        use: 'Reverb adds a sense of space to a voice. It is used lightly for speech and more heavily for a dramatic call-out.',
        crowd: 'A voice that sounds like it belongs in the room.'
      },
      {
        id: 'micon', name: 'Microphone on button', meshes: ['dj_micon'],
        what: 'Turns the microphone on and off. Pressing and holding it makes the microphone work only while the button is held down (push-to-talk).',
        use: 'Push-to-talk stops a live microphone from picking up noise or feeding back while nobody is speaking.',
        crowd: 'Nothing, when it works well: the microphone is silent until someone actually speaks.'
      },
      {
        id: 'phantom', name: 'Phantom power button', meshes: ['dj_phantom'],
        what: 'Supplies 48 volts to the microphone 1 socket. Some microphones (condenser microphones) need this power to work. The button has to be held down to switch it, so that it is not pressed by accident.',
        use: 'Phantom power is turned on only for a microphone that needs it, and off before plugging or unplugging a microphone, because otherwise it can cause a loud bang.',
        crowd: 'Nothing. A wrong setting can cause a loud pop through the speakers.'
      },
      {
        id: 'bluetooth', name: 'Bluetooth pairing button', meshes: ['dj_bluetooth'],
        what: 'Connects a phone or computer wirelessly. Hold it for about two seconds to pair; it blinks while waiting and stays lit when connected.',
        use: 'It lets someone play a song from a phone without a cable, and the sound arrives on the channel set to the Bluetooth input. It is convenient, but a cable is more reliable.',
        crowd: 'Nothing, unless the connection drops. Clubs rely on cables for that reason.'
      },
      {
        id: 'midi', name: 'MIDI buttons', meshes: ['dj_midi', 'dj_midistart'],
        what: 'MIDI ON/OFF turns on the sending of control messages to software connected by USB. MIDI START/STOP sends a start or stop message, so software can begin or stop with a button press on the mixer.',
        use: 'A DJ who uses software can control it from the mixer’s knobs and faders, and start a drum machine or sequencer in time with the mixer.',
        crowd: 'Nothing directly, but the knobs they hear change might be controlling a whole software set-up.'
      },
      {
        id: 'lock', name: 'Center lock switch', meshes: ['dj_lock'],
        what: 'When on, the COLOR knobs click into a locked position at the centre if they are turned quickly past it, so that the effect is fully off.',
        use: 'A fast turn of a COLOR knob usually passes the centre. This switch makes the centre easy to find without looking.',
        crowd: 'A clean sound when the effect is meant to be off.'
      },
      {
        id: 'colorfx', name: 'Sound colour FX buttons', meshes: ['dj_colorfx'],
        what: 'Six buttons that choose what the COLOR knobs do: SPACE (reverb), DUB ECHO (echoing repeats), CRUSH (a harsh, “crushed” version of the sound), SWEEP (a moving filter), NOISE (filtered white noise) and FILTER (a low-pass and high-pass filter). The selected button blinks.',
        use: 'The DJ picks one effect for the whole mixer, and then uses the COLOR knob of whichever channel needs it. Pressing the selected button again turns the effect off. (On this website one of them is always chosen, and the effects are simplified imitations of the real ones.)',
        crowd: 'Rising and falling textures that tell the crowd something is about to change.'
      },
      {
        id: 'colorparam', name: 'Sound colour FX parameter knob', meshes: ['dj_colorparam'],
        what: 'Adjusts a second setting of the chosen colour effect. For SPACE and DUB ECHO it is the amount of feedback, for SWEEP the centre frequency, for NOISE the volume of the noise, for CRUSH the amount of crushing and for FILTER the resonance.',
        use: 'It lets the DJ fine-tune an effect so that it suits the track instead of using a fixed setting.',
        crowd: 'An effect that matches the music.'
      },
      {
        id: 'phonesA', name: 'Headphones A: link cue and mono split', meshes: ['dj_linkcue', 'dj_monosplit'],
        what: 'LINK CUE lets the DJ listen to the sound of a connected player (which can follow the player’s own cue). MONO SPLIT, when lit, sends the cued channel to the left ear and the main mix to the right ear. When it is not lit, the cued channel is heard in stereo.',
        use: 'Mono split is useful for beatmatching: one ear hears the new track and the other ear hears the track the crowd hears, so they can be lined up.',
        crowd: 'Nothing, because headphones are private, but it is what makes a clean blend possible.'
      },
      {
        id: 'cuemix', name: 'Headphones mix knob', meshes: ['xi_cuemix'],
        what: 'Blends between the channels that have a CUE button pressed and the main (master) mix in the headphones. All the way one way you hear only the cue. All the way the other you hear only the master.',
        use: 'To match two tracks, the DJ sets the knob so both the next track and the one the crowd hears can be heard, and brings them into time.',
        crowd: 'Nothing directly: this is how a DJ hears the next track before the crowd does.'
      },
      {
        id: 'phonesLevel', name: 'Headphones level knob', meshes: ['xi_plevel'],
        what: 'Sets how loud the headphones are. It does not change the sound the crowd hears.',
        use: 'Clubs are loud, so DJs often need the headphones louder than is comfortable for long. Turn it up only as much as needed, to protect your hearing.',
        crowd: 'Nothing. It only affects the DJ.'
      },
      {
        id: 'jack', name: 'Headphone socket', meshes: ['xi_jack'],
        what: 'The socket for the headphones: a standard 6.3 mm socket.',
        use: 'The DJ plugs in and presses CUE on a channel to hear it.',
        crowd: 'Nothing, because headphones are private.'
      },
      {
        id: 'input', name: 'Input selector knobs', meshes: ['dj_input'],
        what: 'A knob on each channel that chooses what that channel plays: a Bluetooth device, a laptop on USB A or B, a digital player, a line source such as a media player, a turntable (phono), or the sound that returns from an external effect.',
        use: 'Plug a turntable into a channel and select phono, and the mixer boosts its weak signal. Media players use line or digital, and a laptop uses USB.',
        crowd: 'Nothing, unless it is wrong: a wrong choice means silence or a thin, quiet sound.'
      },
      {
        id: 'trim', name: 'Trim knobs', meshes: ['xi_trim'],
        what: 'A knob on each channel that sets how strong the incoming signal is before the equaliser and the fader.',
        use: 'Tracks are made at different volumes. The DJ adjusts the trim until the new track is as loud as the one playing, watching the channel meter beside the fader.',
        crowd: 'A steady volume from track to track.'
      },
      {
        id: 'eqhi', name: 'EQ: HI (treble)', meshes: ['xi_hi'],
        what: 'The top knob of the equaliser on each channel. It controls the highest part of the sound (hi-hats, cymbals, the hiss of a vocal). It can cut by up to 26 dB or boost by up to 6 dB.',
        use: 'The DJ cuts the highs to soften a harsh track, or turns them up to make a dull one brighter. A switch near the master section can change all the EQ knobs into an isolator, which removes a band completely.',
        crowd: 'Brightness and sparkle. When the highs are cut the music feels muffled, and when they return the room opens up.'
      },
      {
        id: 'eqmid', name: 'EQ: MID (mid-range)', meshes: ['xi_hm'],
        what: 'The middle knob of the equaliser on each channel. It controls the middle of the sound, where vocals, snares and lead sounds live. It can cut by up to 26 dB or boost by up to 6 dB.',
        use: 'The DJ lowers it on one track when two vocals or two lead sounds would clash, so that only one is heard clearly.',
        crowd: 'Clear vocals and lead lines. Two at once sound crowded.'
      },
      {
        id: 'eqlow', name: 'EQ: LOW (bass)', meshes: ['xi_lo'],
        what: 'The bottom knob of the equaliser on each channel. It controls the bass: the kick drum and the bass line. It can cut by up to 26 dB or boost by up to 6 dB.',
        use: 'The DJ turns the bass down on the incoming track, then swaps it: bass out on the old track, bass in on the new one. Two bass lines together would clash.',
        crowd: 'The low end drops away and then returns. That moment of the bass coming back is one of the most familiar ways a DJ builds tension and releases it.'
      },
      {
        id: 'color', name: 'COLOR knobs', meshes: ['dj_color'],
        what: 'A large knob on each channel that controls the colour effect chosen at the left (SPACE, DUB ECHO, CRUSH, SWEEP, NOISE or FILTER). In the centre the effect is off. Turned either way it applies the effect more strongly.',
        use: 'With FILTER selected, turning left slowly removes the highs and turning right slowly removes the lows. DJs use it to build tension before a drop or to fade a track out without touching its volume.',
        crowd: 'Rising tension, then release. Effects are a big part of why a crowd cheers at a drop.'
      },
      {
        id: 'cue', name: 'Cue A buttons', meshes: ['xi_cue'],
        what: 'A button on each channel that sends that channel to the headphones (output A), whether or not it is playing for the crowd.',
        use: 'This is how the next track is listened to in private. The DJ presses cue on the incoming channel, hears it in the headphones, lines it up with the track the crowd hears, and only then brings it up.',
        crowd: 'Nothing. The crowd never hears the preparation, only the finished transition.'
      },
      {
        id: 'cueb', name: 'Cue B buttons', meshes: ['dj_cueb'],
        what: 'The same as CUE A, but it sends the channel to the second headphone output, headphones B.',
        use: 'With two pairs of headphones, two people can each listen to what they need.',
        crowd: 'Nothing.'
      },
      {
        id: 'fxled', name: 'Beat FX lights', meshes: ['dj_fxled'],
        what: 'A small light on each channel that shows whether the Beat FX section is working on that channel. It lights on the channel selected with the CH SELECT buttons and blinks while the effect is on.',
        use: 'A quick check of which channel the effect will change before pressing ON.',
        crowd: 'Nothing visible.'
      },
      {
        id: 'chmeter', name: 'Channel level meters', meshes: ['xi_meter'],
        what: 'A column of lights beside each fader that shows how strong the channel’s signal is, before the fader. Green is a safe level, and red means too strong.',
        use: 'The DJ sets the trim so that peaks reach the top of the green, so that all tracks have the same level.',
        crowd: 'Nothing, but a good level means no distortion.'
      },
      {
        id: 'faders', name: 'Channel faders', meshes: ['xi_fader', 'xi_fslot'],
        what: 'Volume sliders, one per channel. They set how much of each channel goes to the speakers. A switch in the master section chooses the fader curve: how the volume rises as the fader moves.',
        use: 'In many house and techno sets, the DJ brings in the new track by raising its channel fader slowly over several bars. If a fader is down, that channel is not heard in the room, even if it is playing.',
        crowd: 'A slow fade feels like one track growing out of another.'
      },
      {
        id: 'xassign', name: 'Crossfader assign switches', meshes: ['xi_xassign'],
        what: 'A switch on each channel with three positions: A (left side of the crossfader), THRU (bypasses the crossfader) and B (right side).',
        use: 'DJs put one track on A and the next on B, then use the crossfader to blend. Channels set to THRU are not affected by the crossfader.',
        crowd: 'Nothing, but it decides which tracks the crossfader controls.'
      },
      {
        id: 'xfader', name: 'Crossfader', meshes: ['xi_xfader', 'xi_xslot'],
        what: 'A slider that blends between the A side and the B side. All the way left you hear only the channels set to A, all the way right only those set to B.',
        use: 'In hip-hop and scratch styles the crossfader is used much more than the channel faders, for quick cuts. Many house and techno DJs leave it in the middle.',
        crowd: 'A fast cut feels sharper and more energetic than a slow fade.'
      },
      {
        id: 'master', name: 'Master level knob', meshes: ['xi_mix1'],
        what: 'Sets how loud the whole mix is sent to the main speakers.',
        use: 'It is usually set once during the sound check and then left alone. The DJ controls loudness with the channel faders and keeps the master meters out of the red.',
        crowd: 'A clear sound at a safe level.'
      },
      {
        id: 'mmeter', name: 'Master level meters', meshes: ['xi_mmeter', 'dj_clip'],
        what: 'Two columns of lights (left and right) that show the level of the main mix. The CLIP light turns on when the level is too strong.',
        use: 'The DJ keeps the meters in the green and away from the red. A signal that is too strong sounds harsh and can damage speakers.',
        crowd: 'Clean sound. Distortion is one of the first things a crowd notices.'
      },
      {
        id: 'booth', name: 'Booth controls', meshes: ['dj_boothhi', 'dj_boothlo', 'dj_boothlevel'],
        what: 'Controls for the monitor speakers in the DJ booth. BOOTH LEVEL sets their volume. BOOTH EQ HI and LOW can cut by 12 dB or boost by 6 dB, so the monitors can be tuned to the booth without changing what the crowd hears.',
        use: 'Booths often have strange acoustics. The DJ adjusts these to hear the bass and the beat clearly.',
        crowd: 'Nothing: the crowd hears the main speakers, not the booth monitors.'
      },
      {
        id: 'mastercue', name: 'Master cue buttons', meshes: ['dj_mastercue'],
        what: 'Buttons that send the master mix (the mix the crowd hears) to the headphones, to output A or B.',
        use: 'A DJ can listen to the main mix in the headphones to check what the crowd is hearing.',
        crowd: 'Nothing.'
      },
      {
        id: 'phonesB', name: 'Headphones B controls', meshes: ['dj_mixb', 'dj_levelb'],
        what: 'The mix and level knobs for the second headphone output. They work like the ones for headphones A: the mix knob blends cue and master, and the level knob sets the volume.',
        use: 'They let a second person listen to their own blend at their own volume.',
        crowd: 'Nothing.'
      },
      {
        id: 'curves', name: 'EQ and fader curve switches', meshes: ['dj_eqcurve', 'dj_chcurve', 'dj_xcurve'],
        what: 'Three switches. EQ CURVE changes the three knobs from an equaliser (a gentle cut or boost) into an isolator (which can remove a band completely). CH FADER chooses how the channel fader rises. CROSSFADER chooses how quickly the crossfader opens the other side.',
        use: 'With a steep crossfader curve a tiny movement cuts one sound in and the other out, which is what scratch DJs want. A gradual curve gives smooth blends.',
        crowd: 'Smooth blends or sharp cuts, depending on the settings.'
      },
      {
        id: 'send', name: 'Send channel and level', meshes: ['dj_sendch', 'dj_sendlevel'],
        what: 'Part of the connection for an outside effect unit. The channel knob chooses which channel (or the master mix) is sent out. The level knob sets how much is sent.',
        use: 'A DJ with their own effects box or a phone can send one channel through it and bring the result back.',
        crowd: 'A sound that is personal to the DJ.'
      },
      {
        id: 'insert', name: 'Insert button and source', meshes: ['dj_insert', 'dj_insertsrc'],
        what: 'The INSERT button turns on the insert method: the sound of the channel is replaced by the sound that comes back from the outside effect. The switch next to it chooses where that returning sound comes from.',
        use: 'It is how an outside effects unit is made a part of the channel, instead of only being added on the side.',
        crowd: 'Nothing directly.'
      },
      {
        id: 'screen', name: 'Beat FX screen', meshes: ['dj_fxscreen'],
        what: 'A screen that shows the tempo (BPM), whether it is measured automatically or tapped in, the name of the chosen effect, how many beats the effect is set to, and where a finger is on the X-PAD.',
        use: 'The DJ checks that the tempo is right. If the number blinks the mixer could not measure it, and the DJ taps it in.',
        crowd: 'Nothing, but a correct tempo is what keeps the effect in time.'
      },
      {
        id: 'xpad', name: 'X-PAD', meshes: ['dj_xpad'],
        what: 'A touch pad. Touching it turns the Beat FX on, and letting go turns it off. Sliding a finger changes the time or another parameter of the effect.',
        use: 'DJs use it for a short burst of effect, such as an echo on the last beat of a phrase, and for sweeping effects by hand.',
        crowd: 'A quick burst that lights up a moment in the music.'
      },
      {
        id: 'beat', name: 'Beat arrow buttons', meshes: ['dj_beat'],
        what: 'Two buttons that shorten or lengthen the length of the effect in beats (1/4, 1/2, 3/4, 1/1 and so on). For some effects they show other parameters.',
        use: 'A short echo of 1/4 beat makes a fast flutter. An echo of one beat or more makes a long, slow trail.',
        crowd: 'The rhythm of the effect: fast and busy, or slow and spacious.'
      },
      {
        id: 'tap', name: 'Auto/tap, tap and quantize', meshes: ['dj_autotap', 'dj_tap', 'dj_quantize'],
        what: 'AUTO/TAP chooses how the tempo is found: AUTO measures it from the music (70 to 180 BPM), TAP lets you set it by hand. TAP is pressed in time with the beat to set the tempo. QUANTIZE makes the effect lock to the beat grid of the player.',
        use: 'When the music is hard to measure, for example a track with no steady kick drum, the DJ taps the tempo in.',
        crowd: 'An effect that lands exactly on the beat.'
      },
      {
        id: 'fxfreq', name: 'FX frequency buttons', meshes: ['dj_fxfreq'],
        what: 'Three buttons (LOW, MID and HI) that choose which part of the sound the effect is applied to.',
        use: 'An echo on only the high part of a track leaves the kick drum and bass clean, which keeps the beat strong.',
        crowd: 'A clean beat with a shimmering effect on top.'
      },
      {
        id: 'fxsel', name: 'Beat FX selector', meshes: ['dj_fxsel'],
        what: 'A knob that chooses the effect, such as a delay, an echo, a reverb, a flanger, a phaser, a filter, or one that cuts the sound in time with the beat.',
        use: 'The DJ picks an effect that suits the track. Echo and reverb are used most, because they hide a transition well.',
        crowd: 'The effect type shapes the feeling: spacious, sweeping or chopped.'
      },
      {
        id: 'chsel', name: 'Channel select buttons', meshes: ['dj_chsel'],
        what: 'Buttons that choose which channel the effect is applied to: channels 1 to 4, the microphone, crossfader side A or B, or the master mix.',
        use: 'Applying the effect to one channel changes only that track. Applying it to the master changes everything.',
        crowd: 'A change in one layer of the music, or in the whole sound.'
      },
      {
        id: 'fxtime', name: 'Beat FX time knob', meshes: ['dj_fxtime'],
        what: 'Adjusts the time of the effect, for example how long an echo lasts. In tap mode it also sets the tempo.',
        use: 'Turning it while the effect is on makes the echo speed up or slow down, which is a strong effect in itself.',
        crowd: 'A sound that bends and moves.'
      },
      {
        id: 'fxdepth', name: 'Beat FX level/depth knob', meshes: ['dj_fxdepth'],
        what: 'Sets how much of the effect is heard. All the way to the left, only the original sound is heard.',
        use: 'The DJ sets it before turning the effect on, so the effect arrives at the right strength.',
        crowd: 'The effect arrives at just the right amount.'
      },
      {
        id: 'fxon', name: 'Beat FX on/off button', meshes: ['dj_fxon'],
        what: 'Turns the Beat FX on and off. The button blinks while the effect is on.',
        use: 'It is pressed on the beat, so the effect starts together with the music. Pressing again ends it.',
        crowd: 'The moment when the effect begins is often the moment the crowd reacts.'
      },
      {
        id: 'inputs', name: 'Back panel: line and phono inputs', meshes: ['xr_line', 'xr_phono', 'xr_digital'],
        what: 'On the back, each channel has a pair of line sockets (for media players), a pair of phono sockets (for turntables) and a digital input. Left and right are separate sockets.',
        use: 'The media players are connected here with cables, and the input selector on the front chooses which socket each channel plays.',
        crowd: 'Nothing. Good cabling means no hum or crackle.'
      },
      {
        id: 'outputs', name: 'Back panel: outputs and microphones', meshes: ['xr_booth', 'xr_master', 'xr_master2', 'xr_mic', 'xr_mains'],
        what: 'The sockets that send the sound out: the booth monitors (two 6.3 mm sockets), the main speakers (two balanced XLR sockets) and a second pair of outputs. There are also two microphone sockets and the power socket.',
        use: 'The cables from the booth sockets run to the monitor speakers by the DJ. The main outputs go to the amplifiers for the room.',
        crowd: 'The main outputs are what the crowd hears.'
      }
    ]
  },

  /* ======================= TURNTABLE ======================= */
  turntable: {
    label: 'Turntable',
    file: 'assets/models/turntable.glb',
    k: 4.0 / 64,                      // the original model is 64 units wide
    center: true,
    summary: 'Plays a vinyl record. The DJ controls the speed and the starting point by hand.',
    parts: [
      {
        id: 'record', name: 'Record', meshes: ['table_sm_turn_plade_mat_0'],
        what: 'The vinyl disc that holds the music, stored as one long spiral groove cut into the surface. The label in the middle says what is on it.',
        use: 'A record holds a limited amount of music, so DJs carry a bag of them and choose each one by hand. Dust and scratches turn into noise, so records are handled and stored with care.',
        crowd: 'Nothing visible from the floor, but watching a DJ change records is part of what many people enjoy about a vinyl set.'
      },
      {
        id: 'tonearm', name: 'Tonearm and stylus',
        meshes: ['arm_msh_metal_mat_0', 'arm_msh_phongE4_0', 'needle_system_msh_needle_mat_0', 'needle_msh_metal_mat1_0', 'turner_msh_phongE4_0', 'turner_msh_metal_mat_0'],
        what: 'The arm that carries the stylus (the needle) along the groove. The stylus follows the tiny wiggles in the groove, and the cartridge turns that movement into an electrical signal.',
        use: 'The DJ sets the weight of the arm so the stylus stays in the groove while the record is touched, nudged or scratched. The signal then goes to the mixer like any other source.',
        crowd: 'If the stylus jumps out of the groove, the music skips or stops. Loud bass can shake a turntable, so DJs place them where the vibration does not reach them.'
      },
      {
        id: 'cue', name: 'Cueing lever', meshes: ['polySurface10_phongE4_0'],
        what: 'A small lever that lifts the tonearm off the record and lowers it again smoothly.',
        use: 'The DJ lifts the arm, moves it to the start of a track and lowers it at the right moment, instead of dropping the needle by hand and risking a scratch.',
        crowd: 'A needle that lands cleanly on the start of a track makes the next song begin right on time.'
      },
      {
        id: 'platter', name: 'Platter and slipmat', meshes: ['table_sm_tt_sp_mat_0', 'table_sm_metal_mat_0'],
        what: 'The spinning plate the record sits on, with a felt slipmat between them. The slipmat lets the record slip under a hand while the platter keeps turning at full speed.',
        use: 'The DJ can hold the record still with a hand, keep a track ready to go, and release it on the beat. Pushing it forward or back a little brings two tracks into time, and scratching moves it back and forth under the stylus.',
        crowd: 'A track that is released exactly on the beat joins the rhythm without a gap, and a scratch adds a sound that only a hand on the record can make.'
      },
      {
        id: 'startstop', name: 'Start/stop button', meshes: ['polySurface14_phongE4_0', 'polySurface14_metal_mat_0'],
        what: 'Starts and stops the platter. DJ turntables are built to reach full speed very quickly, so the music starts almost at once.',
        use: 'The DJ presses it at the right beat, often with a finger holding the record in place, so the new track starts in time with the one that is playing.',
        crowd: 'A new track that starts on the beat slots into the rhythm and the crowd never notices the join.'
      },
      {
        id: 'speed', name: '33 and 45 buttons',
        meshes: ['polySurface12_phongE4_0', 'polySurface12_metal_mat_0', 'polySurface13_phongE4_0', 'polySurface13_metal_mat_0'],
        what: 'Two buttons that switch the platter between the two standard record speeds: 33 and 45 revolutions per minute (rpm).',
        use: 'Most albums play at 33 rpm and many singles play at 45. The DJ picks the speed the record was made for.',
        crowd: 'At the wrong speed a record sounds too slow and low or too fast and high, so this choice is made before the track ever reaches the crowd.'
      },
      {
        id: 'pitch', name: 'Pitch fader', meshes: ['speed_sm_metal_mat_0'],
        what: 'A slider that makes the platter run slightly faster or slower. The range is around eight percent either way, and a lamp shows when it is at the centre, at normal speed.',
        use: 'To blend two records their tempos must match. The DJ listens to both, moves the pitch fader, and nudges the record by hand until the beats stay together. This is beatmatching, done entirely by ear.',
        crowd: 'A steady beat. When tempos drift apart, the two kick drums stop landing together and the rhythm feels unsteady.'
      },
      {
        id: 'light', name: 'Target light (stylus lamp)', meshes: ['polySurface11_metal_mat_0'],
        what: 'A small pop-up lamp that shines on the tip of the stylus. When it is not needed it is pushed down into the turntable; pressing its switch raises it again.',
        use: 'Club booths are dark, and a stylus is tiny. The lamp lets the DJ see exactly where the needle is, so it can be lowered into the first groove of the right track without a mistake.',
        crowd: 'Nothing directly. It is one of the small details that lets a DJ work in the dark.'
      },
      {
        id: 'power', name: 'Power switch and strobe lamp', meshes: ['polySurface15_phongE7_0', 'polySurface15_metal_mat_0', 'polySurface15_body_top_mat_0'],
        what: 'The knob that switches the turntable on and off. When it is on, a blue lamp lights and shines on the row of dots around the edge of the platter. If the platter runs at exactly the right speed, those dots seem to stand still. Each time the power is switched on, the speed is set to 33 rpm.',
        use: 'The DJ switches it on before the set and checks the dots to see whether the platter is running at its normal speed or whether the pitch fader has changed it. The start/stop button stops the platter with an electronic brake, so the power should only be switched off after the platter has stopped.',
        crowd: 'Nothing directly. A turntable that is ready and running at the right speed is what lets the music start on time.'
      },
      {
        id: 'antiskate', name: 'Anti-skating dial', meshes: ['polySurface18_phongE4_0', 'polySurface18_body_top_mat_0'],
        what: 'A dial beside the tonearm. As the record turns, the stylus is pulled gently towards the centre of the record. The anti-skating dial pulls the arm back by the same amount, so the stylus presses evenly on both walls of the groove. The rule from the manual is to set it to the same value as the stylus pressure.',
        use: 'The DJ sets it once, together with the weight of the arm, and then leaves it. If it is set far from the right value, the stylus presses harder on one wall of the groove: the sound becomes distorted and the stylus can jump out of the groove, especially during scratching or loud bass.',
        crowd: 'If it is wrong, the crowd hears a track that skips or sounds harsh. If it is right, nobody notices it.'
      }
    ]
  },


  /* ======================= ANALOGUE CLUB MIXER (drawn in code) ======================= */
  xone: {
    label: 'Mixer',
    build: 'xone',
    center: true,
    summary: 'The centre of the analog setup. Both turntables plug into it. It balances and blends them with equalisers, filters and faders, and sends the result to the speakers and the DJ’s headphones. This one is a look-alike of a six-channel analogue club mixer (four main channels and two mic or return channels), drawn for this project. Every control is grouped by what it does.',
    parts: [
      {
        id: 'aux1', name: 'Aux 1 send knobs', meshes: ['xi_aux1'],
        what: 'A small knob on each of the four main channels. It sends some of that channel out to whatever is plugged into the Aux 1 connection, for example an echo or reverb unit.',
        use: 'The DJ turns it up on one record only, so that record alone gets the echo or reverb. The effect then returns to the mixer through its own return channel.',
        crowd: 'A trailing echo or a wash of reverb that lets one record dissolve into the next.'
      },
      {
        id: 'aux2', name: 'Aux 2 send knobs', meshes: ['xi_aux2'],
        what: 'The same kind of knob as Aux 1, but for the second aux connection. It sends part of the channel to a second outside unit.',
        use: 'It lets the DJ keep two different effects ready at once, for example a delay on Aux 1 and a reverb on Aux 2, and choose which record gets which.',
        crowd: 'Different tails on different records, which makes a transition sound more varied.'
      },
      {
        id: 'pre', name: 'Aux pre/post buttons', meshes: ['xi_pre'],
        what: 'A small button under each aux knob. It chooses whether the signal is sent before the channel fader (pre) or after it (post).',
        use: 'With pre, the effect keeps playing even when the channel fader is pulled down, so a record can be faded out and leave only its echo behind. With post, the effect fades with the record.',
        crowd: 'An echo that carries on after the record has gone is a classic way to end a section.'
      },
      {
        id: 'input', name: 'Input selector buttons (phono / line)', meshes: ['xi_input'],
        what: 'A button on each main channel that chooses what the channel plays: phono, for a turntable, or line, for a media player or laptop.',
        use: 'A turntable must be set to phono, where the mixer boosts the very weak signal from the needle and corrects its sound. The connectors themselves are on the back panel.',
        crowd: 'Nothing, unless it is wrong. A turntable on a line input sounds very quiet and thin.'
      },
      {
        id: 'trim', name: 'Level knobs', meshes: ['xi_trim'],
        what: 'A knob on each main channel that sets how strong the incoming signal is, before the EQ and the fader.',
        use: 'Records are cut at different volumes. The DJ adjusts the level until the new record is as loud as the one playing, watching the channel meter, so the volume stays steady across a transition.',
        crowd: 'A steady volume. Without it, a quiet record feels like the energy dropped and a loud one can hurt.'
      },
      {
        id: 'eqhi', name: 'EQ: HI (high frequencies)', meshes: ['xi_hi'],
        what: 'The top knob of the EQ on each main channel. It controls the highest part of the sound, centred around 2.4 kHz: hi-hats, cymbals, the hiss of a vocal. It can boost by 6 dB or cut all the way down to nothing.',
        use: 'The DJ cuts the highs to soften a harsh record or to make the incoming record less obvious, and turns them up to make a dull record brighter. Cutting them completely is called a kill.',
        crowd: 'Brightness and sparkle. When the highs are cut the music feels muffled, and when they come back it feels like the room opens up.'
      },
      {
        id: 'eqhm', name: 'EQ: HM (upper mid-range)', meshes: ['xi_hm'],
        what: 'The second EQ knob on each main channel. It controls the upper middle of the sound, centred around 1.8 kHz, where vocals, snares and lead synths live. It can boost by 6 dB or cut by 30 dB.',
        use: 'The DJ lowers it on one record when two vocals or two lead sounds would clash, so that only one of them is heard clearly.',
        crowd: 'Clear vocals and lead lines. Two of them at once sound crowded, and the crowd hears that as mud.'
      },
      {
        id: 'eqlm', name: 'EQ: LM (lower mid-range)', meshes: ['xi_lm'],
        what: 'The third EQ knob on each main channel. It controls the lower middle of the sound, centred around 320 Hz, where the body of drums, the warmth of a bass and low vocals sit. It can boost by 6 dB or cut by 30 dB.',
        use: 'The DJ cuts it to clean up a thick, boxy mix, or boosts it to give a thin record more body.',
        crowd: 'Warmth and weight. Too much of it sounds muddy and too little sounds thin.'
      },
      {
        id: 'eqlo', name: 'EQ: LO (bass)', meshes: ['xi_lo'],
        what: 'The bottom EQ knob on each main channel. It controls the bass, centred around 220 Hz: the kick drum and the bass line. It can boost by 6 dB or cut all the way down to nothing.',
        use: 'The DJ cuts the bass on the incoming record, brings it in, then swaps: bass out on the old record and bass in on the new one. Two bass lines playing together would clash.',
        crowd: 'The low end drops away and then returns. The moment the bass comes back is one of the most familiar ways a DJ builds tension and releases it.'
      },
      {
        id: 'assign', name: 'Filter assign switches', meshes: ['xi_assign'],
        what: 'A three-way switch on each main channel that sends the channel through filter 1, through filter 2, or through neither (off).',
        use: 'The DJ can sweep a filter on one record without touching the one that is playing alongside it, for example to fade a record out gradually.',
        crowd: 'A gradual change in the character of the music, with no change in volume.'
      },
      {
        id: 'xassign', name: 'Crossfader assign switches', meshes: ['xi_xassign'],
        what: 'A three-way switch on each main channel that decides which side of the crossfader the channel belongs to: X, Y, or off, which bypasses the crossfader.',
        use: 'The DJ puts the record on one deck on side X and the record on the other deck on side Y, so that the crossfader moves between them. A channel set to off is controlled only by its own fader.',
        crowd: 'Nothing directly. It decides what the crossfader does when it moves.'
      },
      {
        id: 'cue', name: 'Channel cue buttons', meshes: ['xi_cue'],
        what: 'A round button on each main channel that sends that channel to the DJ’s headphones, whether or not it is playing for the crowd.',
        use: 'This is how the DJ listens to the next record privately, finds its first beat and matches its speed, before the crowd hears it.',
        crowd: 'Nothing audible. Every smooth transition was first rehearsed here.'
      },
      {
        id: 'meters', name: 'Channel meters', meshes: ['xi_meter'],
        what: 'A column of nine lights next to each fader that shows how loud the channel is, from -20 up to +10. Green is a healthy level, amber is getting loud and red is too loud.',
        use: 'The DJ sets the level knob so the lights reach the same height for each record, and watches for red, which is a sign that the sound is about to distort.',
        crowd: 'A clean sound. Distortion in a loud room is unpleasant and can damage speakers.'
      },
      {
        id: 'faders', name: 'Channel faders', meshes: ['xi_fader', 'xi_fslot'],
        what: 'A 60 mm slider on each main channel that sets how loud that channel is in what the crowd hears. Down is silent, up is full.',
        use: 'Mixing is mostly done with these. The DJ slides the next record in while the old one slides out, so a transition can be as long or as short as the music needs.',
        crowd: 'A long, slow fade feels like one song turning into another. A fast cut feels like a sudden change of mood.'
      },
      {
        id: 'maux', name: 'Mic / return aux sends', meshes: ['xi_maux'],
        what: 'The two aux knobs and their pre/post buttons on each of the two mic and return channels. They send part of the microphone or return signal to the outside effects units.',
        use: 'The DJ can add a little reverb or echo to a voice, so that it sits in the music instead of on top of it.',
        crowd: 'A voice that sounds like it belongs to the room, instead of a dry voice pasted over the music.'
      },
      {
        id: 'minput', name: 'Mic / return switches', meshes: ['xi_minput'],
        what: 'A button on each of the two extra channels that chooses what the channel plays: a microphone, or the return from an external device through a 1/4 inch socket on the back.',
        use: 'A microphone goes to the XLR socket, and a drum machine or sampler goes to the return socket. The DJ chooses with this button.',
        crowd: 'Nothing, except that the right thing is heard.'
      },
      {
        id: 'mlevel', name: 'Mic / return level knobs', meshes: ['xi_mlevel'],
        what: 'A knob on each extra channel that sets how strong the microphone or return signal is.',
        use: 'A quiet voice needs more level and a loud one needs less. The DJ sets it during the sound check so that the voice is clear but never feeds back.',
        crowd: 'A voice that can be understood. Too little and nobody hears it, too much and the speakers whistle.'
      },
      {
        id: 'mhi', name: 'Mic / return EQ: HI', meshes: ['xi_mhi'],
        what: 'The high knob on each extra channel, centred around 12 kHz, the very top of the sound. It can boost or cut by 15 dB, which is a wider range than on the main channels.',
        use: 'It adds air and clarity to a voice, or takes away sharp, hissy sounds.',
        crowd: 'A voice that is crisp, but not piercing.'
      },
      {
        id: 'mhm', name: 'Mic / return EQ: HM', meshes: ['xi_mhm'],
        what: 'The upper mid knob on each extra channel, centred around 2.7 kHz, where speech is easiest to understand. It can boost or cut by 15 dB.',
        use: 'Boosting it makes words easier to understand over loud music.',
        crowd: 'Words that carry to the back of the room.'
      },
      {
        id: 'mlm', name: 'Mic / return EQ: LM', meshes: ['xi_mlm'],
        what: 'The lower mid knob on each extra channel, centred around 270 Hz, where a voice can sound boomy. It can boost or cut by 15 dB.',
        use: 'Cutting it removes the boxy, muddy sound that a microphone can pick up when it is held close.',
        crowd: 'A voice that is clean and not muddy.'
      },
      {
        id: 'mlo', name: 'Mic / return EQ: LO', meshes: ['xi_mlo'],
        what: 'The low knob on each extra channel, centred around 60 Hz, below most of a voice. It can boost or cut by 15 dB.',
        use: 'The DJ turns it down to remove the rumble of someone handling the microphone or a thump when it is touched.',
        crowd: 'No thumps or rumble coming out of the speakers.'
      },
      {
        id: 'mcue', name: 'Mic / return cue buttons', meshes: ['xi_mcue'],
        what: 'A button on each extra channel that sends it to the DJ’s headphones.',
        use: 'The DJ can check a microphone or a returning effect privately before it is heard by the crowd.',
        crowd: 'Nothing audible. It prevents a surprise, such as a loud pop, from reaching the speakers.'
      },
      {
        id: 'mduck', name: 'Duck switches', meshes: ['xi_mduck'],
        what: 'A switch on each extra channel. When it is on, the music is turned down automatically whenever someone is speaking into that channel, and returns when they stop.',
        use: 'The DJ or an MC can talk over the music without touching a fader. The music dips under the voice and comes back by itself.',
        crowd: 'A voice that is easy to hear over the music, and the music returning smoothly afterwards.'
      },
      {
        id: 'mfaders', name: 'Mic / return faders', meshes: ['xi_mfader', 'xi_mslot'],
        what: 'A slider on each of the two extra channels. It sets how loud the microphone or the returning device is in the mix.',
        use: 'This is not the same as a channel fader. It controls the voice or the external device, not a record, and it usually stays in one place while the DJ is busy mixing the records.',
        crowd: 'A voice that comes in at a comfortable level. Pushing it up too far makes it feel like shouting.'
      },
      {
        id: 'hpf', name: 'HPF buttons (high-pass filter)', meshes: ['xi_hpf'],
        what: 'A button in each filter section that sets the filter to high-pass. A high-pass filter lets the highs through and removes the low frequencies.',
        use: 'As the frequency knob is turned up, more and more of the bass disappears, until only a thin, tinny sound is left. It is often used to build tension before the bass comes back.',
        crowd: 'A rising, thinning sweep. The crowd feels something is about to happen.'
      },
      {
        id: 'bpf', name: 'BPF buttons (band-pass filter)', meshes: ['xi_bpf'],
        what: 'A button in each filter section that sets the filter to band-pass. A band-pass filter lets a narrow band of the sound through and removes both the lows and the highs.',
        use: 'Moving the frequency knob sweeps that narrow band up and down, which gives a whistling, vocal-like sound.',
        crowd: 'A distinctive, almost speaking sweep. It is more dramatic than the other two types.'
      },
      {
        id: 'lpf', name: 'LPF buttons (low-pass filter)', meshes: ['xi_lpf'],
        what: 'A button in each filter section that sets the filter to low-pass. A low-pass filter lets the lows through and removes the high frequencies.',
        use: 'As the frequency knob is turned down, the music gets duller, as if it were behind a wall. It is often used to fade a record out, or to bring a new one in from far away.',
        crowd: 'A muffled sound that gradually opens up as the DJ brings it back.'
      },
      {
        id: 'freq', name: 'Filter frequency knobs', meshes: ['xi_freq'],
        what: 'The large knob in each filter section. It sets the point where the filter starts to work, and moving it makes the sweep.',
        use: 'This is the knob the DJ turns during a build-up. The direction it moves in depends on the filter type that is chosen.',
        crowd: 'The sweep itself. A slow turn builds the tension and a quick turn creates a sudden change.'
      },
      {
        id: 'res', name: 'Filter resonance knobs', meshes: ['xi_res'],
        what: 'A knob in each filter section, from mild to wild. It adds a sharp, whistling emphasis at the point where the filter is working.',
        use: 'A little resonance makes the sweep easier to hear. A lot makes it screech, which is used for dramatic moments.',
        crowd: 'A sweep that stands out from the music, and a bigger reaction on the dancefloor.'
      },
      {
        id: 'fon', name: 'Filter on buttons', meshes: ['xi_fon'],
        what: 'A large button at the bottom of each filter section that switches that filter on and off.',
        use: 'The DJ sets the filter up while it is off, then switches it on at the right beat so it comes in with the music.',
        crowd: 'The filter appears exactly on the beat, instead of creeping in.'
      },
      {
        id: 'vx', name: 'VCF to crossfader buttons', meshes: ['xi_vx'],
        what: 'A button in each filter section that ties the filter to the crossfader, so that the crossfader movement also moves the filter. (VCF stands for voltage controlled filter, the type of filter used here.)',
        use: 'It lets the DJ blend two records and sweep a filter in a single movement of one hand.',
        crowd: 'A transition that feels bigger than a normal blend, because the sound changes character as it moves.'
      },
      {
        id: 'vlink', name: 'VCF link 2-1 button', meshes: ['xi_vlink'],
        what: 'A button on filter 2 only. It links the two filters, so that filter 2 follows what filter 1 is doing.',
        use: 'The DJ can sweep both filters at once with one knob, for example to apply the same effect to two records.',
        crowd: 'A bigger, more powerful sweep over the whole mix.'
      },
      {
        id: 'lfod', name: 'LFO depth knobs', meshes: ['xi_lfod'],
        what: 'A knob in each filter section that sets how far the LFO moves the filter, from min to max. An LFO is a low frequency oscillator: a slow, repeating wave.',
        use: 'With the depth turned up, the filter sweeps up and down by itself. With it turned down, there is no movement. The DJ’s hands are free to mix the next record.',
        crowd: 'A pulsing movement in the sound that follows the beat.'
      },
      {
        id: 'lfoon', name: 'LFO on buttons', meshes: ['xi_lfoon'],
        what: 'A button in each filter section that switches the LFO on or off.',
        use: 'The DJ turns it on when the pulsing movement is wanted and off when the sound should be steady.',
        crowd: 'The pulsing starts or stops on cue.'
      },
      {
        id: 'x2', name: 'X2 tempo buttons', meshes: ['xi_x2'],
        what: 'A button in each filter section that doubles the speed of the LFO.',
        use: 'It changes a slow pulse into a faster one without having to tap the tempo again.',
        crowd: 'A pulse that suddenly feels twice as fast and more energetic.'
      },
      {
        id: 'tap', name: 'Tap buttons', meshes: ['xi_tap'],
        what: 'A large button in each filter section. The DJ taps it along with the beat, and the mixer sets the LFO speed to match.',
        use: 'It keeps the filter movement in time with the record, with no maths and no screen.',
        crowd: 'A filter movement that locks into the groove.'
      },
      {
        id: 'tempo', name: 'Tempo adjust knob', meshes: ['xi_tempo'],
        what: 'A knob at the top of the panel that makes small corrections to the LFO speed, from min to max.',
        use: 'If the tapped tempo drifts away from the record, the DJ turns this to bring it back in time.',
        crowd: 'A pulse that stays in time with the music.'
      },
      {
        id: 'startstop', name: 'Start / stop button', meshes: ['xi_startstop'],
        what: 'A button next to the tempo knob that starts and stops the LFO.',
        use: 'The DJ starts the LFO exactly on the first beat of a bar, so that the movement begins at the right moment.',
        crowd: 'A movement that begins on the beat.'
      },
      {
        id: 'xfader', name: 'Crossfader', meshes: ['xi_xfader', 'xi_xslot'],
        what: 'A 45 mm slider that blends between the two sides, X and Y. Channels assigned to side X play when it is at the left, and channels assigned to side Y play when it is at the right.',
        use: 'It lets the DJ move from one record to the other with a single movement. Many DJs also use it for fast cuts and scratching, which is why it is placed at the front within easy reach. It can be changed by the user when it wears out.',
        crowd: 'A cut or blend between two records, with no gap and no break in the rhythm.'
      },
      {
        id: 'xcurve', name: 'Crossfader curve button', meshes: ['xi_xcurve'],
        what: 'A button next to the crossfader that changes how it behaves: either a smooth blend as it moves, or a sharp cut that is heard almost at once.',
        use: 'A scratch DJ chooses the sharp cut so that a tiny movement is enough. A DJ who blends long transitions chooses the smooth blend.',
        crowd: 'The difference between a long, gentle blend and a quick, punchy cut.'
      },
      {
        id: 'chcurve', name: 'Channel fader curve switch', meshes: ['xi_chcurve'],
        what: 'A three-way switch next to the crossfader that sets how all four channel faders behave, from a gradual rise in volume to a sharp one.',
        use: 'It is set once to suit the DJ’s style, and it changes how much of the fader’s travel is used for a transition.',
        crowd: 'Nothing directly. It changes how smooth or sharp the DJ’s transitions feel.'
      },
      {
        id: 'mmeters', name: 'Master meters', meshes: ['xi_mmeter'],
        what: 'Two columns of nine lights at the top of the right-hand panel that show the level of the main mix that is sent to the speakers. Green is healthy, amber is loud and red is too loud.',
        use: 'The DJ watches that the mix does not stay in the red. A signal that is too strong sounds harsh and can damage the speakers.',
        crowd: 'A clear sound at a safe level.'
      },
      {
        id: 'mix1', name: 'Mix 1 level knob', meshes: ['xi_mix1'],
        what: 'A knob that sets the overall level of the Mix 1 output. This output uses a balanced XLR connection, which is built for the long cable runs to the main speakers.',
        use: 'It is set during the sound check and then left. The loudness of the music is controlled with the channels, not here.',
        crowd: 'The overall loudness of the room, set so the loudest moment stays clear of distortion.'
      },
      {
        id: 'mix2', name: 'Mix 2 level knob', meshes: ['xi_mix2'],
        what: 'A knob that sets the overall level of the Mix 2 output, a second main output. It can feed a second room, a recorder or a second set of speakers.',
        use: 'Because it has its own level, it can be set differently from Mix 1, for example lower in a smaller room.',
        crowd: 'A second room that can be loud or quiet independently of the main floor.'
      },
      {
        id: 'mono', name: 'Booth mono button', meshes: ['xi_mono'],
        what: 'A button that switches the booth output between stereo and mono.',
        use: 'A booth monitor is often a single speaker, or the DJ stands between two, so a mono signal can sound more even.',
        crowd: 'Nothing. It only affects what the DJ hears in the booth.'
      },
      {
        id: 'booth', name: 'Booth level knob', meshes: ['xi_booth'],
        what: 'A knob that sets the level of the booth output, which feeds the monitor speakers in the DJ booth.',
        use: 'The DJ sets it so the monitors are loud enough to hear over the room without being uncomfortable. It is separate from the main outputs, so turning it up does not make the crowd’s sound louder.',
        crowd: 'Nothing. It lets the DJ hear the music clearly while the crowd hears it from the main speakers.'
      },
      {
        id: 'mute', name: 'Booth mute button', meshes: ['xi_mute'],
        what: 'A button that switches the booth monitors off.',
        use: 'The DJ can silence the booth quickly, for example when a microphone is open near the monitor and would whistle.',
        crowd: 'No feedback squeal in the room.'
      },
      {
        id: 'posteq', name: 'Monitor: post-EQ button', meshes: ['xi_posteq'],
        what: 'A button in the monitor section that chooses whether the headphone signal is taken after the channel EQ, so that the DJ hears the EQ changes in the headphones.',
        use: 'The DJ can check an EQ change privately before the crowd hears it.',
        crowd: 'Nothing audible. It lets a change be tested first.'
      },
      {
        id: 'split', name: 'Monitor: split cue button', meshes: ['xi_split'],
        what: 'A button that splits the headphone signal: the cued channel goes to one ear and the main mix goes to the other.',
        use: 'It lets the DJ compare the record that is playing with the one that is being cued, side by side, to match their beats.',
        crowd: 'Cleaner transitions, because the beats were lined up by ear.'
      },
      {
        id: 'aux1m', name: 'Monitor: aux 1 button', meshes: ['xi_aux1m'],
        what: 'A button that lets the DJ listen in the headphones to what is being sent out on the aux 1 connection.',
        use: 'The DJ can check the effect that is being sent out and returned before it is heard by the crowd.',
        crowd: 'Nothing audible. It is a way to check an effect.'
      },
      {
        id: 'aux2m', name: 'Monitor: aux 2 button', meshes: ['xi_aux2m'],
        what: 'The same as the aux 1 button, but for what is being sent on the aux 2 connection.',
        use: 'The DJ can check the second effect on its own.',
        crowd: 'Nothing audible.'
      },
      {
        id: 'cuemix', name: 'Cue mix knob', meshes: ['xi_cuemix'],
        what: 'A knob that blends the headphone sound between the cued channel and the main mix, from cue only to mix only.',
        use: 'The DJ turns it towards cue to listen to the next record alone, and towards mix to hear what the crowd hears.',
        crowd: 'Nothing directly. It is the private half of the mix.'
      },
      {
        id: 'plevel', name: 'Headphone level knob', meshes: ['xi_plevel'],
        what: 'A knob that sets how loud the headphones are.',
        use: 'The DJ sets the level high enough to hear the beats over the room, but not so high as to damage the ears over a long night.',
        crowd: 'Nothing. It protects the DJ’s hearing.'
      },
      {
        id: 'jack', name: 'Headphone sockets', meshes: ['xi_jack'],
        what: 'The sockets where the headphones plug in, in the bottom right corner of the panel: a 1/4 inch socket and a smaller one.',
        use: 'They are on the front panel, within easy reach, so that the cable never gets in the way of the DJ’s hands.',
        crowd: 'Nothing.'
      }
      ,{
        id: 'xr_phono', name: 'Phono inputs (back panel)', meshes: ['xr_phono'],
        what: 'Four pairs of red-and-white style sockets, one pair for each main channel, marked PHONO. A turntable plugs in here, one cable for the left channel and one for the right.',
        use: 'Turntables put out a very weak signal. The phono input boosts it and corrects its sound, which a normal line input cannot do. So the turntable is plugged in here and the channel\'s input button is set to phono.',
        crowd: 'If this is wrong the music is very quiet and thin. If it is right, nobody notices.'
      }
      ,{
        id: 'xr_line', name: 'Line inputs (back panel)', meshes: ['xr_line'],
        what: 'Four pairs of sockets, one pair for each main channel, marked LINE. Devices that already put out a full-strength signal plug in here, such as a media player, a laptop or a drum machine.',
        use: 'The DJ chooses with the channel\'s input button whether a channel listens to its phono or its line sockets. That way a turntable and a media player can share a channel and be switched between.',
        crowd: 'A track from a laptop or a media player blends with a record in the same mix.'
      }
      ,{
        id: 'xr_gnd', name: 'Ground terminal and phono earth screws', meshes: ['xr_gnd'],
        what: 'A screw terminal on the back, marked with the earth symbol, and a small screw between each pair of phono sockets. The turntable\'s thin earth wire is fastened here.',
        use: 'A turntable\'s signal is so weak that it picks up hum from the mains. The earth wire carries that hum away. Without it, a loud buzz comes from the speakers.',
        crowd: 'A buzz in the speakers ruins a quiet moment. A properly earthed turntable removes it.'
      }
      ,{
        id: 'xr_mic', name: 'Microphone inputs (back panel)', meshes: ['xr_mic'],
        what: 'Two three-pin sockets, marked MIC 1 and MIC 2, for professional microphones. Each has a small button above it marked CLEAN FEED.',
        use: 'A host or MC plugs a microphone in here. The mixer boosts the signal and sends it to the mic channel on the front panel, where it gets its own level, tone controls and duck switch.',
        crowd: 'Announcements and vocals that cut through the music.'
      }
      ,{
        id: 'xr_rtn', name: 'Return inputs (back panel)', meshes: ['xr_rtn'],
        what: 'Four jack sockets, two for each of the mic or return channels, marked RTN and L/M and R. They take a stereo signal that comes back from an outside effects unit, or any other extra source.',
        use: 'The effects unit is connected to the aux send, and its processed sound comes back in here. The DJ then mixes the effect in with the front-panel return controls.',
        crowd: 'Echoes, reverbs and other effects that make a transition more interesting.'
      }
      ,{
        id: 'xr_clean', name: 'Clean feed buttons', meshes: ['xr_clean'],
        what: 'Two small buttons, one for each microphone, marked CLEAN FEED ON/OFF. The name refers to sending a version of the sound without the effects or the DJ\'s own tone changes.',
        use: 'On a real mixer, buttons like these decide what the microphone\'s signal is sent along with. They are normally left alone once the sound check is done.',
        crowd: 'Nothing directly. They are set up before the night starts.'
      }
      ,{
        id: 'xr_mix1', name: 'Master outputs, Mix 1 (back panel)', meshes: ['xr_mix1'],
        what: 'Two three-pin sockets, marked LEFT and RIGHT, for the main output. This is the sound that goes to the big speakers on the dance floor.',
        use: 'These carry a balanced signal, which stays clean over long cables. A club\'s sound engineer connects the mixer here, and the mixer\'s master level then controls how loud the club is.',
        crowd: 'This is the sound the crowd hears, so everything the DJ does ends up here.'
      }
      ,{
        id: 'xr_mix2', name: 'Master outputs, Mix 2 (back panel)', meshes: ['xr_mix2'],
        what: 'A second pair of output sockets, marked MIX 2, for a second set of speakers, such as a lounge, a bar or a recording device.',
        use: 'The DJ can send the same mix to a second room, with its own level on the front panel.',
        crowd: 'People in a second room hear the same set without anyone moving the speakers.'
      }
      ,{
        id: 'xr_booth', name: 'Booth outputs (back panel)', meshes: ['xr_booth'],
        what: 'A pair of output sockets, marked BOOTH. They feed the monitor speakers in the DJ booth, the two speakers on either side of the setup.',
        use: 'The booth level has its own knob on the front panel, so the DJ can set how loud the booth is without changing what the crowd hears.',
        crowd: 'Nothing directly, but a DJ who hears the music clearly mixes better.'
      }
      ,{
        id: 'xr_rec', name: 'Record output (back panel)', meshes: ['xr_rec'],
        what: 'A pair of red and white sockets, marked RECORD, that send a copy of the mix to a recorder.',
        use: 'A DJ can plug a recorder or a computer in here to keep a copy of the set, or to broadcast it. The level of this output is not changed by the master knob.',
        crowd: 'Listeners of a recording or a live stream hear the same mix.'
      }
      ,{
        id: 'xr_aux1', name: 'Aux 1 send and return (back panel)', meshes: ['xr_aux1'],
        what: 'Two sockets, marked AUX 1, used to connect an outside effects unit.',
        use: 'Part of a channel is sent out through the aux knobs on the front panel, goes through the unit, and comes back in through the return sockets.',
        crowd: 'An echo or reverb that belongs to just one record.'
      }
      ,{
        id: 'xr_aux2', name: 'Aux 2 send and return (back panel)', meshes: ['xr_aux2'],
        what: 'The same kind of pair as Aux 1, for a second outside unit.',
        use: 'It lets the DJ keep a second effect ready, so two different effects can be used in one set.',
        crowd: 'A different effect on a different record.'
      }
      ,{
        id: 'xr_midi', name: 'MIDI output (back panel)', meshes: ['xr_midi'],
        what: 'A round five-pin socket, marked MIDI OUT. The mixer sends the positions of its knobs and buttons out through it as digital messages.',
        use: 'A DJ can plug a computer in and use the mixer to control software, for example to trigger effects. It carries no sound, only control messages.',
        crowd: 'Effects that follow the DJ\'s hands, controlled through the mixer.'
      }
      ,{
        id: 'xr_mains', name: 'Mains inlet and fuse (back panel)', meshes: ['xr_mains'],
        what: 'The socket where the mains cable plugs in, and the small holder next to it for the fuse that protects the mixer.',
        use: 'The mixer works on a normal mains supply anywhere in the world. If a fuse blows, the mixer is dead until it is replaced, so crews carry spares.',
        crowd: 'Nothing, unless it stops working.'
      }
      ,{
        id: 'xr_pswitch', name: 'Power switch (back panel)', meshes: ['xr_pswitch'],
        what: 'The switch that turns the mixer on and off.',
        use: 'The standard order is mixer first, then the amplifiers, so that no loud thump goes to the speakers. At the end of the night the order is reversed.',
        crowd: 'A thump through the speakers is one thing every DJ tries to avoid.'
      }
    ]
  },

  /* ======================= MONITOR SPEAKER ======================= */
  monitor: {
    label: 'Booth monitor',
    file: 'assets/models/monitor.glb',
    k: 7,                              // the original model is about 0.34 units wide
    center: true,
    summary: 'A speaker in the DJ booth that points at the DJ. It lets the DJ hear the music the crowd is hearing, with the room’s noise and delay left out.',
    parts: [
      {
        id: 'grille', name: 'Speaker grille', boxes: [['b', -0.155, -0.085, 0.02, 0.15, 0.112, 0.1]],
        what: 'The cloth covering the speaker. Behind it are the drivers: a larger one for bass and mid-range, and a smaller one for the highs.',
        use: 'The DJ listens here to check that two records are in time and that the bass is not clashing. Booth monitors are turned towards the DJ so the sound reaches the DJ directly.',
        crowd: 'The crowd cannot hear this speaker. What the crowd hears comes from the main speakers in the room, which sound different because of the space, the people in it and the delay.'
      },
      {
        id: 'cabinet', name: 'Cabinet', boxes: [['b', -0.2, -0.12, -0.1, 0.21, 0.15, 0.02], ['b', -0.2, -0.12, 0.02, -0.155, 0.15, 0.1], ['b', 0.15, -0.12, 0.02, 0.21, 0.15, 0.1],
          ['b', -0.155, -0.12, 0.02, 0.15, -0.085, 0.1], ['b', -0.155, 0.112, 0.02, 0.15, 0.15, 0.1]],           // everything except the grille
        what: 'The strong, textured box that holds the speaker, built to be moved and knocked. The wedge shape points the sound upwards, towards the DJ’s ears when the speaker is on the floor.',
        use: 'A booth monitor is set at about ear height or angled upwards, away from the mixer, so that its sound does not feed back into the microphones or the needles of the turntables.',
        crowd: 'Nothing. It is made to survive a night of club life, so it is heavy and tough.'
      }
    ]
  },

  /* ======================= HEADPHONES ======================= */
  headphones: {
    label: 'Headphones',
    file: 'assets/models/headphones.glb',
    k: 4.4,                            // the original model is about 0.4 units wide
    center: true,
    summary: 'How the DJ hears the next track in private, before the crowd hears it.',
    parts: [
      {
        id: 'cups', name: 'Ear cups and cushions',
        boxes: [['b', -1.91, 1.64, -1.57, -1.765, 1.835, -1.27], ['b', -1.7, 1.64, -1.57, -1.52, 1.835, -1.27]],
        what: 'The cups that cover the ears. The soft cushions seal against the head so that the sound inside stays clear and the loud room outside is blocked out.',
        use: 'The DJ plays the next track in the headphones and matches it to the one the crowd is hearing. In a loud room, a good seal is what makes this possible.',
        crowd: 'Nothing audible. But every smooth transition was first checked here.'
      },
      {
        id: 'hinge', name: 'Swivel and folding joints',
        boxes: [['b', -1.91, 1.835, -1.57, -1.83, 1.89, -1.27], ['b', -1.66, 1.835, -1.60, -1.49, 1.89, -1.24]],
        what: 'Joints where each cup meets the band. Many DJ headphones let a cup turn flat, so that one ear can be uncovered.',
        use: 'A DJ often listens with one cup over one ear and the other ear free, to hear the headphones and the room at the same time. Some DJs press one cup between the ear and the shoulder.',
        crowd: 'Nothing directly, but it is how the DJ keeps in touch with both the next track and the room.'
      },
      {
        id: 'band', name: 'Headband',
        boxes: [['b', -1.91, 1.89, -1.57, -1.52, 2.02, -1.27]],
        what: 'The adjustable band that holds the cups in place and spreads the weight over the head.',
        use: 'A DJ may wear headphones for hours. A comfortable band and a secure fit matter, because the headphones are constantly being lifted, swung and put back.',
        crowd: 'Nothing. It matters to the person who has to wear them for a whole night.'
      }
    ]
  },

  /* ======================= USB DRIVE ======================= */
  usb: {
    label: 'USB drive',
    build: 'usb',
    center: true,
    summary: 'A small drive with tracks prepared in advance. It plugs straight into the media player.',
    parts: [
      {
        id: 'drive', name: 'USB drive', meshes: ['usb_body', 'usb_plug'],
        what: 'A small drive that stores the DJ’s tracks and the information prepared at home: markers, loops and playlists. It plugs into the media player’s USB slot.',
        use: 'A DJ prepares at home, copies the music to the drive, and carries the whole set in a pocket. Many clubs only need the drive, which is why it is easy to play at a different venue each night.',
        crowd: 'Nothing visible. A set on a drive is easier to carry and less likely to crash than a laptop.'
      }
    ]
  },

  /* ======================= VINYL BAG ======================= */
  bag: {
    label: 'Vinyl bag',
    build: 'bag',
    center: true,
    summary: 'How a vinyl DJ carries the music: a bag or crate of records to every set.',
    parts: [
      {
        id: 'bag', name: 'Record bag', meshes: ['bag_body', 'bag_handle'],
        what: 'A sturdy bag made to carry 12 inch records standing on their edges. A flat bag or a crate keeps the records from bending, which would make them play badly.',
        use: 'A vinyl DJ brings many more records than will be played, so that the set can change direction if the room needs something else. A full bag is heavy, which is why the carrying handle is strong.',
        crowd: 'Nothing, but a DJ arriving with a bag of records is part of the picture of a vinyl set.'
      },
      {
        id: 'vinyl', name: 'Vinyl records', meshes: ['bag_disc'],
        what: '12 inch discs, the standard size for DJs. The music is a single groove spiralling in towards the label in the middle.',
        use: 'Records are chosen by hand, one at a time. DJs often put the ones they plan to play near the front of the bag, and keep them clean and out of the sun, because heat can warp them.',
        crowd: 'Watching a DJ flip through records and choose the next one is part of the show that many people enjoy.'
      },
      {
        id: 'sleeve', name: 'Record sleeve', meshes: ['bag_sleeve'],
        what: 'The cardboard cover that protects a record, usually with the artwork and the track list.',
        use: 'Records are kept in their sleeves. A DJ often recognises a record from its sleeve, so the artwork is also a way to find a track fast in the dark.',
        crowd: 'Nothing directly, but the sleeves are a big part of the visual culture of vinyl.'
      }
    ]
  }
};

/* ============================================================
   SCENES: what stands where. [x, z] is the position on the table,
   rotY turns the device (in radians).
   "origin" shifts the measurements of a part to a second copy of the same device.
   ============================================================ */
export const SCENES = {
  digital: {
    title: 'Digital',
    focus: ['cdjL', 'mixer', 'cdjR'],        // the camera is centred on these three
    items: [
      { id: 'cdjL', dev: 'cdj', label: 'Media player (left)', at: [-2.95, 0] },
      { id: 'mixer', dev: 'mixer', label: 'Mixer' },
      { id: 'cdjR', dev: 'cdj', label: 'Media player (right)', at: [2.95, 0] },
      { id: 'monL', dev: 'monitor', label: 'Booth monitor (left)', at: [-4.6, -4.2], rotY: 0.3 },
      { id: 'monR', dev: 'monitor', label: 'Booth monitor (right)', at: [4.6, -4.2], rotY: -0.3 },
      { id: 'usb', dev: 'usb', at: [-5.1, 0.7], rotY: -0.35 },
      { id: 'headphones', dev: 'headphones', at: [5.8, 0.9], rotY: -0.55 }
    ]
  },
  analog: {
    title: 'Analog',
    focus: ['ttL', 'mixer', 'ttR'],          // the camera is centred on these three
    items: [
      { id: 'ttL', dev: 'turntable', label: 'Turntable (left)', at: [-3.75, 0.15] },
      { id: 'mixer', dev: 'xone', label: 'Mixer' },
      { id: 'ttR', dev: 'turntable', label: 'Turntable (right)', at: [3.75, 0.15] },
      { id: 'monL', dev: 'monitor', label: 'Booth monitor (left)', at: [-4.6, -4.2], rotY: 0.3 },
      { id: 'monR', dev: 'monitor', label: 'Booth monitor (right)', at: [4.6, -4.2], rotY: -0.3 },
      { id: 'bag', dev: 'bag', at: [-8.0, 0.6], rotY: 0.35 },
      { id: 'headphones', dev: 'headphones', at: [7.6, 0.8], rotY: -0.5 }
    ]
  }
};
