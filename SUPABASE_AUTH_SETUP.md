# Supabase Authentication & Google OAuth Configuration Guide

This guide explains how to configure Supabase Auth, Email OTP, and Google OAuth for **LinkedIn Hunter V2**.

---

## 1. Supabase Auth Overview & Public Signup

1. Log in to the [Supabase Dashboard](https://supabase.com/dashboard) and open your project.
2. Navigate to **Authentication** -> **Configuration** -> **Sign In / Up**.
3. Under **User Signups**:
   - Ensure **Allow new users to sign up** is set to **Enabled** (ON).
   - Under **Email Confirmations**, ensure **Confirm email** is set to **Enabled** (ON).
   - This ensures users must verify their email with a 6-digit numeric OTP before their account is confirmed.

---

## 2. Email OTP Configuration & Templates

To ensure Supabase Auth delivers a 6-digit numeric OTP code instead of or in addition to a magic link:

1. Navigate to **Authentication** -> **Email Templates**.
2. Select the **Confirmation (Signup)** template:
   - **Subject**: `Confirm your LinkedIn Hunter account`
   - **Body (HTML)**:
     ```html
     <h2>Welcome to LinkedIn Hunter V2!</h2>
     <p>Your one-time verification code is:</p>
     <div style="font-size: 28px; font-weight: bold; letter-spacing: 6px; padding: 12px; background: #f3f4f6; border-radius: 8px; display: inline-block; font-family: monospace;">
       {{ .Token }}
     </div>
     <p>Enter this 6-digit code in the verification screen to activate your account.</p>
     <p>This code will expire in 60 minutes.</p>
     ```
   - **Important**: Supabase provides `{{ .Token }}` as the numeric OTP.
3. Select the **Reset Password** template:
   - **Subject**: `Reset your LinkedIn Hunter password`
   - **Body (HTML)**:
     ```html
     <h2>Reset Your Password</h2>
     <p>Follow this link to reset your LinkedIn Hunter account password:</p>
     <p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
     <p>Or use this token if prompted: <strong>{{ .Token }}</strong></p>
     ```

---

## 3. Custom Email Delivery (SMTP)

By default, Supabase's built-in email service is rate-limited (3-4 emails per hour). For production or reliable local testing:

1. Navigate to **Authentication** -> **Configuration** -> **Email Settings**.
2. Scroll to **Custom SMTP Provider** and toggle **Enable Custom SMTP**.
3. Fill in your SMTP provider details (e.g. Resend, SendGrid, Amazon SES, Postmark):
   - **Sender Email**: `noreply@yourdomain.com`
   - **Sender Name**: `LinkedIn Hunter V2`
   - **Host**: e.g., `smtp.resend.com`
   - **Port**: `587` (or `465` for SSL)
   - **Username**: e.g., `resend`
   - **Password**: your SMTP API Key / Password
4. Save and send a test email to verify connectivity.

---

## 4. Google Cloud Console OAuth Configuration

To support "Continue with Google":

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Select your project or create a new one (e.g., `linkedin-hunter-prod`).
3. Navigate to **APIs & Services** -> **OAuth consent screen**:
   - User Type: **External**.
   - App Name: `LinkedIn Hunter V2`.
   - User support email & Developer contact info: your contact email.
   - Scopes: Add `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid`.
   - Save and proceed.
4. Navigate to **APIs & Services** -> **Credentials**:
   - Click **+ Create Credentials** -> **OAuth client ID**.
   - Application type: **Web application**.
   - Name: `LinkedIn Hunter Supabase Auth`.
   - **Authorized JavaScript origins**:
     - `http://localhost:3000`
     - `http://localhost:3001`
     - `https://your-production-domain.com`
     - `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co`
   - **Authorized redirect URIs**:
     - `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
   - Click **Create**.
   - Copy the generated **Client ID** and **Client Secret**.

---

## 5. Enable Google Provider in Supabase

1. In Supabase Dashboard, go to **Authentication** -> **Providers** -> **Google**.
2. Toggle **Enable Google provider**.
3. Paste:
   - **Client ID**: `<Your-Google-Client-ID>`
   - **Client Secret**: `<Your-Google-Client-Secret>`
4. Leave **Skip nonce check** unchecked.
5. Click **Save**.

---

## 6. URL Configuration & Redirect URLs

1. In Supabase Dashboard, go to **Authentication** -> **URL Configuration**.
2. Set **Site URL**:
   - Development: `http://localhost:3000` (or `http://localhost:3001`)
   - Production: `https://your-production-domain.com`
3. Under **Redirect URLs**, add all allowed application callback URLs:
   - `http://localhost:3000/**`
   - `http://localhost:3001/**`
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3001/auth/callback`
   - `http://localhost:3000/reset-password`
   - `http://localhost:3001/reset-password`
   - `https://your-production-domain.com/**`
   - `https://your-production-domain.com/auth/callback`
   - `https://your-production-domain.com/reset-password`
4. Click **Save Changes**.

---

## 7. Rate Limits, OTP Expiry, and Security

1. In **Authentication** -> **Configuration** -> **Rate Limits**:
   - **Email OTP Expiry**: Set to `3600` seconds (1 hour) or your preferred window.
   - **Email rate limit**: Default is 30 emails per hour (custom SMTP increases this).
   - In the frontend UI, a 60-second cooldown timer is enforced between resend requests to protect your quota.
2. In **Authentication** -> **Configuration** -> **Sessions**:
   - Set JWT expiry (default is 3600 seconds = 1 hour).
   - Refresh tokens are automatically rotated and managed by the Supabase JS client.

---

## 8. Database Trigger for Profiles

The PostgreSQL trigger function `public.handle_new_user()` is configured in the database to automatically create a profile in `public.profiles` whenever a new user confirms signup or logs in with Google OAuth:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_first_name text := '';
  v_last_name text := '';
  v_full_name text := '';
BEGIN
  -- Extract full name from metadata (supports both Email signup and Google OAuth)
  v_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    ''
  );
  
  IF v_full_name <> '' THEN
    v_first_name := split_part(v_full_name, ' ', 1);
    v_last_name := trim(substring(v_full_name from length(v_first_name) + 1));
  END IF;

  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    email,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    v_first_name,
    v_last_name,
    coalesce(new.email, ''),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    first_name = CASE WHEN profiles.first_name = '' THEN EXCLUDED.first_name ELSE profiles.first_name END,
    last_name = CASE WHEN profiles.last_name = '' THEN EXCLUDED.last_name ELSE profiles.last_name END,
    updated_at = now();

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 9. Environment Variables

### Frontend (`frontend/.env`)
```bash
# Public Supabase credentials
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>

# Backend API URL
VITE_API_URL=http://localhost:8000
```

### Backend (`.env`)
```bash
# Supabase project URL and keys
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>

# JWKS URL for asymmetric JWT verification (ES256/RS256)
SUPABASE_JWKS_URL=https://<your-project-ref>.supabase.co/auth/v1/.well-known/jwks.json

# Database Connection (Direct or Pooled)
DATABASE_URL=postgresql://postgres:<password>@db.<your-project-ref>.supabase.co:5432/postgres

# Application Settings
ENVIRONMENT=development
FRONTEND_ORIGIN=http://localhost:3000
CORS_ORIGINS=["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"]
```

---

## 10. Local Development & Verification

### Start the Backend
```bash
# From workspace root
PYTHONPATH=.:src ./linkedin-hunter/.venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Start the Frontend
```bash
cd frontend
npm run dev
```

### Testing the User Flows
1. **Email OTP Signup**:
   - Go to `http://localhost:3000/signup` (or `http://localhost:3001/signup`).
   - Fill in Full Name, Email, Password, and Confirm Password.
   - Click **Create account**.
   - You will be redirected to `http://localhost:3000/verify-email?email=<encoded_email>`.
   - Check your inbox for the 6-digit OTP code.
   - Enter the 6-digit code and click **Verify Email**.
   - Upon verification, the session is created and you are redirected to `/dashboard`.
2. **Resend OTP & Cooldown**:
   - On the verification screen, click **Resend code**.
   - Verify the countdown timer displays `60s` and prevents duplicate clicks.
3. **Google OAuth**:
   - Click **Continue with Google** on either `/signup` or `/login`.
   - Select your Google Account.
   - Google redirects back to `/auth/callback` which restores the session and redirects to `/dashboard`.
4. **Password Recovery**:
   - Go to `/forgot-password`, enter your email, and submit.
   - Click the recovery link in your email to navigate to `/reset-password`.
   - Enter a new password and save.
