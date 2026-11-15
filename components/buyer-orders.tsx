"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BuyerTools, narrowBuyerList } from "@/components/buyer-tools";
import { BuyerSection } from "@/components/buyer-section";
import { InteractionLine } from "@/components/interaction-line";
import { ReviewSeller } from "@/components/review-seller";

export type BuyerOrderItem = {
  id: string;
  publicRef: string;
  heading: string;
  quantity: number;
  fulfillment: string;
  amount: string;
  amountCents: number;
  stage: string;
  when: string;
  createdAt: string;
  fileSent: boolean;
  needsYou: boolean;
  interaction: { id: string; publicRef: string; buyerConfirmedAt: string | null; sellerConfirmedAt: string | null } | null;
  allowConfirm: boolean;
  confirmLabel: string;
  reviewTitle: string;
  reviewed: boolean;
  canReview: boolean;
};

export type BuyerQuoteItem = {
  id: string;
  title: string;
  quantity: number;
  when: string;
  createdAt: string;
  replied: boolean;
  closed: boolean;
};

const orderFilters = [
  { value: "all", label: "All orders" },
  { value: "needs", label: "Needs you" },
  { value: "active", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Canceled" },
];

const orderSorts = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "number", label: "Order number" },
  { value: "amount", label: "Highest amount" },
];

const quoteFilters = [
  { value: "all", label: "All quotes" },
  { value: "waiting", label: "Waiting for a reply" },
  { value: "replied", label: "Reply received" },
  { value: "closed", label: "Closed" },
];

const quoteSorts = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

export function BuyerOrders({ orders, quotes }: { orders: BuyerOrderItem[]; quotes: BuyerQuoteItem[] }) {
  const [shown, setShown] = useState<"orders" | "quotes">("orders");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const visibleOrders = useMemo(
    () => narrowBuyerList(orders, matchOrder, sortOrders, query, filter, sort),
    [orders, query, filter, sort],
  );
  const visibleQuotes = useMemo(
    () => narrowBuyerList(quotes, matchQuote, sortQuotes, query, filter, sort),
    [quotes, query, filter, sort],
  );

  function changeShown(next: "orders" | "quotes") {
    setShown(next);
    setQuery("");
    setFilter("all");
    setSort("newest");
  }

  return (
    <div className="mt-8">
      <label className="flex items-center gap-3">
        <span className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Show</span>
        <select
          value={shown}
          onChange={(event) => changeShown(event.target.value === "quotes" ? "quotes" : "orders")}
          className="h-11 rounded-full border border-line bg-card px-4 text-sm font-medium text-ink"
        >
          <option value="orders">Orders</option>
          <option value="quotes">Quotes</option>
        </select>
      </label>
      {shown === "orders" ? (
        <>
          {orders.length > 0 ? (
            <BuyerTools
              query={query}
              onQuery={setQuery}
              placeholder="Order number, Twig, or date"
              searchLabel="Search orders"
              filter={filter}
              onFilter={setFilter}
              filters={orderFilters}
              sort={sort}
              onSort={setSort}
              sorts={orderSorts}
            />
          ) : null}
          <BuyerSection title="Orders" center={orders.length === 0}>
            {orders.length === 0 ? <p className="text-sm text-muted">No order record</p> : visibleOrders.length === 0 ? <p className="text-sm text-muted">No orders match.</p> : (
              <ul className="space-y-3">
                {visibleOrders.map((order) => (
                  <li key={order.id} className="rounded-2xl border border-line bg-card p-4">
                    <Link href={`/order/${order.id}`} className="font-medium">{order.publicRef || order.heading}</Link>
                    <p className="text-sm text-muted">{order.heading} · {order.quantity} · {order.fulfillment}</p>
                    <p className="mt-1">{order.amount}</p>
                    <p className="text-sm text-muted">{order.stage} · {order.when}</p>
                    {order.fileSent ? <p className="mt-1 text-sm text-muted">Next: confirm file access. This does not complete the order.</p> : null}
                    {order.interaction ? (
                      <InteractionLine
                        item={order.interaction}
                        nextPath="/orders"
                        side="buyer"
                        showReview={false}
                        showRef={false}
                        allowConfirm={order.allowConfirm}
                        confirmLabel={order.confirmLabel}
                      />
                    ) : null}
                    {order.interaction ? (
                      <ReviewSeller
                        interactionId={order.interaction.id}
                        kind="order"
                        productTitle={order.reviewTitle}
                        reviewed={order.reviewed}
                        enabled={order.canReview}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </BuyerSection>
        </>
      ) : (
        <>
          {quotes.length > 0 ? (
            <BuyerTools
              query={query}
              onQuery={setQuery}
              placeholder="Twig or date"
              searchLabel="Search quotes"
              filter={filter}
              onFilter={setFilter}
              filters={quoteFilters}
              sort={sort}
              onSort={setSort}
              sorts={quoteSorts}
            />
          ) : null}
          <BuyerSection title="Quotes" center={quotes.length === 0}>
            {quotes.length === 0 ? <p className="text-sm text-muted">No quote record</p> : visibleQuotes.length === 0 ? <p className="text-sm text-muted">No quotes match.</p> : (
              <ul className="space-y-3">
                {visibleQuotes.map((quote) => (
                  <li key={quote.id} className="rounded-2xl border border-line bg-card p-4">
                    <p className="font-medium">{quote.title}</p>
                    <p className="text-sm text-muted">qty {quote.quantity} · {quote.when} · {quote.replied ? "Reply received" : quote.closed ? "Closed" : "Submitted"}</p>
                    <Link href={`/quote/${quote.id}`} className="mt-3 inline-flex text-sm font-medium text-forest">{quote.replied ? "View estimate" : "View request"}</Link>
                  </li>
                ))}
              </ul>
            )}
          </BuyerSection>
        </>
      )}
    </div>
  );
}

function includes(query: string, values: string[]) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return values.join(" ").toLowerCase().includes(needle);
}

function matchOrder(order: BuyerOrderItem, query: string, filter: string) {
  if (!includes(query, [order.publicRef, order.heading, order.stage, order.when, order.amount, order.fulfillment])) return false;
  if (filter === "needs") return order.needsYou;
  if (filter === "active") return order.stage !== "Completed" && order.stage !== "Canceled";
  if (filter === "completed") return order.stage === "Completed";
  if (filter === "canceled") return order.stage === "Canceled";
  return true;
}

function sortOrders(orders: BuyerOrderItem[], sort: string) {
  const copy = [...orders];
  if (sort === "oldest") return copy.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  if (sort === "number") return copy.sort((left, right) => right.publicRef.localeCompare(left.publicRef));
  if (sort === "amount") return copy.sort((left, right) => right.amountCents - left.amountCents || right.createdAt.localeCompare(left.createdAt));
  return copy.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function matchQuote(quote: BuyerQuoteItem, query: string, filter: string) {
  if (!includes(query, [quote.title, quote.when])) return false;
  if (filter === "waiting") return !quote.replied && !quote.closed;
  if (filter === "replied") return quote.replied;
  if (filter === "closed") return quote.closed;
  return true;
}

function sortQuotes(quotes: BuyerQuoteItem[], sort: string) {
  const copy = [...quotes];
  if (sort === "oldest") return copy.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  return copy.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
