import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, ensureDefaultSettings } from "./db";
import type { Settings } from "./db";
import { startOfTodayMs, endOfTodayMs } from "./time";
import { SettingsView } from "./SettingsView";

function fmtMl(ml: number) {
  return `${ml} ml`;
}

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [quickAmount, setQuickAmount] = useState<number>(250);
  const [showSettings, setShowSettings] = useState(false);

  // Inicializa settings por defecto (si no existen)
  useEffect(() => {
    (async () => {
      await ensureDefaultSettings();
      setSettings((await db.settings.get("me")) ?? null);
    })();
  }, []);

  // Mantén settings actualizados si se cambian desde SettingsView
  const liveSettings =
    useLiveQuery(async () => (await db.settings.get("me")) ?? null, []) ?? null;

  useEffect(() => {
    if (liveSettings) setSettings(liveSettings);
  }, [liveSettings]);

  const todayEntries =
    useLiveQuery(async () => {
      const from = startOfTodayMs();
      const to = endOfTodayMs();
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

  // Ajusta quickAmount si no existe en la lista (por ejemplo si cambias quick buttons)
  useEffect(() => {
    if (!quickList.includes(quickAmount)) {
      setQuickAmount(quickList[0] ?? 250);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.quickAmountsMl]);

  async function add(amountMl: number) {
    await db.entries.add({ ts: Date.now(), amountMl, type: "water" });
  }

  async function remove(id?: number) {
    if (!id) return;
    await db.entries.delete(id);
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 16, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ marginTop: 0, marginBottom: 0 }}>Hydro</h1>
        <button onClick={() => setShowSettings((v) => !v)}>
          {showSettings ? "Cerrar" : "Ajustes"}
        </button>
      </div>

      {showSettings && (
        <div style={{ marginTop: 12 }}>
          <SettingsView />
        </div>
      )}

      <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, opacity: 0.7 }}>Hoy</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{fmtMl(totalToday)}</div>
            <div style={{ fontSize: 14, opacity: 0.7 }}>
              Objetivo: {fmtMl(goal)} · {pct}%
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <select value={quickAmount} onChange={(e) => setQuickAmount(Number(e.target.value))}>
              {quickList.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <div style={{ height: 8 }} />
            <button onClick={() => add(quickAmount)} style={{ padding: "10px 14px" }}>
              + {quickAmount} ml
            </button>
          </div>
        </div>

        <div style={{ height: 10 }} />
        <div style={{ width: "100%", height: 10, background: "#eee", borderRadius: 999 }}>
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: "#111",
              borderRadius: 999
            }}
          />
        </div>
      </div>

      <h2 style={{ marginTop: 20 }}>Registros de hoy</h2>
      {todayEntries.length === 0 ? (
        <div style={{ opacity: 0.7 }}>Aún no has registrado nada.</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {todayEntries.map((e) => (
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
                <div style={{ fontWeight: 600 }}>{fmtMl(e.amountMl)}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {new Date(e.ts).toLocaleTimeString()}
                </div>
              </div>
              <button onClick={() => remove(e.id)}>Borrar</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
