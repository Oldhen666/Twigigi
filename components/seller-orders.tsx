"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { bulkSellerOrders } from "@/lib/actions";
import { buttonClass, inputClass } from "@/components/ui";
import type { SellerBulkAction } from "@/lib/order-flow";

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
  actions: SellerBulkAction[];
};

const BULK_LABELS: Record<SellerBulkAction, string> = {
  "confirm-payment": "Confirm payment",
  accept: "Accept order",
  ready: "Mark ready for pickup",
};

const selectClass = `${inputClass} h-10 text-sm`;

export function SellerOrders({ orders }: { orders: SellerOrderRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("needs");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [action, setAction] = useState("");
  const visible = useMemo(() => {
    const matched = orders.filter((order) => matchesFilter(order, filter) && matchesQuery(order, query));
    return sortRows(matched, sort);
  }, [orders, filter, query, sort]);
  const grouped = query.trim() === "" && filter === "all" && sort === "needs";
  const needs = grouped ? visible.filter((order) => order.attention) : [];
  const rest = grouped ? visible.filter((order) => !order.attention) : [];
  const visibleIds = visible.map((order) => order.id);
  const selectedCount = visibleIds.filter((id) => selected.has(id)).length;
  const allVisible = visibleIds.length > 0 && selectedCount === visibleIds.length;
  const available = useMemo(() => {
    const actions = new Set<SellerBulkAction>();
    for (const order of visible) {
      if (!selected.has(order.id)) continue;
      for (const item of order.actions) actions.add(item);
    }
    return actions;
  }, [visible, selected]);
  useEffect(() => {
    if (action && !available.has(action as SellerBulkAction)) setAction("");
  }, [action, available]);

  function toggleOrder(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_16rem_12rem]">
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
          <option value="waiting">Waiting on buyer</option>
          <option value="completed">Completed</option>
          <option value="canceled">Canceled</option>
        </select>
        <select aria-label="Sort" value={sort} onChange={(event) => setSort(event.target.value)} className={selectClass}>
          <option value="needs">Needs you first</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="number">Order number</option>
          <option value="amount">Highest amount</option>
        </select>
      </div>
      {visible.length > 0 ? (
        <BulkBar
          visibleIds={visibleIds}
          allVisible={allVisible}
          selectedCount={selectedCount}
          selected={selected}
          action={action}
          available={available}
          onToggleVisible={() => {
            setSelected((current) => {
              const next = new Set(current);
              if (allVisible) {
                for (const id of visibleIds) next.delete(id);
              } else {
                for (const id of visibleIds) next.add(id);
              }
              return next;
            });
          }}
          onAction={setAction}
        />
      ) : null}
      {visible.length === 0 ? <p className="mt-8 text-sm text-muted">No orders match.</p> : null}
      {grouped ? (
        <>
          {needs.length > 0 ? (
            <section className="mt-6">
              <h2 className="text-sm font-medium">Needs you</h2>
              <OrderList orders={needs} className="mt-3" selected={selected} onToggle={toggleOrder} />
            </section>
          ) : null}
          {rest.length > 0 ? (
            <section className="mt-6">
              {needs.length > 0 ? <h2 className="text-sm font-medium">All other orders</h2> : null}
              <OrderList orders={rest} className={needs.length > 0 ? "mt-3" : "mt-6"} selected={selected} onToggle={toggleOrder} />
            </section>
          ) : null}
        </>
      ) : visible.length > 0 ? (
        <OrderList orders={visible} className="mt-6" selected={selected} onToggle={toggleOrder} />
      ) : null}
    </>
  );
}

function BulkBar({
  visibleIds,
  allVisible,
  selectedCount,
  selected,
  action,
  available,
  onToggleVisible,
  onAction,
}: {
  visibleIds: string[];
  allVisible: boolean;
  selectedCount: number;
  selected: Set<string>;
  action: string;
  available: Set<SellerBulkAction>;
  onToggleVisible: () => void;
  onAction: (value: string) => void;
}) {
  const allRef = useRef<HTMLInputElement>(null);
  const chosen = visibleIds.filter((id) => selected.has(id));
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = selectedCount > 0 && !allVisible;
  }, [allVisible, selectedCount]);
  return (
    <div className="mt-4 rounded-2xl border border-line bg-card px-4 py-3">
      <h2 className="text-sm font-medium">Bulk action</h2>
      <label className="mt-3 flex items-center gap-3 text-sm">
        <input
          ref={allRef}
          type="checkbox"
          checked={allVisible}
          onChange={onToggleVisible}
          aria-label="Select visible orders"
          className="h-5 w-5 shrink-0 accent-forest"
        />
        <span>{selectedCount === 1 ? "1 selected" : `${selectedCount} selected`}</span>
      </label>
      <form action={bulkSellerOrders} className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,16rem)_auto] sm:items-center">
        {chosen.map((id) => <input key={id} type="hidden" name="id" value={id} />)}
        <select aria-label="Bulk action" name="action" value={action} onChange={(event) => onAction(event.target.value)} className={selectClass} disabled={selectedCount === 0}>
          <option value="">{selectedCount === 0 ? "Select orders first" : available.size === 0 ? "No bulk action for this selection" : "Select all"}</option>
          {([...available] as SellerBulkAction[]).map((item) => (
            <option key={item} value={item}>{BULK_LABELS[item]}</option>
          ))}
        </select>
        <ApplyButton disabled={selectedCount === 0 || !action} />
      </form>
    </div>
  );
}

function ApplyButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={disabled || pending} className={`${buttonClass} h-10 w-full px-4 text-sm sm:w-fit`}>
      {pending ? "Updating…" : "Apply"}
    </button>
  );
}

function OrderList({
  orders,
  className,
  selected,
  onToggle,
}: {
  orders: SellerOrderRow[];
  className: string;
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <ul className={`space-y-3 ${className}`}>
      {orders.map((order) => <OrderRow key={order.id} order={order} checked={selected.has(order.id)} onToggle={onToggle} />)}
    </ul>
  );
}

function OrderRow({ order, checked, onToggle }: { order: SellerOrderRow; checked: boolean; onToggle: (id: string) => void }) {
  const label = order.publicRef || order.buyerName;
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-line bg-card p-4 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(order.id)}
        aria-label={`Select ${label}`}
        className="mt-0.5 h-5 w-5 shrink-0 accent-forest"
      />
      <Link href={`/dashboard/orders/${order.id}`} className="min-w-0 flex-1">
        <p className="font-medium">{label}</p>
        <p className="break-words text-muted">{order.heading} · {order.buyerName}</p>
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
  if (filter === "waiting") return !order.attention && order.stage !== "Completed" && order.stage !== "Canceled";
  if (filter === "completed") return order.stage === "Completed";
  if (filter === "canceled") return order.stage === "Canceled";
  return true;
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
