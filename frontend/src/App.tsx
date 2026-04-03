import { useEffect, useState, Component, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LANG_CYCLE } from './i18n';
import Map from './components/Map';
import PlaceSearch from './components/PlaceSearch';
import Timeline from './components/Timeline';
import AIGeneratorModal from './components/AIGeneratorModal';
import AIEditModal from './components/AIEditModal';
import LoginGate from './components/LoginGate';
import { useTravelStore } from './store/travelStore';
import { useAuthStore } from './store/authStore';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import { Menu, Sparkles, LogOut, User, Globe, Loader2, AlertTriangle, List, PlusCircle } from 'lucide-react';
import MyTripsModal from './components/MyTripsModal';

// ── ErrorBoundary: Map 크래시 시 흰 화면 방지 ──
class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  state = { hasError: false, errorMsg: '' };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error.message };
  }
  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-100 text-gray-600 gap-3">
          <AlertTriangle className="w-8 h-8 text-orange-400" />
          <p className="text-sm font-medium">지도를 불러오는 중 오류가 발생했습니다.</p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold"
          >
            새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}


function App() {
  const { t, i18n } = useTranslation();
  const { setAIWizardOpen, resetTrip, setMyTripsModalOpen, days, places } = useTravelStore();
  const { user, isAuthLoading, initAuth, signOut } = useAuthStore();
  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false);

  // Supabase Auth 세션 초기화 (앱 마운트 시 1회)
  useEffect(() => {
    const unsubscribe = initAuth();
    return unsubscribe;
  }, []);

  // Supabase Realtime 동기화 구독
  useRealtimeSync();

  // 언어 토글 (KO → EN → JA → KO)
  const toggleLanguage = () => {
    const current = LANG_CYCLE.find(l => i18n.language.startsWith(l.code)) || LANG_CYCLE[0];
    i18n.changeLanguage(current.next).then(() => {
      window.location.reload(); // Google Maps language 반영
    });
  };

  const currentLangInfo = LANG_CYCLE.find(l => i18n.language.startsWith(l.code)) || LANG_CYCLE[0];
  const nextLangInfo = LANG_CYCLE.find(l => l.code === currentLangInfo.next) || LANG_CYCLE[1];
  const handleNewTrip = () => {
    const hasData = days.some((d: any) => d.places.length > 0) || places.length > 0;
    if (hasData) {
      setIsNewTripModalOpen(true);
    } else {
      resetTrip();
    }
  };

  const handleConfirmNewTrip = () => {
    resetTrip();
    setIsNewTripModalOpen(false);
  };

  // ── 로딩 스피너 ──
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  // ── 비로그인 → LoginGate 전체 화면 ──
  if (!user) return <LoginGate />;

  // ── 로그인 완료 → 메인 앱 ──
  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden font-sans">
      
      {/* Desktop Sidebar / Mobile Bottom Sheet */}
      <aside className="
        w-full md:w-[400px] lg:w-[480px] h-[50vh] md:h-full 
        fixed md:relative bottom-0 md:bottom-auto z-20
        bg-white/90 backdrop-blur-xl border-t md:border-t-0 md:border-r border-gray-200/60
        shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] md:shadow-2xl
        flex flex-col rounded-t-[2.5rem] md:rounded-none
        transition-all duration-500 ease-in-out
      ">
        {/* Mobile Drag Handle */}
        <div className="w-full flex justify-center py-4 md:hidden">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
        </div>

        {/* Dashboard Header */}
        <div className="px-6 pb-4 md:pt-8 flex items-center justify-between border-b border-gray-100/50">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">{t('app.title')}</h1>
            <p className="text-sm tracking-wide text-gray-500 mt-1 font-medium">{t('app.subtitle')}</p>
          </div>

          {/* Lang Toggle & Profile */}
          <div className="relative flex items-center gap-3">
            
            {/* 언어 전환 버튼 */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-bold text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
              title={`${t('common.language')}: ${currentLangInfo.label} → ${nextLangInfo.label}`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{currentLangInfo.label}</span>
              <span className="text-gray-400">→</span>
              <span className="text-blue-600">{nextLangInfo.label}</span>
            </button>

            {/* 프로필 / 로그아웃 */}
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-gray-700 max-w-[80px] truncate">
                  {user.email?.split('@')[0]}
                </span>
              </div>
              <div className="relative group">
                <button
                  id="profile-btn"
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/30 text-white hover:scale-105 transition-transform"
                >
                  <User className="w-4 h-4" />
                </button>
                {/* Dropdown */}
                <div className="absolute right-0 top-11 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 min-w-[160px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Account</p>
                    <p className="text-xs font-black text-gray-800 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={() => setMyTripsModalOpen(true)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors font-bold"
                  >
                    <List className="w-3.5 h-3.5" />
                    내 일정 목록
                  </button>
                  <button
                    onClick={handleNewTrip}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors font-bold border-b border-gray-50"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    새 일정 시작
                  </button>
                  <button
                    onClick={signOut}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    {t('auth.logout')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline (Scrollable Area) */}
        <div className="flex-1 overflow-y-auto w-full relative">
          <Timeline />
        </div>
      </aside>

      {/* Main Map Content */}
      <main className="flex-1 relative h-[50vh] md:h-full z-10">
        
        {/* Floating Search Bar & AI Button Container */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 md:-translate-x-0 md:left-6 z-30 w-11/12 md:w-auto flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex items-center gap-3 w-full md:w-96">
            <button className="md:hidden p-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-sm border border-gray-200">
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
            <PlaceSearch />
          </div>
          
          {/* AI Generator Trigger */}
          <button 
            onClick={() => setAIWizardOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-3.5 bg-gray-900 hover:bg-black text-white rounded-2xl shadow-xl shadow-gray-900/20 transition-all hover:scale-105 active:scale-95 font-semibold"
          >
            <Sparkles className="w-5 h-5 text-yellow-300" />
            <span>{t('ai.button')}</span>
          </button>
        </div>

        {/* Map View — ErrorBoundary로 크래시 방지 */}
        <ErrorBoundary>
          <Map />
        </ErrorBoundary>
        
        {/* Modals */}
        <AIGeneratorModal />
        <AIEditModal />
        <MyTripsModal />
      </main>

      {/* 새 일정 확인 모달 */}
      {isNewTripModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5 animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col gap-1.5">
              <h3 className="text-lg font-black text-slate-900">새 일정을 시작하시겠습니까?</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                현재 작성 중인 일정이 <span className="font-bold text-red-500">모두 사라집니다.</span><br />
                계속하시겠습니까?
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setIsNewTripModalOpen(false)}
                className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all"
              >
                취소
              </button>
              <button
                onClick={handleConfirmNewTrip}
                className="flex-1 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-black text-sm shadow-lg shadow-red-200 transition-all active:scale-95"
              >
                새로 시작
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
