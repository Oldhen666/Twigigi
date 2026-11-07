"use client";

import { useState } from "react";
import { PickupCalendar } from "@/components/pickup-calendar";

export function SellerPickupTime({
  schedules,
  summary,
  value = "",
}: {
  schedules: string[];
  summary: string[];
  value?: string;
}) {
  const [selected, setSelected] = useState(value);
  return (
    <PickupCalendar
      schedules={schedules}
      summary={summary}
      selectedTime={selected}
      onTime={setSelected}
      emptyMessage="Add pickup days on the product first."
    />
  );
}
