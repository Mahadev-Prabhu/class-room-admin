# Early Learning Library - Admin Portal

A modern admin portal for managing Early Learning Library teachers, students, and class codes. Built with Next.js, Firebase, and Tailwind CSS.

## Features

- **Authentication**: Email/password, Google, and Apple sign-in
- **Dashboard**: Overview of teachers, students, and reading statistics
- **Class Codes Management**: Add, validate, and manage class codes
- **Teachers Management**: View all teachers and their students
- **Students Management**: View, move between classes, and delete students
- **School Settings**: Manage school/center information

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Database**: Firebase Realtime Database
- **Authentication**: Firebase Auth
- **Deployment**: Vercel (recommended)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Firebase project with Realtime Database enabled
- Firebase Authentication enabled (Email/Password, Google, Apple)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd EarlyLearningLibraryAdminPortal
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   
   Copy the environment example file:
   ```bash
   cp .env.local.example .env.local
   ```
   
   Fill in your Firebase configuration in `.env.local`:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open the app**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## Firebase Database Structure

The app expects the following structure in your Firebase Realtime Database:

```json
{
  "users": {
    "<user_uid>": {
      "is_teacher": true/false,
      "teacher_code": "XXXXX",
      "teacher_details": { ... },
      "children": { ... },
      "sign_in_details": { ... }
    }
  },
  "admins": {
    "<admin_uid>": {
      "email": "admin@school.com",
      "name": "Admin Name",
      "role": "school_admin",
      "school_details": { ... },
      "is_active": true,
      "is_setup_complete": true
    }
  },
  "class_codes": {
    "<code>": {
      "teacher_uid": "...",
      "class_name": "...",
      "expiration_date": "...",
      "student_limit": 30
    }
  }
}
```

## Firebase Security Rules

Add these rules to your Firebase Realtime Database:

```json
{
  "rules": {
    "admins": {
      "$adminId": {
        ".read": "auth != null && (auth.uid == $adminId || root.child('admins').child(auth.uid).child('role').val() == 'super_admin')",
        ".write": "auth != null && root.child('admins').child(auth.uid).exists()"
      }
    },
    "users": {
      ".read": "auth != null && root.child('admins').child(auth.uid).exists()",
      ".write": "auth != null && root.child('admins').child(auth.uid).exists()",
      "$userId": {
        ".read": "auth != null && (auth.uid == $userId || root.child('admins').child(auth.uid).exists())",
        ".write": "auth != null && (auth.uid == $userId || root.child('admins').child(auth.uid).exists())"
      }
    },
    "class_codes": {
      ".read": "auth != null && root.child('admins').child(auth.uid).exists()",
      ".write": "auth != null && root.child('admins').child(auth.uid).exists()"
    }
  }
}
```

## Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Add your environment variables in the Vercel dashboard
4. Deploy!

### Deploy to Firebase Hosting

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize: `firebase init hosting`
4. Build: `npm run build`
5. Deploy: `firebase deploy --only hosting`

## Project Structure

```
src/
├── app/
│   ├── (auth)/           # Auth pages (login, forgot-password)
│   ├── admin/            # Admin pages (dashboard, teachers, students, etc.)
│   ├── setup/            # Admin setup page
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Landing page (redirects)
├── components/
│   ├── admin/            # Admin-specific components
│   └── ui/               # shadcn/ui components
├── contexts/
│   └── AuthContext.tsx   # Authentication context
├── hooks/
│   └── use-mobile.ts     # Mobile detection hook
└── lib/
    ├── firebase.ts       # Firebase configuration
    ├── firebase-service.ts # Firebase data operations
    ├── types.ts          # TypeScript interfaces
    └── utils.ts          # Utility functions
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Admin Roles

- **super_admin**: Can manage all admins and has full access
- **school_admin**: Can manage their school's teachers and students
- **viewer**: Read-only access

## License

Private - All rights reserved.
