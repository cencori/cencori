import "server-only";

/**
 * Who owns an account (name enquiry), as banking apps show before a transfer:
 * the bank and the 10-digit account number in, the account holder's name out.
 * Through Paystack's resolve API with Cencori's own key; it covers commercial
 * banks and OPay, PalmPay, Moniepoint, Kuda. Used when an owner adds the
 * account their customers transfer to, so a typo can't send money elsewhere.
 */

import LOGOS from "@/lib/payouts/bank-logos.json";

const PAYSTACK = "https://api.paystack.co";
/** Banks with a logo in public/banks/<slug>.png (from ichtrojan/nigerian-banks, MIT), by Paystack's slug. */
const HAS_LOGO = new Set<string>(LOGOS);
const logoOf = (slug: string | undefined) => (slug && HAS_LOGO.has(slug) ? `/banks/${slug}.png` : null);
const BANKS_TTL_MS = 24 * 3_600_000;

type Bank = { name: string; code: string; slug: string };
let banks: { list: Bank[]; at: number } | null = null;

async function paystack<T>(path: string): Promise<{ ok: boolean; status: number; body: T | null }> {
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) return { ok: false, status: 503, body: null };
    const response = await fetch(`${PAYSTACK}${path}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) });
    return { ok: response.ok, status: response.status, body: await response.json().catch(() => null) as T | null };
}

async function bankList(): Promise<Bank[]> {
    if (banks && Date.now() - banks.at < BANKS_TTL_MS) return banks.list;
    const { ok, body } = await paystack<{ data?: Bank[] }>("/bank?country=nigeria&perPage=500");
    if (!ok || !body?.data?.length) return banks?.list ?? [];
    banks = { list: body.data, at: Date.now() };
    return banks.list;
}

/** What owners type, as Paystack names the bank. */
const ALIASES: Record<string, string> = {
    gtbank: "guaranty trust", gtb: "guaranty trust", uba: "united bank for africa", "first bank": "first bank of nigeria", firstbank: "first bank of nigeria",
    access: "access bank", zenith: "zenith bank", fidelity: "fidelity bank", union: "union bank", sterling: "sterling bank", wema: "wema bank",
    fcmb: "first city monument", stanbic: "stanbic ibtc", ecobank: "ecobank", polaris: "polaris", keystone: "keystone", opay: "opay", palmpay: "palmpay",
    moniepoint: "moniepoint", kuda: "kuda", alat: "wema bank",
};

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Every bank and app the network knows, for the bank field's suggestions:
 * names, what people call them (GTB, UBA), and whether it's one most people
 * use (those go first among equal matches). One entry per name.
 */
export async function bankNames(): Promise<Array<{ name: string; also: string[]; popular: boolean; logo: string | null }>> {
    const list = await bankList();
    const nicknames = new Map<string, string[]>();
    for (const [nickname, target] of Object.entries(ALIASES)) {
        const bank = list.find((item) => norm(item.name) === target) ?? list.find((item) => norm(item.name).startsWith(target)) ?? list.find((item) => norm(item.name).includes(target));
        if (bank) nicknames.set(bank.code, [...(nicknames.get(bank.code) ?? []), nickname]);
    }
    const seen = new Set<string>();
    return list.filter((bank) => (seen.has(bank.name) ? false : (seen.add(bank.name), true)))
        .map((bank) => ({ name: bank.name, also: nicknames.get(bank.code) ?? [], popular: nicknames.has(bank.code), logo: logoOf(bank.slug) }));
}

export async function findBank(name: string): Promise<Bank | null> {
    const wanted = norm(name);
    if (!wanted) return null;
    const target = ALIASES[wanted] ?? wanted;
    const list = await bankList();
    return list.find((bank) => norm(bank.name) === target)
        ?? list.find((bank) => norm(bank.name).startsWith(target))
        ?? list.find((bank) => norm(bank.name).includes(target))
        ?? null;
}

/** A bank's logo by the name the owner saved (null: none, show initials). */
export async function bankLogo(name: string): Promise<string | null> {
    try {
        return logoOf((await findBank(name))?.slug);
    } catch {
        return null;
    }
}

export type NameEnquiry = { ok: true; name: string; bank: string } | { ok: false; reason: "unknown_bank" | "not_found" | "unavailable" };

export async function resolveAccountName(bankName: string, accountNumber: string): Promise<NameEnquiry> {
    if (!/^\d{10}$/.test(accountNumber)) return { ok: false, reason: "not_found" };
    try {
        const bank = await findBank(bankName);
        if (!bank) return { ok: false, reason: "unknown_bank" };
        const { ok, status, body } = await paystack<{ data?: { account_name?: string } }>(`/bank/resolve?account_number=${accountNumber}&bank_code=${encodeURIComponent(bank.code)}`);
        const name = body?.data?.account_name?.trim();
        if (ok && name) return { ok: true, name, bank: bank.name };
        return { ok: false, reason: status === 422 || status === 400 || status === 404 ? "not_found" : "unavailable" };
    } catch {
        return { ok: false, reason: "unavailable" };
    }
}
