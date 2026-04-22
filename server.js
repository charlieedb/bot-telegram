const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const configPath = path.join(__dirname, "config.json");

const cors = require("cors");
app.use(cors());

app.use(express.json());

if (!fs.existsSync(configPath)) {
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        temas: ["tecnologia"],
        intervalo: 60000,
        idioma: "es",
      },
      null,
      2,
    ),
  );
}

app.get("/config", (req, res) => {
  fs.readFile(configPath, "utf8", (error, data) => {
    if (error) {
      return res.status(500).json({ error: "No se pudo leer config.json" });
    }

    try {
      const config = JSON.parse(data);
      res.json(config);
    } catch (parseError) {
      res.status(500).json({ error: "config.json no contiene un JSON válido" });
    }
  });
});

app.post("/config", (req, res) => {
  const { temas, intervalo, idioma } = req.body;

  if (!Array.isArray(temas) || !intervalo || !idioma) {
    return res.status(400).json({
      error:
        "Formato inválido. Se espera { temas: [], intervalo: number, idioma: string }",
    });
  }

  const newConfig = { temas, intervalo, idioma };

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

      res.json({
        message: "config.json actualizado correctamente",
        config: newConfig,
      });
    },
  );
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
});
