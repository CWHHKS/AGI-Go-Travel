// frontend/src/api/tripApi.ts
// 백엔드 Express 서버를 통해 Trip/Place를 DB에 저장하고 불러오는 API 모듈

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3005';

export interface PlacePayload {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  memo?: string;
  travelModeToNext?: string;
  scheduledTime?: string;
}

export interface DayPayload {
  day: number;
  places: PlacePayload[];
}

export interface TripPayload {
  title: string;
  destination: string;
  startDate?: string;
  days: DayPayload[];
  dayStartTimes?: Record<number, string>;
  dayTravelModes?: Record<number, string>;
}

export interface TripResponse {
  id: string;
  title: string;
  destination: string;
  startDate?: string;
  shareToken: string;
  days: DayPayload[];
  dayStartTimes?: Record<number, string>;
  dayTravelModes?: Record<number, string>;
  createdAt: string;
  updatedAt: string;
}

/** 새 Trip 저장 */
export async function saveTrip(userId: string, data: TripPayload): Promise<TripResponse> {
  const res = await fetch(`${API_BASE}/api/trips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ...data }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '저장 실패');
  return json.data;
}

/** Trip 업데이트 */
export async function updateTrip(tripId: string, data: TripPayload): Promise<TripResponse> {
  const res = await fetch(`${API_BASE}/api/trips/${tripId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '업데이트 실패');
  return json.data;
}

/** 사용자의 Trip 목록 조회 */
export async function fetchMyTrips(userId: string): Promise<TripResponse[]> {
  const res = await fetch(`${API_BASE}/api/trips/user/${userId}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '목록 조회 실패');
  return json.data;
}

/** 공유 토큰으로 Trip 조회 (로그인 불필요) */
export async function fetchTripByToken(token: string): Promise<TripResponse> {
  const res = await fetch(`${API_BASE}/api/trips/share/${token}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '공유 일정을 찾을 수 없습니다.');
  return json.data;
}

/** Trip 삭제 */
export async function deleteTrip(tripId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/trips/${tripId}`, { method: 'DELETE' });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '삭제 실패');
}
