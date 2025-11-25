
// Configuration Firebase CONNECTÉE à ton projet
const firebaseConfig = {
  apiKey: "AIzaSyDwZQvRhV0_ld3wGnGza0ulMK8U3ErdXMk",
  authDomain: "banque-digitale.firebaseapp.com",
  projectId: "banque-digitale",
  storageBucket: "banque-digitale.firebasestorage.app",
  messagingSenderId: "1082571970554",
  appId: "1:1082571970554:web:d836ea32bfa1216b73b643"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
