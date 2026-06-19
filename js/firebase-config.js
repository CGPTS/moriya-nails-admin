// ============================================
// Firebase Configuration - Moriya Nails
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyClcUTTtYxlct54ZJUEDiwmUT2uA8TB_hY",
  authDomain: "network-manage-558fd.firebaseapp.com",
  projectId: "network-manage-558fd",
  storageBucket: "network-manage-558fd.firebasestorage.app",
  messagingSenderId: "642738576075",
  appId: "1:642738576075:web:4154457b456bb48157594e",
  measurementId: "G-QVQLVFGVGE"
};

firebase.initializeApp(firebaseConfig);

// Optional App Check.
// Production domain: https://cgpts.github.io/Motiya_Cosmetics/
// Put the reCAPTCHA v3 site key here after registering this app in Firebase App Check.
const APP_CHECK_SITE_KEY = "6LeNECItAAAAABWk6pWK8K09SLW0euzhT63exvht";
const APP_CHECK_ALLOWED_HOSTS = ["cgpts.github.io"];
const APP_CHECK_IS_LOCAL = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const APP_CHECK_SHOULD_ACTIVATE = APP_CHECK_SITE_KEY && APP_CHECK_ALLOWED_HOSTS.includes(window.location.hostname);

if (APP_CHECK_SHOULD_ACTIVATE) {
  firebase.appCheck().activate(APP_CHECK_SITE_KEY, true);
} else if (!APP_CHECK_IS_LOCAL && !APP_CHECK_SITE_KEY) {
  console.warn("Firebase App Check is not active: missing reCAPTCHA v3 site key.");
}

const db = firebase.firestore();
console.log("🔥 Moriya Nails Firebase initialized");

const auth = firebase.auth();
