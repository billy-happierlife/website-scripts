// Your Happier Life Happiness Test - browser bundle - built 2026-05-05
// Upload to GitHub repo billy-happierlife/website-scripts as yhl_assessment_cdn.js.
// Slim config: only item order, item text, and section names.
// Scoring happens server-side via the Worker (see SCORING_API_URL in template.js).

var YHL_CONFIG_COMPACT = {"o":["X15","H683","X129","H959","M4","V83","X74","H352","H402","E159","X105","H44","H1157","V2","H737","Z1","X197","H947","X145","H42","M36","H2000","E92","X156","V24","V208","Q223","H640","H1","H639","V164","H612","H914","H33","V26"],"i":[["H42","Look at the bright side of life"],["H33","Love life"],["X156","Seldom feel blue"],["H640","Am often down in the dumps"],["H639","Have a dark outlook on the future"],["X74","Often feel blue"],["H947","Feel desperate"],["V26","Express my thanks to those who care about me"],["H737","Am very pleased with myself"],["X15","Dislike myself"],["H1157","Worry about things"],["H44","Readily overcome setbacks"],["H683","Am filled with doubts about things"],["H2000","Adapt easily to new situations"],["X105","Am not sure where my life is going"],["H612","Feel threatened easily"],["H352","Am sure of my ground"],["H914","Feel attacked by others"],["E92","Have frequent mood swings"],["X197","Am comfortable in unfamiliar situations"],["H959","Become overwhelmed by events"],["V208","Am rarely aware of the natural beauty in the environment"],["X129","Feel comfortable with myself"],["H1","Feel at ease with people"],["E159","Feel that people have a hard time understanding me"],["X145","Often eat too much"],["H402","Turn plans into actions"],["V2","Go out of my way to attend educational events"],["Q223","Am good at saving money"],["V83","Am a workaholic, with little time for fun or pleasure"],["Z1","Spend a lot of time on my phone"],["M4","Tend to hang on to things I should probably throw out"],["V24","Am never too busy to help a friend"],["M36","Find it hard to tell others' thoughts by their looks"],["V164","Helped a neighbor in the last month"]],"s":[[1,"Your Inner Game"],[2,"Your Success Systems"],[3,"Connection that Matters"]]};

/* ============================================================
   Your Happier Life — Happiness Test
   Mode flag: ?mode=workshop opts out of the email gate (Phase 4)
   Phase 3: scoring engine + single-Happiness-Score results page
   ============================================================ */

(function () {
  'use strict';

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  // Compact-config expansion. The browser uses a slim config (only item
  // order, item id+text, and section num+name). Scoring data lives in the
  // Worker, not here. expandConfig is defensive: if the build emits a fuller
  // config (e.g. for legacy compatibility or local testing), the extra
  // fields are ignored.
  function expandConfig(c) {
    return {
      item_order: c.o || [],
      items: (c.i || []).map(function (r) {
        return { id: r[0], text: r[1] };
      }),
      sections: (c.s || []).map(function (r) {
        return { num: r[0], name: r[1] };
      })
    };
  }

  if (typeof YHL_CONFIG === 'undefined' && typeof YHL_CONFIG_COMPACT !== 'undefined') {
    /* eslint-disable no-undef */
    window.YHL_CONFIG = expandConfig(YHL_CONFIG_COMPACT);
  }

  var ITEMS_PER_PAGE = 7;
  var STORAGE_KEY = 'yhl_test_state_v1';
  var WORKSHOP_URL = 'https://yourhappier.life/workshop';

  // Cloudflare Worker URL for the scoring engine. The browser POSTs the
  // visitor's raw answers here and receives scored results plus pre-formatted
  // Kit submission fields. The matrix data, ESCS lookup, and scoring formulas
  // live in the Worker (private GitHub repo: billy-happierlife/happiness-scoring-engine),
  // not here. Browser only knows the questions, the UI, and the Worker URL.
  var SCORING_API_URL = 'https://happiness-scoring-engine.billy-da8.workers.dev/';

  // Kit (formerly ConvertKit) form ID. Leave empty to use the stub flow
  // (advances to results without sending). Replace with the real form ID
  // (just the numeric part of the embed code) before deploy.
  var KIT_FORM_ID = '9399353';
  var LIKERT_LABELS = [
    { value: 1, label: 'Strongly disagree' },
    { value: 2, label: 'Disagree' },
    { value: 3, label: 'Neither' },
    { value: 4, label: 'Agree' },
    { value: 5, label: 'Strongly agree' }
  ];

  var state = {
    screen: 'intro',
    page: 0,
    answers: {},
    mode: 'lead-magnet',
    drillOpen: false,
    toolSort: 'score',
    email: '',
    firstName: '',
    lastName: '',
    emailError: '',
    emailSubmitting: false,
    // Scoring cache: populated by ensureScored() once the Worker has scored
    // the visitor's answers. Cleared on Start Over. Both fields are populated
    // together by the same Worker call.
    scores: null,
    kitFields: null,
    scoresLoading: false,
    scoresError: ''
  };

  var elScreen, elBack, elNext, elProgressFill, elProgressLabel;

  function init() {
    if (typeof YHL_CONFIG === 'undefined') {
      console.error('YHL_CONFIG not loaded');
      return;
    }
    elScreen = document.getElementById('yhl-screen');
    elBack = document.getElementById('yhl-back');
    elNext = document.getElementById('yhl-next');
    elProgressFill = document.getElementById('yhl-progress-fill');
    elProgressLabel = document.getElementById('yhl-progress-label');
    if (!elScreen || !elBack || !elNext) return;

    var params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'workshop') state.mode = 'workshop';

    elBack.addEventListener('click', onBack);
    elNext.addEventListener('click', onNext);

    restoreState();
    render();
  }

  function persistState() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        screen: state.screen,
        page: state.page,
        answers: state.answers,
        mode: state.mode,
        email: state.email,
        firstName: state.firstName,
        lastName: state.lastName
      }));
    } catch (e) {}
  }
  function restoreState() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        state.screen = parsed.screen || 'intro';
        state.page = parsed.page || 0;
        state.answers = parsed.answers || {};
        if (state.mode !== 'workshop' && parsed.mode) state.mode = parsed.mode;
        if (parsed.email) state.email = parsed.email;
        if (parsed.firstName) state.firstName = parsed.firstName;
        if (parsed.lastName) state.lastName = parsed.lastName;
      }
    } catch (e) {}
  }
  function clearState() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  function getItemOrder() { return YHL_CONFIG.item_order; }
  function getItemById(id) {
    if (!getItemById._cache) {
      getItemById._cache = {};
      YHL_CONFIG.items.forEach(function (it) { getItemById._cache[it.id] = it; });
    }
    return getItemById._cache[id];
  }
  function totalPages() { return Math.ceil(getItemOrder().length / ITEMS_PER_PAGE); }
  function pageItems(p) {
    var order = getItemOrder();
    var start = p * ITEMS_PER_PAGE;
    return order.slice(start, start + ITEMS_PER_PAGE).map(getItemById);
  }
  function pageComplete(p) {
    return pageItems(p).every(function (it) { return state.answers.hasOwnProperty(it.id); });
  }
  function totalAnswered() { return Object.keys(state.answers).length; }
  function displayText(item) {
    var t = (item.text || '').trim();
    if (!t) return '';
    var prefixed = 'I ' + t.charAt(0).toLowerCase() + t.slice(1);
    if (!/[.?!]$/.test(prefixed)) prefixed += '.';
    return prefixed;
  }

  // Scoring engine — server-side via Cloudflare Worker.
  //
  // The matrix data, item statistics, ESCS percentile lookup, and scoring
  // formulas live in the Worker (private GitHub repo). This browser-side
  // bundle is intentionally thin: it collects answers, ships them to the
  // Worker, and renders the response. No scoring data leaks to clients.
  //
  // ensureScored() is idempotent. Once scores are cached in state, repeat
  // calls return the cached result without hitting the Worker again. This
  // matters because both the email-gate flow (lead-magnet mode) and the
  // direct-to-results flow (workshop mode) need the same scores.

  function ensureScored() {
    if (state.scores && state.kitFields) {
      return Promise.resolve({ scores: state.scores, kitFields: state.kitFields });
    }
    if (state.scoresLoading) {
      // Already in flight — poll until cached. Simple and sufficient for the
      // narrow window where two screens might both trigger a fetch.
      return new Promise(function (resolve, reject) {
        var iv = setInterval(function () {
          if (state.scores && state.kitFields) {
            clearInterval(iv);
            resolve({ scores: state.scores, kitFields: state.kitFields });
          } else if (!state.scoresLoading && state.scoresError) {
            clearInterval(iv);
            reject(new Error(state.scoresError));
          }
        }, 100);
      });
    }
    state.scoresLoading = true;
    state.scoresError = '';
    return fetch(SCORING_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: state.answers })
    }).then(function (r) {
      if (!r.ok) throw new Error('Scoring failed (status ' + r.status + ')');
      return r.json();
    }).then(function (data) {
      if (!data || !data.scores || !data.kitFields) {
        throw new Error('Scoring response missing expected fields');
      }
      state.scores = data.scores;
      state.kitFields = data.kitFields;
      state.scoresLoading = false;
      return data;
    }).catch(function (err) {
      state.scoresLoading = false;
      state.scoresError = (err && err.message) || 'Scoring request failed';
      throw err;
    });
  }

  function render() {
    if (state.screen === 'intro') renderIntro();
    else if (state.screen === 'questions') renderQuestions();
    else if (state.screen === 'email-gate') renderEmailGate();
    else if (state.screen === 'complete') renderResults();
    updateProgress();
    updateFooter();
    persistState();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function renderIntro() {
    elScreen.innerHTML = ''
      + '<section class="yhl-intro">'
      +   '<h1>How happy are you, really?</h1>'
      +   '<p>Five minutes, ' + getItemOrder().length + ' questions, no fluff. Honest answers beat impressive ones.</p>'
      +   '<p>Here’s the thing: this isn’t a test you can fail. It’s a quick read on where you stand right now, plus a full breakdown across all 3 sections, 10 chapters, and 42 tools, so you can see which ones are most likely to move the needle for you.</p>'
      +   '<div class="yhl-intro-note">Built on validated personality items, scored against the Eugene-Springfield Community Sample. Your answers are scored right here in your browser.</div>'
      + '</section>';
  }

  function renderQuestions() {
    var p = state.page;
    var items = pageItems(p);
    var pageNum = p + 1;
    var totalP = totalPages();

    var encouragements = {
      0: 'There are no right answers. Pick what fits.',
      3: 'You\'re beyond halfway there. Stick with it.',
      4: 'Last page. Almost done.'
    };

    var html = '<div class="yhl-page-intro">Page ' + pageNum + ' of ' + totalP + '</div>';
    if (encouragements[p]) {
      html += '<p class="yhl-encouragement">' + escapeHtml(encouragements[p]) + '</p>';
    }

    items.forEach(function (item, idx) {
      var prompt = escapeHtml(displayText(item));
      var promptId = 'yhl-prompt-' + item.id;
      var selected = state.answers[item.id];
      html += ''
        + '<div class="yhl-item" data-item-id="' + escapeAttr(item.id) + '">'
        +   '<div id="' + promptId + '" class="yhl-item-prompt">'
        +     (p * ITEMS_PER_PAGE + idx + 1) + '. ' + prompt
        +   '</div>'
        +   '<div class="yhl-item-likert" role="radiogroup" aria-labelledby="' + promptId + '">';
      LIKERT_LABELS.forEach(function (opt) {
        var checked = (selected === opt.value) ? 'true' : 'false';
        html += '<button type="button" role="radio" class="yhl-likert-btn" '
              + 'data-value="' + opt.value + '" '
              + 'data-item="' + escapeAttr(item.id) + '" '
              + 'aria-checked="' + checked + '">'
              + escapeHtml(opt.label)
              + '</button>';
      });
      html += '</div></div>';
    });

    elScreen.innerHTML = html;

    var btns = elScreen.querySelectorAll('.yhl-likert-btn');
    Array.prototype.forEach.call(btns, function (btn) {
      btn.addEventListener('click', onLikertClick);
    });
  }

  function renderEmailGate() {
    var err = state.emailError;
    var submitting = state.emailSubmitting;
    var html = ''
      + '<section class="yhl-gate">'
      +   '<h1>One last step.</h1>'
      +   '<p>Drop your details and I\'ll unlock your results, plus send a short follow-up on what to do with them. No spam, no daily blasts. You can unsubscribe with one click whenever you want.</p>'
      +   '<form id="yhl-gate-form" class="yhl-gate-form" novalidate>'
      +     '<label class="yhl-gate-label" for="yhl-gate-first-name">First name <span class="yhl-gate-optional">(optional)</span></label>'
      +     '<input class="yhl-gate-input" type="text" id="yhl-gate-first-name" name="first_name" autocomplete="given-name" value="' + escapeAttr(state.firstName) + '" placeholder="Your first name">'
      +     '<label class="yhl-gate-label" for="yhl-gate-last-name">Last name <span class="yhl-gate-optional">(optional)</span></label>'
      +     '<input class="yhl-gate-input" type="text" id="yhl-gate-last-name" name="last_name" autocomplete="family-name" value="' + escapeAttr(state.lastName) + '" placeholder="Your last name">'
      +     '<label class="yhl-gate-label" for="yhl-gate-email">Email address</label>'
      +     '<input class="yhl-gate-input" type="email" id="yhl-gate-email" name="email_address" required autocomplete="email" inputmode="email" value="' + escapeAttr(state.email) + '" placeholder="you@somewhere.com">'
      +     '<label class="yhl-gate-consent"><input type="checkbox" id="yhl-gate-send-results" checked><span>Send my results to my inbox so I can refer back to them.</span></label>'
      +     '<div class="yhl-gate-consent-hint">Uncheck to keep your detailed results off my list. Otherwise, your scores get sent to my email service so they can be included in your welcome email. Either way, you get a welcome email and your results stay on this page (save the PDF to keep them).</div>'
      +     (err ? '<div class="yhl-gate-error" role="alert">' + escapeHtml(err) + '</div>' : '')
      +     '<button class="yhl-btn yhl-btn-accent yhl-gate-submit" type="submit" id="yhl-gate-submit"' + (submitting ? ' disabled' : '') + '>'
      +       (submitting ? 'Sending...' : 'See my results')
      +     '</button>'
      +     '<p class="yhl-gate-fineprint">Your answers were scored right here in your browser. The email goes to my list so I can send your results and useful follow-ups. Nothing else.</p>'
      +   '</form>'
      + '</section>';
    elScreen.innerHTML = html;
    var form = document.getElementById('yhl-gate-form');
    if (form) form.addEventListener('submit', onEmailSubmit);
  }

  function onEmailSubmit(e) {
    e.preventDefault();
    if (state.emailSubmitting) return;
    var input = document.getElementById('yhl-gate-email');
    var email = (input && input.value || '').trim();
    if (!isValidEmail(email)) {
      state.emailError = 'That doesn\'t look like a valid email. Mind taking another look?';
      render();
      return;
    }
    var firstInput = document.getElementById('yhl-gate-first-name');
    var lastInput = document.getElementById('yhl-gate-last-name');
    var firstName = (firstInput && firstInput.value || '').trim();
    var lastName = (lastInput && lastInput.value || '').trim();
    var sendResults = (document.getElementById('yhl-gate-send-results') || { checked: true }).checked;
    state.email = email;
    state.firstName = firstName;
    state.lastName = lastName;
    state.emailError = '';
    state.emailSubmitting = true;
    persistState();
    render();

    // Fetch scores from the Worker (cached after first call). When the user
    // opted into receiving results, we attach the Worker-returned kitFields
    // to the Kit submission. When opted out, only the email + name go to Kit.
    ensureScored().then(function (data) {
      var fields = {};
      if (sendResults) {
        fields.happiness_score = data.kitFields.happiness_score;
        fields.happiness_band = data.kitFields.happiness_band;
        fields.happiness_results_summary = data.kitFields.happiness_results_summary;
      }
      if (lastName) fields.last_name = lastName;
      return submitToKit(email, firstName, fields);
    }).then(function () {
      state.emailSubmitting = false;
      state.screen = 'complete';
      state.drillOpen = true;
      state.toolSort = 'score';
      persistState();
      render();
    }).catch(function (err) {
      state.emailSubmitting = false;
      state.emailError = (err && err.message) || 'We couldn\'t reach the list. Try again in a moment.';
      render();
    });
  }

  function isValidEmail(s) {
    if (!s || s.length > 254) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  function submitToKit(email, firstName, fields) {
    if (!KIT_FORM_ID) return Promise.resolve({ stub: true });
    var url = 'https://app.kit.com/forms/' + encodeURIComponent(KIT_FORM_ID) + '/subscriptions';
    var body = { email_address: email };
    if (firstName) body.first_name = firstName;
    if (fields && Object.keys(fields).length) body.fields = fields;
    return fetch(url, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error('Submission failed (status ' + r.status + ')');
      return r.json().catch(function () { return {}; });
    });
  }

  function pickHeroFrame(pct) {
    if (pct >= 80) {
      return "Top fifth on the validated happiness items. You've built something real here, and the data shows it. Here's what the top fifth doesn't usually hear though: this is also the band that loses the most when life gets busy and habits start to slide. The 5 tools below point to where the next gain is hiding. Smaller than the gains for someone in the middle, sure. But more durable, because you've already proven you can build. Don't stop now. And someone who's made it this far has something to teach the rest of us. Come build alongside others, and bring what you know.";
    }
    if (pct >= 60) {
      return "Above the middle of the curve. You're doing better than most on the items psychologists actually use to measure happiness. That's worth saying out loud. It's also a band that's easy to coast in. The 5 tools below show where the room is, and most of it is closer than you'd think. The gap between 'doing okay' and 'genuinely thriving' is usually one or two tools, practiced consistently. That's it. You're already most of the way there. Come build alongside others who are right there with you.";
    }
    if (pct >= 40) {
      return "Right in the meaty middle of the curve. That's where most of us live, most of the time, and that's nothing to be ashamed of. Here's the thing though: the middle isn't a verdict, it's a starting line. The 5 tools below show where the gap is biggest for you. People who move out of the middle aren't smarter or luckier. They're just the ones who picked one tool and worked it. Then picked another. You've already done the hard part by showing up to look. Come build with others who got tired of the middle and decided to climb.";
    }
    if (pct >= 20) {
      return "Below average right now. Not gonna lie, that's a tough thing to read. But you read it. That counts for something, and it's how all of this starts. Here's what I know: the people who move hardest from this band aren't the ones who try to fix everything at once. They're the ones who pick one tool from the 5 below and start there. Not all 42. One. Then they get comfortable and grab another. The work isn't bigger than you. It just has to start. And you don't have to do it alone.";
    }
    return "This is a hard read, and not gonna lie, I haven't lived this from the inside. But I've sat with people who have, and I see how heavy it can feel. The room to move is also biggest down here. Pick one tool from the 5 below and start with it. Not all 42. One. You're not too far gone to do this work, and the work is what changes the number. You've got this, and you don't have to walk it alone. One more thing, and I mean it: if any of this feels darker than just a tough year, if it feels heavier or longer or scarier than that, please reach out to someone qualified. The Workshop is powerful, but it isn't therapy. There's no shame in needing both. Talk to a pro who can sit with you the way they're trained to.";
  }

  function renderResults() {
    // If scores aren't cached yet (e.g. workshop mode skips the email gate
    // and lands here directly), kick off the fetch and show a loading state.
    // Re-render once the Worker responds.
    if (!state.scores) {
      if (state.scoresError) {
        elScreen.innerHTML = ''
          + '<section class="yhl-results-loading">'
          +   '<h1>Couldn\'t score your results</h1>'
          +   '<p>' + escapeHtml(state.scoresError) + '</p>'
          +   '<button class="yhl-btn yhl-btn-outline" type="button" id="yhl-retry-score">Try again</button>'
          + '</section>';
        var retry = document.getElementById('yhl-retry-score');
        if (retry) retry.addEventListener('click', function () {
          state.scoresError = '';
          render();
        });
        return;
      }
      elScreen.innerHTML = ''
        + '<section class="yhl-results-loading">'
        +   '<h1>Computing your results...</h1>'
        +   '<p>One moment.</p>'
        + '</section>';
      ensureScored().then(function () { render(); }).catch(function () { render(); });
      return;
    }

    var scores = state.scores;
    var pctHero = Math.round(scores.happinessScore.percentileA || 0);
    var heroFrame = pickHeroFrame(pctHero);

    var html = '';

    html += '<section class="yhl-results-hero">';
    html +=   '<div class="yhl-hero-label">Your Happiness Score</div>';
    html +=   '<div class="yhl-hero-pct"><span class="yhl-hero-num">' + pctHero + '</span><span class="yhl-hero-suffix">th percentile</span></div>';
    html +=   '<p class="yhl-hero-frame">' + escapeHtml(heroFrame) + '</p>';
    html +=   '<div class="yhl-hero-note">Benchmarked against 570 Eugene-Springfield Community Sample respondents.</div>';
    html += '</section>';
    html += '<div class="yhl-save-pdf"><button class="yhl-btn yhl-btn-outline yhl-save-pdf-btn" type="button" id="yhl-save-pdf-btn">Save your results as a PDF</button><div class="yhl-save-pdf-hint">Saves a copy you can keep. On mobile, choose Save to Files in the print dialog.</div></div>';

    html += '<section class="yhl-top-tools">';
    html +=   '<h2>Where to focus first</h2>';
    html +=   '<p class="yhl-section-intro">5 tools where the gap between you and baseline is biggest. These are the highest-leverage starting points.</p>';
    html +=   '<ol class="yhl-tool-list">';
    scores.topTools.forEach(function (t, idx) {
      html += renderTopToolCard(t, idx + 1);
    });
    html +=   '</ol>';
    html += '</section>';

    var sectionsSorted = scores.bySection.slice().sort(function (a, b) {
      return (a.percentileA || 0) - (b.percentileA || 0);
    });
    html += '<section class="yhl-by-section">';
    html +=   '<h2>By section of the book</h2>';
    html +=   '<p class="yhl-section-intro">Lowest first — where the work is.</p>';
    html +=   '<div class="yhl-bars">';
    sectionsSorted.forEach(function (s) {
      html += renderBar(s.name, s.percentileA);
    });
    html +=   '</div>';
    html += '</section>';

    html += '<aside class="yhl-about-note">';
    html +=   '<div class="yhl-about-label">About this assessment</div>';
    html +=   '<p>Your headline percentile compares your total score on 23 validated, public-domain Happiness items from the International Personality Item Pool to 570 respondents from the Eugene-Springfield Community Sample. The reference data is from the 1990s; population happiness has shifted somewhat since then. If you scored lower than expected, you are in good company. Treat this as a self-reflection tool, not a clinical diagnosis.</p>';
    html += '</aside>';

    html += '<section class="yhl-cta">';
    html +=   '<h2>Knowing the number is one thing. Doing something about it is another.</h2>';
    html +=   "<p>The Workshop is where the doing happens. Seven Habit-Building Skills you can use on any habit you want to build. 42 tools to practice them on. A community of Builders working the same problems you are, cheering each other on. Come build with us.</p>";
    html +=   '<a class="yhl-btn yhl-btn-accent yhl-cta-btn" href="' + escapeAttr(WORKSHOP_URL) + '">Join the Workshop</a>';
    html += '</section>';

    html += '<section class="yhl-drilldown">';
    html +=   '<button class="yhl-expander-toggle" type="button" id="yhl-drill-toggle" aria-expanded="' + (state.drillOpen ? 'true' : 'false') + '" aria-controls="yhl-drill-content">';
    html +=     '<span class="yhl-expander-label">See your chapter and tool breakdown</span>';
    html +=     '<span class="yhl-expander-chevron" aria-hidden="true">' + (state.drillOpen ? '▴' : '▾') + '</span>';
    html +=   '</button>';
    html +=   '<div class="yhl-drill-content" id="yhl-drill-content"' + (state.drillOpen ? '' : ' hidden') + '>';
    html +=     renderDrilldown(scores);
    html +=   '</div>';
    html += '</section>';

    elScreen.innerHTML = html;

    var toggle = document.getElementById('yhl-drill-toggle');
    if (toggle) toggle.addEventListener('click', onDrillToggle);

    var sortBtns = elScreen.querySelectorAll('.yhl-tool-sort-btn');
    Array.prototype.forEach.call(sortBtns, function (b) {
      b.addEventListener('click', onToolSortClick);
    });
    var saveBtn = document.getElementById('yhl-save-pdf-btn');
    if (saveBtn) saveBtn.addEventListener('click', function () { window.print(); });
  }

  function renderTopToolCard(t, rank) {
    var pct = Math.round(t.percentileA || 0);
    var blurb = (t.blurb || '').trim();
    if (blurb && !/[.?!]$/.test(blurb)) blurb += '.';
    return ''
      + '<li class="yhl-tool-card">'
      +   '<div class="yhl-tool-card-head">'
      +     '<span class="yhl-tool-rank">#' + rank + '</span>'
      +     '<span class="yhl-tool-num">' + escapeHtml(t.num) + '</span>'
      +     '<span class="yhl-tool-pct">' + pct + 'th percentile</span>'
      +   '</div>'
      +   '<h3 class="yhl-tool-name">' + escapeHtml(t.name) + '</h3>'
      +   (blurb ? '<p class="yhl-tool-blurb">' + escapeHtml(blurb) + '</p>' : '')
      + '</li>';
  }

  function renderBar(label, pct) {
    var p = Math.round(pct == null ? 50 : pct);
    var pClamped = Math.max(0, Math.min(100, p));
    var aboveBaseline = p >= 50;
    return ''
      + '<div class="yhl-bar' + (aboveBaseline ? ' yhl-bar-up' : ' yhl-bar-down') + '">'
      +   '<div class="yhl-bar-label">' + escapeHtml(label) + '</div>'
      +   '<div class="yhl-bar-track" role="img" aria-label="' + p + ' percentile">'
      +     '<div class="yhl-bar-fill" style="width: ' + pClamped + '%"></div>'
      +     '<div class="yhl-bar-baseline" aria-hidden="true"></div>'
      +   '</div>'
      +   '<div class="yhl-bar-value">' + p + '%</div>'
      + '</div>';
  }

  function renderDrilldown(scores) {
    var html = '';
    html += '<h3 class="yhl-drill-h3">By chapter</h3>';
    var bySection = {};
    scores.byChapter.forEach(function (c) {
      if (!bySection[c.section]) bySection[c.section] = [];
      bySection[c.section].push(c);
    });
    YHL_CONFIG.sections.forEach(function (sec) {
      html += '<div class="yhl-drill-section-group">';
      html +=   '<div class="yhl-drill-section-head">' + escapeHtml(sec.name) + '</div>';
      html +=   '<div class="yhl-bars">';
      var chapters = (bySection[sec.num] || []).slice().sort(function (a, b) { return a.num - b.num; });
      chapters.forEach(function (c) {
        var label = 'Ch ' + c.num + ': ' + (c.name || '');
        html += renderBar(label, c.percentileA);
      });
      html +=   '</div>';
      html += '</div>';
    });

    html += '<h3 class="yhl-drill-h3">By tool</h3>';
    html += '<div class="yhl-tool-sort">';
    html +=   '<span class="yhl-tool-sort-label">Sort:</span>';
    html +=   '<button type="button" class="yhl-tool-sort-btn' + (state.toolSort === 'score' ? ' yhl-tool-sort-active' : '') + '" data-sort="score" aria-pressed="' + (state.toolSort === 'score' ? 'true' : 'false') + '">Lowest score first</button>';
    html +=   '<button type="button" class="yhl-tool-sort-btn' + (state.toolSort === 'book' ? ' yhl-tool-sort-active' : '') + '" data-sort="book" aria-pressed="' + (state.toolSort === 'book' ? 'true' : 'false') + '">Book order</button>';
    html += '</div>';
    var tools = scores.byTool.slice();
    if (state.toolSort === 'score') {
      tools.sort(function (a, b) {
        var ra = a.percentileA == null ? 1000 : a.percentileA;
        var rb = b.percentileA == null ? 1000 : b.percentileA;
        if (ra !== rb) return ra - rb;
        return a.num.localeCompare(b.num);
      });
    } else {
      tools.sort(function (a, b) {
        var pa = a.num.split('.').map(Number);
        var pb = b.num.split('.').map(Number);
        for (var i = 0; i < 3; i++) {
          if (pa[i] !== pb[i]) return pa[i] - pb[i];
        }
        return 0;
      });
    }
    html += '<div class="yhl-bars yhl-tool-bars">';
    tools.forEach(function (t) {
      var label = t.num + ' · ' + t.name;
      html += renderBar(label, t.percentileA);
    });
    html += '</div>';
    return html;
  }

  function onLikertClick(e) {
    var btn = e.currentTarget;
    var itemId = btn.getAttribute('data-item');
    var value = parseInt(btn.getAttribute('data-value'), 10);
    state.answers[itemId] = value;
    var group = btn.parentNode;
    Array.prototype.forEach.call(group.querySelectorAll('.yhl-likert-btn'), function (b) {
      b.setAttribute('aria-checked', b === btn ? 'true' : 'false');
    });
    persistState();
    updateProgress();
    updateFooter();
  }

  function onBack() {
    if (state.screen === 'questions') {
      if (state.page === 0) state.screen = 'intro';
      else state.page -= 1;
    } else if (state.screen === 'email-gate') {
      state.screen = 'questions';
      state.page = totalPages() - 1;
      state.emailError = '';
    } else if (state.screen === 'complete') {
      // Step back through the gate if we used it; otherwise straight to questions.
      if (state.mode === 'workshop' || !state.email) {
        state.screen = 'questions';
        state.page = totalPages() - 1;
      } else {
        state.screen = 'email-gate';
      }
    }
    render();
  }

  function onNext() {
    if (state.screen === 'intro') {
      state.screen = 'questions';
      state.page = 0;
    } else if (state.screen === 'questions') {
      if (!pageComplete(state.page)) return;
      if (state.page === totalPages() - 1) {
        if (state.mode === 'workshop' || (KIT_FORM_ID === '' && state.email)) {
          // Workshop mode skips the gate entirely. Stub mode also skips
          // once an email has been captured (so a re-test doesn't re-prompt).
          state.screen = 'complete';
          state.drillOpen = true;
          state.toolSort = 'score';
        } else if (state.mode === 'workshop') {
          state.screen = 'complete';
        } else {
          state.screen = 'email-gate';
          state.emailError = '';
        }
      } else state.page += 1;
    } else if (state.screen === 'email-gate') {
      // Submission handled by onEmailSubmit; Next should not advance.
      return;
    } else if (state.screen === 'complete') {
      clearState();
      state.screen = 'intro';
      state.page = 0;
      state.answers = {};
      state.drillOpen = false;
      // Clear cached scoring so a fresh attempt re-fetches from the Worker.
      state.scores = null;
      state.kitFields = null;
      state.scoresLoading = false;
      state.scoresError = '';
    }
    render();
  }

  function onDrillToggle(e) {
    state.drillOpen = !state.drillOpen;
    render();
  }

  function onToolSortClick(e) {
    var sort = e.currentTarget.getAttribute('data-sort');
    if (sort === state.toolSort) return;
    state.toolSort = sort;
    render();
  }

  function updateProgress() {
    var totalItems = getItemOrder().length;
    var pct;
    if (state.screen === 'intro') {
      pct = 0;
    } else if (state.screen === 'complete') {
      pct = 100;
    } else if (state.screen === 'email-gate') {
      pct = 100;
    } else {
      var seen = state.page * ITEMS_PER_PAGE;
      var ans = pageItems(state.page).filter(function (it) {
        return state.answers.hasOwnProperty(it.id);
      }).length;
      pct = Math.round(((seen + ans) / totalItems) * 100);
    }
    elProgressFill.style.width = pct + '%';
    if (state.screen === 'intro') {
      elProgressLabel.textContent = 'Ready when you are';
    } else if (state.screen === 'complete') {
      elProgressLabel.textContent = 'Your results';
    } else if (state.screen === 'email-gate') {
      elProgressLabel.textContent = 'One last step';
    } else {
      elProgressLabel.textContent = 'Page ' + (state.page + 1) + ' of ' + totalPages();
    }
  }

  function updateFooter() {
    if (state.screen === 'intro') {
      elBack.style.display = 'none';
      elNext.style.display = '';
      elNext.textContent = 'Start';
      elNext.disabled = false;
    } else if (state.screen === 'questions') {
      elBack.style.display = '';
      elNext.style.display = '';
      elBack.textContent = (state.page === 0) ? 'Back to intro' : 'Back';
      var lastPage = state.page === totalPages() - 1;
      elNext.textContent = lastPage
        ? (state.mode === 'workshop' ? 'See results' : 'Continue')
        : 'Next';
      elNext.disabled = !pageComplete(state.page);
    } else if (state.screen === 'email-gate') {
      elBack.style.display = '';
      elBack.textContent = 'Back to questions';
      elNext.style.display = 'none';
    } else if (state.screen === 'complete') {
      elBack.style.display = '';
      elNext.style.display = '';
      elBack.textContent = 'Back';
      elNext.textContent = 'Start over';
      elNext.disabled = false;
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function escapeAttr(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

})();
