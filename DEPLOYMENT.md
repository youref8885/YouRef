# Guía de Despliegue - CRM YouRef

Este proyecto está configurado para ser desplegado en **Render** (Backend) y **Vercel** (Frontend).

## 1. Backend (Render)

1. Crea un nuevo **Web Service** en Render.
2. Conecta tu repositorio de GitHub.
3. Configura los siguientes parámetros:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Agrega las siguientes **Variables de Entorno**:
   - `PORT`: 4000 (o el que prefieras, Render lo asignará automáticamente si no se pone)
   - `SUPABASE_URL`: Tu URL de proyecto Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY`: Tu Service Role Key de Supabase.
   - `CLIENT_URL`: La URL de tu frontend en Vercel (ej: `https://crm-youref.vercel.app`). Puedes poner varias separadas por coma.
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: Configuración para el servicio de correos. (Opcional: Si no se ponen, los correos se imprimirán en la consola del servidor en Render).
   - `MAIL_FROM`: Remitente de los correos (ej: `CRM YouRef <no-reply@youref.cl>`).

## 2. Frontend (Vercel)

1. Crea un nuevo proyecto en Vercel.
2. Conecta tu repositorio de GitHub.
3. Configure los siguientes parámetros:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Agrega la siguiente **Variable de Entorno**:
   - `VITE_API_URL`: La URL de tu backend en Render (ej: `https://crm-youref-backend.onrender.com/api`).

## Notas Importantes

- El archivo `client/vercel.json` ya está configurado para manejar el enrutamiento de Single Page Application (SPA).
- Asegúrate de que las URLs en las variables de entorno no terminen en diagonal `/` a menos que sea necesario.
- Si usas Supabase, asegúrate de haber ejecutado las migraciones SQL necesarias en tu base de datos.
