import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useTravelStore } from '../store/travelStore';
import type { TripResponse } from '../api/tripApi';
import { fetchTripByToken } from '../api/tripApi';

/**
 * useRealtimeSync
 * - Owner가 편집한 Trip/Place 변경사항을 Supabase Postgres Changes 채널로 수신
 * - 같은 shareToken URL을 열고 있는 Viewer들의 화면을 실시간으로 갱신
 * - tripId가 없으면 아무것도 하지 않음
 */
export function useRealtimeSync() {
  const { currentTripId, shareToken, loadTripFromDB } = useTravelStore();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isFirstMount = useRef(true);

  useEffect(() => {
    // DB에 저장된 여행이 없으면 Realtime 구독 불필요
    if (!currentTripId || !shareToken) return;

    // 이전 채널이 있으면 정리
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = `trip-${currentTripId}`;

    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT | UPDATE | DELETE
          schema: 'public',
          table: 'Place',
          filter: `tripId=eq.${currentTripId}`,
        },
        async () => {
          // 최초 마운트 시 자기 자신의 save 이벤트를 무시
          if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
          }
          // Place 테이블 변경 감지 → 최신 Trip 전체를 다시 불러와 스토어 갱신
          try {
            const updated: TripResponse = await fetchTripByToken(shareToken);
            loadTripFromDB(updated);
            console.log('[Realtime] 일정이 실시간 업데이트되었습니다.');
          } catch (e) {
            console.warn('[Realtime] 업데이트 가져오기 실패:', e);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Trip',
          filter: `id=eq.${currentTripId}`,
        },
        async () => {
          if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
          }
          try {
            const updated: TripResponse = await fetchTripByToken(shareToken);
            loadTripFromDB(updated);
          } catch (e) {
            console.warn('[Realtime] Trip 업데이트 가져오기 실패:', e);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] 채널 구독 시작: ${channelName}`);
        }
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [currentTripId, shareToken]);
}
