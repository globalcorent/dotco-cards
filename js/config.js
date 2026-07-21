const DOTCO_CONFIG = {
  supabaseUrl: "https://bmgmdgkviqqtaluvdprh.supabase.co",
  supabaseKey: "sb_publishable_XSWI7oDekRIZ7L-FUegV9g_Q1iOEkMG"
};

const DOTCO_BASE_URL = new URL("./", window.location.href);
const dotcoUrl = (path = "") => new URL(path, DOTCO_BASE_URL).href;

const supabaseClient = window.supabase.createClient(
  DOTCO_CONFIG.supabaseUrl,
  DOTCO_CONFIG.supabaseKey
);
