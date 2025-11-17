// ============================================================================
// DEVICE ID - Industry Standard Persistent Identifier
// ============================================================================
// UUID v4 stored in localStorage - survives browser restarts
// Cannot be changed without clearing storage (highest persistence)
export const getDeviceId = () => {
  let deviceId = localStorage.getItem('deviceId');

  if (!deviceId) {
    // Generate a cryptographically secure UUID v4
    deviceId = generateUUID();
    localStorage.setItem('deviceId', deviceId);
  }

  return deviceId;
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
  components.push(navigator.platform);
  components.push(navigator.userAgentData?.platform || 'unknown');

  // 2. CPU Architecture
  components.push(navigator.hardwareConcurrency || 'unknown'); // Number of CPU cores
  components.push(navigator.deviceMemory || 'unknown'); // RAM in GB

  // 3. GPU Information (WebGL)
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        // GPU vendor (e.g., "NVIDIA Corporation", "Intel Inc.", "Apple Inc.")
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        // GPU model (e.g., "NVIDIA GeForce RTX 3080", "Apple M1")
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        components.push(vendor);
        components.push(renderer);
      }

      // WebGL capabilities
      components.push(gl.getParameter(gl.MAX_TEXTURE_SIZE));
      components.push(gl.getParameter(gl.MAX_VERTEX_ATTRIBS));
      components.push(gl.getParameter(gl.MAX_VIEWPORT_DIMS).join(','));

      // WebGL extensions (indicates GPU capabilities)
      const extensions = gl.getSupportedExtensions() || [];
      components.push(extensions.sort().join(','));
    }
  } catch (e) {
    components.push('webgl-error');
  }

  // 4. Screen Physical Properties
  components.push(`${window.screen.width}x${window.screen.height}`); // Physical resolution
  components.push(window.screen.colorDepth); // Bits per pixel (24, 32, etc.)
  components.push(window.screen.pixelDepth); // Pixel depth
  components.push(window.devicePixelRatio || 1); // Retina display factor

  // 5. Touch Support (differentiates mobile vs desktop)
  components.push(navigator.maxTouchPoints || 0);
  components.push('ontouchstart' in window);

  // 6. Media Devices (cameras, microphones)
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const deviceTypes = devices.map(d => d.kind).sort().join(',');
      components.push(deviceTypes);
    }
  } catch (e) {
    components.push('media-error');
  }

  // 7. Battery API (if available)
  try {
    if (navigator.getBattery) {
      const battery = await navigator.getBattery();
      components.push(battery.charging ? 'charging' : 'not-charging');
    }
  } catch (e) {
    components.push('no-battery');
  }

  const fingerprint = await hashString(components.join('|||'));
  return fingerprint;
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

  // 4. Canvas Fingerprint (rendering differences between browsers/OS)
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 200;
    canvas.height = 60;

    // Draw complex text with emojis and special characters
    ctx.textBaseline = 'top';
    ctx.font = '14px "Arial"';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.font = '11pt Arial';
    ctx.fillText('Cwm fjordbank glyphs vext quiz, 😃', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.font = 'italic 18pt Times New Roman';
    ctx.fillText('Cwm fjordbank glyphs vext quiz, 😃', 4, 45);

    // Canvas to data URL (each browser/OS renders slightly differently)
    const canvasData = canvas.toDataURL();
    components.push(canvasData);
  } catch (e) {
    components.push('canvas-error');
  }

  // 5. Audio Context Fingerprint (simplified - no deprecated APIs)
  // Uses audio context properties instead of processing audio
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Get unique audio characteristics without playing/processing audio
    const audioProps = [
      audioContext.sampleRate,
      audioContext.baseLatency || 0,
      audioContext.outputLatency || 0,
      audioContext.destination.maxChannelCount,
      audioContext.destination.channelCount,
    ];

    components.push(audioProps.join(','));

    // Clean up immediately (no audio processing needed)
    audioContext.close();
  } catch (e) {
    components.push('audio-error');
  }

  // 6. Font Detection (installed fonts indicate browser/system)
  const baseFonts = ['monospace', 'sans-serif', 'serif'];
  const testFonts = [
    'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia', 'Palatino',
    'Garamond', 'Bookman', 'Comic Sans MS', 'Trebuchet MS', 'Impact',
    'Calibri', 'Cambria', 'Candara', 'Consolas', 'Constantia', 'Corbel',
    'Helvetica', 'Helvetica Neue', 'Lucida Grande', 'Geneva', 'Monaco'
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
      ctx.font = testSize + ' ' + font + ', ' + baseFont;
      const width = ctx.measureText(testString).width;
      if (width !== baseFontWidths[baseFont]) {
        detected = true;
      }
    });
    if (detected) {
      detectedFonts.push(font);
    }
  });

  components.push(detectedFonts.sort().join(','));

  // 7. Storage Capabilities
  try {
    components.push(typeof localStorage !== 'undefined');
    components.push(typeof sessionStorage !== 'undefined');
    components.push(typeof indexedDB !== 'undefined');
  } catch (e) {
    components.push('storage-error');
  }

  // 8. Connection Info
  if (navigator.connection) {
    components.push(navigator.connection.effectiveType || 'unknown');
    components.push(navigator.connection.downlink || 'unknown');
    components.push(navigator.connection.rtt || 'unknown');
  }

  const fingerprint = await hashString(components.join('|||'));
  return fingerprint;
};

// Simple hash function (FNV-1a)
const hashString = async (str) => {
  // Use Web Crypto API for better hashing if available
  if (window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (e) {
      // Fallback to simple hash
    }
  }

  // Fallback: Simple FNV-1a hash
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
};
