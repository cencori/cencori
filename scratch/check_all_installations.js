const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('github_app_installations')
    .select('*')
    .eq('installed_by_user_id', '8a0df360-1772-40d8-8509-80368dcbb464');
  
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Installations found:', data.length);
    console.log(JSON.stringify(data, null, 2));
  }
}
check();
