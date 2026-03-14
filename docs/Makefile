all: docs

docs: ## Run the docs locally with live reload
	docker build -t eaccess-docs .
	docker run --rm -it -p 8000:8000 -v ${PWD}:/docs eaccess-docs

.PHONY: docs
