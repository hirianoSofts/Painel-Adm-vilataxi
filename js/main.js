import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, remove, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
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

function showToast(message) {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.querySelector('span').textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
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
  const sidebarName = document.getElementById('sidebarAdminName');
  const greetingName = document.getElementById('greetingUserName');
  const adminEmailElements = document.querySelectorAll('.admin-info span');
  const avatarElements = document.querySelectorAll('.avatar, .top-avatar');

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
        allRides.push({ ...ride, id: rideId, driverId: driverId, driverName: driver.nome || 'Motorista' });

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
  checkInitialLoadingComplete();
});

// --- ELIMINAR CORRIDA/PEDIDO ---
window.deleteRide = function(driverId, rideId) {
  if (confirm("Tem certeza absoluta que deseja apagar este pedido/corrida? Esta ação não pode ser desfeita.")) {
    const rideRef = ref(db, `drivers/${driverId}/pedidos/${rideId}`);
    remove(rideRef).then(() => {
      showToast("Pedido apagado com sucesso.");
    }).catch((error) => {
      alert("Erro ao apagar pedido: " + error.message);
    });
  }
};

// --- GESTÃO DE CONFIGURAÇÕES (PREÇOS E VERSÃO) ---
const precoRef = ref(db, 'preco');
onValue(precoRef, (snapshot) => {
  const data = snapshot.val() || {};
  if (document.getElementById('inputTxopela')) {
    document.getElementById('inputTxopela').value = data.txopela || data.Txopela || '';
    document.getElementById('inputMototaxi').value = data.mototaxi || data.Mototaxi || '';
    document.getElementById('inputCarro').value = data.carro || data.carro_eco || data['Carro Eco'] || '';
  }
});

const updateRef = ref(db, 'update');
onValue(updateRef, (snapshot) => {
  const val = snapshot.val();
  if (document.getElementById('inputAppVersion') && val) {
    document.getElementById('inputAppVersion').value = val;
  }
});

document.getElementById('pricingForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const txopela = Number(document.getElementById('inputTxopela').value);
  const mototaxi = Number(document.getElementById('inputMototaxi').value);
  const carro = Number(document.getElementById('inputCarro').value);

  set(ref(db, 'preco'), {
    txopela: txopela,
    mototaxi: mototaxi,
    carro: carro
  }).then(() => {
    showToast("Tarifas atualizadas com sucesso!");
  }).catch(err => {
    alert("Erro ao atualizar tarifas: " + err.message);
  });
});

document.getElementById('versionForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const versao = document.getElementById('inputAppVersion').value;

  set(ref(db, 'update'), versao).then(() => {
    showToast("Versão do aplicativo atualizada com sucesso!");
  }).catch(err => {
    alert("Erro ao atualizar versão: " + err.message);
  });
});

function renderRidesTables() {
  let overviewTable = document.getElementById('overviewRidesTable');
  let fullTable = document.getElementById('fullRidesTable');
  
  if(overviewTable) overviewTable.innerHTML = '';
  if(fullTable) fullTable.innerHTML = '';

  if (allRides.length === 0) {
    if(overviewTable) overviewTable.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhuma corrida registada.</td></tr>';
    if(fullTable) fullTable.innerHTML = '<tr><td colspan="8" style="text-align: center;">Nenhuma corrida registada.</td></tr>';
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
        <td><button class="danger-action-btn" onclick="deleteRide('${r.driverId}', '${r.id}')"><i class="hgi hgi-stroke hgi-delete-02"></i> Apagar</button></td>
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
  configs: 'Configurações'
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
