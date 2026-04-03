import { 
  DndContext,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  GripVertical, Download, Share2, Car, Footprints, Bus, 
  Trash2, ExternalLink, Sparkles, Pencil, Check, Save, 
  Loader2, CheckCircle2, AlertCircle, Clock, PlusCircle
} from 'lucide-react';
import { useTravelStore } from '../store/travelStore';
import type { Place } from '../store/travelStore';
import { useRef, useState, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { 
  parseDurationToMinutes, isTimeInsufficient
} from '../utils/timeUtils';

import { useAuthStore } from '../store/authStore';
import { useTranslation } from 'react-i18next';
import { getDayColor } from '../utils/dayColors';

// --- [x] `backend/api/index.js`: Update AI prompts for all generation endpoints (`generate`, `chat-plan`, `chat-edit`)
// - [x] `backend/api/index.js`: Update DB save/update logic to include travel info
// - [x] `frontend/src/components/Timeline.tsx`: Render AI travel info and add "Google Maps Navigation" button
// - [/] `frontend/src/components/Map.tsx`: Optimize to skip redundant API calls when AI data exists
// - [ ] Verification: Test itinerary generation in Tokyo

// --- Sub-components ---

function SortablePlaceItem({ place, dayColor, label, isEditingMode }: { place: Place; dayColor: string; label: string; isEditingMode: boolean; }) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: place.id, disabled: !isEditingMode });
  
  const { removePlace, triggerRouteCalculation, routeConfig, updatePlace } = useTravelStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isTimeEditing, setIsTimeEditing] = useState(false);
  const [scheduledTime, setScheduledTime] = useState(place.scheduledTime || '09:00');
  const [memoText, setMemoText] = useState(place.memo || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [memoText, isEditing]);

  const handleSaveMemo = () => {
    updatePlace(place.id, { memo: memoText });
    setIsEditing(false);
  };

  const handleTimeSubmit = () => {
    updatePlace(place.id, { scheduledTime });
    setIsTimeEditing(false);
    triggerRouteCalculation(false);
  };

  const formatDisplayTime = (time: string) => {
    if (!time) return '--:--';
    const [h, m] = time.split(':').map(Number);
    const ampm = h < 12 ? '오전' : '오후';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${ampm} ${h12}:${m.toString().padStart(2, '0')}`;
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-stretch gap-2.5 p-2 rounded-xl border
        ${isDragging 
          ? 'bg-blue-50/90 border-blue-200 shadow-2xl scale-[1.02] z-[999]' 
          : 'bg-white border-gray-100 shadow-sm hover:border-gray-200 hover:shadow-md'}
        transition-all duration-200 group relative
      `}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-gray-300 hover:text-blue-500 cursor-grab active:cursor-grabbing p-1 rounded self-center transition-colors flex-shrink-0"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Marker & Number */}
      <div className="flex-shrink-0 self-start mt-0.5">
        <div className="relative flex flex-col items-center">
            <svg width="24" height="32" viewBox="0 0 36 48" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M18 0C8.059 0 0 8.059 0 18c0 13.5 18 30 18 30s18-16.5 18-30C36 8.059 27.941 0 18 0z"
                fill={dayColor}
                stroke="white"
                strokeWidth="2"
            />
            <circle cx="18" cy="18" r="13" fill="white" opacity="0.95" />
            <text
                x="18" y="24"
                textAnchor="middle"
                fill={dayColor}
                fontSize={label.length >= 5 ? "12" : label.length >= 3 ? "15" : "18"}
                fontWeight="900"
                fontFamily="Arial, sans-serif"
            >{label}</text>
            </svg>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div className="flex flex-col">
          {/* Time Display/Editor */}
          <div className="flex items-center gap-2 mb-1">
            {isTimeEditing ? (
              <div className="flex items-center gap-1 bg-blue-50 p-1 rounded-lg border border-blue-100">
                <input 
                  type="time" 
                  value={scheduledTime} 
                  onChange={(e) => setScheduledTime(e.target.value)}
                  onBlur={handleTimeSubmit}
                  autoFocus
                  className="bg-transparent border-none p-0 text-xs font-black text-blue-600 focus:ring-0 w-24"
                />
                <button onClick={handleTimeSubmit} className="text-blue-600 p-0.5 hover:bg-blue-100 rounded">
                    <Check className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsTimeEditing(true)}
                className="group/time flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 text-slate-500 rounded-md hover:bg-blue-50 hover:text-blue-600 transition-all border border-transparent hover:border-blue-100"
              >
                <Clock className="w-3 h-3 opacity-50 group-hover/time:opacity-100" />
                <span className="text-[11px] font-black leading-none">{formatDisplayTime(place.scheduledTime || '09:00')}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 tracking-tight text-sm sm:text-base truncate">{place.name}</span>
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-blue-500 transition-colors">
                <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
        
        {isEditing ? (
          <div className="mt-1 pr-2">
            <textarea
              ref={textareaRef}
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              placeholder={t('timeline.memo_placeholder')}
              className="w-full text-[11px] p-2 text-gray-700 border border-blue-100 rounded-lg outline-none resize-none focus:ring-1 focus:ring-blue-500 bg-blue-50/20 overflow-hidden leading-relaxed"
              onPointerDown={(e) => e.stopPropagation()} 
            />
          </div>
        ) : (
          place.memo && (
            <div className="relative group/memo mt-0.5">
              <div className="text-[11px] text-gray-400 truncate max-w-[200px] bg-slate-50/50 px-2 py-1 rounded-lg border border-slate-100/50 italic">
                "{place.memo}"
              </div>
              <div className="absolute bottom-full left-0 mb-3 w-max max-w-[260px] p-4 bg-slate-900 text-white text-[12px] rounded-2xl shadow-2xl opacity-0 group-hover/memo:opacity-100 group-active/memo:opacity-100 transition-all pointer-events-none z-[100] whitespace-pre-wrap leading-relaxed ring-1 ring-white/10">
                {place.memo}
                <div className="absolute top-full left-4 -mt-1 border-8 border-transparent border-t-slate-900" />
              </div>
            </div>
          )
        )}
      </div>
      
      {/* Actions */}
      <div className="flex flex-col gap-1 justify-center items-center border-l border-gray-100 pl-3 ml-1">
        <button
          onClick={() => isEditing ? handleSaveMemo() : setIsEditing(true)}
          className={`p-2 rounded-xl transition-all ${isEditing ? 'text-blue-600 bg-blue-50' : 'text-gray-300 hover:text-blue-500 hover:bg-slate-50'}`}
        >
          {isEditing ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
        </button>
        <button
          onClick={() => {
            removePlace(place.id);
            if (routeConfig.active) triggerRouteCalculation(false);
          }}
          className="text-gray-300 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

const PreviewModal = ({ isOpen, onClose, imageData, tripTitle, onShare }: { isOpen: boolean, onClose: () => void, imageData: string | null, tripTitle: string, onShare: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-xl font-bold text-gray-900">일정표 미리보기</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors font-black">X</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex justify-center bg-gray-100">
          {imageData ? <img src={imageData} alt="Preview" className="shadow-lg max-w-full rounded-md" /> : <div className="flex flex-col items-center justify-center py-20 text-gray-400"><Loader2 className="w-10 h-10 animate-spin mb-4" /></div>}
        </div>
        <div className="p-6 border-t border-gray-100 flex gap-4 bg-white">
          <button onClick={() => { const link = document.createElement('a'); link.download = `${tripTitle || '여행'}_일정표.png`; link.href = imageData!; link.click(); }} disabled={!imageData} className="flex-1 flex items-center justify-center gap-2 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-200"><Download className="w-4 h-4" /> 이미지 저장</button>
          <button onClick={onShare} className="flex-1 flex items-center justify-center gap-2 py-4 bg-[#FEE500] text-[#191919] rounded-2xl font-bold hover:bg-[#FADA0A] transition-all shadow-lg"><Share2 className="w-4 h-4" /> 공유하기</button>
        </div>
      </div>
    </div>
  );
};

// --- Main Component ---

export default function Timeline() {
  const { t } = useTranslation();
  const { 
    tripTitle, places, setPlaces, routeLegs, dayRouteLegs,
    triggerRouteCalculation, travelMode, setTravelMode, routeConfig,
    days, currentDay, setCurrentDay, 
    tripStartDate, setTripStartDate, 
    saveTripToDB, shareToken,
    dayTravelModes, editingDayId,
    sortPlacesByDistance, setAIWizardOpen, saveStatus,
    resetTrip
  } = useTravelStore();
  const { user, setAuthModalOpen } = useAuthStore();
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewImageData, setPreviewImageData] = useState<string | null>(null);
  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false);

  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 8 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 5 } });
  const keyboardSensor = useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates });
  
  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  const handleDragStart = (event: DragStartEvent) => {
    console.log('Drag started:', event.active.id);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (over) console.log('Dragging over:', over.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const overId = over.id as string;
    const activeId = active.id as string;

    if (activeId !== overId) {
      const oldIndex = places.findIndex((p) => p.id === activeId);
      const newIndex = places.findIndex((p) => p.id === overId);
      if (oldIndex !== -1 && newIndex !== -1) {
        setPlaces(arrayMove(places, oldIndex, newIndex));
        triggerRouteCalculation(false);
      }
    }
  };

  const handleSaveTrip = async () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    const token = await saveTripToDB(user.id);
    if (token) {
      console.log('Trip saved successfully. Token:', token);
    }
  };

  const handleExportImage = async () => {
    if (!timelineRef.current) return;
    setIsPreviewOpen(true);
    setPreviewImageData(null);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const dataUrl = await toPng(timelineRef.current, { cacheBust: true, backgroundColor: '#f8fafc', style: { padding: '20px' } });
      setPreviewImageData(dataUrl);
    } catch (e) {
      setIsPreviewOpen(false);
    }
  };

  const handleShareLink = () => {
    if (!shareToken) return alert('먼저 저장해주세요.');
    navigator.clipboard.writeText(`${window.location.origin}/share/${shareToken}`);
    alert('공유 링크가 복사되었습니다.');
  };
  const handleNewTrip = () => {
    // 일정 데이터가 있으면 항상 확인 모달을 표시
    const hasData = days.some(d => d.places.length > 0) || places.length > 0;
    if (hasData) {
      setIsNewTripModalOpen(true);
    } else {
      resetTrip();
    }
  };

  const handleConfirmNewTrip = () => {
    console.log('[NewTrip] Resetting itinerary...');
    resetTrip();
    setIsNewTripModalOpen(false);
  };

  useEffect(() => {
    // 이동 시간 데이터가 없고 장소가 2개 이상이면 자동 계산 트리거
    if (routeLegs.length === 0 && places.length >= 2 && !routeConfig.active) {
      triggerRouteCalculation(false);
    }
  }, [places.length, routeLegs.length, currentDay]);

  const isEditingMode = editingDayId === null || editingDayId === currentDay || editingDayId === 0;

  return (
    <div className="w-full h-full flex flex-col pt-6 pb-24 px-4 sm:px-6 overflow-y-auto custom-scrollbar text-gray-900 bg-white">
      <div ref={timelineRef} className="p-2 -mx-2">
        {/* Top Header */}
        <div className="flex flex-col mb-6 px-2 gap-4">
          <div className="flex justify-between items-center bg-slate-50 px-5 py-4 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex flex-col">
              <h2 className="text-xl font-black text-slate-900 truncate max-w-[180px] sm:max-w-[300px]">{tripTitle || '나의 여행'}</h2>
              <div className="flex items-center gap-1.5 mt-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <input type="date" value={tripStartDate} onChange={(e) => setTripStartDate(e.target.value)} className="text-xs font-bold text-slate-500 bg-transparent border-none p-0 focus:ring-0" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleExportImage} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm active:scale-95">
                <Download className="w-5 h-5 text-slate-600" />
              </button>
              <button 
                onClick={handleNewTrip} 
                className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl hover:bg-emerald-100 transition-all shadow-sm active:scale-95 group"
              >
                <PlusCircle className="w-4 h-4 text-emerald-600 group-hover:rotate-90 transition-transform duration-300" />
                <span className="text-xs font-black text-emerald-700">새 일정</span>
              </button>
              <button 
                onClick={handleSaveTrip} 
                className={`flex items-center gap-2 px-5 py-3 text-white rounded-2xl font-bold text-sm transition-all shadow-lg active:scale-95 group ${
                  saveStatus === 'saved' ? 'bg-emerald-500 shadow-emerald-100' : 
                  saveStatus === 'saving' ? 'bg-blue-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'
                }`}
                disabled={saveStatus === 'saving'}
              >
                {saveStatus === 'saved' ? <CheckCircle2 className="w-4 h-4" /> : 
                 saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                 <Save className="w-4 h-4 group-hover:scale-110" />}
                {saveStatus === 'saved' ? '저장됨' : 
                 saveStatus === 'saving' ? '저장 중' : '전체 저장'}
              </button>
            </div>
          </div>

          {/* Day Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setCurrentDay(0)}
              className={`px-5 py-3 whitespace-nowrap rounded-2xl font-black text-xs transition-all min-w-[90px] shadow-sm ${
                currentDay === 0 ? 'bg-slate-900 text-white shadow-slate-200' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
              }`}
            >
              All Days
            </button>
            {days.map((d) => (
              <button
                key={d.day}
                onClick={() => setCurrentDay(d.day)}
                className={`px-5 py-3 whitespace-nowrap rounded-2xl font-black text-xs transition-all shadow-sm ${
                  currentDay === d.day ? 'bg-blue-600 text-white shadow-blue-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                }`}
              >
                Day {d.day}
              </button>
            ))}
          </div>
        </div>

        {/* Global Toolbar for current day */}
        {currentDay >= 0 && (
          <div className="px-2 mb-4">
            <div className="flex bg-slate-100 rounded-2xl p-1 border border-slate-200 w-full justify-around items-center">
              {(['DRIVING', 'WALKING', 'TRANSIT'] as const).map(mode => {
                const dayPlaces = currentDay > 0 ? (days.find(d => d.day === currentDay)?.places || []) : [];
                const isPureMode = currentDay > 0 && dayPlaces.length > 0 && dayPlaces.every((p) => (p.travelModeToNext || dayTravelModes[currentDay] || travelMode) === mode);
                const isActive = currentDay > 0 ? ((dayTravelModes[currentDay] || travelMode) === mode) : (travelMode === mode);
                
                return (
                  <div key={mode} className="relative group flex-1">
                    {isPureMode && (mode === 'DRIVING' || mode === 'WALKING') && (
                      <button onClick={() => triggerRouteCalculation(true)} className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-[9px] font-black rounded-full shadow-xl opacity-0 group-hover:opacity-100 transition-all z-50 whitespace-nowrap">Optimize ✨</button>
                    )}
                    {isPureMode && mode === 'TRANSIT' && (
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-50">
                        <button onClick={() => sortPlacesByDistance(currentDay, 'asc')} className="px-2 py-1 bg-slate-800 text-white text-[9px] font-black rounded-full shadow-xl">가까운순</button>
                        <button onClick={() => sortPlacesByDistance(currentDay, 'desc')} className="px-2 py-1 bg-slate-800 text-white text-[9px] font-black rounded-full shadow-xl">먼순</button>
                      </div>
                    )}
                    <button
                      onClick={() => setTravelMode(mode)}
                      className={`w-full flex flex-col items-center gap-1 py-2 rounded-xl transition-all ${isActive ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-500'}`}
                    >
                      {mode === 'DRIVING' && <Car className="w-4 h-4" />}
                      {mode === 'WALKING' && <Footprints className="w-4 h-4" />}
                      {mode === 'TRANSIT' && <Bus className="w-4 h-4" />}
                      <span className="text-[9px] font-black tracking-tight">{t(`timeline.${mode.toLowerCase()}`)}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DndContext 
          sensors={sensors} 
          collisionDetection={closestCorners} 
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-col gap-8">
            {(currentDay === 0 ? days : days.filter(d => d.day === currentDay)).map((d) => {
              const dayColor = getDayColor(d.day);
              const tripDateObj = new Date(tripStartDate || new Date());
              tripDateObj.setDate(tripDateObj.getDate() + (d.day - 1));
              const tripDateStr = tripDateObj.toISOString().split('T')[0];

              return (
                <div key={d.day} className="flex flex-col">
                  {/* Day Label Header */}
                  <div className="px-2 mb-4">
                    <div className="flex items-center justify-between bg-slate-900 px-5 py-3.5 rounded-[2rem] shadow-xl ring-1 ring-white/10">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-10 h-10 bg-white/10 rounded-2xl">
                            <span className="text-sm font-black text-white">D-{d.day}</span>
                        </div>
                        <span className="text-xs font-bold text-white/50 tracking-[0.2em] uppercase">{tripDateStr}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setAIWizardOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-500 rounded-xl text-white hover:bg-blue-400 transition-all shadow-lg active:scale-95 text-xs font-black">
                            <Sparkles className="w-3.5 h-3.5" />
                            AI
                        </button>
                        <button 
                          onClick={handleSaveTrip} 
                          disabled={saveStatus === 'saving'}
                          className={`p-2.5 rounded-xl text-white transition-all shadow-lg active:scale-95 ${
                            saveStatus === 'saved' ? 'bg-emerald-500' : 
                            saveStatus === 'saving' ? 'bg-blue-400' : 'bg-slate-700 hover:bg-slate-600'
                          }`}
                        >
                          {saveStatus === 'saved' ? <CheckCircle2 className="w-4 h-4" /> :
                           saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                           <Save className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* List based Timeline */}
                  <div className="flex flex-col px-1 sm:px-2">
                    <SortableContext 
                        id={`day-${d.day}`}
                        items={d.places.map(p => p.id)} 
                        strategy={verticalListSortingStrategy}
                      >
                        {d.places.map((place, idx) => {
                          const leg = dayRouteLegs[d.day]?.[idx] || (currentDay === d.day ? routeLegs[idx] : undefined);
                          const travelMins = leg ? parseDurationToMinutes(leg.duration) : 0;
                          const currentMode = dayTravelModes[d.day] || place.travelModeToNext || travelMode;
                          
                          const nextPlace = d.places[idx+1];
                          const isWarning = nextPlace && nextPlace.scheduledTime && place.scheduledTime && isTimeInsufficient(place.scheduledTime, travelMins, nextPlace.scheduledTime);

                          return (
                            <div key={place.id} className="flex flex-col">
                              <SortablePlaceItem place={place} dayColor={dayColor} label={`${d.day}-${idx + 1}`} isEditingMode={isEditingMode} />
                              
                              {/* Route Leg Info BETWEEN cards */}
                              {idx < d.places.length - 1 && (
                                <div className="flex flex-col items-center py-1 relative h-10">
                                  <div className="w-0.5 h-full bg-slate-100 absolute left-[2.9rem] top-0 bottom-0 -z-10" />
                                  <div className="flex ml-14 items-center gap-2 bg-white/80 backdrop-blur-sm border border-slate-100 px-3 py-1 rounded-xl shadow-sm hover:shadow-md transition-all group/leg">
                                    <div className={`
                                      ${currentMode === 'DRIVING' ? 'animate-vibrate' : ''}
                                      ${currentMode === 'WALKING' ? 'animate-walking' : ''}
                                      ${currentMode === 'TRANSIT' ? 'animate-bus' : ''}
                                    `}>
                                      {currentMode === 'DRIVING' && <Car className="w-3.5 h-3.5 text-blue-500" />}
                                      {currentMode === 'WALKING' && <Footprints className="w-3.5 h-3.5 text-emerald-500" />}
                                      {currentMode === 'TRANSIT' && <Bus className="w-3.5 h-3.5 text-indigo-500" />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-800 leading-none">
                                          {currentMode === 'TRANSIT' && nextPlace && nextPlace.travelTimeToNext && nextPlace.travelModeToNextName 
                                            ? `${nextPlace.travelTimeToNext}분 (${nextPlace.travelModeToNextName})`
                                            : (leg && leg.duration ? leg.duration : (currentMode === 'TRANSIT' ? '경로 확인' : t('timeline.calculating')))}
                                        </span>
                                        <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">
                                          {currentMode === 'TRANSIT' && nextPlace && nextPlace.travelModeToNextName ? 'AI 예상' : t(`timeline.${currentMode.toLowerCase()}`)}
                                        </span>
                                    </div>
                                    {(currentMode === 'TRANSIT' || place.travelModeToNextName) && place.lat && place.lng && nextPlace && nextPlace.lat && nextPlace.lng && (
                                       <a href={`https://www.google.com/maps/dir/?api=1&origin=${place.lat},${place.lng}&destination=${nextPlace.lat},${nextPlace.lng}&travelmode=transit`}
                                          target="_blank" rel="noopener noreferrer" 
                                          className="ml-auto w-6 h-6 flex items-center justify-center rounded-full bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition shadow-sm text-indigo-500"
                                          title="구글 지도 앱에서 실시간 길찾기">
                                          <ExternalLink className="w-3 h-3" />
                                       </a>
                                    )}
                                  </div>

                                  {isWarning && (
                                    <div className="absolute left-32 top-1/2 -translate-y-1/2 animate-bounce">
                                      <div className="flex items-center gap-1.5 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg ring-2 ring-white">
                                        <AlertCircle className="w-3 h-3" />
                                        시간부족!
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </SortableContext>
                  </div>
                </div>
              );
            })}
          </div>
        </DndContext>
      </div>

      <PreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} imageData={previewImageData} tripTitle={tripTitle} onShare={handleShareLink} />

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
