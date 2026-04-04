/**
 * Fetch plans from Supabase and save to data/plans.json
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbXd6dmtxam5vaWpkbGR6cm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMTAzMjAsImV4cCI6MjA4OTY4NjMyMH0.cQcRRHaaMiht2Tq9CB9l4_XN8-SOjixxhHFJDjytze4';

async function fetchPlans() {
  console.log('Fetching plans from Supabase...');
  
  const response = await fetch(
    'https://xlmwzvkqjnoijdldzrol.supabase.co/rest/v1/plans?select=*&status=eq.online&order=created_at.asc',
    {
      headers: {
        'apikey': supabaseKey,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const plans = await response.json();
  console.log(`Fetched ${plans.length} plans`);
  
  const dataDir = join(__dirname, 'data');
  mkdirSync(dataDir, { recursive: true });
  
  const filePath = join(dataDir, 'plans.json');
  writeFileSync(filePath, JSON.stringify(plans, null, 2), 'utf8');
  console.log(`Saved to ${filePath}`);
}

fetchPlans().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
