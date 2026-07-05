# iFYSORA
A body measurements App for fashion professionals 
# iFYSORA - 3D Anthropometric Measurement Platform

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (for production)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/beresdowds-afk/east-forte-fabrications-and-equipments/IFYSORA.git
cd IFYSORA

# Install dependencies
cd server && npm install
cd ../client && npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
cd server && npx prisma db push

# Start development servers
# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend
cd client && npm run dev
