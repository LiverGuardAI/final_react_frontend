# 빌드 스테이지
FROM node:18-alpine as builder

WORKDIR /app

# package.json, package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci

# 소스 코드 복사
COPY . .

# 빌드
RUN npm run build

# 프로덕션 스테이지 (Nginx)
FROM nginx:alpine

# nginx 설정 복사
COPY nginx.conf /etc/nginx/nginx.conf

# 빌드 결과물을 nginx에 복사
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
