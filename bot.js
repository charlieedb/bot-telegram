require("dotenv").config();

const fs = require("fs");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.CHAT_ID;
const configuredMode = (process.env.TELEGRAM_MODE || "").trim().toLowerCase();
const pollingEnabled = process.env.TELEGRAM_POLLING === "true";
const webhookPath = process.env.TELEGRAM_WEBHOOK_PATH || "/telegram/webhook";
const webhookSecret =
  process.env.TELEGRAM_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || "";
const sentNewsUrls = [];
const configPath = path.join(__dirname, "config.json");
const sentNewsPath = path.join(__dirname, "sentNews.json");
const NEWS_API_URL = "https://newsapi.org/v2/everything";

let newsInterval = null;
let currentInterval = null;
let isSending = false;
let handlersRegistered = false;

if (!token) {
  throw new Error("Falta la variable de entorno TELEGRAM_TOKEN");
}

if (!chatId) {
  throw new Error("Falta la variable de entorno CHAT_ID");
}

function resolveMode() {
  if (configuredMode) {
    return configuredMode;
  }

  if (pollingEnabled) {
    return "polling";
  }

  if (process.env.TELEGRAM_WEBHOOK_URL || process.env.RENDER_EXTERNAL_URL) {
    return "webhook";
  }

  return "send-only";
}

const mode = resolveMode();
const bot = new TelegramBot(token, { polling: mode === "polling" });

console.log(`Bot iniciado en modo ${mode}.`);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resumenSimple(titulo, descripcion) {
  if (!descripcion) {
    return titulo;
  }

  let resumen = descripcion.slice(0, 200);
  const lastSpace = resumen.lastIndexOf(" ");

  if (lastSpace > 0) {
    resumen = resumen.slice(0, lastSpace);
  }

  return `${resumen}...`;
}

function loadSentNews() {
  try {
    if (!fs.existsSync(sentNewsPath)) {
      fs.writeFileSync(sentNewsPath, JSON.stringify([], null, 2), "utf8");
    }

    const data = fs.readFileSync(sentNewsPath, "utf8");
    const parsedData = JSON.parse(data);

    if (!Array.isArray(parsedData)) {
      throw new Error("sentNews.json no contiene un array valido");
    }

    sentNewsUrls.length = 0;
    sentNewsUrls.push(...parsedData.filter((url) => typeof url === "string"));

    if (sentNewsUrls.length > 50) {
      sentNewsUrls.splice(0, sentNewsUrls.length - 50);
      saveSentNews();
    }
  } catch (error) {
    console.log("Error cargando sentNews.json:", error.message);
    sentNewsUrls.length = 0;

    try {
      fs.writeFileSync(sentNewsPath, JSON.stringify([], null, 2), "utf8");
    } catch (writeError) {
      console.log("Error recreando sentNews.json:", writeError.message);
    }
  }
}

function saveSentNews() {
  try {
    fs.writeFileSync(
      sentNewsPath,
      JSON.stringify(sentNewsUrls, null, 2),
      "utf8",
    );
  } catch (error) {
    console.log("Error guardando sentNews.json:", error.message);
  }
}

function readConfig() {
  try {
    const data = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(data);

    if (!Array.isArray(config.temas)) {
      throw new Error("config.json debe incluir un array 'temas'");
    }

    if (!config.intervalo || Number(config.intervalo) <= 0) {
      throw new Error("config.json debe incluir un 'intervalo' valido");
    }

    if (!config.idioma) {
      throw new Error("config.json debe incluir un 'idioma' valido");
    }

    return {
      temas: config.temas.filter(
        (tema) => typeof tema === "string" && tema.trim(),
      ),
      intervalo: Number(config.intervalo),
      idioma: String(config.idioma).trim(),
      enabled: config.enabled === true,
    };
  } catch (error) {
    console.log("Error leyendo config.json:", error.message);
    return null;
  }
}

async function getNewsByQuery(query, language) {
  const apiKey = process.env.NEWS_API_KEY;

  if (!apiKey) {
    throw new Error("Falta la variable de entorno NEWS_API_KEY");
  }

  const url = new URL(NEWS_API_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("language", language);
  url.searchParams.set("pageSize", "5");
  url.searchParams.set("sortBy", "publishedAt");

  const response = await fetch(url, {
    headers: {
      "X-Api-Key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Error al consultar NewsAPI: ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data.articles)) {
    return [];
  }

  return data.articles.map((article) => ({
    titulo: article.title || "Sin titulo",
    descripcion: article.description || "Sin descripcion",
    url: article.url || "",
  }));
}

function registerBotHandlers() {
  if (handlersRegistered) {
    return;
  }

  handlersRegistered = true;

  bot.on("polling_error", (error) => {
    console.log("Polling error:", error.message);
  });

  bot.on("webhook_error", (error) => {
    console.log("Webhook error:", error.message);
  });

  bot.onText(/\/start/, (msg) => {
    console.log("Recibi /start");
    bot.sendMessage(msg.chat.id, "Bienvenido");
  });

  bot.on("message", (msg) => {
    console.log("Mensaje:", msg.text);
    console.log("CHAT ID:", msg.chat.id);

    if (msg.text === "/start") {
      return;
    }

    bot.sendMessage(msg.chat.id, "Recibido");
  });

  bot.onText(/\/news/, async () => {
    await sendLatestConfiguredNews();
  });
}

async function sendLatestConfiguredNews() {
  if (isSending) {
    return;
  }

  const config = readConfig();

  if (!config) {
    return;
  }

  if (!config.enabled) {
    return;
  }

  if (!config.temas.length) {
    console.log("El envio automatico esta activo, pero no hay temas configurados.");
    return;
  }

  isSending = true;
  const temas = config.temas.slice(0, 10);
  let hasChanges = false;

  try {
    for (const tema of temas) {
      const news = await getNewsByQuery(tema, config.idioma);

      if (!news.length) {
        console.log(`No se encontraron noticias sobre ${tema}.`);
        continue;
      }

      const firstNews = news.find(
        (article) => article.url && !sentNewsUrls.includes(article.url),
      );

      if (!firstNews) {
        console.log(`Todas las noticias de ${tema} ya fueron enviadas.`);
        continue;
      }

      const summary = resumenSimple(firstNews.titulo, firstNews.descripcion);
      const message = `(${tema})

${firstNews.titulo}

Resumen:
${summary}

Fuente:
${firstNews.url}`;

      await bot.sendMessage(chatId, message);
      await sleep(1200);

      sentNewsUrls.push(firstNews.url);
      hasChanges = true;

      if (sentNewsUrls.length > 50) {
        sentNewsUrls.shift();
      }
    }

    if (hasChanges) {
      saveSentNews();
    }
  } catch (error) {
    console.log("Error enviando noticia:", error.message);
  } finally {
    isSending = false;
  }
}

function startNewsInterval() {
  const config = readConfig();

  if (!config) {
    return;
  }

  if (!config.enabled) {
    if (newsInterval) {
      clearInterval(newsInterval);
      newsInterval = null;
    }

    currentInterval = null;
    return;
  }

  if (!config.temas.length) {
    console.log("No se inicia el intervalo porque no hay temas configurados.");
    return;
  }

  if (newsInterval && currentInterval === config.intervalo) {
    return;
  }

  if (newsInterval) {
    clearInterval(newsInterval);
  }

  currentInterval = config.intervalo;
  newsInterval = setInterval(sendLatestConfiguredNews, currentInterval);
}

function getWebhookUrl() {
  const baseUrl =
    process.env.TELEGRAM_WEBHOOK_URL || process.env.RENDER_EXTERNAL_URL || "";

  if (!baseUrl) {
    return "";
  }

  return `${baseUrl.replace(/\/+$/, "")}${webhookPath}`;
}

async function initializeBot() {
  registerBotHandlers();
  loadSentNews();
  startNewsInterval();
  setInterval(startNewsInterval, 5000);

  if (mode === "polling") {
    try {
      await bot.deleteWebHook({ drop_pending_updates: false });
      console.log("Webhook removido para usar polling.");
    } catch (error) {
      console.log("No se pudo limpiar el webhook:", error.message);
    }

    return;
  }

  if (mode !== "webhook") {
    return;
  }

  const webhookUrl = getWebhookUrl();

  if (!webhookUrl) {
    console.log(
      "Modo webhook sin URL publica. Configura TELEGRAM_WEBHOOK_URL o RENDER_EXTERNAL_URL.",
    );
    return;
  }

  try {
    await bot.setWebHook(webhookUrl, {
      drop_pending_updates: true,
      secret_token: webhookSecret || undefined,
    });
    console.log(`Webhook registrado en ${webhookPath}`);
  } catch (error) {
    console.log("No se pudo registrar el webhook:", error.message);
  }
}

function verifyWebhookRequest(req) {
  if (!webhookSecret) {
    return true;
  }

  return req.get("X-Telegram-Bot-Api-Secret-Token") === webhookSecret;
}

async function handleWebhookUpdate(req, res) {
  if (!verifyWebhookRequest(req)) {
    return res.status(401).json({ error: "Webhook secret invalido" });
  }

  try {
    await bot.processUpdate(req.body);
    return res.sendStatus(200);
  } catch (error) {
    console.log("Error procesando webhook:", error.message);
    return res.sendStatus(500);
  }
}

module.exports = {
  bot,
  handleWebhookUpdate,
  initializeBot,
  mode,
  webhookPath,
};
