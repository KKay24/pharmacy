#!/bin/bash

###############################################################################
# Pharmacy Inventory Deployment Script
# 
# This script helps automate common deployment tasks
# 
# Usage:
#   ./scripts/deploy.sh [command]
# 
# Commands:
#   vercel          - Deploy to Vercel
#   docker          - Build and start Docker containers
#   docker-rebuild  - Rebuild and restart Docker containers
#   docker-logs     - View Docker logs
#   docker-stop     - Stop Docker containers
#   docker-clean    - Stop containers and remove volumes
#   test-build      - Test production build locally
#   backup-db       - Backup PostgreSQL database (Docker only)
#   help            - Show this help message
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 is not installed"
        return 1
    fi
    return 0
}

# Command handlers
deploy_vercel() {
    print_info "Deploying to Vercel..."
    
    if ! check_command vercel; then
        print_warning "Vercel CLI not found. Installing..."
        npm install -g vercel
    fi
    
    print_info "Running production build..."
    npm run build
    print_success "Build completed"
    
    print_info "Deploying to Vercel..."
    vercel --prod
    print_success "Deployment complete!"
}

deploy_docker() {
    print_info "Starting Docker deployment..."
    
    if ! check_command docker; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    if ! check_command docker-compose; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check if .env exists
    if [ ! -f .env ]; then
        print_warning ".env file not found"
        if [ -f .env.example ]; then
            print_info "Creating .env from .env.example..."
            cp .env.example .env
            print_warning "Please edit .env file with your configuration before continuing"
            exit 1
        fi
    fi
    
    print_info "Building Docker images..."
    docker-compose build
    print_success "Build completed"
    
    print_info "Starting containers..."
    docker-compose up -d
    print_success "Containers started"
    
    sleep 5
    
    print_info "Container status:"
    docker-compose ps
    
    print_success "Docker deployment complete!"
    print_info "Frontend: http://localhost:3000"
    print_info "Backend: http://localhost:5001"
    print_info "View logs: docker-compose logs -f"
}

docker_rebuild() {
    print_info "Rebuilding Docker containers..."
    
    docker-compose down
    print_success "Containers stopped"
    
    docker-compose build --no-cache
    print_success "Images rebuilt"
    
    docker-compose up -d
    print_success "Containers restarted"
    
    sleep 5
    docker-compose ps
}

docker_logs() {
    print_info "Showing Docker logs (Ctrl+C to exit)..."
    docker-compose logs -f
}

docker_stop() {
    print_info "Stopping Docker containers..."
    docker-compose down
    print_success "Containers stopped"
}

docker_clean() {
    print_warning "This will stop containers and remove ALL data volumes!"
    read -p "Are you sure? (yes/no): " -r
    echo
    if [[ $REPLY =~ ^[Yy]es$ ]]; then
        docker-compose down -v
        print_success "Containers stopped and volumes removed"
    else
        print_info "Operation cancelled"
    fi
}

test_build() {
    print_info "Testing production build..."
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_info "Installing dependencies..."
        npm install
    fi
    
    # Create production build
    print_info "Creating production build..."
    npm run build
    print_success "Build completed successfully"
    
    # Test if serve is installed
    if ! command -v serve &> /dev/null; then
        print_info "Installing serve..."
        npm install -g serve
    fi
    
    print_info "Starting production server on http://localhost:3000"
    print_warning "Note: Backend API will not be available in this mode"
    print_info "Press Ctrl+C to stop"
    serve -s build -l 3000
}

backup_db() {
    print_info "Backing up PostgreSQL database..."
    
    if ! docker-compose ps | grep -q "pharmacy-db"; then
        print_error "Database container is not running"
        exit 1
    fi
    
    BACKUP_DIR="./backups"
    mkdir -p $BACKUP_DIR
    
    BACKUP_FILE="$BACKUP_DIR/pharmacy_backup_$(date +%Y%m%d_%H%M%S).sql"
    
    print_info "Creating backup: $BACKUP_FILE"
    docker-compose exec -T db pg_dump -U pharmacyuser pharmacy > "$BACKUP_FILE"
    
    if [ -f "$BACKUP_FILE" ]; then
        print_success "Backup created successfully: $BACKUP_FILE"
        
        # Compress backup
        gzip "$BACKUP_FILE"
        print_success "Backup compressed: $BACKUP_FILE.gz"
    else
        print_error "Backup failed"
        exit 1
    fi
}

show_help() {
    cat << EOF
${BLUE}Pharmacy Inventory Deployment Script${NC}

${GREEN}Usage:${NC}
  ./scripts/deploy.sh [command]

${GREEN}Commands:${NC}
  ${YELLOW}vercel${NC}          - Deploy to Vercel
  ${YELLOW}docker${NC}          - Build and start Docker containers
  ${YELLOW}docker-rebuild${NC}  - Rebuild and restart Docker containers
  ${YELLOW}docker-logs${NC}     - View Docker logs
  ${YELLOW}docker-stop${NC}     - Stop Docker containers
  ${YELLOW}docker-clean${NC}    - Stop containers and remove volumes
  ${YELLOW}test-build${NC}      - Test production build locally
  ${YELLOW}backup-db${NC}       - Backup PostgreSQL database (Docker only)
  ${YELLOW}help${NC}            - Show this help message

${GREEN}Examples:${NC}
  ./scripts/deploy.sh docker
  ./scripts/deploy.sh vercel
  ./scripts/deploy.sh backup-db

${GREEN}Documentation:${NC}
  README.md         - Project overview
  DEPLOYMENT.md     - Detailed deployment guide
  DOCKER.md         - Docker-specific guide

EOF
}

# Main script
main() {
    local command=${1:-help}
    
    case $command in
        vercel)
            deploy_vercel
            ;;
        docker)
            deploy_docker
            ;;
        docker-rebuild)
            docker_rebuild
            ;;
        docker-logs)
            docker_logs
            ;;
        docker-stop)
            docker_stop
            ;;
        docker-clean)
            docker_clean
            ;;
        test-build)
            test_build
            ;;
        backup-db)
            backup_db
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            echo
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
