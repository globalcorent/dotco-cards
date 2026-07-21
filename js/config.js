const DOTCO_CONFIG = {
  supabaseUrl: "https://bmgmdgkviqqtaluvdprh.supabase.co",
  supabaseKey: "sb_publishable_XSWI7oDekRIZ7L-FUegV9g_Q1iOEkMG",
  siteUrl: window.location.origin
};
const supabaseClient = window.supabase.createClient(DOTCO_CONFIG.supabaseUrl, DOTCO_CONFIG.supabaseKey);
