# Checklist de S1-AUTH-01 (Bryan) — verificación antes del PR

## Automatizado (sin Firebase)

1. En VS Code, desde la raíz del repo: `npm.cmd install`.
2. Ejecutar `npm.cmd run typecheck`.
3. Ejecutar `node --import tsx --test docs/testing/auth-validation.test.mjs`.
4. Guardar capturas o salida con fecha; no marcar QA como Passed sin ejecutarlas.

## Mock IndexedDB (navegador)

1. `npm.cmd run dev:frontend`, abrir `http://localhost:5173` y DevTools Console (solo datos de prueba).
2. Importar `const {localAuthService: auth, seedLocalModeratorForTests} = await import('/src/services/auth-service.ts')`.
3. Registrar correo de prueba único con contraseña inventada (`reader`), obtener sesión y comprobar `hasRole('reader')`.
4. `await auth.logout()` y comprobar `await auth.getCurrentSession() === null`.
5. `await auth.login(correo, contrasena)` y verificar persistencia tras recargar.
6. Probar correo repetido, formato inválido, contraseña inválida, rol `moderator` por registro público (debe rechazarse).
7. Crear moderador con `await seedLocalModeratorForTests('ClaveDePrueba123!')`, iniciar sesión con `moderator@libraryflow.local` y la contraseña de prueba, comprobar `await auth.hasRole('moderator') === true`.
8. Cerrar sesión. Nunca registrar la contraseña de prueba como una credencial de producción.

## Cloud (requerirá proyecto y colaboración)

1. Preparar Firebase Authentication email/password y Firestore, habilitar cuenta de servicio con permisos mínimos.
2. Definir en backend las variables `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_WEB_API_KEY` en entorno seguro.
3. En modo cloud ejecutar API y probar `POST /api/v1/auth/register` con reader/publisher, comprobar retorno `201` y custom claims reales. Probar intento `moderator` -> `400`.
4. Probar correo duplicado -> `409`, credenciales incorrectas -> `401` con mensaje genérico, y ausencia de token -> `401`.
5. Probar token válido en `GET /session`, token falso -> `401`; logout y revocación.
6. Integrar el `AuthContext` de Dante con el adaptador escogido y verificar que renderiza roles, error de validación y login correctamente.
7. Probar guards en las rutas reales de Juan/Jorge: `reader` no puede crear libros ni moderar, `publisher` no puede aprobar, `moderator` puede acceder solo a lo autorizado.
8. Registrar evidencia con César y añadir la traza `US-REA-010` CA-001–004, 006–007 y `US-MOD-010` CA-001.

## Limitaciones explícitas

- No hay claves Firebase incluidas; el código no puede funcionar en nube sin configuración externa.
- La persistencia de sesión cloud después de recarga depende de un adaptador con Firebase JS SDK/refresh que todavía debe coordinarse.
- El contrato de `packages/shared` aún está en PR de Juan, y su integración no debe realizarse a espaldas de la arquitectura del equipo.
