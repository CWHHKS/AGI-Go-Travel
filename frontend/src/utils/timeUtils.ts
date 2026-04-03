import type { Place } from '../store/travelStore';

export interface TimeInterval {
  arrival: string; // HH:mm format
  departure: string; // HH:mm format
}

/**
 * 시간(분)을 "HH:mm" 포맷으로 변환 (자정 넘어가면 24+ 로 되거나 단순 모듈로 처리)
 */
export function formatMinutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const mins = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * "HH:mm" 포맷을 시간(분)으로 변환
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 9 * 60; // 기본 09:00
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * 한글/영어 체류 및 이동 시간 문자열을 파싱하여 Number(분)로 반환
 * 예: "약 1시간 30분" -> 90, "45 mins" -> 45
 */
export function parseDurationToMinutes(durationText?: string): number {
  if (!durationText) return 0;
  let text = durationText.toLowerCase();
  
  // 만약 아예 구글 API 형식의 "X mins", "X hours Y mins" 인경우
  let totalMinutes = 0;
  
  // 한글 시간 파싱
  const hourMatchKor = text.match(/([0-9.]+)\s*(시간|hour)/);
  const minMatchKor = text.match(/([0-9.]+)\s*(분|min)/);
  
  if (hourMatchKor) {
    totalMinutes += parseFloat(hourMatchKor[1]) * 60;
  }
  if (minMatchKor) {
    totalMinutes += parseFloat(minMatchKor[1]);
  }
  
  // 혹시라도 아무 매칭도 안된 경우 (예: "30" 이라고 숫자만 적힌 경우)
  if (totalMinutes === 0) {
    const rawNumber = parseInt(text.replace(/[^0-9]/g, ''));
    if (!isNaN(rawNumber) && rawNumber < 300) { // 너무 큰숫자 방지 (예: 거리 130km 등 잘못 파싱된경우 방지)
       return rawNumber;
    }
    // 그래도 모르겠으면 기본 60분
    return 60;
  }
  
  return totalMinutes;
}

/**
 * 특정 일자의 장소들과 이동거리 정보를 바탕으로 각 마커의 도착/출발 시간을 계산
 * scheduledTime이 있는 경우 이를 우선적으로 사용합니다.
 */
export function calculateTimeline(
  places: Place[],
  routeLegs: Array<{ distance: string, duration: string }>,
  startTime: string = "09:00"
): TimeInterval[] {
  const intervals: TimeInterval[] = [];
  let currentMinutes = parseTimeToMinutes(startTime);

  places.forEach((place, index) => {
    // scheduledTime이 수동으로 설정되어 있다면 해당 시간을 사용
    if (place.scheduledTime) {
      currentMinutes = parseTimeToMinutes(place.scheduledTime);
    }

    // 1. 도착 시간 기록
    const arrivalTime = formatMinutesToTime(currentMinutes);
    
    // 2. 체류 시간 (UI에서는 제거되었으나 로직 유지를 위해 최소 30분 또는 데이터 사용)
    const stayMinutes = place.durationMinutes !== undefined 
      ? place.durationMinutes 
      : 30; // 기본 30분 점유
      
    currentMinutes += stayMinutes;
    
    // 3. 출발 시간 기록
    const departureTime = formatMinutesToTime(currentMinutes);
    intervals.push({ arrival: arrivalTime, departure: departureTime });
    
    // 4. 다음 장소로의 이동 시간 더해줌
    if (index < places.length - 1) {
      const leg = routeLegs[index];
      const travelMins = leg && leg.duration ? parseDurationToMinutes(leg.duration) : 15;
      currentMinutes += travelMins;
    }
  });

  return intervals;
}

/**
 * 시간을 세로 픽셀 오프셋으로 변환 (15분 단위 그리드 지원)
 */
export function getPixelOffsetFromTime(timeStr: string, dayStartTime: string, slotHeight: number = 20): number {
  const startMins = parseTimeToMinutes(dayStartTime);
  const currentMins = parseTimeToMinutes(timeStr);
  const diff = currentMins - startMins;
  // 15분당 1개 슬롯(slotHeight)
  return Math.max(0, (diff / 15) * slotHeight);
}

/**
 * 픽셀 오프셋을 시간 문자열로 변환
 */
export function getTimeFromPixelOffset(offset: number, dayStartTime: string, slotHeight: number = 20): string {
  const startMins = parseTimeToMinutes(dayStartTime);
  const diffMins = Math.round(offset / slotHeight) * 15;
  return formatMinutesToTime(startMins + diffMins);
}

/**
 * 두 장소 사이의 이동 시간이 부족한지 판단 (빨간 선 경고용)
 */
export function isTimeInsufficient(startTimeStr: string, travelMins: number, nextStartTimeStr: string): boolean {
  if (!startTimeStr || !nextStartTimeStr) return false;
  const currentStart = parseTimeToMinutes(startTimeStr);
  const nextStart = parseTimeToMinutes(nextStartTimeStr);
  
  // 현재 장소에서 최소 15분은 머문다고 가정 + 이동시간
  const minStay = 15; 
  return (currentStart + minStay + travelMins) > nextStart;
}
