.PHONY: build zip clean dev fmt help

# Default target
all: build

# Build the extension for production
build:
	@echo "Building MergeX extension..."
	npm run build
	@echo "Build completed successfully!"

# Build and create zip package
zip: build
	@echo "Creating zip package..."
	npm run zip
	@echo "Zip package created successfully!"

# Start development server with hot reload
dev:
	@echo "Starting development server..."
	npm run dev

# Format code using prettier
fmt:
	@echo "Formatting code..."
	npm run fmt
	@echo "Code formatting completed!"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf build/
	rm -rf package/
	@echo "Clean completed!"

# Install dependencies
install:
	@echo "Installing dependencies..."
	npm install
	@echo "Dependencies installed!"

# Help target to show available commands
help:
	@echo "Available commands:"
	@echo "  build     - Build the extension for production"
	@echo "  zip       - Build and create zip package for store submission"
	@echo "  dev       - Start development server with hot reload"
	@echo "  fmt       - Format code using prettier"
	@echo "  clean     - Clean build artifacts"
	@echo "  install   - Install npm dependencies"
	@echo "  help      - Show this help message"