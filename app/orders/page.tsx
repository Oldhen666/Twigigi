import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { listBuyerOrders } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";

async function OrdersScreen() {
  const user = await requireUser();
  const orders = listBuyerOrders(user.id);
  return (
    <div className="min-h-screen bg-paper">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-5 text-sm">
          {user.role === "buyer" ? null : <Link href="/dashboard" className="text-ink">Twigs</Link>}
          <form action={signOut}>
            <button className="text-muted">Sign out</button>
          </form>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-3xl px-5 pb-16">
        <h1 className="font-serif text-4xl">Your orders</h1>
        <p className="mt-2 text-sm text-muted">{user.email}</p>
        {orders.length === 0 ? (
          <p className="mt-8 text-sm text-muted">Orders you place while signed in, or with this email, show up here.</p>
        ) : (
          <ul className="mt-8 space-y-3">
            {orders.map((order) => (
              <li key={order.id}>
                <Link href={`/order/${order.id}`} className="block rounded-2xl border border-line bg-card p-4">
                  <p className="font-medium">{order.publicRef || order.productTitle}</p>
                  <p className="text-sm text-muted">{order.productTitle} · {order.quantity} · {order.fulfillment}</p>
                  <p className="mt-1">{formatMoney(order.amountCents, order.currency)}</p>
                  <p className="text-sm text-muted">{order.status} · {formatDate(order.createdAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading your orders…</p>}>
      <OrdersScreen />
    </Suspense>
  );
}

export const metadata = { title: "Your orders", robots: { index: false, follow: false } };
