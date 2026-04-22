const express = require("express");
const cors = require("cors");
const { defaultConfig, getStorageMode, readConfig, writeConfig } = require("./storage");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const shouldStartBot = process.env.RUN_BOT !== "false";
const defaultWebhookPath =
  process.env.TELEGRAM_WEBHOOK_PATH || "/telegram/webhook";
const allowedLanguages = new Set(["es", "en", "pt", "de"]);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

let botRuntime = {
  botEnabled: shouldStartBot,
  botInitialized: false,
  botMode: "disabled",
  webhookPath: defaultWebhookPath,
  handleWebhookUpdate: null,
};

function normalizeConfig(input) {
  return {
    temas: Array.isArray(input.temas)
      ? input.temas
          .map((tema) => String(tema).trim())
          .filter(Boolean)
          .slice(0, 30)
      : [],
    intervalo: Number(input.intervalo),
    idioma: String(input.idioma || "").trim().toLowerCase(),
    enabled: input.enabled === true,
    telegramTarget: String(input.telegramTarget || "").trim(),
  };
}

function validateConfig(config) {
  if (!Array.isArray(config.temas)) {
    return "El campo 'temas' debe ser un array";
  }

  if (!Number.isFinite(config.intervalo) || config.intervalo <= 0) {
    return "El campo 'intervalo' debe ser un numero mayor a 0";
  }

  if (!allowedLanguages.has(config.idioma)) {
    return "El campo 'idioma' debe ser uno de: es, en, pt, de";
  }

  if (typeof config.enabled !== "boolean") {
    return "El campo 'enabled' debe ser booleano";
  }

  if (typeof config.telegramTarget !== "string") {
    return "El campo 'telegramTarget' debe ser texto";
  }

  return null;
}

function corsOriginResolver(origin, callback) {
  if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error("Origen no permitido por CORS"));
}

app.use(
  cors({
    origin: corsOriginResolver,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "backend",
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    env: process.env.RENDER ? "render" : "local",
    botEnabled: botRuntime.botEnabled,
    botInitialized: botRuntime.botInitialized,
    botMode: botRuntime.botMode,
    storageMode: getStorageMode(),
    allowedOrigins,
  });
});

async function handleGetConfig(req, res) {
  try {
    return res.json(normalizeConfig(await readConfig()));
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "No se pudo leer la configuracion",
      detail: error.message,
    });
  }
}

async function handlePostConfig(req, res) {
  try {
    const newConfig = normalizeConfig(req.body);
    const validationError = validateConfig(newConfig);

    if (validationError) {
      return res.status(400).json({
        ok: false,
        error: validationError,
      });
    }

    await writeConfig(newConfig);

    return res.json({
      ok: true,
      message: "Configuracion actualizada correctamente",
      config: newConfig,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "No se pudo actualizar la configuracion",
      detail: error.message,
    });
  }
}

app.get("/config", handleGetConfig);
app.post("/config", handlePostConfig);
app.get("/api/config", handleGetConfig);
app.post("/api/config", handlePostConfig);

app.post(defaultWebhookPath, async (req, res) => {
  if (!botRuntime.handleWebhookUpdate) {
    return res.status(503).json({
      ok: false,
      error: "Bot no inicializado",
    });
  }

  return botRuntime.handleWebhookUpdate(req, res);
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Endpoint no encontrado",
  });
});

app.use((error, req, res, next) => {
  if (error.message === "Origen no permitido por CORS") {
    return res.status(403).json({
      ok: false,
      error: error.message,
    });
  }

  console.error(error);

  return res.status(500).json({
    ok: false,
    error: "Error interno del servidor",
  });
});

async function initializeBotRuntime() {
  if (!shouldStartBot) {
    console.log("Inicio del bot deshabilitado con RUN_BOT=false");
    return;
  }

  try {
    const botModule = require("./bot");

    botRuntime = {
      botEnabled: true,
      botInitialized: true,
      botMode: botModule.mode,
      webhookPath: botModule.webhookPath,
      handleWebhookUpdate: botModule.handleWebhookUpdate,
    };

    await botModule.initializeBot();
  } catch (error) {
    botRuntime = {
      ...botRuntime,
      botEnabled: true,
      botInitialized: false,
      botMode: "error",
    };

    console.error("El backend sigue activo, pero el bot no pudo iniciar:");
    console.error(error.message);
  }
}

app.listen(PORT, async () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
  await initializeBotRuntime();
});
