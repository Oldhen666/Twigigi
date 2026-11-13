const secret = process.env.BILLING_CRON_SECRET || "";
const origin = (process.env.NEXT_PUBLIC_APP_URL || "https://twigigi.com").replace(/\/$/, "");

if (!secret) {
  console.error("BILLING_CRON_SECRET is missing.");
  process.exit(1);
}

fetch(`${origin}/api/billing/collect`, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}` },
})
  .then(async (response) => {
    const body = await response.text();
    console.log(response.status, body.slice(0, 300));
    if (!response.ok) process.exit(1);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Billing cron failed.");
    process.exit(1);
  });
