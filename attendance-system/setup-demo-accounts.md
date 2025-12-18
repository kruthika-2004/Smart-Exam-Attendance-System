# Demo Account Setup Instructions

Since Supabase Auth requires proper password hashing that can only be done through the Auth API, please create the demo accounts manually:

## Option 1: Create via the application

1. Go to the login page
2. Click "Don't have an account? Sign up"
3. Create the admin account:
   - Email: admin@facexam.demo
   - Password: admin123
   - Account Type: Admin
4. Sign out and create the student account:
   - Email: student@facexam.demo
   - Password: student123
   - Account Type: Student

## Option 2: Use Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to Authentication > Users
3. Click "Add user" and create:
   - Email: admin@facexam.demo
   - Password: admin123
   - Auto-confirm email: Yes
4. Then manually insert the role in SQL Editor:
   ```sql
   INSERT INTO user_roles (user_id, role)
   VALUES ('[admin-user-id-from-auth]', 'admin');
   ```
5. Repeat for student account

## Option 3: I'll create a setup script

Let me create a proper initialization script...
