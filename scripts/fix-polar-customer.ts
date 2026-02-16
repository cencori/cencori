
import { createClient } from '@supabase/supabase-js';
import { Polar } from '@polar-sh/sdk';

const supabaseUrl = "https://hxkbdauihjhgccfvwyvz.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4a2JkYXVpaGpoZ2NjZnZ3eXZ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDAxNjExMiwiZXhwIjoyMDc1NTkyMTEyfQ.TKRdIo1mL4uuvToG3BtTF0zYIwyt1CRP58Z8En8EsVk";
const polarApiKey = "polar_oat_7QxaQuMQF43NKA7CxI2Ykpf8yVPMvHfddcSRW0PQvAX";

const supabase = createClient(supabaseUrl, supabaseKey);
const polar = new Polar({
    accessToken: polarApiKey,
    server: 'production',
});

async function run() {
    console.log('Listing all organizations...');
    const { data: orgs, error } = await supabase
        .from('organizations')
        .select('*');

    if (error) {
        console.error('Error fetching orgs:', error);
        return;
    }

    console.log(`Found ${orgs.length} organizations.`);

    if (orgs.length === 0) {
        console.log('No organizations found in the database.');
        return;
    }

    // Use the first one found or specifically 'cencori' if it exists
    const targetOrg = orgs.find(o => o.slug === 'cencori') || orgs[0];
    console.log('Processing Organization:', targetOrg.name, `(Slug: ${targetOrg.slug})`, `(ID: ${targetOrg.id})`);
    console.log('Current Polar Customer ID:', targetOrg.polar_customer_id);

    if (!targetOrg.polar_customer_id) {
        console.log('Polar Customer ID is missing. Creating customer in Polar...');

        try {
            // Use the Organization ID from Settings directly
            const polarOrgId = "9ea46094-5c16-4dcf-87f3-42e7d730a845";
            console.log('Using Polar Organization ID:', polarOrgId);

            const customer = await polar.customers.create({
                email: targetOrg.billing_email || `billing+${targetOrg.slug}@cencori.com`,
                name: targetOrg.name,
            });

            console.log('Customer created:', customer.id);

            const { error: updateError } = await supabase
                .from('organizations')
                .update({ polar_customer_id: customer.id })
                .eq('id', targetOrg.id);

            if (updateError) {
                console.error('Failed to update DB:', updateError);
            } else {
                console.log('Database updated with new Polar Customer ID:', customer.id);
            }

        } catch (err) {
            console.error('Failed to create Polar customer:', err);
        }
    } else {
        console.log('Polar Customer ID exists. Verifying portal link generation...');
        try {
            const session = await polar.customerPortal.sessions.create({
                customerId: targetOrg.polar_customer_id
            });
            console.log('Portal Link Generated successfully:', session.url);
        } catch (err) {
            console.error('Failed to generate portal link:', err);
        }
    }
}

run();
