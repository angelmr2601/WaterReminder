import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { addDays, dayLabel, startOfDayMs, endOfDayMs } from "./week.ts";

type DayStat = {
    day: Date;
    totalMl: number;
};

export function WeeklyChart({ goalMl }: { goalMl: number }) {
    const stats =
        useLiveQuery(async (): Promise<DayStat[]> => {
            const today = new Date();
            const days: DayStat[] = [];

            for (let i = 6; i >= 0; i--) {
                const day = addDays(today, -i);
                const from = startOfDayMs(day);
                const to = endOfDayMs(day);

                const rows = await db.entries.where("ts").between(from, to, true, true).toArray();
                const totalMl = rows.reduce((sum, e) => sum + e.amountMl, 0);
                days.push({ day, totalMl });
            }

            return days;
        }, []) ?? [];

    if (stats.length === 0) {
        return (
            <div
                style={{
                    padding: 16,
                    borderRadius: 16,
                    background: "white",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <h2 style={{ margin: 0, fontSize: 18 }}>Semana</h2>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>Objetivo: {goalMl} ml</div>
                </div>
                <div style={{ marginTop: 8, opacity: 0.7 }}>Cargando…</div>
            </div>
        );
    }

    const maxMl = Math.max(goalMl, ...stats.map((s) => s.totalMl), 1);

    return (
        <div
            style={{
                padding: 16,
                borderRadius: 16,
                background: "white",
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>Semana</h2>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Objetivo: {goalMl} ml</div>
            </div>

            <div style={{ height: 12 }} />

            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", height: 140 }}>
                {stats.map((s) => {
                    const h = Math.round((s.totalMl / maxMl) * 120);
                    const hitGoal = s.totalMl >= goalMl;

                    return (
                        <div key={s.day.toISOString()} style={{ flex: 1, minWidth: 0 }}>
                            <div
                                title={`${Math.round(s.totalMl)} ml`}
                                style={{
                                    height: 120,
                                    display: "flex",
                                    alignItems: "flex-end",
                                    background: "#f3f3f3",
                                    borderRadius: 10,
                                    overflow: "hidden"
                                }}
                            >
                                <div
                                    style={{
                                        height: h,
                                        width: "100%",
                                        background: hitGoal ? "#2ecc71" : "#3498db",
                                        transition: "height 0.2s ease"
                                    }}
                                />
                            </div>

                            <div style={{ marginTop: 6, fontSize: 12, textAlign: "center", opacity: 0.8 }}>
                                {dayLabel(s.day)}
                            </div>
                            <div style={{ fontSize: 11, textAlign: "center", opacity: 0.65 }}>
                                {Math.round(s.totalMl)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
