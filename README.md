<img src="./src/assets/images/credocube-logo.png" alt="Kryotec" width="160" />

# Kryotec Admin Platform

Panel administrativo para la gestión de clientes, credocubes, inventarios y usuarios. Arquitectura basada en React + TypeScript (frontend) y Node.js + Express (API integrada en el mismo repositorio). Sigue un enfoque modular tipo MVC adaptado al entorno frontend + capa de servicios backend.

## 1. Resumen Ejecutivo

Este panel permite:
- Autenticación segura (JWT, bcrypt).
- Gestión de Tenants / Clientes (multi‑entidad lógica).
- Gestión de usuarios internos.
- Administración de credocubes e inventario (incluyendo importación masiva vía Excel).
- Visualización de métricas y gráficos (Chart.js + react-chartjs-2).
- Tema oscuro/claro persistente.

## 2. Arquitectura General

Monorepo ligero (frontend + backend expresivo en `src/server`).

| Capa | Descripción |
|------|-------------|
| Vistas (`src/views`) | Componentes React + rutas (Vite + React Router). |
| Controladores (`src/controllers`) | Orquestan peticiones hacia servicios / modelos. |
| Modelos (`src/models`) | Tipos y estructuras de dominio. |
| Servicios API (`src/services/api.ts`) | Cliente HTTP (axios) hacia backend. |
| Backend (`src/server`) | Express + rutas REST `/api/*`. Sirve `dist` en producción. |
| Utilidades (`src/utils`) | Helpers (fechas, responsive, plantillas Excel). |

### Flujo Simplificado
1. Usuario interactúa en la vista (React Components).
2. Controlador/hook dispara llamada al servicio (`api.ts`).
3. Backend Express procesa (controladores + acceso a PostgreSQL).
4. Respuesta se normaliza y actualiza estado/contextos.

## 3. Stack Tecnológico

- Frontend: React 18, TypeScript, Vite, TailwindCSS, Chart.js, React Router.
- Backend: Node.js, Express, PostgreSQL (`pg`, `pg-format`), Multer (uploads), ExcelJS / XLSX.
- Seguridad: JWT, bcrypt, CORS controlado (FRONTEND_URL), headers recomendados (ver sección Seguridad).
- Deploy: systemd + Nginx + Let’s Encrypt.

## 4. Estructura de Carpetas (principal)

```
src/
  server/              # API Express
  views/               # Vistas React (auth, dashboard, etc.)
  controllers/         # Lógica de orquestación frontend
  models/              # Tipos / modelos dominio
  services/            # Cliente API
  utils/               # Utilidades varias
  assets/              # Imágenes y estáticos
deploy/                # Scripts y ejemplos despliegue
```

## 5. Variables de Entorno (backend)

Crear archivo `.env` en raíz (no se versiona):

```
PORT=3002
NODE_ENV=production
DB_HOST=localhost
DB_USER=usuario
DB_PASSWORD=secreto
DB_NAME=kryosense
JWT_SECRET=clave_super_secreta
FRONTEND_URL=https://admin.kryotecsense.com
```

Notas:
- En rama `DEV` puede usarse `DB_NAME=kryosense_test`.
- Cambiar `FRONTEND_URL` si se despliega en otro dominio/subdominio.

## 6. Scripts NPM

| Script | Uso |
|--------|-----|
| `npm run dev` | Dev frontend (Vite) + usar aparte `npm run server` si se quiere API local. |
| `npm run server` | Levanta backend Express (con .env). |
| `npm run dev:all` | Frontend + backend concurrentes. |
| `npm run build` | Compila frontend a `dist/`. Backend usa TypeScript nativo (JS en runtime). |
| `npm start` | Ejecuta backend sirviendo `dist` (modo producción). |
| `npm run lint` | Linter. |

## 7. Desarrollo Local

```
git clone <repo>
cd kryotec-Admin
npm install
npm run dev:all
```
Frontend: http://localhost:5173  | Backend API: http://localhost:3002 (ajustar puerto si se define en .env).

## 8. Despliegue Producción (Resumen)

1. Clonar en servidor: `/var/www/kryotec-admin`.
2. Crear `.env` (ver sección 5).
3. Instalar dependencias: `npm install`.
4. Build: `npm run build`.
5. Crear servicio systemd (ejemplo en `deploy/kryotec-admin.service`).
6. Configurar Nginx (ejemplo `deploy/nginx-admin.conf.example`).
7. Emitir SSL: `certbot --nginx -d admin.kryotecsense.com`.
8. Reiniciar: `sudo systemctl restart kryotec-admin`.
9. Verificar: `curl -I https://admin.kryotecsense.com/api/health`.

Script automatizado: `bash deploy/deploy-admin.sh`.

> Nota: En versiones anteriores de esta documentación se usaba la ruta `/var/www/kryotec-admin`. Si tu carpeta real en el servidor es solamente `/var/www/admin` (porque así se creó inicialmente), no es necesario renombrarla. Solo asegúrate de que el `WorkingDirectory` dentro del servicio systemd apunte a la carpeta correcta. Ejemplo para verificar:
>
> ```bash
> systemctl cat kryotec-admin | grep WorkingDirectory
> ls -lah /var/www
> ```
>
> Si deseas unificar nombres por claridad, puedes (opcional):
> ```bash
> sudo systemctl stop kryotec-admin
> sudo mv /var/www/admin /var/www/kryotec-admin
> sudo sed -i 's|/var/www/admin|/var/www/kryotec-admin|' /etc/systemd/system/kryotec-admin.service
> sudo systemctl daemon-reload
> sudo systemctl start kryotec-admin
> ```
> Pero esto es solo cosmético; funcionalmente no cambia nada.

## 9. Flujo de Actualización (Deploy Incremental)

```
cd /var/www/kryotec-admin
git pull origin main
npm install        # solo si cambió package.json
npm run build      # si hubo cambios frontend
sudo systemctl restart kryotec-admin
```

## 10. Seguridad (Headers Recomendados Nginx)

Ejemplo para añadir en bloque `server {}` HTTPS:

```
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header Content-Security-Policy "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https://admin.kryotecsense.com; font-src 'self' data:;" always;
```

Adaptar `connect-src` según dominios externos necesarios.

## 11. Inventario: Importación Excel

Proceso:
1. Descargar plantilla desde botón "Plantilla" (estructura base columnas: Descripcion, Producto, Largo_mm, Ancho_mm, Alto_mm, Cantidad, Fecha_Despacho, Orden_Despacho, Notas).
2. Completar archivo.
3. Seleccionar Cliente en UI.
4. Usar botón "Importar" y subir `.xlsx`.
5. Backend: `POST /api/inventario-prospectos/import` (form-data: `file`, `cliente_id`).

Validaciones:
- Evita duplicados por: cliente + producto + dimensiones + cantidad + orden.
- Inserción en bloque optimizada.

## 12. Endpoints Clave

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/health` | GET | Verificación rápida de estado. |
| `/api/auth/login` | POST | Autenticación (body: `{ correo, contraseña }`). |
| `/api/tenants` | CRUD | Gestión de tenants/clientes. |
| `/api/usuarios` | CRUD | Gestión de usuarios. |
| `/api/credocubes` | CRUD | Gestión de credocubes. |
| `/api/inventario-prospectos/import` | POST | Importar inventario Excel. |

## 13. Estrategia de Ramas

- `main`: Producción (DB principal `kryosense`).
- `DEV`: Entorno pruebas (schema / DB `kryosense_test`).

Flujo sugerido: feature branch → PR a `DEV` → pruebas → merge a `main` → deploy.

## 14. Próximos Pasos (Opcionales)

- Añadir endpoint `/api/version` leyendo `package.json` para trazar despliegues.
- Integrar monitoreo (Uptime / logs centralizados).
- Job programado de backups PostgreSQL.
- Tests automatizados (Jest + supertest para API).
- Mejorar CSP con directivas más específicas según recursos externos.

## 15. Créditos

Desarrollado para la plataforma Kryotec. Uso interno / clientes autorizados.

---

Si necesitas más detalle operativo ver carpeta `deploy/`. Cualquier ajuste adicional de seguridad o monitoreo se puede añadir sobre esta base.

