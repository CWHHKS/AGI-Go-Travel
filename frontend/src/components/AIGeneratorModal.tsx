import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTravelStore } from '../store/travelStore';
import { Sparkles, Calendar, MapPin, Users, Wallet, Compass, Car, X, Loader2, Send, CheckCircle2 } from 'lucide-react';

const COMPANIONS = ['나홀로', '커플/부부', '친구와', '가족과(아이포함)'];
const BUDGETS = ['가성비', '적당히', '여유롭게', '플렉스'];
const THEMES = ['휴식/힐링', '관광지 투어', '액티비티', '쇼핑 중심', '맛집 투어'];
const TRANSPORTS = ['대중교통', '도보 위주', '렌트카/자차'];
const ACCOMMODATIONS = ['호텔', '에어비앤비', '게스트하우스', '지인집/기타'];

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  places?: any[];
}

export default function AIGeneratorModal() {
  const { t, i18n } = useTranslation();
  const { isAIWizardOpen, setAIWizardOpen, isGenerating, setGenerating, setTripTitle, setDays, days, currentDay, tripTitle } = useTravelStore();

  const [step, setStep] = useState<'form' | 'chat'>('form');
  
  // Form State
  const [destination, setDestination] = useState('');
  const [duration, setDuration] = useState('2박 3일');
  const [companion, setCompanion] = useState(COMPANIONS[1]);
  const [budget, setBudget] = useState(BUDGETS[1]);
  const [theme, setTheme] = useState(THEMES[1]);
  const [transport, setTransport] = useState(TRANSPORTS[0]);
  const [accommodation, setAccommodation] = useState('호텔');
  const [accommodationBudget, setAccommodationBudget] = useState('');
  const [extraPrompt, setExtraPrompt] = useState('');

  // Chat State
  const [totalDays, setTotalDays] = useState(3);
  const [currentPlanningDay, setCurrentPlanningDay] = useState(1);
  const [chatHistory, setChatHistory] = useState<{role: string, content: string}[]>([]);
  const [displayedChat, setDisplayedChat] = useState<ChatMessage[]>([]);
  const [approvedDays, setApprovedDays] = useState<{day: number, places: any[]}[]>([]);
  const [userChatInput, setUserChatInput] = useState('');
  
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [displayedChat]);

  // Reset or setup for Edit mode
  useEffect(() => {
    if (isAIWizardOpen) {
      if (days.length > 0) {
        // --- Edit Mode ---
        setStep('chat');
        setDestination(tripTitle || '');
        const total = days.length;
        setTotalDays(total);
        
        const targetDay = currentDay === 0 ? 1 : currentDay;
        setCurrentPlanningDay(targetDay);

        const currentDayObj = days.find(d => d.day === targetDay);
        const placeNames = currentDayObj ? currentDayObj.places.map(p => p.name).join(', ') : '없음';

        setDisplayedChat([{
           id: 'edit-welcome',
           role: 'system',
           content: `🛠️ ${targetDay}일차 일정을 수정합니다. 현재 장소: [${placeNames}]. 어떻게 변경해 드릴까요?`
        }]);

        // Initialize history with current state for AI context
        setChatHistory([{
          role: 'system',
          content: `사용자가 현재 생성된 일차별 일정을 수정하려고 합니다. 현재 ${targetDay}일차 장소 목록: ${placeNames}.`
        }]);
      } else {
        // --- Initial Plan Mode ---
        setStep('form');
        setChatHistory([]);
        setDisplayedChat([]);
        setApprovedDays([]);
        setCurrentPlanningDay(1);
      }
    }
  }, [isAIWizardOpen]);

  if (!isAIWizardOpen) return null;

  const fetchChatPlan = async (history: {role: string, content: string}[], targetDay: number, tDays: number) => {
    setGenerating(true);
    try {
      const response = await fetch('http://localhost:3005/api/chat-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tripDetails: { destination, duration, companion, budget, theme, transport, accommodation, accommodationBudget, extraPrompt },
          currentDay: targetDay,
          totalDays: tDays,
          chatHistory: history,
          language: i18n.language
        })
      });
      const json = await response.json();
      
      if (json.success && json.data) {
        setDisplayedChat(prev => [...prev, { 
          id: Date.now().toString(), 
          role: 'assistant', 
          content: json.data.message, 
          places: json.data.places 
        }]);
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: json.data.message + "\n(제안된 장소 개수: " + (json.data.places?.length || 0) + ")" 
        }]);
      } else {
        setDisplayedChat(prev => [...prev, { 
          id: Date.now().toString(), 
          role: 'system', 
          content: `⚠️ 오류: ${json.error || '일정을 가져오지 못했습니다. 다시 시도해 주세요.'}` 
        }]);
      }
    } catch (error) {
      setDisplayedChat(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'system', 
        content: '⚠️ 서버 연결에 실패했습니다. 네트워크 상태를 확인해주세요.' 
      }]);
    }
    setGenerating(false);
  };

  const startChatMode = () => {
    if (!destination) return;
    
    // Parse duration to get total days
    const match = duration.match(/(\d+)일/);
    const parsedTotalDays = match ? parseInt(match[1]) : 3;
    setTotalDays(parsedTotalDays);
    
    setStep('chat');
    setCurrentPlanningDay(1);
    
    // Add Welcome Message
    setDisplayedChat([{
       id: 'welcome',
       role: 'system',
       content: `🎉 ${destination} 여행 플래닝 마법사를 시작합니다! 총 ${parsedTotalDays}일의 일정을 저와 함께 하루하루 꼼꼼히 픽스해 나가보시죠! 바로 1일차 초안을 가져올게요.`
    }]);

    fetchChatPlan([], 1, parsedTotalDays);
  };

  const handleSendMessage = () => {
    if (!userChatInput.trim() || isGenerating) return;
    const msg = userChatInput.trim();
    setUserChatInput('');
    
    setDisplayedChat(prev => [...prev, { id: Date.now().toString(), role: 'user', content: msg }]);
    
    const updatedHistory = [...chatHistory, { role: 'user', content: msg }];
    setChatHistory(updatedHistory);
    fetchChatPlan(updatedHistory, currentPlanningDay, totalDays);
  };

  const handleApproveDay = () => {
    // Find highest places
    const latestAssisMsgs = displayedChat.filter(c => c.role === 'assistant');
    const finalPlaces = latestAssisMsgs.length > 0 ? latestAssisMsgs[latestAssisMsgs.length - 1].places || [] : [];
    
    const newApproved = [...approvedDays, { 
      day: currentPlanningDay, 
      places: finalPlaces.map((p: any, i: number) => ({
        ...p, 
        id: p.id || `ai_${currentPlanningDay}_${i}`,
        travelTimeToNext: p.travelTime ?? p.travelTimeToNext, // AI raw -> FE field
        travelModeToNextName: p.travelMode ?? p.travelModeToNextName // AI raw -> FE field
      })) 
    }];
    setApprovedDays(newApproved);

    if (currentPlanningDay >= totalDays) {
      // Finished all days!
      setTripTitle(`${destination} 여행`);
      setDays(newApproved);
      setAIWizardOpen(false);
    } else {
      const nextDay = currentPlanningDay + 1;
      setCurrentPlanningDay(nextDay);
      
      const ackMsg = `✅ [SYSTEM] ${currentPlanningDay}일차가 성공적으로 확정되었습니다. 이제 바로 ${nextDay}일차 코스 초안을 제안해주세요.`;
      
      setDisplayedChat(prev => [...prev, { id: Date.now().toString(), role: 'system', content: `✅ ${currentPlanningDay}일차 확정! 이제 ${nextDay}일차를 준비합니다...` }]);
      
      const nextHistory = [...chatHistory, { role: 'system', content: ackMsg }];
      setChatHistory(nextHistory);
      fetchChatPlan(nextHistory, nextDay, totalDays);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-md transition-opacity"
        onClick={() => !isGenerating && setAIWizardOpen(false)}
      />

      <div className={`relative bg-white/95 backdrop-blur-3xl w-full rounded-[2rem] shadow-2xl border border-white/50 overflow-hidden flex flex-col transition-all duration-500 ease-in-out ${step === 'form' ? 'max-w-xl max-h-[90vh]' : 'max-w-2xl h-[85vh]'}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {step === 'form' ? t('ai.modal_title') : `${t('ai.modal_title')} (${currentPlanningDay} / ${totalDays})`}
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                {step === 'form' ? t('ai.modal_subtitle') : t('ai.chat_subtitle')}
              </p>
            </div>
          </div>
          <button onClick={() => !isGenerating && setAIWizardOpen(false)} className="p-2 rounded-full hover:bg-black/5 transition-colors">
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* BODY - FORM MODE */}
        {step === 'form' && (
          <>
            <div className="px-8 py-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                    <MapPin className="w-4 h-4 text-blue-500" /> {t('ai.destination')}
                  </label>
                  <input 
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder={t('ai.destination_placeholder')}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 text-blue-500" /> {t('ai.period')}
                  </label>
                  <input 
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder={t('ai.period_placeholder')}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <SelectionGroup icon={<Users />} title={t('ai.companion_label')} options={COMPANIONS} selected={companion} onSelect={setCompanion} />
              <SelectionGroup icon={<Wallet />} title={t('ai.budget_label')} options={BUDGETS} selected={budget} onSelect={setBudget} />
              <SelectionGroup icon={<Compass />} title={t('ai.theme_label')} options={THEMES} selected={theme} onSelect={setTheme} />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectionGroup icon={<Car />} title={t('ai.transport_label')} options={TRANSPORTS} selected={transport} onSelect={setTransport} />
                <div className="flex flex-col">
                  <SelectionGroup icon={<MapPin />} title={t('ai.accommodation_label')} options={ACCOMMODATIONS} selected={accommodation} onSelect={setAccommodation} />
                  <input 
                    type="text"
                    placeholder={t('ai.accommodation_budget_placeholder')}
                    value={accommodationBudget}
                    onChange={(e) => setAccommodationBudget(e.target.value)}
                    className="mt-3 w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" /> {t('ai.extra_label')}
                </label>
                <textarea 
                  value={extraPrompt}
                  onChange={(e) => setExtraPrompt(e.target.value)}
                  placeholder={t('ai.extra_placeholder')}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl resize-none h-24 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all text-sm"
                />
              </div>
            </div>

            <div className="px-8 py-5 border-t border-gray-100 bg-gray-50/50 flex justify-end shrink-0">
              <button 
                onClick={startChatMode}
                disabled={!destination}
                className="flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-[1.02] text-white rounded-xl font-bold tracking-wide shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50"
              >
                <Sparkles className="w-5 h-5" />
                {t('ai.generate_btn')}
              </button>
            </div>
          </>
        )}

        {/* BODY - CHAT MODE */}
        {step === 'chat' && (
          <>
            {/* Chat List Area */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto w-full bg-[#f8fafc] p-4 sm:p-6 flex flex-col gap-5 custom-scrollbar relative">
              
              {displayedChat.map((msg) => (
                <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  
                  {msg.role === 'system' && (
                    <div className="w-full flex justify-center my-2">
                      <span className="bg-gray-200/60 text-gray-600 text-xs font-bold px-4 py-1.5 rounded-full ring-1 ring-gray-300/50">
                        {msg.content}
                      </span>
                    </div>
                  )}

                  {msg.role === 'user' && (
                    <div className="max-w-[80%] bg-[#FEE500] text-[#191919] px-5 py-3.5 rounded-2xl rounded-tr-sm shadow-sm font-medium leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  )}

                  {msg.role === 'assistant' && (
                    <div className="max-w-[90%] flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shrink-0 mt-1">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex flex-col gap-2 w-full">
                        <div className="bg-white text-gray-800 px-5 py-4 rounded-2xl rounded-tl-sm shadow-sm ring-1 ring-gray-100 font-medium leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </div>
                        {/* Render Proposed Places if any */}
                        {msg.places && msg.places.length > 0 && (
                          <div className="flex flex-col gap-1.5 mt-1 ml-1">
                            {msg.places.map((place, pIdx) => (
                              <div key={pIdx} className="bg-white px-3 py-2.5 rounded-xl border-l-4 border-blue-400 shadow-sm flex flex-col hover:border-blue-500 transition-colors">
                                <span className="font-bold text-[13px] text-gray-800 flex items-center gap-1.5">
                                  <span className="w-4 h-4 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-[10px] shrink-0">{pIdx+1}</span>
                                  {place.name}
                                </span>
                                {place.duration && <span className="text-[11px] text-gray-500 ml-5">{place.duration}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              ))}

              {isGenerating && (
                <div className="flex justify-start w-full">
                  <div className="max-w-[80%] flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shrink-0 mt-1 animate-pulse">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-white text-gray-800 px-5 py-4 rounded-2xl rounded-tl-sm shadow-sm ring-1 ring-gray-100 flex items-center gap-2">
                       <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                       <span className="text-sm font-bold text-gray-500 animate-pulse">
                         {t('ai.planning_day', { day: currentPlanningDay })}
                       </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input & Approve Area */}
            <div className="shrink-0 bg-white border-t border-gray-200 px-4 py-4 flex flex-col gap-3">
               
               {/* Tool / Status bar */}
               <div className="flex justify-between items-center px-1">
                 <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
                   현재 진행도: <span className="text-blue-600">{currentPlanningDay} / {totalDays}</span>일차
                 </span>
                 <button 
                   onClick={handleApproveDay}
                   disabled={isGenerating || displayedChat.filter(c => c.role === 'assistant').length === 0}
                   className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed shadow-sm border border-emerald-100"
                 >
                   {isGenerating ? (
                     <>
                       <Loader2 className="w-4 h-4 animate-spin" />
                       AI 분석 중...
                     </>
                   ) : (
                     <>
                       <CheckCircle2 className="w-4 h-4" />
                       {currentPlanningDay === totalDays ? '마지막 일정 확정완료' : `${currentPlanningDay}일차 코스 확정 (다음으로)`}
                     </>
                   )}
                 </button>
               </div>

               {/* Input form */}
               <div className="flex items-end gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-200 focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:bg-white transition-all">
                 <textarea 
                   value={userChatInput}
                   onChange={e => setUserChatInput(e.target.value)}
                   onKeyDown={e => {
                     if (e.key === 'Enter' && !e.shiftKey) {
                       e.preventDefault();
                       handleSendMessage();
                     }
                   }}
                   placeholder="수정이 필요하신가요? (예: 일정이 너무 빡빡해요. 박물관은 빼주세요)"
                   className="flex-1 bg-transparent border-none focus:outline-none resize-none py-2 px-3 text-sm max-h-32 min-h-[44px] custom-scrollbar"
                   rows={1}
                 />
                 <button 
                   onClick={handleSendMessage}
                   disabled={!userChatInput.trim() || isGenerating}
                   className="flex-shrink-0 w-11 h-11 bg-blue-600 text-white rounded-xl flex items-center justify-center disabled:opacity-50 disabled:bg-gray-400 shadow-md shadow-blue-500/30 transition-colors"
                 >
                   <Send className="w-4 h-4 ml-0.5" />
                 </button>
               </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

// Subcomponent for quick button selections
function SelectionGroup({ icon, title, options, selected, onSelect }: any) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
         {React.cloneElement(icon, { className: 'w-4 h-4 text-blue-500' })} {title}
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt: string) => (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${selected === opt 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 border border-blue-600' 
                : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:bg-blue-50'}
            `}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
