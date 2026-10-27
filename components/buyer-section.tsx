export function BuyerSection({
  title,
  center,
  children,
}: {
  title: string;
  center?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xs font-medium tracking-[0.16em] text-muted uppercase">{title}</h2>
      <div className={`mt-3 min-h-32 rounded-3xl border border-line bg-card px-5 py-5 ${center ? "flex items-center justify-center text-center" : ""}`}>
        {children}
      </div>
    </section>
  );
}
