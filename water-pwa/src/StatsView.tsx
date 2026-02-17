import { WeeklyChart } from "./WeeklyChart";
import { MonthlyCalendar } from "./MonthlyCalendar";

export function StatsView({ goalMl }: { goalMl: number }) {
  return (
    <div>
      <WeeklyChart goalMl={goalMl} />
      <MonthlyCalendar goalMl={goalMl} />
    </div>
  );
}
