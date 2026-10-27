import { AccountNav } from "@/components/account-nav";
import { Logo } from "@/components/logo";

export async function AccountFrame({
  title,
  lede,
  section,
  children,
}: {
  title: string;
  lede?: string;
  section: "orders" | "saved" | "history" | "reviews";
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-5">
        <Logo />
        <AccountNav current={section} />
      </header>
      <main className="mx-auto w-full max-w-3xl px-5 pb-16">
        <p className="text-sm text-muted">Other Twigs</p>
        <h1 className="mt-1 font-serif text-4xl">{title}</h1>
        {lede ? <p className="mt-2 text-sm text-muted">{lede}</p> : null}
        {children}
      </main>
    </div>
  );
}
