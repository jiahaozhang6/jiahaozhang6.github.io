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
  var panelOpenedAt = 0;
  var panelStartLatitude = 25 * Math.PI / 180;
  var panelStartLongitude = 110 * Math.PI / 180;
  var globeRotationSpeed = Math.PI * 2 / 120000;

  var countries = [
    ['CN', 35.9, 104.2, 'China'], ['US', 39.8, -98.6, 'United States'],
    ['GB', 54.0, -2.4, 'United Kingdom'], ['JP', 36.2, 138.3, 'Japan'],
    ['DE', 51.2, 10.4, 'Germany'], ['KR', 36.5, 127.9, 'South Korea'],
    ['IN', 22.0, 79.0, 'India'], ['FR', 46.6, 2.4, 'France'],
    ['CA', 56.1, -106.3, 'Canada'], ['TW', 23.7, 121.0, 'Taiwan, China'],
    ['HK', 22.3, 114.2, 'Hong Kong, China'], ['MO', 22.2, 113.5, 'Macao, China'],
    ['SG', 1.4, 103.8, 'Singapore'],
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

  /* Simplified coastlines used by both globes. Coordinates are [longitude, latitude]. */
  var landOutlines = [
    [[-168, 72], [-150, 70], [-140, 61], [-130, 55], [-124, 48], [-117, 32], [-107, 23], [-97, 18], [-89, 20], [-82, 25], [-80, 31], [-74, 40], [-66, 46], [-58, 52], [-62, 59], [-79, 63], [-92, 70], [-112, 73], [-138, 72]],
    [[-59, 82], [-32, 80], [-20, 72], [-25, 64], [-42, 59], [-55, 64], [-63, 73]],
    [[-81, 12], [-70, 10], [-60, 5], [-50, -5], [-42, -18], [-48, -30], [-58, -40], [-67, -55], [-74, -46], [-76, -28], [-80, -8]],
    [[-10, 36], [-5, 45], [10, 55], [26, 61], [45, 66], [75, 72], [105, 75], [135, 70], [165, 62], [178, 54], [160, 48], [145, 44], [130, 35], [122, 22], [110, 10], [103, 2], [95, 6], [88, 20], [78, 8], [70, 20], [60, 25], [48, 29], [40, 36], [30, 40], [20, 38], [10, 42], [0, 40]],
    [[-17, 35], [0, 37], [16, 34], [31, 30], [42, 12], [50, 1], [42, -15], [31, -29], [19, -35], [7, -31], [-3, -17], [-9, 2], [-16, 16]],
    [[112, -11], [126, -14], [139, -18], [153, -27], [146, -39], [132, -43], [116, -35], [110, -23]],
    [[48, -13], [51, -17], [49, -25], [44, -20]],
    [[130, 31], [136, 35], [141, 42], [145, 44], [142, 36], [136, 32]],
    [[-10, 50], [-5, 58], [1, 54], [-3, 50]],
    [[95, 5], [108, 1], [119, 5], [127, 0], [139, -6], [125, -10], [111, -7], [100, -1]],
    [[166, -35], [174, -40], [178, -47], [169, -46]],
    [[-180, -69], [-135, -72], [-90, -70], [-45, -74], [0, -71], [45, -73], [90, -70], [135, -74], [180, -69]]
  ];
  var detailedCoastlines = false;

  fetch('data/world-countries-110m.geojson?v=20260922-1')
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (data) {
      if (!data || !Array.isArray(data.features)) return;
      var outlines = [];

      function addPolygon(polygon) {
        polygon.forEach(function (ring) {
          if (Array.isArray(ring) && ring.length > 3) outlines.push(ring);
        });
      }

      data.features.forEach(function (feature) {
        var geometry = feature && feature.geometry;
        if (!geometry || !geometry.coordinates) return;
        if (geometry.type === 'Polygon') addPolygon(geometry.coordinates);
        if (geometry.type === 'MultiPolygon') geometry.coordinates.forEach(addPolygon);
      });

      if (outlines.length) {
        landOutlines = outlines;
        detailedCoastlines = true;
        document.dispatchEvent(new Event('visitor-map-data'));
      }
    })
    .catch(function () { /* retain the built-in simplified coastline */ });

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
      if (code === 'TW') code = 'CN';
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
    var regionNames = {
      CN: 'China',
      HK: 'Hong Kong, China',
      MO: 'Macao, China',
      TW: 'Taiwan, China'
    };
    if (regionNames[code]) return regionNames[code];
    try {
      var names = new Intl.DisplayNames([document.documentElement.lang || 'en'], { type: 'region' });
      var localized = names.of(code);
      if (localized && localized !== code) return localized;
    } catch (error) { /* use fallback */ }
    return countryByCode[code] ? countryByCode[code].fallbackName : code;
  }

  function flagCode(code) {
    /* Taiwan is represented with China's national flag; Hong Kong and Macao use regional flags. */
    return code === 'TW' ? 'CN' : code;
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

      var flagElement = document.createElement('img');
      var renderedFlagCode = flagCode(code);
      flagElement.className = 'visitor-origins__flag';
      flagElement.src = 'images/flags/' + renderedFlagCode.toLowerCase() + '.svg';
      flagElement.alt = '';
      flagElement.setAttribute('aria-hidden', 'true');

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
          if (value !== null && value > 0) {
            var normalizedCode = code === 'TW' ? 'CN' : code;
            counts[normalizedCode] = (counts[normalizedCode] || 0) + value;
          }
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
    if (open) {
      var startingPlace = countryByCode[currentCountry] || countryByCode.CN;
      panelStartLatitude = startingPlace.lat * Math.PI / 180;
      panelStartLongitude = startingPlace.lon * Math.PI / 180;
      panelOpenedAt = performance.now();
      scanCountries();
    }
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

  var gridColor = '#b7c8d4';
  var coastColor = '#27677f';
  var markerColor = '#d89a38';
  var currentColor = '#cf5c4a';
  var markerBorderColor = '#ffffff';

  function refreshColors() {
    var style = getComputedStyle(document.documentElement);
    gridColor = style.getPropertyValue('--globe-grid').trim() || gridColor;
    coastColor = style.getPropertyValue('--globe-coast').trim() || coastColor;
    markerColor = style.getPropertyValue('--globe-marker').trim() || markerColor;
    currentColor = style.getPropertyValue('--globe-current').trim() || currentColor;
    markerBorderColor = style.getPropertyValue('--globe-marker-border').trim() || markerBorderColor;
  }

  function createGlobe(canvas, logicalSize, radius, showOrigins) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(logicalSize * dpr);
    canvas.height = Math.round(logicalSize * dpr);
    var context = canvas.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    var center = logicalSize / 2;
    function project(latitude, longitude, centerLongitude, centerLatitude) {
      var cosLatitude = Math.cos(latitude);
      var sinLatitude = Math.sin(latitude);
      var longitudeDelta = longitude - centerLongitude;
      var cosCenterLatitude = Math.cos(centerLatitude);
      var sinCenterLatitude = Math.sin(centerLatitude);
      var x = cosLatitude * Math.sin(longitudeDelta);
      var y = cosCenterLatitude * sinLatitude - sinCenterLatitude * cosLatitude * Math.cos(longitudeDelta);
      var depth = sinCenterLatitude * sinLatitude + cosCenterLatitude * cosLatitude * Math.cos(longitudeDelta);
      return { x: center + radius * x, y: center - radius * y, z: depth };
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

    function drawCoastline(points) {
      context.globalAlpha = logicalSize > 40 ? 0.82 : 0.7;
      context.beginPath();
      var drawing = false;
      points.forEach(function (point) {
        if (point.z > 0) {
          if (drawing) context.lineTo(point.x, point.y);
          else context.moveTo(point.x, point.y);
          drawing = true;
        } else {
          drawing = false;
        }
      });
      context.stroke();
    }

    return function draw(centerLongitude, centerLatitude, now) {
      context.clearRect(0, 0, logicalSize, logicalSize);
      context.strokeStyle = coastColor;
      context.fillStyle = coastColor;
      context.lineWidth = logicalSize > 40 ? 0.85 : 0.7;
      context.globalAlpha = 0.78;
      context.beginPath();
      context.arc(center, center, radius, 0, Math.PI * 2);
      context.stroke();

      context.strokeStyle = gridColor;

      var step = logicalSize > 40 ? 5 : 10;
      var latitudes = logicalSize > 40 ? [-60, -40, -20, 0, 20, 40, 60] : [-40, 0, 40];
      var longitudes = logicalSize > 40 ? [0, 30, 60, 90, 120, 150] : [0, 60, 120];

      latitudes.forEach(function (latitude) {
        var points = [];
        for (var angle = 0; angle <= 360; angle += step) {
          points.push(project(latitude * Math.PI / 180, angle * Math.PI / 180, centerLongitude, centerLatitude));
        }
        drawLine(points);
      });

      longitudes.forEach(function (longitude) {
        var points = [];
        for (var latitude = -90; latitude <= 90; latitude += step) {
          points.push(project(latitude * Math.PI / 180, longitude * Math.PI / 180, centerLongitude, centerLatitude));
        }
        drawLine(points);
      });

      context.strokeStyle = coastColor;
      context.lineWidth = logicalSize > 40 ? 1.15 : 0.75;
      landOutlines.forEach(function (outline) {
        var coastline = [];
        for (var index = 0; index < outline.length; index++) {
          var start = outline[index];
          var end = outline[(index + 1) % outline.length];
          var steps = detailedCoastlines ? 1 : (logicalSize > 40 ? 5 : 2);
          for (var segment = 0; segment < steps; segment++) {
            var progress = segment / steps;
            var lon = start[0] + (end[0] - start[0]) * progress;
            var lat = start[1] + (end[1] - start[1]) * progress;
            coastline.push(project(lat * Math.PI / 180, lon * Math.PI / 180, centerLongitude, centerLatitude));
          }
        }
        coastline.push(project(outline[0][1] * Math.PI / 180, outline[0][0] * Math.PI / 180, centerLongitude, centerLatitude));
        context.strokeStyle = coastColor;
        context.lineWidth = logicalSize > 40 ? 1.05 : 0.75;
        drawCoastline(coastline);
      });

      if (showOrigins) {
        marks.forEach(function (mark) {
          var point = project(mark.lat * Math.PI / 180, mark.lon * Math.PI / 180, centerLongitude, centerLatitude);
          if (point.z <= 0) return;
          context.save();
          context.fillStyle = mark.current ? currentColor : markerColor;
          context.strokeStyle = markerBorderColor;
          context.lineWidth = 0.9;
          context.shadowColor = mark.current ? currentColor : markerColor;
          context.shadowBlur = 3;
          context.globalAlpha = 0.58 + mark.weight * 0.38;
          context.beginPath();
          context.arc(point.x, point.y, 1.8 + mark.weight * 1.7, 0, Math.PI * 2);
          context.fill();
          context.shadowBlur = 0;
          context.globalAlpha = 0.92;
          context.stroke();
          if (mark.current) {
            context.strokeStyle = currentColor;
            context.lineWidth = 1;
            context.globalAlpha = 0.74;
            context.beginPath();
            context.arc(point.x, point.y, 5.2, 0, Math.PI * 2);
            context.stroke();
          }
          context.restore();
        });
      }

      context.globalAlpha = 1;
    };
  }

  refreshColors();
  var drawSmall = createGlobe(smallCanvas, 26, 11, false);
  var drawLarge = createGlobe(largeCanvas, 120, 52, true);

  var themeObserver = new MutationObserver(function () {
    refreshColors();
    if (reducedMotion) window.requestAnimationFrame(drawStatic);
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  function drawStatic() {
    var eastAsia = 110 * Math.PI / 180;
    var defaultLatitude = 25 * Math.PI / 180;
    drawSmall(eastAsia, defaultLatitude, 0);
    if (!panel.hidden) drawLarge(panelStartLongitude, panelStartLatitude, 0);
  }

  document.addEventListener('visitor-map-data', function () {
    if (reducedMotion) window.requestAnimationFrame(drawStatic);
  });

  if (reducedMotion) {
    drawStatic();
    toggle.addEventListener('click', function () { window.requestAnimationFrame(drawStatic); });
  } else {
    var animationStartedAt = performance.now();
    (function animate(now) {
      var eastAsia = 110 * Math.PI / 180;
      var defaultLatitude = 25 * Math.PI / 180;
      var smallCenter = eastAsia + (now - animationStartedAt) * globeRotationSpeed;
      drawSmall(smallCenter, defaultLatitude, now);
      if (!panel.hidden) {
        var largeCenter = panelStartLongitude + Math.max(0, now - panelOpenedAt) * globeRotationSpeed;
        drawLarge(largeCenter, panelStartLatitude, now);
      }
      window.requestAnimationFrame(animate);
    })(animationStartedAt);
  }
})();
