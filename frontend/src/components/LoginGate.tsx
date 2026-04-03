import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Loader2, Send, CheckCircle2, MapPin } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const LANGS = [
  { code: 'ko' as const, label: '한국어', flag: '🇰🇷' },
  { code: 'en' as const, label: 'English', flag: '🇺🇸' },
  { code: 'ja' as const, label: '日本語', flag: '🇯🇵' },
];

export default function LoginGate() {
  const { t, i18n } = useTranslation();
  const { signInWithGoogle, signInWithMagicLink } = useAuthStore();

  const currentCode = (LANGS.find(l => i18n.language.startsWith(l.code))?.code) ?? 'en';
  const [selectedLang, setSelectedLang] = useState<'ko' | 'en' | 'ja'>(currentCode);
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  const handleLangSelect = (code: 'ko' | 'en' | 'ja') => {
    setSelectedLang(code);
    // 즉시 localStorage에 저장 (OAuth 리다이렉트/reload 후에도 언어 유지)
    localStorage.setItem('i18nextLng', code);
    i18n.changeLanguage(code); // 화면 즉시 전환
  };

  const handleGoogle = async () => {
    // Google OAuth 전에 선택한 언어를 localStorage에 저장
    localStorage.setItem('i18nextLng', selectedLang);
    await signInWithGoogle(selectedLang);
  };

  const handleMagicLink = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError(t('auth.err_invalid_email'));
      return;
    }
    setStep('sending');
    setError('');
    const err = await signInWithMagicLink(trimmed, selectedLang);
    if (err) {
      setError(err);
      setStep('idle');
    } else {
      setStep('sent');
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 relative overflow-hidden px-4">
      
      {/* 배경 장식 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm flex flex-col gap-6">
        
        {/* ── 언어 선택 ── */}
        <div className="flex items-center justify-center gap-2">
          {LANGS.map(lang => (
            <button
              key={lang.code}
              onClick={() => handleLangSelect(lang.code)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold transition-all border ${
                selectedLang === lang.code
                  ? 'bg-white text-gray-900 border-white shadow-lg shadow-white/20'
                  : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>

        {/* ── 브랜드 ── */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/40">
              <MapPin className="w-7 h-7 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">AGI Go Travel</h1>
          <p className="text-blue-200/80 text-sm mt-1.5 font-medium">{t('app.subtitle')}</p>
        </div>

        {/* ── 카드 ── */}
        <div className="bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/20 shadow-2xl p-7 flex flex-col gap-4">

          {step === 'sent' ? (
            /* Magic Link 발송 완료 화면 */
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-bold text-lg">{t('auth.magic_link_sent_title')}</p>
                <p className="text-white/60 text-sm mt-1">{t('auth.magic_link_sent_desc')}</p>
                <p className="text-blue-300 font-bold text-sm mt-2">{email}</p>
              </div>
              <button
                onClick={() => { setStep('idle'); setEmail(''); }}
                className="text-white/50 text-xs hover:text-white/80 transition-colors mt-2"
              >
                {t('auth.try_another_email')}
              </button>
            </div>
          ) : (
            <>
              {/* Google OAuth — 메인 버튼 */}
              <button
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-3 py-3.5 bg-white hover:bg-gray-50 active:bg-gray-100 rounded-xl font-bold text-gray-800 transition-all shadow-lg shadow-black/20 text-sm"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {t('auth.google_continue')}
              </button>

              {/* 구분선 */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/20" />
                <span className="text-white/40 text-xs font-semibold">{t('auth.or_email')}</span>
                <div className="flex-1 h-px bg-white/20" />
              </div>

              {/* 이메일 Magic Link */}
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleMagicLink()}
                    placeholder={t('auth.email_placeholder')}
                    className="w-full pl-10 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 text-white text-sm font-medium placeholder-white/30 transition-all"
                  />
                </div>

                {error && (
                  <p className="text-red-400 text-xs font-medium px-1">⚠️ {error}</p>
                )}

                <button
                  id="magic-link-btn"
                  onClick={handleMagicLink}
                  disabled={step === 'sending'}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-500/30 disabled:opacity-60"
                >
                  {step === 'sending' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {t('auth.magic_link_btn')}
                </button>

                <p className="text-white/30 text-xs text-center leading-relaxed">
                  {t('auth.magic_link_hint')}
                </p>
              </div>
            </>
          )}
        </div>

        {/* 하단 안내 */}
        <p className="text-center text-white/30 text-xs">
          {t('auth.login_required_note')}
        </p>
      </div>
    </div>
  );
}
