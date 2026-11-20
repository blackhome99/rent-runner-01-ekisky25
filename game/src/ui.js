// RENT RUNNER — ui.js: HUD, minimap (streets + districts + compass needle + bold N),
// menus, dialogue, job board, shop, toasts. All DOM, no external assets.
import { T, DISTRICT_LABEL } from './i18n.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(game) {
    this.game = game;
    this.mm = $('minimap').getContext('2d');
    this.toastTimer = null;
    this.slots = [1, 2, 3];
    this.selectedSlot = 1;
    this.bindMenu();
  }
  bindMenu() {
    document.querySelectorAll('.slot-card').forEach((el) => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.slot-card').forEach((s) => s.classList.remove('selected'));
        el.classList.add('selected');
        this.selectedSlot = Number(el.dataset.slot);
        this.game.audio.ensure(); this.game.audio.click();
      });
    });
    document.querySelector('.slot-card').classList.add('selected');
  }
  refreshSlots() {
    document.querySelectorAll('.slot-card').forEach((el) => {
      const slot = Number(el.dataset.slot);
      const save = this.game.loadSlot(slot);
      el.querySelector('.slot-info').textContent = save
        ? `Day ${save.day} · $${save.cash} · Job ${Math.min(save.jobIndex + 1, 8)}/8 · ${save.wanted}★`
        : 'Empty';
    });
    const cont = this.game.loadSlot(this.selectedSlot);
    $('continue-day').textContent = cont ? cont.day : 1;
  }
  showMenu() { $('menu').classList.remove('hidden'); $('hud').classList.add('hidden'); this.refreshSlots(); }
  hideMenu() { $('menu').classList.add('hidden'); $('hud').classList.remove('hidden'); }
  toast(text, ms = 2600) {
    const el = $('toast'); el.textContent = text; el.style.opacity = 1;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.style.opacity = 0; }, ms);
  }
  setCash(cash) { $('cash-value').textContent = '$' + cash.toLocaleString(); }
  setRent(rent, secondsLeft) {
    $('rent-value').textContent = '$' + rent;
    const m = Math.floor(Math.max(0, secondsLeft) / 60);
    const s = Math.floor(Math.max(0, secondsLeft) % 60);
    $('rent-clock').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    $('rent-box').classList.toggle('urgent', secondsLeft < 60);
  }
  setWanted(stars) {
    let html = '';
    for (let i = 1; i <= 5; i++) html += i <= stars ? '★' : '<span class="dim">★</span>';
    $('wanted-stars').innerHTML = html;
    $('police-panel').classList.toggle('hidden', stars === 0);
    if (stars > 0) {
      $('police-status').textContent = T.wantedTitles[stars];
      $('police-count').textContent = String(stars + (stars >= 4 ? 1 : 0));
    }
  }
  setHealth(hp) { $('health-fill').style.width = Math.max(0, hp) + '%'; }
  setAmmo(mag, reserve) { $('ammo-value').textContent = `${mag} / ${reserve}`; }
  setWeapon(name) { $('weapon-name').textContent = name; }
  setSpeed(mph, inCar) {
    $('speed-value').textContent = String(Math.round(mph));
    $('speed-box').style.visibility = inCar ? 'visible' : 'hidden';
  }
  setClock(day, timeStr, districtKey) {
    $('day-label').textContent = 'DAY ' + day;
    $('time-label').textContent = timeStr;
    $('district-label').textContent = DISTRICT_LABEL[districtKey] || districtKey;
  }
  setRadio(stationName, track) { $('radio-name').textContent = stationName; $('radio-track').textContent = track; }
  setMission(m, frac) {
    if (!m) { $('mission-title').textContent = 'ALL JOBS DONE'; $('mission-stage-fill').style.width = '100%'; return; }
    $('mission-title').textContent = `JOB ${m.id}/8 — ${m.name}`;
    $('mission-stage-fill').style.width = Math.round(frac * 100) + '%';
    $('mission-objective').textContent = m.objective;
  }
  setObjective(text) { $('mission-objective').textContent = text; }
  damageFlash() {
    const v = $('damage-vignette');
    v.style.boxShadow = 'inset 0 0 90px 30px rgba(255,0,40,0.55)';
    setTimeout(() => { v.style.boxShadow = 'inset 0 0 90px 30px rgba(255,0,40,0)'; }, 180);
  }
  showDialogue(lines, onDone) {
    const dlg = $('dialogue'); dlg.classList.remove('hidden');
    let i = 0;
    const render = () => {
      if (i >= lines.length) { dlg.classList.add('hidden'); onDone && onDone(); return; }
      $('dlg-speaker').textContent = lines[i][0];
      $('dlg-text').textContent = lines[i][1];
      i++;
    };
    render();
    $('dlg-next').onclick = () => { this.game.audio.click(); render(); };
  }
  // --- Minimap: streets grid, districts tinted, player arrow, targets, police, compass ---
  drawMinimap(state) {
    const g = this.mm; const S = 220; const scale = S / 420;
    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, 7); g.clip();
    // district tints
    g.fillStyle = '#0d1f33'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#12324a'; g.fillRect(0, 0, S / 4, S); // harbor west
    g.fillStyle = '#2a1f3a'; g.fillRect(S * 0.72, 0, S * 0.28, S); // market east
    g.fillStyle = '#c9a86a'; g.fillRect(0, S * 0.78, S, S * 0.22); // beach south
    // streets
    g.strokeStyle = '#5a6a7a'; g.lineWidth = 5;
    for (let i = -4; i <= 4; i++) {
      const [x1, y1] = toMap(i * 40, -200); const [x2, y2] = toMap(i * 40, 200);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      const [x3, y3] = toMap(-200, i * 40); const [x4, y4] = toMap(200, i * 40);
      g.beginPath(); g.moveTo(x3, y3); g.lineTo(x4, y4); g.stroke();
    }
    g.strokeStyle = '#ffd23f'; g.lineWidth = 1;
    for (let i = -4; i <= 4; i++) {
      const [x1, y1] = toMap(i * 40, -200); const [x2, y2] = toMap(i * 40, 200);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    }
    // safehouse + shop
    const [shx, shy] = toMap(-60, -60);
    g.fillStyle = '#ff5da2'; g.beginPath(); g.arc(shx, shy, 5, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 9px Arial'; g.fillText('HOME', shx + 7, shy + 3);
    const [spx, spy] = toMap(140, 40);
    g.fillStyle = '#7dff9a'; g.fillRect(spx - 4, spy - 4, 8, 8);
    // mission marker
    if (state.marker) {
      const [mx, my] = toMap(state.marker.x, state.marker.z);
      g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(mx, my, 7, 0, 7); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(mx, my, 7, 0, 7); g.stroke();
    }
    // police dots
    g.fillStyle = '#ff2030';
    for (const p of state.police) { const [px, py] = toMap(p.x, p.z); g.beginPath(); g.arc(px, py, 4, 0, 7); g.fill(); }
    // heli
    if (state.heli) { const [hx, hy] = toMap(state.heli.x, state.heli.z); g.fillStyle = '#ff2030'; g.font = 'bold 13px Arial'; g.fillText('H', hx - 4, hy + 5); }
    // player arrow (rotates with heading)
    const [px, py] = toMap(state.player.x, state.player.z);
    g.save(); g.translate(px, py); g.rotate(-state.player.heading);
    g.fillStyle = '#00e5ff'; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.fill(); g.stroke();
    g.restore();
    g.restore();
    // compass: needle rotates with heading, bold N always drawn
    const deg = Math.round(((state.player.heading * 180 / Math.PI) % 360 + 360) % 360);
    $('compass-deg').textContent = deg + '°';
    $('compass-needle').style.display = 'inline-block';
    $('compass-needle').style.transform = `rotate(${-state.player.heading}rad)`;
  }
  openJobBoard(jobs, onTake) {
    const list = $('job-list'); list.innerHTML = '';
    jobs.forEach((m) => {
      const row = document.createElement('div'); row.className = 'job-row';
      row.innerHTML = `<div><b>JOB ${m.id}/8 — ${m.name}</b> <span class="pay">$${m.pay}</span><p>${m.brief}</p></div>`;
      const btn = document.createElement('button'); btn.className = 'take'; btn.textContent = 'TAKE JOB';
      btn.disabled = m.taken;
      btn.onclick = () => { this.game.audio.click(); onTake(m); };
      row.appendChild(btn); list.appendChild(row);
    });
    $('jobboard').classList.remove('hidden');
  }
  closeJobBoard() { $('jobboard').classList.add('hidden'); }
  openShop(items, cash, onBuy) {
    const list = $('shop-list'); list.innerHTML = '';
    items.forEach((it) => {
      const row = document.createElement('div'); row.className = 'shop-row';
      row.innerHTML = `<div><b>${it.name}</b> <span class="pay">$${it.price}</span><p>${it.desc}</p></div>`;
      const btn = document.createElement('button'); btn.className = 'buy'; btn.textContent = 'BUY';
      btn.disabled = cash < it.price;
      btn.onclick = () => { this.game.audio.click(); onBuy(it); };
      row.appendChild(btn); list.appendChild(row);
    });
    $('shop').classList.remove('hidden');
  }
  closeShop() { $('shop').classList.add('hidden'); }
}
