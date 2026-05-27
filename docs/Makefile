DOCS_DIR := $(realpath $(dir $(lastword $(MAKEFILE_LIST))))

all: docs

docs: ## Run the docs locally with live reload
	cd $(DOCS_DIR) && docker build -t eaccess-docs .
	docker run --rm -it -p 8000:8000 -v $(DOCS_DIR):/docs eaccess-docs

.PHONY: docs
