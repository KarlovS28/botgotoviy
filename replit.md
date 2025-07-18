# IT Infrastructure Management Bot - Replit Project

## Project Overview
A comprehensive Russian language Telegram bot for IT infrastructure management providing advanced features for equipment tracking, secure communication, and task management with granular role-based access control.

### Key Features
- Equipment management with inventory tracking
- User management with role-based permissions
- Task management system with notifications
- Secure password sharing mechanism
- Telegram bot integration with Russian localization
- Administrative web panel
- Excel export functionality

## Recent Changes (January 9, 2025)

### Database Issues Fixed ✅
- Resolved PostgreSQL authentication errors ("password authentication failed for user 'neondb_owner'")
- Created new database instance with proper credentials
- Successfully pushed database schema and seeded with initial data

### Admin User Configuration ✅
- Created default admin user with credentials:
  - Username: `admin`
  - Password: `admin123`
- Admin user properly configured in database with full permissions
- Login functionality tested and working

### Deployment Simplification ✅
- Created `deploy.sh` script for automated deployment on external servers
- Added `.env.example` file with all required environment variables
- Created comprehensive deployment documentation in README.md
- Added production start script in `package-scripts/start.js`

### Documentation Updates ✅
- Created comprehensive README.md with:
  - Complete installation instructions
  - API documentation
  - Security guidelines
  - Troubleshooting guide
  - Project structure overview
  - Technology stack details

## Project Architecture

### Backend (Node.js + TypeScript)
- **Express.js** for REST API
- **Drizzle ORM** with PostgreSQL database
- **Telegraf** for Telegram bot functionality
- **Express-session** for authentication
- **Crypto** for password encryption

### Frontend (React + TypeScript)
- **React** with modern hooks
- **Vite** for build tooling
- **Wouter** for client-side routing
- **TailwindCSS** + **Shadcn/ui** for styling
- **TanStack Query** for state management
- **React Hook Form** for form handling

### Database Schema
- Users with role-based access control
- Equipment tracking with history
- Task management with comments
- Secure password storage
- Bot settings configuration
- Permissions system

## User Preferences

### Communication Style
- User prefers Russian language
- Technical explanations when needed
- Focus on practical solutions
- Clear step-by-step instructions

### Deployment Requirements
- Simplified deployment process for external servers
- Comprehensive documentation
- Automated setup scripts
- Clear admin credentials

## Environment Configuration

### Required Environment Variables
```env
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
BOT_TOKEN=your_telegram_bot_token_here
SESSION_SECRET=your_session_secret_here
PORT=5000
NODE_ENV=production
```

### Default Admin Credentials
- Username: `admin`
- Password: `admin123`

## Deployment Process

### Automated Deployment
1. Run `chmod +x deploy.sh`
2. Execute `./deploy.sh`
3. Follow prompts to configure environment
4. Access admin panel at configured URL

### Manual Deployment
1. Install dependencies: `npm install`
2. Configure `.env` file
3. Push database schema: `npm run db:push`
4. Seed database: `npm run db:seed`
5. Start application: `npm run dev` (development) or `npm start` (production)

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Current user info

### User Management
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `PUT /api/users/:id/role` - Update user role
- `DELETE /api/users/:id` - Delete user

### Equipment Management
- `GET /api/equipment` - List equipment
- `POST /api/equipment` - Add equipment
- `PUT /api/equipment/:id` - Update equipment
- `GET /api/equipment/:id/history` - Equipment history

### Task Management
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id/status` - Update task status
- `PUT /api/tasks/:id/assign` - Assign task

### Password Management
- `GET /api/secure-passwords` - List passwords
- `POST /api/secure-passwords` - Create password
- `PUT /api/secure-passwords/:id/read` - Mark as read

### Settings
- `GET /api/bot-settings` - Get bot settings
- `PUT /api/bot-settings` - Update bot settings

## Known Issues & Solutions

### Database Connection
- ✅ Fixed: Authentication errors resolved with new database instance
- Monitor: Connection stability in production

### Telegram Bot
- ✅ Working: Bot starts successfully with provided token
- Required: Valid BOT_TOKEN from @BotFather

### Admin Access
- ✅ Working: Admin login functional with credentials admin/admin123
- Security: Change default password in production

## Current Status
- ✅ Application running successfully
- ✅ Database connected and seeded
- ✅ Admin user created and functional
- ✅ Telegram bot integration working
- ✅ Complete documentation provided
- ✅ Deployment simplified with automation scripts

## Next Steps
1. Test complete application functionality
2. Verify Telegram bot commands
3. Validate all CRUD operations
4. Ensure proper role-based access control
5. Test deployment script on fresh environment