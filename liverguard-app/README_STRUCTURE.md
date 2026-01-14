# 프로젝트 구조 설명

## 📁 디렉토리 구조

### `src/hooks/`
재사용 가능한 Custom Hooks

- `useWebSocket.ts` - WebSocket 연결 관리 (자동 재연결 포함)
- `useWaitingQueue.ts` - 대기열 데이터 조회
- `useDashboardStats.ts` - 대시보드 통계 데이터
- `useDoctors.ts` - 의사 목록 조회
- `usePatients.ts` - 환자 목록 조회

### `src/components/administration/`
원무과 페이지 관련 재사용 컴포넌트

- `Sidebar.tsx` - 사이드바 (프로필, 대기 현황, 통계, 네비게이션)
- `CheckinModal.tsx` - 현장 접수 모달
- `PatientSearchPanel.tsx` - 환자 검색/목록 테이블
- `PatientRegistrationForm.tsx` - 신규 환자 등록 폼
- `PatientDetailModal.tsx` - 환자 상세 정보 모달
- `WaitingQueue.tsx` - 대기열 실시간 표시

### `src/context/`
전역 상태 관리

- `AuthContext.tsx` - 인증 관련 전역 상태
- `WebSocketContext.tsx` - WebSocket 연결 공유 (선택적 사용)

### `src/pages/administration/`
원무과 페이지들

- `HomePage.tsx` - 메인 대시보드 (~1066줄)
- `SchedulePage.tsx` - 일정 관리
- `PatientManagementPage.tsx` - 환자 관리
- `QuestionnaireFormPage.tsx` - 문진표

### `src/api/`
API 호출 함수들

- `administrationApi.ts` - 원무과 API (환자 등록, 조회 등)
- `administration_api.ts` - 원무과 API (대기열, 접수 등)

## 🎯 리팩토링 결과

| 항목 | Before | After | 개선 |
|------|--------|-------|------|
| HomePage.tsx | 1414줄 | 1066줄 | -348줄 (25% 감소) |
| Custom Hooks | 0개 | 5개 | 재사용성 ⬆️ |
| 컴포넌트 | 1개 | 6개 | 유지보수성 ⬆️ |
| WebSocket 중복 | 2곳 | 1개 Hook | 중복 제거 |

## ✅ 개선 사항

1. **코드 분리** - 큰 파일을 작은 컴포넌트로 분리
2. **재사용성** - Custom Hooks로 로직 재사용
3. **가독성** - 각 컴포넌트의 책임 명확화
4. **유지보수** - 수정이 필요한 부분 쉽게 찾기
5. **TypeScript** - 타입 안정성 향상
