# S1-AUTH-01 — Integración de autenticación (Bryan)

**Propósito:** complementar el servicio local de Sprint 1, sin implementar vistas Reader, Publisher ni herramientas administrativas de moderación.

## Cambios de esta actualización

- Cuenta de prueba de moderador disponible **solo en Vite DEV**. Creación explícita por consola y contraseña elegida durante la prueba; no hay contraseña fija en el repositorio. El registro público continúa limitado a `reader` y `publisher`.
- Validación HTTP de registro/login según SPEC-001 (correo ≤50, contraseña 8–128, complejidad y roles permitidos).
- Firebase Admin en el backend, con roles tomados de *custom claims* y validación de ID tokens con comprobación de revocación; no se acepta un rol enviado por el navegador.
- Endpoints `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/session`.
- Credenciales de usuarios creadas o verificadas en Firebase, no en el backend propio. Registro de nombre de usuario único mediante transacción en Firestore.
- `auth-cloud-adapter.ts`: adaptador navegador que consume los endpoints de la API con la misma interfaz `AuthPort` del servicio local. El token se mantiene solo en memoria (no localStorage); el usuario debe volver a autenticarse tras recargar en modo nube, pendiente de integración con Firebase JS SDK por parte del equipo.
- Pruebas automatizadas sin credenciales para validación y guard. Plan de integración y casos manuales.

## Dependencias e integración

- Requiere `firebase-admin` en `apps/backend/package.json`. Instalar con `npm.cmd install` desde raíz; no incluir contraseñas, claves privadas, archivos `.env` ni cuentas reales en Git.
- Configure `APP_MODE=cloud`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_WEB_API_KEY`. El usuario del backend debe tener acceso a Firestore y Firebase Auth; Firestore debe estar habilitado.
- En despliegue cloud, se debe usar HTTPS y gestionar las variables por secreto de plataforma.
- No modificar el servicio `auth-service.ts` de Dante ni sus pantallas sin coordinación. Dante utiliza `AuthResult` y un `AuthContext` síncrono; el contrato de Bryan utiliza métodos asincrónicos y sesiones sin token en la versión local. Dante deberá adaptar su contexto para consumir el servicio común, o incorporar un puente en su integración.
- Juan debe aprobar el contrato de respuesta `{success,data}` y `{success:false,error:{code,message,field?}}` y coordinar la ubicación definitiva de los tipos compartidos en `packages/shared`.
- Jorge debe validar el flujo del moderador de prueba y los permisos en los módulos de moderación.
- Las rutas de libros, comentarios y moderación pertenecen a otros; su protección debe llamar a `createAuthGuard(verifyFirebaseIdentity, 'rol')` desde cada módulo apropiado.

## Riesgos conocidos

- Los endpoints cloud requieren credenciales y servicios externos: no declarar probados sin un proyecto Firebase configurado.
- `POST /logout` revoca los refresh tokens en Firebase, pero el cliente debe descartar su ID token y el proveedor aplica su semántica de revocación.
- El adapter cloud usa token efímero en memoria y pierde la sesión tras recargar, hasta integrar persistencia de Firebase SDK/refresh tokens.
- La cuenta local de moderador no autentica en cloud. No usar contraseñas personales de verdad en IndexedDB ni en la consola de pruebas.

## Verificación

- Añadidas pruebas de validación y guard sin servicios externos (`docs/testing/auth-validation.test.mjs`).
- El comando TypeScript debe ejecutarse en el clon real tras `npm.cmd install`, porque aquí no se dispone de paquetes externos para compilar completamente Firebase Admin/Express.
- Estado de QA de `S1-AC-001`: pendiente hasta registrar evidencias reales con Cesar.
