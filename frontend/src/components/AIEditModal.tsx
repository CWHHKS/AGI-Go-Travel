import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTravelStore } from '../store/travelStore';
import { Sparkles, X, Loader2, Send, CheckCircle2 } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  places?: any[];
}

export default function AIEditModal() {
  const { i18n } = useTranslation();
  const { isAIEditModalOpen, setAIEditModalOpen, currentDay, places, days, updateCurrentDayPlaces, setDays } = useTravelStore();

  const [chatHistory, setChatHistory] = useState<{role: string, content: string}[]>([]);
  const [displayedChat, setDisplayedChat] = useState<ChatMessage[]>([]);
  const [userChatInput, setUserChatInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [displayedChat]);

  useEffect(() => {
    if (isAIEditModalOpen) {
      setChatHistory([]);
      setUserChatInput('');
      const modeName = currentDay === 0 ? "전체 일정" : `${currentDay}일차`;
      const initialSystemMsg = `✨ 상세 스케줄 피드백 모드입니다. 현재 [${modeName}] 일정(${currentDay === 0 ? days.length + '개 날짜' : places.length + '개 장소'})이 등록되어 있습니다. 어떻게 수정해 드릴까요?`;
      setDisplayedChat([{
         id: 'edit_welcome', role: 'system', content: initialSystemMsg, places: currentDay === 0 ? [] : places
      }]);
    }
  }, [isAIEditModalOpen, currentDay, places, days]);

  if (!isAIEditModalOpen) return null;

  const fetchEditPlan = async (history: {role: string, content: string}[]) => {
    setIsEditing(true);
    try {
      const lastAsst = displayedChat.filter(c => c.role === 'assistant');
      const latestData = lastAsst.length > 0 && lastAsst[lastAsst.length - 1].places ? lastAsst[lastAsst.length - 1].places : (currentDay === 0 ? days : places);

      const response = await fetch('http://localhost:3005/api/chat-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          currentDay,
          existingData: latestData, // places or days
          chatHistory: history,
          language: i18n.language
        })
      });
      const json = await response.json();
      
      if (json.success && json.data) {
        setDisplayedChat(prev => [...prev, { 
          role: 'assistant', 
          id: Date.now().toString(),
          content: json.data.message, 
          places: json.data.places || json.data.days // Support both flat and nested
        }]);
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: json.data.message + "\n(데이터 업데이트됨)" 
        }]);
      } else {
        alert('AI 응답을 받아오지 못했습니다.');
      }
    } catch (error) {
      alert('일정 피드백 중 오류가 발생했습니다.');
    }
    setIsEditing(false);
  };

  const handleSendMessage = () => {
    if (!userChatInput.trim() || isEditing) return;
    const msg = userChatInput.trim();
    setUserChatInput('');
    setDisplayedChat(prev => [...prev, { id: Date.now().toString(), role: 'user', content: msg }]);
    
    const updatedHistory = [...chatHistory, { role: 'user', content: msg }];
    setChatHistory(updatedHistory);
    fetchEditPlan(updatedHistory);
  };

  const applyChanges = () => {
    const lastAsst = displayedChat.filter(c => c.role === 'assistant');
    if (lastAsst.length > 0) {
      const data = lastAsst[lastAsst.length - 1].places;
      if (!data) return;

      if (currentDay === 0) {
        // 전체 일정 업데이트 (days 구조)
        setDays(data as any);
      } else {
        // 한 일차만 업데이트
        const mapped = (data as any[]).map((p:any, i:number) => ({
          ...p, 
          id: p.id || `edit_${Date.now()}_${i}`,
          travelTimeToNext: p.travelTime ?? p.travelTimeToNext,
          travelModeToNextName: p.travelMode ?? p.travelModeToNextName
        }));
        updateCurrentDayPlaces(mapped);
      }
    }
    setAIEditModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 text-left">
      <div 
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-md transition-opacity"
        onClick={() => !isEditing && setAIEditModalOpen(false)}
      />

      <div className="relative bg-white/95 backdrop-blur-3xl w-full max-w-2xl h-[80vh] rounded-[2rem] shadow-2xl border border-white/50 overflow-hidden flex flex-col transition-all duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {currentDay === 0 ? "전체 일정 편집" : `${currentDay}일차 일정 편집`}
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                {currentDay === 0 
                  ? "여행 전체 코스를 AI와 조율하고 최적화해 보세요." 
                  : `현재 ${currentDay}일차의 일정을 대화로 조율하고 고쳐보세요.`}
              </p>
            </div>
          </div>
          <button onClick={() => !isEditing && setAIEditModalOpen(false)} className="p-2 rounded-full hover:bg-black/5 transition-colors">
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Chat List Area */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto w-full bg-[#f8fafc] p-4 sm:p-6 flex flex-col gap-5 custom-scrollbar relative">
          {displayedChat.map((msg) => (
            <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              
              {msg.role === 'system' && (
                <div className="w-full flex flex-col items-center my-2 gap-3">
                  <span className="bg-gray-200/60 text-gray-600 text-xs font-bold px-4 py-1.5 rounded-full ring-1 ring-gray-300/50">
                    {msg.content}
                  </span>
                  {/* Current places preview at start */}
                  <div className="w-full max-w-sm bg-white rounded-2xl p-4 shadow-sm ring-1 ring-gray-100 flex flex-col gap-2 opacity-80">
                    {msg.places?.map((p, pIdx) => (
                      <div key={p.id} className="text-sm font-semibold flex items-center gap-2">
                         <span className="w-5 h-5 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center text-xs shrink-0">{pIdx+1}</span>
                         {p.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {msg.role === 'user' && (
                <div className="max-w-[80%] bg-[#FEE500] text-[#191919] px-5 py-3.5 rounded-2xl rounded-tr-sm shadow-sm font-medium leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>
              )}

              {msg.role === 'assistant' && (
                <div className="max-w-[90%] flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-md shrink-0 mt-1">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex flex-col gap-2 w-full">
                    <div className="bg-white text-gray-800 px-5 py-4 rounded-2xl rounded-tl-sm shadow-sm ring-1 ring-gray-100 font-medium leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </div>
                    {msg.places && msg.places.length > 0 && (
                      <div className="flex flex-col gap-3 mt-1 ml-1">
                        {/* Check if it's multi-day data */}
                        {msg.places[0] && ('day' in msg.places[0]) ? (
                          (msg.places as any[]).map((d: any) => (
                            <div key={d.day} className="flex flex-col gap-1">
                              <span className="text-[11px] font-black text-emerald-600 ml-1 uppercase">{d.day}일차</span>
                              {d.places.map((place: any, pIdx: number) => (
                                <div key={pIdx} className="bg-white px-3 py-2 rounded-xl border-l-4 border-emerald-400 shadow-sm flex flex-col">
                                  <span className="font-bold text-[12px] text-gray-800 flex items-center gap-1.5">
                                    <span className="w-3.5 h-3.5 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-[9px] shrink-0">{pIdx+1}</span>
                                    {place.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ))
                        ) : (
                          // Single day rendering
                          msg.places.map((place, pIdx) => (
                            <div key={pIdx} className="bg-white px-3 py-2.5 rounded-xl border-l-4 border-emerald-400 shadow-sm flex flex-col hover:border-emerald-500 transition-colors">
                              <span className="font-bold text-[13px] text-gray-800 flex items-center gap-1.5">
                                <span className="w-4 h-4 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-[10px] shrink-0">{pIdx+1}</span>
                                {place.name}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {isEditing && (
            <div className="flex justify-start w-full">
              <div className="max-w-[80%] flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-md shrink-0 mt-1 animate-pulse">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white text-gray-800 px-5 py-4 rounded-2xl rounded-tl-sm shadow-sm ring-1 ring-gray-100 flex items-center gap-2">
                   <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                   <span className="text-sm font-bold text-gray-500 animate-pulse">
                     일정을 재구성하는 중...
                   </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input & Apply Area */}
        <div className="shrink-0 bg-white border-t border-gray-200 px-4 py-4 flex flex-col gap-3">
           <div className="flex items-end gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-200 focus-within:ring-2 focus-within:ring-emerald-500/50 focus-within:bg-white transition-all">
             <textarea 
               value={userChatInput}
               onChange={e => setUserChatInput(e.target.value)}
               onKeyDown={e => {
                 if (e.key === 'Enter' && !e.shiftKey) {
                   e.preventDefault();
                   handleSendMessage();
                 }
               }}
               placeholder="원하는 수정을 요청해 보세요... (예: '박물관 빼줘')"
               className="flex-1 bg-transparent border-none focus:outline-none resize-none py-2 px-3 text-sm max-h-32 min-h-[44px] custom-scrollbar"
               rows={1}
             />
             
             {/* New Save & Apply Button next to Send */}
             <button 
               onClick={applyChanges}
               disabled={isEditing || displayedChat.filter(c => c.role === 'assistant').length === 0}
               className="flex-shrink-0 px-4 h-11 bg-blue-600 text-white rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:bg-gray-400 shadow-md shadow-blue-500/20 transition-all font-bold text-sm hover:bg-blue-700 active:scale-95"
               title="지금까지의 수정을 저장하고 닫습니다"
             >
               <CheckCircle2 className="w-4 h-4" />
               저장
             </button>

             <button 
               onClick={handleSendMessage}
               disabled={!userChatInput.trim() || isEditing}
               className="flex-shrink-0 w-11 h-11 bg-emerald-500 text-white rounded-xl flex items-center justify-center disabled:opacity-50 disabled:bg-gray-400 shadow-md shadow-emerald-500/30 transition-colors"
               title="AI에게 질문 보내기"
             >
               <Send className="w-4 h-4 ml-0.5" />
             </button>
           </div>
        </div>
      </div>
    </div>
  );
}
