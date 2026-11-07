import { buttonClass } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { methodLabel, paypalMeUrl, safeCardUrl, safeEmail, venmoPayUrl } from "@/lib/payments";

export function PayMethods({
  methods,
  cardPaymentUrl,
  interacEmail = "",
  interacQuestion = "",
  interacPassword = "",
  venmoUsername = "",
  paypalMe = "",
  amountCents = 0,
  currency = "CAD",
  orderNote = "",
  showContacts = false,
  note = "",
  empty = "",
}: {
  methods: string[];
  cardPaymentUrl: string;
  interacEmail?: string;
  interacQuestion?: string;
  interacPassword?: string;
  venmoUsername?: string;
  paypalMe?: string;
  amountCents?: number;
  currency?: string;
  orderNote?: string;
  showContacts?: boolean;
  note?: string;
  empty?: string;
}) {
  const labels = methods.map((id) => methodLabel(id)).filter(Boolean);
  const href = showContacts && methods.includes("card") && methodLabel("card") ? safeCardUrl(cardPaymentUrl) : "";
  const email = showContacts && methods.includes("interac") ? safeEmail(interacEmail) : "";
  const venmo = showContacts && methods.includes("venmo") ? venmoPayUrl(venmoUsername, { amountCents, note: orderNote }) : "";
  const paypal = showContacts && methods.includes("paypal") ? paypalMeUrl(paypalMe, { amountCents, currency }) : "";
  if (labels.length === 0 && !href && !email && !venmo && !paypal) {
    return empty ? <p className="mt-4 text-sm text-danger">{empty}</p> : null;
  }
  return (
    <div className="mt-4">
      {labels.length > 0 ? (
        <>
          <p className="text-sm font-medium">Payment method</p>

          <ul className="mt-2 flex flex-wrap gap-2">
            {labels.map((label) => (
              <li key={label} className="rounded-full bg-moss px-3 py-1 text-sm text-forest">
                {label}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {note ? <p className="mt-3 text-sm text-muted">{note}</p> : null}
      {email || interacQuestion || interacPassword ? (
        <div className="mt-3 rounded-2xl bg-paper-deep px-4 py-3 text-sm">
          <p className="font-medium">e-Transfer instructions</p>
          {email ? (
            <p className="mt-2">
              Send it to:{" "}
              <a className="text-forest" href={`mailto:${email}`}>
                {email}
              </a>
            </p>
          ) : null}
          {interacQuestion ? <p className="mt-1">Security question: {interacQuestion}</p> : null}
          {interacPassword ? <p className="mt-1">Password: {interacPassword}</p> : null}
        </div>
      ) : null}
      {venmo ? (
        <a href={venmo} target="_blank" rel="noreferrer" className={`${buttonClass} mt-3 w-full`}>
          Pay {formatMoney(amountCents, currency)} with Venmo
        </a>
      ) : null}
      {paypal ? (
        <a href={paypal} target="_blank" rel="noreferrer" className={`${buttonClass} mt-3 w-full`}>
          Pay {formatMoney(amountCents, currency)} with PayPal
        </a>
      ) : null}
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className={`${buttonClass} mt-3 w-full`}>
          Pay by Card
        </a>
      ) : null}
    </div>
  );
}
