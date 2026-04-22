const OPENAI_API_URL = "https://api.openai.com/v1/responses";

async function generateNewsSummary(titulo, descripcion) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Falta la variable de entorno OPENAI_API_KEY");
  }

  if (!titulo || !descripcion) {
    throw new Error(
      "Se requieren titulo y descripcion para generar el resumen",
    );
  }

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "Genera resúmenes breves en español, con tono claro y directo. Máximo 3 líneas.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Título: ${titulo}\nDescripción: ${descripcion}`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Error en OpenAI: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.output_text?.trim();

    if (!summary) {
      throw new Error("No se pudo generar el resumen");
    }

    return summary;
  } catch (error) {
    console.error("Error generando resumen:", error.message);
    return "No se pudo generar el resumen.";
  }
}

module.exports = {
  generateNewsSummary,
};
