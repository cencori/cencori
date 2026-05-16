const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env.local manually
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('github_app_installations')
    .select('*')
    .eq('installation_id', 132893778)
    .single();
  
  if (error) {
    console.error('Error fetching installation:', error.message);
  } else {
    console.log('Installation found:', JSON.stringify(data, null, 2));
  }
}
check();
