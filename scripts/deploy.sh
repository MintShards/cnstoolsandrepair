#!/bin/bash

################################################################################
# CNS Tools and Repair - Production Deployment Script
################################################################################
# This script automates the deployment process for Digital Ocean Droplet
# Usage: bash scripts/deploy.sh
# Run on: Digital Ocean Droplet (Ubuntu 22.04)
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/opt/apps/cnstoolsandrepair"
DOMAIN="cnstoolsandrepair.com"
WWW_DOMAIN="www.cnstoolsandrepair.com"

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root"
        exit 1
    fi
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        print_error "$1 is not installed"
        return 1
    fi
    print_success "$1 is installed"
    return 0
}

################################################################################
# Pre-flight Checks
################################################################################

preflight_checks() {
    print_header "Pre-flight Checks"

    check_root

    # Check required commands
    local all_ok=true
    check_command "docker" || all_ok=false
    check_command "docker-compose" || all_ok=false
    check_command "git" || all_ok=false
    check_command "certbot" || all_ok=false

    if [ "$all_ok" = false ]; then
        print_error "Missing required dependencies. Run initial setup first."
        exit 1
    fi

    print_success "All pre-flight checks passed"
}

################################################################################
# System Setup
################################################################################

install_dependencies() {
    print_header "Installing Dependencies"

    print_info "Updating system packages..."
    apt update
    apt upgrade -y

    print_info "Installing Docker, Docker Compose, and utilities..."
    apt install -y docker.io docker-compose git certbot python3-certbot-nginx ufw fail2ban

    print_info "Enabling Docker service..."
    systemctl enable docker
    systemctl start docker

    print_success "Dependencies installed successfully"
}

configure_firewall() {
    print_header "Configuring Firewall"

    print_info "Setting up UFW firewall rules..."
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 22/tcp comment 'SSH'
    ufw allow 80/tcp comment 'HTTP'
    ufw allow 443/tcp comment 'HTTPS'
    ufw --force enable

    print_info "Enabling fail2ban..."
    systemctl enable fail2ban
    systemctl start fail2ban

    print_success "Firewall configured successfully"
    ufw status
}

################################################################################
# Application Deployment
################################################################################

clone_repository() {
    print_header "Cloning Repository"

    if [ -d "$APP_DIR" ]; then
        print_warning "Directory $APP_DIR already exists"
        read -p "Do you want to remove it and re-clone? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Removing existing directory..."
            rm -rf "$APP_DIR"
        else
            print_info "Skipping clone, using existing directory"
            return
        fi
    fi

    print_info "Creating deployment directory..."
    mkdir -p /opt/apps
    cd /opt/apps

    print_info "Cloning repository..."
    read -p "Enter Git repository URL: " repo_url
    git clone "$repo_url" cnstoolsandrepair

    print_success "Repository cloned to $APP_DIR"
}

configure_environment() {
    print_header "Configuring Environment Variables"

    cd "$APP_DIR"

    if [ -f ".env" ]; then
        print_warning ".env file already exists"
        read -p "Do you want to reconfigure? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Skipping environment configuration"
            return
        fi
    fi

    print_info "Generating JWT secret..."
    JWT_SECRET=$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')

    print_info "Please provide the following credentials:"
    echo

    read -p "MongoDB Connection URL: " MONGODB_URL
    read -p "MongoDB Database Name [cnstoolsandrepair_db_prod]: " DATABASE_NAME
    DATABASE_NAME=${DATABASE_NAME:-cnstoolsandrepair_db_prod}

    read -p "SendGrid API Key: " SENDGRID_API_KEY
    read -p "SendGrid From Email [noreply@cnstoolsandrepair.com]: " SENDGRID_FROM_EMAIL
    SENDGRID_FROM_EMAIL=${SENDGRID_FROM_EMAIL:-noreply@cnstoolsandrepair.com}
    read -p "Notification Email: " NOTIFICATION_EMAIL

    read -p "Digital Ocean Spaces Region [nyc3]: " SPACES_REGION
    SPACES_REGION=${SPACES_REGION:-nyc3}
    read -p "Spaces Bucket Name: " SPACES_BUCKET
    read -p "Spaces Access Key: " SPACES_KEY
    read -p "Spaces Secret Key: " SPACES_SECRET

    print_info "Creating .env file..."
    cat > .env << EOF
# MongoDB Atlas - Production
MONGODB_URL=$MONGODB_URL
DATABASE_NAME=$DATABASE_NAME

# CORS - Production Domain
CORS_ORIGINS=https://$DOMAIN,https://$WWW_DOMAIN

# SendGrid - Email Service
SENDGRID_API_KEY=$SENDGRID_API_KEY
SENDGRID_FROM_EMAIL=$SENDGRID_FROM_EMAIL
NOTIFICATION_EMAIL=$NOTIFICATION_EMAIL

# Digital Ocean Spaces
USE_SPACES=true
SPACES_REGION=$SPACES_REGION
SPACES_BUCKET=$SPACES_BUCKET
SPACES_KEY=$SPACES_KEY
SPACES_SECRET=$SPACES_SECRET
SPACES_ENDPOINT=https://$SPACES_REGION.digitaloceanspaces.com
UPLOAD_BASE_URL=https://$SPACES_BUCKET.$SPACES_REGION.cdn.digitaloceanspaces.com

# JWT Authentication
JWT_SECRET_KEY=$JWT_SECRET
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=8

# Frontend API URL
VITE_API_URL=https://$DOMAIN

# File Upload
MAX_FILE_SIZE=5242880
ALLOWED_EXTENSIONS=jpg,jpeg,png,webp

# Environment
ENVIRONMENT=production
EOF

    chmod 600 .env
    print_success "Environment configured successfully"
}

update_nginx_config() {
    print_header "Updating Nginx Configuration"

    cd "$APP_DIR/frontend"

    print_info "Updating domain in nginx.prod.conf..."
    sed -i "s/yourdomain\.com/$DOMAIN/g" nginx.prod.conf

    print_success "Nginx configuration updated"
}

obtain_ssl_certificate() {
    print_header "Obtaining SSL Certificate"

    # Check if certificate already exists
    if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
        print_warning "SSL certificate already exists for $DOMAIN"
        read -p "Do you want to renew it? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            certbot renew
        else
            print_info "Skipping SSL certificate generation"
            return
        fi
    fi

    print_info "Stopping any running web servers..."
    systemctl stop nginx 2>/dev/null || true
    docker stop cns-frontend-prod 2>/dev/null || true

    read -p "Enter email for SSL certificate notifications: " ssl_email

    print_info "Obtaining SSL certificate from Let's Encrypt..."
    certbot certonly --standalone \
        -d "$DOMAIN" \
        -d "$WWW_DOMAIN" \
        --non-interactive \
        --agree-tos \
        --email "$ssl_email"

    print_info "Enabling auto-renewal..."
    systemctl enable certbot.timer
    systemctl start certbot.timer

    print_success "SSL certificate obtained successfully"
}

build_and_deploy() {
    print_header "Building and Deploying Application"

    cd "$APP_DIR"

    print_info "Building Docker images (this may take 5-10 minutes)..."
    docker-compose -f docker-compose.prod.yml build

    print_info "Starting containers..."
    docker-compose -f docker-compose.prod.yml up -d

    print_success "Application deployed successfully"

    print_info "Waiting for containers to start..."
    sleep 5

    docker ps
}

create_admin_user() {
    print_header "Creating Admin User"

    print_warning "You will now create an admin user for the application"
    print_info "Press Enter to continue..."
    read

    docker exec -it cns-backend-prod python scripts/create_admin.py

    print_success "Admin user created"
}

################################################################################
# Verification
################################################################################

verify_deployment() {
    print_header "Verifying Deployment"

    print_info "Checking container status..."
    if docker ps | grep -q "cns-backend-prod"; then
        print_success "Backend container is running"
    else
        print_error "Backend container is not running"
        print_info "Check logs: docker logs cns-backend-prod"
    fi

    if docker ps | grep -q "cns-frontend-prod"; then
        print_success "Frontend container is running"
    else
        print_error "Frontend container is not running"
        print_info "Check logs: docker logs cns-frontend-prod"
    fi

    print_info "Testing API endpoint..."
    sleep 3
    if curl -f -s "https://$DOMAIN/api/settings/health" > /dev/null; then
        print_success "API is responding"
    else
        print_warning "API health check failed (may need a few more seconds to start)"
    fi

    print_info "\nDeployment verification complete!"
    echo -e "\n${GREEN}🎉 Your website should be live at: https://$DOMAIN${NC}\n"
}

################################################################################
# Main Execution
################################################################################

show_menu() {
    clear
    echo -e "${BLUE}"
    echo "=========================================="
    echo "  CNS Tools and Repair Deployment"
    echo "=========================================="
    echo -e "${NC}"
    echo "1. Full Installation (First Time)"
    echo "2. Deploy/Update Application Only"
    echo "3. Obtain/Renew SSL Certificate"
    echo "4. Create Admin User"
    echo "5. View Container Logs"
    echo "6. Restart Services"
    echo "7. Exit"
    echo
    read -p "Select option [1-7]: " choice
}

view_logs() {
    print_header "Container Logs"
    echo "1. Backend Logs"
    echo "2. Frontend Logs"
    echo "3. Both"
    read -p "Select [1-3]: " log_choice

    case $log_choice in
        1)
            docker logs --tail 100 -f cns-backend-prod
            ;;
        2)
            docker logs --tail 100 -f cns-frontend-prod
            ;;
        3)
            echo -e "\n${BLUE}=== Backend Logs ===${NC}"
            docker logs --tail 50 cns-backend-prod
            echo -e "\n${BLUE}=== Frontend Logs ===${NC}"
            docker logs --tail 50 cns-frontend-prod
            ;;
    esac
}

restart_services() {
    print_header "Restarting Services"
    cd "$APP_DIR"
    docker-compose -f docker-compose.prod.yml restart
    print_success "Services restarted"
}

full_installation() {
    preflight_checks
    install_dependencies
    configure_firewall
    clone_repository
    configure_environment
    update_nginx_config
    obtain_ssl_certificate
    build_and_deploy
    create_admin_user
    verify_deployment
}

update_deployment() {
    print_header "Updating Application"

    cd "$APP_DIR"

    print_info "Pulling latest changes..."
    git pull

    print_info "Rebuilding containers..."
    docker-compose -f docker-compose.prod.yml build

    print_info "Restarting services..."
    docker-compose -f docker-compose.prod.yml up -d

    print_success "Application updated successfully"
}

# Main loop
while true; do
    show_menu

    case $choice in
        1)
            full_installation
            read -p "Press Enter to continue..."
            ;;
        2)
            update_deployment
            read -p "Press Enter to continue..."
            ;;
        3)
            obtain_ssl_certificate
            read -p "Press Enter to continue..."
            ;;
        4)
            create_admin_user
            read -p "Press Enter to continue..."
            ;;
        5)
            view_logs
            ;;
        6)
            restart_services
            read -p "Press Enter to continue..."
            ;;
        7)
            print_success "Goodbye!"
            exit 0
            ;;
        *)
            print_error "Invalid option"
            read -p "Press Enter to continue..."
            ;;
    esac
done
