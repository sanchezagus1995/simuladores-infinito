(function () {
  const BCRA_BASE = "https://api.bcra.gob.ar/centraldedeudores/v1.0";

  function cleanDigits(s) {
    return String(s || "").replace(/\D/g, "");
  }

  function fmtARS(n) {
    if (!Number.isFinite(n)) return "—";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 2,
    }).format(n);
  }

  function fmtDateAR(iso) {
    if (!iso) return "—";
    const [y, m, d] = String(iso).split("-");
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  }

  function situacionLabel(n) {
    const map = {
      1: "Normal",
      2: "Riesgo bajo",
      3: "Riesgo medio",
      4: "Riesgo alto",
      5: "Irrecuperable",
      6: "Irrecuperable (disp. técnica)",
    };
    return map[n] ?? String(n ?? "—");
  }

  function badgeClassFromSituacion(n) {
    const s = Number(n);
    if (!Number.isFinite(s)) return "warn";
    if (s <= 1) return "ok";
    if (s === 2) return "warn";
    return "bad";
  }

  function badgeTextFromSituacion(n) {
    const s = Number(n);
    if (!Number.isFinite(s)) return "Sin dato";
    if (s <= 1) return "Apto";
    if (s === 2) return "Revisar";
    return "Riesgo";
  }

  function renderBcraTable(entidades = []) {
    if (!entidades.length) {
      return `<div class="muted">Sin entidades informadas en el período.</div>`;
    }

    const rows = entidades
      .map((e) => {
        const entidad = e.entidad ?? "—";
        const sitNum = Number(e.situacion);
        const fecha = fmtDateAR(e.fechaSit1);
        const monto = fmtARS(Number(e.monto) || 0);
        const atraso = e.diasAtrasoPago ?? 0;

        const flags = [];
        if (e.refinanciaciones) flags.push("Refinanciación");
        if (e.recategorizacionOblig) flags.push("Recateg. oblig.");
        if (e.irrecDisposicionTecnica) flags.push("Irrec. disp. técnica");
        if (e.procesoJud) flags.push("Proceso judicial");
        if (e.enRevision) flags.push("En revisión");

        const flagsTxt = flags.length ? flags.join(", ") : "—";

        return `
          <tr>
            <td>${entidad}</td>
            <td>${situacionLabel(sitNum)}</td>
            <td>${fecha}</td>
            <td style="text-align:right;">${monto}</td>
            <td style="text-align:right;">${atraso}</td>
            <td>${flagsTxt}</td>
          </tr>
        `;
      })
      .join("");

    return `
      <div class="bcra-table-wrap">
        <table class="bcra-table">
          <thead>
            <tr>
              <th>Entidad</th>
              <th>Situación</th>
              <th>Fecha</th>
              <th style="text-align:right;">Monto</th>
              <th style="text-align:right;">Días atraso</th>
              <th>Alertas</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  function buildMarkup(instanceId) {
    return `
      <section class="card bcra-card">
        <h2 class="bcra-title">Situación crediticia</h2>

        <div class="bcra-grid">
          <label class="bcra-label">
            CUIL / CUIT / CDI
            <input
              id="${instanceId}-cuil"
              class="bcra-input"
              type="text"
              inputmode="numeric"
              placeholder="11 dígitos"
            >
          </label>
        </div>

        <div class="bcra-row">
          <button id="${instanceId}-btn" class="bcra-btn" type="button">
            Consultar BCRA
          </button>
          <button id="${instanceId}-copy" class="bcra-btn ghost" type="button">
            Copiar resultado
          </button>
        </div>

        <div id="${instanceId}-status" class="bcra-status muted"></div>

        <div id="${instanceId}-result" class="bcra-result" style="display:none;">
          <div id="${instanceId}-badge" class="bcra-badge warn">Sin dato</div>
          <div id="${instanceId}-meta" class="bcra-meta"></div>
          <div id="${instanceId}-table" class="bcra-table-box"></div>
        </div>
      </section>
    `;
  }

  function summarizeBcra(apiJson) {
    const r = apiJson?.results;
    const periodo = r?.periodos?.[0];
    const entidades = periodo?.entidades || [];

    const montoTotal = entidades.reduce((acc, e) => acc + (Number(e.monto) || 0), 0);
    const peorSituacion = entidades.reduce((m, e) => Math.max(m, Number(e.situacion) || 0), 0);

    return {
      denominacion: r?.denominacion ?? "",
      identificacion: r?.identificacion ?? "",
      periodo: periodo?.periodo ?? "",
      entidadesCount: entidades.length,
      montoTotal,
      peorSituacion,
      entidades,
    };
  }

  async function consultarBcraDeudas(identificacion11) {
    const url = `${BCRA_BASE}/Deudas/${identificacion11}`;

    const cacheKey = `bcra_deudas_${identificacion11}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        sessionStorage.removeItem(cacheKey);
      }
    }

    const resp = await fetch(url, { method: "GET" });

    if (!resp.ok) {
      throw new Error(`BCRA respondió ${resp.status}`);
    }

    const json = await resp.json();
    sessionStorage.setItem(cacheKey, JSON.stringify(json));
    return json;
  }

  function buildCopyText(value, summary, badgeText) {
    return [
      "BCRA",
      `Documento: ${value}`,
      `Estado: ${badgeText}${summary.peorSituacion ? ` (Situación ${summary.peorSituacion})` : ""}`,
      `Denominación: ${summary.denominacion || "—"}`,
      `Período: ${summary.periodo || "—"}`,
      `Entidades informantes: ${summary.entidadesCount}`,
      `Monto total informado: ${fmtARS(summary.montoTotal)}`,
    ].join("\n");
  }

  function attachBehavior(instanceId) {
    const input = document.getElementById(`${instanceId}-cuil`);
    const btn = document.getElementById(`${instanceId}-btn`);
    const copyBtn = document.getElementById(`${instanceId}-copy`);
    const status = document.getElementById(`${instanceId}-status`);
    const result = document.getElementById(`${instanceId}-result`);
    const badge = document.getElementById(`${instanceId}-badge`);
    const meta = document.getElementById(`${instanceId}-meta`);
    const table = document.getElementById(`${instanceId}-table`);

    let lastText = "";

    btn.addEventListener("click", async () => {
      const value = cleanDigits(input.value);

      if (!value) {
        status.textContent = "Ingresá un CUIT/CUIL/CDI para consultar.";
        result.style.display = "none";
        return;
      }

      if (value.length !== 11) {
        status.textContent = "Ingresá un CUIT/CUIL/CDI válido de 11 dígitos.";
        result.style.display = "none";
        return;
      }

      status.textContent = "Consultando BCRA...";
      result.style.display = "none";

      try {
        const json = await consultarBcraDeudas(value);
        const summary = summarizeBcra(json);

        const situacion = summary.peorSituacion;
        const badgeClass = badgeClassFromSituacion(situacion);
        const badgeText = badgeTextFromSituacion(situacion);

        badge.className = `bcra-badge ${badgeClass}`;
        badge.textContent = `${badgeText}${situacion ? ` · Situación ${situacion} (${situacionLabel(situacion)})` : ""}`;

        meta.innerHTML = `
          <div><strong>Denominación:</strong> ${summary.denominacion || "—"}</div>
          <div><strong>Período:</strong> ${summary.periodo || "—"}</div>
          <div><strong>Entidades informantes:</strong> ${summary.entidadesCount}</div>
          <div><strong>Monto total informado:</strong> ${fmtARS(summary.montoTotal)}</div>
        `;

        table.innerHTML = renderBcraTable(summary.entidades);

        lastText = buildCopyText(value, summary, badgeText);

        status.textContent = "OK";
        result.style.display = "block";
      } catch (error) {
        const msg = String(error?.message || error);

        if (msg.toLowerCase().includes("failed to fetch")) {
          status.textContent = "No se pudo consultar desde el navegador (probable CORS).";
        } else {
          status.textContent = `Error: ${msg}`;
        }

        result.style.display = "none";
        console.error(error);
      }
    });

    copyBtn.addEventListener("click", async () => {
      if (!lastText) {
        status.textContent = "Todavía no hay resultado para copiar.";
        return;
      }

      try {
        await navigator.clipboard.writeText(lastText);
        status.textContent = "Resultado copiado.";
      } catch (error) {
        status.textContent = "No se pudo copiar el resultado.";
        console.error(error);
      }
    });
  }

  function renderBcraBlock(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const instanceId = options.instanceId || `bcra-${containerId}`;
    container.innerHTML = buildMarkup(instanceId);
    attachBehavior(instanceId);
  }

  window.renderBcraBlock = renderBcraBlock;
})();
