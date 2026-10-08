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
      if ((form.elements.company.value || '').trim()) { joined(email); return; }

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
            fail('We couldn’t reach the waitlist just now. Try again in a moment, or ' + MAIL + '.');
        });
      }, function () {
        busy(false); reset();
        fail('We couldn’t reach the waitlist just now. Try again in a moment, or ' + MAIL + '.');
      });
    });
  })();
})();
