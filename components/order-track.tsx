import type { TrackStep } from "@/lib/order-flow";

const dot = {
  done: "bg-forest",
  current: "border-2 border-forest bg-transparent",
  upcoming: "bg-line",
  stopped: "bg-danger",
};

export function OrderTrack({ steps }: { steps: TrackStep[] }) {
  return (
    <ol aria-label="Order status" className="mt-4 flex gap-1 overflow-x-auto pb-1">
      {steps.map((step, index) => (
        <li key={`${step.label}-${index}`} className="flex min-w-24 flex-1 items-start" aria-current={step.state === "current" || step.state === "stopped" ? "step" : undefined}>
          <div className="w-full">
            <div className="flex items-center">
              <span className={`size-3 shrink-0 rounded-full ${dot[step.state]}`} />
              {index < steps.length - 1 ? <span className={`mx-1 h-px flex-1 ${step.state === "done" ? "bg-forest" : "bg-line"}`} /> : null}
            </div>
            <p className={`mt-2 pr-2 text-xs leading-4 ${step.state === "current" || step.state === "stopped" ? "font-medium text-ink" : "text-muted"}`}>{step.label}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
