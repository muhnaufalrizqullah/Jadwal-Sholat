// script.js (ganti seluruh file dengan ini)
document.addEventListener('DOMContentLoaded', () => {
    /* ======================
       Helper - safe query
       ====================== */
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  
    /* ======================
       DOM elements (optional checks)
       ====================== */
    const locationDisplay = $('#lokasi');
    const dateDisplay = $('#tanggal-hari-ini');
    const clockDisplay = $('#live-clock');
  
    const prayerTimeElements = {
      subuh: $('#subuh'),
      dzuhur: $('#dzuhur'),
      ashar: $('#ashar'),
      maghrib: $('#maghrib'),
      isya: $('#isya'),
    };
  
    const nextPrayerNameEl = $('#next-prayer-name');
    const countdownTimerEl = $('#countdown-timer');
  
    const searchInput = $('#search-input');
    const searchButton = $('#search-button');
    const detectLocationButton = $('#detect-location-button');
    const searchResultsContainer = $('#search-results');
  
    const prayerCards = $$('.card');
  
    const navLinksContainer = $('#nav-links');
    const hamburger = $('#hamburger');
  
    const toggleBtn = $('#toggle-btn'); // article toggle button
    const articleFull = $('#article-full'); // article full content
  
    /* ======================
       Config
       ====================== */
    const KEMENAG_API_BASE_URL = 'https://api.myquran.com/v2';
    let countdownInterval = null;
  
    /* ======================
       Live clock & date
       ====================== */
    function startLiveClock() {
      if (!clockDisplay) return;
      function update() {
        const now = new Date();
        clockDisplay.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
      update();
      setInterval(update, 1000);
    }
  
    function displayCurrentDate() {
      if (!dateDisplay) return;
      const now = new Date();
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      dateDisplay.textContent = now.toLocaleDateString('id-ID', options);
    }
  
    /* ======================
       Update UI prayer times
       ====================== */
    function updateUIPrayerTimes(prayerData, cityName) {
      if (locationDisplay) locationDisplay.textContent = cityName || 'Lokasi';
      if (prayerTimeElements.subuh) prayerTimeElements.subuh.textContent = prayerData.subuh || '--:--';
      if (prayerTimeElements.dzuhur) prayerTimeElements.dzuhur.textContent = prayerData.dzuhur || '--:--';
      if (prayerTimeElements.ashar) prayerTimeElements.ashar.textContent = prayerData.ashar || '--:--';
      if (prayerTimeElements.maghrib) prayerTimeElements.maghrib.textContent = prayerData.maghrib || '--:--';
      if (prayerTimeElements.isya) prayerTimeElements.isya.textContent = prayerData.isya || '--:--';
    }
  
    /* ======================
       Fetch prayer times
       ====================== */
    async function getPrayerTimes(cityId, cityName) {
      try {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
  
        const res = await fetch(`${KEMENAG_API_BASE_URL}/sholat/jadwal/${cityId}/${year}/${month}/${day}`);
        if (!res.ok) throw new Error('Network error');
        const json = await res.json();
  
        if (json.status && json.data && json.data.jadwal) {
          const prayerData = json.data.jadwal;
          updateUIPrayerTimes(prayerData, cityName || json.data.lokasi || 'Lokasi');
          startCountdown(prayerData);
        } else {
          throw new Error('Data format not valid');
        }
      } catch (err) {
        console.error('getPrayerTimes error:', err);
        if (locationDisplay) locationDisplay.textContent = 'Gagal Memuat';
        // fallback to Jakarta (id 1301) silently
        if (cityId !== '1301') {
          try { await getPrayerTimes('1301', 'Kota Jakarta'); } catch(e){/*ignore*/ }
        }
      }
    }
  
    /* ======================
       Countdown logic
       ====================== */
    function startCountdown(prayerData) {
      if (!countdownTimerEl || !nextPrayerNameEl) return;
      if (countdownInterval) clearInterval(countdownInterval);
  
      const schedule = [
        { name: 'Subuh', time: prayerData.subuh },
        { name: 'Dzuhur', time: prayerData.dzuhur },
        { name: 'Ashar', time: prayerData.ashar },
        { name: 'Maghrib', time: prayerData.maghrib },
        { name: 'Isya', time: prayerData.isya },
      ];
  
      function computeNext() {
        const now = new Date();
        let next = null;
        for (const p of schedule) {
          if (!p.time) continue;
          const [hh, mm] = p.time.split(':').map(n => parseInt(n, 10));
          const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);
          if (t > now) { next = { name: p.name, time: t }; break; }
        }
        if (!next) {
          // tomorrow first prayer
          const [hh, mm] = (schedule[0].time || '00:00').split(':').map(n => parseInt(n, 10));
          const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hh, mm);
          next = { name: schedule[0].name, time: t };
        }
        return next;
      }
  
      function tick() {
        const next = computeNext();
        const now = new Date();
        const diff = next.time - now;
        const hrs = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        nextPrayerNameEl.textContent = next.name;
        countdownTimerEl.textContent = `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  
        // highlight card
        prayerCards.forEach(card => {
          if (card.getAttribute('data-prayer') === next.name) card.classList.add('next-prayer-highlight');
          else card.classList.remove('next-prayer-highlight');
        });
      }
  
      tick();
      countdownInterval = setInterval(tick, 1000);
    }
  
    /* ======================
       Search city
       ====================== */
    async function searchCity() {
      if (!searchInput) return;
      const q = searchInput.value.trim();
      if (q.length < 3) {
        alert('Masukkan minimal 3 karakter untuk mencari kota.');
        return;
      }
      try {
        const res = await fetch(`${KEMENAG_API_BASE_URL}/sholat/kota/cari/${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error('Fetch failed');
        const json = await res.json();
        displaySearchResults(json.data || []);
      } catch (err) {
        console.error('searchCity error:', err);
        alert('Gagal mencari kota. Periksa koneksi Anda.');
      }
    }
  
    function displaySearchResults(cities) {
      if (!searchResultsContainer) return;
      searchResultsContainer.innerHTML = '';
      if (!cities || cities.length === 0) {
        searchResultsContainer.innerHTML = '<p class="result-item">Kota tidak ditemukan.</p>';
        return;
      }
      cities.forEach(city => {
        const div = document.createElement('div');
        div.className = 'result-item';
        div.textContent = city.lokasi;
        div.addEventListener('click', () => {
          getPrayerTimes(city.id, city.lokasi);
          searchResultsContainer.innerHTML = '';
          if (searchInput) searchInput.value = '';
        });
        searchResultsContainer.appendChild(div);
      });
    }
  
    /* ======================
       Geolocation -> reverse -> search
       ====================== */
    function useCurrentLocation() {
      if (!navigator.geolocation) {
        alert('Browser tidak mendukung lokasi, menampilkan Jakarta.');
        return getPrayerTimes('1301', 'Kota Jakarta');
      }
      if (locationDisplay) locationDisplay.textContent = 'Mendeteksi lokasi...';
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const nomRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const nomJson = await nomRes.json();
          const cityRaw = (nomJson.address && (nomJson.address.city || nomJson.address.town || nomJson.address.village || nomJson.address.county || nomJson.address.state)) || '';
          const searchKey = cityRaw.split(' ')[0] || cityRaw || '';
          if (!searchKey) return getPrayerTimes('1301', 'Kota Jakarta');
          const searchRes = await fetch(`${KEMENAG_API_BASE_URL}/sholat/kota/cari/${encodeURIComponent(searchKey)}`);
          const searchJson = await searchRes.json();
          if (searchJson.data && searchJson.data.length > 0) {
            const id = searchJson.data[0].id;
            const name = searchJson.data[0].lokasi;
            return getPrayerTimes(id, name);
          } else {
            alert('Tidak dapat menemukan kota Anda, menampilkan jadwal untuk Jakarta.');
            return getPrayerTimes('1301', 'Kota Jakarta');
          }
        } catch (err) {
          console.error('useCurrentLocation error:', err);
          return getPrayerTimes('1301', 'Kota Jakarta');
        }
      }, (err) => {
        console.error('geolocation error:', err);
        alert('Gagal mengakses lokasi, menampilkan jadwal untuk Jakarta.');
        getPrayerTimes('1301', 'Kota Jakarta');
      }, { timeout: 10000 });
    }
  
    /* ======================
       Article toggle (short text stays, full appear below)
       ====================== */
  function toggleArticle() {
    const shortText = document.querySelector('.article-desc');
    const fullText = document.querySelector('#article-full');
    const btn = document.querySelector('.read-more-btn');
  
    if (fullText.style.display === 'block') {
      fullText.style.display = 'none';
      shortText.style.display = 'block';
      btn.textContent = 'Baca Selengkapnya';
    } else {
      fullText.style.display = 'block';
      shortText.style.display = 'none';
      btn.textContent = 'Tampilkan Lebih Sedikit';
    }
  }
    // expose toggleArticle to global because HTML onclick may call it
    window.toggleArticle = toggleArticle;
  
    /* ======================
       NAVBAR smooth scroll & hamburger
       ====================== */
    // smooth scroll for internal anchors
    $$('nav a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const href = link.getAttribute('href');
        const id = href && href.startsWith('#') ? href.slice(1) : null;
        if (!id) return;
        const target = document.getElementById(id);
        if (!target) return;
        const headerOffset = 90; // adjust if header height different
        const top = target.getBoundingClientRect().top + window.pageYOffset - headerOffset;
        window.scrollTo({ top, behavior: 'smooth' });
        // close mobile nav
        if (navLinksContainer) navLinksContainer.classList.remove('active');
        if (hamburger) hamburger.classList.remove('open');
      });
    });
  
    if (hamburger && navLinksContainer) {
      hamburger.addEventListener('click', () => {
        navLinksContainer.classList.toggle('active');
        hamburger.classList.toggle('open');
      });
    }
  
    /* ======================
       Event listeners for search / location / buttons (safe)
       ====================== */
    if (searchButton) searchButton.addEventListener('click', searchCity);
    if (searchInput) searchInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') searchCity(); });
    if (detectLocationButton) detectLocationButton.addEventListener('click', useCurrentLocation);
  
    // If there are cards that when clicked should center/scroll to their content (optional)
    prayerCards.forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-prayer');
        // optional behavior: scroll to next-prayer-info
        const next = $('#next-prayer-info');
        if (next) next.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  
    /* ======================
       Init app
       ====================== */
    startLiveClock();
    displayCurrentDate();
    // start with Jakarta until location resolves
    getPrayerTimes('1301', 'Kota Jakarta').catch(()=>{/*ignore*/});
    // attempt to get user's location (non-blocking)
    // call geolocation after a small delay so UI feels snappy
    setTimeout(() => {
      useCurrentLocation();
    }, 800);
  
  }); // end DOMContentLoaded
  