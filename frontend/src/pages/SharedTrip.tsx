import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchTripByToken } from '../api/tripApi';
import type { TripResponse } from '../api/tripApi';
import { MapPin, Clock, Calendar, Share2, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export default function SharedTrip() {
  const { token } = useParams<{ token: string }>();
  const [trip, setTrip] = useState<TripResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchTripByToken(token)
      .then(setTrip)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, [token]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-gray-600 font-semibold">일정을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
          <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">일정을 찾을 수 없습니다</h2>
          <p className="text-gray-500 text-sm mb-6">{error || '링크가 만료되었거나 삭제된 일정입니다.'}</p>
          <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const totalPlacesCount = trip.days.reduce((sum, d) => sum + d.places.length, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 shadow-sm">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✈️</span>
            <div>
              <h1 className="font-extrabold text-gray-900 tracking-tight leading-none">AGI Go Travel</h1>
              <span className="text-[11px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full">읽기 전용 공유 뷰어</span>
            </div>
          </div>
          <button
            onClick={handleCopyLink}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-sm ${
              copied ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {copied ? <CheckCircle2 className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            {copied ? '복사됨!' : '링크 복사'}
          </button>
        </div>
      </header>

      {/* Trip Hero Section */}
      <div className="max-w-2xl mx-auto px-5 pt-8 pb-4">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-6 text-white shadow-2xl shadow-blue-500/20">
          <p className="text-blue-200 text-sm font-bold mb-1 uppercase tracking-widest">🗺 여행 일정</p>
          <h2 className="text-3xl font-extrabold mb-3 leading-tight">{trip.title}</h2>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full">
              <Calendar className="w-3.5 h-3.5" />
              <span className="font-semibold">{trip.startDate || '날짜 미정'}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-semibold">{trip.days.length}일 일정</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full">
              <MapPin className="w-3.5 h-3.5" />
              <span className="font-semibold">{totalPlacesCount}개 장소</span>
            </div>
          </div>
        </div>
      </div>

      {/* Day-by-Day Itinerary */}
      <div className="max-w-2xl mx-auto px-5 pb-20 flex flex-col gap-6">
        {trip.days.map((dayObj) => {
          const dayDate = (() => {
            if (!trip.startDate) return null;
            const d = new Date(trip.startDate);
            d.setDate(d.getDate() + dayObj.day - 1);
            return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
          })();

          return (
            <div key={dayObj.day}>
              {/* Day Header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-extrabold text-sm shadow-md shadow-blue-500/30 shrink-0">
                  D{dayObj.day}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">{dayDate || `${dayObj.day}일차`}</h3>
                </div>
              </div>

              {/* Places List */}
              <div className="flex flex-col gap-2 pl-5 border-l-2 border-blue-100">
                {dayObj.places.map((place: any, idx: number) => {
                  return (
                    <div
                      key={place.id || idx}
                      className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-black text-xs shrink-0 mt-0.5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-gray-800 text-sm leading-snug">{place.name}</p>
                          {place.memo && (
                            <p className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded-md mt-1.5 border border-amber-100">
                              💡 {place.memo}
                            </p>
                          )}
                        </div>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-300 hover:text-blue-500 transition-colors mt-1"
                        >
                          <MapPin className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* CTA Footer */}
        <div className="mt-6 bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-6 text-center text-white">
          <p className="text-sm text-gray-400 mb-2">직접 AI로 여행 일정을 만들어보세요!</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-blue-900/30 hover:scale-[1.03] transition-all"
          >
            ✨ AGI Go Travel 시작하기
          </Link>
        </div>
      </div>
    </div>
  );
}
