const NEWS_API_URL = "https://newsapi.org/v2/everything";

async function getNewsByQuery(query) {
  const apiKey = process.env.NEWS_API_KEY;

  if (!apiKey) {
    throw new Error("Falta la variable de entorno NEWS_API_KEY");
  }

  if (!query || !query.trim()) {
    throw new Error("La búsqueda no puede estar vacía");
  }

  const url = new URL(NEWS_API_URL);
  url.searchParams.set("q", query.trim());
  url.searchParams.set("language", "es");
  url.searchParams.set("pageSize", "5");

  try {
    const response = await fetch(url, {
      headers: {
        "X-Api-Key": apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Error al consultar NewsAPI: ${response.status}`);
    }

    const data = await response.json();

    if (!data.articles || !Array.isArray(data.articles)) {
      return [];
    }

    return data.articles.map((article) => ({
      titulo: article.title || "Sin título",
      descripcion: article.description || "Sin descripción",
      url: article.url || "",
    }));
  } catch (error) {
    console.error("Error obteniendo noticias:", error.message);
    return [];
  }
}

module.exports = {
  getNewsByQuery,
};
