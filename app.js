// Simple Galaxy 8 CSV-driven dashboard

const DEFAULT_ATHLETES = {
  alex: "data/athlete_alex.csv",
  jordan: "data/athlete_jordan.csv",
};

const ROLE_DESCRIPTIONS = {
  coach:
    "Summary of physical load, readiness, and recovery to support training decisions.",
  trainer:
    "Focus on workload, body composition, and recovery balance to guide conditioning.",
  doctor:
    "Clinical red flags across vitals, sleep apnea, ECG, and fall detection.",
  athlete:
    "Personal snapshot of readiness, stress, and recovery with clear guidance.",
};

const THRESHOLDS = {
  hrHigh: 100,
  spo2Low: 92,
  stressHigh: 70,
  systolicHigh: 140,
  diastolicHigh: 90,
  apneaEventsHigh: 5,
  bodyFatHigh: 20, // for demo; not personalized by position
  energyLow: 60,
  antioxidantLow: 40,
};

let state = {
  role: "coach",
  athlete: "alex",
  allRecords: [],
  records: [],
  dateFilter: {
    from: null,
    to: null,
  },
  comparisonDate: null,
  charts: {
    heartRate: null,
    sleepStage: null,
  },
};

function $(id) {
  return document.getElementById(id);
}

function fmt(value, unit = "", digits = 0) {
  if (value == null || Number.isNaN(value)) return "–";
  const rounded = Number(value.toFixed(digits));
  return unit ? `${rounded} ${unit}` : String(rounded);
}

function getDatePart(ts) {
  if (!ts) return null;
  return ts.split(" ")[0];
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLabel(dateStr) {
  if (!dateStr) return "";
  if (dateStr === getTodayStr()) return "today";
  const d = new Date(dateStr + "T12:00:00");
  const mon = d.toLocaleString("en", { month: "short" });
  const day = d.getDate();
  return `${mon} ${day}`;
}

function getRecordsForDate(records, dateStr) {
  if (!dateStr || !records.length) return [];
  return records.filter((r) => getDatePart(r.timestamp) === dateStr);
}

function formatComparisonDisplay(avg, compVal, unit, digits, dateLabel) {
  if (avg == null || compVal == null || dateLabel == null) return null;
  const avgNum = Number(avg);
  const compNum = Number(compVal);
  const delta = compNum - avgNum;
  const deltaStr = delta >= 0 ? `+${delta.toFixed(digits)}` : String(delta.toFixed(digits));
  const avgStr = unit ? `${avgNum.toFixed(digits)} ${unit}` : String(Math.round(avgNum));
  const compStr = unit ? `${compNum.toFixed(digits)} ${unit}` : String(Math.round(compNum));
  return `${avgStr} ${compStr} ${dateLabel} ${deltaStr}`;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const [headerLine, ...dataLines] = lines;
  const headers = headerLine.split(",").map((h) => h.trim());

  return dataLines
    .filter((l) => l.trim().length > 0)
    .map((line) => {
      const cells = line.split(",").map((c) => c.trim());
      const row = {};
      headers.forEach((h, i) => {
        row[h] = cells[i] ?? "";
      });

      const num = (key) => {
        const v = parseFloat(row[key]);
        return Number.isNaN(v) ? null : v;
      };

      return {
        timestamp: row.timestamp,
        athlete_name: row.athlete_name,
        steps: num("steps"),
        calories: num("calories"),
        active_minutes: num("active_minutes"),
        heart_rate: num("heart_rate"),
        ecg: row.ecg,
        spo2: num("spo2"),
        menstrual_phase: row.menstrual_phase || null,
        stress_level: num("stress_level"),
        body_fat_pct: num("body_fat_pct"),
        muscle_mass_kg: num("muscle_mass_kg"),
        sleep_stage: row.sleep_stage || null,
        sleep_apnea_events: num("sleep_apnea_events"),
        systolic_bp: num("systolic_bp"),
        diastolic_bp: num("diastolic_bp"),
        energy_score: num("energy_score"),
        antioxidant_index: num("antioxidant_index"),
        fall_detected:
          String(row.fall_detected || "")
            .toLowerCase()
            .trim() === "true",
      };
    });
}

function summarize(records) {
  if (!records.length) return null;

  const sum = (key) =>
    records.reduce(
      (acc, r) => (r[key] == null ? acc : acc + r[key]),
      0
    );
  const count = (key) =>
    records.filter((r) => r[key] != null).length;

  const latest = records[records.length - 1];
  const totalSteps = sum("steps");
  const totalActiveMinutes = sum("active_minutes");
  const totalCalories = sum("calories");

  const dateSet = new Set();
  records.forEach((r) => {
    const d = getDatePart(r.timestamp);
    if (d) dateSet.add(d);
  });
  const days = dateSet.size || 1;

  const avgHeartRate = count("heart_rate")
    ? sum("heart_rate") / count("heart_rate")
    : null;
  const avgSpO2 = count("spo2")
    ? sum("spo2") / count("spo2")
    : null;
  const avgStress = count("stress_level")
    ? sum("stress_level") / count("stress_level")
    : null;
  const avgEnergy = count("energy_score")
    ? sum("energy_score") / count("energy_score")
    : null;
  const avgAntioxidant = count("antioxidant_index")
    ? sum("antioxidant_index") / count("antioxidant_index")
    : null;

  const sleepStageCounts = records.reduce((acc, r) => {
    const s = (r.sleep_stage || "").toLowerCase();
    if (!s) return acc;
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const apneaEvents = sum("sleep_apnea_events");
  const avgApneaPerNight =
    apneaEvents != null ? apneaEvents / days : null;

  return {
    latest,
    totalSteps,
    totalActiveMinutes,
    totalCalories,
    days,
    avgStepsPerDay:
      totalSteps != null ? totalSteps / days : null,
    avgActiveMinutesPerDay:
      totalActiveMinutes != null ? totalActiveMinutes / days : null,
    avgHeartRate,
    avgSpO2,
    avgStress,
    avgEnergy,
    avgAntioxidant,
    sleepStageCounts,
    apneaEvents,
    avgApneaPerNight,
  };
}

function renderSummary(records) {
  const el = $("dataSummary");
  if (!records.length) {
    el.textContent = "No data loaded. Upload a CSV or use the sample datasets.";
    return;
  }
  const athleteName =
    records[0].athlete_name || (state.athlete === "alex" ? "Alex" : "Jordan");
  const from = getDatePart(records[0].timestamp);
  const to = getDatePart(records[records.length - 1].timestamp);
  el.textContent = `${athleteName} – ${records.length} samples from ${from} to ${to}. View tailored for ${state.role}.`;
}

function renderCards(records) {
  const summary = summarize(records);
  if (!summary) {
    [
      "stepsTotal",
      "activeMinutesTotal",
      "avgHeartRate",
      "avgSpO2",
      "deepSleep",
      "apneaEvents",
      "bodyFat",
      "energyScore",
      "avgStress",
      "antioxidantIndex",
      "bloodPressure",
      "ecgStatus",
    ].forEach((id) => {
      $(id).textContent = "–";
    });
    return;
  }

  const { latest } = summary;
  const compDate = state.comparisonDate;
  const compRecords = compDate ? getRecordsForDate(records, compDate) : [];
  const compSummary = compRecords.length ? summarize(compRecords) : null;
  const dateLabel = compDate ? formatDateLabel(compDate) : null;
  const showComparison = compSummary && dateLabel;

  ["stepsTotal", "activeMinutesTotal", "avgHeartRate", "avgSpO2", "deepSleep",
    "apneaEvents", "bodyFat", "energyScore", "avgStress", "antioxidantIndex",
    "bloodPressure", "ecgStatus"
  ].forEach((id) => {
    const el = $(id);
    if (el) el.classList.toggle("comparison-active", !!showComparison);
  });

  const avgSteps = summary.avgStepsPerDay ?? summary.totalSteps;
  const avgActiveMin = summary.avgActiveMinutesPerDay ?? summary.totalActiveMinutes;
  const compSteps = compSummary?.avgStepsPerDay ?? compSummary?.totalSteps;
  const compActiveMin = compSummary?.avgActiveMinutesPerDay ?? compSummary?.totalActiveMinutes;

  $("stepsTotal").textContent = showComparison && avgSteps != null && compSteps != null
    ? formatComparisonDisplay(avgSteps, compSteps, "", 0, dateLabel)
    : fmt(avgSteps, "", 0);

  $("activeMinutesTotal").textContent = showComparison && avgActiveMin != null && compActiveMin != null
    ? formatComparisonDisplay(avgActiveMin, compActiveMin, "min", 0, dateLabel)
    : fmt(avgActiveMin, "min", 0);

  const avgHr = summary.avgHeartRate;
  const compHr = compSummary?.avgHeartRate;
  $("avgHeartRate").textContent = showComparison && avgHr != null && compHr != null
    ? formatComparisonDisplay(avgHr, compHr, "bpm", 0, dateLabel)
    : fmt(avgHr, "bpm", 0);

  const avgSpO2 = summary.avgSpO2;
  const compSpO2 = compSummary?.avgSpO2;
  $("avgSpO2").textContent = showComparison && avgSpO2 != null && compSpO2 != null
    ? formatComparisonDisplay(avgSpO2, compSpO2, "%", 1, dateLabel)
    : fmt(avgSpO2, "%", 1);

  const deepCount = summary.sleepStageCounts["deep"] || 0;
  const totalSleep = Object.values(summary.sleepStageCounts).reduce(
    (a, b) => a + b,
    0
  );
  const deepPct =
    totalSleep > 0 ? (deepCount / totalSleep) * 100 : null;
  const compDeepCount = compSummary?.sleepStageCounts["deep"] || 0;
  const compTotalSleep = Object.values(compSummary?.sleepStageCounts || {}).reduce(
    (a, b) => a + b,
    0
  );
  const compDeepPct = compTotalSleep > 0 ? (compDeepCount / compTotalSleep) * 100 : null;

  $("deepSleep").textContent = showComparison && deepPct != null && compDeepPct != null
    ? formatComparisonDisplay(deepPct, compDeepPct, "%", 0, dateLabel)
    : fmt(deepPct, "%", 0);

  const avgApnea = summary.avgApneaPerNight ?? summary.apneaEvents;
  const compApnea = compSummary?.avgApneaPerNight ?? compSummary?.apneaEvents;
  $("apneaEvents").textContent = showComparison && avgApnea != null && compApnea != null
    ? formatComparisonDisplay(avgApnea, compApnea, "", 1, dateLabel)
    : fmt(avgApnea, "", 1);

  const avgBodyFat = latest.body_fat_pct;
  const compBodyFat = compSummary?.latest?.body_fat_pct;
  $("bodyFat").textContent = showComparison && avgBodyFat != null && compBodyFat != null
    ? formatComparisonDisplay(avgBodyFat, compBodyFat, "%", 1, dateLabel)
    : fmt(avgBodyFat, "%", 1);

  const avgEnergy = latest.energy_score ?? summary.avgEnergy;
  const compEnergy = compSummary?.latest?.energy_score ?? compSummary?.avgEnergy;
  $("energyScore").textContent = showComparison && avgEnergy != null && compEnergy != null
    ? formatComparisonDisplay(avgEnergy, compEnergy, "/100", 0, dateLabel)
    : fmt(avgEnergy, "/100", 0);

  const avgStress = summary.avgStress;
  const compStress = compSummary?.avgStress;
  $("avgStress").textContent = showComparison && avgStress != null && compStress != null
    ? formatComparisonDisplay(avgStress, compStress, "/100", 0, dateLabel)
    : fmt(avgStress, "/100", 0);

  const avgAntiox = latest.antioxidant_index ?? summary.avgAntioxidant;
  const compAntiox = compSummary?.latest?.antioxidant_index ?? compSummary?.avgAntioxidant;
  $("antioxidantIndex").textContent = showComparison && avgAntiox != null && compAntiox != null
    ? formatComparisonDisplay(avgAntiox, compAntiox, "/100", 0, dateLabel)
    : fmt(avgAntiox, "/100", 0);

  const avgSys = latest.systolic_bp;
  const avgDia = latest.diastolic_bp;
  const compSys = compSummary?.latest?.systolic_bp;
  const compDia = compSummary?.latest?.diastolic_bp;
  if (showComparison && avgSys != null && avgDia != null && compSys != null && compDia != null) {
    const dSys = compSys - avgSys;
    const dDia = compDia - avgDia;
    const dSysStr = dSys >= 0 ? `+${dSys}` : String(dSys);
    const dDiaStr = dDia >= 0 ? `+${dDia}` : String(dDia);
    $("bloodPressure").textContent =
      `${avgSys}/${avgDia} ${compSys}/${compDia} ${dateLabel} ${dSysStr}/${dDiaStr} mmHg`;
  } else if (avgSys != null && avgDia != null) {
    $("bloodPressure").textContent = `${fmt(avgSys, "", 0)} / ${fmt(avgDia, "", 0)} mmHg`;
  } else {
    $("bloodPressure").textContent = "–";
  }

  const rangeEcg = latest.ecg && latest.ecg.toLowerCase() !== "normal" ? latest.ecg : "Normal";
  const compEcg = compSummary?.latest?.ecg;
  $("ecgStatus").textContent =
    showComparison && compEcg
      ? `${rangeEcg} ${compEcg} ${dateLabel}` + (rangeEcg !== compEcg ? " (changed)" : "")
      : rangeEcg;

  renderRoleNotes(summary);
}

function renderRoleNotes(summary) {
  const { role } = state;
  const activityNote = $("activityNote");
  const cardioNote = $("cardioNote");
  const sleepNote = $("sleepNote");
  const bodyNote = $("bodyNote");
  const stressNote = $("stressNote");
  const bpNote = $("bpNote");

  const latest = summary?.latest;

  activityNote.textContent = "";
  cardioNote.textContent = "";
  sleepNote.textContent = "";
  bodyNote.textContent = "";
  stressNote.textContent = "";
  bpNote.textContent = "";

  if (!summary) return;

  if (role === "coach") {
    activityNote.textContent =
      summary.totalSteps > 12000
        ? "High activity load – consider lighter session tomorrow."
        : "Moderate activity – room for higher intensity work.";
    cardioNote.textContent =
      summary.avgHeartRate && summary.avgHeartRate > 90
        ? "Elevated average heart rate; monitor for fatigue."
        : "Cardio load within expected range.";
    sleepNote.textContent =
      summary.apneaEvents > 0
        ? "Sleep quality impacted by apnea events; coordinate with medical staff."
        : "Sleep pattern supports current workload.";
    bodyNote.textContent =
      latest.body_fat_pct && latest.body_fat_pct < 14
        ? "Lean body composition – emphasize strength maintenance."
        : "Body composition balanced for role; maintain consistency.";
    stressNote.textContent =
      summary.avgStress && summary.avgStress > THRESHOLDS.stressHigh
        ? "Training and life stress are accumulating; consider recovery session."
        : "Stress within acceptable competitive range.";
    bpNote.textContent = "Escalate to medical staff if symptoms appear.";
  } else if (role === "trainer") {
    activityNote.textContent =
      summary.totalActiveMinutes > 90
        ? "Sustained high active minutes – schedule mobility and recovery work."
        : "Active minutes can be increased gradually if needed.";
    cardioNote.textContent =
      summary.avgSpO2 && summary.avgSpO2 < 95
        ? "Slightly reduced SpO₂ – prioritize breathing and recovery protocols."
        : "Oxygen saturation suitable for high-intensity sessions.";
    sleepNote.textContent =
      summary.sleepStageCounts["deep"] &&
      (summary.sleepStageCounts["deep"] /
        (Object.values(summary.sleepStageCounts).reduce(
          (a, b) => a + b,
          0
        ) || 1)) *
        100 <
        18
        ? "Deep sleep proportion is low; avoid heavy strength sessions."
        : "Sleep distribution supports progressive overload.";
    bodyNote.textContent =
      latest.muscle_mass_kg && latest.muscle_mass_kg > 60
        ? "Strong lean mass – maintain power and velocity work."
        : "Opportunity to build lean mass with structured strength blocks.";
    stressNote.textContent =
      summary.avgStress && summary.avgStress > THRESHOLDS.stressHigh
        ? "Reduce neuromuscular load and emphasize technical drills."
        : "Stress profile compatible with current training density.";
    bpNote.textContent = "If blood pressure trends up, flag for doctor review.";
  } else if (role === "doctor") {
    activityNote.textContent =
      summary.totalSteps > 15000
        ? "Very high ambulatory volume – monitor for overuse injury risk."
        : "Ambulatory load within typical elite ranges.";
    cardioNote.textContent =
      summary.avgHeartRate && summary.avgHeartRate > THRESHOLDS.hrHigh
        ? "Average heart rate above 100 bpm – evaluate for tachycardia causes."
        : "Cardiac metrics stable for current period.";
    sleepNote.textContent =
      summary.apneaEvents > THRESHOLDS.apneaEventsHigh
        ? "Frequent apnea events – consider formal sleep study referral."
        : "Sleep-related breathing appears within acceptable limits.";
    bodyNote.textContent =
      latest.body_fat_pct && latest.body_fat_pct > THRESHOLDS.bodyFatHigh
        ? "Body fat above target – discuss cardiometabolic risk profile."
        : "Body composition not currently elevating clinical risk.";
    stressNote.textContent =
      summary.avgStress && summary.avgStress > THRESHOLDS.stressHigh
        ? "High perceived stress – screen for mood, recovery, and support needs."
        : "Perceived stress within expected competitive range.";
    bpNote.textContent =
      latest.systolic_bp &&
      (latest.systolic_bp > THRESHOLDS.systolicHigh ||
        latest.diastolic_bp > THRESHOLDS.diastolicHigh)
        ? "Blood pressure in hypertensive range – confirm and consider further workup."
        : "Blood pressure not currently in hypertensive range.";
  } else if (role === "athlete") {
    activityNote.textContent =
      summary.totalSteps > 12000
        ? "You moved a lot today – great work. Protect recovery tonight."
        : "Solid base activity – you can safely push in key sessions.";
    cardioNote.textContent =
      summary.avgSpO2 && summary.avgSpO2 < THRESHOLDS.spo2Low
        ? "Your oxygen levels dipped – focus on breathing and talk to staff if you feel off."
        : "Heart and oxygen numbers look good for training.";
    sleepNote.textContent =
      summary.apneaEvents > 0
        ? "Your watch saw some breathing interruptions – mention this to the doctor."
        : "Your sleep pattern supports your performance goals.";
    bodyNote.textContent =
      latest.body_fat_pct && latest.body_fat_pct < 14
        ? "You are very lean – fuel enough around training."
        : "Body composition supports strength and durability.";
    stressNote.textContent =
      summary.avgStress && summary.avgStress > THRESHOLDS.stressHigh
        ? "You’re carrying a lot of stress – build in short recovery breaks today."
        : "Your stress looks under control – keep your current routines.";
    bpNote.textContent = "If you ever feel dizzy or unwell, tell staff immediately.";
  }
}

function buildDoctorAlerts(records) {
  const alerts = [];
  if (!records.length) return alerts;
  const summary = summarize(records);
  const latest = summary.latest;

  if (latest.heart_rate && latest.heart_rate > 110) {
    alerts.push({
      severity: "high",
      text: `Resting heart rate ${latest.heart_rate} bpm – consider evaluation for infection, dehydration, or overtraining.`,
    });
  }

  if (summary.avgSpO2 && summary.avgSpO2 < THRESHOLDS.spo2Low) {
    alerts.push({
      severity: "high",
      text: `Average SpO₂ ${summary.avgSpO2.toFixed(
        1
      )}% – below 92% threshold; recommend medical assessment.`,
    });
  }

  if (latest.systolic_bp) {
    if (
      latest.systolic_bp > THRESHOLDS.systolicHigh ||
      latest.diastolic_bp > THRESHOLDS.diastolicHigh
    ) {
      alerts.push({
        severity: "high",
        text: `Blood pressure ${latest.systolic_bp}/${latest.diastolic_bp} mmHg – hypertensive range for athlete.`,
      });
    }
  }

  if (
    latest.ecg &&
    latest.ecg.toLowerCase() !== "normal" &&
    latest.ecg.trim().length > 0
  ) {
    alerts.push({
      severity: "high",
      text: `ECG flagged as "${latest.ecg}" – review trace and consider cardiology referral.`,
    });
  }

  if (summary.apneaEvents > THRESHOLDS.apneaEventsHigh) {
    alerts.push({
      severity: "medium",
      text: `Sleep apnea events per night: ${summary.apneaEvents} – above threshold; consider sleep clinic discussion.`,
    });
  }

  if (latest.fall_detected) {
    alerts.push({
      severity: "high",
      text: "Fall detected in recent session – confirm concussion and musculoskeletal assessment were completed.",
    });
  }

  if (
    latest.energy_score != null &&
    latest.energy_score < THRESHOLDS.energyLow
  ) {
    alerts.push({
      severity: "medium",
      text: `Energy score ${latest.energy_score} – low; screen for illness, under-fueling, and overtraining.`,
    });
  }

  if (
    latest.antioxidant_index != null &&
    latest.antioxidant_index < THRESHOLDS.antioxidantLow
  ) {
    alerts.push({
      severity: "low",
      text: `Antioxidant index ${latest.antioxidant_index} – consider nutrition review for recovery support.`,
    });
  }

  if (
    latest.menstrual_phase &&
    latest.menstrual_phase.toLowerCase() === "luteal_high_symptoms"
  ) {
    alerts.push({
      severity: "medium",
      text: "Reported luteal phase with high symptom burden – coordinate individualized training and medical support.",
    });
  }

  return alerts;
}

function renderDoctorAlerts(records) {
  const panel = $("doctorAlerts");
  const list = $("alertsList");
  list.innerHTML = "";

  if (state.role !== "doctor") {
    panel.classList.add("hidden");
    return;
  }

  const alerts = buildDoctorAlerts(records);
  if (!alerts.length) {
    panel.classList.remove("hidden");
    const li = document.createElement("li");
    li.textContent =
      "No critical alerts from current data window. Continue routine monitoring.";
    list.appendChild(li);
    return;
  }

  panel.classList.remove("hidden");
  alerts.forEach((a) => {
    const li = document.createElement("li");
    li.textContent = a.text;
    if (a.severity === "high") li.classList.add("severe");
    list.appendChild(li);
  });
}

function renderCharts(records) {
  const ctxHr = $("heartRateChart").getContext("2d");
  const ctxSleep = $("sleepStageChart").getContext("2d");

  const timestamps = records.map((r) => r.timestamp);
  const hrValues = records.map((r) => r.heart_rate);

  if (state.charts.heartRate) {
    state.charts.heartRate.destroy();
  }

  state.charts.heartRate = new Chart(ctxHr, {
    type: "line",
    data: {
      labels: timestamps,
      datasets: [
        {
          label: "Heart rate (bpm)",
          data: hrValues,
          borderColor: "#60a5fa",
          backgroundColor: "rgba(96, 165, 250, 0.1)",
          tension: 0.3,
          pointRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: { autoSkip: true, maxTicksLimit: 6, color: "#9ca3af" },
          grid: { display: false },
        },
        y: {
          ticks: { color: "#9ca3af" },
          grid: { color: "rgba(31,41,55,0.7)" },
        },
      },
    },
  });

  const summary = summarize(records);
  const counts = summary?.sleepStageCounts || {};
  const sleepLabels = ["awake", "light", "deep", "rem"];
  const sleepData = sleepLabels.map((k) => counts[k] || 0);

  if (state.charts.sleepStage) {
    state.charts.sleepStage.destroy();
  }

  state.charts.sleepStage = new Chart(ctxSleep, {
    type: "doughnut",
    data: {
      labels: ["Awake", "Light", "Deep", "REM"],
      datasets: [
        {
          data: sleepData,
          backgroundColor: [
            "#4b5563",
            "#38bdf8",
            "#22c55e",
            "#a855f7",
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#9ca3af", boxWidth: 10 },
          position: "bottom",
        },
      },
      cutout: "60%",
    },
  });

  $("hrTrendLabel").textContent =
    ROLE_DESCRIPTIONS[state.role] || "";
  $("sleepDistLabel").textContent = "Distribution based on current data window.";
}

async function loadSample(athleteKey) {
  const path = DEFAULT_ATHLETES[athleteKey];
  if (!path) return;
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error("Failed to fetch CSV");
    const text = await res.text();
    state.allRecords = parseCsv(text);
    autoSetDateRange(state.allRecords);
    applyDateFilter();
  } catch (err) {
    console.error(err);
    $("dataSummary").textContent =
      "Could not load sample CSV. Make sure the data folder is deployed.";
  }
}

function renderAll() {
  const { records } = state;
  renderSummary(records);
  renderCards(records);
  renderDoctorAlerts(records);
  renderCharts(records);
}

function autoSetDateRange(records) {
  const dates = records
    .map((r) => getDatePart(r.timestamp))
    .filter(Boolean)
    .sort();

  if (!dates.length) {
    state.dateFilter.from = null;
    state.dateFilter.to = null;
    if ($("dateFrom")) $("dateFrom").value = "";
    if ($("dateTo")) $("dateTo").value = "";
    state.records = [];
    renderAll();
    return;
  }

  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];
  state.dateFilter.from = minDate;
  state.dateFilter.to = maxDate;

  if ($("dateFrom")) $("dateFrom").value = minDate;
  if ($("dateTo")) $("dateTo").value = maxDate;
}

function applyDateFilter() {
  const all = state.allRecords || [];
  if (!all.length) {
    state.records = [];
    renderAll();
    return;
  }

  const from = state.dateFilter.from;
  const to = state.dateFilter.to;

  const filtered = all.filter((r) => {
    const d = getDatePart(r.timestamp);
    if (!d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });

  state.records = filtered.length ? filtered : all;
  renderAll();
}

function setupInteractions() {
  document
    .querySelectorAll(".role-btn")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const role = btn.getAttribute("data-role");
        state.role = role;
        document
          .querySelectorAll(".role-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        renderAll();
      });
    });

  $("athleteSelect").addEventListener("change", (e) => {
    state.athlete = e.target.value;
    loadSample(state.athlete);
  });

  $("reloadSampleBtn").addEventListener("click", () => {
    loadSample(state.athlete);
  });

  $("csvUpload").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = String(ev.target?.result || "");
        state.allRecords = parseCsv(text);
        autoSetDateRange(state.allRecords);
        applyDateFilter();
      } catch (err) {
        console.error(err);
        alert("Unable to parse CSV. Please check column headers.");
      }
    };
    reader.readAsText(file);
  });
  const dateFromInput = $("dateFrom");
  const dateToInput = $("dateTo");
  const clearBtn = $("clearDatesBtn");

  if (dateFromInput) {
    dateFromInput.addEventListener("change", (e) => {
      state.dateFilter.from = e.target.value || null;
      applyDateFilter();
    });
  }

  if (dateToInput) {
    dateToInput.addEventListener("change", (e) => {
      state.dateFilter.to = e.target.value || null;
      applyDateFilter();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      autoSetDateRange(state.allRecords);
      applyDateFilter();
    });
  }

  const comparisonInput = $("comparisonDate");
  const clearComparisonBtn = $("clearComparisonBtn");
  const comparisonHint = $("comparisonHint");

  if (comparisonInput) {
    comparisonInput.addEventListener("change", (e) => {
      state.comparisonDate = e.target.value || null;
      if (comparisonHint) {
        comparisonHint.classList.toggle("hidden", !state.comparisonDate);
      }
      renderAll();
    });
  }

  if (clearComparisonBtn) {
    clearComparisonBtn.addEventListener("click", () => {
      state.comparisonDate = null;
      if ($("comparisonDate")) $("comparisonDate").value = "";
      if (comparisonHint) comparisonHint.classList.add("hidden");
      renderAll();
    });
  }
}

window.addEventListener("DOMContentLoaded", () => {
  setupInteractions();
  loadSample(state.athlete);
});

