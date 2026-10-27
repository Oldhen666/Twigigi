import { useId } from "react";

export function Stars({ value }: { value: number }) {
  const prefix = useId().replace(/:/g, "");
  return (
    <span className="inline-flex" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((index) => {
        const fill = Math.max(0, Math.min(1, value - index));
        const id = `${prefix}-${index}`;
        return (
          <svg key={index} width="14" height="14" viewBox="0 0 20 20" aria-hidden className="text-forest">
            <defs>
              <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
                <stop offset={`${fill * 100}%`} stopColor="currentColor" />
                <stop offset={`${fill * 100}%`} stopColor="#e4dcd0" />
              </linearGradient>
            </defs>
            <path
              d="M10 1.8 12.4 7l5.6.5-4.2 3.7 1.3 5.5L10 13.8 4.9 16.7l1.3-5.5L2 7.5 7.6 7 10 1.8Z"
              fill={`url(#${id})`}
            />
          </svg>
        );
      })}
    </span>
  );
}
