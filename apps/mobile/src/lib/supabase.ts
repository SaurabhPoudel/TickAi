import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null = url && key
  ? createClient(url, key, { auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
  : null;

/**
 * People start using Tuck before creating an account: we sign them in anonymously
 * and they can attach an email later without losing anything.
 */
export async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.access_token;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return anon.session?.access_token ?? null;
}

const DEV_ID_KEY = "tuck.devUserId";
export async function devUserId() {
  let id = await AsyncStorage.getItem(DEV_ID_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2, 10);
    await AsyncStorage.setItem(DEV_ID_KEY, id);
  }
  return id;
}
