# Student Management System

A modern, responsive web-based student attendance management system built with React, TypeScript, and Tailwind CSS. This application provides comprehensive attendance tracking with separate interfaces for teachers and students.

## Features

### For Teachers
- **Real-time Attendance Monitoring** - Track student attendance with live updates
- **Student Management** - View and manage 25+ students with detailed profiles
- **Advanced Filtering** - Filter by search term, attendance status, section, and subject
- **Statistics Dashboard** - View present/absent/late counts and overall attendance rates
- **CSV Export** - Export attendance data for reporting and analysis
- **Edit Attendance** - Modify individual student attendance records with notes
- **Subject-wise Tracking** - Monitor attendance across multiple subjects

### For Students
- **Personal Dashboard** - View overall attendance percentage
- **Subject-wise Breakdown** - See attendance for 6 different subjects
- **Progress Indicators** - Color-coded progress bars with status badges
- **Recent Activity** - Timeline view of recent attendance records
- **Time Period Filters** - View data by semester, month, or week
- **Status Badges** - Excellent/Good/At Risk indicators based on attendance

### General Features
- **Secure Authentication** - Username/password login system
- **Responsive Design** - Works seamlessly on desktop, tablet, and mobile devices
- **Beautiful UI** - Modern gradient designs with smooth animations
- **Role-based Access** - Separate dashboards for teachers and students
- **Session Management** - Persistent login using localStorage

## Technology Stack

### Frontend Framework
- **React 18.3.1** - Modern React with hooks and concurrent features
- **TypeScript 5.5.3** - Type-safe JavaScript for better code quality
- **Vite 5.4.2** - Lightning-fast build tool with HMR

### Styling
- **Tailwind CSS 3.4.1** - Utility-first CSS framework
- **PostCSS 8.4.35** - CSS processing with autoprefixer
- **Lucide React 0.344.0** - Beautiful, consistent icon library

### Development Tools
- **ESLint 9.9.1** - Code linting and quality enforcement
- **TypeScript ESLint 8.3.0** - TypeScript-specific linting rules
- **React Hooks ESLint** - Ensures hooks best practices

### Backend/Database (Not Yet Integrated)
- **Supabase 2.57.4** - PostgreSQL database client (installed but not configured)

## Project Structure

```
StudentManagementSystem-main/
├── src/
│   ├── components/
│   │   ├── LoginPage.tsx           # Authentication interface
│   │   ├── TeacherDashboard.tsx    # Teacher management interface
│   │   ├── StudentDashboard.tsx    # Student portal view
│   │   └── AttendanceModal.tsx     # Attendance editing modal
│   ├── App.tsx                     # Main app with routing logic
│   ├── main.tsx                    # React entry point
│   ├── index.css                   # Global styles & Tailwind
│   └── vite-env.d.ts              # Vite type definitions
├── index.html                      # HTML entry point
├── package.json                    # Dependencies & scripts
├── vite.config.ts                  # Vite configuration
├── tailwind.config.js              # Tailwind configuration
├── tsconfig.json                   # TypeScript configuration
├── eslint.config.js                # ESLint configuration
└── README.md                       # This file
```

## Component Architecture

### App.tsx
- Main application controller and router
- Manages authentication state
- Handles user session with localStorage
- Routes between login, teacher, and student views

### LoginPage.tsx
- User authentication interface
- Username/password validation
- Demo credentials display
- Show/hide password toggle
- Loading state management

### TeacherDashboard.tsx
- 25 mock students with complete profiles
- Search functionality across name, roll number, registration number
- Filter by status (present/absent/late)
- Filter by section (A/B/C/D)
- Filter by subject (6 subjects available)
- Real-time statistics cards
- CSV export functionality
- Edit attendance modal integration

### StudentDashboard.tsx
- Personal attendance overview
- Subject-wise attendance cards (6 subjects)
- Color-coded progress indicators
- Attendance status badges
- Time period filters
- Recent activity timeline
- Expandable subject details

### AttendanceModal.tsx
- Edit individual student attendance
- Status selection (present/absent/late)
- Entry and exit time pickers
- Notes field for additional information
- Auto-calculates attendance percentage
- Updates subject-specific records

## Installation

### Prerequisites
- **Node.js** 18+ (recommended)
- **npm** 9+ (comes with Node.js)

### Setup Steps

1. **Clone or navigate to the project directory:**
   ```bash
   cd /path/to/StudentManagementSystem-main
   ```

2. **Install all dependencies:**
   ```bash
   npm install
   ```
   This will install all 19 production and development dependencies.

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173/`

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot module replacement |
| `npm run build` | Build for production (outputs to `dist/` directory) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint to check code quality |

## Usage

### Login Credentials (Demo)

The application currently uses mock authentication with the following demo accounts:

**Teachers:**
- Username: `teacher1` / Password: `password123`
- Username: `teacher2` / Password: `password123`

**Students:**
- Username: `student1` / Password: `password123`
- Username: `student2` / Password: `password123`

### Teacher Workflow
1. Log in with teacher credentials
2. View real-time attendance statistics on the dashboard
3. Use search and filters to find specific students
4. Click "Edit" on any student to modify attendance
5. Export attendance data as CSV for reporting

### Student Workflow
1. Log in with student credentials
2. View overall attendance percentage
3. Check subject-wise attendance breakdown
4. Expand individual subjects for detailed information
5. Use time period filters to view historical data

## Data Models

### User Interface
```typescript
interface User {
  id: string;
  username: string;
  role: 'teacher' | 'student';
  name: string;
}
```

### Student Interface
```typescript
interface Student {
  id: string;
  name: string;
  rollNumber: string;
  regdNumber: string;
  college: string;
  class: string;
  section: string;
  email: string;
  phone: string;
  status: 'present' | 'absent' | 'late';
  entryTime?: string;
  exitTime?: string;
  notes?: string;
  subjects: { [key: string]: SubjectAttendance };
}
```

### Subject Attendance Interface
```typescript
interface SubjectAttendance {
  totalClasses: number;
  attendedClasses: number;
  percentage: number;
  lastAttended: string;
  status: 'present' | 'absent' | 'late';
}
```

### Attendance Record Interface
```typescript
interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  subject: string;
  entryTime?: string;
  exitTime?: string;
  notes?: string;
}
```

## Current Limitations

### No Database Integration
- The application currently uses **mock data** hardcoded in components
- Supabase client is installed but not configured
- All attendance changes are **lost on page refresh**
- No real user authentication or data persistence

### Mock Data
- 4 demo users (2 teachers, 2 students)
- 25 mock students with complete profiles
- 6 mock subjects per student
- All data resets when the application restarts

### No Environment Configuration
- No `.env` file support
- No environment variables configured
- Database credentials not set up

## Future Enhancements

### Phase 1: Database Integration
- [ ] Set up Supabase project
- [ ] Create database schema (users, students, attendance_records tables)
- [ ] Add environment variables (`.env` file)
- [ ] Implement Supabase client initialization
- [ ] Replace mock data with real API calls

### Phase 2: Authentication
- [ ] Implement Supabase Auth
- [ ] Add user registration functionality
- [ ] Password reset functionality
- [ ] Role-based access control (RBAC)

### Phase 3: Real-time Features
- [ ] Live attendance updates using Supabase subscriptions
- [ ] Push notifications for attendance alerts
- [ ] Real-time dashboard refresh

### Phase 4: Advanced Features
- [ ] Multi-college support
- [ ] Analytics and reporting dashboard
- [ ] Email notifications to parents/guardians
- [ ] Mobile app (React Native)
- [ ] Biometric attendance integration
- [ ] QR code-based check-in

### Phase 5: Testing & Deployment
- [ ] Add unit tests (Jest/Vitest)
- [ ] Add integration tests
- [ ] Set up CI/CD pipeline
- [ ] Deploy to production (Vercel/Netlify)

## Development Guidelines

### Code Style
- TypeScript strict mode enabled
- ESLint enforced with React hooks rules
- Prettier for code formatting (recommended)
- Tailwind CSS for all styling

### Component Guidelines
- Use functional components with hooks
- Define proper TypeScript interfaces
- Keep components focused and single-responsibility
- Use meaningful variable and function names

### Git Workflow (When Ready)
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

## Troubleshooting

### Port Already in Use
If port 5173 is already in use:
```bash
# Kill the process using the port
lsof -ti:5173 | xargs kill -9

# Or specify a different port
npm run dev -- --port 3000
```

### Dependencies Not Installing
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

### Build Errors
```bash
# Check TypeScript errors
npx tsc --noEmit

# Run linter
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

## Security Notes

### Current Demo Mode
- Passwords are stored in plain text in code (demo only)
- No HTTPS enforcement
- No CSRF protection
- No rate limiting

### Production Recommendations
When moving to production with real data:
- Use proper authentication (Supabase Auth, Auth0, etc.)
- Enable HTTPS/SSL
- Implement CSRF tokens
- Add rate limiting
- Use environment variables for secrets
- Enable security headers
- Implement proper session management
- Add audit logging

## Browser Support

- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

## Contributing

This is currently a prototype/demo project. To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is available for educational and personal use.

## Contact & Support

For questions, issues, or feature requests, please open an issue on the project repository.

---

**Note:** This is a prototype application with mock data. Database integration is required for production use. The UI and components are production-ready and fully functional for demonstration purposes.
