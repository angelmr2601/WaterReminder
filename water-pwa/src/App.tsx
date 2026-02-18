import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, ensureDefaultSettings } from "./db";
import type { Settings, DrinkType } from "./db";
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
  Undo2,
  Plus
} from "lucide-react";

const DRINKS: { type: DrinkType; label: string; emoji: string; factor: number }[] = [
  { type: "water", label: "Agua", emoji: "💧", factor: 1.0 },
  { type: "beer", label: "Cerveza", emoji: "🍺", factor: 0.2 },
  { type: "soda", label: "Refresco", emoji: "🥤", factor: 0.5 }
];

function factorFor(type: unknown): number {
  const t = String(type) as DrinkType;
  return DRINKS.find((d) => d.type === t)?.factor ?? 1.0;
}

function labelFor(type: unknown): { emoji: string; label: string } {
  const t = String(type) as DrinkType;
  const d = DRINKS.find((x) => x.type === t);
  return d ? { emoji: d.emoji, label: d.label } : { emoji: "💧", label: "Agua" };
}

function fmtMl(ml: number) {
  return `${ml} ml`;
}

function roundUpToQuick(needMl: number, quickList: number[]) {
  if (needMl <= 0) return 0;
  const sorted = [...quickList].sort((a, b) => a - b);
  const next = sorted.find((n) => n >= needMl);
  return next ?? sorted[sorted.length - 1] ?? needMl;
}

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [quickAmount, setQuickAmount] = useState<number>(250);

  const [drinkType, setDrinkType] = useState<DrinkType>("water");

  // Bubble menu open/close
  const [fabOpen, setFabOpen] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [tab, setTab] = useState<"home" | "stats">("home");
  const [now, setNow] = useState(() => new Date());

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

  const totalTodayRaw = useMemo(
    () => todayEntries.reduce((sum, e) => sum + e.amountMl, 0),
    [todayEntries]
  );

  const totalTodayEffective = useMemo(
    () =>
      todayEntries.reduce((sum, e: any) => {
        const f = factorFor(e.type);
        return sum + e.amountMl * f;
      }, 0),
    [todayEntries]
  );

  const goal = settings?.dailyGoalMl ?? 2000;
  const pct = Math.min(100, Math.round((totalTodayEffective / goal) * 100));
  const quickList = settings?.quickAmountsMl ?? [150, 250, 330, 500, 750];

  useEffect(() => {
    if (!quickList.includes(quickAmount)) setQuickAmount(quickList[0] ?? 250);
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

  const ps = pacingStatus(totalTodayEffective, expected);
  const diffText = ps.diff === 0 ? "0 ml" : `${ps.diff > 0 ? "+" : ""}${ps.diff} ml`;
  const PaceIcon = ps.diff === 0 ? Minus : ps.diff < 0 ? TrendingDown : TrendingUp;

  // Tip "bebe X antes de Y"
  const stepMinutes = settings?.stepMinutes ?? 60;
  const guide = nextHourGuidance({
    now,
    wakeHour,
    sleepHour,
    dailyGoalMl: goal,
    totalTodayMl: totalTodayEffective,
    stepMinutes
  });

  const guideTime = guide.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const showGuide = ps.diff < -150 && guide.needMl > 0;
  const guideRoundedMl = roundUpToQuick(guide.needMl, quickList);

  // Undo toast
  const [undoInfo, setUndoInfo] = useState<null | { id: number; amountMl: number; type: DrinkType }>(
    null
  );
  const undoTimer = useRef<number | null>(null);

  function startUndoTimer() {
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => {
      setUndoInfo(null);
      undoTimer.current = null;
    }, 5000);
  }

  async function add(amountMl: number, type: DrinkType = drinkType) {
    const id = (await db.entries.add({ ts: Date.now(), amountMl, type })) as number;
    setUndoInfo({ id, amountMl, type });
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

  // Cerrar modal: tecla ESC (ajustes)
  useEffect(() => {
    if (!showSettings) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSettings(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSettings]);

  // Cerrar bubble menu: tecla ESC
  useEffect(() => {
    if (!fabOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFabOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fabOpen]);

  const effectiveRounded = Math.round(totalTodayEffective);

  const bubbles = DRINKS.map((d, i) => {
    // posiciones "fan" (ajusta si metes más bebidas)
    const pos = [
      { dx: -92, dy: -74 },
      { dx: 0, dy: -108 },
      { dx: 92, dy: -74 },
      { dx: 92, dy: 0 },
      { dx: 0, dy: 108 },
      { dx: -92, dy: 74 }
    ];

    const p = pos[i] ?? { dx: 0, dy: -108 };
    return { type: d.type, dx: p.dx, dy: p.dy };
  });

  return (
    <div
      style={{
        maxWidth: 520,
        margin: "0 auto",
        padding: 16,
        fontFamily: "system-ui",
        background: "#fafafa",
        minHeight: "100vh",
        color: "#111"
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>

        <img
          src="/logo.png"
          alt="WaterReminder logo"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            objectFit: "cover"
          }}
        />
        <h1 style={{ margin: 0, letterSpacing: -0.5 }}>WaterReminder</h1>

        <button
          onClick={() => setShowSettings(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #e5e5e5",
            background: "white",
            color: "#111",
            fontWeight: 800
          }}
          aria-label="Abrir ajustes"
        >
          <SettingsIcon size={18} />
          Ajustes
        </button>
      </div>

      {/* Modal Ajustes */}
      {showSettings && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowSettings(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-end",
            padding: 12,
            zIndex: 50
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 520,
              background: "white",
              borderRadius: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
              overflow: "hidden",
              color: "#111"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 12,
                borderBottom: "1px solid #eee"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800 }}>
                <SettingsIcon size={18} />
                Ajustes
              </div>

              <button
                onClick={() => setShowSettings(false)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  border: "1px solid #eee",
                  background: "white"
                }}
                aria-label="Cerrar ajustes"
              >
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
          <div
            style={{
              marginTop: 12,
              padding: 16,
              borderRadius: 16,
              background: "white",
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, opacity: 0.65, display: "flex", alignItems: "center", gap: 6 }}>
                  <Droplets size={16} />
                  Hoy
                </div>

                <div style={{ fontSize: 34, fontWeight: 800, marginTop: 2 }}>{fmtMl(effectiveRounded)}</div>

                <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>
                  Consumido: {fmtMl(totalTodayRaw)}
                </div>

                <div
                  style={{
                    fontSize: 13,
                    opacity: 0.75,
                    marginTop: 6,
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap"
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Target size={16} />
                    Objetivo: {fmtMl(goal)} · {pct}%
                  </span>

                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Clock size={16} />
                    A esta hora: {fmtMl(expected)}
                  </span>

                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <PaceIcon size={16} />
                    <strong style={{ fontWeight: 800 }}>{ps.label}</strong> ({diffText})
                  </span>
                </div>

                {showGuide && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: "1px solid #eee",
                      background: "#fafafa",
                      fontSize: 13,
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start"
                    }}
                  >
                    <Lightbulb size={18} style={{ marginTop: 1 }} />
                    <div style={{ flex: 1 }}>
                      Para ir en ritmo, bebe <strong>{guideRoundedMl} ml</strong> antes de{" "}
                      <strong>{guideTime}</strong>.
                      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                        Bebida actual:{" "}
                        <strong>
                          {labelFor(drinkType).emoji} {labelFor(drinkType).label}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Arriba SOLO cantidad */}
              <div style={{ textAlign: "right" }}>
                <select
                  value={quickAmount}
                  onChange={(e) => setQuickAmount(Number(e.target.value))}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid #e5e5e5",
                    background: "white",
                    color: "#111"
                  }}
                  aria-label="Cantidad rápida"
                >
                  {quickList.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>

                <div style={{ height: 8 }} />

                <div style={{ fontSize: 12, opacity: 0.65 }}>
                  {labelFor(drinkType).emoji} {labelFor(drinkType).label}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, width: "100%", height: 12, background: "#eee", borderRadius: 999 }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: pct >= 100 ? "#2ecc71" : ps.diff < -150 ? "#e74c3c" : "#3498db",
                  borderRadius: 999,
                  transition: "width 0.3s ease"
                }}
              />
            </div>
          </div>

          {/* Registros */}
          <h2 style={{ marginTop: 18, marginBottom: 10 }}>Registros de hoy</h2>

          {todayEntries.length === 0 ? (
            <div style={{ opacity: 0.65 }}>Aún no has registrado nada.</div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {todayEntries.map((e: any) => {
                const d = labelFor(e.type);
                const eff = Math.round(e.amountMl * factorFor(e.type));
                return (
                  <li
                    key={e.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "10px 0",
                      borderBottom: "1px solid #eee"
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800 }}>
                        {fmtMl(e.amountMl)}{" "}
                        <span style={{ opacity: 0.75, fontWeight: 600 }}>
                          · {d.emoji} {d.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.65 }}>
                        {new Date(e.ts).toLocaleTimeString()} · Hidratación: {fmtMl(eff)}
                      </div>
                    </div>
                    <button
                      onClick={() => remove(e.id)}
                      style={{
                        border: "1px solid #eee",
                        background: "white",
                        borderRadius: 12,
                        padding: "8px 10px",
                        color: "#111"
                      }}
                    >
                      Borrar
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <div style={{ marginTop: 12 }}>
          <StatsView goalMl={goal} />
        </div>
      )}

      {/* Overlay para cerrar el bubble menu al tocar fuera */}
      {fabOpen && (
        <div
          onClick={() => setFabOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "transparent",
            zIndex: 65
          }}
        />
      )}

      {/* Bubble menu */}
      <div
        style={{
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: 92,
          zIndex: 70
        }}
      >
        {/* Burbujas */}
        {bubbles.map((b) => {
          const d = DRINKS.find((x) => x.type === b.type)!;
          const active = drinkType === b.type;

          return (
            <button
              key={b.type}
              onClick={() => {
                // seleccionar bebida
                setDrinkType(b.type);

                // añadir al tocar bebida:
                const amountToAdd = showGuide && guideRoundedMl > 0 ? guideRoundedMl : quickAmount;
                add(amountToAdd, b.type);

                // cerrar menú
                setFabOpen(false);
              }}
              style={{
                position: "absolute",
                left: fabOpen ? b.dx : 0,
                bottom: fabOpen ? -b.dy : 0,
                width: 56,
                height: 56,
                borderRadius: 999,
                border: active ? "2px solid #111" : "1px solid #e5e5e5",
                background: "white",
                boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: fabOpen ? 1 : 0,
                pointerEvents: fabOpen ? "auto" : "none",
                transform: fabOpen ? "scale(1)" : "scale(0.85)",
                transition: "all 180ms ease"
              }}
              aria-label={`Añadir ${d.label}`}
              title={`Añadir (${d.label})`}
            >
              <span style={{ fontSize: 22 }}>{d.emoji}</span>
            </button>
          );
        })}

        {/* Botón principal: abre/cierra menú */}
        <button
          onClick={() => setFabOpen((v) => !v)}
          style={{
            width: 66,
            height: 66,
            borderRadius: 999,
            border: "1px solid #e5e5e5",
            background: fabOpen ? "#22c55e" : "#111",
            color: "white",
            boxShadow: "0 12px 26px rgba(0,0,0,0.22)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          aria-label={fabOpen ? "Cerrar menú bebidas" : "Abrir menú bebidas"}
        >
          {fabOpen ? <XIcon size={26} /> : <Plus size={26} />}
        </button>
      </div>

      {/* UNDO toast */}
      {undoInfo && (
        <div
          style={{
            position: "fixed",
            left: 12,
            right: 12,
            bottom: 92,
            display: "flex",
            justifyContent: "center",
            zIndex: 60
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              borderRadius: 16,
              padding: "12px 12px",
              border: "1px solid #eee",
              background: "white",
              boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              color: "#111"
            }}
          >
            <div style={{ fontSize: 13, opacity: 0.9 }}>
              Añadido <strong>{undoInfo.amountMl} ml</strong>{" "}
              <span style={{ opacity: 0.75 }}>
                · {labelFor(undoInfo.type).emoji} {labelFor(undoInfo.type).label}
              </span>
            </div>

            <button
              onClick={undoLast}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #e5e5e5",
                background: "white",
                color: "#111",
                fontWeight: 800
              }}
              aria-label="Deshacer último añadido"
            >
              <Undo2 size={16} />
              Deshacer
            </button>
          </div>
        </div>
      )}

      {/* Spacer for bottom tab bar */}
      <div style={{ height: 86 }} />

      {/* Bottom Tab Bar */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          padding: 12,
          background: "rgba(250,250,250,0.9)",
          backdropFilter: "blur(10px)",
          borderTop: "1px solid #eee"
        }}
      >
        <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", gap: 10 }}>
          <button
            onClick={() => setTab("home")}
            style={{
              flex: 1,
              padding: "12px 12px",
              borderRadius: 14,
              border: "1px solid #e5e5e5",
              background: tab === "home" ? "#111" : "white",
              color: tab === "home" ? "white" : "#111",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontWeight: 900
            }}
            aria-label="Ir a Hoy"
          >
            <Home size={18} />
            Hoy
          </button>

          <button
            onClick={() => setTab("stats")}
            style={{
              flex: 1,
              padding: "12px 12px",
              borderRadius: 14,
              border: "1px solid #e5e5e5",
              background: tab === "stats" ? "#111" : "white",
              color: tab === "stats" ? "white" : "#111",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontWeight: 900
            }}
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
