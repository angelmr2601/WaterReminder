import Dexie from "dexie";
import type { Table } from "dexie";

export type DrinkType = "water" | "coffee" | "tea" | "other";

export type Entry = {
  id?: number;
  ts: number;
  amountMl: number;
  type: DrinkType;
  note?: string;
};

export type Settings = {
  id: "me";
  dailyGoalMl: number;
  wakeHour: number;
  sleepHour: number;
  stepMinutes: number;
  quickAmountsMl: number[]; // <-- nuevo
};

class AppDB extends Dexie {
  entries!: Table<Entry, number>;
  settings!: Table<Settings, "me">;

  constructor() {
    super("hydro");
    this.version(1).stores({
      entries: "++id, ts",
      settings: "id"
    });
  }
}

export const db = new AppDB();

export async function ensureDefaultSettings() {
  const s = await db.settings.get("me");
  if (!s) {
    await db.settings.put({
      id: "me",
      dailyGoalMl: 2000,
      wakeHour: 9,
      sleepHour: 22,
      stepMinutes: 60,
      quickAmountsMl: [150, 250, 330, 500, 750]
    });
  }
}
