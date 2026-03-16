# ── Stage 1: Install dependencies ──
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

COPY package.json pnpm-lock.yaml* package-lock.json* ./
COPY prisma ./prisma/
RUN if [ -f pnpm-lock.yaml ]; then pnpm i --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else npm install; fi

RUN pnpm dlx prisma generate

# ── Stage 2: Build ──
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects telemetry — disable it
ENV NEXT_TELEMETRY_DISABLED=1

# Build-time env vars (needed for Supabase client, Prisma, etc.)
ARG DATABASE_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG SUPABASE_SERVICE_ROLE_KEY
ARG S3_ENDPOINT
ARG S3_ACCESS_KEY
ARG S3_SECRET_KEY
ARG S3_BUCKET_NAME
ARG S3_REGION
ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL
ARG ANTHROPIC_API_KEY
ARG SUPER_ADMIN_JWT_SECRET
ARG PAYLOAD_TOKEN

ENV DATABASE_URL=$DATABASE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
ENV S3_ENDPOINT=$S3_ENDPOINT
ENV S3_ACCESS_KEY=$S3_ACCESS_KEY
ENV S3_SECRET_KEY=$S3_SECRET_KEY
ENV S3_BUCKET_NAME=$S3_BUCKET_NAME
ENV S3_REGION=$S3_REGION
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
ENV SUPER_ADMIN_JWT_SECRET=$SUPER_ADMIN_JWT_SECRET
ENV PAYLOAD_TOKEN=$PAYLOAD_TOKEN

RUN pnpm run build

# ── Stage 3: Production runner ──
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000

CMD ["node", "server.js"]
