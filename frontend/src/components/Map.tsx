import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { GoogleMap, useJsApiLoader, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
import { LocateFixed } from 'lucide-react';
import { useTravelStore } from '../store/travelStore';
import { getDayColor } from '../utils/dayColors';

const containerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: 37.5665,
  lng: 126.9780 // Default: Seoul
};

// Define libraries outside to prevent re-renders
const LIBRARIES: ('places' | 'geometry')[] = ['places', 'geometry'];

const getMarkerIcon = (color: string, label: string) => {
  if (typeof window === 'undefined' || !window.google) return undefined;
  const lines = label.split('\n');
  const maxLineLen = Math.max(...lines.map(l => l.length));
  const fSize = lines.length >= 3 ? '7' : lines.length === 2 ? '8' : maxLineLen >= 5 ? '8' : maxLineLen >= 3 ? '10' : '13';
  let textNodes = '';
  if (lines.length === 1) {
     textNodes = `<tspan x="18" y="23">${lines[0]}</tspan>`;
  } else if (lines.length === 2) {
     textNodes = `<tspan x="18" y="18">${lines[0]}</tspan><tspan x="18" y="28">${lines[1]}</tspan>`;
  } else {
     textNodes = `<tspan x="18" y="13">${lines[0]}</tspan><tspan x="18" y="21">${lines[1]}</tspan><tspan x="18" y="29">${lines[2]}</tspan>`;
  }
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">',
    `<path d="M18 0C8.059 0 0 8.059 0 18c0 13.5 18 30 18 30s18-16.5 18-30C36 8.059 27.941 0 18 0z" fill="${color}" stroke="white" stroke-width="2"/>`,
    '<circle cx="18" cy="18" r="13" fill="white" opacity="0.95"/>',
    `<text fill="${color}" font-size="${fSize}px" text-anchor="middle" font-weight="900" font-family="Arial, sans-serif">${textNodes}</text>`,
    '</svg>'
  ].join('');
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(36, 48),
    anchor: new window.google.maps.Point(18, 48),
  };
};

export default function Map() {
  useTranslation();
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [legDirections, setLegDirections] = useState<Record<string, any>>({});
  // const [isHighlighting, setIsHighlighting] = useState(false);
  const [selectedPOI, setSelectedPOI] = useState<{placeId: string, latLng: google.maps.LatLng, name?: string} | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  
  const raw = useTravelStore();
  const places = raw.places ?? [];
  const days = raw.days ?? [];
  const { routeConfig, travelMode, customLegModes, currentDay, addPlace, updatePlace, dayTravelModes } = raw;

  const geocodedIds = useRef<Set<string>>(new Set());

  // useEffect for route trigger removed to fix reference error

  useEffect(() => {
    if (!isLoaded || !window.google || places.length === 0) return;
    const missingCoords = places.filter(p => p.name && (!p.lat || !p.lng) && !geocodedIds.current.has(p.id));
    if (missingCoords.length === 0) return;
    const geocoder = new window.google.maps.Geocoder();
    missingCoords.forEach(place => {
      geocodedIds.current.add(place.id);
      geocoder.geocode({ address: place.name }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const loc = results[0].geometry.location;
          updatePlace(place.id, { lat: loc.lat(), lng: loc.lng() });
        }
      });
    });
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => setCurrentLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
        (error) => console.warn("Geolocation fetch failed:", error),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
  }, [isLoaded, places]);

  const onLoad = useCallback((m: google.maps.Map) => setMap(m), []);
  const onUnmount = useCallback(() => setMap(null), []);
  const onMapClick = (e: google.maps.MapMouseEvent | google.maps.IconMouseEvent) => {
    if ('placeId' in e && e.placeId && map) {
      e.stop?.();
      const ps = new window.google.maps.places.PlacesService(map);
      ps.getDetails({ placeId: e.placeId, fields: ['name', 'geometry'] }, (place, status) => {
        if (status === 'OK' && place?.geometry?.location) {
          setSelectedPOI({ placeId: (e as any).placeId, latLng: place.geometry.location, name: place.name || '선택한 장소' });
        }
      });
    } else {
      setSelectedPOI(null);
    }
  };

  const handleLocateMe = () => {
    if (navigator.geolocation && map) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentLocation(loc);
          map.panTo(loc);
          map.setZoom(15);
        },
        () => alert("현재 위치를 가져올 수 없습니다. 권한을 확인해주세요."),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
  };

  useEffect(() => {
    if (!map || places.length === 0 || directions) return;
    const bounds = new window.google.maps.LatLngBounds();
    let hasValid = false;
    places.forEach(p => { if (p.lat && p.lng) { bounds.extend({ lat: p.lat, lng: p.lng }); hasValid = true; } });
    if (hasValid) map.fitBounds(bounds);
  }, [map, places, directions]);

  useEffect(() => {
    if (!map || !directions || !window.google) return;
    const bounds = new window.google.maps.LatLngBounds();
    directions.routes[0].overview_path.forEach(p => bounds.extend(p));
    map.fitBounds(bounds, 60);
  }, [map, directions]);

  useEffect(() => {
    setDirections(null);
    setLegDirections({});
  }, [currentDay]);

  useEffect(() => {
    let isCancelled = false;
    
    if (!map || !window.google || places.length < 2 || !routeConfig.active) {
      if (places.length < 2 || !routeConfig.active) {
        setDirections(null);
        setLegDirections({});
      }
      return;
    }

    const startRouteCalculation = async () => {
      console.log('[Map] Force GLOBAL recalculation for trigger:', routeConfig.trigger);
      setApiError(null);
      const ds = new window.google.maps.DirectionsService();

      const calculateSingleDay = async (targetDay: number, targetPlaces: any[]) => {
        const valid = targetPlaces.filter(p => (p.lat && p.lng) || p.googlePlaceId).slice(0, 15);
        if (valid.length < 2) return null;

        const currentDayMode = (targetDay === 0 ? travelMode : (dayTravelModes[targetDay] || travelMode));
        const isCustom = valid.some(p => p.travelModeToNext) || Object.keys(customLegModes).length > 0 || currentDayMode === 'TRANSIT';

        if (!isCustom) {
          try {
            const res = await new Promise<google.maps.DirectionsResult | null>((resolve) => {
              ds.route({
                origin: valid[0].googlePlaceId ? { placeId: valid[0].googlePlaceId } : { lat: valid[0].lat!, lng: valid[0].lng! },
                destination: valid[valid.length - 1].googlePlaceId ? { placeId: valid[valid.length - 1].googlePlaceId } : { lat: valid[valid.length - 1].lat!, lng: valid[valid.length - 1].lng! },
                waypoints: valid.slice(1, -1).map(p => ({ location: p.googlePlaceId ? { placeId: p.googlePlaceId } : { lat: p.lat!, lng: p.lng! }, stopover: true })),
                travelMode: window.google.maps.TravelMode[currentDayMode as keyof typeof google.maps.TravelMode] || window.google.maps.TravelMode.DRIVING 
              }, (result, status) => { resolve(status === 'OK' ? result : null); });
            });
            if (isCancelled || !res) return null;
            
            const route = res.routes[0];
            const legsData: any[] = [];
            
            route.legs.forEach((leg, i) => {
              const originPlace = valid[i];
              legsData.push({ distance: leg.distance?.text || '', duration: leg.duration?.text || '' });
              // Store per-leg path in global tracker
              newLegDirections[originPlace.id] = {
                decodedPath: leg.steps.flatMap(s => s.path),
                travelMode: currentDayMode
              };
            });
            return legsData;
          } catch (e) { return null; }
        } else {
          const dayLegs: any[] = Array.from({ length: valid.length - 1 }, () => ({ distance: '', duration: '' }));
          const legPromises = valid.slice(0, -1).map(async (origin, i) => {
            const dest = valid[i + 1];
            const mode = origin.travelModeToNext || customLegModes[origin.id] || currentDayMode;
            if (mode === 'TRANSIT') {
              try {
                const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
                  ds.route({ origin: origin.googlePlaceId ? { placeId: origin.googlePlaceId } : { lat: origin.lat!, lng: origin.lng! }, destination: dest.googlePlaceId ? { placeId: dest.googlePlaceId } : { lat: dest.lat!, lng: dest.lng! }, travelMode: google.maps.TravelMode.TRANSIT }, (res, status) => { if (status === 'OK' && res) resolve(res); else reject(status); });
                });
                const leg = result.routes[0].legs[0];
                let transitMode = '';
                for (const step of leg.steps) { if (step.transit) { transitMode = step.transit.line.vehicle.name; break; } }
                dayLegs[i] = { distance: leg.distance?.text || '', duration: transitMode ? `${leg.duration?.text} (${transitMode})` : leg.duration?.text || '' };
                newLegDirections[origin.id] = { decodedPath: result.routes[0].overview_path, travelMode: 'TRANSIT' };
              } catch (e) { dayLegs[i] = { distance: '', duration: '경로 확인' }; }
            } else {
              try {
                const r = await fetch('http://localhost:3005/api/directions', { 
                  method: 'POST', headers: { 'Content-Type': 'application/json' }, 
                  body: JSON.stringify({ origin: origin.googlePlaceId ? { placeId: origin.googlePlaceId } : { lat: origin.lat!, lng: origin.lng! }, destination: dest.googlePlaceId ? { placeId: dest.googlePlaceId } : { lat: dest.lat!, lng: dest.lng! }, travelMode: mode })
                });
                const d = await r.json();
                if (d.success) {
                  dayLegs[i] = { distance: d.distance, duration: d.duration };
                  newLegDirections[origin.id] = { decodedPath: window.google.maps.geometry.encoding.decodePath(d.polyline), travelMode: mode };
                }
              } catch (e) { dayLegs[i] = { distance: '', duration: '경로 확인' }; }
            }
          });
          await Promise.all(legPromises);
          return dayLegs;
        }
      };

      const newLegDirections: Record<string, any> = {};
      const allDayLegs: Record<number, any[]> = {};
      
      // Clear previous
      setDirections(null);
      setLegDirections({});

      for (const d of days) {
        if (isCancelled) break;
        const result = await calculateSingleDay(d.day, d.places);
        if (result) allDayLegs[d.day] = result;
      }
      
      if (!isCancelled) {
        console.log('[Map] Clean Sync Finished. Legs cached:', Object.keys(newLegDirections).length);
        raw.setAllDayRouteLegs(allDayLegs);
        setLegDirections(newLegDirections);
      }
    };

    startRouteCalculation();
    return () => { isCancelled = true; };
  }, [map, routeConfig.trigger, travelMode, customLegModes, currentDay, places, days]);

  if (loadError) return <div className="w-full h-full flex items-center justify-center text-red-500">Map Load Error: {loadError.message}</div>;
  if (!isLoaded) return <div className="w-full h-full flex items-center justify-center bg-gray-50">Loading Map...</div>;

  return (
    <div className="w-full h-full relative overflow-hidden rounded-2xl shadow-inner border border-gray-200">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={defaultCenter}
        zoom={14}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={onMapClick}
        options={{ disableDefaultUI: true, zoomControl: true, styles: [{ featureType: "poi", elementType: "labels.icon", stylers: [{ visibility: "off" }] }] }}
      >
        {currentDay > 0 && (() => {
          const color = getDayColor(currentDay);
          const groups: Record<string, any> = {};
          places.forEach((p, idx) => {
            if (!p.lat || !p.lng) return;
            const k = `${p.lat.toFixed(4)}_${p.lng.toFixed(4)}`;
            if (!groups[k]) groups[k] = { lat: p.lat, lng: p.lng, indices: [] };
            groups[k].indices.push(idx + 1);
          });
          return Object.values(groups).map((g:any, i) => (
            <Marker key={i} position={{ lat: g.lat, lng: g.lng }} icon={getMarkerIcon(color, g.indices.map((n:any)=>`${currentDay}-${n}`).join('\n'))} />
          ));
        })()}

        {currentDay === 0 && days.map(d => (
          <React.Fragment key={d.day}>
            {d.places.filter(p => p.lat && p.lng).map((p, idx) => (
              <Marker key={idx} position={{ lat: p.lat!, lng: p.lng! }} icon={getMarkerIcon(getDayColor(d.day), `${d.day}-${idx+1}`)} />
            ))}
          </React.Fragment>
        ))}

        {/* Global Render from legs cache */}
        {days.map(d => (
           <React.Fragment key={`legs-day-${d.day}`}>
              {d.places.slice(0, -1).map((p, i) => {
                const dest = d.places[i+1];
                if (!dest || !p.lat || !p.lng || !dest.lat || !dest.lng) return null;
                const res = legDirections[p.id];
                const dayColor = getDayColor(d.day);
                const mode = p.travelModeToNext || customLegModes[p.id] || (dayTravelModes[d.day] || travelMode);
                // const isAllDay = currentDay === 0;
                
                // Show only current day unless all-day mode
                if (currentDay !== 0 && d.day !== currentDay) return null;

                return (
                  <Polyline
                    key={p.id}
                    path={res?.decodedPath || [{ lat: p.lat, lng: p.lng }, { lat: dest.lat, lng: dest.lng }]}
                    options={{
                      strokeColor: dayColor,
                      strokeOpacity: res?.decodedPath ? 0.8 : 0.4,
                      strokeWeight: 4,
                      // If no road-following path, show a dashed line regardless of transport mode
                      icons: !res?.decodedPath ? [{ 
                        icon: { 
                          path: 'M 0,-1 0,1', 
                          strokeOpacity: 1, 
                          scale: 3, 
                          strokeColor: dayColor, 
                          strokeWeight: 3 
                        }, 
                        offset: '0', 
                        repeat: '15px' 
                      }] : []
                    }}
                  />
                );
              })}
           </React.Fragment>
        ))}

        {currentLocation && (
          <Marker position={currentLocation} icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#4285F4', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 }} />
        )}

        {selectedPOI && (
          <InfoWindow position={selectedPOI.latLng} onCloseClick={() => setSelectedPOI(null)}>
            <div className="flex flex-col gap-2 p-1 min-w-[200px]">
              <h3 className="font-bold text-gray-800 text-[13px] border-b pb-1.5">{selectedPOI.name}</h3>
              {currentDay > 0 ? (
                <button onClick={() => { addPlace({ id: `manual_${Date.now()}`, name: selectedPOI.name || '선택한 장소', lat: selectedPOI.latLng.lat(), lng: selectedPOI.latLng.lng() }); setSelectedPOI(null); }} className="bg-blue-600 text-white text-xs px-3 py-2 rounded-lg font-bold">
                  + 내 {currentDay}일차 코스에 담기
                </button>
              ) : <p className="text-xs text-red-500">Day 0(전체보기) 상태에서는 추가할 수 없습니다.</p>}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      <div className="absolute bottom-[104px] right-[10px] z-50">
        <button onClick={handleLocateMe} className="bg-white p-2.5 rounded-sm shadow w-10 h-10 flex items-center justify-center">
          <LocateFixed className="w-[18px] h-[18px] text-[#666]" />
        </button>
      </div>

      {apiError && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-600 text-white font-bold text-xs p-3 rounded shadow-xl z-50">
          ⚠️ Map API Error:<br/>{apiError}
        </div>
      )}
    </div>
  );
}
