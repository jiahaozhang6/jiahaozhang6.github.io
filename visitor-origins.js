(function () {
  'use strict';

  var wrap = document.getElementById('visitor-origins');
  var toggle = document.getElementById('visitor-origins-toggle');
  var panel = document.getElementById('visitor-origins-panel');
  var smallCanvas = document.getElementById('visitor-origins-globe');
  var largeCanvas = document.getElementById('visitor-origins-map');
  var totalElement = document.getElementById('visitor-total-count');
  var countryCountElement = document.getElementById('visitor-country-count');
  var listElement = document.getElementById('visitor-origins-list');
  var scanElement = document.getElementById('visitor-origins-scan');

  if (!wrap || !toggle || !panel || !smallCanvas || !largeCanvas || !totalElement || !listElement) return;

  var COUNTER_API = 'https://abacus.jasoncameron.dev';
  var GEO_API = 'https://api.country.is/';
  var NAMESPACE = 'www-jiahaozhang-cn-20260922';
  var SESSION_KEY = 'jiahao-visit-counted-v2';
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var counts = {};
  var currentCountry = null;
  var scanStarted = false;
  var marks = [];

  var countries = [
    ['CN', 35.9, 104.2, 'China'], ['US', 39.8, -98.6, 'United States'],
    ['GB', 54.0, -2.4, 'United Kingdom'], ['JP', 36.2, 138.3, 'Japan'],
    ['DE', 51.2, 10.4, 'Germany'], ['KR', 36.5, 127.9, 'South Korea'],
    ['IN', 22.0, 79.0, 'India'], ['FR', 46.6, 2.4, 'France'],
    ['CA', 56.1, -106.3, 'Canada'], ['SG', 1.4, 103.8, 'Singapore'],
    ['AU', -25.3, 133.8, 'Australia'], ['IT', 42.8, 12.6, 'Italy'],
    ['ES', 40.2, -3.7, 'Spain'], ['NL', 52.2, 5.3, 'Netherlands'],
    ['CH', 46.8, 8.2, 'Switzerland'], ['SE', 62.0, 15.0, 'Sweden'],
    ['BR', -10.8, -52.9, 'Brazil'], ['RU', 61.5, 96.0, 'Russia'],
    ['PL', 52.0, 19.4, 'Poland'], ['VN', 16.0, 106.3, 'Vietnam'],
    ['TH', 15.1, 101.0, 'Thailand'], ['ID', -2.5, 118.0, 'Indonesia'],
    ['MY', 4.2, 102.0, 'Malaysia'], ['PH', 12.8, 122.9, 'Philippines'],
    ['TR', 39.0, 35.2, 'Türkiye'], ['IL', 31.4, 35.0, 'Israel'],
    ['BE', 50.6, 4.6, 'Belgium'], ['AT', 47.6, 14.1, 'Austria'],
    ['DK', 56.0, 9.5, 'Denmark'], ['NO', 64.6, 12.0, 'Norway'],
    ['FI', 64.5, 26.0, 'Finland'], ['IE', 53.2, -8.1, 'Ireland'],
    ['PT', 39.6, -8.0, 'Portugal'], ['CZ', 49.7, 15.3, 'Czechia'],
    ['UA', 48.9, 31.3, 'Ukraine'], ['MX', 23.9, -102.5, 'Mexico'],
    ['AR', -35.4, -65.2, 'Argentina'], ['CL', -37.7, -71.4, 'Chile'],
    ['ZA', -29.0, 25.1, 'South Africa'], ['AE', 24.0, 54.0, 'United Arab Emirates'],
    ['NZ', -41.5, 172.8, 'New Zealand'], ['PK', 29.9, 69.3, 'Pakistan'],
    ['BD', 23.9, 90.2, 'Bangladesh'], ['IR', 32.6, 54.3, 'Iran'],
    ['KZ', 48.2, 67.3, 'Kazakhstan'], ['NG', 9.6, 8.1, 'Nigeria'],
    ['EG', 26.5, 29.9, 'Egypt'], ['SA', 24.1, 44.5, 'Saudi Arabia']
  ];

  var countryByCode = {};
  countries.forEach(function (country) {
    countryByCode[country[0]] = {
      lat: country[1],
      lon: country[2],
      fallbackName: country[3]
    };
  });

  function fetchJson(url, timeout) {
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? window.setTimeout(function () { controller.abort(); }, timeout || 7000) : null;
    return fetch(url, controller ? { signal: controller.signal } : undefined)
      .then(function (response) {
        if (!response.ok) return null;
        return response.json();
      })
      .catch(function () { return null; })
      .then(function (value) {
        if (timer) window.clearTimeout(timer);
        return value;
      });
  }

  function counterUrl(action, key) {
    return COUNTER_API + '/' + action + '/' + encodeURIComponent(NAMESPACE) + '/' + encodeURIComponent(key);
  }

  function readCounter(key, increment) {
    return fetchJson(counterUrl(increment ? 'hit' : 'get', key), 7000).then(function (data) {
      return data && typeof data.value === 'number' ? data.value : null;
    });
  }

  function formatNumber(value) {
    return value.toLocaleString(document.documentElement.lang || 'en');
  }

  var alreadyCounted = false;
  try {
    alreadyCounted = window.sessionStorage.getItem(SESSION_KEY) === '1';
  } catch (error) {
    alreadyCounted = false;
  }

  readCounter('visits', !alreadyCounted).then(function (value) {
    if (value === null) return;
    totalElement.textContent = formatNumber(value);
    try { window.sessionStorage.setItem(SESSION_KEY, '1'); } catch (error) { /* private mode */ }
  });

  var privacyRequested = navigator.doNotTrack === '1' || window.doNotTrack === '1' ||
    navigator.msDoNotTrack === '1' || navigator.globalPrivacyControl === true;

  if (!privacyRequested) {
    fetchJson(GEO_API, 6500).then(function (data) {
      var code = data && typeof data.country === 'string' ? data.country.toUpperCase() : '';
      if (!/^[A-Z]{2}$/.test(code)) return;
      currentCountry = code;
      return readCounter('country-' + code, !alreadyCounted).then(function (value) {
        if (value !== null) {
          counts[code] = value;
          renderCountries();
        }
      });
    });
  }

  function displayName(code) {
    try {
      var names = new Intl.DisplayNames([document.documentElement.lang || 'en'], { type: 'region' });
      var localized = names.of(code);
      if (localized && localized !== code) return localized;
    } catch (error) { /* use fallback */ }
    return countryByCode[code] ? countryByCode[code].fallbackName : code;
  }

  function flag(code) {
    return String.fromCodePoint(
      0x1F1E6 + code.charCodeAt(0) - 65,
      0x1F1E6 + code.charCodeAt(1) - 65
    );
  }

  function orderedCodes() {
    return Object.keys(counts).filter(function (code) {
      return counts[code] > 0;
    }).sort(function (a, b) {
      return counts[b] - counts[a] || a.localeCompare(b);
    });
  }

  function renderCountries() {
    var order = orderedCodes();
    countryCountElement.textContent = order.length ? formatNumber(order.length) : '—';
    listElement.textContent = '';

    if (!order.length) {
      var empty = document.createElement('li');
      empty.className = 'visitor-origins__empty';
      empty.textContent = scanStarted ? 'No country/region data yet.' : 'Loading…';
      listElement.appendChild(empty);
      marks = [];
      return;
    }

    var maximum = counts[order[0]];
    order.forEach(function (code) {
      var item = document.createElement('li');
      item.className = 'visitor-origins__item' + (code === currentCountry ? ' is-current' : '');

      var flagElement = document.createElement('span');
      flagElement.textContent = flag(code);

      var nameElement = document.createElement('span');
      nameElement.className = 'visitor-origins__name';
      nameElement.textContent = displayName(code);
      if (code === currentCountry) {
        var you = document.createElement('span');
        you.className = 'visitor-origins__you';
        you.textContent = 'YOU';
        nameElement.appendChild(you);
      }

      var bar = document.createElement('span');
      bar.className = 'visitor-origins__bar';
      var fill = document.createElement('i');
      fill.style.width = Math.max(5, Math.round(counts[code] / maximum * 100)) + '%';
      bar.appendChild(fill);

      var number = document.createElement('span');
      number.className = 'visitor-origins__number';
      number.textContent = formatNumber(counts[code]);

      item.appendChild(flagElement);
      item.appendChild(nameElement);
      item.appendChild(bar);
      item.appendChild(number);
      listElement.appendChild(item);
    });

    marks = order.map(function (code) {
      var place = countryByCode[code];
      if (!place) return null;
      return {
        lat: place.lat,
        lon: place.lon,
        weight: counts[code] / maximum,
        current: code === currentCountry
      };
    }).filter(Boolean);
  }

  function scanCountries() {
    if (scanStarted) return;
    scanStarted = true;
    scanElement.hidden = false;

    var queue = countries.map(function (country) { return country[0]; }).filter(function (code) {
      return code !== currentCountry;
    });

    function runWave() {
      var batch = queue.splice(0, 24);
      Promise.all(batch.map(function (code) {
        return readCounter('country-' + code, false).then(function (value) {
          if (value !== null && value > 0) counts[code] = value;
        });
      })).then(function () {
        renderCountries();
        if (queue.length) {
          window.setTimeout(runWave, 10500);
        } else {
          scanElement.hidden = true;
        }
      });
    }

    runWave();
  }

  function setPanel(open) {
    panel.hidden = !open;
    wrap.classList.toggle('is-open', open);
    document.body.classList.toggle('visitor-panel-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (open) scanCountries();
  }

  toggle.addEventListener('click', function () {
    setPanel(panel.hidden);
  });

  document.addEventListener('click', function (event) {
    if (!panel.hidden && !wrap.contains(event.target)) setPanel(false);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !panel.hidden) {
      setPanel(false);
      toggle.focus();
    }
  });

  var globeColor = '#0d6b87';
  var markerColor = '#08766f';

  function refreshColors() {
    var style = getComputedStyle(document.documentElement);
    globeColor = style.getPropertyValue('--brand').trim() || globeColor;
    markerColor = style.getPropertyValue('--brand-deep').trim() || markerColor;
  }

  function createGlobe(canvas, logicalSize, radius, showOrigins) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(logicalSize * dpr);
    canvas.height = Math.round(logicalSize * dpr);
    var context = canvas.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    var center = logicalSize / 2;
    var tilt = 0.34;

    function project(latitude, longitude, rotation) {
      var cosLatitude = Math.cos(latitude);
      var x = cosLatitude * Math.cos(longitude + rotation);
      var y = Math.sin(latitude);
      var z = cosLatitude * Math.sin(longitude + rotation);
      var tiltedY = y * Math.cos(tilt) - z * Math.sin(tilt);
      var depth = y * Math.sin(tilt) + z * Math.cos(tilt);
      return { x: center + radius * x, y: center - radius * tiltedY, z: depth };
    }

    function drawLine(points) {
      [false, true].forEach(function (front) {
        context.globalAlpha = front ? 0.5 : 0.12;
        context.beginPath();
        var drawing = false;
        points.forEach(function (point) {
          if ((point.z > 0) === front) {
            if (drawing) context.lineTo(point.x, point.y);
            else context.moveTo(point.x, point.y);
            drawing = true;
          } else {
            drawing = false;
          }
        });
        context.stroke();
      });
    }

    return function draw(rotation, now) {
      context.clearRect(0, 0, logicalSize, logicalSize);
      context.strokeStyle = globeColor;
      context.fillStyle = globeColor;
      context.lineWidth = logicalSize > 40 ? 0.85 : 0.7;
      context.globalAlpha = 0.78;
      context.beginPath();
      context.arc(center, center, radius, 0, Math.PI * 2);
      context.stroke();

      var step = logicalSize > 40 ? 5 : 10;
      var latitudes = logicalSize > 40 ? [-60, -40, -20, 0, 20, 40, 60] : [-40, 0, 40];
      var longitudes = logicalSize > 40 ? [0, 30, 60, 90, 120, 150] : [0, 60, 120];

      latitudes.forEach(function (latitude) {
        var points = [];
        for (var angle = 0; angle <= 360; angle += step) {
          points.push(project(latitude * Math.PI / 180, angle * Math.PI / 180, rotation));
        }
        drawLine(points);
      });

      longitudes.forEach(function (longitude) {
        var points = [];
        for (var latitude = -90; latitude <= 90; latitude += step) {
          points.push(project(latitude * Math.PI / 180, longitude * Math.PI / 180, rotation));
        }
        drawLine(points);
      });

      if (showOrigins) {
        marks.forEach(function (mark) {
          var point = project(mark.lat * Math.PI / 180, -mark.lon * Math.PI / 180, rotation);
          if (point.z <= 0) return;
          context.fillStyle = mark.current ? globeColor : markerColor;
          context.globalAlpha = 0.4 + mark.weight * 0.55;
          context.beginPath();
          context.arc(point.x, point.y, 1.4 + mark.weight * 1.7, 0, Math.PI * 2);
          context.fill();
          if (mark.current) {
            context.strokeStyle = globeColor;
            context.globalAlpha = 0.7;
            context.beginPath();
            context.arc(point.x, point.y, 4.6, 0, Math.PI * 2);
            context.stroke();
          }
        });
      }

      var home = project(39.9042 * Math.PI / 180, -116.4074 * Math.PI / 180, rotation);
      if (home.z > 0) {
        var pulse = reducedMotion ? 0.25 : (now / 1500) % 1;
        context.strokeStyle = globeColor;
        context.fillStyle = globeColor;
        context.globalAlpha = 0.42 * (1 - pulse);
        context.beginPath();
        context.arc(home.x, home.y, 1.5 + pulse * 4.2, 0, Math.PI * 2);
        context.stroke();
        context.globalAlpha = 1;
        context.beginPath();
        context.arc(home.x, home.y, 1.5, 0, Math.PI * 2);
        context.fill();
      }

      context.globalAlpha = 1;
    };
  }

  refreshColors();
  var drawSmall = createGlobe(smallCanvas, 26, 11, false);
  var drawLarge = createGlobe(largeCanvas, 120, 52, true);

  var themeObserver = new MutationObserver(function () {
    refreshColors();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  function drawStatic() {
    drawSmall(0.8, 0);
    if (!panel.hidden) drawLarge(0.8, 0);
  }

  if (reducedMotion) {
    drawStatic();
    toggle.addEventListener('click', function () { window.requestAnimationFrame(drawStatic); });
  } else {
    (function animate(now) {
      var rotation = now * 0.00023;
      drawSmall(rotation, now);
      if (!panel.hidden) drawLarge(rotation, now);
      window.requestAnimationFrame(animate);
    })(0);
  }
})();
