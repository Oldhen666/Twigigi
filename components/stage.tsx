export function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <div className="mx-auto w-full max-w-[440px] sm:py-8">{children}</div>
    </div>
  );
}

export function ProductFallback() {
  return (
    <Stage>
      <div className="animate-pulse bg-card sm:rounded-[28px]">
        <div className="aspect-square bg-paper-deep" />
        <div className="space-y-3 p-5">
          <div className="h-3 w-28 rounded bg-paper-deep" />
          <div className="h-8 w-3/4 rounded bg-paper-deep" />
          <div className="h-6 w-24 rounded bg-paper-deep" />
          <div className="h-14 rounded-2xl bg-paper-deep" />
        </div>
      </div>
    </Stage>
  );
}
