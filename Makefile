# eaccess monorepo

# ---- docker ----

up:
	docker compose up -d
	@echo "waiting for postgres..."
	@until docker compose exec postgres pg_isready -U test_user -d easy_auth_test > /dev/null 2>&1; do sleep 1; done
	@echo "postgres ready on port 5433"

down:
	docker compose down

down-volumes:
	docker compose down -v

logs:
	docker compose logs -f postgres

# ---- admin dev (two terminals) ----

server: up
	cd packages/admin && npx tsx watch dev-server.ts

client:
	cd packages/admin && npx vite

# ---- auth ----

test: up
	cd packages/auth && npx vitest run

test-watch: up
	cd packages/auth && npx vitest

# ---- build ----

build-auth:
	cd packages/auth && npm run build

build-admin:
	cd packages/admin && npm run build

build: build-auth build-admin

# ---- install ----

install:
	cd packages/auth && npm install
	cd packages/admin && npm install

.PHONY: up down down-volumes logs server client test test-watch build-auth build-admin build install
