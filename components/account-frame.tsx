import { AccountNav } from "@/components/account-nav";
import { Logo } from "@/components/logo";

export async function AccountFrame({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="buyer-theme min-h-screen">
      <header className="page-frame flex flex-wrap items-center justify-between gap-3 py-5">
        <Logo />
        <AccountNav current="buyer" />
      </header>
      <main className="page-frame pb-16">
        <h1 className="font-serif text-4xl">{title}</h1>
        {lede ? <p className="mt-2 text-sm text-muted">{lede}</p> : null}
        {children}
      </main>
    </div>
  );
}
