// مضيف محركات التصميم — يشغّل قوالب المهارات كما هي (templates/post.html · templates/slide.html)
// نفس الكود يشتغل بمعاينة المتصفح وبكروم السيرفر (puppeteer) عشان الناتج يطابق المهارة بالبكسل.
//
//   await RenderHost.render({engine:'guzeleser', size:'post', spec, photo, qr})       → {W,H,qc}
//   await RenderHost.render({engine:'investors-gate', spec /*بعد دمج preset*/, index}) → {W,H,qc}
//   RenderHost.frame()  → iframe الرسم (للتصدير من المتصفح)
(function () {
  'use strict';
  var ORIGIN = location.origin;
  var SIZES = { post: [1080, 1350], story: [1080, 1920], tall: [1080, 1920], square: [1080, 1080], wide: [1920, 1080] };
  var textCache = {};

  function getText(u) {
    if (!textCache[u]) textCache[u] = fetch(u).then(function (r) {
      if (!r.ok) throw new Error('ما قدرت أحمّل ' + u + ' (' + r.status + ') — شغّل npm run sync');
      return r.text();
    }).catch(function (e) { delete textCache[u]; throw e; });
    return textCache[u];
  }
  function getJSON(u) { return getText(u).then(JSON.parse); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  // المهلة تُحسب بس والصفحة ظاهرة — المتصفح يوقف requestAnimationFrame بالتبويبات المخفية
  async function waitFor(fn, ms, what) {
    var spent = 0, last = Date.now();
    while (spent < ms) {
      try { if (fn()) return; } catch (e) { /* القالب لسا يحمّل */ }
      await sleep(40);
      var now = Date.now();
      if (document.visibilityState !== 'hidden' && (!window.top || window.top.document.visibilityState !== 'hidden')) spent += now - last;
      last = now;
    }
    throw new Error('انتهت المهلة: ' + what);
  }

  var current = null; // {mode, W, H, el}
  function stage(mode, W, H) {
    var f = document.getElementById('stage');
    if (!f || !current || current.mode !== mode) {
      if (f) f.remove();
      f = document.createElement('iframe');
      f.id = 'stage';
      f.setAttribute('scrolling', 'no');
      document.body.appendChild(f);
      current = { mode: mode, W: 0, H: 0, el: f, ready: false };
    }
    f.style.width = W + 'px'; f.style.height = H + 'px';
    document.documentElement.style.width = document.body.style.width = W + 'px';
    document.documentElement.style.height = document.body.style.height = H + 'px';
    current.W = W; current.H = H;
    return f;
  }

  // ينتظر الخطوط + كل الصور (عناصر img وخلفيات CSS) — القوالب تحط الصور كخلفيات
  async function settle(win) {
    var doc = win.document;
    try { await doc.fonts.ready; } catch (e) { /* */ }
    var urls = new Set();
    doc.querySelectorAll('*').forEach(function (el) {
      var bg = win.getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none') bg.replace(/url\("?([^")]+)"?\)/g, function (_, u) { urls.add(u); return _; });
    });
    var waits = Array.prototype.map.call(doc.images, function (im) {
      return im.complete ? 0 : new Promise(function (r) { im.onload = im.onerror = r; });
    });
    urls.forEach(function (u) {
      waits.push(new Promise(function (r) { var i = new Image(); i.onload = i.onerror = r; i.src = u; }));
    });
    await Promise.all(waits);
    await sleep(140);
  }

  // ───────── Güzel Eser (guzeleser-post · templates/post.html · window.DATA → window.READY/QC) ─────────
  var G = {
    base: ORIGIN + '/engines/guzeleser/',
    _assets: null,
    assets: function () {
      if (this._assets) return this._assets;
      var b = this.base + 'assets/';
      this._assets = getJSON(b + 'icons/map.json').then(function (iconmap) {
        return {
          fonts: { black: b + 'fonts/gilroy-black.ttf', heavy: b + 'fonts/Gilroy-Heavy.ttf', bold: b + 'fonts/Gilroy-Bold.ttf',
            medium: b + 'fonts/Gilroy-Medium.ttf', light: b + 'fonts/Gilroy-Light.ttf', script: b + 'fonts/Yellowtail-Regular.ttf' },
          icons: { regular: b + 'icons/tabler-icons.woff2', thin: b + 'icons/tabler-icons-200.woff2', filled: b + 'icons/tabler-icons-filled.woff2' },
          iconmap: iconmap,
          logo: { color_h: b + 'logo/logo_color_h.png', white_h: b + 'logo/logo_white_h.png',
            color_stacked: b + 'logo/logo_color_stacked.png', white_stacked: b + 'logo/logo_white_stacked.png',
            emblem: b + 'logo/emblem_white.png' },
          tex: { noise: b + 'textures/noise.png', ribbon_light: b + 'textures/ribbon_light.png',
            ribbon_navy: b + 'textures/ribbon_navy.png', pattern: b + 'textures/pattern.png' },
        };
      });
      return this._assets;
    },
    render: async function (job) {
      var size = job.size || 'post';
      var wh = SIZES[size]; var W = wh[0], H = wh[1];
      var A = await this.assets();
      var brand = await getJSON(this.base + 'brand.json');
      var spec = job.spec || {};
      var over = spec[size] || {};
      // نفس دمج scripts/render.js بالمهارة
      var data = Object.assign({}, spec, over, { W: W, H: H, size: size, assets: A, brand: brand.footer });
      data.photo = job.photo ? Object.assign({}, job.photo, over.photo || {}) : null;
      if (data.photo && (!data.photo.info || !data.photo.info.cut)) delete data.photo.cut;
      data.qr = job.qr || null;
      var tpl = await getText(this.base + 'templates/post.html');
      var json = JSON.stringify(data).replace(/</g, '\\u003c');
      var html = tpl.replace('/*DATA*/', 'window.DATA = ' + json + ';')
        .replace('<head>', '<head><base href="' + this.base + 'templates/">');
      var f = stage('guzeleser', W, H);
      await new Promise(function (res) { f.onload = res; f.srcdoc = html; });
      await waitFor(function () { return f.contentWindow.READY === true; }, 30000, 'قالب Güzel Eser ما جهز');
      await settle(f.contentWindow);
      return { W: W, H: H, qc: JSON.parse(JSON.stringify(f.contentWindow.QC || null)) };
    },
  };

  // ───────── بوابة المستثمر (investors-gate · templates/slide.html · window.render(D) → QC) ─────────
  var FAM = { bahij: 'Bahij', plex: 'Plex', cairo: 'Cairo', expo: 'Expo', thsans: 'ThSans', thserif: 'ThSerif' };
  var IG = {
    base: ORIGIN + '/engines/investors-gate/',
    _assets: null,
    assets: function () {
      if (this._assets) return this._assets;
      var base = this.base, b = base + 'assets/';
      this._assets = Promise.all([
        getJSON(base + 'files.json'), getJSON(b + 'icons/map.json'), getJSON(b + 'logo/meta.json'),
        getJSON(b + 'geo/mena.json').catch(function () { return null; }),
        getText(b + 'logo/motif_arrow.svg'), getText(b + 'logo/motif_outline.svg'),
      ]).then(function (r) {
        var logo = {};
        r[0].forEach(function (f) { var m = f.match(/^assets\/logo\/(.+)\.svg$/); if (m) logo[m[1]] = base + f; });
        return {
          fonts: {
            bahij: { 300: 'Bahij_TheSansArabic-Light.ttf', 400: 'Bahij_TheSansArabic-Plain.ttf', 600: 'Bahij_TheSansArabic-SemiBold.ttf',
              700: 'Bahij_TheSansArabic-Bold.ttf', 800: 'Bahij_TheSansArabic-ExtraBold.ttf', 900: 'Bahij_TheSansArabic-Black.ttf' },
            plex: { 300: 'IBMPlexSansArabic-Light.ttf', 400: 'IBMPlexSansArabic-Regular.ttf', 500: 'IBMPlexSansArabic-Medium.ttf',
              600: 'IBMPlexSansArabic-SemiBold.ttf', 700: 'IBMPlexSansArabic-Bold.ttf' },
            cairo: { 500: 'cairo-medium.ttf', 800: 'cairo-extra-bold.ttf' },
            expo: { 300: 'Expo Arabic Light.ttf', 400: 'Expo Arabic Book.ttf', 500: 'Expo Arabic Medium.ttf', 600: 'ExpoArabic-SemiBold.ttf',
              700: 'Expo Arabic Bold.ttf', 800: 'Expo Arabic Bold.ttf', 900: 'Expo Arabic Bold.ttf' },
            thsans: { 300: 'thmanyahsans-Light.otf', 400: 'thmanyahsans-Regular.otf', 500: 'thmanyahsans-Medium.otf', 600: 'thmanyahsans-Medium.otf',
              700: 'thmanyahsans-Bold.otf', 800: 'thmanyahsans-Bold.otf', 900: 'thmanyahsans-Black.otf' },
            thserif: { 300: 'thmanyahserifdisplay-Light.otf', 400: 'thmanyahserifdisplay-Regular.otf', 500: 'thmanyahserifdisplay-Medium.otf',
              600: 'thmanyahserifdisplay-Medium.otf', 700: 'thmanyahserifdisplay-Bold.otf', 800: 'thmanyahserifdisplay-Bold.otf', 900: 'thmanyahserifdisplay-Black.otf' },
          },
          fontBase: b + 'fonts/',
          icons: { regular: b + 'icons/tabler-icons.woff2', thin: b + 'icons/tabler-icons-200.woff2', filled: b + 'icons/tabler-icons-filled.woff2' },
          iconmap: r[1], logo: logo, logoMeta: r[2],
          tex: { paper: b + 'textures/paper.png', paper_soft: b + 'textures/paper_soft.png', grain: b + 'textures/grain.png',
            mottle: b + 'textures/mottle.png', linen: b + 'textures/linen.png', stucco: b + 'textures/stucco.png', cotton: b + 'textures/cotton.png' },
          geo: r[3],
          svg: { motif_arrow: r[4], motif_outline: r[5] },
        };
      });
      return this._assets;
    },
    fontCSS: function (A) {
      var css = '';
      Object.keys(A.fonts).forEach(function (k) {
        Object.keys(A.fonts[k]).forEach(function (w) {
          css += "@font-face{font-family:'" + FAM[k] + "';font-weight:" + w + ';src:url("' + A.fontBase + A.fonts[k][w] + '")}\n';
        });
      });
      css += "@font-face{font-family:'tabler';src:url(\"" + A.icons.regular + "\")}@font-face{font-family:'tabler-thin';src:url(\"" + A.icons.thin + "\")}@font-face{font-family:'tabler-f';src:url(\"" + A.icons.filled + "\")}" +
        ".ti{font-family:'tabler';font-style:normal;line-height:1;display:inline-block}.tif{font-family:'tabler-f';font-style:normal;line-height:1;display:inline-block}.tit{font-family:'tabler-thin';font-style:normal;line-height:1;display:inline-block}";
      return css;
    },
    render: async function (job) {
      var spec = job.spec || {};
      var wh = SIZES[spec.format || 'post'] || SIZES.post; var W = wh[0], H = wh[1];
      var A = await this.assets();
      var brand = await getJSON(this.base + 'brand.json');
      var fresh = !current || current.mode !== 'investors-gate' || !current.ready;
      var f = stage('investors-gate', W, H);
      if (fresh) {
        await new Promise(function (res) { f.onload = res; f.src = IG.base + 'templates/slide.html'; });
        var w0 = f.contentWindow;
        w0.document.getElementById('fontcss').textContent = this.fontCSS(A);
        var loads = [];
        ['Bahij', 'Expo', 'ThSans', 'ThSerif'].forEach(function (fam) {
          [400, 500, 700, 800, 900].forEach(function (wt) { loads.push(w0.document.fonts.load(wt + ' 40px ' + fam).catch(function () {})); });
        });
        loads.push(w0.document.fonts.load('40px tabler').catch(function () {}));
        await Promise.all(loads);
        current.ready = true;
      }
      var win = f.contentWindow;
      var slides = spec.slides || [spec];
      var i = job.index || 0;
      // نبني البيانات داخل عالم القالب نفسه (Array/instanceof تشتغل صح بين الإطارات)
      var D = win.JSON.parse(JSON.stringify({ spec: spec, slide: slides[i], i: i, n: slides.length, assets: A, brand: brand }));
      var QC = await win.render(D);
      await settle(win);
      return { W: W, H: H, qc: JSON.parse(JSON.stringify(QC || null)) };
    },
  };

  var ENGINES = { guzeleser: G, 'investors-gate': IG };
  var queue = Promise.resolve();

  window.RenderHost = {
    sizes: SIZES,
    // كل الرسم بطابور واحد — مسرح واحد
    render: function (job) {
      var run = function () {
        var e = ENGINES[job.engine];
        if (!e) return Promise.reject(new Error('محرك غير معروف: ' + job.engine));
        return e.render(job);
      };
      var p = queue.then(run, run);
      queue = p.catch(function () {});
      return p;
    },
    frame: function () { return document.getElementById('stage'); },
    reset: function () { var f = document.getElementById('stage'); if (f) f.remove(); current = null; },
  };
  window.RENDER_HOST_READY = true;
})();
