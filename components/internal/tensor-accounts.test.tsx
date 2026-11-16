import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TensorAccounts } from './tensor-accounts';

vi.mock('@/components/ui/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const listing = {
    accounts: [
        {
            user_id: '00000000-0000-0000-0000-000000000001',
            email: 'ada@example.com',
            username: 'ada_l',
            plan: 'starter',
            plan_ends_at: '2026-12-16T00:00:00Z',
            tasks_used: 9,
            tasks_limit: 9,
            week_ends_at: '2026-11-23T00:00:00Z',
        },
        {
            user_id: '00000000-0000-0000-0000-000000000002',
            email: 'idle@example.com',
            username: null,
            plan: 'free',
            plan_ends_at: null,
            tasks_used: 0,
            tasks_limit: 5,
            week_ends_at: null,
        },
    ],
    in_use: { paid: 3, all: 7 },
    plans: [{ code: 'starter', name: 'Starter' }, { code: 'pro', name: 'Pro' }],
    log: [
        {
            id: 1,
            at: '2026-11-16T12:00:00Z',
            admin: 'boss@example.com',
            action: 'reset_week_all',
            email: null,
            detail: { scope: 'paid', accounts: 2, tasks_cleared: 11 },
        },
    ],
};

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

async function mount() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
    await act(async () => {
        root?.render(
            <QueryClientProvider client={client}>
                <TensorAccounts />
            </QueryClientProvider>,
        );
    });
    await settle();
}

/** Lets the pending requests and the renders that follow them finish. */
async function settle() {
    for (let turn = 0; turn < 5; turn += 1) {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
    }
}

function button(name: string): HTMLButtonElement[] {
    return [...document.querySelectorAll('button')].filter(
        (node) => (node.getAttribute('aria-label') ?? node.textContent?.trim()) === name,
    );
}

async function click(node: HTMLElement | undefined) {
    await act(async () => {
        node?.click();
    });
    await settle();
}

function posted(): unknown[] {
    return fetchMock.mock.calls
        .filter(([, init]) => init?.method === 'POST')
        .map(([, init]) => JSON.parse(String(init?.body)));
}

const fetchMock = vi.fn();

describe('TensorAccounts', () => {
    beforeEach(() => {
        fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => ({
            ok: true,
            json: async () => (init?.method === 'POST' ? { accounts: 3, tasks_cleared: 9 } : listing),
        }));
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(async () => {
        await act(async () => root?.unmount());
        root = null;
        document.body.innerHTML = '';
        vi.unstubAllGlobals();
        fetchMock.mockReset();
    });

    it('lists accounts with their week and the recent changes', async () => {
        await mount();
        const text = document.body.textContent ?? '';
        expect(text).toContain('ada@example.com');
        expect(text).toContain('@ada_l');
        expect(text).toContain('9 of 9');
        expect(text).toContain('Reset the week for paid plans: 2 accounts, 11 tasks cleared');
        // Nothing used means nothing to reset.
        expect(button('Reset the week for idle@example.com')[0]?.disabled).toBe(true);
        expect(button('Reset the week for ada@example.com')[0]?.disabled).toBe(false);
    });

    it('resets one account straight away', async () => {
        await mount();
        await click(button('Reset the week for ada@example.com')[0]);
        expect(posted()).toEqual([
            { action: 'reset_week', userId: '00000000-0000-0000-0000-000000000001' },
        ]);
    });

    it('asks before resetting everyone, naming how many accounts it touches', async () => {
        await mount();
        await click(button('Reset the week')[0]);
        expect(document.body.textContent).toContain('3 accounts have used tasks this week');
        expect(posted()).toEqual([]);

        await click(button('Reset the week').at(-1));
        expect(posted()).toEqual([{ action: 'reset_week_all', scope: 'paid' }]);
    });
});
