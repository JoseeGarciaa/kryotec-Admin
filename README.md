# Kryotec MVC

## Descripción del Proyecto

Kryotec es una aplicación web desarrollada con React y TypeScript que sigue el patrón de arquitectura Modelo-Vista-Controlador (MVC). Esta estructura proporciona una clara separación de responsabilidades, lo que facilita el mantenimiento y la escalabilidad del código.

## Estructura del Proyecto

El proyecto está organizado siguiendo el patrón MVC de la siguiente manera:

### Modelo (src/models/)

Contiene la lógica de negocio y el acceso a datos:

- `AuthModel.ts`: Gestiona la autenticación y los datos de usuario.
- `ThemeModel.ts`: Maneja la lógica del tema (claro/oscuro) de la aplicación.
- `types/`: Contiene las definiciones de tipos TypeScript utilizadas en toda la aplicación.
  - `auth.ts`: Tipos relacionados con la autenticación.
  - `theme.ts`: Tipos relacionados con el tema.

### Vista (src/views/)

Contiene los componentes de presentación:

- `auth/`: Componentes relacionados con la autenticación.
  - `LoginView.tsx`: Vista de inicio de sesión.
  - `components/`: Componentes específicos de autenticación.
- `dashboard/`: Componentes del panel de administración.
- `routing/`: Componentes de enrutamiento.
  - `AppRouter.tsx`: Enrutador principal de la aplicación.
- `shared/`: Componentes compartidos.
  - `ui/`: Componentes de interfaz de usuario reutilizables (botones, inputs, etc.).
- `contexts/`: Contextos de React que conectan los controladores con las vistas.
  - `AuthContext.tsx`: Contexto para la autenticación.
  - `ThemeContext.tsx`: Contexto para la gestión del tema.

### Controlador (src/controllers/)

Conecta los modelos con las vistas:

- `AuthController.ts`: Controlador para la autenticación.
- `ThemeController.ts`: Controlador para la gestión del tema.

## Tecnologías Utilizadas

- React
- TypeScript
- Vite
- CSS Modules

## Instalación y Ejecución

1. Clonar el repositorio:
   ```bash
   git clone [url-del-repositorio]
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Ejecutar en modo desarrollo:
   ```bash
   npm run dev
   ```

## Convenciones de Código

- **Nomenclatura**: Utilizamos PascalCase para componentes y camelCase para variables y funciones.
- **Tipos**: Todas las interfaces y tipos se definen en la carpeta `models/types/`.
- **Componentes**: Los componentes de React se organizan por funcionalidad en la carpeta `views/`.

## Mantenimiento

Para añadir nuevas funcionalidades al proyecto:

1. Crear los tipos necesarios en `models/types/`.
2. Implementar la lógica de negocio en `models/`.
3. Crear el controlador correspondiente en `controllers/`.
4. Desarrollar los componentes de vista en `views/`.
5. Si es necesario, actualizar los contextos en `views/contexts/`.

## Flujo de Datos en el Patrón MVC

1. **Modelo**: Contiene la lógica de negocio y el acceso a datos
   - Responsable de recuperar/almacenar datos
   - No depende de la Vista ni del Controlador

2. **Vista**: Presenta la información al usuario
   - Muestra los datos proporcionados por el Controlador
   - Envía las acciones del usuario al Controlador

3. **Controlador**: Actúa como intermediario
   - Recibe acciones de la Vista
   - Interactúa con el Modelo para obtener/modificar datos
   - Actualiza la Vista con los nuevos datos

## Tecnologías Utilizadas

- React
- TypeScript
- TailwindCSS
- Vite

## Cómo Ejecutar el Proyecto

1. Instalar dependencias:
   ```
   npm install
   ```

2. Ejecutar en modo desarrollo:
   ```
   npm run dev
   ```

3. Construir para producción:
   ```
   npm run build
   ```

## Credenciales de Prueba

- Email: admin@kruotecsense.com
- Contraseña: admin123

## Inventario Prospectos: flujo Excel

- Desde la vista de Inventario, usa el botón "Plantilla" para descargar el Excel base (alineado al esquema: Descripcion, Producto, Largo_mm, Ancho_mm, Alto_mm, Cantidad, Fecha_Despacho, Orden_Despacho, Notas).
- Selecciona un Cliente en el selector adjunto y luego haz clic en "Importar" para subir el .xlsx rellenado.
- Backend: POST /api/inventario-prospectos/import (multipart/form-data: file, cliente_id). Valida, evita duplicados por cliente + producto + dimensiones + cantidad + orden, e inserta en bloque.
