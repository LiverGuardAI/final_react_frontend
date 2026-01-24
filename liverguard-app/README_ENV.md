# 환경 변수 설정 가이드

React 앱은 Vite를 사용하며, 환경에 따라 다른 API URL을 사용합니다.

## 환경 변수 파일

### `.env.development` (개발 환경)
```env
VITE_API_BASE_URL=http://localhost:8000/api/
VITE_ORTHANC_URL=http://localhost:8042
```

**사용 시기**: `npm run dev` 실행 시 자동으로 로드됩니다.

### `.env.production` (프로덕션 환경)
```env
```

**사용 시기**: `npm run build` 실행 시 자동으로 로드됩니다.

## 환경 변수 사용법

### TypeScript/React 코드에서
```typescript
// 환경 변수 읽기
const apiUrl = import.meta.env.VITE_API_BASE_URL;
const orthancUrl = import.meta.env.VITE_ORTHANC_URL;

// 예시: axios 설정
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/',
});
```

## 환경별 실행 방법

### 개발 환경
```bash
npm run dev
# .env.development 파일의 변수가 자동으로 로드됨
# API URL: http://localhost:8000/api/
```

### 프로덕션 빌드
```bash
npm run build
# .env.production 파일의 변수가 자동으로 로드됨
```

### 프로덕션 프리뷰 (로컬 테스트)
```bash
npm run build
npm run preview
# 빌드된 프로덕션 버전을 로컬에서 테스트
```

## Docker 빌드 시 환경 변수 오버라이드

Docker에서 빌드 시 ARG로 환경 변수를 전달할 수 있습니다:

```bash
docker build \
  --build-arg VITE_API_BASE_URL=http://your-server/api \
  --build-arg VITE_ORTHANC_URL=http://your-server/orthanc \
  -t liverguard-react .
```

## 주의사항

### 1. 환경 변수 접두사
Vite에서는 클라이언트에 노출되는 환경 변수는 반드시 `VITE_` 접두사로 시작해야 합니다.

❌ 잘못된 예:
```env
API_BASE_URL=http://localhost:8000
```

✅ 올바른 예:
```env
VITE_API_BASE_URL=http://localhost:8000
```

### 2. 빌드 시점 주입
환경 변수는 **빌드 시점**에 코드에 주입됩니다. 런타임에 변경되지 않습니다.

### 3. 민감 정보 주의
클라이언트 코드에 포함되므로 API 키나 비밀번호는 절대 넣지 마세요!

### 4. .gitignore
실제 환경 변수가 담긴 `.env` 파일은 Git에 커밋하지 마세요:
```gitignore
.env
.env.local
.env.*.local
```

템플릿 파일만 커밋하세요:
```
.env.example       ✅ 커밋
.env.development   ✅ 커밋 (기본값만)
.env.production    ✅ 커밋 (기본값만)
```

## 트러블슈팅

### 환경 변수가 적용되지 않을 때

1. **개발 서버 재시작**
   ```bash
   # Ctrl+C로 종료 후
   npm run dev
   ```

2. **환경 변수 확인**
   ```typescript
   console.log('API URL:', import.meta.env.VITE_API_BASE_URL);
   ```

3. **빌드 캐시 삭제**
   ```bash
   rm -rf dist node_modules/.vite
   npm run build
   ```

### CORS 에러가 발생할 때

Django 설정에서 React 도메인을 허용했는지 확인:

```python
# settings.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Vite 개발 서버
    "http://localhost:3000",  # 프로덕션 포트
]
```