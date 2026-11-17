# S1-AUTH-01 — casos de verificación para Bryan

**Responsable:** Bryan. **Estado:** por ejecutar en el navegador y registrar evidencias. No marcar como aprobado sin pruebas.

Requisitos: ejecutar `npm.cmd run typecheck` y `npm.cmd run dev:frontend` desde la raíz del repositorio, después de copiar los archivos. Abrir `http://localhost:5173`, F12 → Console. Usar solo credenciales inventadas.

```js
const { localAuthService: auth } = await import('/src/services/auth-service.ts');
const email = `bryan-test-${Date.now()}@example.com`;
const password = 'Prueba123!';
const session = await auth.register(email, password, 'reader');
console.assert(session.user.role === 'reader', 'REGISTRO: rol incorrecto');
console.assert(await auth.hasRole('reader'), 'ROL: debería permitir reader');
console.assert(!(await auth.hasRole('moderator')), 'ROL: no debería permitir moderator');
await auth.logout();
console.assert(await auth.getCurrentSession() === null, 'LOGOUT: quedó sesión');
await auth.login(email, password);
console.assert((await auth.getCurrentSession())?.user.email === email, 'LOGIN: correo incorrecto');
// Recargar la página y comprobar que getCurrentSession() sigue devolviendo el usuario.
```

### Casos manuales que deben registrarse

| ID | Acción | Resultado esperado | Evidencia | Estado |
|---|---|---|---|---|
| AUTH-01 | Registrar `reader` con correo único y contraseña válida | Cuenta creada, nombre con 4 dígitos | Captura/consola | Pendiente |
| AUTH-02 | Registrar `publisher` | Cuenta con rol `publisher` | Captura/consola | Pendiente |
| AUTH-03 | Registrar el mismo correo dos veces | Error `EMAIL_ALREADY_EXISTS`, sin duplicar | Captura/consola | Pendiente |
| AUTH-04 | Correo incorrecto o contraseña sin complejidad | Error de campo `VALIDATION_ERROR` | Captura/consola | Pendiente |
| AUTH-05 | Contraseña incorrecta | `INVALID_CREDENTIALS`, sin revelar campo incorrecto | Captura/consola | Pendiente |
| AUTH-06 | Cerrar sesión y recargar | Sesión ausente | Captura/consola | Pendiente |
| AUTH-07 | Registrar `moderator` públicamente | Rechazado | Captura/consola | Pendiente |
| AUTH-08 | `hasRole` con rol diferente | `false` | Captura/consola | Pendiente |
| AUTH-09 | Guard Express sin bearer / con token inválido | 401, nunca confía en rol del body | Prueba backend | Pendiente |
| AUTH-10 | Guard Express con identidad validada y rol equivocado | 403 | Prueba backend | Pendiente |
| AUTH-11 | IndexedDB no disponible o datos corruptos | Error recuperable, sin acceso otorgado | Prueba browser | Pendiente |
| AUTH-12 | Integración con autenticación Firebase | Adaptador, tokens y verificación desplegada | Integración Carlos/Juan/Dante | **Bloqueado** |
| AUTH-13 | Cuenta moderador de prueba | Prueba de rol/guard | Integración Jorge | **Bloqueado** |

**Criterios:** `US-REA-010` CA-001–004, CA-006–007 y `SPEC-001` §§3, 5, 6, 11; registrar en `S1-ACCEPTANCE-REGISTER.md` solo al ejecutar.
