import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAijmOTx-PiEHJcABeDhVL3idelJ9ix0ao",
  authDomain: "vilataxi1.firebaseapp.com",
  databaseURL: "https://vilataxi1-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "vilataxi1",
  storageBucket: "vilataxi1.firebasestorage.app",
  messagingSenderId: "638731214540",
  appId: "1:638731214540:web:98f43e3acbc3059aa9ec69",
  measurementId: "G-ELZHGG692B"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// --- CONTROLO DO ECRÃ DE CARREGAMENTO ---
function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.remove(), 400);
  }
}

// --- PROTEÇÃO DE ROTA & AUTENTICAÇÃO ---
onAuthStateChanged(auth, (user) => {
  const localUser = localStorage.getItem('vilataxi_user');
  if (!user && !localUser) {
    window.location.href = '/auth/';
  } else {
    let userInfo = user ? {
      name: user.displayName || user.email.split('@')[0],
      email: user.email,
      photo: user.photoURL
    } : JSON.parse(localUser);

    updateAdminProfileUI(userInfo);
  }
});

function updateAdminProfileUI(info) {
  // Atualizar nome na sidebar e na saudação
  const sidebarName = document.getElementById('sidebarAdminName');
  const greetingName = document.getElementById('greetingUserName');
  const adminEmailElements = document.querySelectorAll('.admin-info span');
  const avatarElements = document.querySelectorAll('.avatar, .top-avatar');

  // Formatar nome amigável (primeiro nome ou nome completo)
  let displayName = info.name || 'Administrador';
  if (displayName.includes('@')) {
    displayName = displayName.split('@')[0];
  }

  if (sidebarName) sidebarName.textContent = displayName;
  if (greetingName) greetingName.textContent = displayName;

  adminEmailElements.forEach(el => {
    if(el) el.textContent = info.email || 'Super admin';
  });

  avatarElements.forEach(el => {
    if(el) {
      if(info.photo) {
        el.innerHTML = `<img src="${info.photo}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
      } else {
        el.textContent = displayName.charAt(0).toUpperCase();
      }
    }
  });
}

// --- MENU DE PERFIL & TERMINAR SESSÃO ---
const profileMenuBtn = document.getElementById('profileMenuBtn');
const profileDropdown = document.getElementById('profileDropdown');
const logoutBtn = document.getElementById('logoutBtn');

if (profileMenuBtn && profileDropdown) {
  profileMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    profileDropdown.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    profileDropdown.classList.remove('show');
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      localStorage.removeItem('vilataxi_user');
      await signOut(auth);
      window.location.href = '/auth/';
    } catch (error) {
      console.error("Erro ao terminar sessão:", error);
      window.location.href = '/auth/';
    }
  });
}

let allDrivers = {};
let allPassengers = {};
let allRides = [];
let firebaseDataLoaded = 0;

function checkInitialLoadingComplete() {
  firebaseDataLoaded++;
  if (firebaseDataLoaded >= 2) {
    hideLoadingOverlay();
  }
}

// --- PASSAGEIROS ---
const passengersRef = ref(db, 'passageiro');
onValue(passengersRef, (snapshot) => {
  const data = snapshot.val() || {};
  allPassengers = data;
  const count = Object.keys(data).length;
  document.getElementById('statTotalPassengers').textContent = count;

  let tbody = document.getElementById('fullPassengersTable');
  if(tbody) {
    tbody.innerHTML = '';
    if (count === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nenhum passageiro registado.</td></tr>';
    } else {
      Object.values(data).forEach(p => {
        let tr = document.createElement('tr');
        let dateFormatted = p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'N/A';
        tr.innerHTML = `
          <td><div class="user-cell"><span class="mini-avatar a1">${(p.nome || 'P').charAt(0).toUpperCase()}</span><strong>${p.nome || 'Desconhecido'}</strong></div></td>
          <td>${p.email || '—'}</td>
          <td>${p.tipo || 'passageiro'}</td>
          <td>${p.desconto ? '<span class="badge success">Sim</span>' : 'Não'}</td>
          <td>${dateFormatted}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  }
  checkInitialLoadingComplete();
});

// --- MOTORISTAS E CORRIDAS ---
const driversRef = ref(db, 'drivers');
onValue(driversRef, (snapshot) => {
  const driversData = snapshot.val() || {};
  allDrivers = driversData;
  
  let totalDrivers = Object.keys(driversData).length;
  let onlineDrivers = 0;
  let activeRidesCount = 0;
  let totalRevenue = 0;
  let completedRidesCount = 0;

  allRides = [];
  let dashDriversHTML = '';
  let fullDriversHTML = '';

  Object.entries(driversData).forEach(([driverId, driver]) => {
    const isOnline = driver.isOnline === true || driver.disponibilidade === true;
    if (isOnline) onlineDrivers++;

    let initials = (driver.nome || 'M').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    dashDriversHTML += `
      <div class="driver-row">
        <span class="mini-avatar driver">${initials}</span>
        <div><strong>${driver.nome || 'Motorista'}</strong><span>${driver.tipoTransporte || 'Taxi'} · ${driver.corVeiculo || ''}</span></div>
        <i class="${isOnline ? 'online-dot' : 'busy-dot'}"></i>
      </div>
    `;

    fullDriversHTML += `
      <tr>
        <td><div class="user-cell"><span class="mini-avatar driver">${initials}</span><div><strong>${driver.nome || '—'}</strong><small>${driver.id || driverId}</small></div></div></td>
        <td>${driver.tipoTransporte || '—'} (${driver.corVeiculo || '—'})</td>
        <td>${driver.telefone || '—'}</td>
        <td>${driver.precoKm ? driver.precoKm + ' MT' : '—'}</td>
        <td><span class="badge ${isOnline ? 'success' : 'neutral'}">${isOnline ? 'Online' : 'Offline'}</span></td>
      </tr>
    `;

    if (driver.pedidos) {
      Object.entries(driver.pedidos).forEach(([rideId, ride]) => {
        allRides.push({ ...ride, id: rideId, driverName: driver.nome || 'Motorista' });

        if (ride.status === 'concluido' || ride.status === 'concluida') {
          completedRidesCount++;
          if (ride.valorTotal) totalRevenue += Number(ride.valorTotal);
        }
        if (ride.status === 'pendente' || ride.status === 'em_curso') {
          activeRidesCount++;
        }
      });
    }
  });

  document.getElementById('statTotalDrivers').textContent = totalDrivers;
  document.getElementById('statOnlineDrivers').textContent = onlineDrivers;
  document.getElementById('dashTotalDrivers').textContent = totalDrivers;
  document.getElementById('dashOnlineDrivers').textContent = onlineDrivers;
  document.getElementById('dashBusyDrivers').textContent = activeRidesCount;
  document.getElementById('statActiveRidesCount').textContent = activeRidesCount;
  document.getElementById('driversTotalCard').textContent = totalDrivers;
  document.getElementById('driversOnlineCard').textContent = onlineDrivers;
  
  let percentOnline = totalDrivers > 0 ? Math.round((onlineDrivers / totalDrivers) * 100) : 0;
  document.getElementById('driverProgressBar').style.width = percentOnline + '%';

  document.getElementById('statRevenue').innerHTML = totalRevenue.toLocaleString() + ' <small>MT</small>';
  document.getElementById('statCompletedRides').textContent = completedRidesCount;
  document.getElementById('badgeRides').textContent = allRides.length;

  document.getElementById('dashDriversList').innerHTML = dashDriversHTML || '<p class="muted" style="padding:10px;">Sem motoristas registados.</p>';
  document.getElementById('fullDriversTable').innerHTML = fullDriversHTML || '<tr><td colspan="5" style="text-align: center;">Nenhum motorista encontrado.</td></tr>';

  renderRidesTables();
  renderPaymentsTable();
  renderRealtimeActivity();
  renderChartsAndAnalytics(totalRevenue, completedRidesCount, onlineDrivers, totalDrivers);
  checkInitialLoadingComplete();
});

// --- GRÁFICOS DINÂMICOS ---
function renderChartsAndAnalytics(totalRevenue, completedCount, onlineDrivers, totalDrivers) {
  const chartHeight = 225;
  const chartWidth = 700;
  
  let sortedRides = [...allRides].sort((a,b) => (a.timestamp || 0) - (b.timestamp || 0));
  let points = [];
  
  if (sortedRides.length > 0) {
    let runningSum = 0;
    let maxVal = 0;
    
    sortedRides.forEach(r => {
      let val = Number(r.valorTotal || 0);
      runningSum += val;
      points.push(runningSum);
      if (runningSum > maxVal) maxVal = runningSum;
    });
    
    if (maxVal === 0) maxVal = 1000;
    
    const yLabels = document.getElementById('chartYLabels');
    if (yLabels) {
      yLabels.innerHTML = `
        <span>${Math.round(maxVal)}k</span>
        <span>${Math.round(maxVal * 0.75)}k</span>
        <span>${Math.round(maxVal * 0.5)}k</span>
        <span>${Math.round(maxVal * 0.25)}k</span>
        <span>0</span>
      `;
    }

    let svgCoords = [];
    let n = points.length;
    points.forEach((val, i) => {
      let x = n > 1 ? (i / (n - 1)) * chartWidth : chartWidth / 2;
      let y = chartHeight - (val / maxVal) * (chartHeight - 20);
      svgCoords.push({x, y});
    });

    if (svgCoords.length === 1) {
      svgCoords.unshift({x: 0, y: chartHeight});
    }

    let pathD = `M ${svgCoords[0].x} ${svgCoords[0].y}`;
    for (let i = 1; i < svgCoords.length; i++) {
      pathD += ` L ${svgCoords[i].x} ${svgCoords[i].y}`;
    }

    let areaD = pathD + ` L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;

    const lineEl = document.getElementById('revenueSvgLine');
    const areaEl = document.getElementById('revenueSvgArea');
    const circleEl = document.getElementById('revenueSvgCircle');

    if (lineEl && areaEl && circleEl && svgCoords.length > 0) {
      lineEl.setAttribute('d', pathD);
      areaEl.setAttribute('d', areaD);
      let lastPt = svgCoords[svgCoords.length - 1];
      circleEl.setAttribute('cx', lastPt.x);
      circleEl.setAttribute('cy', lastPt.y);
    }
  }

  const analyticsSvgLine = document.getElementById('analyticsSvgLine');
  const analyticsSvgCircle = document.getElementById('analyticsSvgCircle');
  const analyticsYLabels = document.getElementById('analyticsYLabels');

  if (analyticsSvgLine && sortedRides.length > 0) {
    let maxRides = sortedRides.length;
    if (maxRides < 5) maxRides = 5;

    if (analyticsYLabels) {
      analyticsYLabels.innerHTML = `
        <span>${maxRides}</span>
        <span>${Math.round(maxRides * 0.75)}</span>
        <span>${Math.round(maxRides * 0.5)}</span>
        <span>${Math.round(maxRides * 0.25)}</span>
        <span>0</span>
      `;
    }

    let analyticsCoords = [];
    sortedRides.forEach((r, i) => {
      let x = (i / (sortedRides.length - 1 || 1)) * chartWidth;
      let y = chartHeight - ((i + 1) / maxRides) * (chartHeight - 20);
      analyticsCoords.push({x, y});
    });

    if (analyticsCoords.length === 1) {
      analyticsCoords.unshift({x: 0, y: chartHeight});
    }

    let aPathD = `M ${analyticsCoords[0].x} ${analyticsCoords[0].y}`;
    for (let i = 1; i < analyticsCoords.length; i++) {
      aPathD += ` L ${analyticsCoords[i].x} ${analyticsCoords[i].y}`;
    }

    analyticsSvgLine.setAttribute('d', aPathD);
    let lastA = analyticsCoords[analyticsCoords.length - 1];
    analyticsSvgCircle.setAttribute('cx', lastA.x);
    analyticsSvgCircle.setAttribute('cy', lastA.y);
  }

  let successRate = allRides.length > 0 ? Math.round((completedCount / allRides.length) * 100) : 0;
  const successEl = document.getElementById('analyticsSuccessRate');
  const progressBarEl = document.getElementById('analyticsProgressBar');
  if (successEl && progressBarEl) {
    successEl.textContent = successRate + '%';
    progressBarEl.style.width = successRate + '%';
  }

  const onlineDriversCountEl = document.getElementById('analyticsOnlineDriversCount');
  const driverProgressBarEl = document.getElementById('analyticsDriverProgressBar');
  if (onlineDriversCountEl && driverProgressBarEl) {
    onlineDriversCountEl.textContent = onlineDrivers + ' / ' + totalDrivers;
    let dPct = totalDrivers > 0 ? Math.round((onlineDrivers / totalDrivers) * 100) : 0;
    driverProgressBarEl.style.width = dPct + '%';
  }

  let avgRev = completedCount > 0 ? Math.round(totalRevenue / completedCount) : 0;
  const avgRevEl = document.getElementById('analyticsAvgRevenue');
  if (avgRevEl) {
    avgRevEl.textContent = avgRev.toLocaleString() + ' MT';
  }

  renderSparklines();
}

function renderSparklines() {
  const revSpark = document.getElementById('revenueSparkline');
  const ridesSpark = document.getElementById('ridesSparkline');
  
  if (revSpark && allRides.length > 0) {
    revSpark.innerHTML = '';
    allRides.slice(-8).forEach((r) => {
      let span = document.createElement('span');
      let val = Number(r.valorTotal || 10);
      let heightPct = Math.min(100, Math.max(20, (val / 500) * 100));
      span.style.height = heightPct + '%';
      revSpark.appendChild(span);
    });
  }

  if (ridesSpark && allRides.length > 0) {
    ridesSpark.innerHTML = '';
    allRides.slice(-8).forEach((r, idx) => {
      let span = document.createElement('span');
      span.style.height = (40 + (idx * 7) % 60) + '%';
      ridesSpark.appendChild(span);
    });
  }
}

function renderRidesTables() {
  let overviewTable = document.getElementById('overviewRidesTable');
  let fullTable = document.getElementById('fullRidesTable');
  
  if(overviewTable) overviewTable.innerHTML = '';
  if(fullTable) fullTable.innerHTML = '';

  if (allRides.length === 0) {
    if(overviewTable) overviewTable.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhuma corrida registada.</td></tr>';
    if(fullTable) fullTable.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nenhuma corrida registada.</td></tr>';
    return;
  }

  allRides.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  if(overviewTable) {
    allRides.slice(0, 4).forEach(r => {
      let badgeClass = 'neutral';
      if (r.status === 'concluido' || r.status === 'concluida') badgeClass = 'success';
      else if (r.status === 'pendente') badgeClass = 'warning';
      else if (r.status === 'cancelado') badgeClass = 'danger';

      let tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${(r.id || '').substring(0, 6)}</strong></td>
        <td><div class="user-cell"><span class="mini-avatar a1">P</span> ${r.passengerId ? r.passengerId.substring(0,6) + '...' : 'Passageiro'}</div></td>
        <td>${r.driverName || '—'}</td>
        <td>${r.valorTotal ? r.valorTotal + ' MT' : '—'}</td>
        <td><span class="badge ${badgeClass}">${r.status || 'pendente'}</span></td>
        <td><button class="table-more">•••</button></td>
      `;
      overviewTable.appendChild(tr);
    });
  }

  if(fullTable) {
    allRides.forEach(r => {
      let badgeClass = 'neutral';
      if (r.status === 'concluido' || r.status === 'concluida') badgeClass = 'success';
      else if (r.status === 'pendente') badgeClass = 'warning';
      else if (r.status === 'cancelado') badgeClass = 'danger';

      let tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${(r.id || '').substring(0, 8)}</strong></td>
        <td>${r.passengerId ? r.passengerId.substring(0,8) + '...' : '—'}</td>
        <td>${r.driverName || '—'}</td>
        <td>${r.origem || '—'}</td>
        <td>${r.destino || '—'}</td>
        <td>${r.valorTotal ? r.valorTotal + ' MT' : '—'}</td>
        <td><span class="badge ${badgeClass}">${r.status || 'pendente'}</span></td>
      `;
      fullTable.appendChild(tr);
    });
  }
}

function renderPaymentsTable() {
  let paymentsTable = document.getElementById('fullPaymentsTable');
  if(!paymentsTable) return;
  paymentsTable.innerHTML = '';

  const completedOrPaid = allRides.filter(r => r.valorTotal);
  if (completedOrPaid.length === 0) {
    paymentsTable.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhum pagamento registado.</td></tr>';
    return;
  }

  completedOrPaid.forEach(r => {
    let tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>#PAY-${(r.id || '').substring(0, 6)}</strong></td>
      <td>${r.formaPagamento || 'M-Pesa / Dinheiro'}</td>
      <td>${r.valorTotal} MT</td>
      <td><span class="badge success">Concluído</span></td>
    `;
    paymentsTable.appendChild(tr);
  });
}

function renderRealtimeActivity() {
  let activityList = document.getElementById('realtimeActivityList');
  if(!activityList) return;
  activityList.innerHTML = '';

  if (allRides.length === 0) {
    activityList.innerHTML = '<div class="activity-item"><div><strong>Sem atividade recente</strong><span>A aguardar novas corridas</span></div></div>';
    return;
  }

  allRides.slice(0, 4).forEach(r => {
    let item = document.createElement('div');
    item.className = 'activity-item';
    item.innerHTML = `
      <div class="activity-icon ride"><i class="hgi hgi-stroke hgi-car-05"></i></div>
      <div><strong>Corrida ${r.status || 'recente'}</strong><span>ID: ${(r.id || '').substring(0,6)} · ${r.driverName}</span></div>
      <b>${r.valorTotal ? r.valorTotal + ' MT' : '—'}</b>
    `;
    activityList.appendChild(item);
  });
}

// --- NAVEGAÇÃO ---
const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.page-section');
const pageTitle = document.getElementById('pageTitle');
const pageLabel = document.getElementById('pageLabel');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const menuBtn = document.getElementById('menuBtn');

const titles = {
  overview: 'Visão geral',
  rides: 'Corridas',
  drivers: 'Motoristas',
  passengers: 'Passageiros',
  payments: 'Pagamentos',
  support: 'Suporte',
  analytics: 'Analytics & Relatórios'
};

function openSection(id){
  sections.forEach(section => section.classList.toggle('active', section.id === id));
  navItems.forEach(item => item.classList.toggle('active', item.dataset.section === id));
  if(pageTitle) pageTitle.textContent = titles[id] || 'Visão geral';
  if(pageLabel) pageLabel.textContent = titles[id] || 'Visão geral';
  window.scrollTo({top:0, behavior:'smooth'});
  closeMenu();
}

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    const sectionId = item.dataset.section;
    if(sectionId){
      openSection(sectionId);
    }
  });
});

document.querySelectorAll('[data-go]').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.go;
    window.location.hash = target;
    openSection(target);
  });
});

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.substring(1);
  if(hash && document.getElementById(hash)){
    openSection(hash);
  }
});

window.addEventListener('DOMContentLoaded', () => {
  const hash = window.location.hash.substring(1);
  if(hash && document.getElementById(hash)){
    openSection(hash);
  }
});

if(menuBtn) {
  menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
  });
}

if(overlay) {
  overlay.addEventListener('click', closeMenu);
}

function closeMenu(){
  if(sidebar) sidebar.classList.remove('open');
  if(overlay) overlay.classList.remove('show');
}
