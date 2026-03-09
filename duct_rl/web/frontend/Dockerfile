FROM node:20-slim

WORKDIR /app/duct_rl/web/frontend

# Copy package files and install deps
COPY duct_rl/web/frontend/package.json duct_rl/web/frontend/package-lock.json* ./
RUN npm install

# Copy frontend source
COPY duct_rl/web/frontend/ .

# Copy pre-built WASM pkg (already committed to repo)
COPY duct_rl/web/crate/pkg/ /app/duct_rl/web/crate/pkg/

EXPOSE 3000

CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "3000"]
