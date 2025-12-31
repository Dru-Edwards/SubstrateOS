.PHONY: setup install lint test run eval ingest clean docker-up docker-down

# =============================================================================
# Setup & Dependencies
# =============================================================================
setup:
	python -m venv .venv
	.venv/Scripts/pip install --upgrade pip
	.venv/Scripts/pip install -r requirements.txt
	.venv/Scripts/pip install -r requirements-dev.txt
	cp -n .env.example .env || true
	mkdir -p data/corpus data/vectors logs eval/runs

install:
	pip install -r requirements.txt

install-dev:
	pip install -r requirements-dev.txt

# =============================================================================
# Code Quality
# =============================================================================
lint:
	ruff check apps/ rag/ eval/ agent/
	ruff format --check apps/ rag/ eval/ agent/
	mypy apps/ --ignore-missing-imports

format:
	ruff format apps/ rag/ eval/ agent/
	ruff check --fix apps/ rag/ eval/ agent/

# =============================================================================
# Testing
# =============================================================================
test:
	pytest apps/api/tests/ -v --cov=apps --cov-report=term-missing

test-rag:
	pytest rag/tests/ -v

test-eval:
	pytest eval/tests/ -v

test-all:
	pytest . -v --cov=. --cov-report=html

# =============================================================================
# Running
# =============================================================================
run:
	uvicorn apps.api.main:app --host 0.0.0.0 --port 8000 --reload

run-prod:
	uvicorn apps.api.main:app --host 0.0.0.0 --port 8000 --workers 4

# =============================================================================
# RAG Pipeline
# =============================================================================
ingest:
	python -m rag.ingest --corpus-path ./data/corpus --output ./data/vectors

ingest-docs:
	python -m rag.ingest --source ../packages/runtime-sdk/src --output ./data/vectors

# =============================================================================
# Evaluation
# =============================================================================
eval:
	python -m eval.eval_runner --dataset ./eval/datasets/test_set.json --output ./eval/runs

eval-prompts:
	python -m eval.prompt_eval --prompts ./prompts/versions --output ./eval/runs

eval-rag:
	python -m rag.rag_eval --queries ./eval/datasets/rag_queries.json --output ./eval/runs

# =============================================================================
# Docker
# =============================================================================
docker-build:
	docker-compose build

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

# =============================================================================
# Cleanup
# =============================================================================
clean:
	rm -rf __pycache__ .pytest_cache .mypy_cache .ruff_cache
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true

clean-all: clean
	rm -rf .venv data/vectors logs/*.log eval/runs/*
