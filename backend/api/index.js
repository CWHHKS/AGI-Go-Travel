require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const app = express();
app.use(cors());
// ✅ 기본 100KB → 10MB로 확장 (21일치 여행 데이터 등 대용량 저장 지원)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize AI Clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy' });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy');
const prisma = new PrismaClient();

// ─────────────────────────────────────────────
// AI API Routes
// ─────────────────────────────────────────────

app.post('/api/generate', async (req, res) => {
  const { destination, duration, companion, budget, theme, transport, accommodation, accommodationBudget, extraPrompt, language } = req.body;
  
  try {
    const systemPrompt = `당신은 세계 최고의 AI 여행 플래너입니다. 사용자의 파라미터에 맞춰 최적의 여행 일정을 JSON 형태로 작성해주세요. 

★ 절대 지켜야 할 강력한 규칙 ★:
1. 모든 장소 명칭('name')은 구글 맵 검색 시 오차가 없도록 반드시 '정확한 장소명 (영문/현지명), 도시명, 국가명' 형식을 엄격히 준수하세요.
2. [숙소 필수 포함 규칙]: "숙박/숙소" 정보가 주어졌다면, **모든 일자(Day)의 시작(첫 번째 장소) 또는 끝(마지막 장소)**에 해당 숙소를 반드시 동일한 이름으로 포함시키세요. 숙소 명칭이 구체적으로 없다면 목적지에 맞는 적절한 숙소를 추천해서 동일하게 매일 포함하세요.
3. [좌표 필수]: 모든 장소(특히 숙소 포함)는 반드시 실제 'lat' (위도), 'lng' (경도) 값을 float 형태로 포함해야 합니다. 절대로 0이나 null을 주지 마세요.
4. [이동 정보 필수]: **모든 장소(모든 날짜의 첫 번째 장소 제외)**에 대해, 이전 장소부터 본 장소까지의 **가장 빠른 대중교통** 이동 정보('travelTime', 'travelMode')를 반드시 포함하세요. 
   - travelTime: 정수(분 단위). 이전 장소에서의 소요 시간.
   - travelMode: 이동 수단 명칭 (예: '지하철', '버스', '버스-지하철'). 도보는 별도로 적지 마세요.
5. JSON 응답 포맷: { "title": "여행 제목", "days": [ { "day": 1, "places": [ { "id": "uuid", "name": "장소명", "lat": 51.520, "lng": -0.124, "travelTime": 25, "travelMode": "지하철" } ] } ] }
*주의*: 기간에 맞게 1일차, 2일차.. 일정을 나누어 days 배열에 담아주세요.`;
    const userPrompt = `목적지: ${destination}, 기간: ${duration}, 동행: ${companion}, 예산: ${budget}, 테마: ${theme}, 이동수단: ${transport}, 숙박: ${accommodation} (1박 ${accommodationBudget || '제한없음'}), 추가요청: ${extraPrompt}`;

    const langInstruction = language && language.startsWith('en') ? '\n[IMPORTANT: You MUST write EVERYTHING entirely in English!]' : '';
    const finalSystemPrompt = systemPrompt + langInstruction;

    const openaiResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: finalSystemPrompt },
        { role: "user", content: userPrompt }
      ]
    });
    
    let draftItinerary;
    try {
      console.log(`[AI Generate Response]`, openaiResponse.choices[0].message.content);
      draftItinerary = JSON.parse(openaiResponse.choices[0].message.content);
      if (!draftItinerary.days && draftItinerary.places) {
        draftItinerary.days = [{ day: 1, places: draftItinerary.places }];
      }
    } catch(e) {
      draftItinerary = { title: `${destination} 여행`, days: [] };
    }
    
    res.json({ success: true, data: draftItinerary });
  } catch (error) {
    console.error('AI Generation Error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate itinerary. Check API Keys or quotas.' });
  }
});

app.post('/api/chat-plan', async (req, res) => {
  const { tripDetails, currentDay, totalDays, chatHistory, language } = req.body;
  const { destination, companion, budget, theme, transport, accommodation, accommodationBudget, extraPrompt } = tripDetails || {};
  
  try {
    const systemPrompt = `당신은 세계 최고의 친근한 AI 여행 플래너입니다. 사용자와 대화하며 예산/동행/테마에 맞춰 전체 ${totalDays}일의 일정 중 현재 **${currentDay}일차** 코스만을 기획하거나 피드백을 반영해 수정해주어야 합니다.
방식:
1. 모든 장소 명칭("name")은 구글 맵 검색 오차를 줄이기 위해 반드시 '장소명 (영문/현지명), 도시명, 국가명' 형식을 사용하세요. (예: '한강 시장 (Han Market), Da Nang, Vietnam')
2. 사용자의 피드백을 반영하여 [${currentDay}일차]의 코스 제안이나 수정 결과를, 마치 카카오톡처럼 친절하고 세련된 한국어로 "message" 필드에 작성하세요. (줄바꿈 가능, 각 장소의 핵심 멘토링 포함)
3. 당신이 기획/수정한 ${currentDay}일차의 장소 목록을 "places" 리스트에 담으세요.
4. [숙소 강제]: 숙박/숙소 정보가 있다면, 해당 코스의 첫 번째나 마지막 장소로 숙소를 **반드시** 추가하세요.
5. 모든 장소(특히 집중적으로 추가된 숙소)는 절대로 누락 없이 실제 'lat' (위도), 'lng' (경도) 값을 float 형태로 완벽히 제공해야 합니다.
6. [이동 정보 필수]: 모든 장소 객체에 'travelTime'(이전 장소에서의 소요시간, 숫자)과 'travelMode'(수단명, 문자열) 필드를 **반드시** 포함하세요. (예: "travelTime": 15, "travelMode": "지하철"). 첫 번째 장소는 0과 빈 문자열로 채우세요.
7. JSON 포맷을 절대로 깨뜨리지 마세요. 필드명을 임의로 수정하지 마세요.

*응답 포맷 규칙*:
{
  "message": "안녕하세요! 파리 1일차는 이런 코스가 어떨까요? 먼저 루브르에 갔다가...",
  "places": [
    { "id": "고유식별문자열", "name": "장소명", "lat": 48.8606, "lng": 2.3376, "travelTime": 20, "travelMode": "버스-지하철" }
  ]
}`;

    const initialContext = `나의 여행 기본 정보 - 목적지: ${destination}, 동행: ${companion}, 예산: ${budget}, 테마: ${theme}, 이동수단: ${transport}, 숙박: ${accommodation} (${accommodationBudget}), 추가요청: ${extraPrompt}`;

    const langInstruction = language && language.startsWith('en') ? '\n[IMPORTANT: You MUST write EVERYTHING entirely in English!]' : '';
    const finalSystemPrompt = systemPrompt + langInstruction;

    const messages = [
      { role: "system", content: finalSystemPrompt },
      { role: "user", content: initialContext }
    ];

    if (chatHistory && chatHistory.length > 0) {
      messages.push(...chatHistory);
    }

    const openaiResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: messages
    });
    
    let aiResponse;
    try {
      console.log('[AI Plan Response]', openaiResponse.choices[0].message.content);
      aiResponse = JSON.parse(openaiResponse.choices[0].message.content);
      if (!aiResponse.places) aiResponse.places = [];
      if (!aiResponse.message) aiResponse.message = "일정을 짰으나 메시지 생성에 실패했습니다.";
    } catch(e) {
      aiResponse = { message: "답변 파싱에 실패했습니다. 다시 시도해 주세요.", places: [] };
    }
    
    res.json({ success: true, data: aiResponse });
  } catch (error) {
    console.error('Chat Generation Error:', error);
    res.status(500).json({ success: false, error: 'Failed to chat target plan. Check API Keys.' });
  }
});

app.post('/api/chat-edit', async (req, res) => {
  const { currentDay, existingData, chatHistory, language } = req.body;
  
  try {
    const isGlobal = currentDay === 0;
    const modeName = isGlobal ? "여행 전체 일정" : `${currentDay}일차`;
    
    const systemPrompt = `당신은 세계 최고의 친근한 AI 여행 플래너입니다. 사용자가 **${modeName}**의 수정을 요청했습니다.
방식:
1. 모든 장소 명칭("name")은 구글 맵 검색 오차를 줄이기 위해 반드시 '장소명 (영문/현지명), 도시명, 국가명' 형식을 사용하세요.
2. 사용자의 피드백을 어떻게 반영했는지 카카오톡처럼 친절하고 세련된 한국어로 "message" 필드에 작성하세요.
3. ${isGlobal ? '전체 일정(모든 Day)을 수정하여 "days" 리스트에 일자별로 담으세요.' : `수정한 새로운 ${currentDay}일차의 전체 장소 목록을 "places" 리스트에 담으세요.`}
4. 모든 장소는 반드시 실제 'lat' (위도), 'lng' (경도) 값을 float 형태로 완벽히 가져야 합니다.
5. 이동 정보('travelTime': 숫자/분, 'travelMode': 수단명)를 반드시 포함하세요.
6. JSON 포맷을 절대로 깨뜨리지 마세요.

*사전 정보*:
현재 ${modeName} 데이터(JSON):
${JSON.stringify(existingData)}

*응답 포맷 규칙*:
{
  "message": "요청하신 대로 루브르 대신 근처 몽마르뜨 언덕을 추가해 보았습니다! 어떠신가요?",
  ${isGlobal ? '"days": [ { "day": 1, "places": [...] }, { "day": 2, "places": [...] } ]' : '"places": [ { "id": "랜덤식별자", "name": "장소명", "lat": 48.8606, "lng": 2.3376, "travelTime": 10, "travelMode": "지하철" } ]'}
}`;

    const langInstruction = language && language.startsWith('en') ? '\n[IMPORTANT: You MUST write EVERYTHING entirely in English!]' : '';
    const finalSystemPrompt = systemPrompt + langInstruction;

    const messages = [
      { role: "system", content: finalSystemPrompt }
    ];

    if (chatHistory && chatHistory.length > 0) {
      messages.push(...chatHistory);
    }

    const openaiResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: messages
    });
    
    let aiResponse;
    try {
      console.log('[AI Edit Response]', openaiResponse.choices[0].message.content);
      aiResponse = JSON.parse(openaiResponse.choices[0].message.content);
      if (!aiResponse.places) aiResponse.places = existingPlaces;
      if (!aiResponse.message) aiResponse.message = "수정 처리에 실패했습니다.";
    } catch(e) {
      aiResponse = { message: "답변 파싱에 실패했습니다. 다시 시도해 주세요.", places: existingPlaces };
    }
    
    res.json({ success: true, data: aiResponse });
  } catch (error) {
    console.error('Chat Edit Error:', error);
    res.status(500).json({ success: false, error: 'Failed to edit plan. Check API Keys.' });
  }
});

// ─────────────────────────────────────────────
// Google Maps Routes API Proxy (v2)
// ─────────────────────────────────────────────

app.post('/api/directions', async (req, res) => {
  const { origin, destination, travelMode, departureTime } = req.body;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!origin || !destination) {
    return res.status(400).json({ success: false, error: 'Origin and Destination are required' });
  }

  try {
    const requestBody = {
      origin: _formatLocation(origin),
      destination: _formatLocation(destination),
      travelMode: travelMode === 'DRIVING' ? 'DRIVE' : (travelMode === 'WALKING' ? 'WALK' : travelMode),
      computeAlternativeRoutes: false,
      units: 'METRIC',
      languageCode: 'ko-KR'
    };

    if (requestBody.travelMode === 'DRIVE') {
      requestBody.routingPreference = 'TRAFFIC_AWARE';
    }

    if (travelMode === 'TRANSIT') {
      requestBody.transitPreferences = {
        routingPreference: 'FEWER_TRANSFERS'
      };
      if (departureTime) {
        requestBody.departureTime = departureTime;
      }
    }

    try {
      const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps'
        },
        body: JSON.stringify(requestBody)
      });

      let data = await response.json();
      console.log('--- Google Routes API Raw Response ---');
      console.log(JSON.stringify(data, null, 2));

      // Transit 실패 시 로그 상세히 남기기
      if ((!data.routes || data.routes.length === 0) && travelMode === 'TRANSIT') {
        console.warn('TRANSIT Route Not Found. Status Check...');
        // 폴백은 유지하되 로그로 구분
      }

      if (!data.routes || data.routes.length === 0) {
        return res.json({ success: true, routes: [], message: 'No route found' });
      }

      const route = data.routes[0];
      const durationSeconds = parseInt(route.duration.replace('s', ''));
      const distanceMeters = route.distanceMeters;

      // Extract Transit Mode if available (look for the longest transit step)
      let transitModeStr = '';
      if (travelMode === 'TRANSIT' && route.legs && route.legs[0].steps) {
        transitModeStr = _extractPrimaryTransitMode(route.legs[0].steps);
      }

      const durationText = _secondsToDurationText(durationSeconds);
      const finalDuration = transitModeStr ? `${durationText} (${transitModeStr})` : durationText;

      const result = {
        success: true,
        duration: finalDuration,
        distance: _metersToDistanceText(distanceMeters),
        polyline: route.polyline.encodedPolyline,
        rawDuration: durationSeconds
      };

      res.json(result);
    } catch (error) {
      console.error('Routes API Error:', error);
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  } catch (error) {
    console.error('Proxy Directions Error:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error during directions fetch' });
  }
});

// Helper for Routes API location format
function _formatLocation(loc) {
  if (loc.placeId) return { placeId: loc.placeId };
  if (loc.googlePlaceId) return { placeId: loc.googlePlaceId };
  if (loc.lat && loc.lng) return { location: { latLng: { latitude: loc.lat, longitude: loc.lng } } };
  return loc;
}

function _secondsToDurationText(sec) {
  const hrs = Math.floor(sec / 3600);
  const mins = Math.round((sec % 3600) / 60);
  if (hrs > 0) return `${hrs}시간 ${mins}분`;
  return `${mins}분`;
}

function _metersToDistanceText(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(1)}km`;
  return `${m}m`;
}

function _extractPrimaryTransitMode(steps) {
  const modeMap = {
    'SUBWAY': '지하철',
    'BUS': '버스',
    'TRAIN': '기차',
    'TRAM': '트램',
    'FERRY': '페리',
    'LIGHT_RAIL': '지상철',
    'LONG_DISTANCE_TRAIN': '기차',
    'METRO_RAIL': '지하철',
    'COMMUTER_TRAIN': '전철'
  };

  let primaryMode = '';
  let maxDuration = 0;

  for (const step of steps) {
    if (step.transitDetails && step.transitDetails.transitLine) {
      const vehicleType = step.transitDetails.transitLine.vehicle?.type;
      const stepDuration = parseInt(step.staticDuration?.replace('s', '') || '0');
      
      if (stepDuration >= maxDuration && vehicleType) {
        maxDuration = stepDuration;
        primaryMode = modeMap[vehicleType] || '대중교통';
      }
    }
  }

  return primaryMode;
}

// ─────────────────────────────────────────────
// Trip DB Routes (Supabase/Prisma)
// ─────────────────────────────────────────────

/** POST /api/trips — 새 Trip 생성 및 Day/Place 중첩 저장 */
app.post('/api/trips', async (req, res) => {
  const { userId, title, destination, startDate, days, dayStartTimes, dayTravelModes } = req.body;
  if (!userId || !title || !destination) {
    return res.status(400).json({ success: false, error: '필수 필드 누락: userId, title, destination' });
  }

  try {
    // 1. 유저 존재 확인/생성
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email: `user_${userId}@agigotravel.app`, role: 'PERSONAL' },
    });

    const shareToken = randomUUID();
    const parsedStart = startDate ? new Date(startDate) : new Date();

    // 2. Trip -> Day -> Place 중첩 생성 (Nested Write)
    const trip = await prisma.trip.create({
      data: {
        title,
        destination,
        startDate: parsedStart,
        ownerId: userId,
        shareToken,
        days: {
          create: (days || []).map((d) => ({
            dayNumber: d.day,
            startTime: dayStartTimes?.[d.day] || '09:00',
            travelMode: dayTravelModes?.[d.day] || 'DRIVING',
            places: {
              create: (d.places || []).map((p, idx) => ({
                name: p.name,
                lat: p.lat ?? 0,
                lng: p.lng ?? 0,
                googlePlaceId: p.id || null,
                orderIndex: idx,
                durationMins: p.durationMinutes ?? 60,
                scheduledTime: p.scheduledTime || null,
                travelTimeToNext: p.travelTime ? parseInt(p.travelTime) : null,
                travelModeToNext: p.travelMode || null,
              })),
            },
          })),
        },
      },
      include: {
        days: {
          include: { places: { orderBy: { orderIndex: 'asc' } } },
          orderBy: { dayNumber: 'asc' },
        },
      },
    });

    res.json({ success: true, data: _formatTripResponse(trip) });
  } catch (error) {
    console.error('Save Trip Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/** PUT /api/trips/:tripId — 전체 일정 데이터 덮어쓰기 */
app.put('/api/trips/:tripId', async (req, res) => {
  const { tripId } = req.params;
  const { title, destination, startDate, days, dayStartTimes, dayTravelModes } = req.body;

  try {
    // 기존 Days 삭제 (Cascading Delete로 Places도 자동 삭제됨)
    await prisma.day.deleteMany({ where: { tripId } });

    const parsedStart = startDate ? new Date(startDate) : new Date();

    // Trip 정보 업데이트 및 새로운 Days/Places 생성
    const trip = await prisma.trip.update({
      where: { id: tripId },
      data: {
        title,
        destination,
        startDate: parsedStart,
        days: {
          create: (days || []).map((d) => ({
            dayNumber: d.day,
            startTime: dayStartTimes?.[d.day] || '09:00',
            travelMode: dayTravelModes?.[d.day] || 'DRIVING',
            places: {
              create: (d.places || []).map((p, idx) => ({
                name: p.name,
                lat: p.lat ?? 0,
                lng: p.lng ?? 0,
                googlePlaceId: p.id || null,
                orderIndex: idx,
                durationMins: p.durationMinutes ?? 60,
                scheduledTime: p.scheduledTime || null,
                travelTimeToNext: p.travelTime ? parseInt(p.travelTime) : null,
                travelModeToNext: p.travelMode || null,
              })),
            },
          })),
        },
      },
      include: {
        days: {
          include: { places: { orderBy: { orderIndex: 'asc' } } },
          orderBy: { dayNumber: 'asc' },
        },
      },
    });

    res.json({ success: true, data: _formatTripResponse(trip) });
  } catch (error) {
    console.error('Update Trip Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/** GET /api/trips/user/:userId — 사용자의 Trip 목록 */
app.get('/api/trips/user/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const trips = await prisma.trip.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        days: {
          include: { places: { orderBy: { orderIndex: 'asc' } } },
          orderBy: { dayNumber: 'asc' },
        },
      },
    });
    res.json({ success: true, data: trips.map(t => _formatTripResponse(t)) });
  } catch (error) {
    console.error('Fetch User Trips Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/** GET /api/trips/share/:token — 공유 토큰으로 Trip 조회 */
app.get('/api/trips/share/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const trip = await prisma.trip.findUnique({
      where: { shareToken: token },
      include: {
        days: {
          include: { places: { orderBy: { orderIndex: 'asc' } } },
          orderBy: { dayNumber: 'asc' },
        },
      },
    });
    if (!trip) return res.status(404).json({ success: false, error: '일정을 찾을 수 없습니다.' });
    res.json({ success: true, data: _formatTripResponse(trip) });
  } catch (error) {
    console.error('Fetch Shared Trip Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/** DELETE /api/trips/:tripId */
app.delete('/api/trips/:tripId', async (req, res) => {
  const { tripId } = req.params;
  try {
    await prisma.trip.delete({ where: { id: tripId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete Trip Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Helper: DB Trip 데이터 -> 프론트엔드 형식 변환 */
function _formatTripResponse(trip) {
  if (!trip) return null;

  const dayStartTimes = {};
  const dayTravelModes = {};
  const formattedDays = (trip.days || []).map(d => {
    dayStartTimes[d.dayNumber] = d.startTime || '09:00';
    dayTravelModes[d.dayNumber] = d.travelMode || 'DRIVING';

    return {
      day: d.dayNumber,
      places: (d.places || []).map(p => ({
        id: p.googlePlaceId || p.id,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        durationMinutes: p.durationMins,
        scheduledTime: p.scheduledTime || undefined,
        travelTime: p.travelTimeToNext ? String(p.travelTimeToNext) : '',
        travelMode: p.travelModeToNext || '',
        travelModeToNextName: p.travelModeToNext || '',
      }))
    };
  });

  return {
    id: trip.id,
    title: trip.title,
    destination: trip.destination,
    startDate: trip.startDate?.toISOString().split('T')[0],
    shareToken: trip.shareToken,
    days: formattedDays,
    dayStartTimes,
    dayTravelModes,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
  };
}

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`Backend Server running on http://localhost:${PORT}`);
});

module.exports = app;
