import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import i18n from '../i18n';


interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthModalOpen: boolean;
  isAuthLoading: boolean;

  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setAuthModalOpen: (open: boolean) => void;

  signInWithGoogle: (lang?: string) => Promise<void>;
  signInWithMagicLink: (email: string, lang: string) => Promise<string | null>;
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  signUpWithEmail: (email: string, password: string) => Promise<string | null>;
  updateUserLanguage: (lang: string) => Promise<void>;
  signOut: () => Promise<void>;
  initAuth: () => () => void;

}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isAuthModalOpen: false,
  isAuthLoading: true,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setAuthModalOpen: (open) => set({ isAuthModalOpen: open }),

  signInWithGoogle: async (lang?: string) => {
    if (lang) localStorage.setItem('i18nextLng', lang);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: lang ? { lang } : undefined,
      },
    });
  },

  signInWithMagicLink: async (email, lang) => {
    // 언어를 localStorage에 즉시 저장 (OTP 리디렉션 후 복원)
    localStorage.setItem('i18nextLng', lang);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        data: { language: lang }, // user_metadata에 저장
      },
    });
    return error ? error.message : null;
  },

  updateUserLanguage: async (lang) => {
    await supabase.auth.updateUser({ data: { language: lang } });
  },


  signInWithEmail: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  },

  signUpWithEmail: async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? error.message : null;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },

  initAuth: () => {
    // 초기 세션 복원
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ session, user: session?.user ?? null, isAuthLoading: false });
      if (session?.user) {
        const metaLang = session.user.user_metadata?.language;
        // ✅ 우선순위: localStorage(사용자 명시적 선택) > user_metadata(cross-device fallback)
        const localLang = localStorage.getItem('i18nextLng');
        const validLangs = ['ko', 'en', 'ja'];
        const finalLang = (localLang && validLangs.includes(localLang))
          ? localLang
          : (metaLang && validLangs.includes(metaLang) ? metaLang : null);
        if (finalLang) {
          i18n.changeLanguage(finalLang);
          // localLang이 metaLang과 다르면 DB를 동기화
          if (finalLang !== metaLang) {
            supabase.auth.updateUser({ data: { language: finalLang } });
          }
        }
      }
    });


    // 상태 변경 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session, user: session?.user ?? null, isAuthLoading: false });
      if (session?.user) {
        const metaLang = session.user.user_metadata?.language;
        // ✅ 우선순위: localStorage > user_metadata
        // LoginGate에서 선택한 언어가 localStorage에 저장되므로 이어 적용
        const localLang = localStorage.getItem('i18nextLng');
        const validLangs = ['ko', 'en', 'ja'];
        const finalLang = (localLang && validLangs.includes(localLang))
          ? localLang
          : (metaLang && validLangs.includes(metaLang) ? metaLang : i18n.language);
        
        if (validLangs.includes(finalLang)) {
          i18n.changeLanguage(finalLang);
          // user_metadata와 다르면 DB를 업데이트 (동기화)
          if (finalLang !== metaLang) {
            await supabase.auth.updateUser({ data: { language: finalLang } });
          }
        }
      }
    });


    return () => subscription.unsubscribe();
  },

}));
