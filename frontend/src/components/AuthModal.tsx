import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Mail, Lock, Globe, Loader2, LogIn, UserPlus } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function AuthModal() {
  const { t } = useTranslation();
  const { isAuthModalOpen, setAuthModalOpen, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isAuthModalOpen) return null;

  const handleClose = () => {
    if (!isLoading) {
      setAuthModalOpen(false);
      setErrorMsg('');
      setSuccessMsg('');
    }
  };

  const handleEmailAuth = async () => {
    if (!email || !password) {
      setErrorMsg(t('auth.err_empty'));
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const error = mode === 'login'
      ? await signInWithEmail(email, password)
      : await signUpWithEmail(email, password);

    setIsLoading(false);
    if (error) {
      setErrorMsg(translateError(error));
    } else if (mode === 'signup') {
      setSuccessMsg(t('auth.success_signup'));
    } else {
      setAuthModalOpen(false);
    }
  };

  const handleGoogle = async () => {
    setIsLoading(true);
    await signInWithGoogle();
  };

  const translateError = (msg: string): string => {
    if (msg.includes('Invalid login credentials')) return t('auth.err_invalid');
    if (msg.includes('User already registered')) return t('auth.err_already');
    if (msg.includes('Password should be at least')) return t('auth.err_short_pw');
    if (msg.includes('Unable to validate email')) return t('auth.err_invalid_email');
    return msg;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/70 backdrop-blur-md"
        onClick={handleClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl border border-white/50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Gradient Bar */}
        <div className="h-2 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">✈️</span>
              <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
                {mode === 'login' ? t('auth.login') : t('auth.signup')}
              </h2>
            </div>
            <p className="text-sm text-gray-500 font-medium">
              {t('auth.welcome')}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-7 pb-7 flex flex-col gap-4">
          {/* Google OAuth */}
          <button
            onClick={handleGoogle}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-xl font-bold text-gray-700 transition-all shadow-sm disabled:opacity-60"
          >
            <Globe className="w-5 h-5 text-blue-500" />
            {t('auth.google_continue')}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-semibold">{t('auth.or_email')}</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Email Field */}
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth()}
              placeholder={t('auth.email_placeholder')}
              className="w-full pl-10 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-medium transition-all placeholder-gray-400"
            />
          </div>

          {/* Password Field */}
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth()}
              placeholder={t('auth.password_placeholder')}
              className="w-full pl-10 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-medium transition-all placeholder-gray-400"
            />
          </div>

          {/* Error / Success Messages */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-2.5 rounded-xl">
              ⚠️ {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium px-4 py-2.5 rounded-xl">
              ✅ {successMsg}
            </div>
          )}

          {/* Submit Button */}
          <button
            id="auth-submit-btn"
            onClick={handleEmailAuth}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-all disabled:opacity-60"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : mode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" />
                {t('auth.login')}
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                {t('auth.signup')}
              </>
            )}
          </button>

          {/* Mode Toggle */}
          <p className="text-center text-sm text-gray-500">
            {mode === 'login' ? (
              <>
                {t('auth.no_account')}{' '}
                <button
                  onClick={() => { setMode('signup'); setErrorMsg(''); setSuccessMsg(''); }}
                  className="text-blue-600 font-bold hover:underline"
                >
                  {t('auth.signup')}
                </button>
              </>
            ) : (
              <>
                {t('auth.have_account')}{' '}
                <button
                  onClick={() => { setMode('login'); setErrorMsg(''); setSuccessMsg(''); }}
                  className="text-blue-600 font-bold hover:underline"
                >
                  {t('auth.login')}
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
