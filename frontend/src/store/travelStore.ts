import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { saveTrip as apiSaveTrip, updateTrip as apiUpdateTrip } from '../api/tripApi';
import type { TripResponse } from '../api/tripApi';


export interface Place {
  id: string;
  name: string;
  duration?: string;
  durationMinutes?: number;
  lat?: number;
  lng?: number;
  memo?: string;
  travelModeToNext?: 'DRIVING' | 'WALKING' | 'TRANSIT';
  scheduledTime?: string; // "HH:mm" 형태
  googlePlaceId?: string;
  travelTimeToNext?: number; // AI 예상 시간 (분)
  travelModeToNextName?: string; // AI 예상 수단명 (예: "지하철")
}

interface TravelState {
  isAIWizardOpen: boolean;
  setAIWizardOpen: (open: boolean) => void;
  
  isGenerating: boolean;
  setGenerating: (status: boolean) => void;

  isAIEditModalOpen: boolean;
  setAIEditModalOpen: (open: boolean) => void;
  
  isMyTripsModalOpen: boolean;
  setMyTripsModalOpen: (open: boolean) => void;

  addPlace: (place: Omit<Place, 'id'> & Partial<Pick<Place, 'id'>>) => void;
  updatePlace: (id: string, updates: Partial<Place>) => void;
  updateCurrentDayPlaces: (places: Place[]) => void;

  tripTitle: string;
  setTripTitle: (title: string) => void;
  tripStartDate: string;
  setTripStartDate: (date: string) => void;
  dayStartTimes: Record<number, string>;
  setDayStartTime: (day: number, time: string) => void;
  dayTravelModes: Record<number, 'DRIVING' | 'WALKING' | 'TRANSIT'>;
  setDayTravelMode: (day: number, mode: 'DRIVING' | 'WALKING' | 'TRANSIT') => void;

  // DB 연동 상태
  currentTripId: string | null | undefined;
  shareToken: string | null | undefined;
  isSaving: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  setSaveStatus: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
  editingDayId: number | null | undefined;
  setEditingDayId: (dayId: number | null | undefined) => void;
  saveTripToDB: (userId: string) => Promise<string | null>; // shareToken 반환
  loadTripFromDB: (trip: TripResponse) => void;
  
  // 데이터 초기화 및 이식성
  resetTrip: () => void;
  exportTrip: () => string; // JSON 문자열 반환
  importTrip: (data: any) => void;
  isDirty: boolean; // 변경 후 저장되지 않은 상태인지 여부
  setDirty: (dirty: boolean) => void;

  places: Place[];
  setPlaces: (places: Place[]) => void;

  routeLegs: Array<{ distance: string, duration: string }>;
  setRouteLegs: (legs: Array<{ distance: string, duration: string }>) => void;
  
  dayRouteLegs: Record<number, Array<{ distance: string, duration: string }>>;
  setDayRouteLegs: (day: number, legs: Array<{ distance: string, duration: string }>) => void;
  setAllDayRouteLegs: (allLegs: Record<number, Array<{ distance: string, duration: string }>>) => void;
  
  routeConfig: { active: boolean, optimize: boolean, trigger: number };
  triggerRouteCalculation: (optimize: boolean) => void;

  travelMode: 'DRIVING' | 'WALKING' | 'TRANSIT';
  setTravelMode: (mode: 'DRIVING' | 'WALKING' | 'TRANSIT') => void;
  removePlace: (id: string) => void;
  
  customLegModes: Record<string, 'DRIVING' | 'WALKING' | 'TRANSIT'>;
  setCustomLegMode: (placeId: string, mode: 'DRIVING' | 'WALKING' | 'TRANSIT') => void;
  clearCustomLegModes: () => void;

  days: { day: number, places: Place[] }[];
  setDays: (days: { day: number, places: Place[] }[]) => void;
  currentDay: number;
  setCurrentDay: (day: number) => void;
  sortPlacesByDistance: (day: number, order: 'asc' | 'desc') => void;
}

let saveTimeout: any;

export const useTravelStore = create<TravelState>()(
  persist(
    (set, get) => ({

  isAIWizardOpen: false,
  setAIWizardOpen: (open) => set({ isAIWizardOpen: open }),
  
  isGenerating: false,
  setGenerating: (status) => set({ isGenerating: status }),

  isAIEditModalOpen: false,
  setAIEditModalOpen: (open) => set({ isAIEditModalOpen: open }),

  isMyTripsModalOpen: false,
  setMyTripsModalOpen: (open) => set({ isMyTripsModalOpen: open }),

  addPlace: (place) => set((state) => {
    const targetDay = state.currentDay > 0 ? state.currentDay : 1;
    const newPlace = { ...place, id: place.id || `manual_${Date.now()}` };

    // ✅ days가 없거나 targetDay가 없으면 Day 1 자동 생성
    let currentDays = state.days.length > 0 ? state.days : [];
    let targetDayObj = currentDays.find(d => d.day === targetDay);
    if (!targetDayObj) {
      targetDayObj = { day: targetDay, places: [] };
      currentDays = [...currentDays, targetDayObj].sort((a, b) => a.day - b.day);
    }

    const newPlaces = [...targetDayObj.places, newPlace];
    const newDays = currentDays.map(d => d.day === targetDay ? { ...d, places: newPlaces } : d);

    // 현재 보고 있는 Day면 places도 같이 업데이트
    if (state.currentDay === targetDay || state.currentDay === 0) {
      return { places: newPlaces, days: newDays, currentDay: targetDay, routeConfig: { ...state.routeConfig, optimize: false }, isDirty: true };
    }
    return { days: newDays, isDirty: true };
  }),

  updatePlace: (id, updates) => set((state) => {
    // Current Day places update
    const newPlaces = state.places.map(p => p.id === id ? { ...p, ...updates } : p);
    
    // Days array update
    const newDays = state.days.map(d => ({
      ...d,
      places: d.places.map(p => p.id === id ? { ...p, ...updates } : p)
    }));

    return { places: newPlaces, days: newDays, routeConfig: { ...state.routeConfig, optimize: false }, isDirty: true };
  }),

  updateCurrentDayPlaces: (places) => set((state) => {
    if (state.currentDay === 0) return {};
    const newDays = state.days.map(d => d.day === state.currentDay ? { ...d, places } : d);
    return { places, days: newDays, routeConfig: { ...state.routeConfig, optimize: false }, isDirty: true };
  }),

  tripTitle: '',
  setTripTitle: (title) => set({ tripTitle: title }),
  tripStartDate: new Date().toISOString().split('T')[0],
  setTripStartDate: (date) => set({ tripStartDate: date }),
  dayStartTimes: {}, // key: day number, value: "HH:mm" like "08:00"
  setDayStartTime: (day, time) => set((state) => ({ dayStartTimes: { ...state.dayStartTimes, [day]: time } })),
  dayTravelModes: {},
  setDayTravelMode: (day, mode) => set((state) => ({ dayTravelModes: { ...state.dayTravelModes, [day]: mode } })),
  editingDayId: null as number | null | undefined,
  setEditingDayId: (dayId: number | null | undefined) => set({ editingDayId: dayId }),

  // DB 연동
  currentTripId: null as string | null | undefined,
  shareToken: null as string | null | undefined,
  isSaving: false,
  saveTripToDB: async (userId) => {
    const state = get();
    set({ isSaving: true });
    try {
      const payload = {
        title: state.tripTitle || '내 여행',
        destination: state.tripTitle || '여행지',
        startDate: state.tripStartDate,
        days: state.days,
        dayStartTimes: state.dayStartTimes,
        dayTravelModes: state.dayTravelModes,
      };
      
      let result: TripResponse;
      if (state.currentTripId) {
        result = await apiUpdateTrip(state.currentTripId, payload);
      } else {
        result = await apiSaveTrip(userId, payload);
      }
      
      if (saveTimeout) clearTimeout(saveTimeout);
      set({ 
        currentTripId: result.id, 
        shareToken: result.shareToken, 
        isSaving: false,
        saveStatus: 'saved',
        isDirty: false // 저장 시 dirty 초기화
      });
      setTimeout(() => set({ saveStatus: 'idle' }), 5000);
      return result.shareToken;
    } catch (e: any) {
      if (saveTimeout) clearTimeout(saveTimeout);
      console.error('saveTripToDB error:', e);
      set({ isSaving: false, saveStatus: 'error' });
      setTimeout(() => set({ saveStatus: 'idle' }), 3000);
      return null;
    }
  },
  saveStatus: 'idle',
  setSaveStatus: (status) => set({ saveStatus: status }),
  loadTripFromDB: (trip) => {
    set({
      currentTripId: trip.id,
      shareToken: trip.shareToken,
      tripTitle: trip.title,
      tripStartDate: trip.startDate || new Date().toISOString().split('T')[0],
      dayStartTimes: trip.dayStartTimes || {},
      dayTravelModes: (trip.dayTravelModes as any) || {},
      days: trip.days as any,
      currentDay: trip.days.length > 0 ? trip.days[0].day : 1,
      places: (trip.days.length > 0 ? trip.days[0].places : []) as any,
      isDirty: false // 불러오기 시 dirty 초기화
    });
  },

  isDirty: false,
  setDirty: (dirty) => set({ isDirty: dirty }),

  resetTrip: () => {
    set((state: TravelState) => ({
      ...state,
      places: [],
      days: [],
      tripTitle: '',
      tripStartDate: new Date().toISOString().split('T')[0],
      dayStartTimes: {},
      dayTravelModes: {},
      currentTripId: null,
      shareToken: null,
      isDirty: false,
      currentDay: 1,
      routeLegs: [],
      dayRouteLegs: {},
      customLegModes: {},
      editingDayId: null,
      isAIWizardOpen: false,
      isAIEditModalOpen: false,
      isMyTripsModalOpen: false
    }));
  },

  exportTrip: (): string => {
    const s = get();
    const data = {
      title: s.tripTitle,
      startDate: s.tripStartDate,
      days: s.days,
      dayStartTimes: s.dayStartTimes,
      dayTravelModes: s.dayTravelModes
    };
    return JSON.stringify(data, null, 2);
  },

  importTrip: (data: any) => {
    if (!data || !data.days) throw new Error('올바른 파일 형식이 아닙니다.');
    set({
      tripTitle: data.title || '가져온 일정',
      tripStartDate: data.startDate || new Date().toISOString().split('T')[0],
      days: data.days,
      dayStartTimes: data.dayStartTimes || {},
      dayTravelModes: data.dayTravelModes || {},
      currentDay: data.days.length > 0 ? data.days[0].day : 1,
      places: data.days.length > 0 ? data.days[0].places : [],
      currentTripId: null,
      shareToken: null,
      isDirty: true
    });
  },

  places: [],

  routeLegs: [],
  setRouteLegs: (legs: Array<{ distance: string, duration: string }>) => set({ routeLegs: legs }),
  
  dayRouteLegs: {},
  setDayRouteLegs: (day: number, legs: {distance: string, duration: string}[]) => set((state) => ({ dayRouteLegs: { ...state.dayRouteLegs, [day]: legs } })),
  setAllDayRouteLegs: (allLegs: Record<number, Array<{ distance: string, duration: string }>>) => set((state) => ({ dayRouteLegs: { ...state.dayRouteLegs, ...allLegs } })),
  
  routeConfig: { active: false, optimize: false, trigger: 0 },
  triggerRouteCalculation: (optimize: boolean) => set((state) => ({ 
    routeConfig: { active: true, optimize, trigger: state.routeConfig.trigger + 1 } 
  })),

  travelMode: 'DRIVING',
  setTravelMode: (mode: 'DRIVING' | 'WALKING' | 'TRANSIT') => set((state) => {
    if (state.currentDay > 0) {
      const newDays = state.days.map(d => d.day === state.currentDay ? { ...d, places: d.places.map(p => ({ ...p, travelModeToNext: undefined })) } : d);
      return { 
        travelMode: mode, 
        dayTravelModes: { ...state.dayTravelModes, [state.currentDay]: mode },
        customLegModes: {},
        days: newDays,
        places: newDays.find(d => d.day === state.currentDay)?.places || [],
        routeConfig: { active: true, optimize: false, trigger: state.routeConfig.trigger + 1 },
        isDirty: true
      };
    }
    // 전역 일괄 적용 (Day 0)
    const newDayTravelModes = { ...state.dayTravelModes };
    const newDays = state.days.map(d => {
      newDayTravelModes[d.day] = mode;
      return { ...d, places: d.places.map(p => ({ ...p, travelModeToNext: undefined })) };
    });
    return { 
      travelMode: mode, 
      dayTravelModes: newDayTravelModes, 
      customLegModes: {},
      days: newDays,
      places: newDays.flatMap(d => d.places),
      routeConfig: { active: true, optimize: false, trigger: state.routeConfig.trigger + 1 },
      isDirty: true
    };
  }),
  removePlace: (id: string) => set((state) => {
    const newPlaces = state.places.filter(p => p.id !== id);
    if (state.currentDay === 0) return { places: newPlaces };
    const newDays = state.days.map(d => d.day === state.currentDay ? { ...d, places: newPlaces } : d);
    return { places: newPlaces, days: newDays };
  }),
  
  customLegModes: {},
  setCustomLegMode: (placeId: string, mode: 'DRIVING' | 'WALKING' | 'TRANSIT') => set((state) => ({
    customLegModes: { ...state.customLegModes, [placeId]: mode }
  })),
  clearCustomLegModes: () => set({ customLegModes: {} }),

  days: [],
  setDays: (days: { day: number, places: Place[] }[]) => set({ 
    days, 
    currentDay: days.length > 0 ? days[0].day : 1, 
    places: days.length > 0 ? days[0].places : [] 
  }),
  currentDay: 1,
  setCurrentDay: (day: number) => set((state) => {
    let newPlaces: Place[] = [];
    if (day === 0) {
      newPlaces = state.days.flatMap(d => d.places);
    } else {
      const found = state.days.find(d => d.day === day);
      newPlaces = found ? found.places : [];
    }

    // currentDay가 0(전체보기)이 아닐 때만 현재 places를 days에 커밋 (0이면 places가 flatMap이라 덮어쓰면 중복 발생)
    let committedDays = state.days;
    if (state.currentDay > 0) {
      committedDays = state.days.map(d => d.day === state.currentDay ? { ...d, places: state.places } : d);
    }

    // days 중복 제거 (day 번호가 같은 항목이 여러 개면 마지막 것만 유지)
    const deduped = Object.values(
      committedDays.reduce((acc: Record<number, any>, d) => { acc[d.day] = d; return acc; }, {})
    ).sort((a, b) => (a as any).day - (b as any).day);

    return { 
      currentDay: day, 
      places: newPlaces.map(p => ({...p, id: p.id || Math.random().toString()})),
      days: deduped,
      routeConfig: { active: false, optimize: false, trigger: 0 },
      routeLegs: []
    };
  }),

    setPlaces: (places: Place[]) => set((state) => {
      if (state.currentDay === 0) return { places };
      const newDays = state.days.map(d => d.day === state.currentDay ? { ...d, places } : d);
      return { places, days: newDays };
    }),

    sortPlacesByDistance: (day: number, order: 'asc' | 'desc') => set((state) => {
      const targetDay = day === 0 ? state.currentDay : day;
      const dayObj = state.days.find(d => d.day === targetDay);
      if (!dayObj || dayObj.places.length < 3) return {};

      const items = [...dayObj.places];
      const result: Place[] = [items.shift()!]; // 첫 장소 고정

      while (items.length > 0) {
        const last = result[result.length - 1];
        let bestIdx = 0;
        let bestDist = Infinity;

        for (let i = 0; i < items.length; i++) {
          const curr = items[i];
          if (!last.lat || !last.lng || !curr.lat || !curr.lng) {
            bestIdx = i;
            break;
          }
          const d = Math.sqrt(Math.pow(last.lat - curr.lat, 2) + Math.pow(last.lng - curr.lng, 2));
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }

        result.push(items.splice(bestIdx, 1)[0]);
      }

      if (order === 'desc') {
        const first = result.shift()!;
        result.reverse();
        result.unshift(first);
      }

      const newDays = state.days.map(d => d.day === targetDay ? { ...d, places: result } : d);
      return { 
        days: newDays, 
        places: targetDay === state.currentDay ? result : state.places,
        routeConfig: { ...state.routeConfig, optimize: false } 
      };
    }),
  }),
  {
    name: 'agi-go-travel-data', // localStorage 키
    partialize: (state) => ({
      // ✅ 여행 데이터만 persist (UI 상태 제외)
      tripTitle: state.tripTitle,
      tripStartDate: state.tripStartDate,
      dayStartTimes: state.dayStartTimes,
      dayTravelModes: state.dayTravelModes,
      places: state.places,
      days: state.days,
      currentDay: state.currentDay,
      travelMode: state.travelMode,
      currentTripId: state.currentTripId,
      shareToken: state.shareToken,
    }),
  }
));
