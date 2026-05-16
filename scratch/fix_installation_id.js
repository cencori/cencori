const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const appId = envConfig.NEXT_PUBLIC_GITHUB_APP_ID;
  console.log('Updating installation 132893778 with app_id:', appId);
  
  const { data, error } = await supabase
    .from('github_app_installations')
    .update({ github_app_id: appId })
    .eq('installation_id', 132893778)
    .select();
  
  if (error) {
    console.error('Error updating:', error.message);
  } else {
    console.log('Update successful:', JSON.stringify(data, null, 2));
  }
}
run();
