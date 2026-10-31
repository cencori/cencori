import type { ChatCompletionFunctionTool } from "openai/resources/chat/completions";
import { accountsOf, cleanBankAccount, getTransfers, removeAccount, saveBankAccount, type StoredAccount } from "@/lib/embedded/transfers";
import { bankMatches, resolveAccountName } from "@/lib/payouts/name-enquiry";
import { canManage } from "@/lib/copilot/remember";
import type { CopilotToolContext } from "@/lib/copilot/tools";

/**
 * The accounts customers pay into by transfer (Studio, business accounts),
 * kept by the owner's employee in chat: "add my GTBank account, 0123456789",
 * "make OPay the main one", "the Moniepoint number is wrong, it's …", "remove
 * the OPay one". Saved
 * straight away (no card), like remember: the reply says what was saved. The
 * same accounts and code as Money's Transfers screen (lib/embedded/transfers.ts).
 * The name on the account comes from the bank (Paystack's name enquiry), so a
 * customer is never told a name the owner only typed; when the bank can't be
 * asked, the owner's own spelling of the name is used.
 */

export const BANK_ACCOUNT_TOOLS: ChatCompletionFunctionTool[] = [
    {
        type: "function",
        function: {
            name: "list_bank_accounts",
            description: "The accounts customers pay into by bank transfer: bank or app, number, the name on it, and which is the main one (the one customers are given). Look here before changing one.",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "save_bank_account",
            description: "Add an account customers pay into by bank transfer, or change one (\"add my GTBank account 0123456789\", \"the OPay number is wrong, it's …\", \"make Moniepoint the main one\"). Saved straight away, no confirmation: then say plainly what you saved (bank, number, the name on it, and whether it's the main one). The name on the account is looked up from the bank; you only need account_name when the owner gives one. The first account, or one saved as main, is the one customers are given. Saving one turns pay-by-transfer on.",
            parameters: {
                type: "object",
                properties: {
                    bank: { type: "string", description: "The bank or app: \"GTBank\", \"Access\", \"OPay\", \"PalmPay\", \"Moniepoint\". When changing an account, leave out to keep it." },
                    account_number: { type: "string", description: "The 10-digit account number. When changing an account, leave out to keep it." },
                    account_name: { type: "string", description: "The name on the account, only if the owner said it. Otherwise it's looked up." },
                    change: { type: "string", description: "To change an existing account instead of adding one: which, by its bank or number (\"OPay\", \"0123456789\", \"6789\"). Leave out to add a new one." },
                    main: { type: "boolean", description: "Make it the main account, the one customers are given." },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "remove_bank_account",
            description: "Remove an account customers pay into (\"remove the OPay account\", \"delete 6789\"). Done straight away, no confirmation: then say what was removed and which account customers are given now. Removing the main one makes the next the main one; removing the last one stops pay-by-transfer (what already came in stays in Money).",
            parameters: {
                type: "object",
                properties: {
                    account: { type: "string", description: "Which account, by its bank or number (\"OPay\", \"0123456789\", \"6789\")." },
                },
                required: ["account"],
            },
        },
    },
];

export const BANK_ACCOUNT_TOOL_NAMES = new Set(BANK_ACCOUNT_TOOLS.map((tool) => tool.function.name));

export const BANK_ACCOUNT_TOOL_STATUS: Record<string, string> = {
    list_bank_accounts: "Checking your accounts",
    save_bank_account: "Saving the account",
    remove_bank_account: "Removing the account",
};

const text = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");
const digits = (value: unknown) => text(value).replace(/\D/g, "");

const accountOut = (account: StoredAccount, index: number) => ({
    bank: account.bank,
    account_number: account.account_number,
    account_name: account.account_name,
    main: index === 0,
});

/** The account the owner means, by bank or number (or its last digits); several matching is a question back. */
function findAccount(accounts: StoredAccount[], which: string): StoredAccount | { error: string } {
    const number = which.replace(/\D/g, "");
    const matches = number.length >= 4
        ? accounts.filter((account) => account.account_number.endsWith(number))
        : accounts.filter((account) => bankMatches(account.bank, which));
    if (matches.length === 1) return matches[0];
    const list = accounts.map((account) => `${account.bank} ${account.account_number}`).join(", ") || "none yet";
    return { error: matches.length ? `More than one account matches "${which}": ${list}. Ask which.` : `No account matches "${which}". The accounts: ${list}.` };
}

export async function runBankAccountTool(name: string, args: Record<string, unknown>, ctx: CopilotToolContext): Promise<unknown> {
    const project = ctx.project;
    if (!project) return { error: "No business is selected." };
    const accounts = accountsOf((await getTransfers(ctx.admin, project.id))?.metadata);

    if (name === "list_bank_accounts") {
        return { pay_by_transfer: accounts.length > 0, accounts: accounts.map(accountOut) };
    }

    if (!await canManage(ctx)) return { error: "Only the business's owner or admins can change the accounts customers pay into." };

    if (name === "remove_bank_account") {
        const which = text(args.account);
        if (!which) return { error: "Ask which account to remove." };
        const gone = findAccount(accounts, which);
        if ("error" in gone) return gone;
        const left = accountsOf((await removeAccount(ctx.admin, project.id, gone.id))?.metadata);
        return {
            removed: { bank: gone.bank, account_number: gone.account_number, account_name: gone.account_name },
            pay_by_transfer: left.length > 0,
            ...(left.length ? { customers_now_given: accountOut(left[0], 0) } : { note: "That was the last account: customers can't pay by transfer until one is added." }),
            accounts: left.map(accountOut),
        };
    }

    const which = text(args.change);
    const existing = which ? findAccount(accounts, which) : null;
    if (existing && "error" in existing) return existing;

    const bank = text(args.bank) || existing?.bank || "";
    const number = digits(args.account_number) || existing?.account_number || "";
    if (!bank) return { error: "Ask which bank or app the account is with." };
    if (number.length !== 10) return { error: "Account numbers are 10 digits. Ask the owner for the full number." };
    if (!existing && accounts.some((account) => account.account_number === number && bankMatches(account.bank, bank))) {
        return { error: `${bank} ${number} is already saved. To change it, use change.` };
    }

    // The name customers see: the bank's record when it answers, else what the owner said (or what was saved, if the account didn't change).
    const sameAccount = !!existing && existing.bank === bank && existing.account_number === number;
    const lookup = sameAccount && !text(args.account_name) ? null : await resolveAccountName(bank, number);
    if (lookup && !lookup.ok && lookup.reason === "not_found") return { error: `The bank has no account ${number} at ${bank}. Check the number and bank with the owner.` };
    const accountName = lookup?.ok ? lookup.name : text(args.account_name) || (sameAccount ? existing!.account_name : "");
    if (!accountName) return { error: "The bank couldn't be asked for the name on the account just now. Ask the owner for the name on it." };

    const cleaned = cleanBankAccount({ bank: lookup?.ok ? lookup.bank : bank, account_number: number, account_name: accountName });
    if (!cleaned.ok) return { error: cleaned.message };
    const saved = await saveBankAccount(ctx.admin, project.id, cleaned.account, { id: existing?.id, main: args.main === true });
    if (!saved) return { error: "Couldn't save the account just now." };
    if ("error" in saved) return { error: saved.error };

    const after = accountsOf(saved.metadata);
    const index = after.findIndex((account) => account.account_number === number && account.bank === cleaned.account.bank);
    return {
        saved: true,
        changed: !!existing,
        account: accountOut(after[Math.max(index, 0)], Math.max(index, 0)),
        name_from_bank: !!lookup?.ok,
        ...(lookup?.ok && text(args.account_name) && text(args.account_name).toLowerCase() !== lookup.name.toLowerCase()
            ? { note: `The bank has the name as "${lookup.name}", not "${text(args.account_name)}": that's what customers see.` }
            : {}),
        accounts: after.map(accountOut),
    };
}
