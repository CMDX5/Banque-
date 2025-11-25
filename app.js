/* ------------------------------------------------------
   SÉLECTEURS
-------------------------------------------------------*/
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const togglePasswordBtn = document.getElementById('togglePassword');

const createAccountBtn = document.getElementById('createAccountBtn');
const loginBtn = document.getElementById('loginBtn');
const authMessage = document.getElementById('authMessage');

const dashboardPanel = document.getElementById('dashboardPanel');
const authPanel = document.getElementById('authPanel');

const txLabel = document.getElementById('txLabel');
const txAmount = document.getElementById('txAmount');
const saveTxBtn = document.getElementById('saveTxBtn');
const txMessage = document.getElementById('txMessage');

const kycDocType = document.getElementById('kycDocType');
const kycDocFile = document.getElementById('kycDocFile');
const kycSelfieFile = document.getElementById('kycSelfieFile');
const sendKycBtn = document.getElementById('sendKycBtn');
const kycMessage = document.getElementById('kycMessage');

const virtualCardBox = document.getElementById('virtualCardBox');
const createVirtualCardBtn = document.getElementById('createVirtualCardBtn');
const toggleVirtualCardStatusBtn = document.getElementById('toggleVirtualCardStatusBtn');
const virtualCardMessage = document.getElementById('virtualCardMessage');

/* ------------------------------------------------------
   UTILITAIRES
-------------------------------------------------------*/
function showMessage(el, text, type = "info") {
  el.textContent = text;
  el.style.color =
    type === "error" ? "#f97373" :
    type === "success" ? "#22c55e" :
    "#9ca3af";
}

// Nettoyage propre des messages Firebase
function sanitizeErrorMessage(msg) {
  if (!msg) return "Une erreur est survenue.";
  return msg
    .replace(/firebase/gi, "")
    .replace(/\(auth\/[^\)]+\)/gi, "")
    .replace(/[:\-]\s*$/g, "")
    .trim();
}

function formatError(err, fallback) {
  return sanitizeErrorMessage(err?.message) || fallback;
}

/* ------------------------------------------------------
   MOT DE PASSE - ŒIL 👁
-------------------------------------------------------*/
if (togglePasswordBtn && passwordInput) {
  togglePasswordBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    togglePasswordBtn.textContent = isPassword ? "🙈" : "👁";
  });
}

/* ------------------------------------------------------
   CRÉATION DE COMPTE
-------------------------------------------------------*/
if (createAccountBtn) {
  createAccountBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const pass = passwordInput.value.trim();

    if (!email || !pass)
      return showMessage(authMessage, "Email et mot de passe requis.", "error");

    try {
      const cred = await auth.createUserWithEmailAndPassword(email, pass);
      const uid = cred.user.uid;

      await db.collection("users").doc(uid).set({
        email,
        role: "client",
        kycStatus: "none",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      await db.collection("wallets").doc(uid).set({
        balance: 0,
        currency: "XAF",
        type: "main",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      showMessage(authMessage, "Compte créé avec succès.", "success");
    } catch (err) {
      showMessage(authMessage, formatError(err, "Erreur création compte."), "error");
    }
  });
}

/* ------------------------------------------------------
   CONNEXION
-------------------------------------------------------*/
if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const pass = passwordInput.value.trim();

    if (!email || !pass)
      return showMessage(authMessage, "Identifiants requis.", "error");

    try {
      await auth.signInWithEmailAndPassword(email, pass);
      showMessage(authMessage, "");
    } catch (err) {
      showMessage(authMessage, formatError(err, "Connexion impossible."), "error");
    }
  });
}

/* ------------------------------------------------------
   DÉCONNEXION
-------------------------------------------------------*/
document.addEventListener("click", (e) => {
  if (e.target.id === "logoutBtn") auth.signOut();
});

/* ------------------------------------------------------
   AUTH STATE CHANGEMENT
-------------------------------------------------------*/
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    authPanel.style.display = "block";
    dashboardPanel.style.display = "none";
    return;
  }

  authPanel.style.display = "none";
  dashboardPanel.style.display = "block";

  const uid = user.uid;

  loadWallet(uid);
  loadTransactions(uid);
  loadVirtualCard(uid);
});

/* ------------------------------------------------------
   WALLET
-------------------------------------------------------*/
async function loadWallet(uid) {
  const snap = await db.collection("wallets").doc(uid).get();
  document.getElementById("mainBalance").textContent =
    "Solde principal : " + (snap.data()?.balance || 0) + " XAF";
}

/* ------------------------------------------------------
   TRANSACTIONS
-------------------------------------------------------*/
if (saveTxBtn) {
  saveTxBtn.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return;

    const label = txLabel.value;
    const amount = parseInt(txAmount.value);

    if (!label || isNaN(amount))
      return showMessage(txMessage, "Champ manquant.", "error");

    try {
      const walletRef = db.collection("wallets").doc(user.uid);

      await db.runTransaction(async (t) => {
        const wSnap = await t.get(walletRef);
        const oldBal = wSnap.data().balance || 0;
        const newBal = oldBal + amount;
        if (newBal < 0) throw new Error("Solde insuffisant");

        t.update(walletRef, { balance: newBal });
        t.set(db.collection("transactions").doc(), {
          uid: user.uid,
          label,
          amount,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      });

      showMessage(txMessage, "Opération enregistrée.", "success");
      loadTransactions(user.uid);
      loadWallet(user.uid);

    } catch (err) {
      showMessage(txMessage, formatError(err, "Erreur opération."), "error");
    }
  });
}

async function loadTransactions(uid) {
  const list = document.getElementById("historyList");
  const snap = await db.collection("transactions")
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();

  if (snap.empty) {
    list.innerHTML = "<p class='muted'>Aucune opération</p>";
    return;
  }

  list.innerHTML = "";
  snap.forEach((doc) => {
    const t = doc.data();
    const cls = t.amount >= 0 ? "success" : "danger";

    list.innerHTML += `
      <div class="tx-item">
        <span>${t.label}</span>
        <strong class="${cls}">${t.amount} XAF</strong>
      </div>`;
  });
}

/* ------------------------------------------------------
   KYC
-------------------------------------------------------*/
if (sendKycBtn) {
  sendKycBtn.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return;

    const docFile = kycDocFile.files[0];
    const selfie = kycSelfieFile.files[0];

    if (!docFile || !selfie)
      return showMessage(kycMessage, "Fichiers manquants.", "error");

    try {
      const kycId = db.collection("kycRequests").doc().id;

      const docRef = storage.ref(`kyc/${user.uid}/${kycId}_doc`);
      const selfieRef = storage.ref(`kyc/${user.uid}/${kycId}_selfie`);

      await docRef.put(docFile);
      await selfieRef.put(selfie);

      const docURL = await docRef.getDownloadURL();
      const selfieURL = await selfieRef.getDownloadURL();

      await db.collection("kycRequests").doc(kycId).set({
        uid: user.uid,
        docType: kycDocType.value,
        docURL,
        selfieURL,
        status: "pending",
      });

      showMessage(kycMessage, "KYC envoyé.", "success");

    } catch (err) {
      showMessage(kycMessage, formatError(err, "Erreur KYC"), "error");
    }
  });
}

/* ------------------------------------------------------
   CARTE VIRTUELLE
-------------------------------------------------------*/
function renderVirtualCard(data) {
  if (!data) {
    virtualCardBox.innerHTML =
      "<p class='muted small'>Aucune carte virtuelle créée.</p>";
    return;
  }

  const statusClass = data.status === "frozen" ? "frozen" : "active";
  const statusText = data.status === "frozen" ? "Gelée" : "Active";

  virtualCardBox.innerHTML = `
    <div class="virtual-card">
      <div class="virtual-card-row">
        <div>
          <div>${auth.currentUser.email}</div>
        </div>
        <div class="virtual-card-status ${statusClass}">
          ${statusText}
        </div>
      </div>

      <div class="virtual-card-pan">
        •••• •••• •••• ${data.last4}
      </div>

      <div class="virtual-card-row" style="margin-top:.8rem;">
        <span>Limite : ${data.limit} XAF</span>
        <span>${data.currency}</span>
      </div>
    </div>
  `;
}

async function loadVirtualCard(uid) {
  const snap = await db.collection("virtualCards").doc(uid).get();
  renderVirtualCard(snap.exists ? snap.data() : null);
}

if (createVirtualCardBtn) {
  createVirtualCardBtn.addEventListener("click", async () => {
    const user = auth.currentUser;
    const last4 = String(Math.floor(1000 + Math.random() * 9000));

    try {
      await db.collection("virtualCards").doc(user.uid).set({
        last4,
        currency: "XAF",
        status: "active",
        limit: 200000,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      loadVirtualCard(user.uid);
      showMessage(virtualCardMessage, "Carte générée.", "success");
    } catch (err) {
      showMessage(virtualCardMessage, "Erreur création carte.", "error");
    }
  });
}

if (toggleVirtualCardStatusBtn) {
  toggleVirtualCardStatusBtn.addEventListener("click", async () => {
    const user = auth.currentUser;
    const ref = db.collection("virtualCards").doc(user.uid);
    const snap = await ref.get();

    if (!snap.exists)
      return showMessage(virtualCardMessage, "Aucune carte.", "error");

    const newStatus = snap.data().status === "active" ? "frozen" : "active";

    await ref.update({ status: newStatus });
    loadVirtualCard(user.uid);
  });
}
