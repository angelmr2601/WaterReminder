import { useEffect, useState } from "react";
import { db } from "./db";
import type { Settings } from "./db";

export function SettingsView() {
  const [s, setS] = useState<Settings | null>(null);
  const [quickInput, setQuickInput] = useState("");

  useEffect(() => {
    (async () => {
      setS((await db.settings.get("me")) ?? null);
    })();
  }, []);

  async function save(patch: Partial<Settings>) {
    if (!s) return;
    const next = { ...s, ...patch };
    setS(next);
    await db.settings.put(next);
  }

  function parseQuickList(text: string): number[] | null {
    const parts = text
      .split(/[,\s]+/g)
      .map((x) => x.trim())
      .filter(Boolean);

    const nums = parts.map((p) => Number(p)).filter((n) => Number.isFinite(n) && n > 0);
    if (nums.length === 0) return null;

    // quitar duplicados y ordenar
    return Array.from(new Set(nums)).sort((a, b) => a - b);
  }

  if (!s) return null;

  return (
    <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
      <h2 style={{ marginTop: 0 }}>Ajustes</h2>

      <label style={{ display: "block", marginBottom: 10 }}>
        Objetivo diario (ml)
        <input
          type="number"
          min={250}
          step={50}
          value={s.dailyGoalMl}
          onChange={(e) => save({ dailyGoalMl: Number(e.target.value) })}
          style={{ display: "block", width: "100%" }}
        />
      </label>

      <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
        <label style={{ flex: 1 }}>
          Inicio recordatorios (hora)
          <input
            type="number"
            min={0}
            max={23}
            value={s.wakeHour}
            onChange={(e) => save({ wakeHour: Number(e.target.value) })}
            style={{ display: "block", width: "100%" }}
          />
        </label>

        <label style={{ flex: 1 }}>
          Fin recordatorios (hora)
          <input
            type="number"
            min={0}
            max={23}
            value={s.sleepHour}
            onChange={(e) => save({ sleepHour: Number(e.target.value) })}
            style={{ display: "block", width: "100%" }}
          />
        </label>
      </div>

      <label style={{ display: "block", marginBottom: 14 }}>
        Intervalo (min)
        <input
          type="number"
          min={15}
          step={5}
          value={s.stepMinutes}
          onChange={(e) => save({ stepMinutes: Number(e.target.value) })}
          style={{ display: "block", width: "100%" }}
        />
      </label>

      <div style={{ paddingTop: 10, borderTop: "1px solid #eee" }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Botones rápidos (ml)</div>
        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
          Escribe cantidades separadas por comas o espacios. Ej: <code>150, 250, 330, 500</code>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder={s.quickAmountsMl.join(", ")}
            style={{ flex: 1 }}
          />
          <button
            onClick={async () => {
              const list = parseQuickList(quickInput);
              if (!list) return;
              await save({ quickAmountsMl: list });
              setQuickInput("");
            }}
          >
            Guardar
          </button>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {s.quickAmountsMl.map((n) => (
            <span key={n} style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 999 }}>
              {n}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
