// ============================================================================
// 1. GLOBAL SYSTEM CONFIGURATION & STATE MANAGEMENT
// ============================================================================

let sidebarOpen = false;
let autoCloseTimer = null;
let progressInterval = null;
const AUTO_CLOSE_DELAY = 20000;
let startTime = 0;

let mediaStream = null;
let useFrontCamera = false;

let appState = {
  currentView: 'dashboard',
  reports: JSON.parse(localStorage.getItem('azania_reports') || '[]'),
  capturedPhotos: [],
  activeInspection: null
};


// ============================================================================
// 2. HTML INCLUDES & SYSTEM INITIALIZATION
// ============================================================================

async function loadIncludes() {
  const includes = [
    { id: 'include-header', file: 'includes/header.html' },
    { id: 'include-sidebar', file: 'includes/sidebar.html' },
    { id: 'include-footer', file: 'includes/footer.html' }
  ];

  for (const item of includes) {
    const element = document.getElementById(item.id);
    if (!element) continue;

    try {
      const response = await fetch(item.file);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      element.outerHTML = await response.text();
    } catch (error) {
      console.error(`Error loading ${item.file}:`, error);
    }
  }

  if (window.lucide) {
    lucide.createIcons();
  }

  initThemeSystem();
  setupLeftEdgeHover();
}

document.addEventListener('DOMContentLoaded', () => {
  loadIncludes();
  updateDashboardStats();
  
  const dateInput = document.getElementById('f-visit-date');
  if (dateInput && !dateInput.value) {
    dateInput.valueAsDate = new Date();
  }
  updateAutoDescription();
});


// ============================================================================
// 3. THEME MANAGEMENT SYSTEM
// ============================================================================

function initThemeSystem() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);

  document.documentElement.classList.toggle('dark', isDark);
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}


// ============================================================================
// 4. SIDEBAR & AUTO-HIDE MANAGEMENT SYSTEM
// ============================================================================

function toggleSidebar(forceState) {
  const sidebar = document.getElementById('desktopSidebar');
  const contentWrapper = document.getElementById('contentWrapper');
  const topNavbar = document.getElementById('topNavbar');
  const headerBrand = document.getElementById('headerBrand');

  if (!sidebar) return;

  sidebarOpen = typeof forceState === 'boolean' ? forceState : !sidebarOpen;

  if (sidebarOpen) {
    sidebar.classList.remove('-translate-x-full');
    if (contentWrapper) contentWrapper.classList.add('lg:pl-80');
    if (topNavbar) topNavbar.classList.add('lg:pl-80');
    if (headerBrand) headerBrand.classList.add('hidden');
    startAutoCloseCountdown();
  } else {
    sidebar.classList.add('-translate-x-full');
    if (contentWrapper) contentWrapper.classList.remove('lg:pl-80');
    if (topNavbar) topNavbar.classList.remove('lg:pl-80');
    if (headerBrand) headerBrand.classList.remove('hidden');
    stopAutoCloseCountdown();
  }
}

function setupLeftEdgeHover() {
  const trigger = document.getElementById('leftEdgeTrigger');
  const sidebar = document.getElementById('desktopSidebar');

  if (!trigger || !sidebar) return;

  trigger.addEventListener('mouseenter', () => {
    if (!sidebarOpen) {
      toggleSidebar(true);
    }
  });

  sidebar.addEventListener('mousemove', () => {
    if (sidebarOpen) {
      resetAutoCloseTimer();
    }
  });
}

function startAutoCloseCountdown() {
  stopAutoCloseCountdown();
  startTime = Date.now();

  const progressBar = document.getElementById('autoCloseProgressBar');
  const textDisplay = document.getElementById('autoCloseText');

  progressInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, AUTO_CLOSE_DELAY - elapsed);
    const percent = (remaining / AUTO_CLOSE_DELAY) * 100;

    if (progressBar) progressBar.style.width = percent + '%';
    if (textDisplay) textDisplay.innerText = `Auto-hide: ${Math.ceil(remaining / 1000)}s`;

    if (remaining <= 0) {
      toggleSidebar(false);
    }
  }, 100);
}

function resetAutoCloseTimer() {
  startTime = Date.now();
}

function stopAutoCloseCountdown() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }

  const progressBar = document.getElementById('autoCloseProgressBar');
  const textDisplay = document.getElementById('autoCloseText');

  if (progressBar) progressBar.style.width = '100%';
  if (textDisplay) textDisplay.innerText = 'Auto-hide: 20s';
}


// ============================================================================
// 5. MOBILE DRAWER MANAGEMENT
// ============================================================================

function toggleMobileDrawer() {
  const drawer = document.getElementById('mobileDrawerContainer');
  if (!drawer) return;

  if (drawer.classList.contains('grid-rows-[0fr]')) {
    drawer.classList.remove('grid-rows-[0fr]');
    drawer.classList.add('grid-rows-[1fr]');
  } else {
    drawer.classList.remove('grid-rows-[1fr]');
    drawer.classList.add('grid-rows-[0fr]');
  }
}


// ============================================================================
// 6. APPLICATION NAVIGATION & VIEW CONTROLLER
// ============================================================================

function switchView(viewName) {
  ['dashboard', 'form', 'report', 'reports'].forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.add('hidden');
  });

  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.classList.remove('hidden');

  appState.currentView = viewName;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (viewName === 'reports') {
    renderSavedReportsList();
  }
}

function startNewInspection() {
  appState.capturedPhotos = [];
  renderPhotosQueue();

  const form = document.getElementById('inspection-form');
  if (form) form.reset();

  const dateInput = document.getElementById('f-visit-date');
  if (dateInput) dateInput.valueAsDate = new Date();

  updateAutoDescription();
  switchView('form');
}

function updateDashboardStats() {
  const total = appState.reports.length;
  const wakala = appState.reports.filter(r => r && r.type && r.type.includes('Wakala')).length;
  const collateral = appState.reports.filter(r => r && r.type && r.type.includes('Collateral')).length;

  const totalEl = document.getElementById('stat-total');
  const wakalaEl = document.getElementById('stat-wakala');
  const collateralEl = document.getElementById('stat-collateral');

  if (totalEl) totalEl.innerText = total;
  if (wakalaEl) wakalaEl.innerText = wakala;
  if (collateralEl) collateralEl.innerText = collateral;
}


// ============================================================================
// 7. FORM UTILITIES & GEOLOCATION ENGINE
// ============================================================================

function updateAutoDescription() {
  const locality = document.getElementById('f-locality');
  const district = document.getElementById('f-district');
  const descField = document.getElementById('f-description');

  if (locality && district && descField) {
    const locVal = locality.value || "MICHEWENI";
    const distVal = district.value || "KASKAZINI PEMBA";
    descField.value = `Customer deals with Agent business which is located at ${locVal.toUpperCase()}, ${distVal.toUpperCase()}.`;
  }
}

function fetchLiveLocation(evt) {
  if (evt) evt.preventDefault();
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser");
    return;
  }

  const btn = evt ? evt.currentTarget : null;
  const originalHTML = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Locating...`;
    btn.disabled = true;
  }

  navigator.geolocation.getCurrentPosition(async (position) => {
    const lat = position.coords.latitude.toFixed(6);
    const lon = position.coords.longitude.toFixed(6);
    const coordsStr = `${lat},${lon}`;

    const gpsField = document.getElementById('f-gps');
    if (gpsField) gpsField.value = coordsStr;

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
      const data = await response.json();

      if (data && data.address) {
        const ward = data.address.suburb || data.address.neighbourhood || data.address.village || data.address.town || data.address.city || "MICHEWENI";
        const district = data.address.county || data.address.state_district || data.address.state || "KASKAZINI-PEMBA";

        const locField = document.getElementById('f-locality');
        const distField = document.getElementById('f-district');
        if (locField) locField.value = ward.toUpperCase();
        if (distField) distField.value = district.toUpperCase();
        updateAutoDescription();
      }
    } catch (e) {
      console.error("Reverse geocoding failed", e);
    }

    if (btn) {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  }, () => {
    alert("Unable to retrieve your location. Please check GPS permissions.");
    if (btn) {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  }, { enableHighAccuracy: true, timeout: 10000 });
}


// ============================================================================
// 8. CAMERA & PHOTO CAPTURE ENGINE
// ============================================================================

async function openCamera() {
  const camView = document.getElementById('view-camera');
  if (camView) camView.classList.remove('hidden');

  try {
    const constraints = {
      video: { facingMode: useFrontCamera ? 'user' : 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    };
    mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    
    const videoEl = document.getElementById('camera-video');
    if (videoEl) videoEl.srcObject = mediaStream;

    const gpsInput = document.getElementById('f-gps');
    const gpsVal = gpsInput ? gpsInput.value : "-4.944618, 39.74594";
    const camGps = document.getElementById('cam-gps-display');
    if (camGps) camGps.innerText = gpsVal;
  } catch (err) {
    console.warn("Webcam access failed, using file fallback", err);
    const fileInput = document.getElementById('camera-file-input');
    if (fileInput) fileInput.click();
    closeCamera();
  }
}

function closeCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  const camView = document.getElementById('view-camera');
  if (camView) camView.classList.add('hidden');
}

async function switchCameraFacing() {
  useFrontCamera = !useFrontCamera;
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
  }
  try {
    const constraints = {
      video: { facingMode: useFrontCamera ? 'user' : 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    };
    mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    const videoEl = document.getElementById('camera-video');
    if (videoEl) videoEl.srcObject = mediaStream;
  } catch (e) {
    console.error("Error switching camera", e);
  }
}

function capturePhoto() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  if (!video || !canvas) return;

  const vWidth = video.videoWidth || 1280;
  const vHeight = video.videoHeight || 720;
  const size = Math.min(vWidth, vHeight);

  canvas.width = 600;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');

  const sourceX = (vWidth - size) / 2;
  const sourceY = (vHeight - size) / 2;

  ctx.drawImage(video, sourceX, sourceY, size, size, 0, 0, 600, 600);

  const gpsInput = document.getElementById('f-gps');
  const accountInput = document.getElementById('f-account-name');
  const gps = gpsInput ? gpsInput.value : "-4.944618,39.74594";
  const account = accountInput ? accountInput.value : "WAKALA SITE VISIT";
  const dateStr = new Date().toLocaleString();

  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  ctx.fillRect(0, 520, 600, 80);

  ctx.fillStyle = "#0284c7";
  ctx.font = "bold 15px sans-serif";
  ctx.fillText("AZANIA BANK PLC - FIELD AUDIT", 20, 545);

  ctx.fillStyle = "#ffffff";
  ctx.font = "12px sans-serif";
  ctx.fillText(`Account: ${account.toUpperCase()} | GPS: ${gps}`, 20, 568);
  ctx.fillText(`Timestamp: ${dateStr}`, 20, 588);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  saveCapturedPhoto(dataUrl);
  closeCamera();
}

function handleFileFallback(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.getElementById('camera-canvas');
      if (!canvas) return;
      canvas.width = 600;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 600, 600);
      saveCapturedPhoto(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function saveCapturedPhoto(dataUrl) {
  const visitType = document.getElementById('f-visit-type');
  const accountName = document.getElementById('f-account-name');
  
  appState.capturedPhotos.push({
    id: Date.now(),
    url: dataUrl,
    caption: (visitType ? visitType.value : 'Inspection') + ' - ' + (accountName ? accountName.value : 'Account')
  });
  renderPhotosQueue();
}

function removePhoto(id) {
  appState.capturedPhotos = appState.capturedPhotos.filter(p => p.id !== id);
  renderPhotosQueue();
}

function renderPhotosQueue() {
  const container = document.getElementById('photos-preview-container');
  const badge = document.getElementById('photo-count-badge');
  if (badge) badge.innerText = appState.capturedPhotos.length;

  if (!container) return;
  if (appState.capturedPhotos.length === 0) {
    container.innerHTML = `
      <div class="col-span-full border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl p-8 text-center text-slate-500">
        <i class="fa-solid fa-camera-retro text-3xl mb-2"></i>
        <p class="text-xs">No photos captured yet. Click 'Take Square Photo' above.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = appState.capturedPhotos.map((photo, index) => `
    <div class="relative group bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <img src="${photo.url}" alt="Captured Square Photo" class="w-full h-36 object-cover">
      <div class="p-3">
        <p class="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">Square Photo #${index + 1}</p>
        <button type="button" onclick="removePhoto(${photo.id})" class="mt-2 text-xs text-red-500 hover:text-red-600 flex items-center gap-1">
          <i class="fa-solid fa-trash"></i> Remove
        </button>
      </div>
    </div>
  `).join('');
}


// ============================================================================
// 9. REPORT GENERATION & RENDERING ENGINE
// ============================================================================

function generateReport(event) {
  if (event) event.preventDefault();

  const typeEl = document.getElementById('f-visit-type');
  const accountEl = document.getElementById('f-account-name');
  const officerEl = document.getElementById('f-officer-name');
  const dateEl = document.getElementById('f-visit-date');
  const gpsEl = document.getElementById('f-gps');
  const localityEl = document.getElementById('f-locality');
  const districtEl = document.getElementById('f-district');
  const descEl = document.getElementById('f-description');

  const formData = {
    id: Date.now(),
    type: typeEl ? typeEl.value : 'Wakala Account',
    accountName: accountEl ? accountEl.value : 'UNNAMED ACCOUNT',
    officerName: officerEl ? officerEl.value : 'Hawa Juma',
    visitDate: dateEl ? dateEl.value : new Date().toISOString().split('T')[0],
    gps: gpsEl ? gpsEl.value : '-4.944618,39.74594',
    locality: localityEl ? localityEl.value : 'MICHEWENI',
    district: districtEl ? districtEl.value : 'KASKAZINI-PEMBA',
    description: descEl ? descEl.value : 'Customer site visit audit inspection.',
    photos: [...appState.capturedPhotos],
    timestamp: new Date().toISOString()
  };

  appState.activeInspection = formData;
  appState.reports.unshift(formData);
  
  try {
    localStorage.setItem('azania_reports', JSON.stringify(appState.reports));
  } catch (err) {
    console.warn("Storage warning:", err);
  }

  updateDashboardStats();
  populateReportView(formData);
  switchView('report');
}

function populateReportView(data) {
  if (!data) return;

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val || '';
  };

  setText('rep-account-name', data.accountName);
  setText('rep-gps', data.gps);
  setText('rep-locality', data.locality);
  setText('rep-district', data.district);
  setText('rep-officer-name', data.officerName);
  setText('rep-date', data.visitDate ? new Date(data.visitDate).toLocaleDateString() : '');
  setText('rep-description', data.description);

  setText('rep-sign-officer', data.officerName);
  setText('rep-footer-name', data.officerName);
  setText('rep-footer-date', data.visitDate ? new Date(data.visitDate).toLocaleDateString() : '');

  const mapImg = document.getElementById('rep-map-image');
  if (mapImg && data.gps) {
    const parts = data.gps.split(',').map(s => s.trim());
    if (parts.length === 2 && parts[0] && parts[1]) {
      mapImg.src = `https://static-maps.yandex.ru/1.x/?ll=${parts[1]},${parts[0]}&z=17&size=650,220&l=sat,skl&pt=${parts[1]},${parts[0]},pm2rdl`;
    } else {
      mapImg.src = "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80";
    }
  }

  // 2x6 Grid Pagination Engine
  const container = document.getElementById('dynamic-photos-pages-container');
  if (!container) return;
  container.innerHTML = '';

  if (!data.photos || data.photos.length === 0) {
    container.innerHTML = `
      <div class="print-page-annex bg-white text-slate-900 p-6 sm:p-10 rounded-2xl shadow-2xl max-w-4xl mx-auto flex flex-col justify-between" style="min-height: 1050px;">
        <div>
          <div class="text-center border-b-2 border-slate-900 pb-4 mb-6">
            <h2 class="text-xl sm:text-2xl font-extrabold tracking-wider uppercase text-slate-900">AZANIA BANK PLC</h2>
            <h3 class="text-base sm:text-lg font-bold uppercase text-brand-700 mt-1">SITE VISIT REPORT - ATTACHED BUSINESS PHOTOS</h3>
          </div>
          <p class="text-sm font-semibold text-slate-700 mb-6">Client / Wakala Name: <span class="font-bold text-slate-900 uppercase">${data.accountName}</span></p>
          <div class="border-2 border-dashed border-slate-300 rounded-xl p-16 text-center text-slate-500">
            <p>No business photos were attached for this inspection.</p>
          </div>
        </div>
        <div class="border-t-2 border-slate-900 pt-4 text-center text-xs font-bold text-slate-400">2</div>
      </div>
    `;
    return;
  }

  const PHOTOS_PER_PAGE = 12;
  const totalPages = Math.ceil(data.photos.length / PHOTOS_PER_PAGE);

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const start = pageIdx * PHOTOS_PER_PAGE;
    const pagePhotos = data.photos.slice(start, start + PHOTOS_PER_PAGE);
    const pageNum = pageIdx + 2;

    const pageDiv = document.createElement('div');
    pageDiv.className = "print-page-annex bg-white text-slate-900 p-6 sm:p-8 rounded-2xl shadow-2xl max-w-4xl mx-auto flex flex-col justify-between";
    pageDiv.style.minHeight = "1050px";

    const photosHtml = pagePhotos.map((photo, i) => {
      const globalIndex = start + i + 1;
      return `
        <div class="photo-card border border-slate-800 rounded-lg overflow-hidden bg-slate-50 p-2 flex flex-col justify-between shadow-xs">
          <div class="h-32 sm:h-36 w-full overflow-hidden rounded bg-black flex items-center justify-center">
            <img src="${photo.url}" alt="Square Photo ${globalIndex}" class="w-full h-full object-cover">
          </div>
          <div class="mt-1 pt-1 border-t border-slate-200 flex justify-between items-center text-[11px] font-semibold text-slate-800">
            <span>#${globalIndex}: ${data.accountName}</span>
            <span class="font-mono text-[10px] text-slate-500">${data.gps}</span>
          </div>
        </div>
      `;
    }).join('');

    pageDiv.innerHTML = `
      <div>
        <div class="text-center border-b-2 border-slate-900 pb-2 mb-3">
          <h2 class="text-lg sm:text-xl font-extrabold tracking-wider uppercase text-slate-900">AZANIA BANK PLC</h2>
          <h3 class="text-xs sm:text-sm font-bold uppercase text-brand-700 mt-0.5">SITE VISIT REPORT - ATTACHED SQUARE PHOTOS (2x6 ANNEX)</h3>
        </div>
        <div class="mb-3 flex justify-between items-center text-xs">
          <p class="font-semibold text-slate-700">Client / Wakala Name: <span class="font-bold text-slate-900 uppercase">${data.accountName}</span></p>
          <span class="font-mono text-slate-500">Annex Page ${pageIdx + 1} of ${totalPages}</span>
        </div>
        <div class="grid grid-cols-2 gap-3">
          ${photosHtml}
        </div>
      </div>
      <div class="border-t-2 border-slate-900 pt-2 text-center text-xs font-bold text-slate-400">
        ${pageNum}
      </div>
    `;

    container.appendChild(pageDiv);
  }
}

function renderSavedReportsList() {
  const container = document.getElementById('saved-reports-list');
  if (!container) return;

  if (appState.reports.length === 0) {
    container.innerHTML = `
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-500">
        <i class="fa-solid fa-folder-open text-4xl mb-3"></i>
        <p class="text-sm">No saved inspection reports found.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = appState.reports.map(report => `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
      <div>
        <div class="flex items-center gap-3 mb-1">
          <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">${report.type}</span>
          <span class="text-xs text-slate-500 dark:text-slate-400 font-mono">${new Date(report.timestamp).toLocaleString()}</span>
        </div>
        <h3 class="text-lg font-bold text-slate-900 dark:text-white uppercase">${report.accountName}</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Location: <span class="text-slate-700 dark:text-slate-200 font-medium">${report.locality}, ${report.district}</span> | GPS: <span class="font-mono text-brand-600 dark:text-brand-400">${report.gps}</span></p>
      </div>
      <div class="flex items-center gap-3">
        <button type="button" onclick="loadSavedReport(${report.id})" class="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl shadow transition flex items-center gap-2">
          <i class="fa-solid fa-eye"></i> View Report
        </button>
        <button type="button" onclick="deleteReport(${report.id})" class="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/50 text-red-500 text-xs font-semibold rounded-xl transition">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function loadSavedReport(id) {
  const report = appState.reports.find(r => r.id === id);
  if (report) {
    appState.activeInspection = report;
    populateReportView(report);
    switchView('report');
  }
}

function deleteReport(id) {
  if (confirm("Are you sure you want to delete this saved report?")) {
    appState.reports = appState.reports.filter(r => r.id !== id);
    try {
      localStorage.setItem('azania_reports', JSON.stringify(appState.reports));
    } catch (err) {}
    updateDashboardStats();
    renderSavedReportsList();
  }
}


// ============================================================================
// 10. EXPORT & PRINT FUNCTIONS (PDF, WORD, CSV)
// ============================================================================

function triggerPrintPDF() {
  window.print();
}

function downloadWordDoc() {
  const accountName = document.getElementById('rep-account-name')?.innerText || "WAKALA_REPORT";
  const gps = document.getElementById('rep-gps')?.innerText || "";
  const locality = document.getElementById('rep-locality')?.innerText || "";
  const district = document.getElementById('rep-district')?.innerText || "";
  const officer = document.getElementById('rep-officer-name')?.innerText || "";
  const visitDate = document.getElementById('rep-date')?.innerText || "";
  const description = document.getElementById('rep-description')?.innerText || "";

  let photosHtml = '';
  if (appState.activeInspection && appState.activeInspection.photos && appState.activeInspection.photos.length > 0) {
    photosHtml = appState.activeInspection.photos.map((p, idx) => `
      <div style="display:inline-block; width: 45%; margin: 10px; page-break-inside: avoid; text-align: center;">
        <p style="font-weight: bold; font-size: 11px;">Photo #${idx + 1}</p>
        <img src="${p.url}" style="width: 220px; height: 220px; object-fit: cover; border: 1px solid #000; padding: 3px;" />
        <p style="font-size: 10px; color: #555;">GPS: ${gps}</p>
      </div>
    `).join('');
  } else {
    photosHtml = "<p>No photos attached.</p>";
  }

  const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>Azania Bank Site Visit Report - ${accountName}</title>
      <style>
        body { font-family: 'Calibri', Arial, sans-serif; color: #000; line-height: 1.4; }
        h2, h3 { text-align: center; margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; }
        th, td { border: 1px solid #000; padding: 8px; font-size: 12px; }
        .bg-gray { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
        <h2>AZANIA BANK PLC</h2>
        <h3>SITE VISIT REPORT</h3>
        <br/>
        <table>
            <tr>
                <td class="bg-gray" style="width: 30%;"><b>Name of Wakala Account</b></td>
                <td colspan="3"><b>${accountName}</b></td>
            </tr>
            <tr>
                <td class="bg-gray"><b>Location Details</b></td>
                <td><b>GPS:</b> ${gps}</td>
                <td><b>Locality:</b> ${locality}</td>
                <td><b>District:</b> ${district}</td>
            </tr>
        </table>

        <p><b>Site Visit Date:</b> ${visitDate}</p>
        <p><b>Inspecting Officer:</b> ${officer}</p>
        
        <p><b>General Description of the Business:</b></p>
        <p style="background: #f9f9f9; padding: 10px; border: 1px solid #ccc;">${description}</p>
        
        <br/><hr/><br/>
        <h3>ATTACHED SQUARE PHOTOS & ANNEX (2x6 GRID)</h3>
        <br/>
        ${photosHtml}

        <br/><hr/><br/>
        <p><b>Verification Statement:</b> I, <u>${officer}</u> being an employee of Azania Bank Plc, do verify and state that the information contained in this report is true to the best of my knowledge.</p>
        <br/>
        <table style="border: none;">
          <tr>
            <td style="border: none;"><b>Name:</b> ${officer}</td>
            <td style="border: none;"><b>Signature:</b> ........................................</td>
            <td style="border: none;"><b>Date:</b> ${visitDate}</td>
          </tr>
        </table>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Azania_Bank_Site_Visit_${accountName.replace(/\s+/g, '_')}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportCSV() {
  if (!appState.activeInspection) return;
  const r = appState.activeInspection;
  const csvRows = [
    ["Field", "Value"],
    ["Inspection Type", r.type],
    ["Account Name", r.accountName],
    ["Officer Name", r.officerName],
    ["Visit Date", r.visitDate],
    ["GPS Coordinates", r.gps],
    ["Locality", r.locality],
    ["District", r.district],
    ["Description", r.description.replace(/,/g, " ")]
  ];
  
  const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Azania_Audit_${r.accountName.replace(/\s+/g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}