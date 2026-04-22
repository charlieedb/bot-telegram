require("dotenv").config();

const fs = require("fs");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.CHAT_ID;
const sentNewsUrls = [];
const configPath = path.join(__dirname, "config.json");
const sentNewsPath = path.join(__dirname, "sentNews.json");
const NEWS_API_URL = "https://newsapi.org/v2/everything";

let newsInterval = null;
let currentInterval = null;

if (!token) {
  throw new Error("Falta la variable de entorno TELEGRAM_TOKEN");
}

if (!chatId) {
  throw new Error("Falta la variable de entorno CHAT_ID");
}

const bot = new TelegramBot(token, { polling: true });

console.log("Bot iniciado...");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resumenSimple(titulo, descripcion) {
  if (!descripcion) return titulo;

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
      throw new Error("sentNews.json no contiene un array válido");
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

    if (!Array.isArray(config.temas) || !config.temas.length) {
      throw new Error(
        "config.json debe incluir un array 'temas' con al menos un tema",
      );
    }

    if (!config.intervalo || Number(config.intervalo) <= 0) {
      throw new Error("config.json debe incluir un 'intervalo' válido");
    }

    if (!config.idioma) {
      throw new Error("config.json debe incluir un 'idioma' válido");
    }

    return {
      temas: config.temas.filter(
        (tema) => typeof tema === "string" && tema.trim(),
      ),
      intervalo: Number(config.intervalo),
      idioma: String(config.idioma).trim(),
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
    titulo: article.title || "Sin título",
    descripcion: article.description || "Sin descripción",
    url: article.url || "",
  }));
}

bot.on("polling_error", (error) => {
  console.log("Polling error:", error.message);
});

bot.onText(/\/start/, (msg) => {
  console.log("Recibí /start");
  bot.sendMessage(msg.chat.id, "Bienvenido");
});

bot.on("message", (msg) => {
  console.log("Mensaje:", msg.text);
  console.log("CHAT ID:", msg.chat.id);

  if (msg.text === "/start") return;

  bot.sendMessage(msg.chat.id, "Recibido");
});

bot.onText(/\/news/, async () => {
  await sendLatestConfiguredNews();
});

async function sendLatestConfiguredNews() {
  const config = readConfig();

  if (!config) {
    return;
  }

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

      if (sentNewsUrls.includes(firstNews.url)) {
        continue;
      }

      const summary = resumenSimple(firstNews.titulo, firstNews.descripcion);
      const message = `📰 (${tema})

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
  }
}

function startNewsInterval() {
  const config = readConfig();

  if (!config) {
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

loadSentNews();
startNewsInterval();
sendLatestConfiguredNews();
setInterval(startNewsInterval, 5000);
