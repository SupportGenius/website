/* supportgeni.us — the demo stage's scale, reduced motion for its SVG, and
   the waitlist. Nothing here is needed to read the page: with JavaScript off,
   the stage falls back to the CSS breakpoints and the waitlist shows its mail
   fallback. */
(function () {
  'use strict';

  var LOOP_S = 32;       // --loop in the stylesheet
  var FREEZE_AT = 0.42;  // the frame reduced motion holds; keep in step with the CSS

  /* ------------------------------------------------------------ demo stage
     The canvas is a fixed 1120×520. Scale it to the measured width, never up. */
  (function () {
    var stage = document.querySelector('[data-stage]');
    if (!stage) return;

    function measure() {
      var s = Math.min(1, stage.clientWidth / 1120);
      stage.style.setProperty('--s', s.toFixed(4));
    }
    measure();
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(stage);
    else window.addEventListener('resize', measure);

    // CSS cannot reach SMIL. Under reduced motion, stop the packets on the same
    // frame the stylesheet freezes the rest of the scene on.
    var svg = stage.querySelector('svg');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    function applyMotion() {
      if (!svg || !svg.pauseAnimations) return;
      if (reduce && reduce.matches) {
        svg.pauseAnimations();
        if (svg.setCurrentTime) svg.setCurrentTime(LOOP_S * FREEZE_AT);
      } else {
        svg.unpauseAnimations();
      }
    }
    applyMotion();
    if (reduce && reduce.addEventListener) reduce.addEventListener('change', applyMotion);
  })();

  /* ------------------------------------------------------------ film button
     The hero's "Watch the film" link scrolls to #film (its href) and starts the
     video there. Its own scope: it runs whatever the other blocks find. */
  (function () {
    var trigger = document.querySelector('[data-play-film]');
    if (!trigger) return;
    trigger.addEventListener('click', function () {
      var video = document.querySelector('#film video');
      if (!video || typeof video.play !== 'function') return;
      try {
        var started = video.play();
        if (started && typeof started.catch === 'function') started.catch(function () {});
      } catch (e) { /* the controls still work */ }
    });
  })();

  /* ------------------------------------------------------------ the film
     The film is an MP4 in the page. That is what plays with JavaScript off, and
     what plays if Cloudflare Stream is not used or fails. When
     assets/films/stream.json lists this film, it plays the adaptive HLS
     rendition from Cloudflare Stream instead: natively where the browser has HLS
     (Safari), otherwise through hls.js, loaded from cdnjs on the first play. Nothing
     streams until the viewer presses play, so the page loads no video bytes.
     The browser picks a <source> as soon as the video is parsed, so when Stream
     applies, the video is replaced by a copy without its MP4 children. */
  (function () {
    var section = document.getElementById('film');
    var video = section && section.querySelector('video');
    if (!video || !window.fetch) return;

    var STREAM_JSON = '/assets/films/stream.json';
    var HLS_JS = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.6.14/hls.min.js';
    var HLS_SRI = 'sha384-lbqMj+/seEQo5wSCMdezkKbFWgcv2aq724oyDwaZK0AlpNcwQvWLwBwyA7f5GxiJ';
    var mp4Sources = [];
    var localPoster = video.getAttribute('poster');
    var state = 'pending';   // 'pending' until stream.json is read, then 'stream' or 'mp4'
    var stream = null;       // { hls, poster } when Stream is in use
    var attached = false;    // the Stream source has been chosen (it may still fail)
    var failed = false;
    var hls = null;
    var wantPlay = false;

    function pick(data) {
      var film = data && data.films && data.films[video.getAttribute('data-film')];
      var origin = data && data.origin;
      if (!film || !/^[a-f0-9]{32}$/.test(film.uid || '')) return null;
      if (!/^https:\/\/[a-z0-9-]+\.cloudflarestream\.com$/.test(origin || '')) return null;
      var time = /^\d+s$/.test(film.poster_time || '') ? film.poster_time : '3s';
      return {
        hls: origin + '/' + film.uid + '/manifest/video.m3u8',
        poster: origin + '/' + film.uid + '/thumbnails/thumbnail.jpg?time=' + time + '&width=960'
      };
    }

    var ready = fetch(STREAM_JSON, { cache: 'no-cache' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(pick)
      .catch(function () { return null; })
      .then(function (s) {
        stream = s;
        state = s ? 'stream' : 'mp4';
        if (!s) return;
        mp4Sources = Array.prototype.slice.call(video.querySelectorAll('source'));
        var fresh = video.cloneNode(false);   // same attributes, no MP4 children
        video.parentNode.replaceChild(fresh, video);
        video = fresh;
        video.poster = s.poster;
      });

    function start() {
      if (!wantPlay) return;
      wantPlay = false;
      var p = video.play();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    }

    // Any failure of the Stream path returns the film to its MP4 children.
    function fallback() {
      if (!attached || failed) return;
      failed = true;
      var resume = true;   // attach only follows a play request, so the viewer still wants it
      if (hls) { hls.destroy(); hls = null; }
      video.removeEventListener('error', fallback);
      video.removeAttribute('src');
      video.poster = localPoster;
      mp4Sources.forEach(function (x) { video.appendChild(x); });
      video.load();
      wantPlay = resume;
      start();
    }

    function loadHls() {
      if (window.Hls) return Promise.resolve(window.Hls);
      return new Promise(function (resolve, reject) {
        var tag = document.createElement('script');
        tag.src = HLS_JS;
        tag.integrity = HLS_SRI;
        tag.crossOrigin = 'anonymous';
        tag.async = true;
        tag.onload = function () { window.Hls ? resolve(window.Hls) : reject(new Error('hls.js')); };
        tag.onerror = function () { reject(new Error('hls.js')); };
        document.head.appendChild(tag);
      });
    }

    function attach(s) {
      attached = true;
      video.addEventListener('error', fallback);
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = s.hls;
        start();
        return;
      }
      loadHls().then(function (Hls) {
        if (!Hls.isSupported()) throw new Error('no media source extensions');
        hls = new Hls();
        hls.on(Hls.Events.ERROR, function (_event, data) { if (data.fatal) fallback(); });
        hls.loadSource(s.hls);
        hls.attachMedia(video);
        start();
      }).catch(fallback);
    }

    // 'play' does not bubble, but it does pass through the section in the capture phase,
    // so one listener covers the MP4 element and the Stream copy that replaces it.
    section.addEventListener('play', function (event) {
      if (attached || state === 'mp4') return;   // no Stream: the MP4 plays as it always did
      // The first play waits for stream.json (a few bytes), then starts the right source.
      event.target.pause();
      wantPlay = true;
      ready.then(function () {
        if (state === 'stream' && !attached) attach(stream);
        else start();
      });
    }, true);
  })();

  /* ------------------------------------------------------------ waitlist
     Posts { email, product, captchaToken } to the waitlist Worker at
     api.supportgeni.us (SupportGenius/waitlist-backend, the Cratefield harness
     waitlist module). captchaToken is a Cloudflare Turnstile token from the
     managed widget below (action "waitlist"); the Worker binds it to the apex
     hostname and refuses a join without one (400, problem type
     captcha-failed). The Worker sends a confirmation link through Owlpost
     (double opt-in). The form ships hidden; with JavaScript off, or with
     data-open="false", a visitor sees the mail fallback instead. */
  (function () {
    var form = document.getElementById('waitlist-form');
    var done = document.getElementById('waitlist-done');
    var err = document.getElementById('waitlist-err');
    if (!form || !done || !err || !window.fetch) return;
    if (form.getAttribute('data-open') !== 'true') return;

    var endpoint = form.getAttribute('data-endpoint');
    var product = form.getAttribute('data-product');
    var contact = form.getAttribute('data-contact');
    var sitekey = form.getAttribute('data-sitekey');
    var input = form.elements.email;
    var button = form.querySelector('button[type="submit"]');
    var label = button.querySelector('[data-label]');
    var idle = label.textContent;
    var human = form.querySelector('[data-captcha]');
    var TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=sgTurnstileReady';
    var widget = null;
    var broken = false;
    var MAIL = 'email ' + contact + ' and you will be added by hand';

    form.hidden = false;
    var fallback = document.querySelector('[data-waitlist-fallback]');
    if (fallback) fallback.hidden = true;

    function fail(message, onEmail) {
      err.textContent = message;
      err.hidden = false;
      input.setAttribute('aria-invalid', onEmail ? 'true' : 'false');
      if (onEmail) input.focus();
    }
    function clear() { err.hidden = true; err.textContent = ''; input.setAttribute('aria-invalid', 'false'); }
    function busy(on) {
      button.disabled = on;
      if (on) button.setAttribute('aria-busy', 'true'); else button.removeAttribute('aria-busy');
      label.textContent = on ? 'Sending…' : idle;
    }
    function reset() { if (window.turnstile && widget !== null) window.turnstile.reset(widget); }
    function joined(email) {
      done.querySelector('[data-done-email]').textContent = email;
      form.hidden = true;
      done.hidden = false;
      done.focus();
    }
    function unavailable() {
      broken = true;
      fail('The human check did not load, so the form cannot send. Reload the page, or ' + MAIL + '.');
    }

    /* Turnstile, rendered explicitly into [data-captcha] once its script loads. */
    function render() {
      if (!window.turnstile || !human) return;
      if (widget !== null) { window.turnstile.remove(widget); widget = null; }
      human.hidden = false;
      widget = window.turnstile.render(human, {
        sitekey: sitekey,
        action: 'waitlist',
        appearance: 'interaction-only',
        'error-callback': function () { unavailable(); }
      });
    }
    if (human && sitekey) {
      window.sgTurnstileReady = function () { clearTimeout(waited); render(); };
      var tag = document.createElement('script');
      tag.src = TURNSTILE; tag.async = true; tag.defer = true;
      tag.onerror = unavailable;
      document.head.appendChild(tag);
      var waited = setTimeout(function () { if (!window.turnstile) unavailable(); }, 10000);
    } else {
      broken = true;
    }

    input.addEventListener('input', function () {
      if (input.getAttribute('aria-invalid') === 'true') clear();
    });
    done.querySelector('[data-again]').addEventListener('click', function () {
      done.hidden = true;
      form.hidden = false;
      clear();
      if (window.turnstile) render();
      input.focus();
      input.select();
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      clear();
      var email = (input.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        fail('That email address doesn’t look right. Check it and try again.', true);
        return;
      }

      // Honeypot: people leave it empty. A bot that fills it learns nothing.
      if ((form.elements.company.value || '').trim()) { fail('Nothing was sent: ' + MAIL + '.'); return; }

      if (broken || !window.turnstile || widget === null) { unavailable(); return; }
      var token = window.turnstile.getResponse(widget);
      if (!token) {
        fail('One more step: the human check is still running. Complete it if it asks, then send again.');
        return;
      }

      busy(true);
      fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email, product: product, captchaToken: token })
      }).then(function (res) {
        if (res.ok) { busy(false); joined(email); return; }
        return res.json().catch(function () { return {}; }).then(function (problem) {
          var type = (problem && problem.type) || '';
          busy(false); reset();
          if (/\/captcha-failed$/.test(type))
            fail('The human check didn’t go through. It’s been reset — complete it again, then send.');
          else if (res.status === 429 || /\/rate-limited$/.test(type))
            fail('Too many tries. Wait a minute, then try again.');
          else if (res.status === 400 || res.status === 422)
            fail('That email address doesn’t look right. Check it and try again.', true);
          else
            fail('We couldn’t reach the waitlist just now, so nothing was saved. Try again in a moment, or ' + MAIL + '.');
        });
      }, function () {
        busy(false); reset();
        fail('We couldn’t reach the waitlist just now, so nothing was saved. Try again in a moment, or ' + MAIL + '.');
      });
    });
  })();
})();
