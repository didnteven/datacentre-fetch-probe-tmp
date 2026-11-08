(function(){
  const n = navigator, o = {};
  o.ua = n.userAgent; o.platform = n.platform; o.vendor = n.vendor; o.webdriver = n.webdriver;
  o.languages = n.languages; o.plugins = n.plugins ? n.plugins.length : null; o.mimeTypes = n.mimeTypes ? n.mimeTypes.length : null;
  o.hw = n.hardwareConcurrency; o.mem = n.deviceMemory; o.touch = n.maxTouchPoints;
  o.uaData = n.userAgentData ? { brands: n.userAgentData.brands.map(b => b.brand + ' ' + b.version), mobile: n.userAgentData.mobile, platform: n.userAgentData.platform } : null;
  o.screen = [screen.width, screen.height, screen.colorDepth, devicePixelRatio]; o.inner = [innerWidth, innerHeight];
  o.tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  o.chromeObj = typeof window.chrome; o.chromeRuntime = !!(window.chrome && window.chrome.runtime);
  try { o.notif = Notification.permission; } catch (e) {}
  try { const c = document.createElement('canvas'); const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (gl) { const e = gl.getExtension('WEBGL_debug_renderer_info'); o.webgl = e ? [gl.getParameter(e.UNMASKED_VENDOR_WEBGL), gl.getParameter(e.UNMASKED_RENDERER_WEBGL)] : [gl.getParameter(gl.VENDOR), gl.getParameter(gl.RENDERER)]; } else o.webgl = null; } catch (e) { o.webgl = 'error'; }
  try { const c = document.createElement('canvas'); c.width = 200; c.height = 40; const x = c.getContext('2d'); x.textBaseline = 'top'; x.font = '14px Arial'; x.fillText('fingerprint test 123', 2, 2);
    const d = c.toDataURL(); let h = 0; for (let i = 0; i < d.length; i++) { h = (h * 31 + d.charCodeAt(i)) | 0; } o.canvasHash = h; } catch (e) {}
  o.headlessInUA = /headless/i.test(n.userAgent);
  return JSON.stringify(o);
})()
