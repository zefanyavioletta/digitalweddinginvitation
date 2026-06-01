'use strict';

let sound        = null;
let musicPlaying = false;
let _fadeTimer   = null;

function cancelFade() {
  if (_fadeTimer) { clearInterval(_fadeTimer); _fadeTimer = null; }
}

function fadeTo(targetVol, duration, onDone) {
  cancelFade();
  const startVol = sound.volume();
  const steps    = Math.max(1, Math.round(duration / 20));
  const stepTime = duration / steps;
  const stepSize = (targetVol - startVol) / steps;
  let current    = startVol;

  _fadeTimer = setInterval(() => {
    current += stepSize;
    const done = stepSize >= 0 ? current >= targetVol : current <= targetVol;
    sound.volume(done ? targetVol : current);
    if (done) {
      cancelFade();
      if (onDone) onDone();
    }
  }, stepTime);
}

function initMusic() {
  sound = new Howl({
    src: ['assets/audio/bg-music.mp3', 'assets/audio/bg-music.ogg'],
    loop: true,
    volume: 0,
    html5: true,
    onloaderror: function () {
      console.warn('[Music] Audio file not found');
    },
    onplayerror: function () {
      sound.once('unlock', function () {
        sound.volume(0);
        sound.play();
        fadeTo(0.65, 2000);
      });
    },
  });
}

function toggleMusic() {
  if (!sound) return;
  if (musicPlaying) {
    fadeTo(0, 500, () => sound.pause());
    musicPlaying = false;
  } else {
    sound.volume(0);
    sound.play();
    fadeTo(0.65, 800);
    musicPlaying = true;
  }
  updateMusicBtn();
}

function updateMusicBtn() {
  const iconOn  = document.getElementById('music-icon-on');
  const iconOff = document.getElementById('music-icon-off');
  const btn     = document.getElementById('music-toggle');
  if (!iconOn || !iconOff) return;
  if (musicPlaying) {
    iconOn.classList.remove('hidden');
    iconOff.classList.add('hidden');
    if (btn) btn.style.borderColor = 'rgba(221,161,177,0.45)';
  } else {
    iconOn.classList.add('hidden');
    iconOff.classList.remove('hidden');
    if (btn) btn.style.borderColor = 'rgba(89,90,95,0.4)';
  }
}


function openInvitation() {
  const openingPage = document.getElementById('opening-page');
  const mainPage    = document.getElementById('main-page');
  if (!openingPage || !mainPage) return;

  const btn = document.getElementById('open-invitation-btn');
  if (btn) btn.disabled = true;

  if (sound) {
    cancelFade();
    sound.volume(0);
    sound.play();
    fadeTo(0.65, 2000);
    musicPlaying = true;
    updateMusicBtn();
  }

  openingPage.classList.add('opening-exit');

  setTimeout(() => {
    openingPage.style.display = 'none';
    mainPage.classList.remove('hidden');
    document.getElementById('music-player').style.display = 'flex';
    mainPage.classList.add('page-enter');
    mainPage.scrollTop = 0;

    if (typeof initGallery === 'function') initGallery();
    if (typeof window.initWishes === 'function') {
      window.initWishes();
    }
    initScrollAnimations();
    initScrollReveal();
  }, 850);
}

/* ATTENDANCE LOGIC (RSVP) */
function initAttendanceLogic() {
  const radios       = document.querySelectorAll('input[name="attendance"]');
  const eventOptions = document.getElementById('event-options');

  radios.forEach(radio => {
    radio.addEventListener('change', function () {
      if (!eventOptions) return;

      if (this.value === 'hadir') {
        eventOptions.classList.remove('locked');
        eventOptions.querySelectorAll('.event-checkbox').forEach(cb => {
          cb.disabled = false;
        });
      } else {
        eventOptions.classList.add('locked');
        eventOptions.querySelectorAll('.event-checkbox').forEach(cb => {
          cb.checked  = false;
          cb.disabled = true;
        });
      }
    });
  });
}

/* RSVP SUBMIT*/
window.submitRSVP = function () {
  const name       = document.getElementById('rsvp-name')?.value.trim();
  const message    = document.getElementById('rsvp-message')?.value.trim();
  const attendance = document.querySelector('input[name="attendance"]:checked')?.value;
  const btnText    = document.getElementById('rsvp-btn-text');

  if (!name) {
    showToast('Mohon isi nama Anda');
    document.getElementById('rsvp-name')?.focus();
    return;
  }
  if (!attendance) {
    showToast('Mohon pilih kehadiran Anda');
    return;
  }
  if (!message) {
    showToast('Mohon tulis ucapan Anda');
    document.getElementById('rsvp-message')?.focus();
    return;
  }

  const events = [];
  document.querySelectorAll('.event-checkbox:checked').forEach(cb => {
    events.push(cb.value);
  });

  // Show loading state
  if (btnText) btnText.textContent = 'Mengirim...';

  // Simulate API delay then add wish
  setTimeout(() => {
    window.addWish({ name, message, attendance, events });

    // Reset form
    document.getElementById('rsvp-name').value    = '';
    document.getElementById('rsvp-message').value = '';
    document.querySelectorAll('input[name="attendance"]').forEach(r => r.checked = false);
    document.querySelectorAll('.event-checkbox').forEach(cb => cb.checked = false);
    document.getElementById('event-options')?.classList.add('locked');

    if (btnText) btnText.textContent = 'Kirim Ucapan';
    showToast('Ucapan berhasil dikirim!');

    // Scroll to wishes wall
    setTimeout(() => {
      document.getElementById('sec-wishes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 600);
  }, 800);
};

/* AMPLOP DIGITAL */
window.switchGiftTab = function(tab) {
  const groomEl = document.getElementById('gift-groom');
  const brideEl = document.getElementById('gift-bride');
  const tabs    = document.querySelectorAll('.gift-tab');
  if (!groomEl || !brideEl) return;
  groomEl.style.display = tab === 'groom' ? 'block' : 'none';
  brideEl.style.display = tab === 'bride' ? 'block' : 'none';
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
};

window.copyAccount = function (elId, btn) {
  const el = document.getElementById(elId);
  if (!el) return;

  const text = el.textContent.trim();
  navigator.clipboard.writeText(text).then(() => {
    btn.classList.add('copied');
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
      Tersalin!
    `;
    showToast('Nomor rekening disalin!');

    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
        Salin Nomor
      `;
    }, 2500);
  }).catch(() => {
    // Fallback for older browsers
    const range    = document.createRange();
    const selection = window.getSelection();
    range.selectNode(el);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('copy');
    selection.removeAllRanges();
    showToast('Nomor rekening disalin!');
  });
};

/*  TOAST NOTIFICATION */
let toastTimeout = null;

function showToast(message) {
  const toast    = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');
  if (!toast) return;

  if (toastMsg) toastMsg.textContent = message;
  toast.classList.remove('hidden', 'hiding');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 2500);
}

/* STORY POPUP */
function initStoryIcons() {
  document.querySelectorAll('.story-icon-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const detail  = btn.dataset.detail;
      const popup   = document.getElementById('story-popup');
      const popupTxt = document.getElementById('story-popup-text');
      const overlay  = document.getElementById('story-overlay');

      if (popupTxt) popupTxt.textContent = detail;
      popup?.classList.remove('hidden');
      overlay?.classList.remove('hidden');
    });
  });

  document.getElementById('story-popup-close')?.addEventListener('click', closeStoryPopup);
}

window.closeStoryPopup = function () {
  document.getElementById('story-popup')?.classList.add('hidden');
  document.getElementById('story-overlay')?.classList.add('hidden');
};

/* SCROLL ANIMATIONS (Intersection Observer)  */
function initScrollAnimations() {
  const targets = document.querySelectorAll(
    '#main-page .section-glass, #main-page .event-card, #main-page .couple-card, #main-page .countdown-card'
  );

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity   = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  targets.forEach(el => {
    el.style.opacity   = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
    observer.observe(el);
  });
}

function initScrollReveal() {
  const els = document.querySelectorAll('.reveal');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, root: null });
  els.forEach(el => obs.observe(el));
}

/* INIT ON DOM READY */
document.addEventListener('DOMContentLoaded', function () {
  // Init music (preload)
  initMusic();

  // Open invitation button
  document.getElementById('open-invitation-btn')
    ?.addEventListener('click', openInvitation);

  // Music toggle button
  document.getElementById('music-toggle')
    ?.addEventListener('click', toggleMusic);

  // Attendance radio logic
  initAttendanceLogic();

  // Story icons
  initStoryIcons();
});

// Fungsi Smooth Scroll dari Hero ke Section RSVP
const heroRsvpBtn = document.getElementById('hero-rsvp-btn');
const secRsvp = document.getElementById('sec-rsvp');

if (heroRsvpBtn && secRsvp) {
  heroRsvpBtn.addEventListener('click', function() {
    secRsvp.scrollIntoView({ 
      behavior: 'smooth',
      block: 'start'
    });
  });
}