import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredAccount } from "@/lib/embedded/transfers";

let accounts: StoredAccount[];
const save = vi.fn();
const resolve = vi.fn();

vi.mock("@/lib/copilot/remember", () => ({ canManage: vi.fn(async (ctx: { userId?: string }) => ctx.userId === "owner") }));
vi.mock("@/lib/payouts/name-enquiry", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/payouts/name-enquiry")>(), resolveAccountName: (...args: unknown[]) => resolve(...args) }));
vi.mock("@/lib/embedded/transfers", async (importOriginal) => {
    const real = await importOriginal<typeof import("@/lib/embedded/transfers")>();
    return {
        ...real,
        getTransfers: vi.fn(async () => (accounts.length ? { id: "c", projectId: "proj", metadata: { kind: "bank_transfer", account: accounts[0], accounts, currency: "NGN", transfers: [], updated_at: "" } } : null)),
        removeAccount: vi.fn(async (_db: unknown, _project: string, id: string) => {
            accounts = accounts.filter((item) => item.id !== id);
            return accounts.length ? { id: "c", projectId: "proj", metadata: { kind: "bank_transfer", account: accounts[0], accounts, currency: "NGN", transfers: [], updated_at: "" } } : null;
        }),
        saveBankAccount: vi.fn(async (_db: unknown, _project: string, account: { bank: string; account_number: string; account_name: string }, opts: { id?: string; main?: boolean }) => {
            save(account, opts);
            const stored = { ...account, id: opts.id ?? `a${accounts.length + 1}` };
            const next = opts.id ? accounts.map((item) => (item.id === opts.id ? stored : item)) : [...accounts, stored];
            accounts = opts.main ? [stored, ...next.filter((item) => item.id !== stored.id)] : next;
            return { id: "c", projectId: "proj", metadata: { kind: "bank_transfer", account: accounts[0], accounts, currency: "NGN", transfers: [], updated_at: "" } };
        }),
    };
});

const { runBankAccountTool } = await import("@/lib/copilot/bank-accounts");
const ctx = (userId = "owner") => ({ admin: {} as never, organization: { id: "org", name: "Mama Put", slug: "mama-put" }, project: { id: "proj", name: "Mama Put", slug: "mama-put" }, userId, business: true });

beforeEach(() => {
    accounts = [];
    save.mockClear();
    resolve.mockReset();
    resolve.mockResolvedValue({ ok: true, name: "BOLA BANJO", bank: "Guaranty Trust Bank" });
});

describe("save_bank_account", () => {
    it("adds an account straight away, with the name the bank has on it", async () => {
        const result = await runBankAccountTool("save_bank_account", { bank: "GTBank", account_number: "012 345 6789" }, ctx()) as { saved: boolean; account: Record<string, unknown> };
        expect(resolve).toHaveBeenCalledWith("GTBank", "0123456789");
        expect(result.saved).toBe(true);
        expect(result.account).toEqual({ bank: "Guaranty Trust Bank", account_number: "0123456789", account_name: "BOLA BANJO", main: true });
    });

    it("says when the owner's spelling of the name isn't the bank's", async () => {
        const result = await runBankAccountTool("save_bank_account", { bank: "GTBank", account_number: "0123456789", account_name: "Bola B" }, ctx()) as { note?: string };
        expect(result.note).toContain("BOLA BANJO");
    });

    it("uses the owner's name when the bank can't be asked, and asks for one when there's none", async () => {
        resolve.mockResolvedValue({ ok: false, reason: "unavailable" });
        expect(await runBankAccountTool("save_bank_account", { bank: "OPay", account_number: "8012345678" }, ctx())).toMatchObject({ error: expect.stringContaining("name on it") });
        const result = await runBankAccountTool("save_bank_account", { bank: "OPay", account_number: "8012345678", account_name: "Bola Banjo" }, ctx()) as { account: Record<string, unknown> };
        expect(result.account).toMatchObject({ bank: "OPay", account_name: "Bola Banjo" });
    });

    it("won't save a number the bank says doesn't exist, or one that isn't 10 digits", async () => {
        resolve.mockResolvedValue({ ok: false, reason: "not_found" });
        expect(await runBankAccountTool("save_bank_account", { bank: "GTBank", account_number: "0123456789" }, ctx())).toMatchObject({ error: expect.stringContaining("no account") });
        expect(await runBankAccountTool("save_bank_account", { bank: "GTBank", account_number: "12345" }, ctx())).toMatchObject({ error: expect.stringContaining("10 digits") });
        expect(save).not.toHaveBeenCalled();
    });

    it("changes an account by its bank or last digits, and makes one main without asking the bank again", async () => {
        accounts = [
            { id: "a1", bank: "Guaranty Trust Bank", account_number: "0123456789", account_name: "BOLA BANJO" },
            { id: "a2", bank: "OPay", account_number: "8012345678", account_name: "BOLA BANJO" },
        ];
        const main = await runBankAccountTool("save_bank_account", { change: "opay", main: true }, ctx()) as { changed: boolean; account: Record<string, unknown> };
        expect(resolve).not.toHaveBeenCalled();
        expect(main).toMatchObject({ changed: true, account: { bank: "OPay", main: true } });

        resolve.mockResolvedValue({ ok: true, name: "BOLA BANJO", bank: "Guaranty Trust Bank" });
        await runBankAccountTool("save_bank_account", { change: "6789", account_number: "0987654321" }, ctx());
        expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ account_number: "0987654321" }), expect.objectContaining({ id: "a1" }));
    });

    it("asks which when the account to change is unclear, and refuses a duplicate", async () => {
        accounts = [
            { id: "a1", bank: "OPay", account_number: "8012345678", account_name: "A" },
            { id: "a2", bank: "OPay", account_number: "8099999999", account_name: "B" },
        ];
        expect(await runBankAccountTool("save_bank_account", { change: "OPay", main: true }, ctx())).toMatchObject({ error: expect.stringContaining("Ask which") });
        resolve.mockResolvedValue({ ok: true, name: "A", bank: "OPay" });
        expect(await runBankAccountTool("save_bank_account", { bank: "OPay", account_number: "8012345678" }, ctx())).toMatchObject({ error: expect.stringContaining("already saved") });
    });

    it("is only for the owner or admins; anyone can list", async () => {
        expect(await runBankAccountTool("save_bank_account", { bank: "GTBank", account_number: "0123456789" }, ctx("helper"))).toMatchObject({ error: expect.stringContaining("owner or admins") });
        accounts = [{ id: "a1", bank: "OPay", account_number: "8012345678", account_name: "A" }];
        expect(await runBankAccountTool("list_bank_accounts", {}, ctx("helper"))).toEqual({ pay_by_transfer: true, accounts: [{ bank: "OPay", account_number: "8012345678", account_name: "A", main: true }] });
    });
});

describe("remove_bank_account", () => {
    beforeEach(() => {
        accounts = [
            { id: "a1", bank: "Guaranty Trust Bank", account_number: "0123456789", account_name: "BOLA BANJO" },
            { id: "a2", bank: "OPay", account_number: "8012345678", account_name: "BOLA BANJO" },
        ];
    });

    it("removes one straight away, the next becoming the one customers are given", async () => {
        const result = await runBankAccountTool("remove_bank_account", { account: "6789" }, ctx());
        expect(result).toMatchObject({ removed: { bank: "Guaranty Trust Bank" }, pay_by_transfer: true, customers_now_given: { bank: "OPay", main: true } });
        expect(accounts.map((item) => item.id)).toEqual(["a2"]);
    });

    it("says transfers stop when the last one goes", async () => {
        await runBankAccountTool("remove_bank_account", { account: "GTBank" }, ctx());
        const result = await runBankAccountTool("remove_bank_account", { account: "opay" }, ctx());
        expect(result).toMatchObject({ pay_by_transfer: false, accounts: [], note: expect.stringContaining("last account") });
    });

    it("removes nothing it can't pin down, and only for the owner or admins", async () => {
        expect(await runBankAccountTool("remove_bank_account", { account: "Kuda" }, ctx())).toMatchObject({ error: expect.stringContaining("No account matches") });
        expect(await runBankAccountTool("remove_bank_account", { account: "OPay" }, ctx("helper"))).toMatchObject({ error: expect.stringContaining("owner or admins") });
        expect(accounts).toHaveLength(2);
    });
});
