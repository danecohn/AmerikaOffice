FROM oven/bun:1.4.3
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile && bun run build && mkdir -p /data && chown -R bun:bun /data
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
USER root
EXPOSE 3000
CMD ["bun", "run", "start"]
