/** Day별 고유 색상 팔레트 (Map, Timeline 공유) */
export const DAY_COLORS = [
  '#3b82f6', // Day 1: 파랑
  '#10b981', // Day 2: 초록
  '#f59e0b', // Day 3: 주황
  '#8b5cf6', // Day 4: 보라
  '#ec4899', // Day 5: 핑크
  '#06b6d4', // Day 6: 시안
  '#f97316', // Day 7: 오렌지
  '#84cc16', // Day 8+: 라임
];

/** Day 번호로 색상 반환 (8개 초과 시 순환) */
export const getDayColor = (day: number): string =>
  DAY_COLORS[(Math.max(day, 1) - 1) % DAY_COLORS.length];

/** 특정 Day의 누적 시작 인덱스 계산
 *  예: Day1=4개, Day2=5개 → Day3의 startIndex = 9
 */
export const getDayStartIndex = (
  days: { day: number; places: { id: string }[] }[],
  targetDay: number
): number => {
  let count = 0;
  for (const d of days) {
    if (d.day >= targetDay) break;
    count += d.places.length;
  }
  return count;
};
