
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrg() {
    const { data, error } = await supabase
        .from('organizations')
        .select('slug, polar_customer_id, email') // fetching email too just in case
        .eq('slug', 'cencori')
        .single();

    if (error) {
        console.error('Error fetching org:', error);
    } else {
        console.log('Organization Data:', data);
    }
}

checkOrg();
