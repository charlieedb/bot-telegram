const HOURS_IN_MS = 60 * 60 * 1000;
const API_BASE_URL = String(window.NOTICIAS_YA_API_URL || "").replace(/\/+$/, "");

const languageLabels = {
  es: "Espanol",
  en: "Ingles",
  pt: "Portugues",
  de: "Aleman",
};

const tagsContainer = document.getElementById("tagsContainer");
const temaInput = document.getElementById("temaInput");
const frecuenciaSelect = document.getElementById("frecuencia");
const idiomaSelect = document.getElementById("idioma");
const telegramTargetInput = document.getElementById("telegramTarget");
const enabledInput = document.getElementById("enabled");
const saveButton = document.getElementById("saveButton");
const statusText = document.getElementById("status");
const heroFrequency = document.getElementById("heroFrequency");
const heroLanguage = document.getElementById("heroLanguage");
const heroStatus = document.getElementById("heroStatus");

let temas = [];

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function buildFrequencyOptions() {
  for (let hour = 1; hour <= 24; hour += 1) {
    const option = document.createElement("option");
    option.value = String(hour);
    option.textContent = hour === 1 ? "Cada 1 hora" : `Cada ${hour} horas`;
    frecuenciaSelect.appendChild(option);
  }
}

function renderTags() {
  tagsContainer.querySelectorAll(".tag").forEach((tag) => tag.remove());

  temas.forEach((tema, index) => {
    const tag = document.createElement("div");
    tag.className = "tag";
    tag.innerHTML = `<span>${tema}</span>`;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.dataset.index = String(index);
    removeButton.setAttribute("aria-label", `Eliminar ${tema}`);
    removeButton.textContent = "x";

    tag.appendChild(removeButton);
    tagsContainer.insertBefore(tag, temaInput);
  });
}

function syncHero() {
  const selectedHours = Number(frecuenciaSelect.value || "1");

  heroFrequency.textContent =
    selectedHours === 1 ? "Cada 1 hora" : `Cada ${selectedHours} horas`;
  heroLanguage.textContent = languageLabels[idiomaSelect.value] || "Espanol";
  heroStatus.textContent = enabledInput.checked
    ? "Bot activado"
    : "Bot desactivado";
}

function addTag(value) {
  const cleanValue = value.trim();

  if (!cleanValue) {
    return;
  }

  const normalizedValue = cleanValue.toLowerCase();
  const alreadyExists = temas.some(
    (tema) => tema.toLowerCase() === normalizedValue,
  );

  if (alreadyExists) {
    return;
  }

  temas.push(cleanValue);
  renderTags();
}

temaInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === ",") {
    event.preventDefault();
    addTag(temaInput.value.replace(/,$/, ""));
    temaInput.value = "";
  }
});

temaInput.addEventListener("blur", () => {
  addTag(temaInput.value);
  temaInput.value = "";
});

tagsContainer.addEventListener("click", (event) => {
  if (event.target.tagName !== "BUTTON") {
    return;
  }

  const index = Number(event.target.dataset.index);
  temas.splice(index, 1);
  renderTags();
});

frecuenciaSelect.addEventListener("change", syncHero);
idiomaSelect.addEventListener("change", syncHero);
enabledInput.addEventListener("change", syncHero);

async function loadConfig() {
  try {
    const response = await fetch(apiUrl("/api/config"));

    if (!response.ok) {
      throw new Error("No se pudo leer la configuracion");
    }

    const config = await response.json();
    temas = Array.isArray(config.temas) ? config.temas : [];

    const intervalHours = Math.min(
      24,
      Math.max(1, Math.round((Number(config.intervalo) || HOURS_IN_MS) / HOURS_IN_MS)),
    );

    frecuenciaSelect.value = String(intervalHours);
    idiomaSelect.value = config.idioma || "es";
    telegramTargetInput.value = config.telegramTarget || "";
    enabledInput.checked = config.enabled === true;

    renderTags();
    syncHero();
    statusText.textContent = "Configuracion cargada";
  } catch (error) {
    statusText.textContent = "No se pudo cargar la configuracion";
    statusText.className = "status error";
  }
}

async function saveConfig() {
  if (enabledInput.checked && !temas.length) {
    statusText.textContent = "Agrega al menos un tema antes de activar el bot";
    statusText.className = "status error";
    return;
  }

  const config = {
    temas,
    intervalo: Number(frecuenciaSelect.value) * HOURS_IN_MS,
    idioma: idiomaSelect.value,
    enabled: enabledInput.checked,
    telegramTarget: telegramTargetInput.value.trim(),
  };

  try {
    statusText.textContent = "Guardando...";
    statusText.className = "status";

    const response = await fetch(apiUrl("/api/config"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error("No se pudo guardar la configuracion");
    }

    syncHero();
    statusText.textContent = enabledInput.checked
      ? "Configuracion guardada. El bot quedo activado."
      : "Configuracion guardada. El bot quedo desactivado.";
    statusText.className = "status success";
  } catch (error) {
    statusText.textContent = "Error al guardar la configuracion";
    statusText.className = "status error";
  }
}

buildFrequencyOptions();
frecuenciaSelect.value = "1";
syncHero();

saveButton.addEventListener("click", saveConfig);
loadConfig();
