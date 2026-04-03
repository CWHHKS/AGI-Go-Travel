import React, { useEffect, useState } from 'react';
import { useTravelStore } from '../store/travelStore';
import { useAuthStore } from '../store/authStore';
import { fetchMyTrips, deleteTrip } from '../api/tripApi';
import { X, Calendar, MapPin, Trash2, Download, Upload, Loader2 } from 'lucide-react';

export default function MyTripsModal() {
  const { user } = useAuthStore();
  const { isMyTripsModalOpen, setMyTripsModalOpen, loadTripFromDB, isDirty, importTrip } = useTravelStore();
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isMyTripsModalOpen && user) {
      loadTrips();
    }
  }, [isMyTripsModalOpen, user]);

  const loadTrips = async () => {
    setLoading(true);
    try {
      const data = await fetchMyTrips(user!.id);
      setTrips(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSelectTrip = async (trip: any) => {
    if (isDirty) {
      const confirmLoad = window.confirm('저장되지 않은 변경사항이 있습니다. 무시하고 일정을 불러오시겠습니까?');
      if (!confirmLoad) return;
    }
    loadTripFromDB(trip);
    setMyTripsModalOpen(false);
  };

  const handleDeleteTrip = async (e: React.MouseEvent, tripId: string) => {
    e.stopPropagation();
    if (!window.confirm('정말 이 일정을 삭제하시겠습니까?')) return;
    try {
      await deleteTrip(tripId);
      setTrips(trips.filter(t => t.id !== tripId));
    } catch (e) {
      alert('삭제 실패');
    }
  };

  const handleExport = (e: React.MouseEvent, trip: any) => {
    e.stopPropagation();
    const data = JSON.stringify({
      title: trip.title,
      startDate: trip.startDate,
      days: trip.days,
      dayStartTimes: trip.dayStartTimes,
      dayTravelModes: trip.dayTravelModes
    }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trip.title || '여행'}_일정.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (isDirty) {
          if (!window.confirm('저장되지 않은 데이터가 있습니다. 무시하고 파일을 가져오시겠습니까?')) return;
        }
        importTrip(json);
        setMyTripsModalOpen(false);
      } catch (err) {
        alert('올바른 JSON 파일이 아닙니다.');
      }
    };
    reader.readAsText(file);
  };

  if (!isMyTripsModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMyTripsModalOpen(false)} />
      <div className="relative bg-white w-full max-w-2xl max-h-[80vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/20">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-2xl font-black text-gray-900">내 일정 목록</h2>
            <p className="text-xs font-bold text-gray-400 mt-0.5">내가 저장한 여행 코스들을 관리하세요.</p>
          </div>
          <div className="flex items-center gap-3">
             <label className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs cursor-pointer hover:bg-blue-100 transition-all border border-blue-100">
               <Upload className="w-3.5 h-3.5" />
               가져오기 (.json)
               <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
             </label>
             <button onClick={() => setMyTripsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-all text-gray-400">
               <X className="w-6 h-6" />
             </button>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              <p className="text-sm font-bold text-gray-400">일정을 불러오는 중...</p>
            </div>
          ) : trips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-300 gap-4">
               <MapPin className="w-16 h-16 opacity-20" />
               <p className="text-lg font-black italic text-center">저장된 일정이 없습니다.<br/>새로운 여행을 계획해 보세요!</p>
               <button onClick={() => setMyTripsModalOpen(false)} className="px-6 py-3 bg-gray-900 text-white rounded-2xl font-bold text-sm shadow-xl mt-2">일정 짜러가기</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {trips.map((trip) => (
                <div 
                  key={trip.id} 
                  onClick={() => handleSelectTrip(trip)}
                  className="group flex items-center justify-between p-5 bg-white border border-gray-100 rounded-[2rem] hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-5">
                     <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                        <MapPin className="w-6 h-6" />
                     </div>
                     <div>
                       <h3 className="text-base font-black text-gray-900 group-hover:text-blue-600 transition-colors">{trip.title || '제목 없음'}</h3>
                       <div className="flex items-center gap-3 mt-1">
                         <span className="flex items-center gap-1 text-[11px] font-bold text-gray-400">
                           <Calendar className="w-3 h-3" />
                           {trip.startDate ? trip.startDate.split('T')[0] : '날짜 미지정'}
                         </span>
                         <span className="text-[10px] text-gray-300">•</span>
                         <span className="text-[11px] font-bold text-gray-400">
                           {trip.destination}
                         </span>
                       </div>
                     </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleExport(e, trip); }}
                      title="데이터 내보내기"
                      className="p-3 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => handleDeleteTrip(e, trip.id)}
                      title="삭제"
                      className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
