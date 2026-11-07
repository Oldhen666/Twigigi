"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { inputClass } from "@/components/ui";

export type SellerOrderRow = {
  id: string;
  publicRef: string;
  heading: string;
  buyerName: string;
  amount: string;
  amountCents: number;
  stage: string;
  attention: string;
  when: string;
  createdAt: string;
};

const selectClass = `${inputClass} h-10 text-sm`;

export function SellerOrders({ orders }: { orders: SellerOrderRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("needs");
  const stages = useMemo(() => [...new Set(orders.map((order) => order.stage))].sort((left, right) => left.localeCompare(right)), [orders]);
  const visible = useMemo(() => {
    const matched = orders.filter((order) => matchesFilter(order, filter) && matchesQuery(order, query));
    return sortRows(matched, sort);
  }, [orders, filter, query, sort]);
  const grouped = query.trim() === "" && filter === "all" && sort === "needs";
  const needs = grouped ? visible.filter((order) => order.attention) : [];
  const rest = grouped ? visible.filter((order) => !order.attention) : [];

  return (
    <>
      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem_11rem]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Order number or date"
          aria-label="Search by order number or date"
          className={selectClass}
        />
        <select aria-label="Filter" value={filter} onChange={(event) => setFilter(event.target.value)} className={selectClass}>
          <option value="all">All orders</option>
          <option value="needs">Needs you</option>
          {stages.map((stage) => (
            <option key={stage} value={stage}>
              {stage}
            </option>
          ))}
        </select>
        <select aria-label="Sort" value={sort} onChange={(event) => setSort(event.target.value)} className={selectClass}>
          <option value="needs">Needs you first</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="number">Order number</option>
          <option value="amount">Highest amount</option>
        </select>
      </div>
      {visible.length === 0 ? <p className="mt-8 text-sm text-muted">No orders match.</p> : null}
      {grouped ? (
        <>
          {needs.length > 0 ? (
            <section className="mt-6">
              <h2 className="text-sm font-medium">Needs you</h2>
              <OrderList orders={needs} className="mt-3" />
            </section>
          ) : null}
          {rest.length > 0 ? (
            <section className="mt-6">
              {needs.length > 0 ? <h2 className="text-sm font-medium">All other orders</h2> : null}
              <OrderList orders={rest} className={needs.length > 0 ? "mt-3" : "mt-6"} />
            </section>
          ) : null}
        </>
      ) : visible.length > 0 ? (
        <OrderList orders={visible} className="mt-6" />
      ) : null}
    </>
  );
}

function OrderList({ orders, className }: { orders: SellerOrderRow[]; className: string }) {
  return (
    <ul className={`space-y-3 ${className}`}>
      {orders.map((order) => <OrderRow key={order.id} order={order} />)}
    </ul>
  );
}

function OrderRow({ order }: { order: SellerOrderRow }) {
  return (
    <li>
      <Link href={`/dashboard/orders/${order.id}`} className="block rounded-2xl border border-line bg-card p-4 text-sm">
        <p className="font-medium">{order.publicRef || order.buyerName}</p>
        <p className="text-muted">{order.heading} · {order.buyerName}</p>
        <p className="mt-1">{order.amount} · {order.stage}</p>
        {order.attention ? <p className="mt-1 font-medium text-forest">{order.attention}</p> : null}
        <p className="text-muted">{order.when}</p>
      </Link>
    </li>
  );
}

function matchesFilter(order: SellerOrderRow, filter: string) {
  if (filter === "all") return true;
  if (filter === "needs") return Boolean(order.attention);
  return order.stage === filter;
}

function matchesQuery(order: SellerOrderRow, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const ref = order.publicRef.toLowerCase();
  return ref.includes(needle) || order.when.toLowerCase().includes(needle) || order.createdAt.toLowerCase().includes(needle);
}

function sortRows(orders: SellerOrderRow[], sort: string) {
  const copy = [...orders];
  if (sort === "oldest") return copy.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  if (sort === "number") return copy.sort((left, right) => right.publicRef.localeCompare(left.publicRef));
  if (sort === "amount") return copy.sort((left, right) => right.amountCents - left.amountCents || right.createdAt.localeCompare(left.createdAt));
  return copy.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
