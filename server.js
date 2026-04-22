const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const {
  handleWebhookUpdate,
  initializeBot,
  mode: botMode,
  webhookPath,
} = require("./bot");

const app = express();
const PORT = process.env.PORT || 3000;
const configPath = path.join(__dirname, "config.json");
const shouldStartBot = process.env.RUN_BOT !== "false";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

if (!fs.existsSync(configPath)) {
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        temas: [],
        intervalo: 60000,
        idioma: "es",
        enabled: false,
      },
      null,
      2,
    ),
  );
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/health", (req, res) => {
  res.json({ ok: true, botMode, botEnabled: shouldStartBot });
});

app.get("/config", (req, res) => {
  fs.readFile(configPath, "utf8", (error, data) => {
    if (error) {
      return res.status(500).json({ error: "No se pudo leer config.json" });
    }

    try {
      const config = JSON.parse(data);
      return res.json(config);
    } catch (parseError) {
      return res
        .status(500)
        .json({ error: "config.json no contiene un JSON valido" });
    }
  });
});

app.post("/config", (req, res) => {
  const { temas, intervalo, idioma, enabled } = req.body;

  if (!Array.isArray(temas) || !intervalo || !idioma || typeof enabled !== "boolean") {
    return res.status(400).json({
      error:
        "Formato invalido. Se espera { temas: [], intervalo: number, idioma: string, enabled: boolean }",
    });
  }

  const newConfig = { temas, intervalo, idioma, enabled };

  fs.writeFile(
    configPath,
    JSON.stringify(newConfig, null, 2),
    "utf8",
    (error) => {
      if (error) {
        return res
          .status(500)
          .json({ error: "No se pudo actualizar config.json" });
      }

      return res.json({
        message: "config.json actualizado correctamente",
        config: newConfig,
      });
    },
  );
});

app.post(webhookPath, handleWebhookUpdate);

app.listen(PORT, async () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);

  if (!shouldStartBot) {
    console.log("Inicio del bot deshabilitado con RUN_BOT=false");
    return;
  }

  try {
    await initializeBot();
  } catch (error) {
    console.error("El servidor web sigue activo, pero el bot no pudo iniciar:");
    console.error(error.message);
  }
});
