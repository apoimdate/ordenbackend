.PHONY: help dev prod build up down logs clean test migrate seed

# Default target
help:
	@echo "OrdenDirecta Backend - Make Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development environment with hot reload"
	@echo "  make dev-tools    - Start dev environment with pgAdmin and Redis Commander"
	@echo "  make logs         - Show backend logs"
	@echo "  make shell        - Enter backend container shell"
	@echo ""
	@echo "Production:"
	@echo "  make prod         - Start production environment"
	@echo "  make build        - Build production Docker image"
	@echo ""
	@echo "Database:"
	@echo "  make migrate      - Run database migrations"
	@echo "  make seed         - Seed database with initial data"
	@echo "  make db-reset     - Reset database (WARNING: destroys all data)"
	@echo ""
	@echo "Testing:"
	@echo "  make test         - Run tests"
	@echo "  make test-watch   - Run tests in watch mode"
	@echo ""
	@echo "Maintenance:"
	@echo "  make down         - Stop all containers"
	@echo "  make clean        - Remove containers, volumes, and images"
	@echo "  make ps           - Show running containers"

# Development commands
dev:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

dev-tools:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml --profile tools up

logs:
	docker-compose logs -f backend

shell:
	docker-compose exec backend sh

# Production commands
prod:
	docker-compose up -d

build:
	docker-compose build --no-cache backend

# Database commands
migrate:
	docker-compose exec backend npx prisma migrate deploy

seed:
	docker-compose exec backend npm run db:seed
	docker-compose exec backend npm run seed:fraud-rules

db-reset:
	@echo "WARNING: This will delete all data! Press Ctrl+C to cancel, or Enter to continue."
	@read confirm
	docker-compose down -v
	docker-compose up -d postgres
	sleep 5
	docker-compose exec backend npx prisma migrate reset --force

# Testing commands
test:
	docker-compose exec backend npm test

test-watch:
	docker-compose exec backend npm run test:watch

# Maintenance commands
down:
	docker-compose down

clean:
	docker-compose down -v --rmi all

ps:
	docker-compose ps

# Utility commands
init-typesense:
	docker-compose exec backend npm run typesense:init

reindex:
	docker-compose exec backend npm run typesense:reindex

# Environment setup
setup:
	@if [ ! -f .env ]; then \
		echo "Creating .env file from example..."; \
		cp .env.example .env; \
		echo "Please edit .env file with your configuration"; \
	else \
		echo ".env file already exists"; \
	fi