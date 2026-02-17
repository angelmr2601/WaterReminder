export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Calcula cuántos ml "deberías llevar" a esta hora según:
 * - ventana activa (wakeHour..sleepHour)
 * - objetivo diario
 */
export function expectedByNowMl(params: {
  now: Date;
  wakeHour: number;
  sleepHour: number;
  dailyGoalMl: number;
}) {
  const { now, wakeHour, sleepHour, dailyGoalMl } = params;

  const start = new Date(now);
  start.setHours(wakeHour, 0, 0, 0);

  const end = new Date(now);
  end.setHours(sleepHour, 0, 0, 0);

  // Si sleepHour es menor/igual que wakeHour, asumimos que cruza medianoche (ej: 22 -> 7)
  if (end.getTime() <= start.getTime()) {
    end.setDate(end.getDate() + 1);
  }

  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return 0;

  const elapsedMs = now.getTime() - start.getTime();
  const ratio = clamp(elapsedMs / totalMs, 0, 1);

  return Math.round(dailyGoalMl * ratio);
}

export function pacingStatus(totalTodayMl: number, expectedMl: number) {
  const diff = totalTodayMl - expectedMl; // positivo = vas por delante
  const abs = Math.abs(diff);

  // Umbral simple: 150ml (ajústalo a tu gusto)
  if (abs < 150) return { label: "Vas en ritmo", diff };
  if (diff < 0) return { label: "Vas por debajo", diff };
  return { label: "Vas por delante", diff };
}
