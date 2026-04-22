import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyAhS3NVcXcNCWEvqvnBhn44LC3sq8EEwTs",
  authDomain: "noticias-ya.firebaseapp.com",
  projectId: "noticias-ya",
  storageBucket: "noticias-ya.firebasestorage.app",
  messagingSenderId: "489350663857",
  appId: "1:489350663857:web:fc2ee6d1dca6d6ae49dc90",
  measurementId: "G-E0MBVVV9CH",
};

const app = initializeApp(firebaseConfig);

let analytics = null;

isSupported()
  .then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
      window.noticiasYaFirebase = { app, analytics, firebaseConfig };
      return;
    }

    window.noticiasYaFirebase = { app, analytics: null, firebaseConfig };
  })
  .catch(() => {
    window.noticiasYaFirebase = { app, analytics: null, firebaseConfig };
  });

export { app, analytics, firebaseConfig };
