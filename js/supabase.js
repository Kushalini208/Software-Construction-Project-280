
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
// Add this to the bottom of js/supabase.js
export function getPublicUrl(filePath) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    return data.publicUrl;
}
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;   
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;     

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

export const BUCKET = 'notes';
