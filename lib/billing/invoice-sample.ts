/** Sample invoice for the dev preview at /dev/invoice. Not a real customer. */

import { composeBachsInvoice, type InvoiceOrg } from './bachs-invoices';

const org: InvoiceOrg = {
    id: 'sample-org',
    slug: 'acme-labs',
    name: 'Acme Labs Ltd',
    billing_email: 'finance@acmelabs.example',
    billing_address_line1: '12 Admiralty Way',
    billing_address_line2: null,
    billing_city: 'Lekki',
    billing_state: 'Lagos',
    billing_zip: '106104',
    billing_country: 'NG',
    billing_tax_id: null,
};

export const sampleInvoice = composeBachsInvoice(
    org,
    {
        chargeId: 'ch_ca4f04ff81a140df982589496592cfe1',
        createdAt: '2026-10-06T13:23:08Z',
        grossUsd: 50,
        netCreditsUsd: 47.25,
        chargedUsd: 52.9,
    },
    null,
);
