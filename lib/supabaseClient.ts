import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

console.log('🚀 Supabase URL:', supabaseUrl);
console.log('🔑 Supabase ANON key (first 10 chars):', supabaseAnonKey.slice(0, 10));

const supabase = createClient(supabaseUrl, supabaseAnonKey);

;(async () => {
  const { data, error } = await supabase.storage.listBuckets();
  console.log('📦 Buckets:', data, 'Error:', error);
})();

export { supabase };
