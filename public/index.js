const HOURS_IN_MS = 60 * 60 * 1000;
const DEFAULT_ALLOWED_ORIGINS = ["https://noticias-ya.web.app"];
const BACKEND_URL = "https://noticiasya-backend.onrender.com";

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
const botEnabledInput = document.getElementById("botEnabled");
const botModeSelect = document.getElementById("botMode");
const allowedOriginsInput = document.getElementById("allowedOrigins");
const refreshTimeInput = document.getElementById("refreshTime");
const saveButton = document.getElementById("saveButton");
const statusText = document.getElementById("status");
const heroFrequency = document.getElementById("heroFrequency");
const heroLanguage = document.getElementById("heroLanguage");
const heroStatus = document.getElementById("heroStatus");

let temas = [];

function apiUrl(path) {
  return `${BACKEND_URL}${path}`;
}

function setStatus(message, type = "") {
  if (!statusText) {
    return;
  }

  statusText.textContent = message;
  statusText.className = type ? `status ${type}` : "status";
}

function buildFrequencyOptions() {
  if (!frecuenciaSelect || frecuenciaSelect.options.length) {
    return;
  }

  for (let hour = 1; hour <= 24; hour += 1) {
    const option = document.createElement("option");
    option.value = String(hour);
    option.textContent = hour === 1 ? "Cada 1 hora" : `Cada ${hour} horas`;
    frecuenciaSelect.appendChild(option);
  }
}

function renderTags() {
  if (!tagsContainer || !temaInput) {
    return;
  }

  tagsContainer.querySelectorAll(".tag").forEach((tag) => tag.remove());

  temas.forEach((tema, index) => {
    const tag = document.createElement("div");
    tag.className = "tag";

    const label = document.createElement("span");
    label.textContent = tema;
    tag.appendChild(label);

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
  const selectedHours = Number(frecuenciaSelect?.value || "1");

  if (heroFrequency) {
    heroFrequency.textContent =
      selectedHours === 1 ? "Cada 1 hora" : `Cada ${selectedHours} horas`;
  }

  if (heroLanguage) {
    heroLanguage.textContent = languageLabels[idiomaSelect?.value] || "Espanol";
  }

  if (heroStatus) {
    heroStatus.textContent = enabledInput?.checked ? "Bot activado" : "Bot desactivado";
  }
}

function addTag(value) {
  const cleanValue = String(value || "").trim();

  if (!cleanValue) {
    return;
  }

  const normalizedValue = cleanValue.toLowerCase();
  const alreadyExists = temas.some(
    (tema) => String(tema).toLowerCase() === normalizedValue,
  );

  if (alreadyExists) {
    return;
  }

  temas.push(cleanValue);
  renderTags();
}

function parseAllowedOrigins(value) {
  const source = String(value || "").trim();

  if (!source) {
    return [...DEFAULT_ALLOWED_ORIGINS];
  }

  return source
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function readConfigFromDom() {
  const refreshTime = Number(refreshTimeInput?.value || frecuenciaSelect?.value || "1");
  const enabled = enabledInput?.checked === true;
  const config = {
    temas: Array.isArray(temas) ? temas.filter(Boolean) : [],
    intervalo: Math.max(1, refreshTime) * HOURS_IN_MS,
    idioma: idiomaSelect?.value || "es",
    enabled,
    telegramTarget: String(telegramTargetInput?.value || "").trim(),
    botEnabled: enabled,
    botMode: botModeSelect?.value || "webhook",
    allowedOrigins: parseAllowedOrigins(allowedOriginsInput?.value),
    refreshTime: Math.max(1, refreshTime),
  };

  if (botEnabledInput) {
    botEnabledInput.value = String(config.botEnabled);
  }

  return config;
}

function applyConfigToDom(config) {
  temas = Array.isArray(config.temas) ? config.temas.filter(Boolean) : [];

  const refreshTime = Math.min(
    24,
    Math.max(
      1,
      Number(config.refreshTime) ||
        Math.round((Number(config.intervalo) || HOURS_IN_MS) / HOURS_IN_MS),
    ),
  );

  if (frecuenciaSelect) {
    frecuenciaSelect.value = String(refreshTime);
  }

  if (idiomaSelect) {
    idiomaSelect.value = config.idioma || "es";
  }

  if (telegramTargetInput) {
    telegramTargetInput.value = config.telegramTarget || "";
  }

  if (enabledInput) {
    enabledInput.checked = config.enabled === true || config.botEnabled === true;
  }

  if (botEnabledInput) {
    botEnabledInput.value = String(enabledInput?.checked === true);
  }

  if (botModeSelect) {
    botModeSelect.value = config.botMode || "webhook";
  }

  if (allowedOriginsInput) {
    const origins = Array.isArray(config.allowedOrigins)
      ? config.allowedOrigins
      : DEFAULT_ALLOWED_ORIGINS;
    allowedOriginsInput.value = origins.join(", ");
  }

  if (refreshTimeInput) {
    refreshTimeInput.value = String(refreshTime);
  }

  renderTags();
  syncHero();
}

function validateConfig(config) {
  if (!config || typeof config !== "object") {
    throw new Error("La configuracion no es valida");
  }

  if (!Array.isArray(config.temas)) {
    throw new Error("Los temas deben enviarse como array");
  }

  if (config.enabled && config.temas.length === 0) {
    throw new Error("Agrega al menos un tema antes de activar el bot");
  }

  if (!Number.isFinite(config.refreshTime) || config.refreshTime < 1 || config.refreshTime > 24) {
    throw new Error("Refresh time debe estar entre 1 y 24 horas");
  }

  if (!Number.isFinite(config.intervalo) || config.intervalo <= 0) {
    throw new Error("La frecuencia no es valida");
  }

  if (!Array.isArray(config.allowedOrigins) || !config.allowedOrigins.length) {
    throw new Error("Debe existir al menos un allowed origin");
  }
}

async function guardarConfiguracion(config) {
  validateConfig(config);

  const response = await fetch(apiUrl("/config"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage = data?.error || "No se pudo guardar la configuracion";
    throw new Error(errorMessage);
  }

  return data;
}

async function loadConfig() {
  try {
    setStatus("Cargando configuracion...");

    const response = await fetch(apiUrl("/config"), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("No se pudo leer la configuracion");
    }

    const config = await response.json();
    applyConfigToDom(config);
    setStatus("Configuracion cargada", "success");
  } catch (error) {
    console.error(error);
    applyConfigToDom({
      allowedOrigins: DEFAULT_ALLOWED_ORIGINS,
      botMode: "webhook",
      refreshTime: 1,
    });
    setStatus("No se pudo cargar la configuracion", "error");
  }
}

async function handleSaveClick() {
  try {
    const config = readConfigFromDom();
    setStatus("Guardando configuracion...");

    const result = await guardarConfiguracion(config);
    applyConfigToDom(result?.config || config);
    setStatus("Configuracion guardada correctamente", "success");
    console.log("Configuracion guardada", result?.config || config);
    window.alert("Configuracion guardada correctamente");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Error al guardar la configuracion", "error");
    window.alert(error.message || "Error al guardar la configuracion");
  }
}

if (temaInput) {
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
}

if (tagsContainer) {
  tagsContainer.addEventListener("click", (event) => {
    if (event.target.tagName !== "BUTTON") {
      return;
    }

    const index = Number(event.target.dataset.index);

    if (Number.isNaN(index)) {
      return;
    }

    temas.splice(index, 1);
    renderTags();
  });
}

frecuenciaSelect?.addEventListener("change", () => {
  if (refreshTimeInput) {
    refreshTimeInput.value = frecuenciaSelect.value;
  }
  syncHero();
});

refreshTimeInput?.addEventListener("change", () => {
  const nextValue = String(
    Math.min(24, Math.max(1, Number(refreshTimeInput.value || "1"))),
  );
  refreshTimeInput.value = nextValue;
  if (frecuenciaSelect) {
    frecuenciaSelect.value = nextValue;
  }
  syncHero();
});

idiomaSelect?.addEventListener("change", syncHero);
enabledInput?.addEventListener("change", () => {
  if (botEnabledInput) {
    botEnabledInput.value = String(enabledInput.checked);
  }
  syncHero();
});

buildFrequencyOptions();
applyConfigToDom({
  allowedOrigins: DEFAULT_ALLOWED_ORIGINS,
  botMode: "webhook",
  refreshTime: 1,
});

saveButton?.addEventListener("click", handleSaveClick);
loadConfig();
