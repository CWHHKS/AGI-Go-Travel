import { useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api';
import { Search, MapPin } from 'lucide-react';
import { useTravelStore } from '../store/travelStore';

const LIBRARIES: ('places' | 'geometry')[] = ['places', 'geometry'];

export default function PlaceSearch() {
  const { t } = useTranslation();
  const { addPlace } = useTravelStore();

  // ⚠️ Map.tsx와 완전히 동일한 id/options 사용 → 스크립트 재사용 (충돌 방지)
  // id가 다르거나 language가 다르면 "Loader must not be called again" 에러 발생
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
  });

  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onLoad = useCallback((ac: google.maps.places.Autocomplete) => {
    setAutocomplete(ac);
  }, []);

  // 장소를 addPlace에 추가하는 핵심 로직 (공통 함수)
  const commitPlace = useCallback((name: string, lat: number, lng: number) => {
    addPlace({
      id: `place_${Date.now()}`,
      name,
      lat,
      lng,
      duration: '1시간 체류',
      durationMinutes: 60,
    });
    if (inputRef.current) inputRef.current.value = '';
  }, [addPlace]);

  // Autocomplete에서 장소가 선택됐을 때 (마우스 클릭 또는 Enter 선택)
  const onPlaceChanged = useCallback(() => {
    if (!autocomplete) return;

    const place = autocomplete.getPlace();

    // ✅ geometry가 있으면 바로 추가 (마우스 클릭 선택 시 대부분 이쪽)
    if (place.geometry?.location && place.name) {
      commitPlace(place.name, place.geometry.location.lat(), place.geometry.location.lng());
      return;
    }

    // ✅ geometry 없는 경우(Enter로 선택 시 발생) → Geocoder fallback
    const query = place.name || inputRef.current?.value?.trim();
    if (!query) return;

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: query }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const loc = results[0].geometry.location;
        const resolvedName = place.name || results[0].formatted_address || query;
        commitPlace(resolvedName, loc.lat(), loc.lng());
      }
    });
  }, [autocomplete, commitPlace]);

  // ✅ Enter 키 처리:
  // 드롭다운이 열려있으면 ArrowDown + Enter 시뮬레이션으로 첫 번째 항목 선택
  // 드롭다운이 없으면 Geocoder로 직접 검색
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;

    const pacContainer = document.querySelector('.pac-container') as HTMLElement | null;
    const hasDropdown = pacContainer && pacContainer.style.display !== 'none'
      && pacContainer.children.length > 0;

    if (hasDropdown) {
      // 드롭다운 첫 번째 항목을 ArrowDown으로 하이라이트한 뒤 Enter로 선택
      const arrowDown = new KeyboardEvent('keydown', {
        key: 'ArrowDown', keyCode: 40, code: 'ArrowDown', bubbles: true, cancelable: true,
      });
      inputRef.current?.dispatchEvent(arrowDown);

      setTimeout(() => {
        const enterKey = new KeyboardEvent('keydown', {
          key: 'Enter', keyCode: 13, code: 'Enter', bubbles: true, cancelable: true,
        });
        inputRef.current?.dispatchEvent(enterKey);
      }, 60);
    } else {
      // 드롭다운 없이 Enter → 직접 Geocoder 검색
      const query = inputRef.current?.value?.trim();
      if (!query || !window.google) return;
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: query }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const loc = results[0].geometry.location;
          commitPlace(results[0].formatted_address || query, loc.lat(), loc.lng());
        }
      });
    }
  }, [commitPlace]);

  // Maps API 로드 전에는 일반 input 렌더링 (크래시 방지)
  const inputEl = (
    <div className="relative group w-full max-w-md">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors duration-300" />
      </div>
      <input
        ref={inputRef}
        type="text"
        onKeyDown={handleKeyDown}
        className="block w-full pl-11 pr-4 py-3.5 bg-white/80 backdrop-blur-md
                   border border-gray-200 rounded-2xl text-gray-900
                   placeholder-gray-400 focus:outline-none focus:ring-2
                   focus:ring-blue-500/50 focus:border-blue-500
                   shadow-sm hover:shadow-md transition-all duration-300
                   text-[15px] font-medium"
        placeholder={isLoaded ? t('search.placeholder') : '지도 로딩 중...'}
        disabled={!isLoaded}
      />
      <div className="absolute inset-y-0 right-3 flex items-center">
        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hidden group-focus-within:block animate-in fade-in zoom-in duration-200">
          <MapPin className="h-4 w-4" />
        </div>
      </div>
    </div>
  );

  // Maps API 로드 완료 시에만 Autocomplete 활성화
  if (!isLoaded) return inputEl;

  return (
    <Autocomplete
      onLoad={onLoad}
      onPlaceChanged={onPlaceChanged}
      options={{ fields: ['name', 'geometry', 'place_id', 'formatted_address'] }}
    >
      {inputEl}
    </Autocomplete>
  );
}
