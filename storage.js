require("dotenv").config();

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const configPath = path.join(__dirname, "config.json");
const sentNewsPath = path.join(__dirname, "sentNews.json");
const firestoreCollection = "config";
const configDocId = "global";
const legacyFirestoreCollection = "botTelegram";
const legacyConfigDocId = "config";
const sentNewsDocId = "sentNews";

function defaultConfig() {
  return {
    temas: [],
    intervalo: 60 * 60 * 1000,
    idioma: "es",
    enabled: false,
    telegramTarget: "",
    botEnabled: false,
    botMode: "webhook",
    allowedOrigins: [],
    refreshTime: 60,
  };
}

function getFirebaseCredentials() {
  const projectId = String(process.env.FIREBASE_PROJECT_ID || "").trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || "").trim();
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || "")
    .replace(/\\n/g, "\n")
    .trim();

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

function getFirestoreDb() {
  const credentials = getFirebaseCredentials();

  if (!credentials) {
    return null;
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: credentials.projectId,
        clientEmail: credentials.clientEmail,
        privateKey: credentials.privateKey,
      }),
    });
  }

  return admin.firestore();
}

function getStorageMode() {
  return getFirestoreDb() ? "firestore" : "filesystem";
}

function ensureLocalFile(filePath, fallbackData) {
  if (fs.existsSync(filePath)) {
    return;
  }

  fs.writeFileSync(filePath, JSON.stringify(fallbackData, null, 2), "utf8");
}

async function readConfig() {
  const db = getFirestoreDb();

  if (db) {
    const doc = await db.collection(firestoreCollection).doc(configDocId).get();

    if (!doc.exists) {
      const legacyDoc = await db
        .collection(legacyFirestoreCollection)
        .doc(legacyConfigDocId)
        .get();

      if (legacyDoc.exists) {
        const migratedConfig = {
          ...defaultConfig(),
          ...legacyDoc.data(),
        };
        await writeConfig(migratedConfig);
        return migratedConfig;
      }

      const initialConfig = defaultConfig();
      await writeConfig(initialConfig);
      return initialConfig;
    }

    return {
      ...defaultConfig(),
      ...doc.data(),
    };
  }

  ensureLocalFile(configPath, defaultConfig());
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

async function writeConfig(config) {
  const db = getFirestoreDb();

  if (db) {
    const mergedConfig = {
      ...defaultConfig(),
      ...config,
    };

    await db
      .collection(firestoreCollection)
      .doc(configDocId)
      .set(mergedConfig, { merge: true });

    return mergedConfig;
  }

  const mergedConfig = {
    ...defaultConfig(),
    ...config,
  };

  fs.writeFileSync(configPath, JSON.stringify(mergedConfig, null, 2), "utf8");
  return mergedConfig;
}

async function readSentNews() {
  const db = getFirestoreDb();

  if (db) {
    const doc = await db.collection(firestoreCollection).doc(sentNewsDocId).get();
    const urls = doc.exists ? doc.data().urls : [];
    return Array.isArray(urls) ? urls.filter((url) => typeof url === "string") : [];
  }

  ensureLocalFile(sentNewsPath, []);
  const data = JSON.parse(fs.readFileSync(sentNewsPath, "utf8"));
  return Array.isArray(data) ? data.filter((url) => typeof url === "string") : [];
}

async function writeSentNews(urls) {
  const safeUrls = Array.isArray(urls)
    ? urls.filter((url) => typeof url === "string").slice(-50)
    : [];
  const db = getFirestoreDb();

  if (db) {
    await db
      .collection(firestoreCollection)
      .doc(sentNewsDocId)
      .set({ urls: safeUrls });
    return safeUrls;
  }

  fs.writeFileSync(sentNewsPath, JSON.stringify(safeUrls, null, 2), "utf8");
  return safeUrls;
}

module.exports = {
  defaultConfig,
  getStorageMode,
  readConfig,
  readSentNews,
  writeConfig,
  writeSentNews,
};
