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
    var status = document.getElementById('waitlist-status');
    if (!form || !status || !window.fetch) return;
    if (form.getAttribute('data-open') !== 'true') return;

    var endpoint = form.getAttribute('data-endpoint');
    var product = form.getAttribute('data-product');
    var contact = form.getAttribute('data-contact');
    var sitekey = form.getAttribute('data-sitekey');
    var doubleOptIn = form.getAttribute('data-double-opt-in') === 'true';
    var button = form.querySelector('button[type="submit"]');
    var human = form.querySelector('[data-captcha]');
    var label = button.textContent;
    var TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=sgTurnstileReady';
    var widget = null;
    var broken = false;

    form.hidden = false;
    var fallback = document.querySelector('[data-waitlist-fallback]');
    if (fallback) fallback.hidden = true;

    function say(headline, message) {
      status.textContent = '';
      var strong = document.createElement('strong');
      strong.textContent = headline;
      status.appendChild(strong);
      status.appendChild(document.createTextNode(' ' + message));
    }
    function joined(email) {
      form.hidden = true;
      if (doubleOptIn) say('Check your inbox.', 'We sent a confirmation link to ' + email + '. Click it to hold your place.');
      else say('You’re on the list.', 'We will write to ' + email + ' once, when there is something to use.');
    }
    function retry(headline, message) {
      button.disabled = false;
      button.textContent = label;
      if (window.turnstile && widget !== null) window.turnstile.reset(widget);
      say(headline, message);
    }
    function unavailable() {
      broken = true;
      say('The human check did not load.', 'Reload the page, or email ' + contact + ' and you will be added by hand.');
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

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var email = (form.elements.email.value || '').trim();
      if (!email) return;

      // Honeypot: people leave it empty. A bot that fills it learns nothing.
      if ((form.elements.company.value || '').trim()) { joined(email); return; }

      if (broken || !window.turnstile || widget === null) { unavailable(); return; }
      var token = window.turnstile.getResponse(widget);
      if (!token) {
        say('One moment.', 'The human check is still running. Try again in a second.');
        return;
      }

      button.disabled = true;
      button.textContent = 'Joining…';

      fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email, product: product, captchaToken: token })
      }).then(function (res) {
        if (res.ok) { joined(email); return; }
        return res.json().catch(function () { return {}; }).then(function (problem) {
          var type = (problem && problem.type) || '';
          if (/\/captcha-failed$/.test(type))
            retry('The human check failed.', 'Try again, or email ' + contact + ' and you will be added by hand.');
          else if (res.status === 400 || res.status === 422)
            retry('Not added.', 'That address did not look right. Check it and try again, or email ' + contact + '.');
          else if (res.status === 429)
            retry('Too many tries.', 'Wait a moment and try again, or email ' + contact + '.');
          else
            retry('Could not reach the list.', 'Try again in a moment, or email ' + contact + ' and you will be added by hand.');
        });
      }, function () {
        retry('Could not reach the list.', 'Try again in a moment, or email ' + contact + ' and you will be added by hand.');
      });
    });
  })();
})();
