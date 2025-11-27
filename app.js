// Sélecteurs de base
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const togglePasswordBtn = document.getElementById('togglePassword');
const signupBtn = document.getElementById('signupBtn');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authPanel = document.getElementById('authPanel');
const dashboard = document.getElementById('dashboard');
const authMessage = document.getElementById('authMessage');

const walletBalanceEl = document.getElementById('walletBalance');
const userEmailEl = document.getElementById('userEmail');
const userRoleEl = document.getElementById('userRole');
const userKycStatusEl = document.getElementById('userKycStatus');

const txLabelInput = document.getElementById('txLabel');
const txAmountInput = document.getElementById('txAmount');
const addTxBtn = document.getElementById('addTxBtn');
const txMessage = document.getElementById('txMessage');
const txHistoryEl = document.getElementById('txHistory');

const kycDocType = document.getElementById('kycDocType');
const kycDocFile = document.getElementById('kycDocFile');
const kycSelfieFile = document.getElementById('kycSelfieFile');
const sendKycBtn = document.getElementById('sendKycBtn');
const kycMessage = document.getElementById('kycMessage');

const virtualCardBox = document.getElementById('virtualCardBox');
const createVirtualCardBtn = document.getElementById('createVirtualCardBtn');
const toggleVirtualCardStatusBtn = document.getElementById('toggleVirtualCardStatusBtn');
const virtualCardMessage = document.getElementById('virtualCardMessage');

// Helpers
function showMessage(el, text, type = 'info') {
  if (!el) return;
  el.textContent = text;
  el.style.color =
    type === 'error'
      ? '#f97373'
      : type === 'success'
      ? '#22c55e'
      : '#9ca3af';
}

function sanitizeErrorMessage(message) {
  if (!message) return 'Une erreur est survenue. Merci de réessayer.';
  return (
    message
      .replace(/firebase/gi, '')
      .replace(/\(auth\/[^\)]+\)/gi, '')
      .replace(/[:\-]\s*$/g, '')
      .trim() || 'Une erreur est survenue. Merci de réessayer.'
  );
}

function formatError(err, fallback) {
  const raw = err && err.message ? err.message : '';
  const cleaned = sanitizeErrorMessage(raw);
  return cleaned || fallback || 'Une erreur est survenue. Merci de réessayer.';
}

// =====================================================
// CRÉATION DE COMPTE
// =====================================================
if (signupBtn) {
  signupBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const pass = passwordInput.value.trim();

    if (!email || !pass) {
      showMessage(authMessage, 'Email et mot de passe obligatoires.', 'error');
      return;
    }

    try {
      const cred = await auth.createUserWithEmailAndPassword(email, pass);
      const uid = cred.user.uid;

      // Profil utilisateur
      await db.collection('users').doc(uid).set({
        email,
        role: 'client',
        kycStatus: 'none',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      // Wallet principal
      await db.collection('wallets').doc(uid).set({
        balance: 0,
        currency: 'XAF',
        type: 'main',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      showMessage(authMessage, 'Compte créé avec succès. Vous êtes connecté.', 'success');
    } catch (err) {
      console.error(err);
      showMessage(authMessage, formatError(err, 'Erreur lors de la création du compte.'), 'error');
    }
  });
}

// =====================================================
// CONNEXION
// =====================================================
if (loginBtn) {
  loginBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const pass = passwordInput.value.trim();

    if (!email || !pass) {
      showMessage(authMessage, 'Email et mot de passe obligatoires.', 'error');
      return;
    }

    try {
      await auth.signInWithEmailAndPassword(email, pass);
      showMessage(authMessage, '');
  } catch (err) {
      console.error(err);
      showMessage(authMessage, formatError(err, 'Connexion impossible.'), 'error');
    }
  });
}

// =====================================================
// DÉCONNEXION
// =====================================================
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => auth.signOut());
}

// =====================================================
// CHANGEMENT D’ÉTAT D’AUTH
// =====================================================
auth.onAuthStateChanged(async (user) => {
  if (user) {
    authPanel.style.display = 'none';
    dashboard.style.display = 'block';
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';

    if (userEmailEl) userEmailEl.textContent = user.email;

    // Charger profil
    const userSnap = await db.collection('users').doc(user.uid).get();
    if (userSnap.exists) {
      const data = userSnap.data();
      if (userRoleEl) userRoleEl.textContent = data.role || 'client';
      if (userKycStatusEl) userKycStatusEl.textContent = data.kycStatus || 'none';
    }

    // Charger wallet
    const walletSnap = await db.collection('wallets').doc(user.uid).get();
    if (walletSnap.exists && walletBalanceEl) {
      walletBalanceEl.textContent = walletSnap.data().balance ?? 0;
    }

    // Charger historique
    loadTransactions(user.uid);

    // Charger carte virtuelle
    loadVirtualCard(user.uid);
  } else {
    authPanel.style.display = 'block';
    dashboard.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (walletBalanceEl) walletBalanceEl.textContent = '0';
    if (txHistoryEl) {
      txHistoryEl.innerHTML = '<p class="muted small">Aucune opération pour l’instant.</p>';
    }
  }
});

// =====================================================
// TRANSACTIONS
// =====================================================
async function loadTransactions(uid) {
  const snap = await db
    .collection('transactions')
    .where('uid', '==', uid)
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  if (!txHistoryEl) return;

  if (snap.empty) {
    txHistoryEl.innerHTML = '<p class="muted small">Aucune opération pour l’instant.</p>';
    return;
  }

  let html = '';
  snap.forEach((doc) => {
    const t = doc.data();
    const amount = t.amount || 0;
    const cls = amount >= 0 ? 'pos' : 'neg';
    const date = t.createdAt?.toDate?.() || new Date();
    const dateStr = date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
    html += `
      <div class="tx-item">
        <div>
          <div class="tx-label">${t.label || 'Opération'}</div>
          <div class="tx-date">${dateStr}</div>
        </div>
        <div class="tx-amount ${cls}">${amount >= 0 ? '+' : ''}${amount} XAF</div>
      </div>
    `;
  });

  txHistoryEl.innerHTML = html;
}

if (addTxBtn) {
  addTxBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;

    const label = txLabelInput.value.trim();
    const amount = parseInt(txAmountInput.value, 10);

    if (!label || isNaN(amount)) {
      showMessage(txMessage, 'Libellé et montant obligatoires.', 'error');
      return;
    }

    try {
      const walletRef = db.collection('wallets').doc(user.uid);

      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(walletRef);
        const currentBalance = snap.exists ? snap.data().balance || 0 : 0;

        const newBalance = currentBalance + amount;
        if (newBalance < 0) {
          throw new Error('Solde insuffisant pour cette opération.');
        }

        transaction.update(walletRef, {
          balance: newBalance,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });

        const txRef = db.collection('transactions').doc();
        transaction.set(txRef, {
          uid: user.uid,
          label,
          amount,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      });

      showMessage(txMessage, 'Opération enregistrée.', 'success');
      txLabelInput.value = '';
      txAmountInput.value = '';
      if (walletBalanceEl) {
        walletBalanceEl.textContent = parseInt(walletBalanceEl.textContent, 10) + amount;
      }
      loadTransactions(user.uid);
    } catch (err) {
      console.error(err);
      showMessage(txMessage, formatError(err, 'Erreur lors de l’opération.'), 'error');
    }
  });
}

// =====================================================
// KYC
// =====================================================
if (sendKycBtn) {
  sendKycBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;

    const docType = kycDocType.value;
    const docFile = kycDocFile.files[0];
    const selfieFile = kycSelfieFile.files[0];

    if (!docFile || !selfieFile) {
      showMessage(kycMessage, 'Merci de joindre le document et le selfie.', 'error');
      return;
    }

    try {
      const kycId = db.collection('kycRequests').doc().id;

      const docRef = storage.ref(`kyc/${user.uid}/${kycId}_document`);
      const selfieRef = storage.ref(`kyc/${user.uid}/${kycId}_selfie`);

      await docRef.put(docFile);
      await selfieRef.put(selfieFile);

      const docURL = await docRef.getDownloadURL();
      const selfieURL = await selfieRef.getDownloadURL();

      await db.collection('kycRequests').doc(kycId).set({
        uid: user.uid,
        docType,
        docURL,
        selfieURL,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      await db.collection('users').doc(user.uid).update({
        kycStatus: 'pending',
        kycRequestId: kycId,
      });

      if (userKycStatusEl) userKycStatusEl.textContent = 'pending';
      showMessage(kycMessage, 'Dossier KYC envoyé. Statut : pending.', 'success');
    } catch (err) {
      console.error(err);
      showMessage(kycMessage, formatError(err, 'Erreur lors de l’envoi du KYC.'), 'error');
    }
  });
}

// =====================================================
// MOT DE PASSE : ŒIL
// =====================================================
 // Nouveau système : Afficher / Masquer
const passwordInput = document.getElementById("password");
const togglePasswordBtn = document.getElementById("togglePasswordBtn");

if (passwordInput && togglePasswordBtn) {
  togglePasswordBtn.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";

    passwordInput.type = isHidden ? "text" : "password";
    togglePasswordBtn.textContent = isHidden ? "Masquer" : "Afficher";
  });
}

// =====================================================
// CARTE VIRTUELLE
// =====================================================
function renderVirtualCard(data) {
  if (!virtualCardBox) return;

  if (!data) {
    virtualCardBox.innerHTML =
      '<p class="muted small">Aucune carte virtuelle créée pour l’instant.</p>';
    return;
  }

  const last4 = data.last4 || '0000';
  const status = data.status || 'active';
  const limit = data.limit ?? 0;
  const currency = data.currency || 'XAF';
  const brand = data.brand || 'VIRTUAL';
  const statusClass = status === 'frozen' ? 'frozen' : 'active';
  const statusLabel = status === 'frozen' ? 'Gelée' : 'Active';
  const holder = (auth.currentUser && auth.currentUser.email) || 'Client';

  virtualCardBox.innerHTML = `
    <div class="virtual-card">
      <div class="virtual-card-row">
        <div>
          <div class="virtual-card-brand">${brand}</div>
          <div class="virtual-card-holder">${holder}</div>
        </div>
        <div class="virtual-card-status ${statusClass}">
          ${statusLabel}
        </div>
      </div>
      <div class="virtual-card-pan">•••• •••• •••• ${last4}</div>
      <div class="virtual-card-row" style="margin-top:.6rem;">
        <div>Limite : ${limit.toLocaleString('fr-FR')} ${currency}</div>
        <div>Devise : ${currency}</div>
      </div>
    </div>
  `;
}

async function loadVirtualCard(uid) {
  if (!virtualCardBox) return;
  try {
    const docSnap = await db.collection('virtualCards').doc(uid).get();
    if (!docSnap.exists) {
      renderVirtualCard(null);
    } else {
      renderVirtualCard(docSnap.data());
    }
  } catch (err) {
    console.error(err);
    renderVirtualCard(null);
    if (virtualCardMessage) {
      showMessage(
        virtualCardMessage,
        formatError(err, 'Impossible de charger la carte virtuelle.'),
        'error'
      );
    }
  }
}

async function generateVirtualCardFor(uid) {
  try {
    const last4 = String(Math.floor(1000 + Math.random() * 9000));
    const cardRef = db.collection('virtualCards').doc(uid);
    await cardRef.set(
      {
        uid,
        last4,
        brand: 'VIRTUAL',
        currency: 'XAF',
        status: 'active',
        limit: 200000,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await loadVirtualCard(uid);
    if (virtualCardMessage) {
      showMessage(virtualCardMessage, 'Carte virtuelle générée.', 'success');
    }
  } catch (err) {
    console.error(err);
    if (virtualCardMessage) {
      showMessage(
        virtualCardMessage,
        formatError(err, 'Erreur lors de la génération de la carte.'),
        'error'
      );
    }
  }
}

async function toggleVirtualCardStatus(uid) {
  try {
    const cardRef = db.collection('virtualCards').doc(uid);
    const snap = await cardRef.get();
    if (!snap.exists) {
      if (virtualCardMessage) {
        showMessage(
          virtualCardMessage,
          'Aucune carte virtuelle à modifier.',
          'error'
        );
      }
      return;
    }
    const data = snap.data();
    const currentStatus = data.status || 'active';
    const newStatus = currentStatus === 'frozen' ? 'active' : 'frozen';

    await cardRef.update({
      status: newStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    await loadVirtualCard(uid);
    if (virtualCardMessage) {
      showMessage(
        virtualCardMessage,
        newStatus === 'frozen'
          ? 'Carte virtuelle gelée.'
          : 'Carte virtuelle réactivée.',
        'success'
      );
    }
  } catch (err) {
    console.error(err);
    if (virtualCardMessage) {
      showMessage(
        virtualCardMessage,
        formatError(err, 'Impossible de modifier le statut de la carte.'),
        'error'
      );
    }
  }
}

if (createVirtualCardBtn) {
  createVirtualCardBtn.addEventListener('click', () => {
    const user = auth.currentUser;
    if (!user) return;
    generateVirtualCardFor(user.uid);
  });
}

if (toggleVirtualCardStatusBtn) {
  toggleVirtualCardStatusBtn.addEventListener('click', () => {
    const user = auth.currentUser;
    if (!user) return;
    toggleVirtualCardStatus(user.uid);
  });
}
