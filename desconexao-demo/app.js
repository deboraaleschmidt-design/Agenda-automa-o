/* DESCONEXÃO — demo interactions (month toggle + chart) */

(function () {
  document.documentElement.classList.add("js-ready");

  const nav = document.getElementById("site-nav");
  if (nav) {
    const onScroll = () => {
      nav.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  const monthSelect = document.getElementById("month-select");
  if (!monthSelect) return;

  const MONTH_LABELS = {
    "2026-08": "Agosto 2026",
    "2026-09": "Setembro 2026",
    "2026-10": "Outubro 2026",
    "2026-11": "Novembro 2026",
  };

  const DATASETS = {
    "2026-08": {
      kpis: { recolhidos: 312, entregues: 278, processo: 34, pct: "89%" },
      grade: [
        [4, 3, 2, 1, 2, 1],
        [5, 4, 3, 0, 3, 2],
        [3, 5, 2, 1, 2, 2],
        [6, 4, 3, 2, 1, 1],
        [4, 3, 4, 1, 2, 3],
        [5, 6, 2, 0, 3, 2],
        [3, 2, 3, 1, 2, 1],
        [4, 5, 2, 2, 1, 2],
        [5, 3, 4, 1, 2, 2],
        [4, 4, 3, 0, 3, 1],
      ],
      pagarVolumes: [38, 42, 28, 8, 22, 18],
      evoHighlight: 0,
    },
    "2026-09": {
      kpis: { recolhidos: 356, entregues: 321, processo: 35, pct: "90%" },
      grade: [
        [5, 4, 3, 1, 2, 2],
        [4, 5, 2, 0, 3, 1],
        [6, 3, 4, 2, 2, 2],
        [5, 4, 3, 1, 1, 3],
        [3, 6, 2, 1, 3, 2],
        [5, 4, 3, 0, 2, 1],
        [4, 3, 4, 2, 2, 2],
        [6, 5, 2, 1, 3, 2],
        [4, 4, 3, 1, 2, 1],
        [5, 3, 4, 0, 2, 3],
      ],
      pagarVolumes: [45, 41, 32, 9, 26, 21],
      evoHighlight: 1,
    },
    "2026-10": {
      kpis: { recolhidos: 389, entregues: 352, processo: 37, pct: "90%" },
      grade: [
        [5, 4, 3, 1, 3, 2],
        [6, 5, 4, 2, 2, 1],
        [4, 3, 3, 1, 2, 3],
        [5, 6, 2, 0, 3, 2],
        [7, 4, 4, 1, 2, 2],
        [5, 5, 3, 2, 1, 1],
        [4, 3, 4, 1, 3, 2],
        [6, 5, 2, 0, 2, 3],
        [5, 4, 3, 2, 2, 1],
        [4, 6, 4, 1, 3, 2],
      ],
      pagarVolumes: [51, 48, 35, 11, 28, 24],
      evoHighlight: 2,
    },
    "2026-11": {
      kpis: { recolhidos: 428, entregues: 391, processo: 37, pct: "91%" },
      grade: [
        [6, 5, 3, 1, 2, 2],
        [5, 4, 4, 2, 3, 1],
        [7, 6, 2, 0, 2, 3],
        [4, 5, 3, 1, 1, 2],
        [6, 3, 4, 2, 3, 2],
        [5, 6, 3, 1, 2, 1],
        [8, 4, 2, 0, 2, 3],
        [5, 5, 4, 2, 3, 2],
        [6, 4, 3, 1, 1, 2],
        [4, 6, 4, 1, 3, 1],
        [7, 5, 2, 2, 2, 3],
        [5, 4, 3, 0, 2, 2],
      ],
      pagarVolumes: [58, 52, 38, 12, 31, 27],
      evoHighlight: 3,
    },
  };

  const EVO = [
    { label: "Ago", value: 312 },
    { label: "Set", value: 356 },
    { label: "Out", value: 389 },
    { label: "Nov", value: 428 },
  ];

  const TECHS = [
    { name: "Guilherme", code: "Z698465", tarifa: 0 },
    { name: "Alexandre", code: "Z698466", tarifa: 0 },
    { name: "Valter", code: "SMA", tarifa: 20 },
    { name: "TCI", code: "—", tarifa: 0 },
    { name: "Ricardo", code: "Z701102", tarifa: 15 },
    { name: "Fernanda", code: "Z701188", tarifa: 15 },
  ];

  const gradeBody = document.getElementById("grade-body");
  const gradeFoot = document.getElementById("grade-foot");
  const pagarBody = document.getElementById("pagar-body");
  const pagarFoot = document.getElementById("pagar-foot");
  const chartPlot = document.getElementById("chart-plot");
  const gradeMonthLabel = document.getElementById("grade-month-label");
  const pagarMonthLabel = document.getElementById("pagar-month-label");

  function money(n) {
    return n.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    });
  }

  function renderKpis(kpis) {
    Object.entries(kpis).forEach(([key, value]) => {
      const el = document.querySelector(`[data-kpi="${key}"]`);
      if (el) el.textContent = value;
    });
  }

  function renderGrade(rows) {
    if (!gradeBody || !gradeFoot) return;
    const totals = [0, 0, 0, 0, 0, 0];
    gradeBody.innerHTML = rows
      .map((cols, i) => {
        cols.forEach((n, idx) => {
          totals[idx] += n;
        });
        const day = String(i + 1).padStart(2, "0");
        return `<tr><td>${day}</td>${cols
          .map((n) => `<td>${n}</td>`)
          .join("")}</tr>`;
      })
      .join("");
    gradeFoot.innerHTML = `<tr><td>TOTAL</td>${totals
      .map((n) => `<td>${n}</td>`)
      .join("")}</tr>`;
  }

  function renderPagar(volumes) {
    if (!pagarBody || !pagarFoot) return;
    let total = 0;
    pagarBody.innerHTML = TECHS.map((t, i) => {
      const vol = volumes[i] || 0;
      const due = vol * t.tarifa;
      total += due;
      const tarifaClass = t.tarifa === 0 ? "money zero" : "money";
      const dueClass = due === 0 ? "money zero" : "money";
      return `<tr>
        <td>${t.name}<span class="sub" style="display:block;color:var(--muted);font-size:0.75rem">${t.code}</span></td>
        <td>${vol}</td>
        <td class="${tarifaClass}">${money(t.tarifa)}</td>
        <td class="${dueClass}">${money(due)}</td>
      </tr>`;
    }).join("");
    pagarFoot.innerHTML = `<tr class="total-row"><td>TOTAL</td><td></td><td></td><td class="money">${money(
      total
    )}</td></tr>`;
  }

  function renderChart(highlightIndex) {
    if (!chartPlot) return;
    const max = Math.max(...EVO.map((d) => d.value));
    chartPlot.innerHTML = EVO.map((d, i) => {
      const h = Math.max(8, Math.round((d.value / max) * 100));
      const delay = (0.08 + i * 0.1).toFixed(2);
      const opacity = i === highlightIndex ? "1" : "0.72";
      return `<div class="chart-col">
        <div class="chart-bar-wrap">
          <div class="chart-bar" style="height:${h}%;animation-delay:${delay}s;opacity:${opacity}">
            <span class="chart-bar-value">${d.value}</span>
          </div>
        </div>
        <span class="chart-label">${d.label}</span>
      </div>`;
    }).join("");
  }

  function applyMonth(key) {
    const data = DATASETS[key] || DATASETS["2026-11"];
    const label = MONTH_LABELS[key] || key;
    renderKpis(data.kpis);
    renderGrade(data.grade);
    renderPagar(data.pagarVolumes);
    renderChart(data.evoHighlight);
    if (gradeMonthLabel) gradeMonthLabel.textContent = `${label} · dia × técnico`;
    if (pagarMonthLabel)
      pagarMonthLabel.textContent = `${label} · tarifas de exemplo`;
  }

  monthSelect.addEventListener("change", () => applyMonth(monthSelect.value));
  applyMonth(monthSelect.value);
})();
