# CNS Tools and Repair

Industrial pneumatic tool repair website built with the FARM stack (FastAPI + React + MongoDB).

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **Motor** - Async MongoDB driver
- **Pydantic** - Data validation
- **MongoDB Atlas** - Cloud database

### Frontend
- **React 18** - UI library
- **Vite** - Build tool
- **Tailwind CSS** - Utility-first CSS
- **React Router** - Client-side routing
- **React Hook Form** - Form management
- **React Dropzone** - File uploads

### Deployment
- **Digital Ocean** - Hosting
- **Docker** - Containerization
- **Nginx** - Reverse proxy

## Features

- ✅ **Quote Request System** - Online quote submission with photo upload
- ✅ **Email Notifications** - Team notifications on new quotes
- ✅ **Dynamic Content Management** - CRUD for tools, brands, industries
- ✅ **Responsive Design** - Mobile-first with bottom navigation
- ✅ **Dark Mode** - Built-in dark mode support
- ✅ **RESTful API** - Full backend API with FastAPI
- ✅ **File Upload** - Photo upload for quote requests

## Project Structure

```
cnstoolsandrepair/
├── backend/                # FastAPI backend
│   ├── app/
│   │   ├── models/        # Pydantic models
│   │   ├── routers/       # API endpoints
│   │   ├── services/      # Business logic
│   │   └── utils/         # Helper functions
│   ├── uploads/           # Uploaded files
│   └── requirements.txt
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   └── services/      # API client
│   └── package.json
└── docker-compose.yml     # Docker orchestration
```

## Setup Instructions

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker & Docker Compose (optional)
- MongoDB Atlas account

### 1. MongoDB Atlas Setup

1. Create a free MongoDB Atlas account at https://www.mongodb.com/cloud/atlas
2. Create a new cluster (M0 free tier)
3. Add a database user
4. Whitelist your IP address (or 0.0.0.0/0 for development)
5. Get your connection string

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env and add your MongoDB connection string and email credentials
# MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/
# SMTP_USER=your-email@gmail.com
# SMTP_PASSWORD=your-app-password
# etc.

# Run backend
uvicorn app.main:app --reload
```

Backend will be available at http://localhost:8000

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Run frontend
npm run dev
```

Frontend will be available at http://localhost:5173

### 4. Docker Setup (Alternative)

```bash
# Create .env file in root directory with MongoDB credentials
cp backend/.env.example .env

# Build and run containers
docker-compose up --build

# Frontend: http://localhost
# Backend: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

## Environment Variables

### Backend (.env)
```env
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/
DATABASE_NAME=cns_tools
CORS_ORIGINS=http://localhost:5173
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=your-email@gmail.com
NOTIFICATION_EMAIL=team@cnstools.com
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:8000
```

## API Endpoints

### Quotes
- `POST /api/quotes/` - Create quote with photos
- `GET /api/quotes/{id}` - Get quote by ID
- `GET /api/quotes/` - List all quotes

### Tools
- `GET /api/tools/` - List tools
- `POST /api/tools/` - Create tool
- `PUT /api/tools/{id}` - Update tool
- `DELETE /api/tools/{id}` - Delete tool

### Brands
- `GET /api/brands/` - List brands
- `POST /api/brands/` - Create brand
- `PUT /api/brands/{id}` - Update brand
- `DELETE /api/brands/{id}` - Delete brand

### Industries
- `GET /api/industries/` - List industries
- `POST /api/industries/` - Create industry
- `PUT /api/industries/{id}` - Update industry
- `DELETE /api/industries/{id}` - Delete industry

### Contact
- `POST /api/contact/` - Send contact message

API documentation available at: http://localhost:8000/docs

## Deployment to Digital Ocean

### Option 1: App Platform (Recommended)

1. Push code to GitHub
2. Create new app in Digital Ocean App Platform
3. Connect GitHub repository
4. Configure environment variables
5. Deploy!

### Option 2: Droplet with Docker

1. Create Ubuntu Droplet
2. Install Docker and Docker Compose
3. Clone repository
4. Create .env file with production credentials
5. Run `docker-compose up -d`
6. Configure domain DNS (Hostinger → Digital Ocean)
7. Setup SSL with Let's Encrypt

## Email Configuration

### Gmail Setup
1. Enable 2-factor authentication
2. Generate app password: https://myaccount.google.com/apppasswords
3. Use app password in SMTP_PASSWORD env variable

### Alternative: SendGrid
- Sign up at https://sendgrid.com
- Get API key
- Update email service to use SendGrid API

## Adding Initial Data

Use the API docs (http://localhost:8000/docs) to add initial data:

1. **Add Tools** - POST to `/api/tools/`
2. **Add Brands** - POST to `/api/brands/`
3. **Add Industries** - POST to `/api/industries/`

Or use Python script:
```python
import requests

tools = [
    {"name": "Impact Wrenches", "category": "impact_tools", "description": "..."},
    {"name": "Pneumatic Grinders", "category": "grinding", "description": "..."},
]

for tool in tools:
    requests.post("http://localhost:8000/api/tools/", json=tool)
```

## Development

### Backend Development
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

### Frontend Development
```bash
cd frontend
npm run dev
```

### Testing Quote Form
1. Navigate to http://localhost:5173/quote
2. Fill out form
3. Upload photos (max 5, 5MB each)
4. Submit
5. Check email for notification

## Production Checklist

- [ ] Set up MongoDB Atlas production cluster
- [ ] Configure production environment variables
- [ ] Set up email service (Gmail or SendGrid)
- [ ] Configure Hostinger DNS to Digital Ocean
- [ ] Set up SSL certificate (Let's Encrypt)
- [ ] Test quote submission workflow
- [ ] Add initial tools, brands, industries data
- [ ] Test email notifications
- [ ] Enable CORS for production domain only

## Support

For questions or issues, contact the development team.

## License

Proprietary - CNS Tools and Repair © 2024
