const { execSync } = require('child_process');
try {
  const result = execSync('npx supabase db psql -c "NOTIFY pgrst, \'reload schema\';"');
  console.log(result.toString());
} catch(e) {
  console.log(e.message);
  if (e.stdout) console.log(e.stdout.toString());
}
