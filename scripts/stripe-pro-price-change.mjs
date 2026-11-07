// Pro: $29/$290 → $20/$200 (2026-11-07). Two steps, dry run by default.
//
//   node --env-file=.env.local scripts/stripe-pro-price-change.mjs create-prices [--apply]
//     Creates $20/month and $200/year prices on the product the current Pro
//     prices belong to, and prints the env vars to set on Brimble:
//       STRIPE_PRICE_PRO_MONTHLY / STRIPE_PRICE_PRO_ANNUAL         → new prices
//       STRIPE_PRICE_PRO_MONTHLY_LEGACY / ..._ANNUAL_LEGACY       → old prices
//
//   node --env-file=.env.local scripts/stripe-pro-price-change.mjs move-subscribers [--apply]
//     Moves every live subscription on an old Pro price to the new one with
//     proration_behavior "none": nothing is charged or credited now, and the
//     next renewal bills $20 (or $200). Needs the four env vars above.
//
// Reads STRIPE_SECRET_KEY from the environment; prints no secrets.
import Stripe from "stripe";

const [command] = process.argv.slice(2);
const apply = process.argv.includes("--apply");
const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
    console.error("STRIPE_SECRET_KEY is not set (run with --env-file=<file>)");
    process.exit(1);
}
const stripe = new Stripe(key);

const NEW = { month: 2_000, year: 20_000 }; // cents
const env = (name) => process.env[name] || null;

async function createPrices() {
    const currentMonthly = env("STRIPE_PRICE_PRO_MONTHLY");
    if (!currentMonthly) throw new Error("STRIPE_PRICE_PRO_MONTHLY is not set");
    const current = await stripe.prices.retrieve(currentMonthly);
    const product = typeof current.product === "string" ? current.product : current.product.id;
    console.log(`Pro product: ${product}; current monthly price ${current.id} = ${current.unit_amount} ${current.currency}`);
    if (current.unit_amount === NEW.month) {
        console.log("STRIPE_PRICE_PRO_MONTHLY is already $20; nothing to create.");
        return;
    }
    if (!apply) {
        console.log(`[dry run] would create ${NEW.month} ${current.currency}/month and ${NEW.year} ${current.currency}/year on ${product}. Re-run with --apply.`);
        return;
    }
    const month = await stripe.prices.create({
        product, currency: current.currency, unit_amount: NEW.month,
        recurring: { interval: "month" }, nickname: "Pro monthly ($20)",
        metadata: { tier: "pro", interval: "month" },
    });
    const year = await stripe.prices.create({
        product, currency: current.currency, unit_amount: NEW.year,
        recurring: { interval: "year" }, nickname: "Pro annual ($200)",
        metadata: { tier: "pro", interval: "year" },
    });
    console.log("\nSet these on Brimble (cencori project), then deploy:");
    console.log(`STRIPE_PRICE_PRO_MONTHLY=${month.id}`);
    console.log(`STRIPE_PRICE_PRO_ANNUAL=${year.id}`);
    console.log(`STRIPE_PRICE_PRO_MONTHLY_LEGACY=${currentMonthly}`);
    console.log(`STRIPE_PRICE_PRO_ANNUAL_LEGACY=${env("STRIPE_PRICE_PRO_ANNUAL") ?? "<old annual price id>"}`);
}

async function moveSubscribers() {
    const pairs = [
        { from: env("STRIPE_PRICE_PRO_MONTHLY_LEGACY"), to: env("STRIPE_PRICE_PRO_MONTHLY"), label: "monthly" },
        { from: env("STRIPE_PRICE_PRO_ANNUAL_LEGACY"), to: env("STRIPE_PRICE_PRO_ANNUAL"), label: "annual" },
    ];
    for (const pair of pairs) {
        if (!pair.from || !pair.to || pair.from === pair.to) {
            throw new Error(`Set STRIPE_PRICE_PRO_${pair.label === "monthly" ? "MONTHLY" : "ANNUAL"}(_LEGACY) to different price ids first`);
        }
    }

    let moved = 0;
    for (const pair of pairs) {
        for await (const sub of stripe.subscriptions.list({ price: pair.from, status: "all", limit: 100 })) {
            if (!["active", "trialing", "past_due"].includes(sub.status)) continue;
            const item = sub.items.data.find((i) => i.price.id === pair.from);
            if (!item) continue;
            console.log(`${apply ? "moving" : "[dry run] would move"} ${sub.id} (${pair.label}, ${sub.status}, renews ${new Date(sub.items.data[0].current_period_end * 1000).toISOString().slice(0, 10)})`);
            if (apply) {
                await stripe.subscriptions.update(
                    sub.id,
                    { items: [{ id: item.id, price: pair.to }], proration_behavior: "none" },
                    { idempotencyKey: `cencori-pro-20-${sub.id}` },
                );
            }
            moved += 1;
        }
    }
    console.log(`\n${moved} subscription(s) ${apply ? "moved" : "to move"}.${apply ? "" : " Re-run with --apply."}`);
}

if (command === "create-prices") await createPrices();
else if (command === "move-subscribers") await moveSubscribers();
else {
    console.error("Usage: scripts/stripe-pro-price-change.mjs <create-prices|move-subscribers> [--apply]");
    process.exit(1);
}
