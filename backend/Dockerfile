FROM node:20-alpine

RUN apk add --no-cache python3 py3-pip ffmpeg && \
    pip3 install --no-cache-dir --break-system-packages yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/

ENV PORT=3001
ENV YT_DLP_PATH=yt-dlp
ENV CACHE_DIR=/app/cache

RUN mkdir -p /app/cache

EXPOSE 3001

CMD ["node", "src/index.js"]