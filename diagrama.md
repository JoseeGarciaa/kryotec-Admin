# Diagramas de estado del sistema Kryotec Admin

## Autenticación y seguridad

### AdminUser
```mermaid
stateDiagram-v2
    direction LR
    state "Activo" as ActivoState
    state "Debe cambio Pwd" as DebeCambioPwd
    state "Bloqueo temporal" as BloqueoTemporal
    state "Bloqueo manual" as BloqueoManual
    state "Inactivo" as InactivoState

    [*] --> Registrado : createUser()
    Registrado --> ActivoState : login ok
    ActivoState --> DebeCambioPwd : pwd expira
    DebeCambioPwd --> ActivoState : changePassword
    ActivoState --> BloqueoTemporal : muchos intentos
    BloqueoTemporal --> ActivoState : minutos cumplidos
    ActivoState --> BloqueoManual : admin bloquea
    BloqueoManual --> ActivoState : admin desbloquea
    ActivoState --> InactivoState : inactivar o eliminar
    InactivoState --> ActivoState : reactivar
```

### Sesion administrativa (JWT)
```mermaid
stateDiagram-v2
    direction TB
    [*] --> Emitida : login()
    Emitida --> Activa : token guardado en cliente
    Activa --> Renovada : login repetido || cambio de contrasena forzada
    Activa --> Expirada : session_timeout_minutos cumplido
    Activa --> Revocada : logout || bloqueo usuario
    Renovada --> Activa
    Expirada --> [*]
    Revocada --> [*]
```

### Historial de contraseñas
```mermaid
stateDiagram-v2
    direction TB
    [*] --> Registrada : recordPasswordHistory()
    Registrada --> Vigente : dentro de PASSWORD_HISTORY_LIMIT
    Vigente --> Depurada : trimPasswordHistory()
    Depurada --> [*]
```

## Tenants y aprovisionamiento multiesquema

### Tenant global
```mermaid
stateDiagram-v2
    direction TB
    [*] --> Onboarding : createTenant()
    Onboarding --> Provisionando : crear_tenant()
    Provisionando --> Activo : estado=true && schema ok
    Provisionando --> Fallido : crear_tenant() error
    Fallido --> Onboarding : reintento
    Activo --> Suspendido : updateTenant estado=false
    Suspendido --> Activo : updateTenant estado=true
    Activo --> Eliminado : deleteTenant()
    Suspendido --> Eliminado : deleteTenant()
    Eliminado --> [*]
```

### Esquema por tenant
```mermaid
stateDiagram-v2
    direction TB
    [*] --> Creando : admin_platform.crear_tenant
    Creando --> Operativo : schema listo
    Operativo --> Actualizando : admin_platform.actualizar_tenant
    Actualizando --> Operativo
    Operativo --> Eliminando : admin_platform.eliminar_tenant
    Eliminando --> [*]
```

## CRM de prospectos

### ClienteProspecto
```mermaid
graph LR
    subgraph CanalIngreso["Canal de ingreso"]
        direction TB
        lead([Lead recibido en tenant])
    end
    subgraph EjecutivoComercial["Ejecutivo comercial"]
        direction TB
        registrar[Registrar prospecto en CRM]
        estadoRegistrado((Estado: Registrado))
        solicitarInfo[(Solicitar informacion faltante)]
        actualizar[Actualizar expediente]
        enviarEvaluacion[Escalar expediente a evaluacion]
        seguimiento[Campana de reactivacion]
        estadoReenganchado((Estado: Reenganchado))
    end
    subgraph AnalistaEvaluacion["Analista de evaluacion"]
        direction TB
        revisarDatos[Revisar datos y documentos]
        consultarInventario[Consultar inventario prospecto y scoring]
        generarPlan[Generar propuesta y sugerencias]
        decision{Prospecto viable?}
    end
    subgraph Operaciones["Operaciones / Implementacion"]
        direction TB
        programarOnboarding[Programar onboarding y entregas]
        estadoConvertido((Estado: Convertido))
        registrarMotivo[(Registrar motivo de descarte)]
        estadoDescartado((Estado: Descartado))
    end
    lead --> registrar
    registrar --> estadoRegistrado
    estadoRegistrado --> enviarEvaluacion
    enviarEvaluacion --> revisarDatos
    revisarDatos -->|Datos completos| consultarInventario
    revisarDatos -->|Faltan datos| solicitarInfo
    solicitarInfo --> actualizar --> revisarDatos
    consultarInventario --> generarPlan --> decision
    decision -->|SI| programarOnboarding --> estadoConvertido
    decision -->|NO| registrarMotivo --> estadoDescartado
    estadoDescartado --> seguimiento --> estadoReenganchado --> enviarEvaluacion
```

### InventarioProspecto
```mermaid
stateDiagram-v2
    direction TB
    [*] --> Registrado : createInventario()
    Registrado --> Programado : fecha_de_despacho futura
    Programado --> Despachado : fecha_de_despacho <= hoy
    Despachado --> Consolidado : generar_sugerencias()
    Registrado --> Archivado : deleteInventario()
    Programado --> Archivado : deleteInventario()
    Despachado --> Archivado : purge import
    Consolidado --> Archivado : purge historico
```

## Inventario central y modelos

### InventarioCredocube
```mermaid
stateDiagram-v2
    direction TB
    [*] --> Ingresado : refreshInventarioCredocubes()
    Ingresado --> Validando : validacion_limpieza || validacion_goteo || validacion_desinfeccion
    Validando --> Disponible : estado=disponible
    Disponible --> Reservado : estado=reservado
    Reservado --> Despachado : estado=despachado
    Despachado --> Inactivo : activo=false || fecha_vencimiento vencida
    Inactivo --> Reacondicionado : validaciones superadas
    Reacondicionado --> Disponible
```

### Modelo Credocube
```mermaid
stateDiagram-v2
    direction TB
    [*] --> Definicion : createCredocube()
    Definicion --> Publicado : tipo Cube && cache listo
    Publicado --> Actualizado : updateCredocube()
    Actualizado --> Publicado
    Publicado --> Retirado : deleteCredocube()
    Retirado --> [*]
```

## Recomendaciones y logística

### SugerenciaReemplazo
```mermaid
stateDiagram-v2
    direction TB
    [*] --> Generada : calcularDistribucionRealPorRango()
    Generada --> EnRevision : estado=revision
    EnRevision --> Aprobada : estado=aprobada
    EnRevision --> Rechazada : estado=rechazada
    Aprobada --> Ejecutada : orden_despacho emitida
    Ejecutada --> Cerrada : tracking completo
    Rechazada --> Cerrada : documentar motivo
```

### Orden de despacho (inventario agregado)
```mermaid
stateDiagram-v2
    direction TB
    [*] --> Creada : bulkInsertInventario()
    Creada --> EnPreparacion : productos asociados
    EnPreparacion --> EnRuta : fecha_de_despacho
    EnRuta --> Entregada : confirmacion cliente
    Entregada --> Auditada : getOrdenesDespacho()
    Auditada --> [*]
```