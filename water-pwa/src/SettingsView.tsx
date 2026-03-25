import { useEffect, useState } from "react";
import { db } from "./db";
import type { Settings } from "./db";
import {
  Target,
  Clock,
  Zap,
  Save,
  Droplets,
  Bell
} from "lucide-react";
import {
  getPushAvailability,
  getPushProvider,
  getPushStatus,
  hasPushConfig,
  sendBrrrTestNotification,
  subscribeToPush,
  unsubscribeFromPush
} from "./notifications";

const initialAvailability = hasPushConfig() ? getPushAvailability() : "unconfigured";

export function SettingsView() {
  const [s, setS] = useState<Settings | null>(null);
  const [quickInput, setQuickInput] = useState("");
  const [savedPing, setSavedPing] = useState(false);
  const [pushReady, setPushReady] = useState(initialAvailability === "ready");
  const [pushError, setPushError] = useState<string | null>(
    initialAvailability === "unsupported" ? "Este navegador no soporta notificaciones push web." : null
  );
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushProvider, setPushProvider] = useState(getPushProvider());
  const [pushTestBusy, setPushTestBusy] = useState(false);
  const [pushTestResult, setPushTestResult] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setS((await db.settings.get("me")) ?? null);
    })();
  }, []);

  useEffect(() => {
    if (!hasPushConfig() || initialAvailability !== "ready") return;

    (async () => {
      const status = await getPushStatus();
      setPushProvider(status.provider);
      setPushReady(status.available);
      setPushSubscribed(status.subscribed);
      setPushPermission(status.permission);
      if (status.blockedByClient) {
        setPushError("OneSignal fue bloqueado por Safari o por un bloqueador de contenido.");
      }
    })();
  }, []);

  async function save(patch: Partial<Settings>) {
    if (!s) return;
    const next = { ...s, ...patch };
    setS(next);
    await db.settings.put(next);

    // mini feedback visual
    setSavedPing(true);
    window.setTimeout(() => setSavedPing(false), 800);
  }

  function parseQuickList(text: string): number[] | null {
    const parts = text
      .split(/[,\s]+/g)
      .map((x) => x.trim())
      .filter(Boolean);

    const nums = parts
      .map((p) => Number(p))
      .filter((n) => Number.isFinite(n) && n > 0)
      .map((n) => Math.round(n));

    if (nums.length === 0) return null;
    return Array.from(new Set(nums)).sort((a, b) => a - b);
  }

  if (!s) return null;

  const inputStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid #e5e5e5",
    background: "white",
    fontSize: 16
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    opacity: 0.75,
    marginBottom: 6
  };

  return (
    <div>
      <section style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, marginBottom: 10 }}>
          <Bell size={18} />
          Notificaciones al móvil
        </div>

        {!hasPushConfig() ? (
          <div style={{ fontSize: 14, opacity: 0.75 }}>
            Configura <code>VITE_BRRR_WEBHOOK_URL</code> (recomendado) o <code>VITE_ONESIGNAL_APP_ID</code> en tu <code>.env</code>.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 8 }}>
              Proveedor: {pushProvider} · Estado: {pushSubscribed ? "activo" : "inactivo"} · Permiso: {pushPermission}
            </div>

            {pushError && (
              <div style={{ fontSize: 12, color: "#a33", marginBottom: 10 }}>
                {pushError}
              </div>
            )}

            <button
              onClick={async () => {
                setPushBusy(true);
                setPushError(null);

                if (!pushReady) {
                  const status = await getPushStatus();
                  setPushProvider(status.provider);
                  setPushReady(status.available);
                  setPushPermission(status.permission);
                  if (!status.available) {
                    setPushError(
                      status.blockedByClient
                        ? "OneSignal está bloqueado por el navegador o un bloqueador de anuncios/contenido."
                        : "No se puede activar push en este navegador."
                    );
                    setPushBusy(false);
                    return;
                  }
                }

                if (pushSubscribed) {
                  const stillSubscribed = await unsubscribeFromPush();
                  setPushSubscribed(stillSubscribed);
                } else {
                  const nowSubscribed = await subscribeToPush();
                  setPushSubscribed(nowSubscribed);
                  setPushPermission(Notification.permission);
                }

                setPushBusy(false);
              }}
              disabled={pushBusy}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 12px",
                borderRadius: 12,
                border: "1px solid #e5e5e5",
                background: pushSubscribed ? "#fff" : "#111",
                color: pushSubscribed ? "#111" : "#fff",
                fontWeight: 700
              }}
            >
              <Smartphone size={16} />
              {pushBusy ? "Conectando..." : pushSubscribed ? "Desactivar avisos" : pushReady ? "Activar avisos" : "Reintentar conexión"}
            </button>

            {pushProvider === "brrr" && pushSubscribed && (
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={async () => {
                    setPushTestBusy(true);
                    setPushTestResult(null);
                    const ok = await sendBrrrTestNotification("Bebe Agua cojones");
                    setPushTestResult(
                      ok
                        ? "Notificación de prueba enviada a BRRR: \"Bebe Agua cojones\"."
                        : "No se pudo enviar la prueba. Revisa tu webhook de BRRR."
                    );
                    setPushTestBusy(false);
                  }}
                  disabled={pushTestBusy}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #e5e5e5",
                    background: "#fff",
                    color: "#111",
                    fontWeight: 600
                  }}
                >
                  {pushTestBusy ? "Enviando..." : "Enviar prueba BRRR"}
                </button>
                {pushTestResult && (
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
                    {pushTestResult}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* Objetivo */}
      <section style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, marginBottom: 10 }}>
          <Target size={18} />
          Objetivo
          {savedPing && (
            <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>
              Guardado ✓
            </span>
          )}
        </div>

        <label style={{ display: "block" }}>
          <span style={labelStyle}>Objetivo diario (ml)</span>
          <input
            type="number"
            min={250}
            step={50}
            value={s.dailyGoalMl}
            onChange={(e) => save({ dailyGoalMl: Number(e.target.value) })}
            style={inputStyle}
            inputMode="numeric"
          />
        </label>
      </section>

      {/* Horario */}
      <section style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, marginBottom: 10 }}>
          <Clock size={18} />
          Horario
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <label style={{ flex: 1 }}>
            <span style={labelStyle}>Inicio (hora)</span>
            <input
              type="number"
              min={0}
              max={23}
              value={s.wakeHour}
              onChange={(e) => save({ wakeHour: Number(e.target.value) })}
              style={inputStyle}
              inputMode="numeric"
            />
          </label>

          <label style={{ flex: 1 }}>
            <span style={labelStyle}>Fin (hora)</span>
            <input
              type="number"
              min={0}
              max={23}
              value={s.sleepHour}
              onChange={(e) => save({ sleepHour: Number(e.target.value) })}
              style={inputStyle}
              inputMode="numeric"
            />
          </label>
        </div>
      </section>

      {/* Botones rápidos */}
      <section style={{ paddingTop: 14, borderTop: "1px solid #eee" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, marginBottom: 10 }}>
          <Zap size={18} />
          Botones rápidos
        </div>

        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>
          Separa por comas o espacios. Ej: <code>150, 250, 330, 500</code>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder={s.quickAmountsMl.join(", ")}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={async () => {
              const list = parseQuickList(quickInput);
              if (!list) return;
              await save({ quickAmountsMl: list });
              setQuickInput("");
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 12px",
              borderRadius: 12,
              border: "1px solid #e5e5e5",
              background: "#111",
              color: "white",
              fontWeight: 700,
              whiteSpace: "nowrap"
            }}
          >
            <Save size={16} />
            Guardar
          </button>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {s.quickAmountsMl.map((n) => (
            <span
              key={n}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 12px",
                border: "1px solid #e5e5e5",
                borderRadius: 999,
                background: "white"
              }}
            >
              <Droplets size={16} />
              {n}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
