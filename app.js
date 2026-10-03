// ========================================================= //
// MY PLAN TRACKER - ZERO-KNOWLEDGE ENCRYPTED PWA
// AES-256-GCM Military-Grade Client-Side Encryption
// ========================================================= //

// --- Jalali (Persian) Calendar Utility ---
const JalaliDate = {
  gregorianToJalali(gy, gm, gd) {
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 621 : 1600;
    const gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * Math.floor(days / 12053);
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
      jy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }
    const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return { year: jy, month: jm, day: jd };
  },

  monthNames: [
    'فروردین', 'اردیبهشت', 'خرداد',
    'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر',
    'دی', 'بهمن', 'اسفند'
  ],

  daysInMonth(year, month) {
    if (month <= 6) return 31;
    if (month <= 11) return 30;
    return 29;
  },

  weekDayName(gy, gm, gd) {
    const days = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
    const d = new Date(gy, gm - 1, gd);
    return days[d.getDay()];
  }
};

// --- Web Crypto API: AES-256-GCM Zero-Knowledge Vault ---
const CryptoVault = {
  async deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  async encrypt(dataObj, password) {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(password, salt);
    const encoded = enc.encode(JSON.stringify(dataObj));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encoded
    );
    return {
      salt: btoa(String.fromCharCode(...salt)),
      iv: btoa(String.fromCharCode(...iv)),
      data: btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
    };
  },

  async decrypt(encryptedObj, password) {
    const salt = Uint8Array.from(atob(encryptedObj.salt), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(encryptedObj.iv), c => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(encryptedObj.data), c => c.charCodeAt(0));
    const key = await this.deriveKey(password, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      ciphertext
    );
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  }
};

// --- Main Application Object ---
const app = {
  currentTab: 'tabToday',
  activeMonth: 7, // مهر
  activeYear: 1405,
  currentDateOffset: 0, // 0 = TODAY ALWAYS! Shows today's real date dynamically
  selectedDateStr: '',
  enteredPin: '',
  defaultPin: '2580',
  currentPassword: '',
  
  // In-Memory Decrypted State (Wiped on Lock!)
  state: null,
  isLocked: true,

  // GitHub Cloud Sync
  githubRepo: 'pouria-maleki/my-plan-tracker',
  githubToken: localStorage.getItem('myplan_gh_token') || '',

  // Pomodoro Timer State
  pomodoroTimeLeft: 25 * 60,
  pomodoroTimerId: null,
  pomodoroRunning: false,

  // Default Habits Schema
  defaultHabits: [
    { id: 'h1', title: 'یادگیری و تقویت زبان تخصصی', icon: '🇬🇧', goal: 31 },
    { id: 'h2', title: 'یادگیری و شبیه‌سازی میکروگرید', icon: '⚡', goal: 31 },
    { id: 'h3', title: 'نگارش و ویرایش مقاله پژوهشی (ISI)', icon: '📝', goal: 31 },
    { id: 'h4', title: 'آموزش و تمرین روزانه نوازندگی سه تار', icon: '🪕', goal: 31 },
    { id: 'h5', title: 'مطالعه کتاب تخصصی و رشد فردی (۲۰ ص)', icon: '📚', goal: 31 },
    { id: 'h6', title: '۳۰ دقیقه ورزش و پیاده‌روی', icon: '🏃', goal: 20 },
    { id: 'h7', title: 'نوشیدن ۸ لیوان آب روزانه', icon: '💧', goal: 31 },
    { id: 'h8', title: 'خواب به موقع (قبل از ۱۲) و سحرخیزی', icon: '⏰', goal: 31 },
    { id: 'h9', title: 'کار عمیق و تمرکز (۴ پومودورو)', icon: '🎯', goal: 26 },
    { id: 'h10', title: 'یادداشت‌نویسی روزانه و شکرگزاری', icon: '🧘', goal: 31 },
    { id: 'h11', title: 'کدنویسی و توسعه مهارت‌های نرم‌افزاری', icon: '💻', goal: 25 },
    { id: 'h12', title: 'تغذیه سالم و کاهش قند مصنوعی', icon: '🥗', goal: 31 },
    { id: 'h13', title: '۱۰ دقیقه پیاده‌روی و استراحت چشم', icon: '🚶', goal: 31 },
    { id: 'h14', title: 'ساماندهی و نظم محیط کار', icon: '🧹', goal: 25 },
    { id: 'h15', title: 'آموختن یک نکته یا مهارت جدید', icon: '💡', goal: 31 }
  ],

  // Default Initial Tasks
  defaultTasks: [
    { id: 't1', title: 'بررسی نتایج شبیه‌سازی میکروگرید و تحلیل داده‌ها', time: '10:30', done: false },
    { id: 't2', title: 'ویرایش بخش متدولوژی و ارجاعات مقاله ISI', time: '15:00', done: false },
    { id: 't3', title: 'تمرین مضراب‌نوازی و کوک ساز سه تار', time: '19:30', done: false },
    { id: 't4', title: 'مرور لغات تخصصی و مکالمه زبان انگلیسی', time: '21:00', done: false }
  ],

  async init() {
    this.calcInitialDate();
    this.renderHeader();
    this.renderMonthPills();
    this.registerServiceWorker();

    // Check if encrypted vault exists
    const vaultStr = localStorage.getItem('myplan_encrypted_vault');
    if (!vaultStr) {
      // First run: Create encrypted vault with default password (2580)
      const initialState = {
        habits: this.defaultHabits,
        checks: {},
        water: {},
        tasks: {
          [this.selectedDateStr]: this.defaultTasks
        },
        journal: {}
      };
      const encrypted = await CryptoVault.encrypt(initialState, this.defaultPin);
      localStorage.setItem('myplan_encrypted_vault', JSON.stringify(encrypted));
    }

    // Always start locked
    this.lockApp();
  },

  calcInitialDate() {
    // Current Gregorian Date (Offset = 0 -> TODAY)
    const now = new Date();
    now.setDate(now.getDate() + this.currentDateOffset);
    
    const j = JalaliDate.gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const dayName = JalaliDate.weekDayName(now.getFullYear(), now.getMonth() + 1, now.getDate());
    
    this.activeYear = j.year;
    this.activeMonth = j.month;
    this.selectedDateStr = `${j.year}-${String(j.month).padStart(2, '0')}-${String(j.day).padStart(2, '0')}`;
    this.currentDayName = dayName;
    this.currentJalali = j;
  },

  // --- Lock Screen & Decryption ---
  enterPin(digit) {
    if (this.enteredPin.length < 8) {
      this.enteredPin += digit;
      this.updatePinDots();
      this.playTickAudio();

      if (this.enteredPin.length === 4) {
        setTimeout(() => this.attemptUnlock(this.enteredPin), 150);
      }
    }
  },

  deletePin() {
    if (this.enteredPin.length > 0) {
      this.enteredPin = this.enteredPin.slice(0, -1);
      this.updatePinDots();
    }
  },

  updatePinDots() {
    const dots = document.querySelectorAll('#pinDots .dot');
    dots.forEach((dot, index) => {
      if (index < this.enteredPin.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    });
  },

  async attemptUnlock(password) {
    const vaultStr = localStorage.getItem('myplan_encrypted_vault');
    if (!vaultStr) return;

    try {
      const encryptedVault = JSON.parse(vaultStr);
      let decrypted = null;

      try {
        decrypted = await CryptoVault.decrypt(encryptedVault, password);
      } catch (err) {
        // Legacy vault migration
        if (password === '2580') {
          try {
            decrypted = await CryptoVault.decrypt(encryptedVault, '1404');
            const reEncrypted = await CryptoVault.encrypt(decrypted, '2580');
            localStorage.setItem('myplan_encrypted_vault', JSON.stringify(reEncrypted));
          } catch (e2) {}
        }
      }

      if (!decrypted) {
        throw new Error('Invalid Password');
      }
      
      // Ensure tasks & journal structures exist
      if (!decrypted.tasks) decrypted.tasks = {};
      if (!decrypted.journal) decrypted.journal = {};

      // Decryption Succeeded!
      this.state = decrypted;
      this.currentPassword = password;
      this.isLocked = false;
      this.enteredPin = '';
      this.updatePinDots();

      document.getElementById('lockScreen').classList.add('hidden');
      this.showToast('ورود موفقیت‌آمیز بود ✨');

      // Render all views with decrypted memory state
      this.renderToday();
      this.renderCalendarHeatmap();
      this.renderStats();
      this.renderSettings();
      this.renderTasks();

      // Pull latest from GitHub cloud if configured!
      if (this.githubToken) {
        this.pullFromGitHub();
      }
    } catch (err) {
      const errEl = document.getElementById('lockError');
      errEl.textContent = 'رمز عبور اشتباه است';
      this.vibrate([100, 50, 100]);
      setTimeout(() => {
        this.enteredPin = '';
        this.updatePinDots();
        errEl.textContent = '';
      }, 700);
    }
  },

  async promptCustomPasswordUnlock() {
    const pass = prompt('رمز عبور را وارد کنید:');
    if (pass) {
      await this.attemptUnlock(pass);
    }
  },

  lockApp() {
    // Zero-Knowledge: Wipe decrypted state and password completely from memory!
    this.state = null;
    this.currentPassword = '';
    this.isLocked = true;
    this.enteredPin = '';
    this.updatePinDots();

    document.getElementById('lockScreen').classList.remove('hidden');
  },

  async saveState() {
    if (!this.state || !this.currentPassword) return;
    try {
      const encrypted = await CryptoVault.encrypt(this.state, this.currentPassword);
      localStorage.setItem('myplan_encrypted_vault', JSON.stringify(encrypted));
      
      // Auto Cloud Sync to GitHub if token is set
      if (this.githubToken) {
        this.pushToGitHub(encrypted);
      }
    } catch (e) {
      console.error('Encryption save error:', e);
    }
  },

  async pushToGitHub(encryptedVault) {
    if (!this.githubToken) return;
    try {
      const payloadStr = JSON.stringify(encryptedVault, null, 2);
      const b64Content = btoa(unescape(encodeURIComponent(payloadStr)));
      
      let sha = null;
      try {
        const getRes = await fetch(`https://api.github.com/repos/${this.githubRepo}/contents/data.enc`, {
          headers: {
            'Authorization': `Bearer ${this.githubToken}`,
            'Accept': 'application/vnd.github+json'
          }
        });
        if (getRes.ok) {
          const getJson = await getRes.json();
          sha = getJson.sha;
        }
      } catch (err) {}

      const putRes = await fetch(`https://api.github.com/repos/${this.githubRepo}/contents/data.enc`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.githubToken}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Update encrypted habits & tasks data [skip ci]',
          content: b64Content,
          sha: sha
        })
      });

      if (putRes.ok) {
        this.showToast('همگام‌سازی با گیت‌هاب انجام شد ☁️✅');
        this.updateSyncBadge(true);
      }
    } catch (err) {
      console.warn('GitHub Sync warning:', err);
    }
  },

  async pullFromGitHub() {
    if (!this.githubToken) return;
    try {
      const res = await fetch(`https://api.github.com/repos/${this.githubRepo}/contents/data.enc`, {
        headers: {
          'Authorization': `Bearer ${this.githubToken}`,
          'Accept': 'application/vnd.github+json'
        }
      });
      if (res.ok) {
        const json = await res.json();
        const rawCiphertext = decodeURIComponent(escape(atob(json.content)));
        const encryptedVault = JSON.parse(rawCiphertext);
        
        const decrypted = await CryptoVault.decrypt(encryptedVault, this.currentPassword);
        if (decrypted && decrypted.habits) {
          if (!decrypted.tasks) decrypted.tasks = {};
          if (!decrypted.journal) decrypted.journal = {};
          this.state = decrypted;
          localStorage.setItem('myplan_encrypted_vault', JSON.stringify(encryptedVault));
          this.renderToday();
          this.renderCalendarHeatmap();
          this.renderStats();
          this.renderTasks();
          this.showToast('اطلاعات جدید از گیت‌هاب دریافت شد ☁️');
          this.updateSyncBadge(true);
        }
      }
    } catch (err) {
      console.warn('Pull from GitHub warning:', err);
    }
  },

  setupGitHubSync() {
    const current = localStorage.getItem('myplan_gh_token') || '';
    const token = prompt('لطفاً توکن شخصی گیت‌هاب (Personal Access Token) خود را وارد کنید:\n(برای قطع اتصال، کادر را خالی بگذارید)', current);
    
    if (token !== null) {
      const cleanToken = token.trim();
      if (cleanToken) {
        this.githubToken = cleanToken;
        localStorage.setItem('myplan_gh_token', cleanToken);
        this.showToast('در حال تست اتصال به گیت‌هاب...');
        
        fetch(`https://api.github.com/repos/${this.githubRepo}`, {
          headers: { 'Authorization': `Bearer ${cleanToken}` }
        }).then(res => {
          if (res.ok) {
            this.showToast('اتصال به گیت‌هاب با موفقیت برقرار شد! ☁️🎉');
            this.updateSyncBadge(true);
            if (this.state && this.currentPassword) {
              this.saveState();
            }
          } else {
            alert('توکن معتبر نیست یا دسترسی repo ندارد. لطفاً توکن را بررسی کنید.');
          }
        }).catch(() => {
          alert('خطا در اتصال به اینترنت.');
        });
      } else {
        this.githubToken = '';
        localStorage.removeItem('myplan_gh_token');
        this.showToast('همگام‌سازی ابری غیرفعال شد.');
        this.updateSyncBadge(false);
      }
    }
  },

  showTokenGuide() {
    alert(
      'راهنمای ساخت توکن اختصاصی گیت‌هاب (۳۰ ثانیه):\n\n' +
      '۱. در گیت‌هاب وارد Settings > Developer Settings شوید.\n' +
      '۲. روی Personal access tokens > Tokens (classic) کلیک کنید.\n' +
      '۳. روی Generate new token (classic) کلیک کنید.\n' +
      '۴. یک نام دلخواه بگذارید (مثلاً MyPlan) و تیک گزینه repo را بزنید.\n' +
      '۵. در پایین صفحه دکمه سبز Generate token را بزنید.\n' +
      '۶. توکن ساخته‌شده (شروع با ghp_...) را کپی کرده و در این کادر قرار دهید.\n\n' +
      'از این پس تمام تیک‌های شما روی گیت‌هاب در فایلی رمزنگاری‌شده (data.enc) خودکار ذخیره می‌شود!'
    );
  },

  updateSyncBadge(isActive) {
    const el = document.getElementById('ghSyncStatus');
    if (el) {
      el.textContent = isActive ? 'وضعیت: متصل و همگام با گیت‌هاب ☁️' : 'وضعیت: ذخیره محلی (آفلاین)';
      el.style.color = isActive ? '#10B981' : '';
    }
  },

  async promptChangePassword() {
    const oldPass = prompt('لطفاً رمز فعلی خود را وارد کنید:');
    if (oldPass !== this.currentPassword) {
      alert('رمز فعلی اشتباه است.');
      return;
    }

    const newPass = prompt('رمز جدید دلخواه را وارد کنید:');
    if (!newPass || newPass.trim().length < 4) {
      alert('رمز باید حداقل ۴ کاراکتر باشد.');
      return;
    }

    try {
      this.currentPassword = newPass.trim();
      await this.saveState();
      this.showToast('رمز با موفقیت تغییر کرد و تمام دیتا دوباره رمزنگاری شد 🔐');
    } catch (e) {
      alert('خطا در تغییر رمز.');
    }
  },

  // --- Audio Feedback ---
  playTickAudio() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {}
  },

  playSuccessAudio() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.06);
        osc.stop(ctx.currentTime + i * 0.06 + 0.15);
      });
    } catch (e) {}
  },

  vibrate(pattern = 30) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  },

  // --- Rendering UI ---
  renderHeader() {
    const formatted = `${this.currentDayName}، ${this.currentJalali.day} ${JalaliDate.monthNames[this.activeMonth - 1]} ${this.activeYear}`;
    document.getElementById('headerDate').textContent = formatted;
  },

  renderToday() {
    if (!this.state) return;
    const title = `${this.currentDayName}، ${this.currentJalali.day} ${JalaliDate.monthNames[this.activeMonth - 1]} ${this.activeYear}`;
    document.getElementById('todayDateTitle').textContent = title;
    
    const sub = (this.currentDateOffset === 0) ? 'امروز - ثبت عملکرد روزانه' : (this.currentDateOffset === 1 ? 'فردا - برنامه‌ریزی روز بعد' : (this.currentDateOffset === -1 ? 'دیروز - مرور عملکرد' : 'پایش روزانه'));
    document.getElementById('todayDateSub').textContent = sub;

    const list = document.getElementById('todayHabitsList');
    list.innerHTML = '';

    const dayChecks = this.state.checks[this.selectedDateStr] || {};
    let doneCount = 0;

    this.state.habits.forEach(habit => {
      const isChecked = !!dayChecks[habit.id];
      if (isChecked) doneCount++;

      const streak = this.calcStreak(habit.id);

      const card = document.createElement('div');
      card.className = `habit-card ${isChecked ? 'checked' : ''}`;
      card.onclick = () => this.toggleHabit(habit.id);

      card.innerHTML = `
        <div class="habit-info-side">
          <div class="habit-icon">${habit.icon || '📌'}</div>
          <div class="habit-text-wrap">
            <span class="habit-name">${habit.title}</span>
            <span class="habit-streak">🔥 ${streak} روز استمرار</span>
          </div>
        </div>
        <div class="habit-check-box">
          ${isChecked ? '✓' : ''}
        </div>
      `;
      list.appendChild(card);
    });

    const total = this.state.habits.length;
    const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
    
    document.getElementById('todayProgressText').textContent = `${pct}٪ (${doneCount} از ${total})`;
    document.getElementById('todayProgressBar').style.width = `${pct}%`;
    document.getElementById('completedBadge').textContent = `${doneCount} تکمیل شده`;

    const quotes = [
      'شروع از قدم‌های کوچک آغاز بزرگترین دستاوردهاست ✨',
      'پایداری رمز موفقیت است؛ استمرار امروز آینده‌ات را می‌سازد! 🚀',
      'فوق‌العاده پیش رفتی! انضباط یعنی پیروزی بر اهمال‌کاری 🌟',
      'عالی بود! تمام عادات امروز تکمیل شد 🏆'
    ];
    document.getElementById('todayMotivation').textContent = pct === 100 ? quotes[3] : (pct >= 50 ? quotes[2] : quotes[1]);

    this.renderWater();
    this.renderTasks();
    this.renderJournal();
  },

  // --- DAILY TASKS & TO-DO (With Strikethrough & Time Picker) ---
  renderTasks() {
    if (!this.state) return;
    const list = document.getElementById('todayTasksList');
    if (!list) return;
    list.innerHTML = '';

    const dayTasks = this.state.tasks[this.selectedDateStr] || [];
    const doneCount = dayTasks.filter(t => t.done).length;

    const badge = document.getElementById('tasksBadge');
    if (badge) {
      badge.textContent = `${doneCount} از ${dayTasks.length} انجام شد`;
    }

    if (dayTasks.length === 0) {
      list.innerHTML = `
        <div class="empty-tasks-placeholder">
          <span>کاری برای این روز ثبت نشده است. روی «+ کار جدید» بزنید.</span>
        </div>
      `;
      return;
    }

    dayTasks.forEach(task => {
      const card = document.createElement('div');
      card.className = `task-card ${task.done ? 'task-done' : ''}`;

      card.innerHTML = `
        <div class="task-left" onclick="app.toggleTask('${task.id}')">
          <div class="task-checkbox ${task.done ? 'checked' : ''}">
            ${task.done ? '✓' : ''}
          </div>
          <span class="task-title ${task.done ? 'completed-text' : ''}">${task.title}</span>
        </div>
        <div class="task-right">
          <button class="task-time-badge" onclick="event.stopPropagation(); app.promptEditTaskTime('${task.id}')" title="تغییر ساعت">
            ⏰ ${task.time || 'تعیین ساعت'}
          </button>
          <button class="task-action-btn delete" onclick="event.stopPropagation(); app.deleteTask('${task.id}')" title="حذف">
            ✕
          </button>
        </div>
      `;
      list.appendChild(card);
    });
  },

  async promptAddTask() {
    if (!this.state) return;
    const title = prompt('عنوان کار یا برنامه جدید را وارد کنید:');
    if (!title || !title.trim()) return;

    const time = prompt('ساعت انجام کار را وارد کنید (مثلاً ۱۶:۳۰ یا صبح):', '16:00') || '';

    if (!this.state.tasks[this.selectedDateStr]) {
      this.state.tasks[this.selectedDateStr] = [];
    }

    this.state.tasks[this.selectedDateStr].push({
      id: 't_' + Date.now(),
      title: title.trim(),
      time: time.trim(),
      done: false
    });

    await this.saveState();
    this.playTickAudio();
    this.renderTasks();
    this.showToast('کار جدید به لیست اضافه شد 📋');
  },

  async toggleTask(taskId) {
    if (!this.state) return;
    const dayTasks = this.state.tasks[this.selectedDateStr] || [];
    const task = dayTasks.find(t => t.id === taskId);
    if (!task) return;

    task.done = !task.done;
    await this.saveState();
    this.vibrate(35);

    if (task.done) {
      this.playSuccessAudio();
    } else {
      this.playTickAudio();
    }

    this.renderTasks();
  },

  async promptEditTaskTime(taskId) {
    if (!this.state) return;
    const dayTasks = this.state.tasks[this.selectedDateStr] || [];
    const task = dayTasks.find(t => t.id === taskId);
    if (!task) return;

    const newTime = prompt(`ساعت جدید برای «${task.title}»:`, task.time || '18:00');
    if (newTime !== null) {
      task.time = newTime.trim();
      await this.saveState();
      this.renderTasks();
      this.showToast('ساعت با موفقیت تغییر کرد ⏰');
    }
  },

  async deleteTask(taskId) {
    if (!this.state) return;
    const dayTasks = this.state.tasks[this.selectedDateStr] || [];
    this.state.tasks[this.selectedDateStr] = dayTasks.filter(t => t.id !== taskId);
    await this.saveState();
    this.renderTasks();
    this.showToast('کار حذف شد');
  },

  // --- DAILY JOURNAL ---
  renderJournal() {
    if (!this.state) return;
    const el = document.getElementById('journalInput');
    if (el) {
      el.value = this.state.journal[this.selectedDateStr] || '';
    }
  },

  async saveJournalNote() {
    if (!this.state) return;
    const el = document.getElementById('journalInput');
    if (!el) return;
    this.state.journal[this.selectedDateStr] = el.value.trim();
    await this.saveState();
    this.showToast('یادداشت روزانه ذخیره شد 📝');
  },

  // --- POMODORO TIMER ---
  togglePomodoro() {
    if (this.pomodoroRunning) {
      this.pausePomodoro();
    } else {
      this.startPomodoro();
    }
  },

  startPomodoro() {
    this.pomodoroRunning = true;
    document.getElementById('pomodoroBtn').textContent = 'توقف ⏸️';
    this.pomodoroTimerId = setInterval(() => {
      if (this.pomodoroTimeLeft > 0) {
        this.pomodoroTimeLeft--;
        this.updatePomodoroDisplay();
      } else {
        this.pausePomodoro();
        this.playSuccessAudio();
        alert('🎉 پومودورو ۲۵ دقیقه‌ای با موفقیت تکمیل شد! ۵ دقیقه استراحت کنید.');
        this.resetPomodoro();
      }
    }, 1000);
  },

  pausePomodoro() {
    this.pomodoroRunning = false;
    clearInterval(this.pomodoroTimerId);
    document.getElementById('pomodoroBtn').textContent = 'شروع تمرکز ▶️';
  },

  resetPomodoro() {
    this.pausePomodoro();
    this.pomodoroTimeLeft = 25 * 60;
    this.updatePomodoroDisplay();
  },

  updatePomodoroDisplay() {
    const mins = Math.floor(this.pomodoroTimeLeft / 60);
    const secs = this.pomodoroTimeLeft % 60;
    const text = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const el = document.getElementById('pomodoroDisplay');
    if (el) el.textContent = text;
  },

  // --- Water Tracker ---
  renderWater() {
    if (!this.state) return;
    const grid = document.getElementById('glassesGrid');
    grid.innerHTML = '';
    const currentGlasses = this.state.water[this.selectedDateStr] || 0;
    document.getElementById('waterCountText').textContent = `${currentGlasses} / ۸`;

    for (let i = 1; i <= 8; i++) {
      const isFilled = i <= currentGlasses;
      const glass = document.createElement('div');
      glass.className = `glass-item ${isFilled ? 'filled' : ''}`;
      glass.textContent = `${i} 💧`;
      glass.onclick = () => this.setWaterGlasses(i === currentGlasses ? i - 1 : i);
      grid.appendChild(glass);
    }
  },

  async setWaterGlasses(count) {
    if (!this.state) return;
    this.state.water[this.selectedDateStr] = count;
    await this.saveState();
    this.playTickAudio();
    this.renderWater();
  },

  async toggleHabit(habitId) {
    if (!this.state) return;
    if (!this.state.checks[this.selectedDateStr]) {
      this.state.checks[this.selectedDateStr] = {};
    }

    const currentState = !!this.state.checks[this.selectedDateStr][habitId];
    this.state.checks[this.selectedDateStr][habitId] = !currentState;
    
    await this.saveState();
    this.vibrate(40);

    if (!currentState) {
      this.playSuccessAudio();
    } else {
      this.playTickAudio();
    }

    this.renderToday();
    this.renderCalendarHeatmap();
    this.renderStats();
  },

  nextDay() {
    this.currentDateOffset++;
    this.calcInitialDate();
    this.renderHeader();
    this.renderToday();
  },

  prevDay() {
    this.currentDateOffset--;
    this.calcInitialDate();
    this.renderHeader();
    this.renderToday();
  },

  // --- Calendar Heatmap Tab ---
  renderMonthPills() {
    const slider = document.getElementById('monthPillSlider');
    slider.innerHTML = '';
    JalaliDate.monthNames.forEach((name, i) => {
      const mNum = i + 1;
      const pill = document.createElement('button');
      pill.className = `month-pill ${mNum === this.activeMonth ? 'active' : ''}`;
      pill.textContent = name;
      pill.onclick = () => {
        this.activeMonth = mNum;
        this.renderMonthPills();
        this.renderCalendarHeatmap();
      };
      slider.appendChild(pill);
    });
  },

  renderCalendarHeatmap() {
    if (!this.state) return;
    const table = document.getElementById('heatmapTable');
    table.innerHTML = '';

    const daysCount = JalaliDate.daysInMonth(this.activeYear, this.activeMonth);

    let thead = '<thead><tr><th class="habit-col-th">عادات روزانه</th>';
    for (let d = 1; d <= 31; d++) {
      if (d <= daysCount) {
        thead += `<th>${d}</th>`;
      } else {
        thead += `<th style="opacity:0.3">-</th>`;
      }
    }
    thead += '</tr></thead>';

    let tbody = '<tbody>';
    let monthTotalDone = 0;

    this.state.habits.forEach(habit => {
      tbody += `<tr><td class="habit-col-td">${habit.icon || '📌'} ${habit.title}</td>`;
      for (let d = 1; d <= 31; d++) {
        const dStr = `${this.activeYear}-${String(this.activeMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (d <= daysCount) {
          const isChecked = !!(this.state.checks[dStr] && this.state.checks[dStr][habit.id]);
          if (isChecked) monthTotalDone++;

          let weekClass = 'w1';
          if (d > 7 && d <= 14) weekClass = 'w2';
          else if (d > 14 && d <= 21) weekClass = 'w3';
          else if (d > 21 && d <= 28) weekClass = 'w4';
          else if (d > 28) weekClass = 'w5';

          tbody += `<td class="cal-cell ${isChecked ? 'checked-' + weekClass : ''}" onclick="app.toggleGridCell('${dStr}', '${habit.id}')">${isChecked ? '✓' : ''}</td>`;
        } else {
          tbody += `<td class="cal-cell disabled">-</td>`;
        }
      }
      tbody += '</tr>';
    });
    tbody += '</tbody>';

    table.innerHTML = thead + tbody;

    const totalPossible = this.state.habits.length * daysCount;
    const pct = totalPossible > 0 ? ((monthTotalDone / totalPossible) * 100).toFixed(1) : 0;
    document.getElementById('monthTotalDone').textContent = monthTotalDone;
    document.getElementById('monthTotalPct').textContent = `${pct}٪`;
    document.getElementById('monthBestStreak').textContent = `${this.calcBestStreakOverall()} روز`;
  },

  async toggleGridCell(dateStr, habitId) {
    if (!this.state) return;
    if (!this.state.checks[dateStr]) this.state.checks[dateStr] = {};
    this.state.checks[dateStr][habitId] = !this.state.checks[dateStr][habitId];
    await this.saveState();
    this.playTickAudio();
    this.renderCalendarHeatmap();
    this.renderToday();
    this.renderStats();
  },

  // --- Streak Calculation ---
  calcStreak(habitId) {
    if (!this.state) return 0;
    let streak = 0;
    const now = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const j = JalaliDate.gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
      const dStr = `${j.year}-${String(j.month).padStart(2, '0')}-${String(j.day).padStart(2, '0')}`;
      if (this.state.checks[dStr] && this.state.checks[dStr][habitId]) {
        streak++;
      } else {
        if (i === 0) continue;
        break;
      }
    }
    return streak;
  },

  calcBestStreakOverall() {
    if (!this.state) return 0;
    let best = 0;
    this.state.habits.forEach(h => {
      const s = this.calcStreak(h.id);
      if (s > best) best = s;
    });
    return Math.max(best, 4);
  },

  // --- Stats Tab ---
  renderStats() {
    if (!this.state) return;
    let totalChecks = 0;
    Object.values(this.state.checks).forEach(day => {
      totalChecks += Object.values(day).filter(Boolean).length;
    });

    document.getElementById('statTotalChecks').textContent = `${totalChecks} بار`;
    document.getElementById('statCurrentStreak').textContent = `${this.calcStreak(this.state.habits[0]?.id || '')} روز`;
    
    const annualDays = 365;
    const totalAnnualCapacity = this.state.habits.length * annualDays;
    const annualPct = totalAnnualCapacity > 0 ? ((totalChecks / totalAnnualCapacity) * 100).toFixed(1) : 0;
    document.getElementById('statAnnualPct').textContent = `${annualPct}٪`;

    this.renderDailyTrendChart();
    this.renderWeeklyBars();
  },

  renderDailyTrendChart() {
    const svg = document.getElementById('dailyTrendSvg');
    svg.innerHTML = '';
    const points = [];
    const daysCount = JalaliDate.daysInMonth(this.activeYear, this.activeMonth);

    for (let d = 1; d <= daysCount; d++) {
      const dStr = `${this.activeYear}-${String(this.activeMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayChecks = this.state.checks[dStr] || {};
      const done = Object.values(dayChecks).filter(Boolean).length;
      const pct = this.state.habits.length > 0 ? done / this.state.habits.length : 0;
      
      const x = (d / daysCount) * 480 + 10;
      const y = 140 - (pct * 110);
      points.push(`${x},${y}`);
    }

    if (points.length > 0) {
      const firstX = points[0].split(',')[0];
      const lastX = points[points.length - 1].split(',')[0];
      const polygonPoints = `${firstX},150 ` + points.join(' ') + ` ${lastX},150`;

      svg.innerHTML = `
        <defs>
          <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#3B82F6" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        <polygon points="${polygonPoints}" fill="url(#areaGrad)"/>
        <polyline fill="none" stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round" points="${points.join(' ')}"/>
      `;
    }
  },

  renderWeeklyBars() {
    const grid = document.getElementById('weeklyBarsGrid');
    grid.innerHTML = '';

    const weeks = [
      { name: 'هفته اول (۱ تا ۷)', start: 1, end: 7, color: '#3B82F6' },
      { name: 'هفته دوم (۸ تا ۱۴)', start: 8, end: 14, color: '#10B981' },
      { name: 'هفته سوم (۱۵ تا ۲۱)', start: 15, end: 21, color: '#EC4899' },
      { name: 'هفته چهارم (۲۲ تا ۲۸)', start: 22, end: 28, color: '#F59E0B' },
      { name: 'هفته پنجم (۲۹ تا پایان)', start: 29, end: JalaliDate.daysInMonth(this.activeYear, this.activeMonth), color: '#8B5CF6' }
    ];

    weeks.forEach(w => {
      let count = 0;
      let capacity = (w.end - w.start + 1) * this.state.habits.length;
      for (let d = w.start; d <= w.end; d++) {
        const dStr = `${this.activeYear}-${String(this.activeMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (this.state.checks[dStr]) {
          count += Object.values(this.state.checks[dStr]).filter(Boolean).length;
        }
      }

      const pct = capacity > 0 ? Math.round((count / capacity) * 100) : 0;

      const row = document.createElement('div');
      row.className = 'bar-row';
      row.innerHTML = `
        <span class="bar-lbl">${w.name.split(' ')[0]} ${w.name.split(' ')[1]}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%; background: ${w.color};"></div>
        </div>
        <span class="bar-pct" style="color: ${w.color};">${pct}٪</span>
      `;
      grid.appendChild(row);
    });
  },

  // --- Settings & Habits Management ---
  renderSettings() {
    if (!this.state) return;
    const list = document.getElementById('settingsHabitsList');
    list.innerHTML = '';
    this.state.habits.forEach((h, index) => {
      const item = document.createElement('div');
      item.className = 'setting-habit-item';
      item.innerHTML = `
        <span>${h.icon || '📌'} ${h.title}</span>
        <button class="btn btn-sm btn-danger" onclick="app.removeHabit(${index})">حذف</button>
      `;
      list.appendChild(item);
    });
  },

  async promptAddHabit() {
    if (!this.state) return;
    const title = prompt('نام عادت یا هدف جدید را وارد کنید:');
    if (title && title.trim()) {
      const icon = prompt('آیکون یا ایموجی (مثلاً 📖 یا 🎸):') || '✨';
      this.state.habits.push({
        id: 'h_' + Date.now(),
        title: title.trim(),
        icon: icon.trim(),
        goal: 31
      });
      await this.saveState();
      this.renderToday();
      this.renderCalendarHeatmap();
      this.renderSettings();
      this.showToast('عادت جدید اضافه شد ✅');
    }
  },

  async removeHabit(index) {
    if (!this.state) return;
    if (confirm(`آیا از حذف عادت «${this.state.habits[index].title}» مطمئن هستید؟`)) {
      this.state.habits.splice(index, 1);
      await this.saveState();
      this.renderToday();
      this.renderCalendarHeatmap();
      this.renderSettings();
      this.showToast('عادت حذف شد');
    }
  },

  // --- Backup & Export ---
  exportBackup() {
    if (!this.state) return;
    const vaultStr = localStorage.getItem('myplan_encrypted_vault');
    const blob = new Blob([vaultStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-plan-encrypted-backup-${this.activeYear}.vault`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('فایل بکاپ رمزنگاری‌شده ذخیره شد 🔐');
  },

  importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        JSON.parse(text);
        localStorage.setItem('myplan_encrypted_vault', text);
        this.showToast('فایل بارگذاری شد؛ لطفاً قفل را باز کنید.');
        this.lockApp();
      } catch (err) {
        alert('فایل بکاپ نامعتبر است.');
      }
    };
    reader.readAsText(file);
  },

  exportCsv() {
    if (!this.state) return;
    let csv = 'عادت,روز,تیک\n';
    Object.entries(this.state.checks).forEach(([date, dayHabits]) => {
      Object.entries(dayHabits).forEach(([hId, isChecked]) => {
        const h = this.state.habits.find(x => x.id === hId);
        csv += `"${h ? h.title : hId}","${date}","${isChecked ? 1 : 0}"\n`;
      });
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-plan-export.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('خروجی اکسل ذخیره شد 📊');
  },

  async resetAllData() {
    if (confirm('هشدار: آیا می‌خواهید تمام تیک‌ها و پیشرفت‌های ثبت‌شده پاک شوند؟')) {
      if (this.state) {
        this.state.checks = {};
        this.state.water = {};
        this.state.tasks = {};
        this.state.journal = {};
        await this.saveState();
        this.renderToday();
        this.renderCalendarHeatmap();
        this.renderStats();
        this.showToast('اطلاعات با موفقیت پاکسازی شد');
      }
    }
  },

  // --- Theme Toggle ---
  toggleTheme() {
    const isLight = document.body.classList.toggle('light-mode');
    document.getElementById('themeBtn').textContent = isLight ? '☀️' : '🌙';
  },

  // --- Tab Navigation ---
  switchTab(tabId) {
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    document.getElementById(tabId).classList.add('active');
    
    if (tabId === 'tabToday') document.getElementById('navToday').classList.add('active');
    if (tabId === 'tabCalendar') {
      document.getElementById('navCalendar').classList.add('active');
      this.renderCalendarHeatmap();
    }
    if (tabId === 'tabStats') {
      document.getElementById('navStats').classList.add('active');
      this.renderStats();
    }
    if (tabId === 'tabSettings') document.getElementById('navSettings').classList.add('active');
  },

  showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
