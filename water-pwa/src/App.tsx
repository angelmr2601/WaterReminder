import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, ensureDefaultSettings } from "./db";
import type { Settings } from "./db";
import { startOfDayMs, endOfDayMs } from "./time";
import { SettingsView } from "./SettingsView";
import { expectedByNowMl, pacingStatus, nextHourGuidance } from "./pacing";
import { StatsView } from "./StatsView";

import {
  Settings as SettingsIcon,
  X as XIcon,
  Droplets,
  Target,
  Clock,
  TrendingDown,
  TrendingUp,
  Minus,
  Home,
  BarChart3,
  Lightbulb,
  Undo2
} from "lucide-react";

function fmtMl(ml: number) {
  return `${ml} ml`;
}

// redondea hacia arriba a un botón rápido (para “ponerte en ritmo” de verdad)
function roundUpToQuick(needMl: number, quickList: number[]) {
  if (needMl <= 0) return 0;
  const sorted = [...quickList].sort((a, b) => a - b);
  const next = sorted.find((n) => n >= needMl);
  return next ?? sorted[sorted.length - 1] ?? needMl;
}

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [quickAmount, setQuickAmount] = useState<number>(250);
  const [showSettings, setShowSettings] = useState(false);
  const [tab, setTab] = useState<"home" | "stats">("home");
  const [now, setNow] = useState(() => new Date());

  // feedback visual tipo “tap”
  const [tap, setTap] = useState(false);

  // undo toast
  const [undoInfo, setUndoInfo] = useState<null | { id: number; amountMl: number }>(null);
  const undoTimer = useRef<number | null>(null);

  // Tick cada minuto para recalcular ritmo
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Inicializa settings
  useEffect(() => {
    (async () => {
      await ensureDefaultSettings();
      setSettings((await db.settings.get("me")) ?? null);
    })();
  }, []);

  // Mantener settings en vivo
  const liveSettings =
    useLiveQuery(async () => (await db.settings.get("me")) ?? null, []) ?? null;

  useEffect(() => {
    if (liveSettings) setSettings(liveSettings);
  }, [liveSettings]);

  // Entradas de hoy
  const todayEntries =
    useLiveQuery(async () => {
      const today = new Date();
      const from = startOfDayMs(today);
      const to = endOfDayMs(today);
      const rows = await db.entries.where("ts").between(from, to, true, true).toArray();
      return rows.sort((a, b) => b.ts - a.ts);
    }, []) ?? [];

  const totalToday = useMemo(
    () => todayEntries.reduce((sum, e) => sum + e.amountMl, 0),
    [todayEntries]
  );

  const goal = settings?.dailyGoalMl ?? 2000;
  const pct = Math.min(100, Math.round((totalToday / goal) * 100));
  const quickList = settings?.quickAmountsMl ?? [150, 250, 330, 500, 750];

  // Ajustar quickAmount si cambia lista
  useEffect(() => {
    if (!quickList.includes(quickAmount)) {
      setQuickAmount(quickList[0] ?? 250);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.quickAmountsMl]);

  // Ritmo esperado
  const wakeHour = settings?.wakeHour ?? 9;
  const sleepHour = settings?.sleepHour ?? 22;

  const expected = expectedByNowMl({
    now,
    wakeHour,
    sleepHour,
    dailyGoalMl: goal
  });

  const ps = pacingStatus(totalToday, expected);
  const diffText = ps.diff === 0 ? "0 ml" : `${ps.diff > 0 ? "+" : ""}${ps.diff} ml`;
  const PaceIcon = ps.diff === 0 ? Minus : ps.diff < 0 ? TrendingDown : TrendingUp;

  // Tip "bebe X antes de Y"
  const stepMinutes = settings?.stepMinutes ?? 60;
  const guide = nextHourGuidance({
    now,
    wakeHour,
    sleepHour,
    dailyGoalMl: goal,
    totalTodayMl: totalToday,
    stepMinutes
  });

  const guideTime = guide.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const showGuide = ps.diff < -150 && guide.needMl > 0; // umbral
  const guideRoundedMl = roundUpToQuick(guide.needMl, quickList);

  function startUndoTimer() {
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => {
      setUndoInfo(null);
      undoTimer.current = null;
    }, 5000);
  }

  async function add(amountMl: number) {
    setTap(true);
    window.setTimeout(() => setTap(false), 140);

    const id = (await db.entries.add({ ts: Date.now(), amountMl, type: "water" })) as number;

    setUndoInfo({ id, amountMl });
    startUndoTimer();
  }

  async function undoLast() {
    if (!undoInfo) return;
    await db.entries.delete(undoInfo.id);
    setUndoInfo(null);
    if (undoTimer.current) {
      window.clearTimeout(undoTimer.current);
      undoTimer.current = null;
    }
  }

  async function remove(id?: number) {
    if (!id) return;
    await db.entries.delete(id);
  }

  // Cerrar modal: tecla ESC
  useEffect(() => {
    if (!showSettings) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSettings(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSettings]);

  return (
    <div className="container">
      {/* Header */}
      <div className="header">
        <h1 className="h1">Hydro</h1>

        <button
          onClick={() => setShowSettings(true)}
          className="btn"
          aria-label="Abrir ajustes"
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <SettingsIcon size={18} />
            Ajustes
          </span>
        </button>
      </div>

      {/* Modal Ajustes */}
      {showSettings && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowSettings(false)}
          className="modalOverlay"
        >
          <div onClick={(e) => e.stopPropagation()} className="modalSheet">
            <div className="row" style={{ padding: 12, borderBottom: "1px solid var(--line)" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 900 }}>
                <SettingsIcon size={18} />
                Ajustes
              </div>

              <button onClick={() => setShowSettings(false)} className="btn" aria-label="Cerrar ajustes">
                <XIcon size={18} />
              </button>
            </div>

            <div style={{ padding: 12, maxHeight: "75vh", overflow: "auto" }}>
              <SettingsView />
            </div>
          </div>
        </div>
      )}

      {/* CONTENT */}
      {tab === "home" ? (
        <>
          {/* Tarjeta principal (Hoy) */}
          <div className="card" style={{ marginTop: 12 }}>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div>
                <div className="muted" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                  <Droplets size={16} />
                  Hoy
                </div>

                <div style={{ fontSize: 34, fontWeight: 900, marginTop: 2 }}>
                  {fmtMl(totalToday)}
                </div>

                <div
                  className="muted"
                  style={{
                    fontSize: 13,
                    marginTop: 8,
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap"
                  }}
                >
                  <span className="pill">
                    <Target size={16} />
                    Objetivo: {fmtMl(goal)} · {pct}%
                  </span>

                  <span className="pill">
                    <Clock size={16} />
                    A esta hora: {fmtMl(expected)}
                  </span>

                  <span className="pill">
                    <PaceIcon size={16} />
                    <strong style={{ fontWeight: 900, color: "var(--text)" }}>{ps.label}</strong> ({diffText})
                  </span>
                </div>

                {/* Tip + botón “Añadir ahora” */}
                {showGuide && (
                  <div className="card tipCard" style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <Lightbulb size={18} style={{ marginTop: 2 }} />
                      <div style={{ flex: 1 }}>
                        Para ir en ritmo, bebe{" "}
                        <strong style={{ color: "var(--text)" }}>{guideRoundedMl} ml</strong>{" "}
                        antes de <strong style={{ color: "var(--text)" }}>{guideTime}</strong>.
                        <div style={{ marginTop: 10 }}>
                          <button
                            onClick={() => add(guideRoundedMl)}
                            className="btn btnPrimary"
                            aria-label={`Añadir recomendación ${guideRoundedMl} ml`}
                          >
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <Droplets size={18} />
                              Añadir ahora
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ textAlign: "right" }}>
                <select
                  value={quickAmount}
                  onChange={(e) => setQuickAmount(Number(e.target.value))}
                  className="select"
                  aria-label="Cantidad rápida"
                >
                  {quickList.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>

                <div style={{ height: 10 }} />

                <button
                  onClick={() => add(quickAmount)}
                  className={`btn btnPrimary addBtn ${tap ? "addBtn--tap" : ""}`}
                  aria-label={`Añadir ${quickAmount} ml`}
                >
                  <Droplets size={18} />
                  + {quickAmount} ml
                </button>
              </div>
            </div>

            <div style={{ marginTop: 14 }} className="progressTrack">
              <div
                className="progressFill"
                style={{
                  width: `${pct}%`,
                  background:
                    pct >= 100
                      ? "var(--good)"
                      : ps.diff < -150
                      ? "var(--bad)"
                      : "var(--accent)"
                }}
              />
            </div>
          </div>

          {/* Registros */}
          <div className="sectionTitle">Registros de hoy</div>

          {todayEntries.length === 0 ? (
            <div className="muted">Aún no has registrado nada.</div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {todayEntries.map((e) => (
                <li
                  key={e.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 0",
                    borderBottom: "1px solid var(--line)"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 900 }}>{fmtMl(e.amountMl)}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {new Date(e.ts).toLocaleTimeString()}
                    </div>
                  </div>
                  <button onClick={() => remove(e.id)} className="btn">
                    Borrar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div style={{ marginTop: 12 }}>
          <StatsView goalMl={goal} />
        </div>
      )}

      {/* UNDO toast */}
      {undoInfo && (
        <div className="toastWrap">
          <div className="toast">
            <div style={{ fontSize: 13, opacity: 0.9 }}>
              Añadido <strong style={{ color: "var(--text)" }}>{undoInfo.amountMl} ml</strong>
            </div>

            <button onClick={undoLast} className="btn" aria-label="Deshacer último añadido">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Undo2 size={16} />
                Deshacer
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Spacer for bottom tab bar */}
      <div style={{ height: 86 }} />

      {/* Bottom Tab Bar */}
      <div className="tabBar">
        <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", gap: 10 }}>
          <button
            onClick={() => setTab("home")}
            className={`btn tabBtn ${tab === "home" ? "tabBtn--active" : ""}`}
            aria-label="Ir a Hoy"
          >
            <Home size={18} />
            Hoy
          </button>

          <button
            onClick={() => setTab("stats")}
            className={`btn tabBtn ${tab === "stats" ? "tabBtn--active" : ""}`}
            aria-label="Ir a Estadísticas"
          >
            <BarChart3 size={18} />
            Stats
          </button>
        </div>
      </div>
    </div>
  );
}
