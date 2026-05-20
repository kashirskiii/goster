.PHONY: up down build restart logs ps \
        prisma-generate prisma-migrate prisma-migrate-prod prisma-studio prisma-reset \
        install dev

# ──────────────────────────────────────────
# Docker
# ──────────────────────────────────────────
up:
	docker compose up -d

up-build:
	docker compose up -d --build

down:
	docker compose down

down-volumes:
	docker compose down -v

build:
	docker compose build

restart:
	docker compose restart app

logs:
	docker compose logs -f app

logs-all:
	docker compose logs -f

ps:
	docker compose ps

# ──────────────────────────────────────────
# Prisma (runs inside the app container)
# ──────────────────────────────────────────
prisma-generate:
	docker compose exec app npx prisma generate

prisma-migrate:
	docker compose exec app npx prisma migrate dev

prisma-migrate-prod:
	docker compose exec app npx prisma migrate deploy

prisma-studio:
	docker compose exec app npx prisma studio --browser none

prisma-reset:
	docker compose exec app npx prisma migrate reset

# ──────────────────────────────────────────
# Local dev (without Docker)
# ──────────────────────────────────────────
install:
	npm install

dev:
	npm run start:dev
