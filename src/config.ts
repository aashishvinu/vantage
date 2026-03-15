const env = import.meta.env;

export const appConfig = {
  supabaseUrl: env.VITE_SUPABASE_URL?.trim() || "",
  supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY?.trim() || "",
  googleMapsApiKey: env.VITE_GOOGLE_MAPS_API_KEY?.trim() || "",
  radarPublishableKey: env.VITE_RADAR_PUBLISHABLE_KEY?.trim() || "",
};

export const configStatus = {
  hasSupabase: Boolean(appConfig.supabaseUrl && appConfig.supabaseAnonKey),
  hasGoogleMaps: Boolean(appConfig.googleMapsApiKey),
  hasRadar: Boolean(appConfig.radarPublishableKey),
};

export const missingRequiredEnvVars = [
  !appConfig.supabaseUrl ? "VITE_SUPABASE_URL" : null,
  !appConfig.supabaseAnonKey ? "VITE_SUPABASE_ANON_KEY" : null,
].filter((value): value is string => Boolean(value));
