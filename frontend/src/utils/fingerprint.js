// ============================================================================
// DEVICE ID - Industry Standard Persistent Identifier
// ============================================================================
// UUID v4 stored in localStorage - survives browser restarts
// Also stored in sessionStorage and cookie for redundancy
export const getDeviceId = () => {
  // Try to recover from any storage
  let deviceId = localStorage.getItem('deviceId')
    || sessionStorage.getItem('deviceId')
    || getCookie('_fpid');

  if (!deviceId) {
    deviceId = generateUUID();
  }

  // Store in multiple locations for persistence
  try {
    localStorage.setItem('deviceId', deviceId);
    sessionStorage.setItem('deviceId', deviceId);
    setCookie('_fpid', deviceId, 365);
  } catch (e) {
    // Storage might be disabled
  }

  return deviceId;
};

// Cookie helpers
const setCookie = (name, value, days) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
};

const getCookie = (name) => {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
};

// Generate UUID v4 (industry standard for device identification)
const generateUUID = () => {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }

  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// ============================================================================
// DEVICE FINGERPRINT - Hardware & System Characteristics
// ============================================================================
// Based on physical device properties (GPU, CPU, screen, etc.)
// Changes only when hardware/OS changes
export const getDeviceFingerprint = async () => {
  const components = [];

  // 1. Platform & OS
  components.push(navigator.platform || 'unknown');
  components.push(navigator.userAgentData?.platform || 'unknown');

  // 2. CPU Architecture
  components.push(navigator.hardwareConcurrency || 'unknown');
  components.push(navigator.deviceMemory || 'unknown');

  // 3. GPU Information (WebGL)
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'unknown');
        components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown');
      }

      // WebGL capabilities (high entropy)
      components.push(gl.getParameter(gl.MAX_TEXTURE_SIZE));
      components.push(gl.getParameter(gl.MAX_VERTEX_ATTRIBS));
      components.push(gl.getParameter(gl.MAX_VIEWPORT_DIMS)?.join(',') || 'unknown');
      components.push(gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS));
      components.push(gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE));
      components.push(gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS));
      components.push(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
      components.push(gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE)?.join(',') || 'unknown');
      components.push(gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)?.join(',') || 'unknown');

      // WebGL extensions
      const extensions = gl.getSupportedExtensions() || [];
      components.push(extensions.sort().join(','));
    }
  } catch (e) {
    components.push('webgl-error');
  }

  // 4. WebGL Render Hash (how GPU actually renders - high entropy)
  try {
    const webglHash = await getWebGLRenderHash();
    components.push(webglHash);
  } catch (e) {
    components.push('webgl-render-error');
  }

  // 5. Screen Physical Properties
  components.push(`${window.screen.width}x${window.screen.height}`);
  components.push(window.screen.colorDepth);
  components.push(window.screen.pixelDepth);
  components.push(window.devicePixelRatio || 1);
  // Available screen (differs based on taskbar/dock)
  components.push(window.screen.availWidth);
  components.push(window.screen.availHeight);
  components.push(window.screen.availLeft || 0);
  components.push(window.screen.availTop || 0);

  // 6. Touch Support
  components.push(navigator.maxTouchPoints || 0);
  components.push('ontouchstart' in window);

  // 7. Media Devices (cameras, microphones - without permission prompt)
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const deviceTypes = devices.map(d => d.kind).sort().join(',');
      components.push(deviceTypes);
      components.push(devices.length);
    }
  } catch (e) {
    components.push('media-error');
  }

  const fingerprint = await hashString(components.join('|||'));
  return fingerprint;
};

// WebGL Render Hash - renders a scene and hashes the output
// Different GPUs/drivers render slightly differently
const getWebGLRenderHash = () => {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 50;
      canvas.height = 50;
      const gl = canvas.getContext('webgl');
      if (!gl) {
        resolve('no-webgl');
        return;
      }

      // Vertex shader
      const vertexShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vertexShader, `
        attribute vec2 position;
        void main() { gl_Position = vec4(position, 0.0, 1.0); }
      `);
      gl.compileShader(vertexShader);

      // Fragment shader
      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fragmentShader, `
        precision mediump float;
        void main() { gl_FragColor = vec4(0.812, 0.356, 0.491, 1.0); }
      `);
      gl.compileShader(fragmentShader);

      // Program
      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      gl.useProgram(program);

      // Draw triangle
      const vertices = new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.0, 0.5]);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Hash last portion of data URL
      const dataUrl = canvas.toDataURL();
      resolve(dataUrl.slice(-100));
    } catch (e) {
      resolve('webgl-render-error');
    }
  });
};

// ============================================================================
// BROWSER FINGERPRINT - Software & Configuration
// ============================================================================
// Based on browser settings, installed fonts, canvas rendering
// Changes when browser/extensions/settings change
export const getBrowserFingerprint = async () => {
  const components = [];

  // 1. User Agent & Browser Info
  components.push(navigator.userAgent);
  components.push(navigator.vendor || 'unknown');
  components.push(navigator.appVersion);

  // 2. Language & Locale Settings
  components.push(navigator.language);
  components.push(navigator.languages?.join(',') || 'unknown');
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  components.push(Intl.DateTimeFormat().resolvedOptions().locale || 'unknown');

  // 3. Browser Capabilities & Plugins
  components.push(navigator.cookieEnabled);
  components.push(navigator.doNotTrack || 'unknown');
  components.push(typeof navigator.plugins !== 'undefined' ? navigator.plugins.length : 0);
  components.push(navigator.pdfViewerEnabled ?? 'unknown');

  // 4. Canvas Fingerprint (rendering differences between browsers/OS)
  try {
    const canvasFp = await getCanvasFingerprint();
    components.push(canvasFp);
  } catch (e) {
    components.push('canvas-error');
  }

  // 5. Audio Context Fingerprint (oscillator method - high entropy)
  try {
    const audioFp = await getAudioFingerprint();
    components.push(audioFp);
  } catch (e) {
    components.push('audio-error');
  }

  // 6. Font Detection
  const detectedFonts = await detectFonts();
  components.push(detectedFonts.join(','));

  // 7. Storage Capabilities
  try {
    components.push(typeof localStorage !== 'undefined');
    components.push(typeof sessionStorage !== 'undefined');
    components.push(typeof indexedDB !== 'undefined');
  } catch (e) {
    components.push('storage-error');
  }

  // 8. Math fingerprint (floating point differences between engines)
  components.push(getMathFingerprint());

  const fingerprint = await hashString(components.join('|||'));
  return fingerprint;
};

// Canvas fingerprint with curves and shapes
const getCanvasFingerprint = async () => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 280;
  canvas.height = 80;

  // Text with emojis
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f60';
  ctx.fillRect(125, 1, 62, 20);
  ctx.fillStyle = '#069';
  ctx.font = '11pt Arial';
  ctx.fillText('Cwm fjordbank glyphs vext quiz, 😃🎵', 2, 15);
  ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
  ctx.font = 'italic 18pt Times New Roman';
  ctx.fillText('Cwm fjordbank glyphs vext quiz, 😃', 4, 45);

  // Bezier curve
  ctx.beginPath();
  ctx.moveTo(0, 70);
  ctx.bezierCurveTo(30, 40, 60, 80, 100, 60);
  ctx.strokeStyle = '#a33';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Arc with gradient
  const gradient = ctx.createRadialGradient(200, 40, 5, 200, 40, 30);
  gradient.addColorStop(0, '#ff0');
  gradient.addColorStop(1, '#f0f');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(200, 40, 25, 0, Math.PI * 2);
  ctx.fill();

  // Blend mode test
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
  ctx.fillRect(240, 10, 30, 30);
  ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
  ctx.fillRect(250, 20, 30, 30);

  return canvas.toDataURL();
};

// Audio fingerprint using oscillator (high entropy)
const getAudioFingerprint = () => {
  return new Promise((resolve) => {
    try {
      const AudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!AudioContext) {
        resolve('no-audio-context');
        return;
      }

      const context = new AudioContext(1, 44100, 44100);

      const oscillator = context.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(10000, context.currentTime);

      const compressor = context.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-50, context.currentTime);
      compressor.knee.setValueAtTime(40, context.currentTime);
      compressor.ratio.setValueAtTime(12, context.currentTime);
      compressor.attack.setValueAtTime(0, context.currentTime);
      compressor.release.setValueAtTime(0.25, context.currentTime);

      oscillator.connect(compressor);
      compressor.connect(context.destination);
      oscillator.start(0);

      context.startRendering().then((buffer) => {
        const data = buffer.getChannelData(0);
        let sum = 0;
        for (let i = 4500; i < 5000; i++) {
          sum += Math.abs(data[i]);
        }
        resolve(sum.toString());
      }).catch(() => resolve('audio-render-error'));

      // Timeout fallback
      setTimeout(() => resolve('audio-timeout'), 1000);
    } catch (e) {
      resolve('audio-error');
    }
  });
};

// Font detection with expanded font list
const detectFonts = async () => {
  const baseFonts = ['monospace', 'sans-serif', 'serif'];
  const testFonts = [
    // Common fonts
    'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia', 'Palatino',
    'Garamond', 'Bookman', 'Comic Sans MS', 'Trebuchet MS', 'Impact',
    // Windows fonts
    'Calibri', 'Cambria', 'Candara', 'Consolas', 'Constantia', 'Corbel',
    'Segoe UI', 'Segoe UI Emoji',
    // Mac fonts
    'Helvetica', 'Helvetica Neue', 'Lucida Grande', 'Geneva', 'Monaco',
    'SF Pro', 'San Francisco', 'Apple Color Emoji',
    // Linux fonts
    'Ubuntu', 'Droid Sans', 'Roboto', 'Noto Sans', 'Liberation Sans',
    // Developer fonts
    'Menlo', 'Source Code Pro', 'Fira Code', 'JetBrains Mono',
    // Other
    'Tahoma', 'Lucida Console', 'Lucida Sans Unicode', 'MS Gothic', 'MS PGothic'
  ];

  const detectedFonts = [];
  const testString = 'mmmmmmmmmmlli';
  const testSize = '72px';

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const baseFontWidths = {};
  baseFonts.forEach(baseFont => {
    ctx.font = testSize + ' ' + baseFont;
    baseFontWidths[baseFont] = ctx.measureText(testString).width;
  });

  testFonts.forEach(font => {
    let detected = false;
    baseFonts.forEach(baseFont => {
      ctx.font = testSize + ' "' + font + '", ' + baseFont;
      const width = ctx.measureText(testString).width;
      if (width !== baseFontWidths[baseFont]) {
        detected = true;
      }
    });
    if (detected) {
      detectedFonts.push(font);
    }
  });

  return detectedFonts.sort();
};

// Math fingerprint - floating point implementation differences
const getMathFingerprint = () => {
  const values = [
    Math.tan(-1e300),
    Math.sin(Math.PI / 6),
    Math.cos(Math.PI / 3),
    Math.exp(1),
    Math.log(Math.E * 2),
    Math.sqrt(2),
    Math.atan2(1, 2),
    Math.pow(Math.PI, -50),
  ];
  return values.map(v => v.toString().slice(0, 15)).join(',');
};

// ============================================================================
// BOT DETECTION - Catches headless browsers and automation tools
// ============================================================================
export const getBotScore = () => {
  let score = 100;
  const signals = [];

  // 1. WebDriver (Selenium, Puppeteer with automation flag)
  if (navigator.webdriver) {
    score -= 40;
    signals.push('webdriver');
  }

  // 2. Headless Chrome user agent
  if (/HeadlessChrome/.test(navigator.userAgent)) {
    score -= 40;
    signals.push('headless-ua');
  }

  // 3. PhantomJS
  if (window.callPhantom || window._phantom) {
    score -= 40;
    signals.push('phantom');
  }

  // 4. Nightmare.js
  if (window.__nightmare) {
    score -= 40;
    signals.push('nightmare');
  }

  // 5. Chrome without chrome object (headless often lacks this)
  if (/Chrome/.test(navigator.userAgent) && !window.chrome) {
    score -= 30;
    signals.push('fake-chrome');
  }

  // 6. No plugins (real browsers have at least a few)
  if (navigator.plugins && navigator.plugins.length === 0) {
    score -= 15;
    signals.push('no-plugins');
  }

  // 7. Zero dimensions (headless default)
  if (window.outerWidth === 0 || window.outerHeight === 0) {
    score -= 30;
    signals.push('zero-dimensions');
  }

  // 8. No languages
  if (!navigator.languages || navigator.languages.length === 0) {
    score -= 20;
    signals.push('no-languages');
  }

  // 9. Inconsistent screen (window bigger than screen)
  if (window.innerWidth > window.screen.width || window.innerHeight > window.screen.height) {
    score -= 15;
    signals.push('screen-overflow');
  }

  // 10. Automation-related properties
  if (document.documentElement.getAttribute('webdriver') !== null) {
    score -= 30;
    signals.push('webdriver-attr');
  }

  // 11. Check for common automation globals
  if (window.domAutomation || window.domAutomationController) {
    score -= 30;
    signals.push('dom-automation');
  }

  // 12. WebGL software renderer (SwiftShader = headless)
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        if (/SwiftShader|LLVMpipe|Software|llvmpipe/.test(renderer)) {
          score -= 35;
          signals.push('software-renderer');
        }
      }
    }
  } catch (e) {
    // Ignore
  }

  // 13. Missing essential browser features
  if (!window.localStorage || !window.sessionStorage) {
    score -= 15;
    signals.push('no-storage');
  }

  // 14. Permissions API inconsistency
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied' &&
      navigator.permissions) {
    // This check is async, we'll just note the APIs exist
  }

  return {
    score: Math.max(0, score),
    signals,
    isBot: score < 50
  };
};

// ============================================================================
// PROOF OF EXECUTION - Proves real JavaScript ran in real browser
// ============================================================================
export const getExecutionProof = () => {
  const startTime = performance.now();

  // Do measurable work (real browsers take 1-30ms, instant for spoofed)
  let hash = 0;
  for (let i = 0; i < 50000; i++) {
    hash = ((hash << 5) - hash + i) | 0;
  }

  const duration = performance.now() - startTime;

  return {
    // Timing (bots are too fast or too slow)
    duration: Math.round(duration * 100) / 100,
    workHash: (hash >>> 0).toString(16),

    // Environment proof
    hasWebGL: !!document.createElement('canvas').getContext('webgl'),
    hasAudio: !!(window.AudioContext || window.webkitAudioContext),
    hasCanvas2D: !!document.createElement('canvas').getContext('2d'),

    // Browser state
    historyLength: window.history.length,
    screenConsistent: window.innerWidth <= window.screen.width && window.innerHeight <= window.screen.height,
    hasChrome: !!window.chrome,
    languageCount: navigator.languages?.length || 0,

    // Timestamp
    timestamp: Date.now()
  };
};

// ============================================================================
// COMBINED FINGERPRINT PAYLOAD - Everything the backend needs
// ============================================================================
export const getFullFingerprintPayload = async () => {
  const [deviceFp, browserFp] = await Promise.all([
    getDeviceFingerprint(),
    getBrowserFingerprint()
  ]);

  const deviceId = getDeviceId();
  const botCheck = getBotScore();
  const execProof = getExecutionProof();

  return {
    deviceId,
    deviceFingerprint: deviceFp,
    browserFingerprint: browserFp,
    botScore: botCheck.score,
    botSignals: botCheck.signals,
    executionProof: execProof
  };
};

// ============================================================================
// HASHING
// ============================================================================
const hashString = async (str) => {
  if (window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // Fallback
    }
  }

  // FNV-1a fallback
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
};
