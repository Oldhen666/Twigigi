import { buttonClass } from "@/components/ui";
import { methodLabel, safeCardUrl, safeEmail, safePhone, safeVenmo } from "@/lib/payments";

export function PayMethods({
  methods,
  cardPaymentUrl,
  interacEmail = "",
  venmoUsername = "",
  zelleMode = "phone",
  zelleContact = "",
  showContacts = false,
  note = "",
  empty = "",
}: {
  methods: string[];
  cardPaymentUrl: string;
  interacEmail?: string;
  venmoUsername?: string;
  zelleMode?: "phone" | "email";
  zelleContact?: string;
  showContacts?: boolean;
  note?: string;
  empty?: string;
}) {
  const labels = methods.map((id) => methodLabel(id)).filter(Boolean);
  const href = showContacts && methods.includes("card") && methodLabel("card") ? safeCardUrl(cardPaymentUrl) : "";
  const email = showContacts && methods.includes("interac") ? safeEmail(interacEmail) : "";
  const venmo = showContacts && methods.includes("venmo") ? safeVenmo(venmoUsername) : "";
  const zelle = showContacts && methods.includes("zelle") ? (zelleMode === "email" ? safeEmail(zelleContact) : safePhone(zelleContact)) : "";
  if (labels.length === 0 && !href && !email && !venmo && !zelle) {
    return empty ? <p className="mt-4 text-sm text-danger">{empty}</p> : null;
  }
  return (
    <div className="mt-4">
      {labels.length > 0 ? (
        <>
          <p className="text-sm font-medium">Pay the seller</p>
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
      {email ? (
        <p className="mt-3 text-sm">
          Interac e-Transfer:{" "}
          <a className="text-forest" href={`mailto:${email}`}>
            {email}
          </a>
        </p>
      ) : null}
      {venmo ? <p className="mt-3 text-sm">Venmo: @{venmo}</p> : null}
      {zelle ? (
        <p className="mt-3 text-sm">
          Zelle:{" "}
          {zelleMode === "email" ? (
            <a className="text-forest" href={`mailto:${zelle}`}>
              {zelle}
            </a>
          ) : (
            <a className="text-forest" href={`tel:${zelle.replace(/\D/g, "")}`}>
              {zelle}
            </a>
          )}
        </p>
      ) : null}
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className={`${buttonClass} mt-3 w-full`}>
          Pay by Card
        </a>
      ) : null}
    </div>
  );
}
