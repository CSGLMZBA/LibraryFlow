# S1-AUTH-01 — Auth boundary (Bryan)

## Alcance exclusivo

Registro, inicio de sesión, contraseñas, sesiones, roles y guards; el frontend visual de Dante y la UI Reader de Karlo quedan fuera de esta rama.

## Archivos

- `apps/frontend/src/types/auth.ts`: contrato `AuthPort` y tipos de sesión/usuario.
- `apps/frontend/src/schemas/auth-schema.ts`: validaciones de credenciales y de rol permitido.
- `apps/frontend/src/repositories/auth-indexeddb.ts`: usuarios/sesiones en IndexedDB.
- `apps/frontend/src/services/auth-service.ts`: implementación local y comprobación de roles.
- `apps/backend/src/middleware/auth-guard.ts`: guard inyectable para verificación de tokens del servidor. **No valida tokens por sí solo**.
- `docs/testing/S1-AUTH-01-TEST-PLAN.md`: casos y evidencias.

## Seguridad y límites

- Las contraseñas locales se derivan con PBKDF2-SHA256, sal aleatoria de 16 bytes y 210 000 iteraciones; modo **desarrollo/prueba**, no repositorio de credenciales productivo.
- El registro público solo permite `reader` y `publisher`.
- Un rol almacenado localmente no autoriza ninguna acción REST protegida.
- El backend requiere verificador real de token (Firebase compatible) inyectado, verificación de usuario y rol del lado del servidor; se debe conectar a las rutas en colaboración con el equipo.
- No hay cuenta moderador sembrada, adaptador Firebase ni endpoints REST integrados en esta entrega. Necesitan configuración/contratos y coordinación con Juan, Carlos y Jorge; no se deben simular como completados.

## Control de cambios

Preparado desde los archivos base de autenticación, **sin cambios en `App.tsx`, estilos, catálogo, comentarios, descargas ni componentes ajenos**. Se recomienda crear rama nueva desde `origin/develop` para evitar introducir los commits anteriores Reader en el PR.

## Verificación

- Comprobación TypeScript de los módulos frontend: ejecutada en entorno de preparación, ver resultado en mensaje de entrega.
- Backend real con Express, pruebas Browser/IndexedDB y Firebase: pendientes de ejecutar dentro de LibraryFlow.
- Sin push ni merge remoto.
