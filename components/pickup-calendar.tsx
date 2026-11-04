"use client";

import { useEffect, useState } from "react";
import {
  addCivilDays,
  choiceStamp,
  dateKey,
  edmontonNow,
  formatClockMinutes,
  formatPickupChoice,
  monthCells,
  openMinutes,
  parsePickupChoice,
  pickupWindows,
  PICKUP_HORIZON_DAYS,
  weekdayName,
} from "@/lib/pickup";

const WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function PickupCalendar({
  schedules,
  summary,
  selectedTime,
  onTime,
  error = "",
}: {
  schedules: string[];
  summary: string[];
  selectedTime: string;
  onTime: (value: string) => void;
  error?: string;
}) {
  const [today] = useState(() => edmontonNow());
  const selected = parsePickupChoice(selectedTime);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => ({ year: selected?.year ?? today.year, month: selected?.month ?? today.month }));
  const [day, setDay] = useState(selected ? dateKey(selected.year, selected.month, selected.day) : "");
  const ready = schedules.length > 0 && schedules.every((schedule) => pickupWindows(schedule).length > 0);
  const last = addCivilDays(today, PICKUP_HORIZON_DAYS);
  const canPrev = view.year > today.year || (view.year === today.year && view.month > today.month);
  const canNext = view.year < last.year || (view.year === last.year && view.month < last.month);
  const focused = day ? day.split("-").map(Number) : [];
  const times = focused.length === 3 ? openMinutes(schedules, focused[0], focused[1], focused[2], today) : [];

  useEffect(() => {
    if (error) setOpen(true);
  }, [error]);

  function shift(delta: number) {
    const next = new Date(Date.UTC(view.year, view.month - 1 + delta, 1));
    setView({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 });
  }

  return (
    <div>
      <span className="block text-xs font-medium uppercase tracking-[0.14em] text-muted">Pickup time</span>
      {summary.length > 0 ? <p className="mt-1 text-muted">Available: {summary.join(" · ")}</p> : schedules.length > 1 ? <p className="mt-1 text-muted">Choose a time that works for every item.</p> : null}
      {ready ? (
        <>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
            className="mt-2 flex w-full items-center justify-between rounded-2xl border border-line bg-white px-4 py-3 text-left"
          >
            <span className={selectedTime ? "font-medium" : "text-muted"}>{selectedTime ? formatPickupChoice(selectedTime) : "Choose a pickup time"}</span>
            <span aria-hidden="true" className="text-muted">{open ? "▴" : "▾"}</span>
          </button>
          {open ? (
            <div className="mt-2 rounded-2xl border border-line bg-white p-3">
              <div className="flex items-center justify-between">
                <button type="button" aria-label="Previous month" disabled={!canPrev} onClick={() => shift(-1)} className="h-9 w-9 rounded-full text-lg disabled:text-line">‹</button>
                <p className="text-sm font-medium">
                  {new Date(Date.UTC(view.year, view.month - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
                </p>
                <button type="button" aria-label="Next month" disabled={!canNext} onClick={() => shift(1)} className="h-9 w-9 rounded-full text-lg disabled:text-line">›</button>
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs text-muted">
                {WEEK.map((label) => <span key={label}>{label}</span>)}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {monthCells(view.year, view.month).map((cell, index) => {
                  if (!cell) return <span key={`empty-${index}`} />;
                  const key = dateKey(cell.year, cell.month, cell.day);
                  const slots = openMinutes(schedules, cell.year, cell.month, cell.day, today);
                  const enabled = slots.length > 0;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!enabled}
                      aria-pressed={day === key}
                      aria-label={`${weekdayName(cell.year, cell.month, cell.day)} ${cell.month}/${cell.day}`}
                      onClick={() => setDay(key)}
                      className={`h-9 rounded-xl text-sm ${day === key ? "bg-forest text-white" : enabled ? "bg-moss font-medium text-ink" : "text-muted"}`}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
              {day ? (
                <div className="mt-3">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Time · Mountain Time</p>
                  {times.length > 0 ? (
                    <div className="mt-2 grid max-h-52 grid-cols-3 gap-1 overflow-y-auto">
                      {times.map((minute) => {
                        const stamp = choiceStamp(focused[0], focused[1], focused[2], minute);
                        return (
                          <button
                            key={stamp}
                            type="button"
                            aria-pressed={selectedTime === stamp}
                            onClick={() => {
                              onTime(stamp);
                              setOpen(false);
                            }}
                            className={`h-9 rounded-xl text-sm ${selectedTime === stamp ? "bg-forest text-white" : "border border-line bg-white"}`}
                          >
                            {formatClockMinutes(minute)}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted">No times left on this day.</p>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted">Pick a highlighted day, then a 15-minute time.</p>
              )}
            </div>
          ) : null}
          <input type="hidden" name="pickupTime" value={selectedTime} />
        </>
      ) : (
        <p className="mt-1">The seller has not set pickup days.</p>
      )}
      {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
