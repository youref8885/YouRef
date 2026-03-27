# Documentación Técnica: CRM YouRef

Este documento proporciona una visión general de la arquitectura, flujos y configuración del **CRM YouRef**, diseñado para la gestión ejecutiva de referidos inmobiliarios.

## 1. Arquitectura del Proyecto

El proyecto está dividido en dos partes principales:
- **Frontend (`/client`)**: Construido con React, Vite y TailwindCSS. Sigue un diseño SPA (Single Page Application) con una estética corporativa premium.
- **Backend (`/server`)**: API REST construida con Node.js y Express, utilizando Supabase como base de datos y sistema de autenticación.

## 2. Estructura de Directorios

### Frontend (`/client`)
- `/src/components`: Componentes reutilizables de UI, formularios y layouts.
- `/src/components/layout/AuthenticatedApp.jsx`: Componente principal que gestiona la navegación y el estado de la aplicación una vez autenticado.
- `/src/components/dashboard`: Componentes específicos para visualización de métricas (Embudo de ventas, StatCards, MiniBars).

### Backend (`/server/src`)
- `server.js`: Punto de entrada de la aplicación y definición de rutas principales de referidos.
- `adminRoutes.js`: Rutas exclusivas para administradores (invitaciones, gestión de equipo, reportes Excel).
- `emailService.js`: Servicio centralizado para el envío de correos, con soporte para SMTP y EmailJS.
- `dashboardService.js`: Lógica para el cálculo de KPIs y métricas del dashboard.

## 3. Flujos Críticos

### Invitación y Registro de Socios
1. Un administrador envía una invitación desde el panel de **Equipo**.
2. Se genera un código OTP (One Time Password) y se registra al usuario como no verificado.
3. Se envía un correo profesional mediante **EmailJS** con un enlace de registro y el código OTP.
4. El socio usa el enlace, valida su código y completa sus datos para activar la cuenta.

### Gestión de Referidos
- **Validación de RUT**: Se sanitiza y valida la duplicidad de cada RUT antes de ingresar un referido para evitar datos basura.
- **Pipeline**: Los referidos pasan por etapas (Contacto, Gestión, Cierre) y estados específicos que reflejan su progreso comercial.

## 4. Configuración (Variables de Entorno)

### Servidor (`.env`)
- `PORT`: Puerto de ejecución.
- `CLIENT_URL`: URL del frontend (para CORS y enlaces de correo).
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`: Conexión con la base de datos.
- `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY`: Credenciales para el envío de invitaciones.

## 5. Reportes y Descargas
Los administradores pueden descargar reportes en formato **XLSX** desde la pestaña de **Descargas**. Estos reportes incluyen métricas de rendimiento por socio y zonas críticas.

---
*Documentación generada y sincronizada para entrega final.*

*Documento generado para facilitar la integración de nuevos desarrolladores al proyecto.*
