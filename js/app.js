/**
 * MAHLIGAI WEDDING ORGANIZER - CORE APPLICATION LOGIC (v2)
 * Features:
 * 1. Event list with H-n countdowns and auto-sorting.
 * 2. Event creation & editing with strict validation.
 * 3. Master Crew Database (Admin, Asisten, Perias, Fotografer, Supir Gaun/Makeup, MC, dll).
 * 4. Fast Crew Picker: 1-click assign from Master Crew to events.
 * 5. Personalized WhatsApp Job Briefing with Google Maps location for each assigned crew.
 * 6. H-3 Urgent Notification Center (Banner, Bell badge, and Web Notification API).
 * 7. Real-time Checklist & WO Templates.
 */

// Storage Keys (Fresh clean keys)
const STORAGE_KEY_EVENTS = 'mahligai_wedding_events_fresh_v1';
const STORAGE_KEY_MASTER_CREW = 'mahligai_master_crew_fresh_v1';
const STORAGE_KEY_OWNER_ACCOUNT = 'mahligai_owner_account_fresh_v1';
const STORAGE_KEY_AUTH_SESSION = 'mahligai_auth_session_fresh_v1';
const STORAGE_KEY_ADMIN_LIST = 'mahligai_admin_list_fresh_v1';
const STORAGE_KEY_BRAND_CONFIG = 'mahligai_brand_config_fresh_v1';
const STORAGE_KEY_LICENSE = 'mahligai_wo_license_data_v1';

// License Encryption & Verification System (Timed Plans: 1 Bulan, 1 Tahun, Selamanya)
const LICENSE_SECRET_SALT = 'MAHLIGAI_WO_ROYAL_2026_SECURITY_KEY';
const MASTER_ACTIVATION_KEY = 'MAHLIGAI-SUPER-VIP-2026';
const EPOCH_BASE_MS = 1767225600000; // 2026-01-01T00:00:00Z

function normalizeLicensePhone(val) {
  let clean = String(val || '').trim().replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  } else if (clean.startsWith('8')) {
    clean = '62' + clean;
  }
  return clean;
}

function verifyTimedLicense(phone, serialKey) {
  if (!serialKey) {
    return { valid: false, reason: 'Kode lisensi belum diisi.' };
  }
  const cleanKey = String(serialKey).trim().toUpperCase();

  // 1. Kunci Darurat Master Super VIP
  if (cleanKey === MASTER_ACTIVATION_KEY) {
    return {
      valid: true,
      durCode: 'LT',
      durationName: 'Selamanya (Master VIP)',
      isLifetime: true,
      expDateStr: 'Aktif Selamanya',
      daysRemaining: 999999
    };
  }

  // 2. Parse format serial: MWO-{durCode}-{expCode}-{h1}-{h2}
  const match = cleanKey.match(/^MWO-(1M|1Y|LT)-([0-9A-F]{4}|LIFE)-([0-9A-F]{4})-([0-9A-F]{4})$/);
  if (!match) {
    return {
      valid: false,
      reason: 'Format kode lisensi tidak sesuai (Contoh: MWO-1M-00B2-XXXX-XXXX).'
    };
  }

  const [, durCode, expCode, h1, h2] = match;
  const cleanPhone = normalizeLicensePhone(phone);
  if (!cleanPhone || cleanPhone.length < 5) {
    return {
      valid: false,
      reason: 'Nomor WhatsApp tidak valid. Masukkan nomor HP terdaftar.'
    };
  }

  // 3. Cocokkan Hash Kriptografis dari Phone + Duration + Expiry + Salt
  const seed = `${cleanPhone}|${durCode}|${expCode}|${LICENSE_SECRET_SALT}`;
  let hash1 = 5381;
  let hash2 = 52711;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash1 = ((hash1 << 5) + hash1) ^ char;
    hash2 = ((hash2 << 5) + hash2) ^ (char * 33);
  }
  const expectedH1 = (Math.abs(hash1) % 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  const expectedH2 = (Math.abs(hash2) % 0xFFFF).toString(16).toUpperCase().padStart(4, '0');

  if (h1 !== expectedH1 || h2 !== expectedH2) {
    return {
      valid: false,
      reason: 'Nomor WhatsApp dan Kode Lisensi tidak cocok! Pastikan menggunakan nomor HP yang didaftarkan ke admin.'
    };
  }

  // 4. Periksa Masa Berlaku Lisensi
  if (durCode === 'LT' || expCode === 'LIFE') {
    return {
      valid: true,
      durCode: 'LT',
      durationName: 'Selamanya (Permanen)',
      isLifetime: true,
      expDateStr: 'Aktif Selamanya',
      daysRemaining: 999999
    };
  }

  // Hitung kedaluwarsa bulanan / tahunan
  const daysFromBase = parseInt(expCode, 16);
  const expTimestamp = EPOCH_BASE_MS + (daysFromBase * 24 * 60 * 60 * 1000);
  const now = Date.now();
  const expDate = new Date(expTimestamp);
  const expDateStr = expDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const msRemaining = expTimestamp - now;
  const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));

  if (daysRemaining <= 0) {
    return {
      valid: false,
      isExpired: true,
      expDateStr: expDateStr,
      reason: `Masa aktif lisensi Anda telah habis (Kedaluwarsa pada ${expDateStr}). Silakan hubungi admin via WhatsApp untuk perpanjangan.`
    };
  }

  return {
    valid: true,
    durCode: durCode,
    durationName: durCode === '1M' ? 'Paket 1 Bulan (30 Hari)' : 'Paket 1 Tahun (365 Hari)',
    isLifetime: false,
    expTimestamp: expTimestamp,
    expDateStr: expDateStr,
    daysRemaining: daysRemaining
  };
}

// Otomatis bersihkan cache data demo / contoh lama dari browser
(function cleanupLegacyDemoData() {
  const legacyKeys = [
    'mahligai_wedding_events_v1',
    'mahligai_wedding_events_v2',
    'mahligai_master_crew_v1',
    'mahligai_master_crew_v2',
    'mahligai_owner_account_v1',
    'mahligai_owner_account_v2',
    'mahligai_owner_account_v3',
    'mahligai_admin_list_v1',
    'mahligai_admin_list_v2',
    'mahligai_brand_config_v1',
    'mahligai_auth_session_v1',
    'mahligai_auth_session_v2',
    'mahligai_auth_session_v3',
    'mahligai_h3_dismissed'
  ];
  legacyKeys.forEach(k => {
    try { localStorage.removeItem(k); } catch (e) {}
  });
})();

// Default Brand Identity Configuration
function getDefaultBrandConfig() {
  return {
    fullName: 'Mahligai Wedding Organizer',
    shortName: 'Mahligai WO',
    tagline: 'Wedding Organizer Management',
    logoType: 'svg-heart', // 'svg-heart' | 'emoji' | 'image'
    logoValue: '👑'
  };
}

// Helper to optimize and resize uploaded logo to max 200x200 PNG data URL (under ~25KB)
function resizeImageToDataUrl(file, maxWidth, maxHeight, callback) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/png', 0.9);
      callback(null, dataUrl);
    };
    img.onerror = function() {
      callback(new Error('Gagal memproses file gambar. Pastikan format file valid.'));
    };
    img.src = e.target.result;
  };
  reader.onerror = function() {
    callback(new Error('Gagal membaca file gambar logo.'));
  };
  reader.readAsDataURL(file);
}

// Helper to load owner account (Null for fresh install until user registers or inputs in settings)
function loadStoredOwnerAccount() {
  const raw = localStorage.getItem(STORAGE_KEY_OWNER_ACCOUNT);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// Initial Admin List (Empty for clean install)
function getInitialAdminList() {
  return [];
}

// Standard WO Checklist Template
const WO_CHECKLIST_TEMPLATE = [
  { id: 't1', title: 'Technical Meeting (TM) seluruh vendor & keluarga', category: 'Persiapan', completed: true },
  { id: 't2', title: 'Finalisasi rundown acara akad & resepsi bersama MC', category: 'Persiapan', completed: true },
  { id: 't3', title: 'Pengiriman gaun pengantin & perlengkapan makeup oleh supir logistik', category: 'Logistik', completed: false },
  { id: 't4', title: 'Konfirmasi porsi katering & menu gubukan (1200 pax)', category: 'Vendor', completed: false },
  { id: 't5', title: 'Fitting terakhir busana pengantin & orang tua', category: 'Persiapan', completed: false },
  { id: 't6', title: 'Cek berkas administrasi nikah ke KUA / Penghulu', category: 'Administrasi', completed: false },
  { id: 't7', title: 'Soundcheck & tata lampu pelaminan H-1', category: 'Vendor', completed: false },
  { id: 't8', title: 'Loading dekorasi gedung & backdrop photobooth', category: 'Vendor', completed: false },
  { id: 't9', title: 'Briefing tim WO & asisten runner jam 06.00', category: 'Hari H', completed: false },
  { id: 't10', title: 'Pendampingan MUA pengantin & siraman/retouch', category: 'Hari H', completed: false }
];

// Initial Master Crew Directory (Empty for fresh install)
function getInitialMasterCrew() {
  return [];
}

// Initial Events (Empty for fresh install)
function getInitialEvents() {
  return [];
}

// Global Handler for H-3 Urgent Banner Dismiss (works on desktop, touch, & inline onclick)
window.__dismissH3Banner = function(e) {
  if (e) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }
  if (window.mahligaiApp && typeof window.mahligaiApp.dismissH3Banner === 'function') {
    window.mahligaiApp.dismissH3Banner();
  } else if (window.app && typeof window.app.dismissH3Banner === 'function') {
    window.app.dismissH3Banner();
  } else {
    const banner = document.getElementById('h3UrgentBanner');
    if (banner) {
      banner.classList.add('hidden');
      banner.style.display = 'none';
    }
    try {
      sessionStorage.setItem('mahligai_h3_dismissed', 'true');
    } catch (err) {}
  }
  return false;
};

// Application Class
class WeddingApp {
  constructor() {
    window.mahligaiApp = this;
    try {
      this.h3BannerDismissed = sessionStorage.getItem('mahligai_h3_dismissed') === 'true';
    } catch (e) {
      this.h3BannerDismissed = false;
    }

    this.ownerAccount = this.loadOwnerAccount();
    this.adminList = this.loadAdminList();
    this.events = this.loadEvents();
    this.masterCrew = this.loadMasterCrew();
    this.brandConfig = this.loadBrandConfig();
    this.tempBrandLogo = {
      type: this.brandConfig.logoType,
      value: this.brandConfig.logoValue
    };
    this.syncPrimaryAdminToMasterCrew();

    this.currentView = 'events'; // 'events' | 'master-crew' | 'detail'
    this.currentEventId = null;
    this.currentFilter = 'upcoming'; // 'upcoming' | 'h3' | 'archived' | 'all'
    this.searchQuery = '';
    this.masterCrewSearchQuery = '';
    this.masterCrewRoleFilter = 'ALL';
    this.checklistFilter = 'all';

    // Fast picker selected crew IDs
    this.selectedMasterCrewIds = new Set();

    this.initElements();
    this.applyBrandSettings();
    this.bindEvents();
    this.checkLicenseGate();
    this.initAuthGate();
  }

  // Dismiss H-3 Urgent Alert Banner (persists across views in current session)
  dismissH3Banner() {
    this.h3BannerDismissed = true;
    try {
      sessionStorage.setItem('mahligai_h3_dismissed', 'true');
    } catch (e) {}
    if (this.h3UrgentBanner) {
      this.h3UrgentBanner.classList.add('hidden');
      this.h3UrgentBanner.style.display = 'none';
    }
  }

  // Load Owner Account
  loadOwnerAccount() {
    return loadStoredOwnerAccount();
  }

  // Load / Save Admin List
  loadAdminList() {
    const raw = localStorage.getItem(STORAGE_KEY_ADMIN_LIST);
    if (!raw) {
      const initial = getInitialAdminList();
      localStorage.setItem(STORAGE_KEY_ADMIN_LIST, JSON.stringify(initial));
      return initial;
    }
    try {
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  saveAdminList() {
    try {
      localStorage.setItem(STORAGE_KEY_ADMIN_LIST, JSON.stringify(this.adminList));
    } catch (e) {
      console.warn('Storage quota error:', e);
    }
    this.syncPrimaryAdminToMasterCrew();
  }

  // Get Primary Admin (Admin 1)
  getPrimaryAdmin() {
    if (!this.adminList || this.adminList.length === 0) {
      return {
        id: 'adm-none',
        name: 'Belum Diatur',
        phone: '',
        email: '',
        isPrimary: true
      };
    }
    // Cari yang ditandai isPrimary === true
    const designated = this.adminList.find(a => a.isPrimary);
    if (designated) return designated;

    // Jika belum ada yang ditandai, urutan pertama otomatis jadi Admin 1
    return this.adminList[0];
  }

  // Sync Admin 1 into Master Crew so it's directly available across all events
  syncPrimaryAdminToMasterCrew() {
    if (!this.masterCrew) return;
    if (!this.adminList || this.adminList.length === 0) {
      this.masterCrew = this.masterCrew.filter(c => c.id !== 'mc-primary-admin');
      return;
    }

    const primary = this.getPrimaryAdmin();
    if (!primary || primary.id === 'adm-none') {
      this.masterCrew = this.masterCrew.filter(c => c.id !== 'mc-primary-admin');
      return;
    }

    let adminCrew = this.masterCrew.find(c => c.id === 'mc-primary-admin' || c.role.includes('Admin 1'));
    if (adminCrew) {
      adminCrew.name = primary.name;
      adminCrew.phone = primary.phone;
      adminCrew.email = primary.email || '';
      adminCrew.role = 'Admin WO (Admin 1 Utama)';
    } else {
      this.masterCrew.unshift({
        id: 'mc-primary-admin',
        name: primary.name,
        role: 'Admin WO (Admin 1 Utama)',
        phone: primary.phone,
        email: primary.email || '',
        notes: 'Admin Utama penanggung jawab resmi yang otomatis dicantumkan ke aplikasi.'
      });
    }
    this.saveMasterCrew();
  }

  // Load from LocalStorage
  loadEvents() {
    const raw = localStorage.getItem(STORAGE_KEY_EVENTS);
    if (!raw) {
      const initial = getInitialEvents();
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(initial));
      return initial;
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  saveEvents() {
    try {
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(this.events));
    } catch (e) {
      console.warn('Storage quota error:', e);
      if (typeof this.showToast === 'function') {
        this.showToast('Gagal menyimpan: Memori browser penuh!', 'error');
      }
    }
  }

  loadMasterCrew() {
    const raw = localStorage.getItem(STORAGE_KEY_MASTER_CREW);
    if (!raw) {
      const initial = getInitialMasterCrew();
      localStorage.setItem(STORAGE_KEY_MASTER_CREW, JSON.stringify(initial));
      return initial;
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  saveMasterCrew() {
    try {
      localStorage.setItem(STORAGE_KEY_MASTER_CREW, JSON.stringify(this.masterCrew));
    } catch (e) {
      console.warn('Storage quota error:', e);
      if (typeof this.showToast === 'function') {
        this.showToast('Gagal menyimpan: Memori browser penuh!', 'error');
      }
    }
  }

  // DOM Elements Initialization
  initElements() {
    // Views
    this.viewListEvents = document.getElementById('viewListEvents');
    this.viewMasterCrew = document.getElementById('viewMasterCrew');
    this.viewDetailEvent = document.getElementById('viewDetailEvent');

    // Navigation
    this.brandHomeBtn = document.getElementById('brandHomeBtn');
    this.navEventsBtn = document.getElementById('navEventsBtn');
    this.navMasterCrewBtn = document.getElementById('navMasterCrewBtn');
    this.navMasterCrewCount = document.getElementById('navMasterCrewCount');

    // Notification Center
    this.btnNotificationBell = document.getElementById('btnNotificationBell');
    this.headerNotificationCount = document.getElementById('headerNotificationCount');
    this.notificationDropdown = document.getElementById('notificationDropdown');
    this.notificationDropdownList = document.getElementById('notificationDropdownList');
    this.btnRequestWebNotif = document.getElementById('btnRequestWebNotif');
    this.h3UrgentBanner = document.getElementById('h3UrgentBanner');
    this.h3BannerTitle = document.getElementById('h3BannerTitle');
    this.h3BannerDesc = document.getElementById('h3BannerDesc');
    this.btnViewH3Events = document.getElementById('btnViewH3Events');
    this.btnCloseH3Banner = document.getElementById('btnCloseH3Banner');

    // Metrics
    this.metricUpcoming = document.getElementById('metricUpcoming');
    this.metricClosestEvent = document.getElementById('metricClosestEvent');
    this.metricH3Count = document.getElementById('metricH3Count');
    this.metricAvgProgress = document.getElementById('metricAvgProgress');
    this.metricCompletedTasks = document.getElementById('metricCompletedTasks');
    this.metricMasterCrewTotal = document.getElementById('metricMasterCrewTotal');

    // Filter & Search Events
    this.tabUpcoming = document.getElementById('tabUpcoming');
    this.tabH3 = document.getElementById('tabH3');
    this.tabArchived = document.getElementById('tabArchived');
    this.tabAll = document.getElementById('tabAll');
    this.countUpcoming = document.getElementById('countUpcoming');
    this.countH3 = document.getElementById('countH3');
    this.countArchived = document.getElementById('countArchived');
    this.countAll = document.getElementById('countAll');
    this.inputSearchEvents = document.getElementById('inputSearchEvents');
    this.archiveActionBanner = document.getElementById('archiveActionBanner');
    this.btnClearAllArchived = document.getElementById('btnClearAllArchived');
    this.eventsGridContainer = document.getElementById('eventsGridContainer');
    this.eventsEmptyState = document.getElementById('eventsEmptyState');
    this.btnEmptyNewEvent = document.getElementById('btnEmptyNewEvent');

    // PWA Install elements
    this.btnPwaInstall = document.getElementById('btnPwaInstall');
    this.iosInstallModal = document.getElementById('iosInstallModal');
    this.btnCloseIosInstallModal = document.getElementById('btnCloseIosInstallModal');
    this.btnGotItIosInstall = document.getElementById('btnGotItIosInstall');

    // Master Crew View
    this.inputSearchMasterCrew = document.getElementById('inputSearchMasterCrew');
    this.selectMasterRoleFilter = document.getElementById('selectMasterRoleFilter');
    this.btnOpenAddMasterCrewModal = document.getElementById('btnOpenAddMasterCrewModal');
    this.masterCrewGridContainer = document.getElementById('masterCrewGridContainer');
    this.masterCrewEmptyState = document.getElementById('masterCrewEmptyState');
    this.btnEmptyAddMasterCrew = document.getElementById('btnEmptyAddMasterCrew');

    // Detail View
    this.btnBackToList = document.getElementById('btnBackToList');
    this.btnEditCurrentEvent = document.getElementById('btnEditCurrentEvent');
    this.btnDownloadPdfCurrentEvent = document.getElementById('btnDownloadPdfCurrentEvent');
    this.btnToggleArchiveCurrentEvent = document.getElementById('btnToggleArchiveCurrentEvent');
    this.labelToggleArchive = document.getElementById('labelToggleArchive');
    this.btnDeleteCurrentEvent = document.getElementById('btnDeleteCurrentEvent');
    this.btnOpenBulkShareModal = document.getElementById('btnOpenBulkShareModal');

    this.detailCountdownBadge = document.getElementById('detailCountdownBadge');
    this.detailStatusPill = document.getElementById('detailStatusPill');
    this.detailCoupleName = document.getElementById('detailCoupleName');
    this.detailEventDate = document.getElementById('detailEventDate');
    this.detailLocationsHeaderSummary = document.getElementById('detailLocationsHeaderSummary');
    this.detailAkadTime = document.getElementById('detailAkadTime');
    this.detailResepsiTime = document.getElementById('detailResepsiTime');
    this.detailProgressPercent = document.getElementById('detailProgressPercent');
    this.detailProgressBar = document.getElementById('detailProgressBar');
    this.detailProgressRatio = document.getElementById('detailProgressRatio');

    // Section A: Location
    this.detailLocationsList = document.getElementById('detailLocationsList');
    this.detailMapsHintText = document.getElementById('detailMapsHintText');
    this.btnEditLocationsFromSection = document.getElementById('btnEditLocationsFromSection');

    // Section B: Crew
    this.btnOpenSelectFromMasterModal = document.getElementById('btnOpenSelectFromMasterModal');
    this.btnOpenAddCrewModal = document.getElementById('btnOpenAddCrewModal');
    this.detailCrewList = document.getElementById('detailCrewList');
    this.crewEmptyState = document.getElementById('crewEmptyState');
    this.btnChooseMasterFromEmpty = document.getElementById('btnChooseMasterFromEmpty');

    // Section C: Checklist
    this.btnApplyWOTemplate = document.getElementById('btnApplyWOTemplate');
    this.formAddTask = document.getElementById('formAddTask');
    this.inputNewTaskTitle = document.getElementById('inputNewTaskTitle');
    this.selectNewTaskCategory = document.getElementById('selectNewTaskCategory');
    this.checklistRatioDisplay = document.getElementById('checklistRatioDisplay');
    this.checklistBadgeDisplay = document.getElementById('checklistBadgeDisplay');
    this.detailTasksList = document.getElementById('detailTasksList');
    this.tasksEmptyState = document.getElementById('tasksEmptyState');

    // Section D: Share
    this.textareaSharePreview = document.getElementById('textareaSharePreview');
    this.btnCopyShareText = document.getElementById('btnCopyShareText');
    this.btnShareDirectWhatsApp = document.getElementById('btnShareDirectWhatsApp');
    this.selectShareRecipient = document.getElementById('selectShareRecipient');
    this.labelShareButton = document.getElementById('labelShareButton');
    this.btnQuickOpenBulkModal = document.getElementById('btnQuickOpenBulkModal');

    // Modals
    this.btnOpenNewEventModal = document.getElementById('btnOpenNewEventModal');
    this.modalEventBackdrop = document.getElementById('modalEventBackdrop');
    this.modalEventTitle = document.getElementById('modalEventTitle');
    this.btnCloseEventModal = document.getElementById('btnCloseEventModal');
    this.btnCancelEventModal = document.getElementById('btnCancelEventModal');
    this.formEvent = document.getElementById('formEvent');
    this.inputEventId = document.getElementById('inputEventId');
    this.inputCoupleName = document.getElementById('inputCoupleName');
    this.inputEventDate = document.getElementById('inputEventDate');
    this.btnAddLocationInForm = document.getElementById('btnAddLocationInForm');
    this.badgeLocationCount = document.getElementById('badgeLocationCount');
    this.eventLocationsContainer = document.getElementById('eventLocationsContainer');
    this.eventValidationAlert = document.getElementById('eventValidationAlert');
    this.eventValidationAlertText = document.getElementById('eventValidationAlertText');
    this.btnSaveEventLabel = document.getElementById('btnSaveEventLabel');

    // Modal: Select From Master
    this.modalSelectMasterCrewBackdrop = document.getElementById('modalSelectMasterCrewBackdrop');
    this.btnCloseSelectMasterModal = document.getElementById('btnCloseSelectMasterModal');
    this.btnCancelSelectMasterModal = document.getElementById('btnCancelSelectMasterModal');
    this.inputSearchInMasterModal = document.getElementById('inputSearchInMasterModal');
    this.btnSelectAllInMasterModal = document.getElementById('btnSelectAllInMasterModal');
    this.btnDeselectAllInMasterModal = document.getElementById('btnDeselectAllInMasterModal');
    this.masterCrewSelectList = document.getElementById('masterCrewSelectList');
    this.labelSelectedMasterCount = document.getElementById('labelSelectedMasterCount');
    this.btnConfirmAssignMasterCrew = document.getElementById('btnConfirmAssignMasterCrew');

    // Modal: Master Crew CRUD
    this.modalMasterCrewBackdrop = document.getElementById('modalMasterCrewBackdrop');
    this.modalMasterCrewTitle = document.getElementById('modalMasterCrewTitle');
    this.btnCloseMasterCrewModal = document.getElementById('btnCloseMasterCrewModal');
    this.btnCancelMasterCrewModal = document.getElementById('btnCancelMasterCrewModal');
    this.formMasterCrew = document.getElementById('formMasterCrew');
    this.inputMasterCrewId = document.getElementById('inputMasterCrewId');
    this.inputMasterCrewName = document.getElementById('inputMasterCrewName');
    this.selectMasterCrewRole = document.getElementById('selectMasterCrewRole');
    this.inputMasterCrewPhone = document.getElementById('inputMasterCrewPhone');
    this.inputMasterCrewEmail = document.getElementById('inputMasterCrewEmail');
    this.inputMasterCrewNotes = document.getElementById('inputMasterCrewNotes');
    this.masterCrewValidationAlert = document.getElementById('masterCrewValidationAlert');

    // Modal: Custom Crew for Single Event
    this.modalCrewBackdrop = document.getElementById('modalCrewBackdrop');
    this.btnCloseCrewModal = document.getElementById('btnCloseCrewModal');
    this.btnCancelCrewModal = document.getElementById('btnCancelCrewModal');
    this.formCrew = document.getElementById('formCrew');
    this.inputCrewName = document.getElementById('inputCrewName');
    this.selectCrewRole = document.getElementById('selectCrewRole');
    this.inputCrewPhone = document.getElementById('inputCrewPhone');
    this.inputCrewEmail = document.getElementById('inputCrewEmail');
    this.chkSaveToMasterAlso = document.getElementById('chkSaveToMasterAlso');
    this.crewValidationAlert = document.getElementById('crewValidationAlert');

    // Modal: Bulk WhatsApp Dispatch
    this.modalBulkShareBackdrop = document.getElementById('modalBulkShareBackdrop');
    this.btnCloseBulkShareModal = document.getElementById('btnCloseBulkShareModal');
    this.btnCancelBulkShareModal = document.getElementById('btnCancelBulkShareModal');
    this.bulkShareCrewList = document.getElementById('bulkShareCrewList');
    this.btnCopyAllCrewSummary = document.getElementById('btnCopyAllCrewSummary');
    this.btnStartAutoBlast = document.getElementById('btnStartAutoBlast');
    this.autoBlastProgressContainer = document.getElementById('autoBlastProgressContainer');
    this.autoBlastStatusText = document.getElementById('autoBlastStatusText');
    this.autoBlastPct = document.getElementById('autoBlastPct');
    this.autoBlastProgressBar = document.getElementById('autoBlastProgressBar');
    this.btnToggleGatewaySettings = document.getElementById('btnToggleGatewaySettings');
    this.gatewaySettingsBox = document.getElementById('gatewaySettingsBox');
    this.inputWaGatewayToken = document.getElementById('inputWaGatewayToken');
    this.btnSaveGatewayToken = document.getElementById('btnSaveGatewayToken');

    // App Layout wrappers
    this.appHeader = document.getElementById('appHeader');
    this.appMain = document.getElementById('appMain');

    // Full-screen Auth Portal
    this.authPortalScreen = document.getElementById('authPortalScreen');
    this.authRegisterBox = document.getElementById('authRegisterBox');
    this.formOwnerRegister = document.getElementById('formOwnerRegister');
    this.regOwnerName = document.getElementById('regOwnerName');
    this.regOwnerPhone = document.getElementById('regOwnerPhone');
    this.regOwnerPassword = document.getElementById('regOwnerPassword');
    this.regOwnerPasswordConfirm = document.getElementById('regOwnerPasswordConfirm');
    this.btnToggleRegEye = document.getElementById('btnToggleRegEye');
    this.regValidationAlert = document.getElementById('regValidationAlert');

    this.authLoginBox = document.getElementById('authLoginBox');
    this.authLoginGreeting = document.getElementById('authLoginGreeting');
    this.formAppLogin = document.getElementById('formAppLogin');
    this.loginPassword = document.getElementById('loginPassword');
    this.btnToggleLoginEye = document.getElementById('btnToggleLoginEye');
    this.loginAppValidationAlert = document.getElementById('loginAppValidationAlert');
    this.btnResetOwnerAccount = document.getElementById('btnResetOwnerAccount');

    // Header User & Admin Contacts
    this.userRolePill = document.getElementById('userRolePill');
    this.userRoleIcon = document.getElementById('userRoleIcon');
    this.userRoleTitle = document.getElementById('userRoleTitle');
    this.userRoleSub = document.getElementById('userRoleSub');
    this.btnOpenOwnerPanel = document.getElementById('btnOpenOwnerPanel');
    this.btnToggleAuthModal = document.getElementById('btnToggleAuthModal');
    this.labelAuthAction = document.getElementById('labelAuthAction');

    // Modal: Admin Management
    this.modalOwnerAdminBackdrop = document.getElementById('modalOwnerAdminBackdrop');
    this.btnCloseOwnerAdminModal = document.getElementById('btnCloseOwnerAdminModal');
    this.btnCancelOwnerAdminModal = document.getElementById('btnCancelOwnerAdminModal');
    this.adminActiveHighlightBox = document.getElementById('adminActiveHighlightBox');
    this.btnOpenAddAdminForm = document.getElementById('btnOpenAddAdminForm');
    this.containerAdminForm = document.getElementById('containerAdminForm');
    this.formAdminTitle = document.getElementById('formAdminTitle');
    this.formAdminData = document.getElementById('formAdminData');
    this.inputAdminId = document.getElementById('inputAdminId');
    this.inputAdminName = document.getElementById('inputAdminName');
    this.inputAdminPhone = document.getElementById('inputAdminPhone');
    this.inputAdminEmail = document.getElementById('inputAdminEmail');
    this.checkIsPrimaryAdmin = document.getElementById('checkIsPrimaryAdmin');
    this.btnCancelAdminForm = document.getElementById('btnCancelAdminForm');
    this.ownerAdminCardsList = document.getElementById('ownerAdminCardsList');
    this.btnToggleChangePassword = document.getElementById('btnToggleChangePassword');
    this.containerChangePassword = document.getElementById('containerChangePassword');
    this.inputNewOwnerPassword = document.getElementById('inputNewOwnerPassword');
    this.inputConfirmOwnerPassword = document.getElementById('inputConfirmOwnerPassword');
    this.btnSaveNewOwnerPassword = document.getElementById('btnSaveNewOwnerPassword');
    this.btnExportDataBackup = document.getElementById('btnExportDataBackup');
    this.inputImportDataBackup = document.getElementById('inputImportDataBackup');
    this.btnFactoryResetApp = document.getElementById('btnFactoryResetApp');

    // Brand Identity & Header Elements
    this.headerBrandIcon = document.getElementById('headerBrandIcon');
    this.headerBrandTitle = document.getElementById('headerBrandTitle');
    this.headerBrandSubtitle = document.getElementById('headerBrandSubtitle');
    this.authBrandCrest = document.getElementById('authBrandCrest');
    this.authBrandTitle = document.getElementById('authBrandTitle');
    this.authBrandSubtitle = document.getElementById('authBrandSubtitle');

    // Owner Modal Navigation Tabs & Panels
    this.tabBtnBrandingSettings = document.getElementById('tabBtnBrandingSettings');
    this.tabBtnAdminSettings = document.getElementById('tabBtnAdminSettings');
    this.tabBtnSecuritySettings = document.getElementById('tabBtnSecuritySettings');
    this.panelBrandingSettings = document.getElementById('panelBrandingSettings');
    this.panelAdminSettings = document.getElementById('panelAdminSettings');
    this.panelSecuritySettings = document.getElementById('panelSecuritySettings');

    // Brand Form Controls & Live Preview
    this.formBrandSettings = document.getElementById('formBrandSettings');
    this.inputBrandFullName = document.getElementById('inputBrandFullName');
    this.inputBrandShortName = document.getElementById('inputBrandShortName');
    this.inputBrandTagline = document.getElementById('inputBrandTagline');
    this.inputBrandLogoFile = document.getElementById('inputBrandLogoFile');
    this.btnTriggerLogoUpload = document.getElementById('btnTriggerLogoUpload');
    this.btnResetBrandLogo = document.getElementById('btnResetBrandLogo');
    this.boxLogoUploadPreview = document.getElementById('boxLogoUploadPreview');
    this.logoPreviewPlaceholder = document.getElementById('logoPreviewPlaceholder');
    this.imgLogoUploadPreview = document.getElementById('imgLogoUploadPreview');
    this.previewBrandIcon = document.getElementById('previewBrandIcon');
    this.previewBrandTitle = document.getElementById('previewBrandTitle');
    this.previewBrandSubtitle = document.getElementById('previewBrandSubtitle');
    this.btnSaveBrandConfig = document.getElementById('btnSaveBrandConfig');

    // License Activation Portal Elements
    this.licensePortalScreen = document.getElementById('licensePortalScreen');
    this.formLicenseActivation = document.getElementById('formLicenseActivation');
    this.inputLicenseName = document.getElementById('inputLicenseName');
    this.inputLicensePhone = document.getElementById('inputLicensePhone');
    this.inputLicenseKey = document.getElementById('inputLicenseKey');
    this.licenseValidationAlert = document.getElementById('licenseValidationAlert');
    this.adminLicenseStatusBox = document.getElementById('adminLicenseStatusBox');
    this.tabBtnLicenseSettings = document.getElementById('tabBtnLicenseSettings');
    this.btnContactSellerLicense = document.getElementById('btnContactSellerLicense');
    this.headerLicenseBadge = document.getElementById('headerLicenseBadge');

    // Toast Container
    this.toastContainer = document.getElementById('toastContainer');
  }

  // Bind Events
  bindEvents() {
    // License Activation Listener
    if (this.formLicenseActivation) {
      this.formLicenseActivation.addEventListener('submit', (e) => this.handleLicenseActivation(e));
    }
    if (this.tabBtnLicenseSettings) {
      this.tabBtnLicenseSettings.addEventListener('click', () => this.switchOwnerModalTab('license'));
    }
    if (this.headerLicenseBadge) {
      this.headerLicenseBadge.addEventListener('click', () => {
        this.openOwnerAdminModal();
        this.switchOwnerModalTab('license');
      });
    }

    // Auth Portal Form Listeners
    if (this.formOwnerRegister) {
      this.formOwnerRegister.addEventListener('submit', (e) => this.handleOwnerRegister(e));
    }
    if (this.btnToggleRegEye) {
      this.btnToggleRegEye.addEventListener('click', () => {
        const type = this.regOwnerPassword.type === 'password' ? 'text' : 'password';
        this.regOwnerPassword.type = type;
        this.regOwnerPasswordConfirm.type = type;
      });
    }

    if (this.formAppLogin) {
      this.formAppLogin.addEventListener('submit', (e) => this.handleAppLogin(e));
    }
    if (this.btnToggleLoginEye) {
      this.btnToggleLoginEye.addEventListener('click', () => {
        const type = this.loginPassword.type === 'password' ? 'text' : 'password';
        this.loginPassword.type = type;
      });
    }
    if (this.btnResetOwnerAccount) {
      this.btnResetOwnerAccount.addEventListener('click', () => this.handleResetOwnerAccount());
    }

    // Header User & Admin Contacts Listeners
    if (this.btnOpenOwnerPanel) {
      this.btnOpenOwnerPanel.addEventListener('click', () => this.openOwnerAdminModal());
    }
    if (this.userRolePill) {
      this.userRolePill.addEventListener('click', () => this.openOwnerAdminModal());
    }
    if (this.btnToggleAuthModal) {
      this.btnToggleAuthModal.addEventListener('click', () => this.handleLogout());
    }

    // Modal Owner Admin Management
    if (this.btnCloseOwnerAdminModal) {
      this.btnCloseOwnerAdminModal.addEventListener('click', () => this.closeOwnerAdminModal());
    }
    if (this.btnCancelOwnerAdminModal) {
      this.btnCancelOwnerAdminModal.addEventListener('click', () => this.closeOwnerAdminModal());
    }
    if (this.btnOpenAddAdminForm) {
      this.btnOpenAddAdminForm.addEventListener('click', () => this.openAddAdminForm());
    }
    if (this.btnCancelAdminForm) {
      this.btnCancelAdminForm.addEventListener('click', () => this.closeAdminForm());
    }
    if (this.formAdminData) {
      this.formAdminData.addEventListener('submit', (e) => this.handleSaveAdmin(e));
    }
    if (this.btnToggleChangePassword) {
      this.btnToggleChangePassword.addEventListener('click', () => {
        this.containerChangePassword.classList.toggle('hidden');
      });
    }
    if (this.btnSaveNewOwnerPassword) {
      this.btnSaveNewOwnerPassword.addEventListener('click', () => this.handleSaveNewOwnerPassword());
    }
    if (this.btnExportDataBackup) {
      this.btnExportDataBackup.addEventListener('click', () => this.handleExportDataBackup());
    }
    if (this.inputImportDataBackup) {
      this.inputImportDataBackup.addEventListener('change', (e) => this.handleImportDataBackup(e));
    }
    if (this.btnFactoryResetApp) {
      this.btnFactoryResetApp.addEventListener('click', () => this.handleFactoryReset());
    }

    // Owner Modal Navigation Tabs
    if (this.tabBtnBrandingSettings) {
      this.tabBtnBrandingSettings.addEventListener('click', () => this.switchOwnerModalTab('branding'));
    }
    if (this.tabBtnAdminSettings) {
      this.tabBtnAdminSettings.addEventListener('click', () => this.switchOwnerModalTab('admin'));
    }
    if (this.tabBtnSecuritySettings) {
      this.tabBtnSecuritySettings.addEventListener('click', () => this.switchOwnerModalTab('security'));
    }

    // Brand Form & Logo Picker Handlers
    if (this.btnTriggerLogoUpload && this.inputBrandLogoFile) {
      this.btnTriggerLogoUpload.addEventListener('click', () => {
        this.inputBrandLogoFile.click();
      });
      this.inputBrandLogoFile.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (!file.type.match(/^image\//)) {
          this.showToast('Pilih file gambar yang valid (PNG, JPG, WEBP, atau SVG).', 'warning');
          return;
        }
        if (file.size > 3 * 1024 * 1024) {
          this.showToast('Ukuran file maksimal 3MB!', 'warning');
          return;
        }

        resizeImageToDataUrl(file, 200, 200, (err, dataUrl) => {
          if (err) {
            this.showToast('Gagal memproses gambar logo. Coba file lain.', 'danger');
            return;
          }
          this.tempBrandLogo = {
            type: 'image',
            value: dataUrl
          };
          this.updateBrandLivePreview();
          this.showToast('Pratinjau logo diperbarui! Klik "Simpan Identitas" untuk menerapkan.', 'info');
        });
      });
    }

    if (this.btnResetBrandLogo) {
      this.btnResetBrandLogo.addEventListener('click', () => {
        this.tempBrandLogo = {
          type: 'svg-heart',
          value: '👑'
        };
        this.updateBrandLivePreview();
        this.showToast('Logo di-reset ke ikon bawaan.', 'info');
      });
    }

    // Quick Icon Buttons
    document.querySelectorAll('.quick-icon-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const icon = btn.dataset.icon;
        if (icon === 'svg-heart') {
          this.tempBrandLogo = { type: 'svg-heart', value: '💖' };
        } else {
          this.tempBrandLogo = { type: 'emoji', value: icon };
        }
        this.updateBrandLivePreview();
      });
    });

    // Live typing listeners for preview
    if (this.inputBrandShortName) {
      this.inputBrandShortName.addEventListener('input', () => this.updateBrandLivePreview());
    }
    if (this.inputBrandTagline) {
      this.inputBrandTagline.addEventListener('input', () => this.updateBrandLivePreview());
    }
    if (this.inputBrandFullName) {
      this.inputBrandFullName.addEventListener('input', () => this.updateBrandLivePreview());
    }

    // Brand Form Submit
    if (this.formBrandSettings) {
      this.formBrandSettings.addEventListener('submit', (e) => this.handleSaveBrandConfig(e));
    }

    // Navigation Tabs
    this.brandHomeBtn.addEventListener('click', () => this.switchView('events'));
    this.navEventsBtn.addEventListener('click', () => this.switchView('events'));
    this.navMasterCrewBtn.addEventListener('click', () => this.switchView('master-crew'));
    this.btnBackToList.addEventListener('click', () => this.switchView('events'));

    // Notification Dropdown Toggle
    this.btnNotificationBell.addEventListener('click', (e) => {
      e.stopPropagation();
      this.notificationDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!this.notificationDropdown.contains(e.target) && e.target !== this.btnNotificationBell) {
        this.notificationDropdown.classList.add('hidden');
      }
    });

    if (this.btnCloseH3Banner) {
      const handleClose = (e) => {
        if (e) {
          if (typeof e.preventDefault === 'function') e.preventDefault();
          if (typeof e.stopPropagation === 'function') e.stopPropagation();
        }
        this.dismissH3Banner();
      };
      this.btnCloseH3Banner.addEventListener('click', handleClose);
      this.btnCloseH3Banner.addEventListener('touchend', handleClose, { passive: false });
    }

    this.btnViewH3Events.addEventListener('click', () => {
      this.switchView('events');
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      this.tabH3.classList.add('active');
      this.currentFilter = 'h3';
      this.renderEventList();
    });

    this.btnRequestWebNotif.addEventListener('click', () => {
      this.requestWebNotification();
    });

    // Event Filter Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        const target = e.currentTarget;
        target.classList.add('active');
        this.currentFilter = target.dataset.filter;
        this.renderEventList();
      });
    });

    this.inputSearchEvents.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      this.renderEventList();
    });

    if (this.btnClearAllArchived) {
      this.btnClearAllArchived.addEventListener('click', () => this.clearAllArchivedEvents());
    }

    // PWA Install Event Listeners (iPhone & Android)
    this.initPwaInstall();

    // Event Modal
    this.btnOpenNewEventModal.addEventListener('click', () => this.openEventModal());
    this.btnEmptyNewEvent.addEventListener('click', () => this.openEventModal());
    this.btnCloseEventModal.addEventListener('click', () => this.closeEventModal());
    this.btnCancelEventModal.addEventListener('click', () => this.closeEventModal());
    this.formEvent.addEventListener('submit', (e) => this.handleEventFormSubmit(e));
    if (this.btnAddLocationInForm) {
      this.btnAddLocationInForm.addEventListener('click', () => this.addLocationFormCard());
    }
    if (this.btnEditLocationsFromSection) {
      this.btnEditLocationsFromSection.addEventListener('click', () => {
        const ev = this.events.find(x => x.id === this.currentEventId);
        if (ev) this.openEventModal(ev);
      });
    }

    // Master Crew View Filters & Modal
    this.inputSearchMasterCrew.addEventListener('input', (e) => {
      this.masterCrewSearchQuery = e.target.value.trim().toLowerCase();
      this.renderMasterCrewList();
    });

    this.selectMasterRoleFilter.addEventListener('change', (e) => {
      this.masterCrewRoleFilter = e.target.value;
      this.renderMasterCrewList();
    });

    this.btnOpenAddMasterCrewModal.addEventListener('click', () => this.openMasterCrewModal());
    this.btnEmptyAddMasterCrew.addEventListener('click', () => this.openMasterCrewModal());
    this.btnCloseMasterCrewModal.addEventListener('click', () => this.closeMasterCrewModal());
    this.btnCancelMasterCrewModal.addEventListener('click', () => this.closeMasterCrewModal());
    this.formMasterCrew.addEventListener('submit', (e) => this.handleMasterCrewFormSubmit(e));

    // Detail Action Buttons
    this.btnEditCurrentEvent.addEventListener('click', () => {
      if (this.currentEventId) {
        const ev = this.events.find(x => x.id === this.currentEventId);
        if (ev) this.openEventModal(ev);
      }
    });

    if (this.btnDownloadPdfCurrentEvent) {
      this.btnDownloadPdfCurrentEvent.addEventListener('click', () => {
        if (this.currentEventId) {
          this.downloadEventAsPdf(this.currentEventId);
        }
      });
    }

    this.btnToggleArchiveCurrentEvent.addEventListener('click', () => {
      this.archiveCurrentEvent();
    });

    if (this.btnDeleteCurrentEvent) {
      this.btnDeleteCurrentEvent.addEventListener('click', () => {
        if (this.currentEventId) {
          this.deleteArchivedEvent(this.currentEventId);
        }
      });
    }

    // Crew: Select From Master
    this.btnOpenSelectFromMasterModal.addEventListener('click', () => this.openSelectMasterModal());
    this.btnChooseMasterFromEmpty.addEventListener('click', () => this.openSelectMasterModal());
    this.btnCloseSelectMasterModal.addEventListener('click', () => this.closeSelectMasterModal());
    this.btnCancelSelectMasterModal.addEventListener('click', () => this.closeSelectMasterModal());
    this.inputSearchInMasterModal.addEventListener('input', () => this.renderSelectMasterList());
    this.btnSelectAllInMasterModal.addEventListener('click', () => this.selectAllMasterModal(true));
    this.btnDeselectAllInMasterModal.addEventListener('click', () => this.selectAllMasterModal(false));
    this.btnConfirmAssignMasterCrew.addEventListener('click', () => this.confirmAssignMasterCrew());

    // Crew: Add Custom Crew
    this.btnOpenAddCrewModal.addEventListener('click', () => this.openCrewModal());
    this.btnCloseCrewModal.addEventListener('click', () => this.closeCrewModal());
    this.btnCancelCrewModal.addEventListener('click', () => this.closeCrewModal());
    this.formCrew.addEventListener('submit', (e) => this.handleCrewFormSubmit(e));

    // Bulk WhatsApp Modal
    this.btnOpenBulkShareModal.addEventListener('click', () => this.openBulkShareModal());
    this.btnCloseBulkShareModal.addEventListener('click', () => this.closeBulkShareModal());
    this.btnCancelBulkShareModal.addEventListener('click', () => this.closeBulkShareModal());
    this.btnCopyAllCrewSummary.addEventListener('click', () => this.copyShareContent());
    this.btnStartAutoBlast.addEventListener('click', () => this.runAutoBlast());
    this.btnToggleGatewaySettings.addEventListener('click', () => {
      this.gatewaySettingsBox.classList.toggle('hidden');
    });
    this.btnSaveGatewayToken.addEventListener('click', () => {
      const token = this.inputWaGatewayToken.value.trim();
      localStorage.setItem('mahligai_wa_gateway_token', token);
      this.showToast(token ? 'Token WA Gateway berhasil disimpan!' : 'Token WA Gateway dihapus', 'success');
    });

    // Checklist
    this.formAddTask.addEventListener('submit', (e) => this.handleAddTask(e));
    this.btnApplyWOTemplate.addEventListener('click', () => this.applyWOTemplate());

    document.querySelectorAll('.cs-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.cs-filter-btn').forEach(b => b.classList.remove('active'));
        const target = e.currentTarget;
        target.classList.add('active');
        this.checklistFilter = target.dataset.filter;
        this.renderChecklistSection();
      });
    });

    // Share Textarea
    this.btnCopyShareText.addEventListener('click', () => this.copyShareContent());
    this.btnShareDirectWhatsApp.addEventListener('click', () => this.openDirectWhatsAppShare());
    if (this.selectShareRecipient) {
      this.selectShareRecipient.addEventListener('change', () => this.handleShareRecipientChange());
    }
    if (this.btnQuickOpenBulkModal) {
      this.btnQuickOpenBulkModal.addEventListener('click', () => this.openBulkShareModal());
    }

    // Click outside to close any modal backdrop on mobile & desktop
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          backdrop.classList.remove('active');
        }
      });
    });
  }

  // Switch View
  switchView(viewName) {
    this.currentView = viewName;

    this.navEventsBtn.classList.remove('active');
    this.navMasterCrewBtn.classList.remove('active');
    this.viewListEvents.classList.remove('active');
    this.viewMasterCrew.classList.remove('active');
    this.viewDetailEvent.classList.remove('active');

    if (viewName === 'events') {
      this.currentEventId = null;
      this.navEventsBtn.classList.add('active');
      this.viewListEvents.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.render();
    } else if (viewName === 'master-crew') {
      this.currentEventId = null;
      this.navMasterCrewBtn.classList.add('active');
      this.viewMasterCrew.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.renderMasterCrewList();
    }
  }

  switchToDetail(eventId) {
    this.currentView = 'detail';
    this.currentEventId = eventId;
    this.navEventsBtn.classList.remove('active');
    this.navMasterCrewBtn.classList.remove('active');
    this.viewListEvents.classList.remove('active');
    this.viewMasterCrew.classList.remove('active');
    this.viewDetailEvent.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.renderDetailView();
  }

  // Calculate H-n Countdown
  calculateCountdown(dateString) {
    if (!dateString) return { diffDays: 0, badgeText: '-', badgeClass: 'past', isPast: false, isH3: false };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const eventDate = new Date(dateString + 'T00:00:00');
    const diffMs = eventDate.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      const isH3 = diffDays <= 3;
      let badgeClass = 'upcoming';
      if (diffDays <= 3) badgeClass = 'urgent';
      return {
        diffDays,
        badgeText: `H-${diffDays} Hari`,
        badgeClass,
        isPast: false,
        isH3
      };
    } else if (diffDays === 0) {
      return {
        diffDays: 0,
        badgeText: 'HARI H (Hari Ini!)',
        badgeClass: 'today',
        isPast: false,
        isH3: true
      };
    } else {
      const pastDays = Math.abs(diffDays);
      return {
        diffDays,
        badgeText: `Lewat ${pastDays} Hari (Selesai)`,
        badgeClass: 'past',
        isPast: true,
        isH3: false
      };
    }
  }

  formatDateIndonesian(dateString) {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString + 'T00:00:00');
      return date.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  }

  // Clean phone number for Indonesian WhatsApp: 08xxx -> 628xxx or 8xxx -> 628xxx
  formatWhatsAppPhone(phone) {
    if (!phone) return '';
    let clean = phone.replace(/[^0-9+]/g, '');
    if (clean.startsWith('+')) {
      clean = clean.substring(1);
    }
    if (clean.startsWith('0')) {
      clean = '62' + clean.substring(1);
    } else if (clean.startsWith('8')) {
      clean = '62' + clean;
    }
    return clean;
  }

  // Check H-3 Notifications
  checkH3Notifications() {
    const h3Events = this.events.filter(ev => {
      if (ev.isArchived) return false;
      const cd = this.calculateCountdown(ev.date);
      return !cd.isPast && cd.diffDays >= 0 && cd.diffDays <= 3;
    });

    const count = h3Events.length;
    this.metricH3Count.textContent = count;
    this.countH3.textContent = count;

    if (count > 0) {
      this.headerNotificationCount.textContent = count;
      this.headerNotificationCount.classList.remove('hidden');

      if (this.h3BannerTitle) {
        this.h3BannerTitle.textContent = `⚡ PERINGATAN H-3: Ada ${count} Acara Pernikahan Mendesak!`;
      }
      const names = h3Events.map(e => `${e.coupleName} (${this.calculateCountdown(e.date).badgeText})`).join(', ');
      if (this.h3BannerDesc) {
        this.h3BannerDesc.textContent = `Acara: ${names}. Segera konfirmasi kesiapan seluruh kru bertugas (supir gaun, perias, fotografer) dan kirimkan rekap lokasi maps!`;
      }

      if (this.h3UrgentBanner) {
        if (!this.h3BannerDismissed) {
          this.h3UrgentBanner.classList.remove('hidden');
          this.h3UrgentBanner.style.removeProperty('display');
        } else {
          this.h3UrgentBanner.classList.add('hidden');
          this.h3UrgentBanner.style.display = 'none';
        }
      }

      // Populate notification dropdown
      this.notificationDropdownList.innerHTML = '';
      h3Events.forEach(ev => {
        const cd = this.calculateCountdown(ev.date);
        const item = document.createElement('div');
        item.className = 'notif-item';
        item.innerHTML = `
          <div class="notif-item-top">
            <span class="notif-item-name">${this.escapeHtml(ev.coupleName)}</span>
            <span class="notif-item-badge ${cd.diffDays <= 1 ? 'urgent' : ''}">${cd.badgeText}</span>
          </div>
          <div class="notif-item-desc">${this.formatDateIndonesian(ev.date)} • ${this.escapeHtml(ev.venueName || 'Lokasi')}</div>
        `;
        item.addEventListener('click', () => {
          this.notificationDropdown.classList.add('hidden');
          this.switchToDetail(ev.id);
        });
        this.notificationDropdownList.appendChild(item);
      });
    } else {
      this.headerNotificationCount.classList.add('hidden');
      if (this.h3UrgentBanner) {
        this.h3UrgentBanner.classList.add('hidden');
        this.h3UrgentBanner.style.display = 'none';
      }
      this.notificationDropdownList.innerHTML = `<div style="padding:16px; font-size:0.8rem; color:#64748B; text-align:center;">Tidak ada acara dalam batas H-3 saat ini.</div>`;
    }
  }

  // Native Web Notification Support
  requestWebNotification() {
    if (!('Notification' in window)) {
      this.showToast('Browser ini tidak mendukung desktop notification', 'warning');
      return;
    }

    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        this.showToast('Notifikasi desktop aktif! Anda akan diingatkan saat ada job H-3.', 'success');
        const h3Events = this.events.filter(e => !e.isArchived && this.calculateCountdown(e.date).isH3);
        if (h3Events.length > 0) {
          new Notification('Mahligai WO — Peringatan H-3 Acara!', {
            body: `Ada ${h3Events.length} acara pernikahan dalam waktu ≤ 3 hari. Segera konfirmasi kru bertugas!`,
            icon: 'favicon.ico'
          });
        }
      } else {
        this.showToast('Izin notifikasi ditolak oleh peramban.', 'warning');
      }
    });
  }

  // Render Dashboard
  render() {
    this.checkH3Notifications();

    const upcomingEvents = this.events.filter(e => !e.isArchived && !this.calculateCountdown(e.date).isPast);
    const archivedEvents = this.events.filter(e => e.isArchived || this.calculateCountdown(e.date).isPast);

    this.metricUpcoming.textContent = upcomingEvents.length;

    // Closest Event
    const sorted = [...upcomingEvents].sort((a, b) => new Date(a.date) - new Date(b.date));
    if (sorted.length > 0) {
      const closest = sorted[0];
      const cd = this.calculateCountdown(closest.date);
      this.metricClosestEvent.textContent = `${closest.coupleName} (${cd.badgeText})`;
    } else {
      this.metricClosestEvent.textContent = 'Tidak ada acara dekat';
    }

    // Checklist Progress
    let allTasks = 0;
    let completedTasks = 0;
    this.events.forEach(e => {
      if (e.checklist && e.checklist.length > 0) {
        allTasks += e.checklist.length;
        completedTasks += e.checklist.filter(t => t.completed).length;
      }
    });
    const avgPct = allTasks > 0 ? Math.round((completedTasks / allTasks) * 100) : 0;
    this.metricAvgProgress.textContent = `${avgPct}%`;
    this.metricCompletedTasks.textContent = `${completedTasks} dari ${allTasks} tugas selesai`;

    // Master Crew Total
    this.metricMasterCrewTotal.textContent = this.masterCrew.length;
    this.navMasterCrewCount.textContent = this.masterCrew.length;

    // Tab counts
    this.countUpcoming.textContent = upcomingEvents.length;
    this.countArchived.textContent = archivedEvents.length;
    this.countAll.textContent = this.events.length;

    // Archive Action Banner display
    if (this.archiveActionBanner) {
      if (this.currentFilter === 'archived' && archivedEvents.length > 0) {
        this.archiveActionBanner.classList.remove('hidden');
      } else {
        this.archiveActionBanner.classList.add('hidden');
      }
    }

    this.renderEventList();
  }

  // Render Event Cards
  renderEventList() {
    this.eventsGridContainer.innerHTML = '';

    let filtered = this.events.filter(ev => {
      const cd = this.calculateCountdown(ev.date);
      const isPastOrArchived = ev.isArchived || cd.isPast;

      if (this.currentFilter === 'upcoming') {
        return !isPastOrArchived;
      } else if (this.currentFilter === 'h3') {
        return !ev.isArchived && !cd.isPast && cd.diffDays <= 3;
      } else if (this.currentFilter === 'archived') {
        return isPastOrArchived;
      }
      return true; // 'all'
    });

    if (this.searchQuery) {
      filtered = filtered.filter(ev => {
        const nameMatch = (ev.coupleName || '').toLowerCase().includes(this.searchQuery);
        const venueMatch = (ev.venueName || '').toLowerCase().includes(this.searchQuery);
        const addressMatch = (ev.venueAddress || '').toLowerCase().includes(this.searchQuery);
        return nameMatch || venueMatch || addressMatch;
      });
    }

    // Archive Action Banner display (responds immediately to tab switches & filters)
    if (this.archiveActionBanner) {
      if (this.currentFilter === 'archived' && filtered.length > 0) {
        this.archiveActionBanner.classList.remove('hidden');
      } else {
        this.archiveActionBanner.classList.add('hidden');
      }
    }

    filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (filtered.length === 0) {
      this.eventsEmptyState.classList.remove('hidden');
      return;
    } else {
      this.eventsEmptyState.classList.add('hidden');
    }

    filtered.forEach(ev => {
      const cd = this.calculateCountdown(ev.date);
      const isPastOrArchived = ev.isArchived || cd.isPast;
      const formattedDate = this.formatDateIndonesian(ev.date);
      const locs = this.getEventLocations(ev);

      const tasks = ev.checklist || [];
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.completed).length;
      const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      const crewCount = ev.crew ? ev.crew.length : 0;

      const card = document.createElement('div');
      card.className = `event-card ${ev.isArchived ? 'archived' : ''}`;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');

      card.innerHTML = `
        <div class="event-card-header">
          <span class="event-countdown-pill ${cd.badgeClass}">
            ${cd.badgeText}
          </span>
          <div class="event-card-actions" onclick="event.stopPropagation();">
            <button type="button" class="card-quick-btn" title="Unduh Dokumen PDF Resmi Acara" data-action="download-pdf" data-id="${ev.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            </button>
            <button type="button" class="card-quick-btn" title="Edit Data Acara" data-action="edit" data-id="${ev.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </button>
            ${isPastOrArchived ? `
            <button type="button" class="card-quick-btn danger" title="Hapus Permanen dari Arsip" data-action="delete-archive" data-id="${ev.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>` : `
            <button type="button" class="card-quick-btn" title="Pindahkan ke Arsip" data-action="archive" data-id="${ev.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="21 8 21 21 3 21 3 8"></polyline>
                <rect x="1" y="3" width="22" height="5"></rect>
                <line x1="10" y1="12" x2="14" y2="12"></line>
              </svg>
            </button>`}
          </div>
        </div>

        <h3 class="event-couple-title">${this.escapeHtml(ev.coupleName)}</h3>

        <div class="event-meta-rows">
          <div class="meta-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span>${formattedDate}</span>
          </div>

          ${locs.map((l, i) => {
        const badgeTitle = this.formatLocationBadgeTitle(l.label, i + 1);
        const venueDisplay = (l.venueName || '').trim();
        const timeDisplay = (l.time || '').trim();
        return `
              <div class="meta-row">
                <span style="font-size:0.75rem; font-weight:800; color:var(--gold-dark); background:var(--gold-100); padding:2px 7px; border-radius:4px; border:1px solid var(--gold-200);">${this.escapeHtml(badgeTitle)}</span>
                ${venueDisplay ? `<span style="font-weight:700; color:var(--ink-primary); font-size:0.84rem;">${this.escapeHtml(venueDisplay)}</span>` : ''}
                <span style="font-size:0.78rem; color:var(--ink-muted);">(${this.escapeHtml(timeDisplay || 'Waktu belum diatur')})</span>
              </div>
            `;
      }).join('')}
        </div>

        <div class="event-progress-wrap">
          <div class="progress-header-row">
            <span class="progress-label">Progres Checklist</span>
            <span class="progress-pct">${completedTasks}/${totalTasks} (${pct}%)</span>
          </div>
          <div class="progress-track">
            <div class="progress-bar-fill ${pct === 100 ? 'complete' : ''}" style="width: ${pct}%"></div>
          </div>
        </div>

        <div class="event-card-footer">
          <span class="crew-count-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            ${crewCount} Kru Ditugaskan
          </span>
          <span class="btn btn-ghost btn-sm" style="padding: 4px 8px; font-size: 0.8rem;">
            Buka Detail →
          </span>
        </div>
      `;

      card.addEventListener('click', () => {
        this.switchToDetail(ev.id);
      });

      const pdfBtn = card.querySelector('[data-action="download-pdf"]');
      if (pdfBtn) {
        pdfBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.downloadEventAsPdf(ev.id);
        });
      }

      const editBtn = card.querySelector('[data-action="edit"]');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openEventModal(ev);
        });
      }

      const archiveBtn = card.querySelector('[data-action="archive"]');
      if (archiveBtn) {
        archiveBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.archiveEvent(ev.id);
        });
      }

      const deleteArchiveBtn = card.querySelector('[data-action="delete-archive"]');
      if (deleteArchiveBtn) {
        deleteArchiveBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteArchivedEvent(ev.id);
        });
      }

      this.eventsGridContainer.appendChild(card);
    });
  }

  // ==================== MASTER CREW DIRECTORY ====================
  renderMasterCrewList() {
    this.masterCrewGridContainer.innerHTML = '';
    this.navMasterCrewCount.textContent = this.masterCrew.length;

    let filtered = this.masterCrew;

    if (this.masterCrewRoleFilter !== 'ALL') {
      filtered = filtered.filter(c => c.role === this.masterCrewRoleFilter);
    }

    if (this.masterCrewSearchQuery) {
      filtered = filtered.filter(c => {
        const nameMatch = (c.name || '').toLowerCase().includes(this.masterCrewSearchQuery);
        const roleMatch = (c.role || '').toLowerCase().includes(this.masterCrewSearchQuery);
        const phoneMatch = (c.phone || '').includes(this.masterCrewSearchQuery);
        return nameMatch || roleMatch || phoneMatch;
      });
    }

    if (filtered.length === 0) {
      this.masterCrewEmptyState.classList.remove('hidden');
      return;
    } else {
      this.masterCrewEmptyState.classList.add('hidden');
    }

    filtered.forEach(crew => {
      const card = document.createElement('div');
      card.className = 'master-crew-card';

      const initials = (crew.name || 'K')
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

      const cleanPhone = crew.phone || '-';

      card.innerHTML = `
        <div class="mc-left">
          <div class="mc-avatar">${initials}</div>
          <div class="mc-info">
            <h4 class="mc-name">${this.escapeHtml(crew.name)}</h4>
            <span class="role-tag">${this.escapeHtml(crew.role)}</span>
            <div class="mc-contact">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              <span>${this.escapeHtml(cleanPhone)}</span>
            </div>
            ${crew.notes ? `<div style="font-size:0.75rem; color:#64748B; margin-top:4px; font-style:italic;">"${this.escapeHtml(crew.notes)}"</div>` : ''}
          </div>
        </div>

        <div class="mc-actions">
          <button type="button" class="card-quick-btn" title="Edit Master Kru" data-edit-master-id="${crew.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </button>
          <button type="button" class="card-quick-btn" title="Hapus dari Master" data-del-master-id="${crew.id}" style="color:#DC2626;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      `;

      card.querySelector(`[data-edit-master-id="${crew.id}"]`).addEventListener('click', () => {
        this.openMasterCrewModal(crew);
      });

      card.querySelector(`[data-del-master-id="${crew.id}"]`).addEventListener('click', () => {
        if (confirm(`Hapus "${crew.name}" dari Database Master Kru?`)) {
          this.masterCrew = this.masterCrew.filter(c => c.id !== crew.id);
          this.saveMasterCrew();
          this.renderMasterCrewList();
          this.showToast('Kru berhasil dihapus dari Master', 'info');
        }
      });

      this.masterCrewGridContainer.appendChild(card);
    });
  }

  // Master Crew Modal CRUD
  openMasterCrewModal(existingCrew = null) {
    this.masterCrewValidationAlert.classList.add('hidden');
    if (existingCrew) {
      this.modalMasterCrewTitle.textContent = 'Edit Anggota Master Kru';
      this.inputMasterCrewId.value = existingCrew.id;
      this.inputMasterCrewName.value = existingCrew.name || '';
      this.selectMasterCrewRole.value = existingCrew.role || 'Admin WO & Koordinator';
      this.inputMasterCrewPhone.value = existingCrew.phone || '';
      this.inputMasterCrewEmail.value = existingCrew.email || '';
      this.inputMasterCrewNotes.value = existingCrew.notes || '';
    } else {
      this.modalMasterCrewTitle.textContent = 'Tambah Anggota Master Kru Baru';
      this.inputMasterCrewId.value = '';
      this.formMasterCrew.reset();
    }
    this.modalMasterCrewBackdrop.classList.add('active');
    setTimeout(() => this.inputMasterCrewName.focus(), 100);
  }

  closeMasterCrewModal() {
    this.modalMasterCrewBackdrop.classList.remove('active');
  }

  handleMasterCrewFormSubmit(e) {
    e.preventDefault();
    const id = this.inputMasterCrewId.value.trim();
    const name = this.inputMasterCrewName.value.trim();
    const role = this.selectMasterCrewRole.value;
    const phone = this.inputMasterCrewPhone.value.trim();
    const email = this.inputMasterCrewEmail.value.trim();
    const notes = this.inputMasterCrewNotes.value.trim();

    if (!name) {
      this.masterCrewValidationAlert.textContent = 'Nama anggota kru wajib diisi!';
      this.masterCrewValidationAlert.classList.remove('hidden');
      this.inputMasterCrewName.focus();
      return;
    }

    if (id) {
      const idx = this.masterCrew.findIndex(c => c.id === id);
      if (idx !== -1) {
        this.masterCrew[idx] = { id, name, role, phone, email, notes };
      }
      this.showToast('Data master kru berhasil diperbarui!', 'success');
    } else {
      const newCrew = {
        id: 'mc-' + Date.now(),
        name,
        role,
        phone,
        email,
        notes
      };
      this.masterCrew.push(newCrew);
      this.showToast(`Anggota master kru "${name}" berhasil ditambahkan!`, 'success');
    }

    this.saveMasterCrew();
    this.closeMasterCrewModal();
    this.renderMasterCrewList();
  }

  // ==================== FAST CREW PICKER MODAL (PILIH DARI MASTER) ====================
  openSelectMasterModal() {
    const ev = this.events.find(x => x.id === this.currentEventId);
    if (!ev) return;

    // Pre-check currently assigned crew in this event
    this.selectedMasterCrewIds.clear();
    const currentAssignedNames = new Set((ev.crew || []).map(c => c.name.toLowerCase()));

    this.masterCrew.forEach(c => {
      if (currentAssignedNames.has(c.name.toLowerCase())) {
        this.selectedMasterCrewIds.add(c.id);
      }
    });

    this.inputSearchInMasterModal.value = '';
    this.renderSelectMasterList();
    this.modalSelectMasterCrewBackdrop.classList.add('active');
  }

  closeSelectMasterModal() {
    this.modalSelectMasterCrewBackdrop.classList.remove('active');
  }

  renderSelectMasterList() {
    this.masterCrewSelectList.innerHTML = '';
    const query = this.inputSearchInMasterModal.value.trim().toLowerCase();

    let list = this.masterCrew;
    if (query) {
      list = list.filter(c => c.name.toLowerCase().includes(query) || c.role.toLowerCase().includes(query));
    }

    this.labelSelectedMasterCount.textContent = `${this.selectedMasterCrewIds.size} kru terpilih`;

    list.forEach(c => {
      const isSelected = this.selectedMasterCrewIds.has(c.id);
      const row = document.createElement('div');
      row.className = `select-crew-row ${isSelected ? 'selected' : ''}`;

      const initials = (c.name || 'K').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

      row.innerHTML = `
        <div class="select-crew-row-left">
          <input type="checkbox" class="select-crew-checkbox" ${isSelected ? 'checked' : ''} data-crew-id="${c.id}">
          <div class="mc-avatar" style="width:36px; height:36px; font-size:0.8rem;">${initials}</div>
          <div>
            <div style="font-weight:700; font-size:0.9rem; color:var(--ink-primary);">${this.escapeHtml(c.name)}</div>
            <div style="font-size:0.75rem; color:var(--ink-muted);">${this.escapeHtml(c.role)} • ${this.escapeHtml(c.phone || 'Tanpa HP')}</div>
          </div>
        </div>
        <span class="role-tag" style="margin:0;">${this.escapeHtml(c.role)}</span>
      `;

      row.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          const chk = row.querySelector('.select-crew-checkbox');
          chk.checked = !chk.checked;
          if (chk.checked) {
            this.selectedMasterCrewIds.add(c.id);
            row.classList.add('selected');
          } else {
            this.selectedMasterCrewIds.delete(c.id);
            row.classList.remove('selected');
          }
          this.labelSelectedMasterCount.textContent = `${this.selectedMasterCrewIds.size} kru terpilih`;
        }
      });

      const chk = row.querySelector('.select-crew-checkbox');
      chk.addEventListener('change', () => {
        if (chk.checked) {
          this.selectedMasterCrewIds.add(c.id);
          row.classList.add('selected');
        } else {
          this.selectedMasterCrewIds.delete(c.id);
          row.classList.remove('selected');
        }
        this.labelSelectedMasterCount.textContent = `${this.selectedMasterCrewIds.size} kru terpilih`;
      });

      this.masterCrewSelectList.appendChild(row);
    });
  }

  selectAllMasterModal(selectAll) {
    if (selectAll) {
      this.masterCrew.forEach(c => this.selectedMasterCrewIds.add(c.id));
    } else {
      this.selectedMasterCrewIds.clear();
    }
    this.renderSelectMasterList();
  }

  confirmAssignMasterCrew() {
    const ev = this.events.find(x => x.id === this.currentEventId);
    if (!ev) return;

    if (!ev.crew) ev.crew = [];

    // Map selected IDs to crew objects
    const newlyAssigned = [];
    this.selectedMasterCrewIds.forEach(id => {
      const master = this.masterCrew.find(c => c.id === id);
      if (master) {
        newlyAssigned.push({
          id: 'crew-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          name: master.name,
          role: master.role,
          phone: master.phone,
          email: master.email,
          notes: master.notes
        });
      }
    });

    ev.crew = newlyAssigned;
    this.saveEvents();
    this.closeSelectMasterModal();
    this.renderDetailView();
    this.showToast(`${newlyAssigned.length} kru dari Master berhasil ditugaskan ke acara ini!`, 'success');
  }

  // ==================== EVENT DETAIL & PERSONAL WA BRIEFING ====================
  renderDetailView() {
    const ev = this.events.find(x => x.id === this.currentEventId);
    if (!ev) {
      this.switchView('events');
      return;
    }

    const cd = this.calculateCountdown(ev.date);
    const formattedDate = this.formatDateIndonesian(ev.date);

    this.detailCoupleName.textContent = ev.coupleName;
    this.detailEventDate.textContent = formattedDate;
    const locs = this.getEventLocations(ev);
    const locSummary = locs.map((l, i) => {
      const title = this.formatLocationBadgeTitle(l.label, i + 1);
      const time = l.time ? l.time.trim() : 'Waktu belum diatur';
      return `${this.escapeHtml(title)}: <strong>${this.escapeHtml(time)}</strong>`;
    }).join(' | ');

    if (this.detailLocationsHeaderSummary) {
      this.detailLocationsHeaderSummary.innerHTML = locSummary || 'Waktu belum diatur';
    }
    if (this.detailAkadTime) this.detailAkadTime.textContent = ev.akadTime || 'Belum diatur';
    if (this.detailResepsiTime) this.detailResepsiTime.textContent = ev.resepsiTime || 'Belum diatur';

    this.detailCountdownBadge.textContent = cd.badgeText;
    this.detailCountdownBadge.className = `countdown-badge large ${cd.badgeClass}`;

    if (ev.isArchived || cd.isPast) {
      this.detailStatusPill.textContent = ev.isArchived ? 'Diarsipkan' : 'Selesai / Sudah Lewat';
      this.detailStatusPill.style.backgroundColor = ev.isArchived ? '#E2E8F0' : '#FEE2E2';
      this.detailStatusPill.style.color = ev.isArchived ? '#475569' : '#B91C1C';
      if (this.btnToggleArchiveCurrentEvent) this.btnToggleArchiveCurrentEvent.classList.add('hidden');
      if (this.btnDeleteCurrentEvent) this.btnDeleteCurrentEvent.classList.remove('hidden');
    } else {
      this.detailStatusPill.textContent = cd.isH3 ? '⚡ Mendekati H-3 (Siaga)' : 'Acara Aktif';
      this.detailStatusPill.style.backgroundColor = cd.isH3 ? '#FEF3C7' : '#ECFDF5';
      this.detailStatusPill.style.color = cd.isH3 ? '#92400E' : '#047857';
      if (this.btnToggleArchiveCurrentEvent) {
        this.btnToggleArchiveCurrentEvent.classList.remove('hidden');
        this.labelToggleArchive.textContent = 'Arsipkan Acara';
      }
      if (this.btnDeleteCurrentEvent) this.btnDeleteCurrentEvent.classList.add('hidden');
    }

    const tasks = ev.checklist || [];
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.completed).length;
    const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    this.detailProgressPercent.textContent = `${pct}%`;
    this.detailProgressBar.style.width = `${pct}%`;
    if (pct === 100) {
      this.detailProgressBar.classList.add('complete');
    } else {
      this.detailProgressBar.classList.remove('complete');
    }
    this.detailProgressRatio.textContent = `${completedTasks} dari ${totalTasks} tugas selesai`;

    this.renderLocationSection(ev);
    this.renderCrewSection(ev);
    this.renderChecklistSection();
    this.generateShareSummary(ev);
  }

  renderLocationSection(ev) {
    if (!this.detailLocationsList) return;
    this.detailLocationsList.innerHTML = '';
    const locations = this.getEventLocations(ev);

    locations.forEach((loc, idx) => {
      const num = idx + 1;
      const venueName = loc.venueName ? loc.venueName.trim() : '';
      const venueAddress = loc.venueAddress ? loc.venueAddress.trim() : '';
      const mapsUrl = loc.mapsUrl ? loc.mapsUrl.trim() : '';
      const timeStr = loc.time ? loc.time.trim() : 'Waktu belum diatur';

      const rawLabel = (loc.label || '').trim();
      const badgeTitle = this.formatLocationBadgeTitle(rawLabel, num);

      const mapQueryParts = [];
      if (venueName) mapQueryParts.push(venueName);
      if (venueAddress) mapQueryParts.push(venueAddress);
      const mapQueryString = mapQueryParts.join(', ') || 'Jakarta';
      const encodedQuery = encodeURIComponent(mapQueryString);

      const isHttp = mapsUrl && /^https?:\/\//i.test(mapsUrl.trim());
      const openMapsUrl = isHttp ? mapsUrl.trim() : `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
      const directionsUrl = isHttp
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsUrl.trim())}`
        : `https://www.google.com/maps/dir/?api=1&destination=${encodedQuery}`;

      const card = document.createElement('div');
      card.className = 'location-item-card';

      card.innerHTML = `
        <!-- DI ATAS: LOKASI BERAPA (BESAR & JELAS) -->
        <div class="location-header-bar">
          <div class="location-badge-huge">
            <span>📍 ${this.escapeHtml(badgeTitle)}</span>
          </div>
        </div>

        <!-- BAWAHNYA: WAKTU ACARA (BESAR & TEBAL) -->
        <div class="location-time-box">
          <span style="font-size:1.35rem;">⏰</span>
          <div>
            <div class="time-label">WAKTU ACARA:</div>
            <div class="time-value">${this.escapeHtml(timeStr)}</div>
          </div>
        </div>

        <!-- BAWAHNYA: NAMA TEMPAT & ALAMAT -->
        <div class="location-venue-box">
          <div class="location-venue-name">
            <span>🏢</span>
            <span>${this.escapeHtml(venueName || 'Nama gedung / tempat belum diatur')}</span>
          </div>
          <div class="location-venue-address">
            <span>📌</span>
            <span>${this.escapeHtml(venueAddress || 'Alamat lengkap tempat belum diatur.')}</span>
          </div>
        </div>

        <!-- KONDISIONAL: KETERANGAN / CATATAN KHUSUS (JIKA DIISI) -->
        ${loc.notes ? `
          <div class="location-notes-box">
            <div class="notes-header">
              <span>📝 KETERANGAN (KONDISIONAL):</span>
            </div>
            <div class="notes-content">${this.escapeHtml(loc.notes)}</div>
          </div>
        ` : ''}

        <!-- QUICK EDIT LINK GOOGLE MAPS UNTUK LOKASI INI -->
        <div class="quick-maps-input-box">
          <label style="font-size:0.75rem; font-weight:700; color:var(--ink-secondary); display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>Link Google Maps Lokasi (dari WA Pengantin):</span>
            <span style="font-size:0.7rem; color:var(--gold-dark);">${mapsUrl ? '✅ Link Akurat Terpasang' : '🔍 Auto Search (Bisa Tempel Link WA)'}</span>
          </label>
          <div class="quick-maps-row">
            <input type="text" id="inline_loc_maps_${loc.id}" class="form-control form-control-sm" value="${this.escapeHtml(mapsUrl)}" placeholder="Tempel link maps WA untuk lokasi ini..." autocomplete="off">
            <button type="button" class="btn btn-primary btn-sm btn-save-loc-maps" data-loc-id="${loc.id}">Simpan Link</button>
          </div>
        </div>

        <!-- TOMBOL NAVIGASI & SALIN LINK MAPS LOKASI INI -->
        <div class="maps-action-buttons">
          <a href="${openMapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-maps btn-sm">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon>
              <line x1="9" y1="3" x2="9" y2="18"></line>
              <line x1="15" y1="6" x2="15" y2="21"></line>
            </svg>
            <span>Buka Maps</span>
          </a>

          <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-directions btn-sm">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
            </svg>
            <span>Petunjuk Arah GPS</span>
          </a>

          <button type="button" class="btn btn-secondary btn-sm btn-copy-loc-maps" data-maps-url="${openMapsUrl}" title="Salin link Google Maps lokasi ini">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Salin Link</span>
          </button>
        </div>
      `;

      // Save inline maps listener
      const saveBtn = card.querySelector('.btn-save-loc-maps');
      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          const input = card.querySelector(`#inline_loc_maps_${loc.id}`);
          const newUrl = input ? input.value.trim() : '';

          if (!ev.locations) ev.locations = this.getEventLocations(ev);
          const targetLoc = ev.locations.find(l => l.id === loc.id);
          if (targetLoc) {
            targetLoc.mapsUrl = newUrl;
          }
          if (idx === 0) ev.customMapsUrl = newUrl;

          this.saveEvents();
          this.renderDetailView();
          this.showToast(newUrl ? `Link Google Maps untuk Lokasi ${num} berhasil disimpan!` : `Link maps Lokasi ${num} dihapus`, 'success');
        });
      }

      // Copy maps link listener
      const copyBtn = card.querySelector('.btn-copy-loc-maps');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          this.copyToClipboard(openMapsUrl, `Tautan Google Maps Lokasi ${num} berhasil disalin!`);
        });
      }

      this.detailLocationsList.appendChild(card);
    });
  }

  // Build Personalized WhatsApp Message for a specific crew member
  buildPersonalCrewWAMessage(crew, ev) {
    const formattedDate = this.formatDateIndonesian(ev.date);
    const locations = this.getEventLocations(ev);

    let locationHeaderTitle = '';
    if (locations.length === 1) {
      const rawLabel = (locations[0].label || '').trim();
      locationHeaderTitle = this.formatLocationBadgeTitle(rawLabel, 1);
    } else if (locations.length > 1) {
      locationHeaderTitle = locations.map((loc, idx) => {
        const rawLabel = (loc.label || '').trim();
        return this.formatLocationBadgeTitle(rawLabel, idx + 1);
      }).join(' & ');
    }

    let locationDetails = '';
    if (locations.length === 1) {
      const loc = locations[0];
      const venueName = loc.venueName ? loc.venueName.trim() : '-';
      const venueAddress = loc.venueAddress ? loc.venueAddress.trim() : '-';
      const timeStr = loc.time ? loc.time.trim() : '-';
      const mapsUrl = loc.mapsUrl ? loc.mapsUrl.trim() : '';

      const mapQueryParts = [];
      if (loc.venueName) mapQueryParts.push(loc.venueName.trim());
      if (loc.venueAddress) mapQueryParts.push(loc.venueAddress.trim());
      const query = mapQueryParts.join(', ') || 'Jakarta';

      const openMapsUrl = mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
      const directionsUrl = mapsUrl
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsUrl)}`
        : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;

      locationDetails = `*⏰ WAKTU: ${timeStr}*
*🏢 TEMPAT/KEDIAMAN: ${venueName}*
*📌 ALAMAT: ${venueAddress}*${loc.notes ? `\n*📝 KETERANGAN: ${loc.notes.trim()}*` : ''}
*🗺️ GOOGLE MAPS:* ${openMapsUrl}
*🚗 PETUNJUK ARAH GPS:* ${directionsUrl}`;
    } else {
      locationDetails = locations.map((loc, idx) => {
        const num = idx + 1;
        const rawLabel = (loc.label || '').trim();
        const locTitle = this.formatLocationBadgeTitle(rawLabel, num);
        const venueName = loc.venueName ? loc.venueName.trim() : '-';
        const venueAddress = loc.venueAddress ? loc.venueAddress.trim() : '-';
        const timeStr = loc.time ? loc.time.trim() : '-';
        const mapsUrl = loc.mapsUrl ? loc.mapsUrl.trim() : '';

        const mapQueryParts = [];
        if (loc.venueName) mapQueryParts.push(loc.venueName.trim());
        if (loc.venueAddress) mapQueryParts.push(loc.venueAddress.trim());
        const query = mapQueryParts.join(', ') || 'Jakarta';

        const openMapsUrl = mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
        const directionsUrl = mapsUrl
          ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsUrl)}`
          : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;

        return `----------------------------------------
*📍 ${locTitle}*
*⏰ WAKTU: ${timeStr}*
*🏢 TEMPAT/KEDIAMAN: ${venueName}*
*📌 ALAMAT: ${venueAddress}*${loc.notes ? `\n*📝 KETERANGAN: ${loc.notes.trim()}*` : ''}
*🗺️ GOOGLE MAPS:* ${openMapsUrl}
*🚗 PETUNJUK ARAH GPS:* ${directionsUrl}`;
      }).join('\n\n');
    }

    const primaryAdmin = this.getPrimaryAdmin();
    const cleanAdminPhone = this.formatWhatsAppPhone(primaryAdmin.phone);
    const adminContactLine = primaryAdmin.phone ? `\n\n----------------------------------------\n📞 NARAHUBUNG RESMI ADMIN WO:\nAdmin 1 (Utama): ${primaryAdmin.name} (${primaryAdmin.phone})\nChat WA Admin: https://wa.me/${cleanAdminPhone}\n(Jika ada kendala mendadak hubungi Admin 1)` : '';

    const topHeader = [
      `*💍 BRIEFING ACARA PERNIKAHAN 💍*`,
      locationHeaderTitle ? `*📍 ${locationHeaderTitle}*` : '',
      `*📅 Hari & Tanggal: ${formattedDate}*`
    ].filter(Boolean).join('\n');

    return `Halo Kak ${crew.name} 👋
Berikut surat tugas & jadwal briefing acara pernikahan klien kami:

${topHeader}

*✨ Pasangan: ${ev.coupleName}*
${locationDetails}

----------------------------------------
🎯 TUGAS ANDA:
👉 ${crew.role}
${crew.notes ? `Catatan Khusus: ${crew.notes}\n` : ''}
📌 PENTING:
Mohon hadir standby di lokasi paling lambat 2 jam sebelum acara dimulai. Pastikan seluruh perlengkapan telah siap.
Mohon balas pesan ini sebagai konfirmasi kehadiran. Terima kasih banyak! 🙏${adminContactLine}
— Tim ${this.brandConfig ? this.brandConfig.fullName : 'Mahligai Wedding Organizer'}`;
  }

  // Render Crew in Event Detail View
  renderCrewSection(ev) {
    const crewList = ev.crew || [];
    this.detailCrewList.innerHTML = '';

    if (crewList.length === 0) {
      this.crewEmptyState.classList.remove('hidden');
      return;
    } else {
      this.crewEmptyState.classList.add('hidden');
    }

    crewList.forEach(crew => {
      const row = document.createElement('div');
      row.className = 'crew-row';

      const waPhone = this.formatWhatsAppPhone(crew.phone);
      const personalMsg = this.buildPersonalCrewWAMessage(crew, ev);
      const waUrl = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(personalMsg)}` : '#';

      const cleanPhone = (crew.phone || '').replace(/[^0-9+]/g, '');

      const initials = (crew.name || 'K').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

      row.innerHTML = `
        <div class="crew-left">
          <div class="crew-avatar">${initials}</div>
          <div class="crew-details">
            <div class="crew-name" title="${this.escapeHtml(crew.name)}">${this.escapeHtml(crew.name)}</div>
            <span class="crew-role-badge">${this.escapeHtml(crew.role)}</span>
          </div>
        </div>

        <div class="crew-actions">
          <!-- Tombol Kirim Job WA Personal -->
          <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="contact-action-btn btn-wa" title="Kirim Job Rekap & Maps ke WA Kak ${this.escapeHtml(crew.name)}" ${!waPhone ? 'style="opacity:0.4; pointer-events:none;"' : ''}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.301-.15-1.78-.879-2.056-.98-.276-.1-.476-.15-.677.15-.2.301-.777.98-.953 1.18-.175.2-.351.226-.652.075-.301-.15-1.272-.469-2.423-1.496-.896-.799-1.501-1.786-1.677-2.087-.175-.301-.019-.464.132-.614.136-.135.301-.351.451-.527.151-.175.2-.301.301-.501.1-.2.05-.376-.025-.526-.075-.15-.677-1.632-.927-2.233-.244-.585-.492-.506-.677-.515-.175-.008-.376-.01-.577-.01-.2 0-.526.075-.802.376-.276.301-1.053 1.028-1.053 2.508 0 1.48 1.078 2.909 1.228 3.11.15.2 2.122 3.24 5.141 4.544.718.31 1.279.496 1.716.635.721.23 1.378.197 1.897.12.578-.087 1.78-.727 2.031-1.43.25-.702.25-1.304.175-1.43-.075-.125-.276-.2-.577-.35z"/>
              <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.17L2.05 21.95l4.908-1.332A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.2c-1.634 0-3.146-.46-4.433-1.258l-.317-.193-2.92.793.811-2.825-.213-.332A8.156 8.156 0 013.8 12c0-4.521 3.679-8.2 8.2-8.2s8.2 3.679 8.2 8.2-3.679 8.2-8.2 8.2z"/>
            </svg>
          </a>

          <!-- Telepon -->
          <a href="tel:${cleanPhone}" class="contact-action-btn btn-call" title="Hubungi Telepon: ${cleanPhone}" ${!cleanPhone ? 'style="opacity:0.4; pointer-events:none;"' : ''}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
          </a>

          <!-- Email -->
          <a href="mailto:${crew.email || ''}" class="contact-action-btn btn-mail" title="Email: ${crew.email || '-'}" ${!crew.email ? 'style="opacity:0.4; pointer-events:none;"' : ''}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
          </a>

          <!-- Hapus Kru dari Acara Ini -->
          <button type="button" class="contact-action-btn btn-delete" title="Lepaskan kru dari acara ini" data-crew-id="${crew.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      `;

      row.querySelector('.btn-delete').addEventListener('click', () => {
        if (confirm(`Hapus "${crew.name}" dari penugasan acara ini?`)) {
          ev.crew = ev.crew.filter(c => c.id !== crew.id);
          this.saveEvents();
          this.renderDetailView();
          this.showToast('Kru dilepas dari acara', 'info');
        }
      });

      this.detailCrewList.appendChild(row);
    });
  }

  // Custom Crew Modal (Event Specific)
  openCrewModal() {
    this.crewValidationAlert.classList.add('hidden');
    this.formCrew.reset();
    this.modalCrewBackdrop.classList.add('active');
    setTimeout(() => this.inputCrewName.focus(), 100);
  }

  closeCrewModal() {
    this.modalCrewBackdrop.classList.remove('active');
  }

  handleCrewFormSubmit(e) {
    e.preventDefault();
    const name = this.inputCrewName.value.trim();
    const role = this.selectCrewRole.value;
    const phone = this.inputCrewPhone.value.trim();
    const email = this.inputCrewEmail.value.trim();
    const saveToMaster = this.chkSaveToMasterAlso.checked;

    if (!name) {
      this.crewValidationAlert.textContent = 'Nama kru wajib diisi!';
      this.crewValidationAlert.classList.remove('hidden');
      this.inputCrewName.focus();
      return;
    }

    const ev = this.events.find(x => x.id === this.currentEventId);
    if (!ev) return;

    if (!ev.crew) ev.crew = [];
    ev.crew.push({
      id: 'crew-' + Date.now(),
      name,
      role,
      phone,
      email
    });

    // Auto-save to Master Crew Directory if checked
    if (saveToMaster) {
      const exists = this.masterCrew.some(c => c.name.toLowerCase() === name.toLowerCase());
      if (!exists) {
        this.masterCrew.push({
          id: 'mc-' + Date.now(),
          name,
          role,
          phone,
          email,
          notes: 'Ditambahkan dari acara ' + ev.coupleName
        });
        this.saveMasterCrew();
      }
    }

    this.saveEvents();
    this.closeCrewModal();
    this.renderDetailView();
    this.showToast(`Kru "${name}" berhasil ditugaskan ke acara!`, 'success');
  }

  // Bulk WhatsApp Dispatch Modal
  openBulkShareModal() {
    const ev = this.events.find(x => x.id === this.currentEventId);
    if (!ev || !ev.crew || ev.crew.length === 0) {
      this.showToast('Belum ada kru yang ditugaskan di acara ini. Tambahkan kru terlebih dahulu.', 'warning');
      return;
    }

    // Reset auto-blast progress
    this.autoBlastProgressContainer.classList.add('hidden');
    this.btnStartAutoBlast.disabled = false;
    this.autoBlastProgressBar.style.width = '0%';
    this.autoBlastPct.textContent = '0%';
    this.autoBlastStatusText.textContent = 'Siap mengirim...';

    // Populate stored gateway token
    this.inputWaGatewayToken.value = localStorage.getItem('mahligai_wa_gateway_token') || '';

    this.bulkShareCrewList.innerHTML = '';
    ev.crew.forEach(crew => {
      const waPhone = this.formatWhatsAppPhone(crew.phone);
      const personalMsg = this.buildPersonalCrewWAMessage(crew, ev);
      const waUrl = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(personalMsg)}` : '#';

      const item = document.createElement('div');
      item.className = 'bulk-crew-item';
      item.id = `bulk_item_${crew.id}`;

      const initials = (crew.name || 'K').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

      item.innerHTML = `
        <div class="bulk-crew-item-left">
          <div class="mc-avatar" style="width:38px; height:38px; font-size:0.85rem;">${initials}</div>
          <div>
            <div style="font-weight:700; font-size:0.9rem; color:var(--ink-primary);">${this.escapeHtml(crew.name)}</div>
            <div style="font-size:0.75rem; color:var(--ink-muted);">${this.escapeHtml(crew.role)} • ${this.escapeHtml(crew.phone || 'Nomor HP belum ada')}</div>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:8px;">
          <span class="crew-status-badge" id="crew_badge_${crew.id}" style="font-size:0.75rem; font-weight:600; color:var(--ink-muted);">
            ${waPhone ? 'Siap Kirim ⏱️' : 'Tanpa No WA ⚠️'}
          </span>
          <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp btn-sm" ${!waPhone ? 'style="opacity:0.4; pointer-events:none;"' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.17L2.05 21.95l4.908-1.332A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.2c-1.634 0-3.146-.46-4.433-1.258l-.317-.193-2.92.793.811-2.825-.213-.332A8.156 8.156 0 013.8 12c0-4.521 3.679-8.2 8.2-8.2s8.2 3.679 8.2 8.2-3.679 8.2-8.2 8.2z"/>
            </svg>
            <span>Kirim WA</span>
          </a>
        </div>
      `;

      this.bulkShareCrewList.appendChild(item);
    });

    this.modalBulkShareBackdrop.classList.add('active');
  }

  closeBulkShareModal() {
    this.modalBulkShareBackdrop.classList.remove('active');
  }

  // 1-Click Automated Batch Dispatcher to All Crew
  async runAutoBlast() {
    const ev = this.events.find(x => x.id === this.currentEventId);
    if (!ev || !ev.crew || ev.crew.length === 0) {
      this.showToast('Belum ada kru yang ditugaskan.', 'warning');
      return;
    }

    const crewWithPhone = ev.crew.filter(c => !!this.formatWhatsAppPhone(c.phone));
    if (crewWithPhone.length === 0) {
      this.showToast('Tidak ada nomor WhatsApp yang valid pada kru bertugas!', 'warning');
      return;
    }

    const token = (localStorage.getItem('mahligai_wa_gateway_token') || '').trim();

    this.autoBlastProgressContainer.classList.remove('hidden');
    this.btnStartAutoBlast.disabled = true;

    if (token) {
      // MODE A: 100% Background Silent Dispatch via WhatsApp Gateway API (e.g. Fonnte)
      this.autoBlastStatusText.textContent = `Menghubungkan ke WhatsApp Gateway API... (0/${crewWithPhone.length})`;
      let successCount = 0;

      for (let i = 0; i < crewWithPhone.length; i++) {
        const crew = crewWithPhone[i];
        const phone = this.formatWhatsAppPhone(crew.phone);
        const msg = this.buildPersonalCrewWAMessage(crew, ev);
        const pct = Math.round(((i + 1) / crewWithPhone.length) * 100);

        this.autoBlastStatusText.textContent = `Mengirim otomatis via API ke ${crew.name} (${crew.role})... (${i + 1}/${crewWithPhone.length})`;
        this.autoBlastPct.textContent = `${pct}%`;
        this.autoBlastProgressBar.style.width = `${pct}%`;

        const badge = document.getElementById(`crew_badge_${crew.id}`);
        if (badge) {
          badge.textContent = 'Mengirim... ⏳';
          badge.style.color = '#D97706';
        }

        try {
          const formData = new FormData();
          formData.append('target', phone);
          formData.append('message', msg);
          formData.append('countryCode', '62');

          const resp = await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: { 'Authorization': token },
            body: formData
          });

          const data = await resp.json();
          if (data && data.status) {
            successCount++;
            if (badge) {
              badge.textContent = 'Terkirim Otomatis ✅';
              badge.style.color = '#059669';
            }
          } else {
            if (badge) {
              badge.textContent = 'Gagal (Cek Token) ❌';
              badge.style.color = '#DC2626';
            }
          }
        } catch (err) {
          if (badge) {
            badge.textContent = 'Gagal Koneksi ❌';
            badge.style.color = '#DC2626';
          }
        }

        await new Promise(r => setTimeout(r, 600));
      }

      this.autoBlastStatusText.textContent = `Selesai! ${successCount} dari ${crewWithPhone.length} pesan terkirim otomatis di latar belakang.`;
      this.btnStartAutoBlast.disabled = false;
      this.showToast(`Batch WA selesai: ${successCount} kru berhasil dikirimi pesan!`, 'success');

    } else {
      // MODE B: Smart Sequential WhatsApp Opener (1-Klik antrean cepat tanpa perlu API token)
      this.autoBlastStatusText.textContent = `Memulai antrean pengiriman otomatis ke WhatsApp kru...`;

      for (let i = 0; i < crewWithPhone.length; i++) {
        const crew = crewWithPhone[i];
        const waPhone = this.formatWhatsAppPhone(crew.phone);
        const personalMsg = this.buildPersonalCrewWAMessage(crew, ev);
        const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(personalMsg)}`;
        const pct = Math.round(((i + 1) / crewWithPhone.length) * 100);

        this.autoBlastStatusText.textContent = `Membuka WhatsApp untuk ${crew.name} (${crew.role})... (${i + 1}/${crewWithPhone.length})`;
        this.autoBlastPct.textContent = `${pct}%`;
        this.autoBlastProgressBar.style.width = `${pct}%`;

        const badge = document.getElementById(`crew_badge_${crew.id}`);
        if (badge) {
          badge.textContent = 'Dibuka di WA ✅';
          badge.style.color = '#059669';
        }

        window.open(waUrl, '_blank');

        // Give a 1.2 second pause between openings so browser allows popups
        if (i < crewWithPhone.length - 1) {
          await new Promise(r => setTimeout(r, 1200));
        }
      }

      this.autoBlastStatusText.textContent = `Selesai! Seluruh ${crewWithPhone.length} pesan tugas kru telah disiapkan di WhatsApp.`;
      this.btnStartAutoBlast.disabled = false;
      this.showToast(`1-Klik selesai: ${crewWithPhone.length} chat kru telah dibuka di WhatsApp!`, 'success');
    }
  }

  // ==================== CHECKLIST LOGIC ====================
  renderChecklistSection() {
    const ev = this.events.find(x => x.id === this.currentEventId);
    if (!ev) return;

    const tasks = ev.checklist || [];
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    this.checklistRatioDisplay.textContent = `${completed} / ${total} Selesai`;
    this.checklistBadgeDisplay.textContent = `${pct}%`;

    let filtered = tasks;
    if (this.checklistFilter === 'pending') {
      filtered = tasks.filter(t => !t.completed);
    } else if (this.checklistFilter === 'completed') {
      filtered = tasks.filter(t => t.completed);
    }

    this.detailTasksList.innerHTML = '';
    if (filtered.length === 0) {
      this.tasksEmptyState.classList.remove('hidden');
    } else {
      this.tasksEmptyState.classList.add('hidden');
    }

    filtered.forEach(task => {
      const item = document.createElement('div');
      item.className = `task-item ${task.completed ? 'completed' : ''}`;

      item.innerHTML = `
        <div class="task-left">
          <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} data-task-id="${task.id}" id="chk_${task.id}">
          <label for="chk_${task.id}" class="task-text">${this.escapeHtml(task.title)}</label>
          ${task.category ? `<span class="task-category-pill">${this.escapeHtml(task.category)}</span>` : ''}
        </div>
        <button type="button" class="btn-task-delete" title="Hapus Tugas" data-task-id="${task.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;

      const chk = item.querySelector('.task-checkbox');
      chk.addEventListener('change', () => {
        task.completed = chk.checked;
        this.saveEvents();
        this.renderDetailView();
      });

      item.querySelector('.btn-task-delete').addEventListener('click', () => {
        ev.checklist = ev.checklist.filter(t => t.id !== task.id);
        this.saveEvents();
        this.renderDetailView();
        this.showToast('Tugas checklist dihapus', 'info');
      });

      this.detailTasksList.appendChild(item);
    });
  }

  handleAddTask(e) {
    e.preventDefault();
    const title = this.inputNewTaskTitle.value.trim();
    const category = this.selectNewTaskCategory.value;

    if (!title) return;

    const ev = this.events.find(x => x.id === this.currentEventId);
    if (!ev) return;

    if (!ev.checklist) ev.checklist = [];
    ev.checklist.push({
      id: 'task-' + Date.now(),
      title,
      category,
      completed: false
    });

    this.saveEvents();
    this.inputNewTaskTitle.value = '';
    this.renderDetailView();
    this.showToast('Tugas checklist ditambahkan', 'success');
  }

  applyWOTemplate() {
    const ev = this.events.find(x => x.id === this.currentEventId);
    if (!ev) return;

    if (!confirm('Muat template checklist standar WO ke acara ini?')) return;

    if (!ev.checklist) ev.checklist = [];
    WO_CHECKLIST_TEMPLATE.forEach((item, idx) => {
      ev.checklist.push({
        id: `tpl-${Date.now()}-${idx}`,
        title: item.title,
        category: item.category,
        completed: false
      });
    });

    this.saveEvents();
    this.renderDetailView();
    this.showToast('Template checklist berhasil dimuat!', 'success');
  }

  // Broadcast Text Generator
  buildGroupShareSummary(ev) {
    const formattedDate = this.formatDateIndonesian(ev.date);
    const locations = this.getEventLocations(ev);

    let locationHeaderTitle = '';
    if (locations.length === 1) {
      const rawLabel = (locations[0].label || '').trim();
      locationHeaderTitle = this.formatLocationBadgeTitle(rawLabel, 1);
    } else if (locations.length > 1) {
      locationHeaderTitle = locations.map((loc, idx) => {
        const rawLabel = (loc.label || '').trim();
        return this.formatLocationBadgeTitle(rawLabel, idx + 1);
      }).join(' & ');
    }

    let locationDetails = '';
    if (locations.length === 1) {
      const loc = locations[0];
      const venueName = loc.venueName ? loc.venueName.trim() : '-';
      const venueAddress = loc.venueAddress ? loc.venueAddress.trim() : '-';
      const timeStr = loc.time ? loc.time.trim() : '-';
      const mapsUrl = loc.mapsUrl ? loc.mapsUrl.trim() : '';

      const mapQueryParts = [];
      if (loc.venueName) mapQueryParts.push(loc.venueName.trim());
      if (loc.venueAddress) mapQueryParts.push(loc.venueAddress.trim());
      const query = mapQueryParts.join(', ') || 'Jakarta';

      const openMapsUrl = mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
      const directionsUrl = mapsUrl
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsUrl)}`
        : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;

      locationDetails = `*⏰ WAKTU: ${timeStr}*
*🏢 TEMPAT/KEDIAMAN: ${venueName}*
*📌 ALAMAT: ${venueAddress}*${loc.notes ? `\n*📝 KETERANGAN: ${loc.notes.trim()}*` : ''}
*🗺️ GOOGLE MAPS:* ${openMapsUrl}
*🚗 PETUNJUK ARAH GPS:* ${directionsUrl}`;
    } else {
      locationDetails = locations.map((loc, idx) => {
        const num = idx + 1;
        const rawLabel = (loc.label || '').trim();
        const locTitle = this.formatLocationBadgeTitle(rawLabel, num);
        const venueName = loc.venueName ? loc.venueName.trim() : '-';
        const venueAddress = loc.venueAddress ? loc.venueAddress.trim() : '-';
        const timeStr = loc.time ? loc.time.trim() : '-';
        const mapsUrl = loc.mapsUrl ? loc.mapsUrl.trim() : '';

        const mapQueryParts = [];
        if (loc.venueName) mapQueryParts.push(loc.venueName.trim());
        if (loc.venueAddress) mapQueryParts.push(loc.venueAddress.trim());
        const query = mapQueryParts.join(', ') || 'Jakarta';

        const openMapsUrl = mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
        const directionsUrl = mapsUrl
          ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsUrl)}`
          : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;

        return `----------------------------------------
*📍 ${locTitle}*
*⏰ WAKTU: ${timeStr}*
*🏢 TEMPAT/KEDIAMAN: ${venueName}*
*📌 ALAMAT: ${venueAddress}*${loc.notes ? `\n*📝 KETERANGAN: ${loc.notes.trim()}*` : ''}
*🗺️ GOOGLE MAPS:* ${openMapsUrl}
*🚗 PETUNJUK ARAH GPS:* ${directionsUrl}`;
      }).join('\n\n');
    }

    let crewSummary = '';
    if (ev.crew && ev.crew.length > 0) {
      crewSummary = '\n\n👥 TIM KRU & VENDOR BERTUGAS:\n' + ev.crew.map(c => `• ${c.role}: ${c.name} (${c.phone || 'No kontak belum ada'})`).join('\n');
    }

    const tasks = ev.checklist || [];
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    const primaryAdmin = this.getPrimaryAdmin();
    const cleanAdminPhone = this.formatWhatsAppPhone(primaryAdmin.phone);

    const topHeader = [
      `*💍 BRIEFING ACARA PERNIKAHAN 💍*`,
      locationHeaderTitle ? `*📍 ${locationHeaderTitle}*` : '',
      `*📅 Hari & Tanggal: ${formattedDate}*`
    ].filter(Boolean).join('\n');

    return `${topHeader}

*✨ Pasangan: ${ev.coupleName}*
${locationDetails}

----------------------------------------
📋 KESIAPAN ACARA:
Progres Checklist: ${completed}/${total} Selesai (${pct}%)${crewSummary}

----------------------------------------
📌 CATATAN PETUGAS WO:
Mohon seluruh tim kru & vendor hadir standby di lokasi paling lambat 2 jam sebelum acara dimulai. Pastikan seluruh perlengkapan telah siap.
Mohon konfirmasi kehadiran ke grup ini. Terima kasih! 🙏

----------------------------------------
📞 NARAHUBUNG RESMI ADMIN WO:
Admin 1 (Utama): ${primaryAdmin.name} (${primaryAdmin.phone || 'Belum diatur'})
Chat WA Admin: https://wa.me/${cleanAdminPhone}
(Jika ada kendala mendadak di lapangan, segera hubungi Admin 1)`;
  }

  generateShareSummary(ev) {
    this.populateShareRecipients(ev);
  }

  populateShareRecipients(ev) {
    if (!this.selectShareRecipient) {
      this.textareaSharePreview.value = this.buildGroupShareSummary(ev);
      return;
    }

    const currentVal = this.selectShareRecipient.value || 'group';
    this.selectShareRecipient.innerHTML = '<option value="group">📢 Grup WhatsApp Kru (Pilih kontak manual di WA)</option>';

    if (ev && ev.crew && ev.crew.length > 0) {
      ev.crew.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `👤 ${c.role}: ${c.name} (${c.phone || 'Tanpa No'})`;
        this.selectShareRecipient.appendChild(opt);
      });
    }

    const exists = Array.from(this.selectShareRecipient.options).some(o => o.value === currentVal);
    this.selectShareRecipient.value = exists ? currentVal : 'group';
    this.updateShareDisplayBasedRecipient(ev);
  }

  handleShareRecipientChange() {
    const ev = this.events.find(x => x.id === this.currentEventId);
    if (!ev) return;
    this.updateShareDisplayBasedRecipient(ev);
  }

  updateShareDisplayBasedRecipient(ev) {
    if (!this.selectShareRecipient) return;
    const recipientVal = this.selectShareRecipient.value;

    if (recipientVal === 'group') {
      this.textareaSharePreview.value = this.buildGroupShareSummary(ev);
      if (this.labelShareButton) this.labelShareButton.textContent = 'Buka WhatsApp Grup';
    } else {
      const crew = (ev.crew || []).find(c => c.id === recipientVal);
      if (crew) {
        this.textareaSharePreview.value = this.buildPersonalCrewWAMessage(crew, ev);
        if (this.labelShareButton) this.labelShareButton.textContent = `Kirim WA ke ${crew.name}`;
      } else {
        this.textareaSharePreview.value = this.buildGroupShareSummary(ev);
        if (this.labelShareButton) this.labelShareButton.textContent = 'Buka WhatsApp';
      }
    }
  }

  copyShareContent() {
    const text = this.textareaSharePreview.value;
    if (!text) return;
    this.copyToClipboard(text, 'Teks rekap info acara berhasil disalin! Siap ditempel ke WhatsApp.');
  }

  openDirectWhatsAppShare() {
    const text = this.textareaSharePreview.value;
    if (!text) return;

    const ev = this.events.find(x => x.id === this.currentEventId);
    const recipientVal = this.selectShareRecipient ? this.selectShareRecipient.value : 'group';

    if (recipientVal && recipientVal !== 'group' && ev) {
      const crew = (ev.crew || []).find(c => c.id === recipientVal);
      if (crew) {
        const cleaned = this.cleanPhoneNumber(crew.phone);
        if (!cleaned) {
          this.showToast(`Nomor HP untuk ${crew.name} belum valid atau belum diisi.`, 'error');
          return;
        }
        window.open(`https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
        this.showToast(`Membuka WhatsApp untuk ${crew.name}... Tekan tombol Kirim di WhatsApp!`, 'info');
        return;
      }
    }

    // Default to general/group link
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    this.showToast('Membuka WhatsApp... Pilih grup/kontak tujuan lalu tekan Kirim!', 'info');
  }

  // ==================== MULTI-LOCATION MANAGEMENT ====================
  formatLocationBadgeTitle(label, fallbackIndex = 1) {
    const raw = (label !== undefined && label !== null ? String(label) : '').trim();
    if (!raw) return `LOKASI ${fallbackIndex}`;
    // Jika angka murni seperti "2", "3", "1"
    if (/^\d+$/.test(raw)) {
      return `LOKASI ${raw}`;
    }
    // Jika angka diikuti keterangan, misal "2 (Resepsi)", "1 - Akad"
    if (/^\d+[\s\-(]/.test(raw)) {
      return `LOKASI ${raw.toUpperCase()}`;
    }
    // Jika user ketik "lokasi 2", "Lokasi 3"
    if (raw.toLowerCase().startsWith('lokasi')) {
      return raw.toUpperCase();
    }
    // Jika kata bebas seperti "Akad", "Resepsi"
    return `LOKASI: ${raw.toUpperCase()}`;
  }

  getEventLocations(ev) {
    if (!ev) return [];
    if (Array.isArray(ev.locations) && ev.locations.length > 0) {
      return ev.locations.map((loc, idx) => ({
        id: loc.id || `loc-${idx + 1}`,
        label: loc.label !== undefined ? String(loc.label) : `${idx + 1}`,
        time: loc.time || (idx === 0 ? ev.akadTime : ev.resepsiTime) || '',
        venueName: loc.venueName || ev.venueName || '',
        venueAddress: loc.venueAddress || ev.venueAddress || '',
        mapsUrl: loc.mapsUrl || ev.customMapsUrl || '',
        notes: loc.notes || ''
      }));
    }

    // Fallback from legacy event fields
    const list = [];
    list.push({
      id: 'loc-1',
      label: '1',
      time: ev.akadTime || '08:00 - 10:00 WIB',
      venueName: ev.venueName || 'Masjid / Lokasi Akad',
      venueAddress: ev.venueAddress || '',
      mapsUrl: ev.customMapsUrl || '',
      notes: ''
    });

    if (ev.resepsiTime || ev.venueName) {
      list.push({
        id: 'loc-2',
        label: '2',
        time: ev.resepsiTime || '11:00 - 14:00 WIB',
        venueName: ev.venueName || 'Gedung Resepsi',
        venueAddress: ev.venueAddress || '',
        mapsUrl: ev.customMapsUrl || '',
        notes: ''
      });
    }
    return list;
  }

  renderEventLocationFormItems(locations) {
    if (!this.eventLocationsContainer) return;
    this.eventLocationsContainer.innerHTML = '';

    if (!locations || locations.length === 0) {
      locations = [
        { label: '1', time: '', venueName: '', venueAddress: '', mapsUrl: '', notes: '' }
      ];
    }

    locations.forEach((loc, idx) => {
      this.addLocationFormCard(loc, idx);
    });

    this.updateLocationCountBadge();
  }

  addLocationFormCard(loc = null, idx = null) {
    if (!this.eventLocationsContainer) return;
    const currentCards = this.eventLocationsContainer.querySelectorAll('.location-form-card');
    const index = idx !== null ? idx : currentCards.length;
    const num = index + 1;

    // Nilai manual: jika data loc ada gunakan datanya, jika baru biarkan kosong siap diinput manual sendiri
    const data = loc || {
      label: `${num}`,
      time: '',
      venueName: '',
      venueAddress: '',
      mapsUrl: '',
      notes: ''
    };

    const card = document.createElement('div');
    card.className = `location-form-card ${num === 1 ? 'is-primary-loc' : 'is-extra-loc'}`;
    card.dataset.locationIndex = index;

    const currentTitle = this.formatLocationBadgeTitle(data.label, num);

    card.innerHTML = `
      <div class="location-form-header">
        <span class="location-form-title">
          <span class="card-title-text">📍 ${this.escapeHtml(currentTitle)}</span>
          ${num === 1 ? '<span class="badge-mini" style="background:#FAF6ED; color:var(--gold-dark); border:1px solid var(--gold-300);">Utama</span>' : ''}
        </span>
        ${num > 1 ? `<button type="button" class="btn-remove-location" title="Hapus Lokasi Ini">🗑️ Hapus Lokasi</button>` : '<span style="font-size:0.75rem; color:var(--ink-muted); font-weight:600;">Lokasi Utama (Wajib)</span>'}
      </div>

      <div class="form-row-2">
        <div class="form-group" style="margin-bottom:10px;">
          <label class="form-label" style="font-size:0.8rem; font-weight:700;">Lokasi (Ketik: 1 / 2 / 3 / Nama Acara) <span class="required-star">*</span></label>
          <input type="text" class="form-control loc-input-label" value="${this.escapeHtml(data.label || '')}" placeholder="Ketik bebas: 1 / 2 / 3 / Akad / Resepsi">
        </div>
        <div class="form-group" style="margin-bottom:10px;">
          <label class="form-label" style="font-size:0.8rem; font-weight:700;">Waktu / Jam Acara <span class="required-star">*</span></label>
          <input type="text" class="form-control loc-input-time" value="${this.escapeHtml(data.time || '')}" placeholder="Cth: 08:00 - 10:00 WIB / 19:00 - Selesai">
        </div>
      </div>

      <div class="form-group" style="margin-bottom:10px;">
        <label class="form-label" style="font-size:0.8rem; font-weight:700;">Nama Gedung / Tempat <span class="required-star">*</span></label>
        <input type="text" class="form-control loc-input-venue" value="${this.escapeHtml(data.venueName || '')}" placeholder="Cth: Masjid Agung At-Tin / Ballroom Hotel Mulia / Kediaman Mempelai">
      </div>

      <div class="form-group" style="margin-bottom:10px;">
        <label class="form-label" style="font-size:0.8rem;">Alamat Lengkap Tempat</label>
        <textarea class="form-control loc-input-address" rows="2" placeholder="Cth: Jl. Raya TMII, Cipayung, Jakarta Timur">${this.escapeHtml(data.venueAddress || '')}</textarea>
      </div>

      <div class="form-group" style="margin-bottom:10px;">
        <label class="form-label" style="font-size:0.8rem; display:flex; justify-content:space-between;">
          <span>Link Google Maps (dari WA Klien):</span>
          <span style="font-size:0.7rem; color:var(--ink-muted);">Opsional / Tempel jika ada</span>
        </label>
        <input type="text" class="form-control loc-input-maps" value="${this.escapeHtml(data.mapsUrl || '')}" placeholder="Tempel tautan Google Maps yang dikirim klien di WhatsApp...">
      </div>

      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label" style="font-size:0.8rem; display:flex; justify-content:space-between;">
          <span>Keterangan (Kondisional):</span>
          <span style="font-size:0.7rem; color:var(--gold-dark); font-weight:600;">Opsional / Catatan Khusus</span>
        </label>
        <textarea class="form-control loc-input-notes" rows="2" placeholder="Cth: Ruang rias pengantin di lantai 2, supir masuk gerbang barat, dresscode seragam hitam emas, dll (kondisional)">${this.escapeHtml(data.notes || '')}</textarea>
      </div>
    `;

    // Real-time title update as user types in loc-input-label
    const labelInput = card.querySelector('.loc-input-label');
    const titleText = card.querySelector('.card-title-text');
    if (labelInput && titleText) {
      labelInput.addEventListener('input', () => {
        titleText.textContent = `📍 ${this.formatLocationBadgeTitle(labelInput.value, num)}`;
      });
    }

    const removeBtn = card.querySelector('.btn-remove-location');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        card.remove();
        this.reindexLocationFormCards();
      });
    }

    this.eventLocationsContainer.appendChild(card);
    this.updateLocationCountBadge();
  }

  reindexLocationFormCards() {
    if (!this.eventLocationsContainer) return;
    const cards = this.eventLocationsContainer.querySelectorAll('.location-form-card');
    cards.forEach((card, idx) => {
      const num = idx + 1;
      card.dataset.locationIndex = idx;
      card.className = `location-form-card ${num === 1 ? 'is-primary-loc' : 'is-extra-loc'}`;

      const header = card.querySelector('.location-form-header');
      const labelInput = card.querySelector('.loc-input-label');
      const currentVal = labelInput ? labelInput.value : '';
      const currentTitle = this.formatLocationBadgeTitle(currentVal, num);

      if (header) {
        header.innerHTML = `
          <span class="location-form-title">
            <span class="card-title-text">📍 ${this.escapeHtml(currentTitle)}</span>
            ${num === 1 ? '<span class="badge-mini" style="background:#FAF6ED; color:var(--gold-dark); border:1px solid var(--gold-300);">Utama</span>' : ''}
          </span>
          ${num > 1 ? `<button type="button" class="btn-remove-location" title="Hapus Lokasi Ini">🗑️ Hapus Lokasi</button>` : '<span style="font-size:0.75rem; color:var(--ink-muted); font-weight:600;">Lokasi Utama (Wajib)</span>'}
        `;

        const titleText = header.querySelector('.card-title-text');
        if (labelInput && titleText) {
          labelInput.oninput = () => {
            titleText.textContent = `📍 ${this.formatLocationBadgeTitle(labelInput.value, num)}`;
          };
        }

        const removeBtn = header.querySelector('.btn-remove-location');
        if (removeBtn) {
          removeBtn.addEventListener('click', () => {
            card.remove();
            this.reindexLocationFormCards();
          });
        }
      }
    });
    this.updateLocationCountBadge();
  }

  updateLocationCountBadge() {
    if (!this.badgeLocationCount || !this.eventLocationsContainer) return;
    const count = this.eventLocationsContainer.querySelectorAll('.location-form-card').length;
    this.badgeLocationCount.textContent = `${count} Lokasi`;
  }

  // Event Modal Handlers
  openEventModal(existingEvent = null) {
    this.eventValidationAlert.classList.add('hidden');
    if (existingEvent) {
      this.modalEventTitle.textContent = 'Edit Data Acara Pernikahan';
      this.btnSaveEventLabel.textContent = 'Simpan Perubahan';
      this.inputEventId.value = existingEvent.id;
      this.inputCoupleName.value = existingEvent.coupleName || '';
      this.inputEventDate.value = existingEvent.date || '';
      const locs = this.getEventLocations(existingEvent);
      this.renderEventLocationFormItems(locs);
    } else {
      this.modalEventTitle.textContent = 'Tambah Acara Pernikahan Baru';
      this.btnSaveEventLabel.textContent = 'Simpan & Buka Detail';
      this.inputEventId.value = '';
      this.formEvent.reset();
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 14);
      this.inputEventDate.value = defaultDate.toISOString().split('T')[0];
      // Siapkan 1 slot lokasi kosong bersih siap input manual (bisa ditambah lokasi 2, 3 dst dengan tombol tambah)
      this.renderEventLocationFormItems([
        { label: '1', time: '', venueName: '', venueAddress: '', mapsUrl: '', notes: '' }
      ]);
    }
    this.modalEventBackdrop.classList.add('active');
    setTimeout(() => this.inputCoupleName.focus(), 100);
  }

  closeEventModal() {
    this.modalEventBackdrop.classList.remove('active');
  }

  handleEventFormSubmit(e) {
    e.preventDefault();
    const id = this.inputEventId.value.trim();
    const coupleName = this.inputCoupleName.value.trim();
    const date = this.inputEventDate.value.trim();

    if (!coupleName || !date) {
      let missing = [];
      if (!coupleName) missing.push('Nama Pasangan');
      if (!date) missing.push('Tanggal Acara');

      this.eventValidationAlertText.textContent = `Peringatan: ${missing.join(' dan ')} wajib diisi. Silakan lengkapi formulir sebelum menyimpan.`;
      this.eventValidationAlert.classList.remove('hidden');
      if (!coupleName) this.inputCoupleName.focus();
      else this.inputEventDate.focus();
      return;
    }

    // Extract multi-locations from DOM cards
    const locationCards = this.eventLocationsContainer.querySelectorAll('.location-form-card');
    const locations = [];

    locationCards.forEach((card, idx) => {
      const num = idx + 1;
      const labelInput = card.querySelector('.loc-input-label');
      const timeInput = card.querySelector('.loc-input-time');
      const venueInput = card.querySelector('.loc-input-venue');
      const addressInput = card.querySelector('.loc-input-address');
      const mapsInput = card.querySelector('.loc-input-maps');
      const notesInput = card.querySelector('.loc-input-notes');

      const labelVal = labelInput ? labelInput.value.trim() : '';
      const timeVal = timeInput ? timeInput.value.trim() : '';
      const venueVal = venueInput ? venueInput.value.trim() : '';
      const addressVal = addressInput ? addressInput.value.trim() : '';
      const mapsVal = mapsInput ? mapsInput.value.trim() : '';
      const notesVal = notesInput ? notesInput.value.trim() : '';

      locations.push({
        id: `loc-${idx + 1}`,
        label: labelVal || `${num}`,
        time: timeVal || 'Waktu belum diatur',
        venueName: venueVal,
        venueAddress: addressVal,
        mapsUrl: mapsVal,
        notes: notesVal
      });
    });

    const primaryLoc = locations[0] || {};
    const secondaryLoc = locations[1] || {};

    if (id) {
      const idx = this.events.findIndex(x => x.id === id);
      if (idx !== -1) {
        this.events[idx].coupleName = coupleName;
        this.events[idx].date = date;
        this.events[idx].locations = locations;
        // Legacy fallback sync
        this.events[idx].akadTime = primaryLoc.time || '';
        this.events[idx].resepsiTime = secondaryLoc.time || '';
        this.events[idx].venueName = primaryLoc.venueName || '';
        this.events[idx].venueAddress = primaryLoc.venueAddress || '';
        this.events[idx].customMapsUrl = primaryLoc.mapsUrl || '';

        this.saveEvents();
        this.closeEventModal();
        this.showToast(`Data acara & ${locations.length} lokasi berhasil diperbarui!`, 'success');
        if (this.currentEventId === id) this.renderDetailView();
        else this.render();
      }
    } else {
      const newId = 'event-' + Date.now();
      const newEvent = {
        id: newId,
        coupleName,
        date,
        locations,
        // Legacy fallback sync
        akadTime: primaryLoc.time || '',
        resepsiTime: secondaryLoc.time || '',
        venueName: primaryLoc.venueName || '',
        venueAddress: primaryLoc.venueAddress || '',
        customMapsUrl: primaryLoc.mapsUrl || '',
        isArchived: false,
        crew: [],
        checklist: WO_CHECKLIST_TEMPLATE.map((item, idx) => ({
          id: `task-${Date.now()}-${idx}`,
          title: item.title,
          category: item.category,
          completed: false
        }))
      };

      this.events.push(newEvent);
      this.saveEvents();
      this.closeEventModal();
      this.showToast(`Acara pernikahan ${coupleName} berhasil dibuat dengan ${locations.length} lokasi!`, 'success');
      this.switchToDetail(newId);
    }
  }

  archiveEvent(eventId) {
    const ev = this.events.find(x => x.id === eventId);
    if (!ev || ev.isArchived) return;
    if (confirm(`Pindahkan acara "${ev.coupleName}" ke Arsip Acara Lewat?`)) {
      ev.isArchived = true;
      this.saveEvents();
      this.showToast(`Acara "${ev.coupleName}" berhasil dipindahkan ke Arsip.`, 'info');
      this.render();
    }
  }

  archiveCurrentEvent() {
    if (!this.currentEventId) return;
    const ev = this.events.find(x => x.id === this.currentEventId);
    if (!ev || ev.isArchived) return;
    if (confirm(`Pindahkan acara "${ev.coupleName}" ke Arsip Acara Lewat?`)) {
      ev.isArchived = true;
      this.saveEvents();
      this.renderDetailView();
      this.showToast(`Acara "${ev.coupleName}" berhasil dipindahkan ke Arsip.`, 'info');
    }
  }


  // ==================== UNDUH DOKUMEN PDF & HAPUS ARSIP ====================
  downloadEventAsPdf(eventId) {
    const ev = this.events.find(x => x.id === eventId);
    if (!ev) {
      this.showToast('Data acara tidak ditemukan untuk diunduh.', 'warning');
      return;
    }

    const primaryAdmin = this.getPrimaryAdmin();
    const formattedDate = this.formatDateIndonesian(ev.date);
    const locations = this.getEventLocations(ev);
    const crewList = ev.crew || [];
    const checklist = ev.checklist || [];
    const completedTasks = checklist.filter(t => t.completed).length;
    const totalTasks = checklist.length;
    const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const now = new Date();
    const printDateStr = now.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const safeCoupleName = (ev.coupleName || 'Pernikahan').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const docTitle = `Arsip_Acara_${safeCoupleName}_${ev.date || 'MahligaiWO'}`;

    const brandFull = (this.brandConfig && this.brandConfig.fullName) ? this.brandConfig.fullName : 'Mahligai Wedding Organizer';
    const brandShort = (this.brandConfig && this.brandConfig.shortName) ? this.brandConfig.shortName : 'Mahligai WO';
    const brandTag = (this.brandConfig && this.brandConfig.tagline) ? this.brandConfig.tagline : 'Professional Wedding Organizer & Event Planner';
    let brandLogoPrintHtml = '👑';
    if (this.brandConfig) {
      if (this.brandConfig.logoType === 'image' && this.brandConfig.logoValue) {
        brandLogoPrintHtml = `<img src="${this.brandConfig.logoValue}" style="height:32px; vertical-align:middle; margin-right:8px; border-radius:6px;" alt="Logo">`;
      } else if (this.brandConfig.logoType === 'emoji' && this.brandConfig.logoValue) {
        brandLogoPrintHtml = `<span style="font-size:1.5rem; vertical-align:middle; margin-right:6px;">${this.brandConfig.logoValue}</span>`;
      }
    }

    const printHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>${docTitle}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 16mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1E293B;
      background: #FFFFFF;
      margin: 0;
      padding: 0;
      font-size: 10pt;
      line-height: 1.45;
    }
    .header-kop {
      border-bottom: 2.5px solid #92400E;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand-title {
      font-size: 19pt;
      font-weight: 800;
      color: #92400E;
      letter-spacing: 0.5px;
      margin: 0;
      font-family: Georgia, serif;
    }
    .brand-subtitle {
      font-size: 8.5pt;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-top: 3px;
      font-weight: 600;
    }
    .kop-doc-badge {
      text-align: right;
    }
    .doc-type {
      background: #FEF3C7;
      color: #92400E;
      padding: 4px 10px;
      font-size: 8.5pt;
      font-weight: 800;
      border-radius: 4px;
      border: 1px solid #FCD34D;
      display: inline-block;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    .doc-date {
      font-size: 8pt;
      color: #64748B;
    }
    .event-hero-box {
      background: #F8FAFC;
      border: 1.5px solid #E2E8F0;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .couple-heading {
      font-size: 16pt;
      font-weight: 800;
      color: #0F172A;
      margin: 0 0 8px;
      font-family: Georgia, serif;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 16px;
      font-size: 9.5pt;
    }
    .meta-grid strong {
      color: #334155;
    }
    .section-title {
      font-size: 10.5pt;
      font-weight: 800;
      color: #92400E;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-left: 4px solid #D97706;
      padding-left: 8px;
      margin: 16px 0 8px;
      page-break-after: avoid;
    }
    .location-card-print {
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      padding: 9px 12px;
      margin-bottom: 8px;
      background: #FFFFFF;
      page-break-inside: avoid;
    }
    .loc-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
      border-bottom: 1px dashed #E2E8F0;
      padding-bottom: 5px;
    }
    .loc-badge-print {
      font-size: 8.5pt;
      font-weight: 800;
      background: #FEF3C7;
      color: #92400E;
      padding: 2px 7px;
      border-radius: 4px;
      border: 1px solid #FCD34D;
      text-transform: uppercase;
    }
    .loc-time-print {
      font-size: 9pt;
      font-weight: 700;
      color: #0F172A;
    }
    .loc-venue-print {
      font-size: 10.5pt;
      font-weight: 700;
      color: #0F172A;
      margin-bottom: 3px;
    }
    .loc-address-print {
      font-size: 8.8pt;
      color: #475569;
      margin-bottom: 3px;
    }
    .loc-notes-print {
      font-size: 8.8pt;
      color: #92400E;
      background: #FFFBEB;
      padding: 4px 7px;
      border-radius: 4px;
      border: 1px solid #FDE68A;
      margin-top: 4px;
    }
    .loc-maps-print {
      font-size: 8pt;
      color: #2563EB;
      word-break: break-all;
      margin-top: 3px;
    }
    table.print-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 8.8pt;
      page-break-inside: avoid;
    }
    table.print-table th {
      background: #F1F5F9;
      color: #1E293B;
      font-weight: 700;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #CBD5E1;
    }
    table.print-table td {
      padding: 5px 8px;
      border: 1px solid #CBD5E1;
      vertical-align: top;
    }
    table.print-table tr:nth-child(even) td {
      background: #F8FAFC;
    }
    .status-check-done {
      color: #047857;
      font-weight: 700;
    }
    .status-check-pending {
      color: #64748B;
    }
    .print-footer {
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1.5px solid #CBD5E1;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      page-break-inside: avoid;
    }
    .footer-left {
      font-size: 7.8pt;
      color: #64748B;
      max-width: 60%;
      line-height: 1.4;
    }
    .footer-sig {
      text-align: center;
      min-width: 160px;
    }
    .sig-title {
      font-size: 8.2pt;
      color: #475569;
      margin-bottom: 40px;
    }
    .sig-name {
      font-size: 9pt;
      font-weight: 800;
      color: #0F172A;
      border-top: 1px solid #0F172A;
      padding-top: 3px;
    }
    .sig-sub {
      font-size: 7.8pt;
      color: #64748B;
    }
  </style>
</head>
<body>
  <!-- HEADER KOP RESMI -->
  <div class="header-kop">
    <div>
      <div class="brand-title">${brandLogoPrintHtml} ${this.escapeHtml(brandFull)}</div>
      <div class="brand-subtitle">${this.escapeHtml(brandTag)}</div>
    </div>
    <div class="kop-doc-badge">
      <div class="doc-type">${ev.isArchived ? 'Dokumen Arsip Acara' : 'Dokumen Acara Pernikahan'}</div>
      <div class="doc-date">Dicetak: ${printDateStr}</div>
    </div>
  </div>

  <!-- RINGKASAN ACARA & PENGANTIN -->
  <div class="event-hero-box">
    <div class="couple-heading">${this.escapeHtml(ev.coupleName)}</div>
    <div class="meta-grid">
      <div><strong>📅 Tanggal Pelaksanaan:</strong> ${formattedDate}</div>
      <div><strong>📌 Status Acara:</strong> ${ev.isArchived ? 'Diarsipkan (Selesai)' : 'Acara Aktif'}</div>
      <div><strong>👑 Admin Penanggung Jawab WO:</strong> ${this.escapeHtml(primaryAdmin.name)} (${this.escapeHtml(primaryAdmin.phone)})</div>
      <div><strong>📊 Kesiapan Checklist:</strong> ${completedTasks} dari ${totalTasks} Selesai (${progressPct}%)</div>
    </div>
  </div>

  <!-- BAGIAN 1: DAFTAR LOKASI ACARA -->
  <div class="section-title">📍 A. Rincian Lokasi &amp; Waktu Acara (${locations.length} Lokasi)</div>
  ${locations.map((loc, idx) => {
      const badgeTitle = this.formatLocationBadgeTitle(loc.label, idx + 1);
      const venueName = loc.venueName ? loc.venueName.trim() : 'Gedung / Tempat belum diatur';
      const venueAddress = loc.venueAddress ? loc.venueAddress.trim() : '-';
      const timeStr = loc.time ? loc.time.trim() : 'Waktu belum diatur';
      const notesStr = loc.notes ? loc.notes.trim() : '';
      const mapsUrl = loc.mapsUrl ? loc.mapsUrl.trim() : '';

      return `
      <div class="location-card-print">
        <div class="loc-card-header">
          <span class="loc-badge-print">${this.escapeHtml(badgeTitle)}</span>
          <span class="loc-time-print">⏰ Waktu: ${this.escapeHtml(timeStr)}</span>
        </div>
        <div class="loc-venue-print">${this.escapeHtml(venueName)}</div>
        <div class="loc-address-print"><strong>Alamat:</strong> ${this.escapeHtml(venueAddress)}</div>
        ${notesStr ? `<div class="loc-notes-print"><strong>Keterangan Khusus:</strong> ${this.escapeHtml(notesStr)}</div>` : ''}
        ${mapsUrl ? `<div class="loc-maps-print"><strong>Tautan Google Maps:</strong> ${this.escapeHtml(mapsUrl)}</div>` : ''}
      </div>
    `;
    }).join('')}

  <!-- BAGIAN 2: TIM KRU & VENDOR BERTUGAS -->
  <div class="section-title">👥 B. Susunan Tim Kru &amp; Vendor Bertugas (${crewList.length} Petugas)</div>
  ${crewList.length === 0 ? '<p style="font-size:8.8pt; color:#64748B; font-style:italic;">Tidak ada data kru yang dicatat pada acara ini.</p>' : `
  <table class="print-table">
    <thead>
      <tr>
        <th style="width: 28px; text-align: center;">No</th>
        <th>Nama Kru / Petugas</th>
        <th>Peran / Jabatan</th>
        <th>No. WhatsApp</th>
        <th>Tugas Khusus / Catatan</th>
      </tr>
    </thead>
    <tbody>
      ${crewList.map((c, i) => `
        <tr>
          <td style="text-align: center;">${i + 1}</td>
          <td><strong>${this.escapeHtml(c.name)}</strong></td>
          <td>${this.escapeHtml(c.role || '-')}</td>
          <td>${this.escapeHtml(c.phone || '-')}</td>
          <td>${this.escapeHtml(c.notes || '-')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  `}

  <!-- BAGIAN 3: CHECKLIST TUGAS WO -->
  <div class="section-title">✅ C. Rekapitulasi Progres Checklist (${completedTasks}/${totalTasks} Selesai)</div>
  ${checklist.length === 0 ? '<p style="font-size:8.8pt; color:#64748B; font-style:italic;">Tidak ada checklist tugas.</p>' : `
  <table class="print-table">
    <thead>
      <tr>
        <th style="width: 70px; text-align: center;">Status</th>
        <th>Rincian Tugas Checklist</th>
        <th style="width: 110px;">Kategori</th>
      </tr>
    </thead>
    <tbody>
      ${checklist.map(t => `
        <tr>
          <td style="text-align: center;" class="${t.completed ? 'status-check-done' : 'status-check-pending'}">
            ${t.completed ? '✓ Selesai' : '— Belum'}
          </td>
          <td>${this.escapeHtml(t.title)}</td>
          <td>${this.escapeHtml(t.category || 'Umum')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  `}

  <!-- FOOTER & LEMBAR PENGESAHAN -->
  <div class="print-footer">
    <div class="footer-left">
      Dokumen ini merupakan rekap koordinasi resmi ${this.escapeHtml(brandFull)}.<br>
      Diterbitkan secara digital untuk arsip portofolio klien dan laporan operasional WO.<br>
      Simpan dokumen ini dalam format PDF (Pilih tujuan 'Save as PDF' pada dialog cetak).
    </div>
    <div class="footer-sig">
      <div class="sig-title">Koordinator ${this.escapeHtml(brandShort)},</div>
      <div class="sig-name">${this.escapeHtml(primaryAdmin.name)}</div>
      <div class="sig-sub">Admin 1 / PIC Acara</div>
    </div>
  </div>
</body>
</html>`;

    // Print using hidden iframe to bypass popup blockers
    let iframe = document.getElementById('mahligaiPrintIframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'mahligaiPrintIframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(printHtml);
    doc.close();

    this.showToast(`Membuka dialog cetak / Simpan PDF untuk acara ${ev.coupleName}...`, 'info');

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        const win = window.open('', '_blank');
        if (win) {
          win.document.open();
          win.document.write(printHtml);
          win.document.close();
          win.focus();
          win.print();
        }
      }
    }, 400);
  }

  deleteArchivedEvent(eventId) {
    const ev = this.events.find(x => x.id === eventId);
    if (!ev) return;

    const confirmMsg = `⚠️ KONFIRMASI HAPUS DARI ARSIP\n\nApakah Anda yakin ingin menghapus permanen acara pernikahan "${ev.coupleName}"?\n\n• Seluruh data lokasi, jadwal, kru, dan checklist acara ini akan dihapus dari aplikasi untuk melegakan penyimpanan browser.\n• Pastikan Anda sudah mengunduh salinan dokumen PDF jika diperlukan.\n\nLanjutkan hapus permanen?`;

    if (!confirm(confirmMsg)) return;

    this.events = this.events.filter(x => x.id !== eventId);
    this.saveEvents();

    if (this.currentEventId === eventId) {
      this.currentEventId = null;
      this.switchView('events');
    }

    this.render();
    this.showToast(`Acara "${ev.coupleName}" berhasil dihapus permanen dari arsip. Memori aplikasi telah dibersihkan.`, 'success');
  }

  clearAllArchivedEvents() {
    const archived = this.events.filter(e => e.isArchived || this.calculateCountdown(e.date).isPast);
    if (archived.length === 0) {
      this.showToast('Tidak ada acara di arsip yang dapat dibersihkan.', 'info');
      return;
    }

    const confirmMsg = `⚠️ KONFIRMASI BERSIHKAN SELURUH ARSIP\n\nHapus permanen seluruh ${archived.length} acara yang ada di arsip?\n\n• Seluruh data acara arsip akan dihapus untuk melegakan memori aplikasi secara maksimal.\n• Tindakan ini tidak dapat dibatalkan.\n\nLanjutkan bersihkan ${archived.length} acara arsip?`;

    if (!confirm(confirmMsg)) return;

    const archivedIds = new Set(archived.map(e => e.id));
    this.events = this.events.filter(e => !archivedIds.has(e.id));
    this.saveEvents();

    if (this.currentEventId && archivedIds.has(this.currentEventId)) {
      this.currentEventId = null;
      this.switchView('events');
    }

    this.render();
    this.showToast(`${archived.length} acara di arsip berhasil dibersihkan! Penyimpanan aplikasi kini lebih ringan.`, 'success');
  }

  // Utilities
  copyToClipboard(text, successMessage) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast(successMessage, 'success');
      }).catch(() => {
        this.fallbackCopy(text, successMessage);
      });
    } else {
      this.fallbackCopy(text, successMessage);
    }
  }

  fallbackCopy(text, successMessage) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      this.showToast(successMessage, 'success');
    } catch (err) {
      this.showToast('Gagal menyalin teks secara otomatis', 'warning');
    }
    document.body.removeChild(textArea);
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `<span>${icon}</span><span>${this.escapeHtml(message)}</span>`;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
      }, 300);
    }, 3500);
  }

  // ==================== LICENSE ACTIVATION & ACCESS CONTROL ====================
  isAppLicensed() {
    const lic = this.getLicenseData();
    if (!lic || !lic.isLicensed || !lic.licenseKey || !lic.buyerPhone) return false;
    const check = verifyTimedLicense(lic.buyerPhone, lic.licenseKey);
    return check.valid === true;
  }

  getLicenseData() {
    const raw = localStorage.getItem(STORAGE_KEY_LICENSE);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  checkLicenseGate() {
    const lic = this.getLicenseData();
    let isLicensed = false;
    let expiryAlert = null;

    if (lic && lic.licenseKey && lic.buyerPhone) {
      const now = Date.now();
      // Anti-tamper: if system clock is rolled back by more than 24 hours
      if (lic.lastSeenTime && now < (lic.lastSeenTime - 86400000)) {
        expiryAlert = '⚠️ Tanggal atau waktu perangkat Anda tidak sesuai (dimundurkan). Harap periksa dan sesuaikan jam/tanggal perangkat Anda.';
      } else {
        const check = verifyTimedLicense(lic.buyerPhone, lic.licenseKey);
        if (check.valid) {
          isLicensed = true;
          // update lastSeenTime
          if (!lic.lastSeenTime || now > lic.lastSeenTime) {
            lic.lastSeenTime = now;
            try { localStorage.setItem(STORAGE_KEY_LICENSE, JSON.stringify(lic)); } catch(e){}
          }
        } else if (check.isExpired) {
          expiryAlert = check.reason;
        }
      }
    }

    if (!isLicensed) {
      if (this.licensePortalScreen) {
        this.licensePortalScreen.classList.remove('hidden');
        if (lic && lic.buyerPhone && this.inputLicensePhone && !this.inputLicensePhone.value) {
          this.inputLicensePhone.value = lic.buyerPhone;
        }
        if (this.licenseValidationAlert && expiryAlert) {
          this.licenseValidationAlert.textContent = expiryAlert;
          this.licenseValidationAlert.classList.remove('hidden');
        }
      }
      if (this.appHeader) this.appHeader.classList.add('hidden');
      if (this.appMain) this.appMain.classList.add('hidden');
      if (this.btnToggleAuthModal) this.btnToggleAuthModal.classList.add('hidden');
      return false;
    } else {
      if (this.licensePortalScreen) this.licensePortalScreen.classList.add('hidden');
      if (this.appHeader) this.appHeader.classList.remove('hidden');
      if (this.appMain) this.appMain.classList.remove('hidden');
      if (this.btnToggleAuthModal) this.btnToggleAuthModal.classList.remove('hidden');
      this.renderHeaderLicenseBadge();
      return true;
    }
  }

  handleLicenseActivation(e) {
    if (e) e.preventDefault();
    const phone = this.inputLicensePhone ? this.inputLicensePhone.value.trim() : '';
    const key = this.inputLicenseKey ? this.inputLicenseKey.value.trim().toUpperCase() : '';
    const name = this.inputLicenseName ? this.inputLicenseName.value.trim() : '';

    if (!phone || !key) {
      if (this.licenseValidationAlert) {
        this.licenseValidationAlert.textContent = 'Harap masukkan Nomor WhatsApp Terdaftar dan Kode Lisensi Anda!';
        this.licenseValidationAlert.classList.remove('hidden');
      }
      return;
    }

    const check = verifyTimedLicense(phone, key);
    if (!check.valid) {
      if (this.licenseValidationAlert) {
        this.licenseValidationAlert.textContent = check.reason || 'Kode lisensi tidak valid atau tidak cocok dengan nomor WhatsApp!';
        this.licenseValidationAlert.classList.remove('hidden');
      }
      return;
    }

    const finalName = name || (this.ownerAccount && this.ownerAccount.name) || 'Pemilik WO';

    const licenseData = {
      isLicensed: true,
      buyerName: finalName,
      buyerPhone: phone,
      cleanPhone: normalizeLicensePhone(phone),
      licenseKey: key,
      durCode: check.durCode,
      durationName: check.durationName,
      isLifetime: check.isLifetime,
      expDateStr: check.expDateStr,
      expTimestamp: check.expTimestamp || null,
      activatedAt: new Date().toISOString()
    };

    try {
      localStorage.setItem(STORAGE_KEY_LICENSE, JSON.stringify(licenseData));
    } catch (err) {
      console.warn('Storage error:', err);
    }

    if (this.licenseValidationAlert) {
      this.licenseValidationAlert.classList.add('hidden');
    }

    // Auto set owner name & phone if not set yet
    if (!this.ownerAccount) {
      this.ownerAccount = {
        name: finalName,
        phone: phone,
        password: 'owner',
        createdAt: new Date().toISOString()
      };
      try {
        localStorage.setItem(STORAGE_KEY_OWNER_ACCOUNT, JSON.stringify(this.ownerAccount));
      } catch (err) {}
    }

    const durationInfo = check.isLifetime ? 'Aktif Selamanya (Permanen)' : `${check.durationName} (Sisa ${check.daysRemaining} Hari)`;
    this.showToast(`✨ Login Berhasil! Lisensi terverifikasi: ${durationInfo}`, 'success');

    this.checkLicenseGate();
    this.renderUserAccessHeader();
    this.render();
    this.renderMasterCrewList();
    this.renderLicenseStatus();
  }

  renderHeaderLicenseBadge() {
    if (!this.headerLicenseBadge) return;
    const lic = this.getLicenseData();
    if (!lic || !lic.isLicensed) {
      this.headerLicenseBadge.style.display = 'none';
      return;
    }

    const check = verifyTimedLicense(lic.buyerPhone, lic.licenseKey);
    this.headerLicenseBadge.style.display = 'inline-flex';
    this.headerLicenseBadge.style.alignItems = 'center';
    this.headerLicenseBadge.style.justifyContent = 'center';
    this.headerLicenseBadge.style.whiteSpace = 'nowrap';
    this.headerLicenseBadge.style.flexShrink = '0';

    if (check.isLifetime) {
      this.headerLicenseBadge.style.background = '#DCFCE7';
      this.headerLicenseBadge.style.color = '#15803D';
      this.headerLicenseBadge.style.borderColor = '#86EFAC';
      this.headerLicenseBadge.textContent = '👑 Selamanya';
      this.headerLicenseBadge.title = 'Lisensi Resmi Permanen (Aktif Selamanya)';
    } else if (check.valid) {
      this.headerLicenseBadge.style.background = '#FEF3C7';
      this.headerLicenseBadge.style.color = '#92400E';
      this.headerLicenseBadge.style.borderColor = '#FDE68A';
      this.headerLicenseBadge.textContent = `⏳ Sisa ${check.daysRemaining} Hari`;
      this.headerLicenseBadge.title = `Lisensi ${check.durationName} — Aktif s/d ${check.expDateStr}`;
    } else {
      this.headerLicenseBadge.style.background = '#FEE2E2';
      this.headerLicenseBadge.style.color = '#B91C1C';
      this.headerLicenseBadge.style.borderColor = '#FCA5A5';
      this.headerLicenseBadge.textContent = '⚠️ Habis';
      this.headerLicenseBadge.title = 'Masa aktif lisensi telah habis';
    }
  }

  renderLicenseStatus() {
    if (!this.adminLicenseStatusBox) return;
    const lic = this.getLicenseData();
    if (lic && lic.isLicensed) {
      const check = verifyTimedLicense(lic.buyerPhone, lic.licenseKey);
      const actDate = lic.activatedAt ? new Date(lic.activatedAt).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric'
      }) : '-';

      const statusBadge = check.isLifetime ?
        `<span class="badge-mini" style="background:#DCFCE7; color:#15803D; font-weight:800; font-size:0.8rem; padding:4px 10px; border-radius:20px;">✅ PERMANEN (AKTIF SELAMANYA)</span>` :
        (check.valid ?
          `<span class="badge-mini" style="background:#FEF3C7; color:#92400E; font-weight:800; font-size:0.8rem; padding:4px 10px; border-radius:20px;">⏳ AKTIF (SISA ${check.daysRemaining} HARI)</span>` :
          `<span class="badge-mini" style="background:#FEE2E2; color:#B91C1C; font-weight:800; font-size:0.8rem; padding:4px 10px; border-radius:20px;">⚠️ KEDALUWARSA</span>`);

      this.adminLicenseStatusBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
          <div>
            ${statusBadge}
            <h4 style="font-size:1.05rem; font-weight:800; color:var(--ink-primary); margin:8px 0 2px 0;">Lisensi Resmi Mahligai WO</h4>
            <p style="font-size:0.78rem; color:var(--ink-secondary); margin:0;">Paket: <strong>${this.escapeHtml(check.durationName || lic.durationName || '-')}</strong></p>
          </div>
          <span style="font-size:1.8rem;">💎</span>
        </div>
        <div style="background:#FFFFFF; border:1px solid #86EFAC; border-radius:10px; padding:12px; margin-bottom:12px; font-size:0.82rem; line-height:1.6;">
          <div><strong>WhatsApp Terdaftar:</strong> ${this.escapeHtml(lic.buyerPhone || '-')}</div>
          <div><strong>Kode Lisensi:</strong> <code style="font-weight:800; color:#15803D; background:#F0FDF4; padding:2px 6px; border-radius:4px;">${this.escapeHtml(lic.licenseKey || '-')}</code></div>
          <div><strong>Masa Berlaku:</strong> <span style="font-weight:700; color:${check.valid ? '#15803D' : '#DC2626'};">${this.escapeHtml(check.expDateStr || '-')}</span></div>
          <div><strong>Tanggal Login Pertama:</strong> ${this.escapeHtml(actDate)}</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn btn-secondary btn-sm" id="btnReloginLicense" style="flex:1; font-size:0.8rem; justify-content:center;">
            <span>🔄 Ganti / Perpanjang Lisensi</span>
          </button>
        </div>
      `;

      const btnRelogin = document.getElementById('btnReloginLicense');
      if (btnRelogin) {
        btnRelogin.addEventListener('click', () => {
          if (confirm('Apakah Anda ingin keluar dan memasukkan kode lisensi yang baru?')) {
            localStorage.removeItem(STORAGE_KEY_LICENSE);
            if (this.modalOwnerAdminBackdrop) this.modalOwnerAdminBackdrop.classList.remove('active');
            this.checkLicenseGate();
            this.showToast('Silakan masukkan kode lisensi baru Anda.', 'info');
          }
        });
      }
    } else {
      this.adminLicenseStatusBox.innerHTML = `
        <div style="text-align:center; padding:10px;">
          <span style="font-size:1.5rem;">🔒</span>
          <div style="font-weight:700; color:#B45309; margin:4px 0;">Aplikasi Belum Berlisensi</div>
          <div style="font-size:0.78rem; color:var(--ink-secondary);">Silakan lakukan login lisensi melalui menu masuk utama.</div>
        </div>
      `;
    }
  }

  // ==================== OWNER AUTH & ADMIN MANAGEMENT ====================
  initAuthGate() {
    if (!this.checkLicenseGate()) return;

    this.ownerAccount = this.loadOwnerAccount();

    // Pastikan dashboard dan navigasi selalu tampil langsung tanpa terhalang login
    if (this.authPortalScreen) this.authPortalScreen.classList.add('hidden');
    if (this.appHeader) this.appHeader.classList.remove('hidden');
    if (this.appMain) this.appMain.classList.remove('hidden');

    this.renderUserAccessHeader();
    this.render();
    this.renderMasterCrewList();
    this.renderLicenseStatus();
  }

  handleOwnerRegister(e) {
    e.preventDefault();
    const name = this.regOwnerName.value.trim();
    const phone = this.regOwnerPhone.value.trim();
    const pass = this.regOwnerPassword.value;
    const confirm = this.regOwnerPasswordConfirm.value;

    if (!name || !phone || !pass) {
      this.regValidationAlert.textContent = 'Harap lengkapi semua kolom pendaftaran!';
      this.regValidationAlert.classList.remove('hidden');
      return;
    }

    if (pass.length < 4) {
      this.regValidationAlert.textContent = 'Kata sandi minimal 4 karakter demi keamanan!';
      this.regValidationAlert.classList.remove('hidden');
      return;
    }

    if (pass !== confirm) {
      this.regValidationAlert.textContent = 'Konfirmasi kata sandi tidak cocok. Silakan periksa kembali.';
      this.regValidationAlert.classList.remove('hidden');
      return;
    }

    this.ownerAccount = {
      name,
      phone,
      password: pass,
      createdAt: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY_OWNER_ACCOUNT, JSON.stringify(this.ownerAccount));
    sessionStorage.setItem(STORAGE_KEY_AUTH_SESSION, 'active');
    this.regValidationAlert.classList.add('hidden');
    this.showToast(`Akun Owner atas nama ${name} berhasil dibuat! Selamat datang di Mahligai WO.`, 'success');

    this.initAuthGate();
  }

  handleAppLogin(e) {
    e.preventDefault();
    const entered = this.loginPassword.value;
    const expected = this.ownerAccount ? this.ownerAccount.password : 'owner123';

    if (entered === expected) {
      this.loginAppValidationAlert.classList.add('hidden');
      sessionStorage.setItem(STORAGE_KEY_AUTH_SESSION, 'active');
      this.showToast(`Login berhasil! Selamat datang, ${this.ownerAccount?.name || 'Owner'}.`, 'success');
      this.initAuthGate();
    } else {
      this.loginAppValidationAlert.textContent = 'Kata sandi salah! Silakan coba lagi atau reset akun.';
      this.loginAppValidationAlert.classList.remove('hidden');
      this.loginPassword.focus();
    }
  }

  handleResetOwnerAccount() {
    if (confirm('Apakah Anda yakin ingin mereset akun Owner di browser ini? Anda dapat membuat akun Owner baru setelah reset.')) {
      localStorage.removeItem(STORAGE_KEY_OWNER_ACCOUNT);
      sessionStorage.removeItem(STORAGE_KEY_AUTH_SESSION);
      this.ownerAccount = null;
      this.showToast('Akun Owner berhasil di-reset. Silakan buat akun login baru.', 'info');
      this.initAuthGate();
    }
  }

  handleLogout() {
    if (confirm('Apakah Anda ingin keluar dari aplikasi? Anda perlu memasukkan Nomor WhatsApp dan Kode Lisensi untuk masuk kembali.')) {
      localStorage.removeItem(STORAGE_KEY_LICENSE);
      sessionStorage.removeItem(STORAGE_KEY_AUTH_SESSION);
      this.showToast('Anda telah keluar dari aplikasi.', 'info');
      this.checkLicenseGate();
    }
  }

  renderUserAccessHeader() {
    const primary = this.getPrimaryAdmin();
    if (!this.userRoleIcon) return;

    const brandShort = (this.brandConfig && this.brandConfig.shortName) ? this.brandConfig.shortName : 'WO';
    const ownerName = this.ownerAccount ? this.ownerAccount.name : `Owner ${brandShort}`;
    this.userRoleIcon.textContent = '👑';
    this.userRoleTitle.textContent = ownerName;
    this.userRoleSub.textContent = (primary && primary.id !== 'adm-none' && primary.phone) 
      ? `Admin 1: ${primary.name}` 
      : 'Pengaturan Admin';
    if (this.labelAuthAction) {
      this.labelAuthAction.textContent = 'Keluar';
    }
  }

  // ==================== BRANDING & OWNER SETTINGS MODAL ====================
  loadBrandConfig() {
    const raw = localStorage.getItem(STORAGE_KEY_BRAND_CONFIG);
    if (!raw) return getDefaultBrandConfig();
    try {
      const parsed = JSON.parse(raw);
      return { ...getDefaultBrandConfig(), ...parsed };
    } catch (e) {
      return getDefaultBrandConfig();
    }
  }

  saveBrandConfig(cfg) {
    this.brandConfig = { ...this.brandConfig, ...cfg };
    try {
      localStorage.setItem(STORAGE_KEY_BRAND_CONFIG, JSON.stringify(this.brandConfig));
    } catch (e) {
      console.warn('LocalStorage error saving brand config:', e);
    }
    this.applyBrandSettings();
  }

  renderLogoHtml(logoType, logoValue, customClass = '') {
    if (logoType === 'image' && logoValue) {
      return `<img src="${logoValue}" class="brand-custom-img ${customClass}" alt="Logo WO">`;
    }
    if (logoType === 'emoji' && logoValue) {
      return `<span class="brand-emoji-icon ${customClass}">${this.escapeHtml(logoValue)}</span>`;
    }
    // Default: Golden Heart SVG
    return `<svg class="${customClass}" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
    </svg>`;
  }

  applyBrandSettings() {
    const cfg = this.brandConfig || getDefaultBrandConfig();

    // 1. Update document title
    document.title = `${cfg.shortName || cfg.fullName} - Aplikasi Manajemen Pernikahan`;

    // 2. Update Header Brand
    if (this.headerBrandTitle) {
      this.headerBrandTitle.textContent = cfg.shortName || cfg.fullName;
    }
    if (this.headerBrandSubtitle) {
      this.headerBrandSubtitle.textContent = cfg.tagline || 'Wedding Organizer Management';
    }
    if (this.headerBrandIcon) {
      this.headerBrandIcon.innerHTML = this.renderLogoHtml(cfg.logoType, cfg.logoValue);
    }

    // 3. Update Auth Screen
    if (this.authBrandTitle) {
      this.authBrandTitle.textContent = cfg.fullName || 'Mahligai Wedding Organizer';
    }
    if (this.authBrandSubtitle) {
      this.authBrandSubtitle.textContent = cfg.tagline || 'Sistem Manajemen & Koordinasi Acara Pernikahan';
    }
    if (this.authBrandCrest) {
      if (cfg.logoType === 'image' && cfg.logoValue) {
        this.authBrandCrest.innerHTML = `<img src="${cfg.logoValue}" class="auth-custom-crest-img" alt="Logo WO">`;
      } else if (cfg.logoType === 'emoji' && cfg.logoValue) {
        this.authBrandCrest.textContent = cfg.logoValue;
      } else {
        this.authBrandCrest.textContent = '💍';
      }
    }

    // 4. Update Modal Form inputs & preview
    this.loadBrandFormValues();
  }

  loadBrandFormValues() {
    const cfg = this.brandConfig || getDefaultBrandConfig();
    if (this.inputBrandFullName) this.inputBrandFullName.value = cfg.fullName || '';
    if (this.inputBrandShortName) this.inputBrandShortName.value = cfg.shortName || '';
    if (this.inputBrandTagline) this.inputBrandTagline.value = cfg.tagline || '';
    this.tempBrandLogo = {
      type: cfg.logoType,
      value: cfg.logoValue
    };
    this.updateBrandLivePreview();
  }

  updateBrandLivePreview() {
    const shortName = this.inputBrandShortName ? (this.inputBrandShortName.value.trim() || 'Nama WO') : 'Nama WO';
    const tagline = this.inputBrandTagline ? (this.inputBrandTagline.value.trim() || 'Wedding Organizer Management') : 'Wedding Organizer Management';

    if (this.previewBrandTitle) this.previewBrandTitle.textContent = shortName;
    if (this.previewBrandSubtitle) this.previewBrandSubtitle.textContent = tagline;

    const logoType = this.tempBrandLogo ? this.tempBrandLogo.type : 'svg-heart';
    const logoValue = this.tempBrandLogo ? this.tempBrandLogo.value : '👑';

    if (this.previewBrandIcon) {
      this.previewBrandIcon.innerHTML = this.renderLogoHtml(logoType, logoValue);
    }

    // Modal logo box avatar
    if (this.imgLogoUploadPreview && this.logoPreviewPlaceholder) {
      if (logoType === 'image' && logoValue) {
        this.imgLogoUploadPreview.src = logoValue;
        this.imgLogoUploadPreview.classList.remove('hidden');
        this.logoPreviewPlaceholder.classList.add('hidden');
      } else {
        this.imgLogoUploadPreview.classList.add('hidden');
        this.logoPreviewPlaceholder.classList.remove('hidden');
        this.logoPreviewPlaceholder.textContent = (logoType === 'emoji' && logoValue) ? logoValue : '💖';
      }
    }
  }

  handleSaveBrandConfig(e) {
    if (e) e.preventDefault();

    const fullName = this.inputBrandFullName ? this.inputBrandFullName.value.trim() : '';
    const shortName = this.inputBrandShortName ? this.inputBrandShortName.value.trim() : '';
    const tagline = this.inputBrandTagline ? this.inputBrandTagline.value.trim() : '';

    if (!fullName) {
      this.showToast('Nama Lengkap Wedding Organizer wajib diisi!', 'warning');
      if (this.inputBrandFullName) this.inputBrandFullName.focus();
      return;
    }

    if (!shortName) {
      this.showToast('Nama Pendek / Header HP wajib diisi!', 'warning');
      if (this.inputBrandShortName) this.inputBrandShortName.focus();
      return;
    }

    const newConfig = {
      fullName,
      shortName,
      tagline,
      logoType: this.tempBrandLogo?.type || 'svg-heart',
      logoValue: this.tempBrandLogo?.value || '👑'
    };

    this.saveBrandConfig(newConfig);
    this.showToast('Identitas & Logo Brand WO berhasil disimpan!', 'success');
  }

  switchOwnerModalTab(tabKey) {
    // Update active state on jump pill buttons
    if (this.tabBtnBrandingSettings) this.tabBtnBrandingSettings.classList.toggle('active', tabKey === 'branding');
    if (this.tabBtnAdminSettings) this.tabBtnAdminSettings.classList.toggle('active', tabKey === 'admin');
    if (this.tabBtnSecuritySettings) this.tabBtnSecuritySettings.classList.toggle('active', tabKey === 'security');
    if (this.tabBtnLicenseSettings) this.tabBtnLicenseSettings.classList.toggle('active', tabKey === 'license');

    // Smooth scroll to the target section within the modal
    let targetAnchor = null;
    if (tabKey === 'branding') targetAnchor = document.getElementById('anchorBranding');
    else if (tabKey === 'admin') targetAnchor = document.getElementById('anchorAdmin');
    else if (tabKey === 'security') targetAnchor = document.getElementById('anchorSecurity');
    else if (tabKey === 'license') targetAnchor = document.getElementById('anchorLicense');

    if (targetAnchor) {
      targetAnchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  openOwnerAdminModal(defaultSection = 'branding') {
    this.closeAdminForm();
    this.loadBrandFormValues();
    this.renderOwnerAdminList();
    this.renderLicenseStatus();
    this.modalOwnerAdminBackdrop.classList.add('active');

    // Reset scroll to top or jump to selected section
    const modalBody = this.modalOwnerAdminBackdrop.querySelector('.admin-modal-body');
    if (modalBody) {
      modalBody.scrollTop = 0;
    }

    if (defaultSection && defaultSection !== 'branding') {
      setTimeout(() => this.switchOwnerModalTab(defaultSection), 100);
    } else {
      if (this.tabBtnBrandingSettings) this.tabBtnBrandingSettings.classList.add('active');
      if (this.tabBtnAdminSettings) this.tabBtnAdminSettings.classList.remove('active');
      if (this.tabBtnSecuritySettings) this.tabBtnSecuritySettings.classList.remove('active');
      if (this.tabBtnLicenseSettings) this.tabBtnLicenseSettings.classList.remove('active');
    }
  }

  closeOwnerAdminModal() {
    this.modalOwnerAdminBackdrop.classList.remove('active');
  }

  renderOwnerAdminList() {
    const primary = this.getPrimaryAdmin();
    const hasAdmin = this.adminList && this.adminList.length > 0;
    const cleanPrimaryPhone = hasAdmin && primary.phone ? this.formatWhatsAppPhone(primary.phone) : '';

    // Active Admin 1 Highlight Box
    if (!hasAdmin) {
      this.adminActiveHighlightBox.innerHTML = `
        <div class="admin-highlight-header">
          <div class="admin-highlight-tag">📱 ADMIN 1 BELUM DIATUR</div>
        </div>
        <div class="admin-highlight-body">
          <div class="admin-highlight-avatar" style="background:#F1F5F9; color:#64748B; border:2px dashed #CBD5E1; box-shadow:none;">➕</div>
          <div class="admin-highlight-details">
            <div class="admin-highlight-name" style="font-size:1rem; color:#475569;">Belum Ada Admin Terdaftar</div>
            <div style="font-size:0.8rem; color:#64748B; margin-top:2px;">Silakan klik tombol <strong>"+ Tambah Admin"</strong> di bawah untuk mendaftarkan nama dan nomor WhatsApp Admin 1 Anda.</div>
          </div>
        </div>
      `;
    } else {
      this.adminActiveHighlightBox.innerHTML = `
        <div class="admin-highlight-header">
          <div class="admin-highlight-tag">👑 ADMIN 1 UTAMA (AKTIF)</div>
          <div class="admin-highlight-status">
            <span class="status-dot"></span>
            <span>Aktif di Seluruh Sistem</span>
          </div>
        </div>

        <div class="admin-highlight-body">
          <div class="admin-highlight-avatar">👑</div>
          <div class="admin-highlight-details">
            <div class="admin-highlight-name">${this.escapeHtml(primary.name)}</div>
            <div class="admin-highlight-contacts">
              <div class="contact-line">
                <span class="contact-icon">📱</span>
                <span class="contact-label">WhatsApp:</span>
                <strong class="contact-value">${this.escapeHtml(primary.phone)}</strong>
              </div>
              ${primary.email ? `
                <div class="contact-line">
                  <span class="contact-icon">✉️</span>
                  <span class="contact-label">Email:</span>
                  <span class="contact-value email-value">${this.escapeHtml(primary.email)}</span>
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <div class="admin-highlight-action">
          <a href="https://wa.me/${cleanPrimaryPhone}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp btn-highlight-wa" title="Uji Hubungi WhatsApp Admin 1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.884 9.885m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <span>Buka Chat WhatsApp Admin 1</span>
          </a>
        </div>
      `;
    }

    // Render Cards List
    this.ownerAdminCardsList.innerHTML = '';
    if (!hasAdmin) {
      this.ownerAdminCardsList.innerHTML = `<div style="text-align:center; padding:22px; color:#64748B; font-size:0.85rem; background:#F8FAFC; border-radius:10px; border:1px dashed #CBD5E1;">Belum ada kontak Admin terdaftar. Klik <strong>+ Tambah Admin</strong> di atas untuk menambahkan kontak pertama Anda.</div>`;
      return;
    }

    this.adminList.forEach((adm, idx) => {
      const isPri = adm.id === primary.id;
      const card = document.createElement('div');
      card.className = `admin-card-item ${isPri ? 'is-primary' : ''}`;

      card.innerHTML = `
        <div class="admin-card-header">
          <div class="admin-idx-badge ${isPri ? 'is-primary' : ''}">
            ${idx + 1}
          </div>
          <div class="admin-card-identity">
            <div class="admin-card-title-row">
              <span class="admin-card-name">${this.escapeHtml(adm.name)}</span>
              ${isPri
                ? `<span class="badge-admin-primary">⭐ Admin 1 (Utama)</span>`
                : `<span class="badge-admin-secondary">Admin ${idx + 1}</span>`
              }
            </div>
            <div class="admin-card-contacts">
              <div class="admin-card-contact-item">
                <span class="icon">📱</span>
                <span>WhatsApp: <strong>${this.escapeHtml(adm.phone)}</strong></span>
              </div>
              ${adm.email ? `
                <div class="admin-card-contact-item">
                  <span class="icon">✉️</span>
                  <span class="email-text">${this.escapeHtml(adm.email)}</span>
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <div class="admin-card-actions">
          ${!isPri ? `
            <button type="button" class="btn btn-outline-gold btn-sm btn-set-primary" data-id="${adm.id}" title="Jadikan Admin 1 Utama">
              ⭐ Jadikan Admin 1
            </button>
          ` : `
            <span class="badge-admin-selected">
              ✓ Admin 1 Terpilih
            </span>
          `}
          <button type="button" class="btn btn-secondary btn-sm btn-edit-admin" data-id="${adm.id}" title="Edit Data Admin">
            ✏️ Edit
          </button>
          <button type="button" class="btn btn-danger-icon btn-delete-admin" data-id="${adm.id}" title="Hapus Admin" aria-label="Hapus Admin">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      `;

      // Event handlers per card
      const btnSetPri = card.querySelector('.btn-set-primary');
      if (btnSetPri) {
        btnSetPri.addEventListener('click', () => this.setPrimaryAdmin(adm.id));
      }

      const btnEdit = card.querySelector('.btn-edit-admin');
      if (btnEdit) {
        btnEdit.addEventListener('click', () => this.openEditAdminForm(adm));
      }

      const btnDel = card.querySelector('.btn-delete-admin');
      if (btnDel) {
        btnDel.addEventListener('click', () => this.deleteAdmin(adm.id));
      }

      this.ownerAdminCardsList.appendChild(card);
    });
  }

  openAddAdminForm() {
    this.formAdminTitle.textContent = 'Tambah Admin Baru';
    this.inputAdminId.value = '';
    this.formAdminData.reset();
    this.checkIsPrimaryAdmin.checked = this.adminList.length === 0;
    this.containerAdminForm.classList.remove('hidden');
    setTimeout(() => this.inputAdminName.focus(), 50);
  }

  openEditAdminForm(adm) {
    this.formAdminTitle.textContent = `Edit Data ${adm.name}`;
    this.inputAdminId.value = adm.id;
    this.inputAdminName.value = adm.name;
    this.inputAdminPhone.value = adm.phone;
    this.inputAdminEmail.value = adm.email || '';
    this.checkIsPrimaryAdmin.checked = !!adm.isPrimary;
    this.containerAdminForm.classList.remove('hidden');
    setTimeout(() => this.inputAdminName.focus(), 50);
  }

  closeAdminForm() {
    this.containerAdminForm.classList.add('hidden');
    this.formAdminData.reset();
    this.inputAdminId.value = '';
  }

  handleSaveAdmin(e) {
    e.preventDefault();
    const id = this.inputAdminId.value;
    const name = this.inputAdminName.value.trim();
    const phone = this.inputAdminPhone.value.trim();
    const email = this.inputAdminEmail.value.trim();
    const isPrimary = this.checkIsPrimaryAdmin.checked;

    if (!name || !phone) {
      this.showToast('Nama dan Nomor WhatsApp wajib diisi!', 'warning');
      return;
    }

    if (id) {
      // Edit
      const adm = this.adminList.find(a => a.id === id);
      if (adm) {
        adm.name = name;
        adm.phone = phone;
        adm.email = email;
        if (isPrimary) {
          this.adminList.forEach(a => a.isPrimary = false);
          adm.isPrimary = true;
        }
      }
      this.showToast(`Data admin ${name} berhasil diperbarui!`, 'success');
    } else {
      // Create
      if (isPrimary || this.adminList.length === 0) {
        this.adminList.forEach(a => a.isPrimary = false);
      }
      const newAdmin = {
        id: 'adm-' + Date.now(),
        name,
        phone,
        email,
        isPrimary: isPrimary || this.adminList.length === 0,
        createdAt: new Date().toISOString()
      };
      this.adminList.push(newAdmin);
      this.showToast(`Admin baru ${name} berhasil ditambahkan!`, 'success');
    }

    this.saveAdminList();
    this.closeAdminForm();
    this.renderOwnerAdminList();
    this.renderUserAccessHeader();
    if (this.currentEventId) {
      this.renderDetailView();
    }
  }

  setPrimaryAdmin(id) {
    this.adminList.forEach(a => {
      a.isPrimary = (a.id === id);
    });
    this.saveAdminList();
    const primary = this.getPrimaryAdmin();
    this.renderOwnerAdminList();
    this.renderUserAccessHeader();
    if (this.currentEventId) {
      this.renderDetailView();
    }
    this.showToast(`⭐ ${primary.name} berhasil ditetapkan sebagai Admin 1! Nomor otomatis dicantumkan ke aplikasi.`, 'success');
  }

  deleteAdmin(id) {
    if (this.adminList.length <= 1) {
      this.showToast('Minimal harus ada 1 Admin dalam sistem.', 'warning');
      return;
    }
    const adm = this.adminList.find(a => a.id === id);
    if (!adm) return;

    if (confirm(`Yakin ingin menghapus Admin "${adm.name}"?`)) {
      const wasPrimary = adm.isPrimary;
      this.adminList = this.adminList.filter(a => a.id !== id);
      if (wasPrimary && this.adminList.length > 0) {
        this.adminList[0].isPrimary = true;
      }
      this.saveAdminList();
      this.renderOwnerAdminList();
      this.renderUserAccessHeader();
      if (this.currentEventId) {
        this.renderDetailView();
      }
      this.showToast(`Admin ${adm.name} berhasil dihapus.`, 'info');
    }
  }

  handleSaveNewOwnerPassword() {
    const newPass = this.inputNewOwnerPassword.value.trim();
    const confirmPass = this.inputConfirmOwnerPassword ? this.inputConfirmOwnerPassword.value.trim() : newPass;

    if (!newPass || newPass.length < 4) {
      this.showToast('Kata sandi baru minimal 4 karakter!', 'warning');
      return;
    }
    if (newPass !== confirmPass) {
      this.showToast('Konfirmasi kata sandi tidak cocok. Harap ketik ulang!', 'warning');
      return;
    }
    if (!this.ownerAccount) {
      this.ownerAccount = {
        name: 'Owner',
        phone: '081234567890',
        password: newPass,
        createdAt: new Date().toISOString()
      };
    } else {
      this.ownerAccount.password = newPass;
    }
    localStorage.setItem(STORAGE_KEY_OWNER_ACCOUNT, JSON.stringify(this.ownerAccount));
    this.inputNewOwnerPassword.value = '';
    if (this.inputConfirmOwnerPassword) this.inputConfirmOwnerPassword.value = '';
    if (this.containerChangePassword) this.containerChangePassword.classList.add('hidden');
    this.showToast('Kata sandi Owner berhasil diperbarui!', 'success');
  }

  // ==================== CADANGKAN & PULIHKAN DATA (LAPTOP ⇄ HP SYNC) ====================
  handleExportDataBackup() {
    try {
      const backupData = {
        app: 'Mahligai Wedding Organizer',
        version: '2.0',
        exportedAt: new Date().toISOString(),
        brandConfig: this.brandConfig || getDefaultBrandConfig(),
        adminList: this.adminList || [],
        masterCrew: this.masterCrew || [],
        events: this.events || [],
        ownerAccount: this.ownerAccount || null,
        licenseData: this.getLicenseData() || null
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const nowStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `mahligai-wo-backup-${nowStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showToast('File cadangan (.json) berhasil diunduh! Siap dipindahkan ke HP Anda.', 'success');
    } catch (err) {
      this.showToast('Gagal mencadangkan data: ' + err.message, 'error');
    }
  }

  handleImportDataBackup(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data || typeof data !== 'object') {
          throw new Error('Format file cadangan tidak valid.');
        }

        if (Array.isArray(data.events)) {
          this.events = data.events;
          localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(this.events));
        }
        if (Array.isArray(data.masterCrew)) {
          this.masterCrew = data.masterCrew;
          localStorage.setItem(STORAGE_KEY_MASTER_CREW, JSON.stringify(this.masterCrew));
        }
        if (Array.isArray(data.adminList)) {
          this.adminList = data.adminList;
          localStorage.setItem(STORAGE_KEY_ADMIN_LIST, JSON.stringify(this.adminList));
        }
        if (data.brandConfig && typeof data.brandConfig === 'object') {
          this.brandConfig = { ...getDefaultBrandConfig(), ...data.brandConfig };
          localStorage.setItem(STORAGE_KEY_BRAND_CONFIG, JSON.stringify(this.brandConfig));
        }
        if (data.ownerAccount && typeof data.ownerAccount === 'object') {
          this.ownerAccount = data.ownerAccount;
          localStorage.setItem(STORAGE_KEY_OWNER_ACCOUNT, JSON.stringify(this.ownerAccount));
        }
        if (data.licenseData && typeof data.licenseData === 'object' && data.licenseData.isLicensed) {
          localStorage.setItem(STORAGE_KEY_LICENSE, JSON.stringify(data.licenseData));
        }

        this.applyBrandSettings();
        this.renderUserAccessHeader();
        this.checkLicenseGate();
        this.render();
        this.renderMasterCrewList();
        this.renderOwnerAdminList();
        this.renderLicenseStatus();

        this.showToast('Data berhasil dipulihkan! Seluruh acara dan kru kini tersinkronisasi.', 'success');
      } catch (err) {
        this.showToast('Gagal memulihkan data: Pastikan file cadangan .json valid.', 'error');
      } finally {
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      this.showToast('Gagal membaca file cadangan.', 'error');
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  handleFactoryReset() {
    const confirmed = confirm('PERINGATAN: Apakah Anda yakin ingin menghapus SEMUA data acara, daftar kru, admin, akun owner, dan konfigurasi brand di perangkat ini?\n\nAplikasi akan kembali kosong bersih seperti baru pertama kali diinstal.');
    if (!confirmed) return;

    const allKeys = [
      STORAGE_KEY_EVENTS,
      STORAGE_KEY_MASTER_CREW,
      STORAGE_KEY_OWNER_ACCOUNT,
      STORAGE_KEY_AUTH_SESSION,
      STORAGE_KEY_ADMIN_LIST,
      STORAGE_KEY_BRAND_CONFIG,
      STORAGE_KEY_LICENSE,
      'mahligai_h3_dismissed',
      'mahligai_wa_gateway_token'
    ];
    allKeys.forEach(k => {
      try { localStorage.removeItem(k); } catch (e) {}
    });
    try { sessionStorage.clear(); } catch (e) {}

    alert('Seluruh data berhasil dibersihkan! Halaman akan dimuat ulang dari kondisi awal yang bersih.');
    window.location.reload();
  }

  // ==================== PWA INSTALL & OFFLINE CAPABILITY ====================
  initPwaInstall() {
    // Cek apakah sudah terpasang di HP (Standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone && this.btnPwaInstall) {
      this.btnPwaInstall.style.display = 'none';
      return;
    }

    // Tangani Android Chrome install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPwaPrompt = e;
      if (this.btnPwaInstall) {
        this.btnPwaInstall.classList.remove('hidden');
        this.btnPwaInstall.style.display = 'inline-flex';
      }
    });

    // Tangani klik tombol Pasang di HP
    if (this.btnPwaInstall) {
      this.btnPwaInstall.addEventListener('click', () => {
        const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        if (this.deferredPwaPrompt) {
          // Native Android prompt
          this.deferredPwaPrompt.prompt();
          this.deferredPwaPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
              this.showToast('Aplikasi Mahligai WO berhasil dipasang di HP!', 'success');
              if (this.btnPwaInstall) this.btnPwaInstall.style.display = 'none';
            }
            this.deferredPwaPrompt = null;
          });
        } else {
          // Buka modal panduan instalasi (iPhone / manual Android)
          if (this.iosInstallModal) {
            this.iosInstallModal.classList.add('active');
          }
        }
      });
    }

    // Modal Panduan Tutup Handlers
    if (this.btnCloseIosInstallModal) {
      this.btnCloseIosInstallModal.addEventListener('click', () => {
        if (this.iosInstallModal) this.iosInstallModal.classList.remove('active');
      });
    }
    if (this.btnGotItIosInstall) {
      this.btnGotItIosInstall.addEventListener('click', () => {
        if (this.iosInstallModal) this.iosInstallModal.classList.remove('active');
      });
    }

    const btnCopyLink = document.getElementById('btnCopyPwaLinkModal');
    if (btnCopyLink) {
      btnCopyLink.addEventListener('click', () => {
        const url = 'https://ronyaliantara.github.io/wedding-app/';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(() => {
            this.showToast('📋 Tautan aplikasi berhasil disalin! Silakan buka di HP Anda.', 'success');
          }).catch(() => {
            this.copyToClipboard(url, '📋 Tautan aplikasi berhasil disalin! Silakan buka di HP Anda.');
          });
        } else {
          this.copyToClipboard(url, '📋 Tautan aplikasi berhasil disalin! Silakan buka di HP Anda.');
        }
      });
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Start Application & Register Service Worker
document.addEventListener('DOMContentLoaded', () => {
  window.app = new WeddingApp();

  // Daftarkan Service Worker untuk kapabilitas 100% Offline di iPhone & Android
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          reg.update(); // Force checking for sw.js updates every time page loads!
          console.log('Mahligai WO PWA Service Worker aktif: ', reg.scope);
        })
        .catch((err) => {
          console.log('SW registration note:', err);
        });
    });
  }

  if (window.location.hash.startsWith('#edit-')) {
    const eventId = window.location.hash.substring(6);
    const ev = window.app.events.find(x => x.id === eventId);
    if (ev) window.app.openEventModal(ev);
  } else if (window.location.hash.startsWith('#event-')) {
    const eventId = window.location.hash.substring(1);
    window.app.switchToDetail(eventId);
  } else if (window.location.hash === '#new') {
    window.app.openEventModal();
  }
});
