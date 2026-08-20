import type { ChartDocument, ChartObject } from "@/types/seat-chart";
import { countPlaces } from "./chart-ops.ts";
import { ko } from "./i18n.ts";

export type ValidationItem = {
  readonly id: string;
  readonly label: string;
  readonly ok: boolean;
};

export function validateChart(chart: ChartDocument): readonly ValidationItem[] {
  const labels = new Map<string, number>();
  let unlabeled = 0;
  let uncategorized = 0;
  const typeCats = new Map<string, Set<string>>();

  const visit = (obj: ChartObject) => {
    if (!obj.label?.trim()) unlabeled += 1;
    else labels.set(obj.label, (labels.get(obj.label) ?? 0) + 1);

    if (obj.type === "row" || obj.type === "table" || obj.type === "booth" || obj.type === "area" || obj.type === "section") {
      if (!obj.categoryKey) uncategorized += 1;
    }

    if (obj.categoryKey) {
      const set = typeCats.get(obj.type) ?? new Set();
      set.add(obj.categoryKey);
      typeCats.set(obj.type, set);
    }

    if (obj.type === "row") {
      for (const seat of obj.seats) {
        if (!seat.label?.trim()) unlabeled += 1;
        else {
          const key = `${obj.id}:${seat.label}`;
          labels.set(key, (labels.get(key) ?? 0) + 1);
        }
      }
    }
    if (obj.type === "table") {
      for (const seat of obj.seats) {
        if (!seat.label?.trim()) unlabeled += 1;
        else {
          const key = `${obj.id}:${seat.label}`;
          labels.set(key, (labels.get(key) ?? 0) + 1);
        }
      }
    }
    if (obj.type === "section" && obj.nestedRows) {
      for (const row of obj.nestedRows) visit(row);
    }
  };

  for (const obj of chart.objects) visit(obj);

  const hasDup = [...labels.values()].some((n) => n > 1);
  const oneCatPerType = [...typeCats.values()].every((s) => s.size <= 1);
  const places = countPlaces(chart);

  return [
    { id: "dup", label: ko.validation.dup, ok: !hasDup },
    { id: "labeled", label: ko.validation.labeled, ok: unlabeled === 0 },
    { id: "categorized", label: ko.validation.categorized, ok: uncategorized === 0 },
    { id: "oneCat", label: ko.validation.oneCat, ok: oneCatPerType },
    { id: "focal", label: ko.validation.focal, ok: Boolean(chart.focalPoint) },
    {
      id: "places",
      label: `${places.toLocaleString("ko-KR")} ${ko.validation.places}`,
      ok: places > 0,
    },
  ];
}

export function blockingValidationItems(chart: ChartDocument): readonly ValidationItem[] {
  return validateChart(chart).filter((item) => !item.ok && item.id !== "oneCat");
}
