# 🏙️ Intelligent Crowd Management System

A comprehensive real-time crowd monitoring and management system using computer vision and IoT technologies.

## 📋 Overview

This system provides intelligent crowd management for public spaces, transportation hubs, and events through:

- **Real-time crowd detection** using YOLOv8 computer vision
- **IoT sensor integration** for multi-source data collection
- **Interactive dashboard** for monitoring and analytics
- **Alert system** for crowd threshold violations
- **Historical analytics** and reporting

## 🏗️ Architecture

### Backend (FastAPI + Python)
- **Domain Layer**: Core business entities and logic
- **Infrastructure Layer**: External services (Database, Computer Vision)
- **Application Layer**: Use cases and business rules
- **Presentation Layer**: REST API endpoints

### Frontend (React + TypeScript)
- **Dashboard**: Real-time monitoring interface
- **Maps**: Interactive crowd visualization
- **Analytics**: Charts and trend analysis
- **Alerts**: Real-time notification management

### Database
- **PostgreSQL**: Primary data storage
- **Redis**: Caching and real-time data

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Python 3.11+
- Node.js 16+

### 1. Clone and Setup
```bash
git clone <repository-url>
cd crowd-management-system
```

### 2. Environment Setup
```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### 3. Database Setup
```bash
# Using Docker Compose
cd ../docker
docker-compose up -d postgres redis

# Run database migrations
cd ../backend
alembic upgrade head
```

### 4. Run the System
```bash
# Backend API
cd backend
uvicorn src.presentation.api.main:app --reload

# Frontend Dashboard
cd frontend
npm start

# Or using Docker
cd docker
docker-compose up
```

## 📡 API Documentation

### Core Endpoints

#### Locations
- `GET /api/v1/locations` - Get all locations
- `POST /api/v1/locations` - Create new location
- `PUT /api/v1/locations/{id}` - Update location

#### Crowd Measurements
- `GET /api/v1/measurements/{location_id}` - Get crowd measurements
- `POST /api/v1/measurements/process-camera/{camera_id}` - Process camera feed

#### Alerts
- `GET /api/v1/alerts` - Get active alerts
- `PUT /api/v1/alerts/{id}/resolve` - Resolve alert
- `POST /api/v1/alerts/thresholds` - Create alert threshold

#### Analytics
- `GET /api/v1/dashboard/stats` - Dashboard statistics
- `GET /api/v1/analytics/{location_id}` - Crowd analytics

## 🔧 Configuration

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/crowd_management

# Redis
REDIS_URL=redis://localhost:6379

# Computer Vision
YOLO_MODEL_PATH=yolov8n.pt
CONFIDENCE_THRESHOLD=0.5

# API
API_HOST=0.0.0.0
API_PORT=8000
```

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest tests/

# Frontend tests
cd frontend
npm test
```

## 📊 Features

### Real-time Monitoring
- Live camera feed processing
- Person detection and counting
- Confidence scoring
- Multi-camera support

### Alert System
- Configurable thresholds
- Severity levels (Low, Medium, High, Critical)
- Real-time notifications
- Alert resolution tracking

### Analytics Dashboard
- Crowd density heatmaps
- Historical trend analysis
- Peak crowd timing
- Location-wise statistics

### Data Management
- PostgreSQL for persistent storage
- Redis for caching
- Time-series data handling
- Data export capabilities

## 🐳 Docker Deployment

```bash
# Build and run all services
docker-compose -f docker/docker-compose.yml up --build

# Run specific service
docker-compose -f docker/docker-compose.yml up crowd-api

# View logs
docker-compose -f docker/docker-compose.yml logs -f
```

## 🔒 Security

- JWT-based authentication
- API rate limiting
- Input validation
- Secure database connections
- Environment-based configuration

## 📈 Performance

- **Real-time Processing**: <500ms response time
- **Concurrent Cameras**: Support for 50+ simultaneous feeds
- **Data Retention**: Configurable historical data storage
- **Scalability**: Horizontal scaling with Docker

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the API documentation at `http://localhost:8000/docs`

## 🗺️ Roadmap

- [ ] Mobile application development
- [ ] Advanced AI analytics
- [ ] Integration with public transport APIs
- [ ] Predictive crowd modeling
- [ ] Multi-language support
- [ ] Advanced reporting features

---

**Built with ❤️ for safer public spaces**