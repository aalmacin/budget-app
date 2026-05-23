'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function loginRedirect(error: string): never {
  const params = new URLSearchParams({ error });
  redirect(`/login?${params.toString()}`);
}

export async function signIn(formData: FormData): Promise<never> {
  const email = formData.get('email');
  const password = formData.get('password');

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    loginRedirect('Email and password required');
  }

  let authError: { message: string } | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    authError = error;
  } catch {
    loginRedirect('Service temporarily unavailable');
  }

  if (authError) {
    loginRedirect('Invalid credentials');
  }

  redirect('/');
}

export async function signOut(): Promise<never> {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // Best-effort: clear session even if the provider call fails.
  }
  redirect('/login');
}
