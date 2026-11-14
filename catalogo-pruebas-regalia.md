# Catálogo de pruebas del sistema REGALÍA (`CP-001`–`CP-107`)

**Alcance:** catálogo de **107 casos de prueba individuales** (`CP-001`–`CP-107`) para la validación integral del sistema REGALÍA.

**Fuentes:** especificación de requisitos del sistema REGALÍA (`NR-01`–`NR-29`) y escenarios de prueba (`NP-01`–`NP-19`).

## Cobertura por módulo

| Módulo del sistema | Rango | Cantidad |
|---|---|---|
| Módulo Backend y reglas de negocio | `CP-001`–`CP-027` | 27 |
| Módulo Web — Tienda en línea y panel de rutas | `CP-028`–`CP-054` | 27 |
| Módulo Móvil — Seguridad y operación de entregas | `CP-055`–`CP-081` | 27 |
| Módulo Calidad — Ruteo, incidencias, concurrencia y rendimiento | `CP-082`–`CP-107` | 26 |
| **Total** | `CP-001`–`CP-107` | **107** |

## Datos de prueba base (sintéticos)

- **F1 — Actores:** `ADMIN`, `CLIENTE-A`, `CLIENTE-B`, `REPARTIDOR-A`, `REPARTIDOR-B` e invitado sin cuenta. Credenciales gestionadas fuera del documento.
- **F2 — Comercio:** productos/stock aislados; ejemplo monetario subtotal `7300` centavos, IVA simulado `15% = 1095`, envío `0`, total `8395`. Tarjetas ficticias `DEMO_APPROVED`, `DEMO_LIMITED` (`2000c`), `DEMO_EMPTY` (`0c`) con `SIMULATED_PAYMENTS_ENABLED=true`.
- **F3 — Cobertura:** polígono `StoreCoverage` con punto interior, borde (`EPS=1e-12`) y exterior (`422 DELIVERY_OUTSIDE_COVERAGE`). Los pedidos ya aceptados conservan su dirección original; la actualización de cobertura aplica a compras nuevas.
- **F4 — Horario:** `America/Guayaquil`, ventana `07:00`–`17:00` inclusiva (`422 DELIVERY_OUTSIDE_HOURS`). Aviso de hora aproximada en checkout/pedidos se verifica solo en UI web.
- **F5 — Operación:** pedidos del día y futuros, pedidos sin fecha programada (`null` en `POST /orders`), registro de ausencias, fallos/retiros, emergencias y pérdidas/cancelación.
- **F6 — Motor vial y rendimiento:** `ROAD_ENGINE=OSRM` (`durationsS` primario, `distancesM` desempate) con respaldo Haversine; volúmenes de medición `100`, `500` y `2000` pedidos.

## Módulo Backend y reglas de negocio (`CP-001`–`CP-027`, 27 casos)

### CP-001 — Compra ADMIN para cliente con destinatario de regalo
**Origen:** `C01.1` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-01, NR-02; NP-01
**Dependencias:** Entorno aislado con catálogo publicado, tienda/cobertura configurada y cuentas F1 (ADMIN, CLIENT-A).
**Entradas:** Token ADMIN; CLIENT-A con contactPhone distinto al de giftRecipient; ítem en stock; pago CASH; Idempotency-Key UUIDv4.
**Acciones:** 1) Enviar POST /api/v1/orders/admin con buyer REGISTERED_CLIENT y giftRecipient. 2) Consultar GET /api/v1/orders/:id y /receipt (ADMIN). 3) Consultar GET /api/v1/shop/orders/:id (CLIENT-A).
**Resultado esperado:** HTTP 201; pedido conserva comprador y destinatario separados; ADMIN lee pedido/comprobante y CLIENT-A consulta su compra.
**Criterio de aceptación:** Titularidad asociada a CLIENT-A, datos de giftRecipient independientes, stock descontado y comprobante comercial coherente.
**Evidencia esperada:** Log / reporte

### CP-002 — Rechazo compra ADMIN cliente sin teléfono de comprador
**Origen:** `C01.2` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-01, NR-02; NP-01
**Dependencias:** Entorno aislado con catálogo publicado, cobertura activa y cuentas F1 (ADMIN, CLIENT-A).
**Entradas:** Token ADMIN; payload POST /api/v1/orders/admin con buyer.type=REGISTERED_CLIENT omitiendo contactPhone; Idempotency-Key UUIDv4.
**Acciones:** 1) Registrar conteo inicial de pedidos, comprobantes y stock del producto. 2) Enviar POST /api/v1/orders/admin sin contactPhone del comprador. 3) Consultar conteos y stock posterior.
**Resultado esperado:** HTTP 400 de validación rechazando la creación del pedido por falta de contactPhone obligatorio del comprador.
**Criterio de aceptación:** Sin pedido creado, sin PurchaseReceipt ni descuento de stock; conteos inicial y final idénticos.
**Evidencia esperada:** Log / reporte

### CP-003 — Compra ADMIN invitado y lectura de comprobante
**Origen:** `C02.1` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-01, NR-02, NR-06, NR-09; NP-02
**Dependencias:** Entorno aislado con producto en stock, cobertura configurada y cuenta ADMIN.
**Entradas:** Token ADMIN; buyer.type=GUEST con name y contactPhone válidos; giftRecipient opcional; pago CASH; Idempotency-Key UUIDv4.
**Acciones:** 1) Enviar POST /api/v1/orders/admin como invitado. 2) Invocar GET /api/v1/orders/:id/receipt con token ADMIN. 3) Verificar estructura imprimible del comprobante.
**Resultado esperado:** HTTP 201 en creación; GET /receipt retorna 200 con número, ítems, importes en centavos, comprador invitado y aviso no fiscal.
**Criterio de aceptación:** Comprobante corresponde exactamente a la venta y contiene los campos necesarios para impresión ADMIN sin exigir cuenta de usuario.
**Evidencia esperada:** Log / reporte

### CP-004 — Rechazo compra ADMIN invitado sin teléfono obligatorio
**Origen:** `C02.2` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-01, NR-02, NR-06, NR-09; NP-02
**Dependencias:** Entorno aislado con producto en stock, cobertura configurada y cuenta ADMIN.
**Entradas:** Token ADMIN; buyer.type=GUEST con name válido y contactPhone omitido o vacío; Idempotency-Key UUIDv4.
**Acciones:** 1) Verificar stock y total de pedidos/usuarios antes del envío. 2) Enviar POST /api/v1/orders/admin sin contactPhone del invitado. 3) Reconsultar stock y tablas.
**Resultado esperado:** HTTP 400 rechazando el pedido de invitado sin teléfono obligatorio del comprador.
**Criterio de aceptación:** No se persiste pedido ni comprobante, no se crea usuario ni se descuenta stock del producto.
**Evidencia esperada:** Log / reporte

### CP-005 — Compra invitado con teléfono de cliente sin vínculo
**Origen:** `C02.3` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-01, NR-02, NR-06, NR-09; NP-02
**Dependencias:** Entorno aislado con CLIENT-A registrado y su teléfono conocido; cuenta ADMIN.
**Entradas:** Token ADMIN; buyer.type=GUEST cuyo contactPhone coincide exactamente con el teléfono de CLIENT-A; Idempotency-Key UUIDv4.
**Acciones:** 1) Crear venta ADMIN de invitado con teléfono de CLIENT-A. 2) Consultar GET /api/v1/shop/orders y /shop/orders/:id con JWT de CLIENT-A. 3) Verificar cuentas en BD.
**Resultado esperado:** Venta creada con userId=null; CLIENT-A no ve el pedido en su listado y su consulta directa devuelve 404/403.
**Criterio de aceptación:** No se crea vínculo por coincidencia telefónica ni cuenta nueva; aislamiento de acceso preservado.
**Evidencia esperada:** Log / reporte

### CP-006 — Pago externo declarado ADMIN en efectivo
**Origen:** `C03.1` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-04, NR-06; NP-02, NP-16
**Dependencias:** Entorno aislado con producto en stock, cobertura activa y cuenta ADMIN.
**Entradas:** Token ADMIN; pedido válido con payment={method:'CASH', note:'Pago en caja'}; Idempotency-Key UUIDv4; sin datos de tarjeta.
**Acciones:** 1) Enviar POST /api/v1/orders/admin con payment.method=CASH. 2) Consultar respuesta, GET /api/v1/orders/:id/receipt y registro de pago declarado.
**Resultado esperado:** HTTP 201 con kind=ADMIN_DECLARED_EXTERNAL, status=DECLARED, method=CASH, declaredById y declaredAt; sin débito simulado.
**Criterio de aceptación:** Declaración y comprobante coherentes en CASH; cero campos bancarios o cobros de tarjeta simulada.
**Evidencia esperada:** Log / reporte

### CP-007 — Pago externo declarado ADMIN por transferencia
**Origen:** `C03.2` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-04, NR-06; NP-02, NP-16
**Dependencias:** Entorno aislado con producto en stock, cobertura activa y cuenta ADMIN.
**Entradas:** Token ADMIN; pedido válido con payment={method:'TRANSFER'} sin referencia bancaria ni comprobante bancario; Idempotency-Key UUIDv4.
**Acciones:** 1) Enviar POST /api/v1/orders/admin con payment.method=TRANSFER sin referencia bancaria. 2) Consultar GET /api/v1/orders/:id/receipt.
**Resultado esperado:** HTTP 201 sin exigir referencia bancaria; status=DECLARED, method=TRANSFER, declaredById y declaredAt; comprobante sin verificación bancaria.
**Criterio de aceptación:** Se persiste transferencia declarada por ADMIN sin presentar validación bancaria automática ni datos bancarios inventados.
**Evidencia esperada:** Log / reporte

### CP-008 — Cambio de tasa IVA tras cotizar (409 SHOP_SETTINGS_CHANGED)
**Origen:** `C04.1` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-05, NR-06; NP-01, NP-02, NP-03
**Dependencias:** Entorno aislado con producto publicado, cobertura activa y cuentas CLIENT-A y ADMIN.
**Entradas:** Token CLIENT-A; carrito válido; rateBps inicial 1500 (15%); PATCH admin/shop-settings cambia rateBps a 1200; Idempotency-Key UUIDv4.
**Acciones:** 1) Ejecutar POST /api/v1/shop/checkout/quote como CLIENT-A. 2) Cambiar tax.rateBps vía PATCH /api/v1/admin/shop-settings. 3) Enviar POST /api/v1/shop/checkout con el quoteToken previo.
**Resultado esperado:** POST /api/v1/shop/checkout responde HTTP 409 con error.code=SHOP_SETTINGS_CHANGED rechazando condiciones obsoletas.
**Criterio de aceptación:** Sin pedido creado, sin PurchaseReceipt, sin descuento de stock ni débito simulado en la cuenta del cliente.
**Evidencia esperada:** Log / reporte

### CP-009 — Cambio de precio tras cotizar e inmutabilidad 15% IVA
**Origen:** `C04.2` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-05, NR-06; NP-01, NP-02, NP-03
**Dependencias:** Entorno aislado con Shop settings IVA 15% (1500 bps), envío 0 y cuentas CLIENT-A y ADMIN.
**Entradas:** Ítems por 7300 centavos, IVA 15% (1095), total 8395; cambio de precio tras cotizar y cambio de tasa/precio post-compra.
**Acciones:** 1) Cotizar, alterar precio y confirmar -> 409 PRICE_CHANGED. 2) Recotizar subtotal 7300 y confirmar checkout (201). 3) Cambiar tasa/precio y releer GET /api/v1/shop/orders/:id/receipt.
**Resultado esperado:** Primer intento retorna 409 PRICE_CHANGED sin efectos; compra válida fija subtotal 7300, IVA 1095, total 8395 y aviso no fiscal.
**Criterio de aceptación:** Relecturas del comprobante tras cambios posteriores muestran importes idénticos (7300/1095/8395) y sin etiqueta de factura fiscal.
**Evidencia esperada:** Log / reporte

### CP-010 — Corrección autorizada de contacto ADMIN y auditoría
**Origen:** `C07.1` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-03, NR-07; NP-04
**Dependencias:** Entorno aislado con pedido ADMIN previo (contactRevision=0) y cuenta ADMIN.
**Entradas:** Token ADMIN; orderId existente; payload {contactRevision:0, buyerPhone:'+593990001112', recipientPhone:'+593990001113'}.
**Acciones:** 1) Enviar PATCH /api/v1/orders/:id/contact con contactRevision=0. 2) Consultar GET /api/v1/orders/:id/contact-history.
**Resultado esperado:** HTTP 200 actualiza contacto y eleva contactRevision a 1; contact-history lista cambios con field, previousValue, nextValue, actorId y createdAt.
**Criterio de aceptación:** Corrección operativa aplicada y auditoría append-only trazable al actor ADMIN con valores anterior y nuevo.
**Evidencia esperada:** Log / reporte

### CP-011 — Aislamiento de corrección de contacto en recibo y pedido
**Origen:** `C07.2` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-03, NR-07; NP-04
**Dependencias:** Entorno aislado con dos pedidos (P1, P2) del mismo comprador y cuenta ADMIN.
**Entradas:** Token ADMIN; orderId P1 (contactRevision=0) con nuevo recipientPhone; orderId P2 de control sin cambios.
**Acciones:** 1) Capturar snapshot de GET /orders/:id1/receipt y GET /orders/:id2. 2) Ejecutar PATCH /api/v1/orders/:id1/contact. 3) Reconsultar comprobante de P1 y datos de P2.
**Resultado esperado:** P1 refleja contacto corregido; GET /orders/:id1/receipt mantiene snapshot original y P2 conserva sus datos y contactRevision sin cambio.
**Criterio de aceptación:** Comparación antes/después demuestra aislamiento total: comprobante congelado y segundo pedido intactos.
**Evidencia esperada:** Log / reporte

### CP-012 — Rechazo de corrección de contacto por rol no autorizado
**Origen:** `C07.3` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-03, NR-07; NP-04
**Dependencias:** Entorno aislado con pedido existente y cuentas F1 (CLIENT-A, DRIVER-A).
**Entradas:** Tokens JWT de CLIENT-A y DRIVER-A; orderId válido con contactRevision actual; payload válido de corrección de contacto.
**Acciones:** 1) Enviar PATCH /api/v1/orders/:id/contact con token CLIENT-A. 2) Repetir con token DRIVER-A. 3) Consultar contacto y contact-history como ADMIN.
**Resultado esperado:** Ambas peticiones retornan HTTP 403 Forbidden sin ejecutar la corrección.
**Criterio de aceptación:** Contacto, contactRevision e historial de auditoría permanecen idénticos tras los dos intentos rechazados.
**Evidencia esperada:** Log / reporte

### CP-013 — Horario ADMIN límite inicial 07:00 America/Guayaquil
**Origen:** `C10.5` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-14; NP-06
**Dependencias:** Entorno aislado con horario comercial 07:00-17:00 America/Guayaquil y cuenta ADMIN.
**Entradas:** Token ADMIN; pedido ADMIN válido con scheduledDeliveryDate en fecha futura a las 07:00:00-05:00; Idempotency-Key UUIDv4.
**Acciones:** 1) Verificar deliverySchedule 07:00-17:00 en shop-settings. 2) Enviar POST /api/v1/orders/admin con hora 07:00-05:00. 3) Consultar pedido y comprobante.
**Resultado esperado:** HTTP 201; pedido creado en estado PENDING con hora local 07:00 en America/Guayaquil y comprobante emitido.
**Criterio de aceptación:** Límite inicial inclusivo 07:00 aceptado y stock descontado correctamente.
**Evidencia esperada:** Log / reporte

### CP-014 — Horario ADMIN límite final 17:00 America/Guayaquil
**Origen:** `C10.6` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-14; NP-06
**Dependencias:** Entorno aislado con horario comercial 07:00-17:00 America/Guayaquil y cuenta ADMIN.
**Entradas:** Token ADMIN; pedido ADMIN válido con scheduledDeliveryDate en fecha futura a las 17:00:00-05:00; Idempotency-Key UUIDv4.
**Acciones:** 1) Verificar deliverySchedule 07:00-17:00. 2) Enviar POST /api/v1/orders/admin con hora 17:00-05:00. 3) Consultar pedido y comprobante.
**Resultado esperado:** HTTP 201; pedido creado en estado PENDING con hora local 17:00 en America/Guayaquil y comprobante generado.
**Criterio de aceptación:** Límite final inclusivo 17:00 aceptado con reserva de stock y datos consistentes.
**Evidencia esperada:** Log / reporte

### CP-015 — Rechazo horario ADMIN inválido 06:59 (422)
**Origen:** `C10.7` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-14; NP-06
**Dependencias:** Entorno aislado con horario comercial 07:00-17:00 America/Guayaquil y cuenta ADMIN.
**Entradas:** Token ADMIN; pedido ADMIN con scheduledDeliveryDate en fecha futura a las 06:59:00-05:00; Idempotency-Key UUIDv4.
**Acciones:** 1) Registrar conteo de pedidos, comprobantes y stock. 2) Enviar POST /api/v1/orders/admin con hora 06:59-05:00. 3) Reconsultar conteos y stock.
**Resultado esperado:** HTTP 422 con error.code=DELIVERY_OUTSIDE_HOURS rechazando el horario previo a 07:00.
**Criterio de aceptación:** Sin pedido ni comprobante creado y stock del producto sin variación.
**Evidencia esperada:** Log / reporte

### CP-016 — Rechazo horario ADMIN inválido 17:01 (422)
**Origen:** `C10.8` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-14; NP-06
**Dependencias:** Entorno aislado con horario comercial 07:00-17:00 America/Guayaquil y cuenta ADMIN.
**Entradas:** Token ADMIN; pedido ADMIN con scheduledDeliveryDate en fecha futura a las 17:01:00-05:00; Idempotency-Key UUIDv4.
**Acciones:** 1) Registrar conteo de pedidos, comprobantes y stock. 2) Enviar POST /api/v1/orders/admin con hora 17:01-05:00. 3) Reconsultar conteos y stock.
**Resultado esperado:** HTTP 422 con error.code=DELIVERY_OUTSIDE_HOURS rechazando el horario posterior a 17:00.
**Criterio de aceptación:** Sin efectos parciales: conteos de pedidos, comprobantes y stock idénticos antes y después.
**Evidencia esperada:** Log / reporte

### CP-017 — Agrupación temporal por extremos (10:00, 10:25, 10:50)
**Origen:** `C13.1` | **Prioridad:** Media | **Método:** API | **Trazabilidad:** NR-18, NR-22; NP-08
**Dependencias:** Entorno aislado con StoreCoverage activo, timeWindowMarginMinutes=30 y cuenta ADMIN.
**Entradas:** Token ADMIN; 3 pedidos PENDING elegibles hoy dentro de cobertura con horas 10:00, 10:25 y 10:50 (-05:00).
**Acciones:** 1) Confirmar routePlanning.timeWindowMarginMinutes=30. 2) Invocar GET /api/v1/route-proposals?date=HOY como ADMIN. 3) Inspeccionar grupos y paradas.
**Resultado esperado:** HTTP 200 con 2 propuestas separadas: [10:00, 10:25] y [10:50], porque 10:50 - 10:00 = 50 > 30 min (sin encadenamiento).
**Criterio de aceptación:** Agrupación cumple max - min <= 30 por extremos y orden cronológico de paradas sin persistir rutas.
**Evidencia esperada:** Log / reporte

### CP-018 — Agrupación por extremos con separación de 29 minutos
**Origen:** `C13.2` | **Prioridad:** Media | **Método:** API | **Trazabilidad:** NR-18, NR-22; NP-08
**Dependencias:** Entorno aislado con StoreCoverage activo, timeWindowMarginMinutes=30 y cuenta ADMIN.
**Entradas:** Token ADMIN; 2 pedidos PENDING elegibles hoy con horas 10:00 y 10:29 (-05:00), diferencia 29 minutos.
**Acciones:** 1) Verificar margen=30. 2) Ejecutar GET /api/v1/route-proposals?date=HOY. 3) Revisar cantidad de rutas y secuencia de paradas.
**Resultado esperado:** HTTP 200 agrupando ambos pedidos en una única propuesta ordenada cronológicamente (10:00, luego 10:29).
**Criterio de aceptación:** Separación de 29 min <= 30 se consolida en una ruta sin exceder capacidad máxima de 4.
**Evidencia esperada:** Log / reporte

### CP-019 — Agrupación por extremos con separación exacta de 30 min
**Origen:** `C13.3` | **Prioridad:** Media | **Método:** API | **Trazabilidad:** NR-18, NR-22; NP-08
**Dependencias:** Entorno aislado con StoreCoverage activo, timeWindowMarginMinutes=30 y cuenta ADMIN.
**Entradas:** Token ADMIN; 2 pedidos PENDING elegibles hoy con horas 10:00 y 10:30 (-05:00), diferencia exacta 30 minutos.
**Acciones:** 1) Verificar margen=30. 2) Ejecutar GET /api/v1/route-proposals?date=HOY. 3) Inspeccionar propuestas y timeWindowMarginMinutes retornado.
**Resultado esperado:** HTTP 200 agrupando ambos pedidos en una sola ruta al cumplirse la condición inclusiva max - min <= 30.
**Criterio de aceptación:** Igualdad exacta al límite (30 == 30) incluida en el mismo grupo con orden cronológico.
**Evidencia esperada:** Log / reporte

### CP-020 — Separación de rutas por extremos con 31 minutos
**Origen:** `C13.4` | **Prioridad:** Media | **Método:** API | **Trazabilidad:** NR-18, NR-22; NP-08
**Dependencias:** Entorno aislado con StoreCoverage activo, timeWindowMarginMinutes=30 y cuenta ADMIN.
**Entradas:** Token ADMIN; 2 pedidos PENDING elegibles hoy con horas 10:00 y 10:31 (-05:00), diferencia 31 minutos.
**Acciones:** 1) Verificar margen=30. 2) Ejecutar GET /api/v1/route-proposals?date=HOY. 3) Verificar separación de grupos en proposals.
**Resultado esperado:** HTTP 200 devolviendo 2 rutas propuestas separadas (1 parada cada una) por exceder el margen de 30 minutos.
**Criterio de aceptación:** Separación de 31 min (> 30) impide la fusión de pedidos en la misma propuesta.
**Evidencia esperada:** Log / reporte

### CP-021 — Cambio de margen horario (5..180) y desempate OSRM
**Origen:** `C13.5` | **Prioridad:** Media | **Método:** API | **Trazabilidad:** NR-18, NR-22; NP-08
**Dependencias:** Entorno aislado con StoreCoverage, pedidos hoy 10:00/10:25/10:50 y motor OSRM (o fallback Haversine controlado).
**Entradas:** Token ADMIN; PATCH admin/shop-settings con routePlanning.timeWindowMarginMinutes=60; casos límite inválidos 4 y 181.
**Acciones:** 1) Probar márgenes 4 y 181 -> 400. 2) Actualizar margen a 60 vía PATCH /api/v1/admin/shop-settings. 3) Consultar GET /api/v1/route-proposals?date=HOY.
**Resultado esperado:** 4 y 181 rechazados (400); con 60 min los 3 pedidos (10:00-10:50) se agrupan y aplican desempate OSRM durationsS primario / distancesM secundario.
**Criterio de aceptación:** Margen validado en rango 5..180, persistido en settings y reflejado en nuevas propuestas con métricas viales coherentes.
**Evidencia esperada:** Log / reporte

### CP-022 — Creación de pedido sin fecha programada (scheduledDeliveryDate nulo)
**Origen:** `C26.1` | **Prioridad:** Media | **Método:** API | **Trazabilidad:** NR-10; NP-15
**Dependencias:** Entorno aislado con catálogo con stock, zona/coordenadas válidas y cuenta CLIENT-A.
**Entradas:** Token CLIENT-A; payload POST /api/v1/orders con deliveryAddress, items y coordenadas válidas, omitiendo scheduledDeliveryDate.
**Acciones:** 1) Enviar POST /api/v1/orders sin scheduledDeliveryDate. 2) Consultar GET /api/v1/orders/:id.
**Resultado esperado:** HTTP 201; pedido creado con status=PENDING y scheduledDeliveryDate=null sin asignar fecha automática.
**Criterio de aceptación:** Contrato opcional preservado: scheduledDeliveryDate permanece null y stock queda reservado.
**Evidencia esperada:** Log / reporte

### CP-023 — Exclusión en propuestas y 409 en asignación sin fecha
**Origen:** `C26.2` | **Prioridad:** Media | **Método:** API | **Trazabilidad:** NR-10; NP-15
**Dependencias:** Entorno aislado con pedido PENDING sin fecha (CP-022), conductor disponible y cuenta ADMIN.
**Entradas:** Token ADMIN; orderId con scheduledDeliveryDate=null; fecha operativa HOY; driverId disponible.
**Acciones:** 1) Consultar GET /api/v1/route-proposals?date=HOY. 2) Intentar confirmar/asignar el pedido vía POST /api/v1/routes y POST /api/v1/routes/assign.
**Resultado esperado:** GET /route-proposals lo incluye en excluded (fuera de proposals); POST /routes y /routes/assign responden 409 ConflictException.
**Criterio de aceptación:** Pedido sin fecha no entra en propuestas ni se asigna; no se crea ruta ni OrderClaim.
**Evidencia esperada:** Log / reporte

### CP-024 — Idempotencia Shop checkout con replay 201
**Origen:** `C30.1` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-01, NR-05, NR-10
**Dependencias:** Entorno aislado con Shop checkout activo, saldo demo suficiente y cuenta CLIENT-A.
**Entradas:** Token CLIENT-A; quoteToken vigente; Idempotency-Key UUIDv4 fijo y payload idéntico en dos solicitudes consecutivas.
**Acciones:** 1) Enviar POST /api/v1/shop/checkout con Idempotency-Key K1. 2) Reenviar exactamente el mismo POST con K1 y mismo payload. 3) Consultar pedidos, recibos, stock y saldo.
**Resultado esperado:** Ambas llamadas retornan HTTP 201 con idéntico orderId y receipt.id (replay idempotente).
**Criterio de aceptación:** Solo existe un pedido, un comprobante, un descuento de stock y un débito de saldo demo.
**Evidencia esperada:** Log / reporte

### CP-025 — Recuperación Shop ante timeout con mismo Idempotency-Key
**Origen:** `C30.2` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-01, NR-05, NR-10
**Dependencias:** Entorno aislado con Shop checkout, proxy/cliente con corte controlado de respuesta post-envío y CLIENT-A.
**Entradas:** Token CLIENT-A; quoteToken vigente; Idempotency-Key UUIDv4 K2 con payload válido bajo corte simulado de respuesta HTTP.
**Acciones:** 1) Enviar POST /api/v1/shop/checkout con K2 provocando corte/timeout tras commit en servidor. 2) Reintentar con mismo K2 y payload. 3) Verificar stock y saldo.
**Resultado esperado:** El reintento retorna HTTP 201 con el resultado original sin duplicar la transacción.
**Criterio de aceptación:** Recuperación consistente: 1 pedido, 1 comprobante, 1 descuento de stock y 1 débito tras corte de red.
**Evidencia esperada:** Log / reporte

### CP-026 — Conflicto Idempotency-Key con payload distinto (409)
**Origen:** `C30.3` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-01, NR-05, NR-10
**Dependencias:** Entorno aislado con compra Shop previa confirmada bajo Idempotency-Key K3 y cuenta CLIENT-A.
**Entradas:** Token CLIENT-A; mismo Idempotency-Key UUIDv4 K3 reutilizado con payload alterado (cantidad o dirección distinta).
**Acciones:** 1) Registrar conteo de pedidos, recibos, stock y saldo tras K3 original. 2) Enviar POST /api/v1/shop/checkout con K3 y payload distinto. 3) Reconsultar estado.
**Resultado esperado:** HTTP 409 con error.code=IDEMPOTENCY_KEY_REUSED rechazando la reutilización conflictiva.
**Criterio de aceptación:** No se crea segunda venta ni comprobante, ni se altera stock o saldo respecto al estado previo.
**Evidencia esperada:** Log / reporte

### CP-027 — Liberación auditada de DRAFT caducado (RELEASE_DRAFT)
**Origen:** `C11.5` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-16, NR-20; NP-07
**Dependencias:** Entorno aislado con ruta DRAFT de ayer (sin conductor, con paradas y OrderClaim activo) y cuenta ADMIN.
**Entradas:** Token ADMIN; routeId DRAFT con fecha del día anterior; driverId disponible; requestId UUIDv4 y reason válido para RELEASE_DRAFT.
**Acciones:** 1) Intentar POST /api/v1/routes/:id/assign -> 409 ROUTE_DATE_NOT_TODAY. 2) Enviar POST /api/v1/dispatch/interventions con action=RELEASE_DRAFT. 3) Reconsultar pedidos y propuestas.
**Resultado esperado:** Asignación rechaza 409 ROUTE_DATE_NOT_TODAY; RELEASE_DRAFT retorna éxito liberando claims y eliminando paradas del DRAFT.
**Criterio de aceptación:** Pedidos quedan PENDING sin claim activo (elegibles hoy), auditoría registrada y reenvío con igual requestId es idempotente.
**Evidencia esperada:** Log / reporte

## Módulo Web — Tienda en línea y panel de rutas (`CP-028`–`CP-054`, 27 casos)

### CP-028 — Historial unificado Mis pedidos con compras SHOP y ADMIN propias
**Origen:** `C05.1` | **Prioridad:** Alta | **Método:** WEB | **Trazabilidad:** NR-01, NR-07, NP-19
**Dependencias:** F1; CLIENTE-A con una compra SHOP y una ADMIN registradas en entorno aislado.
**Entradas:** Sesión web de CLIENTE-A; una orden de origen SHOP y una de origen ADMIN del mismo titular.
**Acciones:** 1) Abrir Mis pedidos en web. 2) Verificar listado vía GET /api/v1/shop/orders. 3) Abrir el detalle de ambas órdenes.
**Resultado esperado:** La lista unificada muestra solo las dos compras propias de CLIENTE-A con su origen (SHOP/ADMIN) y estado de seguimiento.
**Criterio de aceptación:** Coinciden identidades, orígenes y seguimiento entre UI y API; no aparecen órdenes de terceros ni invitadas.
**Evidencia esperada:** Captura UI / reporte

### CP-029 — Bloqueo en lista y detalle ante pedido ajeno o invitado coincidente
**Origen:** `C05.2` | **Prioridad:** Alta | **Método:** WEB | **Trazabilidad:** NR-01, NR-07, NP-19
**Dependencias:** F1; orden de CLIENTE-B y orden invitada con teléfono igual al de CLIENTE-A.
**Entradas:** Sesión web de CLIENTE-A; ID de pedido de CLIENTE-B y pedido invitado con teléfono coincidente.
**Acciones:** 1) Revisar Mis pedidos de CLIENTE-A. 2) Intentar abrir en web y GET /api/v1/shop/orders/:id el pedido ajeno y el invitado.
**Resultado esperado:** El pedido invitado no se vincula por teléfono en la lista; ambos accesos por ID responden 404 ORDER_NOT_FOUND sin datos.
**Criterio de aceptación:** Sin fuga de información en UI ni API; el código 404 ORDER_NOT_FOUND bloquea detalle ajeno e invitado.
**Evidencia esperada:** Captura UI / reporte

### CP-030 — Pedido sin PurchaseReceipt y sin importes inventados
**Origen:** `C08.1` | **Prioridad:** Media | **Método:** WEB | **Trazabilidad:** NR-05, NR-08, NP-03
**Dependencias:** F1; pedido previo sintético de CLIENTE-A sin registro PurchaseReceipt.
**Entradas:** Sesión web de CLIENTE-A; ID de pedido previo propio con receiptAvailable=false.
**Acciones:** 1) Consultar lista y detalle del pedido en web y GET /api/v1/shop/orders. 2) Solicitar /api/v1/shop/orders/:id/receipt.
**Resultado esperado:** Lista y detalle marcan receiptAvailable=false e informan comprobante no disponible; /receipt responde 404 RECEIPT_UNAVAILABLE.
**Criterio de aceptación:** No se reconstruye comprobante ni se inventan importes o impuestos en UI ni en API; datos almacenados intactos.
**Evidencia esperada:** Captura UI / reporte

### CP-031 — Cobertura tienda: punto interior al polígono aceptado en web
**Origen:** `C09.1` | **Prioridad:** Alta | **Método:** WEB | **Trazabilidad:** NR-11, NR-12, NR-13, NP-05
**Dependencias:** F1, F2, F3; polígono StoreCoverage configurado por ADMIN en entorno aislado.
**Entradas:** Sesión CLIENTE-A; coordenadas sintéticas dentro del polígono de cobertura vigente; carrito Shop válido.
**Acciones:** 1) Seleccionar punto interior en el mapa de checkout web. 2) Verificar POST /api/v1/store-coverage/evaluate. 3) Completar compra.
**Resultado esperado:** La evaluación retorna position=INTERIOR y accepted=true; la interfaz permite avanzar y confirmar el pedido Shop.
**Criterio de aceptación:** El punto interior queda aceptado sin bloqueos y la orden se registra con sus coordenadas válidas.
**Evidencia esperada:** Captura UI / reporte

### CP-032 — Cobertura tienda: punto exactamente en el borde del polígono
**Origen:** `C09.2` | **Prioridad:** Alta | **Método:** WEB | **Trazabilidad:** NR-11, NR-12, NR-13, NP-05
**Dependencias:** F1, F2, F3; polígono StoreCoverage activo con vértice/arista conocida.
**Entradas:** Sesión CLIENTE-A; coordenadas exactamente sobre el borde del polígono de StoreCoverage.
**Acciones:** 1) Ingresar punto en el borde en checkout web. 2) Evaluar vía POST /api/v1/store-coverage/evaluate. 3) Confirmar si permite compra.
**Resultado esperado:** La evaluación devuelve position=BOUNDARY y accepted=true, habilitando la compra en la web.
**Criterio de aceptación:** El punto en el borde es aceptado consistentemente en UI y API según la regla geométrica vigente.
**Evidencia esperada:** Captura UI / reporte

### CP-033 — Cobertura tienda: punto exterior rechazado con 422 en web
**Origen:** `C09.3` | **Prioridad:** Alta | **Método:** WEB | **Trazabilidad:** NR-11, NR-12, NR-13, NP-05
**Dependencias:** F1, F2, F3; polígono StoreCoverage vigente y stock/saldo inicial conocidos.
**Entradas:** Sesión CLIENTE-A; coordenadas fuera del polígono de cobertura; producto disponible en carrito.
**Acciones:** 1) Seleccionar punto exterior en checkout web. 2) Consultar evaluate e intentar confirmar compra. 3) Verificar stock y órdenes.
**Resultado esperado:** Evaluate retorna EXTERIOR y accepted=false; el intento de compra se rechaza con 422 DELIVERY_OUTSIDE_COVERAGE y aviso en UI.
**Criterio de aceptación:** No se crea pedido ni comprobante, y el stock y saldo simulado del cliente permanecen sin cambios.
**Evidencia esperada:** Captura UI / reporte

### CP-034 — Cambio de cobertura A a B conserva pedidos ya aceptados
**Origen:** `C09.4` | **Prioridad:** Alta | **Método:** WEB | **Trazabilidad:** NR-11, NR-12, NR-13, NP-05
**Dependencias:** F1, F3; pedido ya aceptado dentro del polígono A; ADMIN autenticado.
**Entradas:** Polígono A inicial con pedido aceptado en punto P; polígono B nuevo que excluye al punto P.
**Acciones:** 1) Como ADMIN actualizar polígono a B en panel web (PUT /api/v1/admin/store-coverage). 2) Consultar el pedido previo.
**Resultado esperado:** El cambio de cobertura se guarda, pero el pedido aceptado en P conserva su estado, dirección y datos sin cancelación.
**Criterio de aceptación:** Ningún pedido previo aceptado es cancelado, alterado ni eliminado automáticamente tras el cambio de polígono.
**Evidencia esperada:** Captura UI / reporte

### CP-035 — Compra nueva tras cambio de cobertura aplica área B vigente
**Origen:** `C09.5` | **Prioridad:** Alta | **Método:** WEB | **Trazabilidad:** NR-11, NR-12, NR-13, NP-05
**Dependencias:** F1, F2, F3; polígono B activo tras CP-034; pedidos aceptados mantienen su dirección original.
**Entradas:** Sesión CLIENTE-A; punto P válido en área A pero exterior al área B vigente; carrito válido.
**Acciones:** 1) Intentar nueva compra web para punto P bajo área B. 2) Verificar respuesta y estado de carrito/pedidos.
**Resultado esperado:** La compra nueva se rechaza en UI y API con 422 DELIVERY_OUTSIDE_COVERAGE al aplicar el polígono B vigente.
**Criterio de aceptación:** Sin pedido, comprobante ni cobro nuevos; el pedido ya aceptado conserva su dirección original.
**Evidencia esperada:** Captura UI / reporte

### CP-036 — Horario Shop límite inicial 07:00 America/Guayaquil aceptado
**Origen:** `C10.1` | **Prioridad:** Alta | **Método:** WEB | **Trazabilidad:** NR-14, NP-06
**Dependencias:** F1, F2, F4; horario Shop 07:00-17:00 en America/Guayaquil y cobertura válida.
**Entradas:** Sesión CLIENTE-A; fecha futura válida con hora 07:00 (-05:00 America/Guayaquil); pago DEMO_APPROVED.
**Acciones:** 1) Seleccionar 07:00 en checkout web. 2) Confirmar compra vía POST /api/v1/shop/checkout. 3) Consultar pedido.
**Resultado esperado:** El horario 07:00 se acepta en UI y backend; la orden se crea con la hora programada correspondiente.
**Criterio de aceptación:** HTTP 201 en checkout, pedido y comprobante generados y hora almacenada coherente con 07:00 America/Guayaquil.
**Evidencia esperada:** Captura UI / reporte

### CP-037 — Horario Shop límite final 17:00 America/Guayaquil aceptado
**Origen:** `C10.2` | **Prioridad:** Alta | **Método:** WEB | **Trazabilidad:** NR-14, NP-06
**Dependencias:** F1, F2, F4; horario Shop 07:00-17:00 vigente en America/Guayaquil.
**Entradas:** Sesión CLIENTE-A; fecha futura válida con hora 17:00 (-05:00 America/Guayaquil); carrito y cobertura válidos.
**Acciones:** 1) Seleccionar 17:00 en checkout web. 2) Confirmar la compra y consultar el detalle del pedido.
**Resultado esperado:** El horario límite 17:00 es aceptado en web y API, creando la orden con entrega programada a las 17:00.
**Criterio de aceptación:** Compra confirmada (201) sin rechazos indebidos en el extremo superior 17:00.
**Evidencia esperada:** Captura UI / reporte

### CP-038 — Horario Shop inválido 06:59 rechazado sin orden ni cobro
**Origen:** `C10.3` | **Prioridad:** Alta | **Método:** WEB | **Trazabilidad:** NR-14, NP-06
**Dependencias:** F1, F2, F4; horario Shop 07:00-17:00 configurado; stock y saldo inicial medidos.
**Entradas:** Sesión CLIENTE-A; fecha futura válida con hora 06:59 (-05:00 America/Guayaquil); tarjeta DEMO_APPROVED.
**Acciones:** 1) Intentar confirmar compra para las 06:59 en web o solicitud checkout. 2) Verificar stock, saldo y órdenes.
**Resultado esperado:** Se rechaza con 422 DELIVERY_OUTSIDE_HOURS y mensaje claro en UI; no se genera orden ni comprobante.
**Criterio de aceptación:** Stock y saldo simulado intactos tras el rechazo; cero órdenes creadas para 06:59.
**Evidencia esperada:** Captura UI / reporte

### CP-039 — Horario Shop inválido 17:01 rechazado sin orden ni cobro
**Origen:** `C10.4` | **Prioridad:** Alta | **Método:** WEB | **Trazabilidad:** NR-14, NP-06
**Dependencias:** F1, F2, F4; horario Shop 07:00-17:00 configurado; stock y saldo inicial medidos.
**Entradas:** Sesión CLIENTE-A; fecha futura válida con hora 17:01 (-05:00 America/Guayaquil); carrito válido.
**Acciones:** 1) Intentar confirmar compra para las 17:01 en checkout web. 2) Verificar órdenes, stock y saldo.
**Resultado esperado:** El servidor responde 422 DELIVERY_OUTSIDE_HOURS y la web muestra error sin crear pedido ni realizar cobro.
**Criterio de aceptación:** Sin orden ni comprobante emitidos; inventario y saldo del cliente permanecen sin variación.
**Evidencia esperada:** Captura UI / reporte

### CP-040 — Cambio de horario en shop-settings genera 409 al confirmar
**Origen:** `C10.9` | **Prioridad:** Alta | **Método:** WEB | **Trazabilidad:** NR-14, NP-06
**Dependencias:** F1, F2, F4; cotización Shop pendiente en cliente y sesión ADMIN paralela.
**Entradas:** Cotización Shop abierta con horario 07:00-17:00; ADMIN cambia ventana vía PATCH /api/v1/admin/shop-settings.
**Acciones:** 1) Cotizar en web como CLIENTE-A. 2) Como ADMIN actualizar horario. 3) Confirmar compra pendiente en web.
**Resultado esperado:** El checkout responde 409 SHOP_SETTINGS_CHANGED; la web informa el cambio y exige recotizar sin confirmar con reglas previas.
**Criterio de aceptación:** No se crea orden ni cobro bajo el horario obsoleto; tras recotizar aplican las condiciones vigentes.
**Evidencia esperada:** Captura UI / reporte

### CP-041 — Verificación UI web de aviso de hora de entrega aproximada
**Origen:** `C10.10` | **Prioridad:** Alta | **Método:** WEB | **Trazabilidad:** NR-14, NP-06
**Dependencias:** F1, F2, F4; checkout Shop web y vista de detalle de pedido accesibles.
**Entradas:** Sesión CLIENTE-A; pantalla de selección de horario en checkout Shop y detalle de pedido creado.
**Acciones:** 1) Inspeccionar textos de horario en checkout web. 2) Completar compra y revisar textos en detalle del pedido.
**Resultado esperado:** La interfaz informa claramente que la hora de entrega es aproximada y no promete exactitud ni margen de +-30 min.
**Criterio de aceptación:** El aviso visible es explícito sobre carácter aproximado y no garantiza ventana +-30 min (validación puramente UI).
**Evidencia esperada:** Captura UI / reporte

### CP-042 — Propuesta de rutas en panel ADMIN es solo lectura sin persistir
**Origen:** `C14.1` | **Prioridad:** Alta | **Método:** WEB | **Trazabilidad:** NR-20, NP-07, NP-13
**Dependencias:** F1, F5; pedidos elegibles para hoy y fecha futura en entorno aislado; ADMIN autenticado.
**Entradas:** Sesión ADMIN en panel web; pedidos elegibles de hoy (isToday=true) y otro día (isToday=false).
**Acciones:** 1) Solicitar propuesta en panel (GET /api/v1/route-proposals) para hoy y fecha futura. 2) Consultar rutas persistidas.
**Resultado esperado:** Devuelve propuestas temporales con isToday/canConfirm correctos; consultar rutas persistidas muestra cero rutas creadas.
**Criterio de aceptación:** Ninguna ruta ni reserva se persiste en BD al generar propuestas; canConfirm=false en fechas distintas de hoy.
**Evidencia esperada:** Captura UI / reporte

### CP-043 — Confirmación de borrador DRAFT en hoy persiste ruta sin conductor
**Origen:** `C14.2` | **Prioridad:** Alta | **Método:** WEB | **Trazabilidad:** NR-20, NP-07, NP-13
**Dependencias:** F1, F5; propuesta válida para hoy generada desde CP-042.
**Entradas:** Sesión ADMIN; propuesta del día actual con canConfirm=true y pedidos elegibles.
**Acciones:** 1) Confirmar propuesta en panel ADMIN (POST /api/v1/routes). 2) Consultar listado de rutas y reservas de pedidos.
**Resultado esperado:** Se persiste una ruta en estado DRAFT sin conductor asignado (driverId=null) y visible en el panel.
**Criterio de aceptación:** Estado DRAFT confirmado sin duplicar rutas ni asignar conductor automáticamente; pedidos reclamados por la ruta.
**Evidencia esperada:** Captura UI / reporte

### CP-044 — Asignación separada de ruta DRAFT a conductor disponible
**Origen:** `C14.3` | **Prioridad:** Alta | **Método:** WEB | **Trazabilidad:** NR-20, NP-07, NP-13
**Dependencias:** F1, F5; ruta DRAFT sin conductor de CP-043 y REPARTIDOR-A disponible hoy.
**Entradas:** Sesión ADMIN; ID de ruta DRAFT y REPARTIDOR-A sin ausencias ni reservas activas.
**Acciones:** 1) Desde panel ADMIN asignar REPARTIDOR-A (POST /api/v1/routes/:id/assign). 2) Consultar ruta y disponibilidad.
**Resultado esperado:** La ruta pasa a estado ASSIGNED con REPARTIDOR-A y crea reserva activa del conductor en el sistema.
**Criterio de aceptación:** Transición DRAFT->ASSIGNED persistida como acción separada; reserva creada y reflejada en disponibilidad.
**Evidencia esperada:** Captura UI / reporte

### CP-045 — Rechazo de asignación a conductor no disponible o ausente (409)
**Origen:** `C14.4` | **Prioridad:** Alta | **Método:** WEB | **Trazabilidad:** NR-20, NP-07, NP-13
**Dependencias:** F1, F5; ruta DRAFT sin conductor y REPARTIDOR-B ausente hoy o ya reservado.
**Entradas:** Sesión ADMIN; ruta DRAFT sin conductor y REPARTIDOR-B con ausencia vigente o reserva previa.
**Acciones:** 1) Intentar asignar REPARTIDOR-B a la ruta DRAFT en panel ADMIN. 2) Consultar rutas sin conductor y reservas.
**Resultado esperado:** La asignación se rechaza con HTTP 409 (DRIVER_ABSENT o conflicto de reserva) y aviso claro en UI.
**Criterio de aceptación:** Sin asignación parcial ni reserva indebida; la ruta permanece en DRAFT sin conductor y visible en el panel.
**Evidencia esperada:** Captura UI / reporte

### CP-046 — Motor vial OSRM indisponible muestra aviso sin rutas en línea recta
**Origen:** `C16.1` | **Prioridad:** Alta | **Método:** WEB | **Trazabilidad:** NR-19, NR-21, NP-09
**Dependencias:** F5, F6; ROAD_ENGINE=OSRM configurado con indisponibilidad controlada del servicio OSRM.
**Entradas:** Sesión ADMIN; pedidos elegibles de hoy con motor vial OSRM detenido o inaccesible.
**Acciones:** 1) Solicitar propuestas en panel ADMIN (GET /api/v1/route-proposals). 2) Observar aviso UI y respuesta HTTP.
**Resultado esperado:** El servidor responde 503 ROAD_ENGINE_UNAVAILABLE (o 502) y el panel muestra aviso claro sin generar rutas en línea recta.
**Criterio de aceptación:** Cero propuestas ficticias o trazados en línea recta presentados como resultado vial; nada se persiste.
**Evidencia esperada:** Captura UI / reporte

### CP-047 — Preservación de pedidos pendientes y rutas tras falla OSRM
**Origen:** `C16.2` | **Prioridad:** Alta | **Método:** WEB | **Trazabilidad:** NR-19, NR-21, NP-09
**Dependencias:** F5, F6; ruta previa existente, pedidos pendientes y fallo OSRM observado en CP-046.
**Entradas:** Sesión ADMIN; estado previo de pedidos PENDING y ruta existente antes y después del error 503/502.
**Acciones:** 1) Consultar listado de pedidos pendientes y rutas existentes en panel tras el rechazo 503/502.
**Resultado esperado:** Los pedidos siguen en PENDING y las rutas previamente confirmadas o asignadas se conservan intactas.
**Criterio de aceptación:** Comparación antes/después confirma ausencia de mutaciones, cancelaciones o reservas parciales tras el error vial.
**Evidencia esperada:** Captura UI / reporte

### CP-048 — Recuperación tras indisponibilidad OSRM genera propuestas válidas
**Origen:** `C16.3` | **Prioridad:** Alta | **Método:** WEB | **Trazabilidad:** NR-19, NR-21, NP-09
**Dependencias:** F5, F6; servicio OSRM restaurado tras CP-046/CP-047 con los mismos pedidos pendientes.
**Entradas:** Sesión ADMIN; servicio OSRM nuevamente operativo y pedidos pendientes del día.
**Acciones:** 1) Verificar estado en panel/road-engine. 2) Solicitar nuevamente propuestas desde panel ADMIN.
**Resultado esperado:** El panel genera propuestas viales válidas con rutas, distancias y duraciones estimadas normalmente.
**Criterio de aceptación:** HTTP 200 en propuestas tras recuperación; resultados coherentes con el motor vial sin errores residuales.
**Evidencia esperada:** Captura UI / reporte

### CP-049 — Origen y retorno común en tienda única reflejado en propuesta y mapa
**Origen:** `C17.1` | **Prioridad:** Media | **Método:** WEB | **Trazabilidad:** NR-11, NR-19, NP-08
**Dependencias:** F3, F6; StoreCoverage.location configurado y OSRM operativo en entorno aislado.
**Entradas:** Sesión ADMIN; pedidos del día con destino válido dentro de cobertura y tienda única configurada.
**Acciones:** 1) Solicitar propuesta con geometría en panel ADMIN. 2) Verificar punto de inicio y fin en JSON y mapa.
**Resultado esperado:** La propuesta y el mapa web parten y regresan a la ubicación única de StoreCoverage.location, sin depósitos por zona.
**Criterio de aceptación:** Coordenadas de origen y retorno coinciden exactamente con StoreCoverage.location configurada.
**Evidencia esperada:** Captura UI / reporte

### CP-050 — Paradas y trazado vial en panel ADMIN coinciden con motor vial
**Origen:** `C17.2` | **Prioridad:** Media | **Método:** WEB | **Trazabilidad:** NR-11, NR-19, NP-08
**Dependencias:** F5, F6; propuesta multi-parada generada con includeGeometry=true y OSRM activo.
**Entradas:** Sesión ADMIN; propuesta con 2 a 4 paradas en horarios compatibles y trazado geométrico OSRM.
**Acciones:** 1) Abrir mapa de la propuesta en panel ADMIN. 2) Comparar secuencia de paradas y polilínea con respuesta API.
**Resultado esperado:** El mapa muestra las paradas en el orden cronológico devuelto y sigue el trazado vial OSRM, no rectas entre puntos.
**Criterio de aceptación:** Orden de paradas y geometría renderizada corresponden fielmente con los datos viales recibidos del backend.
**Evidencia esperada:** Captura UI / reporte

### CP-051 — Distancias y duraciones mostradas como estimadas sin tráfico en vivo
**Origen:** `C17.3` | **Prioridad:** Media | **Método:** WEB | **Trazabilidad:** NR-11, NR-19, NP-08
**Dependencias:** F6; propuesta generada con OSRM activo y acceso al detalle en panel ADMIN.
**Entradas:** Sesión ADMIN; metadatos roadMetrics (estimate=true, trafficAware=false) y resumen mostrado en UI.
**Acciones:** 1) Revisar métricas e indicadores en panel de propuestas. 2) Contrastar textos visibles con roadMetrics del API.
**Resultado esperado:** La UI presenta distancias y duraciones como estimadas (estimate=true, trafficAware=false) sin afirmar ETA ni tráfico vivo.
**Criterio de aceptación:** Ninguna etiqueta web promete hora exacta de llegada, tráfico en tiempo real ni solución óptima global.
**Evidencia esperada:** Captura UI / reporte

### CP-052 — Regresión Shop: compra válida con DEMO_APPROVED crea pedido y recibo
**Origen:** `C27.1` | **Prioridad:** Alta | **Método:** WEB | **Trazabilidad:** NR-01, NR-05, NR-10
**Dependencias:** F1, F2, F3, F4; producto publicado con stock disponible y tarjeta simulada DEMO_APPROVED.
**Entradas:** Sesión CLIENTE-A; producto disponible, cobertura y horario válidos, tarjeta simulada DEMO_APPROVED.
**Acciones:** 1) Añadir producto desde catálogo Shop web. 2) Completar checkout con DEMO_APPROVED. 3) Abrir pedido y comprobante.
**Resultado esperado:** Se crea el pedido y su comprobante simulado; el stock y el saldo demo se descuentan exactamente una vez.
**Criterio de aceptación:** Comprobante coincide con precios e IVA del servidor; sin exponer número completo ni CVV de tarjeta en evidencias.
**Evidencia esperada:** Captura UI / reporte

### CP-053 — Regresión Shop: carrito mixto con agotado rechazado sin efectos
**Origen:** `C27.2` | **Prioridad:** Alta | **Método:** WEB | **Trazabilidad:** NR-01, NR-05, NR-10
**Dependencias:** F1, F2; un producto con stock > 0 y otro producto agotado (stock=0) en entorno aislado.
**Entradas:** Sesión CLIENTE-A; carrito con 1 producto disponible y 1 agotado; stock y saldo inicial medidos.
**Acciones:** 1) Intentar cotizar o confirmar carrito mixto en Shop web/API. 2) Verificar órdenes, stock disponible y saldo.
**Resultado esperado:** El catálogo marca el agotado como no disponible y el checkout rechaza el carrito mixto sin crear orden parcial.
**Criterio de aceptación:** Stock del producto disponible y saldo demo quedan idénticos al estado previo; ningún pedido o recibo creado.
**Evidencia esperada:** Captura UI / reporte

### CP-054 — Regresión Shop: precio o total manipulado en cliente no es aceptado
**Origen:** `C27.3` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-01, NR-05, NR-10
**Dependencias:** F1, F2; cotización/checkout Shop activo con precio de catálogo conocido en servidor.
**Entradas:** Sesión CLIENTE-A; payload hacia POST /api/v1/shop/checkout con campos price/total alterados a valor menor.
**Acciones:** 1) Enviar solicitud manipulada interceptada desde cliente. 2) Inspeccionar respuesta HTTP, orden y cobro.
**Resultado esperado:** El servidor rechaza campos no permitidos (400/409) o aplica únicamente sus precios reales; nunca cobra el monto alterado.
**Criterio de aceptación:** Si rechaza no deja orden ni débito; si acepta solo cobra e imprime el importe calculado por el servidor.
**Evidencia esperada:** Captura UI / reporte

## Módulo Móvil — Seguridad y operación de entregas (`CP-055`–`CP-081`, 27 casos)

### CP-055 — Acceso sin sesión JWT a rutas, pedidos y configuración
**Origen:** `C06.1` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-01, NR-03, NR-07, NR-23; NP-14
**Dependencias:** Backend API activo con endpoints protegidos; sin token JWT; fixture F1
**Entradas:** Solicitudes HTTP sin cabecera Authorization a GET /api/v1/drivers/me/routes, GET /api/v1/shop/orders y GET /api/v1/admin/shop-settings.
**Acciones:** 1) Invocar los tres endpoints sin token JWT. 2) Inspeccionar códigos HTTP y cuerpos de respuesta.
**Resultado esperado:** Todas las peticiones se rechazan con HTTP 401 sin devolver rutas, pedidos ni parámetros de configuración.
**Criterio de aceptación:** 100 % de los endpoints protegidos responden 401 y sus respuestas no filtran datos internos ni listados.
**Evidencia esperada:** Log HTTP / respuesta JSON

### CP-056 — Aislamiento entre CLIENT-B y pedido/comprobante de CLIENT-A
**Origen:** `C06.2` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-01, NR-03, NR-07, NR-23; NP-14
**Dependencias:** Pedido y comprobante existentes de CLIENT-A; sesión JWT de CLIENT-B; F1
**Entradas:** JWT de CLIENT-B y UUID de pedido/comprobante perteneciente a CLIENT-A.
**Acciones:** 1) Consultar GET /api/v1/shop/orders/:id y /receipt como CLIENT-B. 2) Intentar mutar o consultar /orders/:id ajeno.
**Resultado esperado:** El backend rechaza cada intento con HTTP 403 o 404 sin exponer montos, destinatario ni comprobante de CLIENT-A.
**Criterio de aceptación:** Ninguna respuesta revela datos de CLIENT-A y el pedido original permanece sin cambios.
**Evidencia esperada:** Log HTTP / respuesta JSON

### CP-057 — Aislamiento de DRIVER-B ante ruta y parada de DRIVER-A
**Origen:** `C06.3` | **Prioridad:** Alta | **Método:** MOVIL | **Trazabilidad:** NR-01, NR-03, NR-07, NR-23; NP-14
**Dependencias:** Ruta IN_PROGRESS asignada a DRIVER-A con paradas; app móvil/JWT de DRIVER-B; F1, F5
**Entradas:** Sesión JWT de DRIVER-B y routeId/stopId pertenecientes a DRIVER-A.
**Acciones:** 1) Abrir Mi Ruta en móvil con DRIVER-B. 2) Consultar ruta ajena e intentar iniciar, fallar o cerrar parada/ruta de DRIVER-A.
**Resultado esperado:** Móvil no lista rutas ajenas y la API rechaza consultas y mutaciones sobre DRIVER-A con HTTP 403 o 404.
**Criterio de aceptación:** Ruta y paradas de DRIVER-A conservan su estado intacto sin fugas de información a DRIVER-B.
**Evidencia esperada:** Captura móvil / log

### CP-058 — Registro público con rol ADMIN rechazado sin escalación
**Origen:** `C06.4` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-01, NR-03, NR-07, NR-23; NP-14
**Dependencias:** Endpoint público POST /api/v1/auth/register operativo; correo sintético nuevo; F1
**Entradas:** Payload de registro con name, email nuevo válido, password válido y campo adicional role: ADMIN.
**Acciones:** 1) Enviar POST /api/v1/auth/register con role ADMIN. 2) Intentar iniciar sesión con esas credenciales y verificar usuarios.
**Resultado esperado:** El servidor rechaza la petición con HTTP 400 o 403 y no crea cuenta ADMIN ni usuario privilegiado.
**Criterio de aceptación:** El intento de login posterior falla y no existe ninguna cuenta registrada con el correo enviado.
**Evidencia esperada:** Log HTTP / consulta usuarios

### CP-059 — Intento de CLIENT de modificar configuración o cobertura
**Origen:** `C06.5` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-01, NR-03, NR-07, NR-23; NP-14
**Dependencias:** JWT de CLIENT-A y JWT de ADMIN para lectura comparativa; F1, F3
**Entradas:** JWT de CLIENT-A con payload válido para PATCH /api/v1/admin/shop-settings y cambio en /api/v1/admin/store-coverage.
**Acciones:** 1) Leer configuración actual como ADMIN. 2) Enviar mutaciones de settings y cobertura como CLIENT-A. 3) Releer configuración.
**Resultado esperado:** Ambas peticiones de CLIENT-A se rechazan con HTTP 403 y los valores de tienda y cobertura no cambian.
**Criterio de aceptación:** Comparación antes/después como ADMIN confirma configuración y polígono exactamente iguales.
**Evidencia esperada:** Log HTTP / JSON comparativo

### CP-060 — Acceso autorizado por titular, ADMIN y DRIVER sobre recursos propios
**Origen:** `C06.6` | **Prioridad:** Alta | **Método:** TRANSVERSAL | **Trazabilidad:** NR-01, NR-03, NR-07, NR-23; NP-14
**Dependencias:** Sesiones válidas de CLIENT-A, ADMIN y DRIVER-A con recursos propios asignados; F1, F5
**Entradas:** JWT válidos de CLIENT-A (pedido propio), ADMIN (configuración/despacho) y DRIVER-A (ruta propia).
**Acciones:** 1) CLIENT-A lee su pedido/comprobante. 2) ADMIN consulta settings y despacho. 3) DRIVER-A consulta sus rutas en móvil/API.
**Resultado esperado:** Cada actor accede con HTTP 200 únicamente a sus recursos permitidos sin exposición de datos de terceros.
**Criterio de aceptación:** Respuestas corresponden exactamente a los recursos autorizados de cada rol según contrato.
**Evidencia esperada:** Captura móvil / log

### CP-061 — Pedido de hoy elegible en propuesta, ruta y asignación
**Origen:** `C11.1` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-16, NR-20; NP-07, NP-13
**Dependencias:** Pedido válido programado para hoy en zona de cobertura; conductor libre sin ausencia; F5
**Entradas:** Pedido con scheduledDeliveryDate del día operativo actual en America/Guayaquil y DRIVER-A disponible.
**Acciones:** 1) Consultar GET /api/v1/route-proposals. 2) Crear ruta con POST /api/v1/routes. 3) Asignar DRIVER-A con POST /routes/:id/assign.
**Resultado esperado:** La propuesta incluye el pedido con isToday=true, permite crear borrador y asignar la ruta a DRIVER-A.
**Criterio de aceptación:** Propuesta, ruta DRAFT/ASSIGNED y asignación quedan persistidas para la fecha operativa actual.
**Evidencia esperada:** Log HTTP / respuesta JSON

### CP-062 — Pedido futuro admitido en compra y bloqueado en ruta/assign
**Origen:** `C11.2` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-16, NR-20; NP-07, NP-13
**Dependencias:** Horario operativo válido; compras Shop/ADMIN habilitadas; conductor disponible; F4, F5
**Entradas:** Pedido válido con fecha programada de mañana en POST /api/v1/shop/checkout y POST /api/v1/orders/admin.
**Acciones:** 1) Crear pedidos futuros. 2) Consultar GET /api/v1/route-proposals?date=mañana. 3) Intentar POST /routes y /assign para mañana.
**Resultado esperado:** Las compras futuras se crean (201) y permiten preview, pero POST /routes y assign se rechazan con 409 ROUTE_DATE_NOT_TODAY.
**Criterio de aceptación:** No se crean rutas ni asignaciones futuras; pedidos permanecen pendientes para su fecha programada.
**Evidencia esperada:** Log HTTP / respuesta JSON

### CP-063 — Ausencia registrada hoy impide asignar repartidor
**Origen:** `C11.3` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-16, NR-20; NP-07, NP-13
**Dependencias:** Ruta DRAFT del día operativo; ausencia activa para hoy en DRIVER-B; F1, F5
**Entradas:** Registro en POST /api/v1/drivers/:driverId/absences con startDate/endDate de hoy y ruta DRAFT lista.
**Acciones:** 1) Registrar ausencia de hoy para DRIVER-B. 2) Consultar disponibilidad. 3) Intentar asignar DRIVER-B en POST /routes/:id/assign.
**Resultado esperado:** Disponibilidad reporta isAvailable=false y el intento de asignación se rechaza sin asignar la ruta.
**Criterio de aceptación:** La ruta permanece sin conductor (DRAFT) y no se genera reserva ni salida para DRIVER-B.
**Evidencia esperada:** Captura web / log HTTP

### CP-064 — Ausencia futura no altera ni reasigna rutas activas de hoy
**Origen:** `C11.4` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-16, NR-20; NP-07, NP-13
**Dependencias:** Ruta ASSIGNED o IN_PROGRESS de hoy asignada a DRIVER-A; F5
**Entradas:** Ausencia en POST /api/v1/drivers/:driverId/absences con fechas futuras (mañana o posterior) para DRIVER-A.
**Acciones:** 1) Consultar ruta activa de hoy de DRIVER-A. 2) Registrar ausencia futura para DRIVER-A. 3) Reconsultar ruta y paradas de hoy.
**Resultado esperado:** La ausencia futura queda registrada, y la ruta asignada o iniciada de hoy mantiene mismo conductor y paradas.
**Criterio de aceptación:** No ocurre reasignación automática, cancelación ni alteración de reservas en la ruta de hoy.
**Evidencia esperada:** Log HTTP / JSON comparativo

### CP-065 — Pedido urgente con ruta IN_PROGRESS no altera ruta iniciada
**Origen:** `C15.1` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-20; NP-09
**Dependencias:** Ruta R1 en estado IN_PROGRESS del día actual; sin rutas DRAFT/ASSIGNED con cupo; F5
**Entradas:** Pedido nuevo del mismo día registrado tras iniciar R1; consulta a GET /api/v1/dispatch/orders/:id/proposal.
**Acciones:** 1) Registrar snapshot de R1. 2) Crear pedido urgente para hoy. 3) Consultar propuesta de urgencia e inbox; reconsultar R1.
**Resultado esperado:** La propuesta sugiere NEW_ROUTE o BLOCKED sin proponer inserción en R1; R1 permanece intacta.
**Criterio de aceptación:** Paradas, orden y reserva de R1 son idénticos antes y después; no hay inserción automática.
**Evidencia esperada:** Log HTTP / JSON comparativo

### CP-066 — Decisión manual ADMIN en urgencias: INSERT con cupo o NEW_ROUTE
**Origen:** `C15.2` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-20; NP-09
**Dependencias:** Ruta DRAFT/ASSIGNED con menos de 4 paradas y caso alternativo sin cupo; JWT ADMIN; F5
**Entradas:** Pedido urgente de hoy, respuesta de GET /dispatch/orders/:id/proposal y confirmación explícita en POST /dispatch/interventions.
**Acciones:** 1) Consultar propuesta de urgencia. 2) Confirmar manualmente INSERT (cupo <4) o NEW_ROUTE. 3) Verificar rutas e historial auditado.
**Resultado esperado:** Solo tras confirmación explícita ADMIN se inserta en la ruta elegible (<4 paradas) o se crea nueva ruta con auditoría.
**Criterio de aceptación:** Ninguna ruta supera 4 paradas, el cambio queda auditado y rutas no seleccionadas permanecen intactas.
**Evidencia esperada:** Log HTTP / auditoría dispatch

### CP-067 — Entrega fallida en móvil conserva parada e historial pendiente
**Origen:** `C18.1` | **Prioridad:** Alta | **Método:** MOVIL | **Trazabilidad:** NR-23, NR-24; NP-10
**Dependencias:** Ruta IN_PROGRESS de DRIVER-A con parada pendiente; app móvil y endpoint de fallo; F5
**Entradas:** Token DRIVER-A, stopId pendiente y motivo RECIPIENT_ABSENT o RECIPIENT_REFUSED en POST /api/v1/routes/:id/stops/:stopId/failure.
**Acciones:** 1) Registrar entrega fallida desde móvil con motivo válido. 2) Consultar detalle de ruta, parada y seguimiento.
**Resultado esperado:** Parada pasa a FAILED conservando intento/motivo en historial y el pedido queda en estado pendiente de gestión.
**Criterio de aceptación:** No marca DELIVERED ni CANCELLED, conserva la parada original y el intento auditado.
**Evidencia esperada:** Captura móvil / log

### CP-068 — Registro de fallo por actor o conductor no autorizado rechazado
**Origen:** `C18.2` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-23, NR-24; NP-10
**Dependencias:** Parada PENDING en ruta de DRIVER-A; sesiones de DRIVER-B, CLIENT-A y ADMIN; F1, F5
**Entradas:** Tokens de DRIVER-B y CLIENT-A sobre POST /api/v1/routes/:id/stops/:stopId/failure de DRIVER-A con motivo válido.
**Acciones:** 1) Enviar solicitud de fallo como DRIVER-B y como CLIENT-A. 2) Consultar parada y pedido después de cada intento.
**Resultado esperado:** Cada intento no autorizado se rechaza con HTTP 403 o 409 sin registrar intento fallido.
**Criterio de aceptación:** La parada sigue PENDING y el pedido no muestra transición ni historial modificado.
**Evidencia esperada:** Log HTTP / respuesta JSON

### CP-069 — Gestión post-fallo ADMIN: CONTACT y RESCHEDULE con nueva fecha
**Origen:** `C18.3` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-23, NR-24; NP-10
**Dependencias:** Parada fallida pendiente de gestión; JWT ADMIN; nueva fecha/horario válido F4, F5
**Entradas:** Acciones CONTACT y RESCHEDULE en POST /api/v1/dispatch/interventions con nueva fecha/hora acordada válida.
**Acciones:** 1) Registrar CONTACT tras contacto al cliente. 2) Ejecutar RESCHEDULE con fecha/hora nueva. 3) Reintentar o consultar historial.
**Resultado esperado:** El pedido queda reprogramado con la nueva fecha/hora y conserva el historial de fallo previo en la ruta original.
**Criterio de aceptación:** Sin duplicar asignación activa ni borrar el intento previo; nueva fecha queda lista para planificación.
**Evidencia esperada:** Log HTTP / seguimiento pedido

### CP-070 — Gestión post-fallo ADMIN: acuerdo de retiro en tienda (PICKUP_AGREE)
**Origen:** `C18.4` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-23, NR-24; NP-10
**Dependencias:** Pedido con visita fallida en gestión post-fallo; JWT ADMIN y JWT titular; F5
**Entradas:** Payload con action PICKUP_AGREE en POST /api/v1/dispatch/interventions para el pedido fallido.
**Acciones:** 1) Enviar PICKUP_AGREE como ADMIN. 2) Consultar seguimiento del pedido como cliente y en despacho.
**Resultado esperado:** El pedido pasa a estado pendiente de retiro en tienda sin marcarlo aún como entregado ni reponer stock.
**Criterio de aceptación:** Seguimiento muestra pendiente de retiro y conserva registro histórico de la visita fallida.
**Evidencia esperada:** Log HTTP / vista seguimiento

### CP-071 — Confirmación de retiro (PICKUP_CONFIRM) y rechazo de repetición
**Origen:** `C18.5` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-23, NR-24; NP-10
**Dependencias:** Pedido en estado pendiente de retiro tras PICKUP_AGREE; JWT ADMIN; F5
**Entradas:** Acción PICKUP_CONFIRM en POST /api/v1/dispatch/interventions y repetición inmediata de PICKUP_CONFIRM.
**Acciones:** 1) Confirmar retiro físico con PICKUP_CONFIRM. 2) Repetir PICKUP_CONFIRM sobre el mismo pedido. 3) Consultar estado e historial.
**Resultado esperado:** La primera confirmación marca entrega por retiro; la repetición se rechaza con 409 PICKUP_ALREADY_CONFIRMED.
**Criterio de aceptación:** Existe una sola entrega por retiro sin registros duplicados ni movimientos adicionales de inventario.
**Evidencia esperada:** Log HTTP / auditoría despacho

### CP-072 — Recorrido E2E: creación de compra y verificación de estado inicial
**Origen:** `C25.1` | **Prioridad:** Alta | **Método:** TRANSVERSAL | **Trazabilidad:** NR-01, NR-05, NR-07, NR-19--NR-21, NR-23; Transversal
**Dependencias:** Tienda Shop operativa; producto con stock; coordenadas en cobertura; F1, F2, F3, F4
**Entradas:** Carrito válido de CLIENT-A con fecha de hoy, dirección cubierta y medio de pago demo aprobado.
**Acciones:** 1) Completar checkout en Shop. 2) Abrir historial/seguimiento del cliente y consultar pedido y comprobante.
**Resultado esperado:** Se crea pedido en estado inicial pendiente y comprobante congelado visibles en el seguimiento de CLIENT-A.
**Criterio de aceptación:** Importes, stock descontado, comprobante y estado inicial coinciden exactamente con el backend.
**Evidencia esperada:** Captura web / log HTTP

### CP-073 — Recorrido E2E: propuesta, confirmación y asignación en día operativo
**Origen:** `C25.2` | **Prioridad:** Alta | **Método:** TRANSVERSAL | **Trazabilidad:** NR-01, NR-05, NR-07, NR-19--NR-21, NR-23; Transversal
**Dependencias:** Pedido creado en C25.1 para hoy; motor vial activo; DRIVER-A libre; F5, F6
**Entradas:** Sesión ADMIN, pedido de hoy elegible y DRIVER-A disponible sin ausencias ni rutas activas.
**Acciones:** 1) Generar propuesta en web/API. 2) Confirmar borrador (DRAFT). 3) Asignar ruta a DRIVER-A y verificar en app móvil.
**Resultado esperado:** Borrador se persiste, queda asignado (ASSIGNED) a DRIVER-A y aparece en Mi Ruta de la app móvil.
**Criterio de aceptación:** Pedido, parada, reserva del conductor y lista en móvil están sincronizados sin duplicados.
**Evidencia esperada:** Captura web / móvil / log

### CP-074 — Recorrido E2E: progreso móvil reflejado en seguimiento del cliente
**Origen:** `C25.3` | **Prioridad:** Alta | **Método:** TRANSVERSAL | **Trazabilidad:** NR-01, NR-05, NR-07, NR-19--NR-21, NR-23; Transversal
**Dependencias:** Ruta ASSIGNED a DRIVER-A con pedido de CLIENT-A; app móvil y web cliente activas; F5
**Entradas:** Sesión DRIVER-A en app móvil y sesión CLIENT-A en seguimiento web del mismo pedido.
**Acciones:** 1) DRIVER-A inicia ruta en móvil. 2) Marca parada en camino y luego entregada. 3) CLIENT-A refresca seguimiento.
**Resultado esperado:** Cada transición persistida (IN_PROGRESS, IN_TRANSIT, DELIVERED) se refleja en tiempo real o consulta en seguimiento cliente.
**Criterio de aceptación:** Estados visibles en cliente y móvil coinciden con los persistidos en backend sin ubicaciones GPS inventadas.
**Evidencia esperada:** Captura móvil / web / log

### CP-075 — Recorrido E2E: desconexión móvil y recuperación al reconectar
**Origen:** `C25.4` | **Prioridad:** Alta | **Método:** MOVIL | **Trazabilidad:** NR-01, NR-05, NR-07, NR-19--NR-21, NR-23; Transversal
**Dependencias:** Ruta IN_PROGRESS en app móvil de DRIVER-A; control de red en dispositivo/emulador; F5
**Entradas:** Desconexión de red controlada en móvil antes/durante consulta o acción de parada y reconexión posterior.
**Acciones:** 1) Cortar red en móvil y observar aviso ante intento de acción. 2) Reconectar red. 3) Reintentar o refrescar y verificar API.
**Resultado esperado:** Sin red no finge éxito; al reconectar recupera el estado real persistido sin duplicar entregas ni inventar cola offline.
**Criterio de aceptación:** Backend registra una sola transición válida y el móvil refleja exactamente el estado del servidor.
**Evidencia esperada:** Captura móvil / log

### CP-076 — Cierre de ruta móvil rechazado con visita aún PENDING
**Origen:** `C28.1` | **Prioridad:** Alta | **Método:** MOVIL | **Trazabilidad:** NR-11, NR-20, NR-23; NP-13, NP-14
**Dependencias:** Ruta IN_PROGRESS de DRIVER-A con al menos una parada en estado PENDING; F5
**Entradas:** Token DRIVER-A y ruta con parada pendiente hacia POST /api/v1/routes/:id/complete con cuerpo {}.
**Acciones:** 1) Verificar que existe parada PENDING. 2) Intentar cerrar ruta desde móvil o POST /routes/:id/complete.
**Resultado esperado:** El servidor rechaza el cierre con HTTP 409 y la ruta continúa en estado IN_PROGRESS.
**Criterio de aceptación:** No se registra completedAt, la ruta no pasa a COMPLETED y el conductor sigue ocupado.
**Evidencia esperada:** Captura móvil / log

### CP-077 — Cierre de ruta COMPLETED con visitas resueltas y una FAILED
**Origen:** `C28.2` | **Prioridad:** Alta | **Método:** MOVIL | **Trazabilidad:** NR-11, NR-20, NR-23; NP-13, NP-14
**Dependencias:** Ruta IN_PROGRESS de DRIVER-A con todas las paradas resueltas (DELIVERED y al menos una FAILED); F5
**Entradas:** Token DRIVER-A y cuerpo {} en POST /api/v1/routes/:id/complete sobre ruta con paradas resueltas.
**Acciones:** 1) Ejecutar cierre de ruta como DRIVER-A. 2) Consultar ruta, parada FAILED y disponibilidad del conductor.
**Resultado esperado:** Ruta pasa a COMPLETED; la parada FAILED sigue fallida y el conductor aún no queda disponible para otra ruta.
**Criterio de aceptación:** completedAt registrado, pedido FAILED sin marcar DELIVERED y disponibilidad bloqueada hasta retorno.
**Evidencia esperada:** Captura móvil / log

### CP-078 — Bloqueo de nueva salida antes de confirmar regreso (returnedAt)
**Origen:** `C28.3` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-11, NR-20, NR-23; NP-13, NP-14
**Dependencias:** Ruta COMPLETED de DRIVER-A con returnedAt nulo; segunda ruta DRAFT lista para hoy; F5
**Entradas:** JWT ADMIN, routeId de nueva ruta DRAFT de hoy y driverId de DRIVER-A con returnedAt IS NULL.
**Acciones:** 1) Confirmar ruta previa COMPLETED y returnedAt nulo. 2) Intentar asignar nueva ruta a DRIVER-A en POST /routes/:id/assign.
**Resultado esperado:** La asignación de nueva salida se rechaza con HTTP 409 mientras no se confirme el regreso físico a tienda.
**Criterio de aceptación:** La segunda ruta permanece DRAFT sin conductor y no existe doble reserva activa para DRIVER-A.
**Evidencia esperada:** Log HTTP / respuesta JSON

### CP-079 — Confirmación de regreso por titular libera y actualiza disponibilidad
**Origen:** `C28.4` | **Prioridad:** Alta | **Método:** MOVIL | **Trazabilidad:** NR-11, NR-20, NR-23; NP-13, NP-14
**Dependencias:** Ruta COMPLETED de DRIVER-A con returnedAt nulo; variante con y sin ausencia activa; F5
**Entradas:** Token DRIVER-A y cuerpo {} en POST /api/v1/routes/:id/return (probando también con ausencia activa para hoy).
**Acciones:** 1) Confirmar regreso como DRIVER-A en móvil/API. 2) Consultar ruta, returnedAt y disponibilidad efectiva (con/sin ausencia).
**Resultado esperado:** Registra returnedAt, libera reserva de ruta y actualiza disponibilidad; si existe ausencia hoy, sigue no disponible.
**Criterio de aceptación:** returnedAt persistido, reserva liberada y disponibilidad efectiva respeta ausencias vigentes sin habilitar indebidamente.
**Evidencia esperada:** Captura móvil / log

### CP-080 — Repetición de regreso a tienda sin duplicar ni liberar dos veces
**Origen:** `C28.5` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-11, NR-20, NR-23; NP-13, NP-14
**Dependencias:** Ruta COMPLETED de DRIVER-A con returnedAt ya confirmado en C28.4; F5
**Entradas:** Token DRIVER-A y segunda invocación con cuerpo {} a POST /api/v1/routes/:id/return sobre la misma ruta.
**Acciones:** 1) Repetir POST /api/v1/routes/:id/return con DRIVER-A. 2) Comparar returnedAt, auditoría y estado del conductor.
**Resultado esperado:** No duplica registro de regreso ni ejecuta doble liberación; responde idempotente o conflicto controlado según contrato.
**Criterio de aceptación:** returnedAt original se mantiene sin cambios y la disponibilidad/reservas del conductor no sufren alteración.
**Evidencia esperada:** Log HTTP / respuesta JSON

### CP-081 — Intento de cierre o regreso por DRIVER-B rechazado sobre ruta ajena
**Origen:** `C28.6` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-11, NR-20, NR-23; NP-13, NP-14
**Dependencias:** Ruta IN_PROGRESS o COMPLETED de DRIVER-A; sesión JWT de DRIVER-B; F1, F5
**Entradas:** Token de DRIVER-B hacia POST /api/v1/routes/:id/complete y POST /api/v1/routes/:id/return de DRIVER-A.
**Acciones:** 1) Invocar /complete y /return de ruta de DRIVER-A con JWT de DRIVER-B. 2) Consultar ruta y disponibilidad de DRIVER-A.
**Resultado esperado:** Ambas acciones son rechazadas con HTTP 403 o 404 sin completar ni registrar regreso en la ruta ajena.
**Criterio de aceptación:** Estado, completedAt, returnedAt y reserva de DRIVER-A permanecen exactamente iguales.
**Evidencia esperada:** Log HTTP / respuesta JSON

## Módulo Calidad — Ruteo, incidencias, concurrencia y rendimiento (`CP-082`–`CP-107`, 26 casos)

### CP-082 — Agrupación horaria 10:00+10:20 y separación 15:00
**Origen:** `C12.1` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-17, NR-18, NR-19; NP-07, NP-08
**Dependencias:** GET /api/v1/route-proposals, motor vial, F5, F6
**Entradas:** Pedidos de hoy: P1 (10:00), P2 (10:20) distantes y P3 (15:00) cercano a P1; margen configurado 30 min.
**Acciones:** 1) Enviar GET /api/v1/route-proposals con rol ADMIN. 2) Revisar grupos propuestos y orden de paradas.
**Resultado esperado:** Propuesta agrupa P1+P2 (10:00+10:20) en una ruta y separa P3 (15:00) en otra ruta sin mezclarlos por cercanía.
**Criterio de aceptación:** P1 y P2 comparten ruta por ventana horaria compatible; P3 queda separado pese a menor distancia a P1.
**Evidencia esperada:** Log HTTP y JSON de propuesta

### CP-083 — Ruta válida con 1 parada sin exigir mínimo de 4
**Origen:** `C12.2` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-17, NR-18, NR-19; NP-07, NP-08
**Dependencias:** GET /api/v1/route-proposals, motor vial, F5, F6
**Entradas:** 1 único pedido elegible de hoy con coordenadas viales válidas dentro de cobertura.
**Acciones:** 1) Consultar GET /api/v1/route-proposals como ADMIN. 2) Verificar cantidad de rutas y paradas.
**Resultado esperado:** Se genera 1 propuesta de ruta válida con 1 parada, origen en tienda y retorno, sin exigir mínimo de 4 pedidos.
**Criterio de aceptación:** HTTP 200 con ruta propuesta de 1 parada utilizable y sin error de capacidad mínima.
**Evidencia esperada:** Log HTTP y JSON de propuesta

### CP-084 — Lote de 4 pedidos compatibles forma ruta de 4 paradas
**Origen:** `C12.3` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-17, NR-18, NR-19; NP-07, NP-08
**Dependencias:** GET /api/v1/route-proposals, motor vial, F5, F6
**Entradas:** 4 pedidos elegibles de hoy en misma ventana horaria (ej. 10:00-10:25) y margen 30 min.
**Acciones:** 1) Solicitar GET /api/v1/route-proposals como ADMIN. 2) Verificar número de rutas y paradas.
**Resultado esperado:** El lote se agrupa en 1 ruta máxima de exactamente 4 paradas ordenadas cronológicamente.
**Criterio de aceptación:** Total de paradas por ruta <= 4; los 4 pedidos compatibles quedan incluidos en una sola ruta.
**Evidencia esperada:** Log HTTP y JSON de propuesta

### CP-085 — Lote de 5 pedidos dividido en máximo 4 paradas por ruta
**Origen:** `C12.4` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-17, NR-18, NR-19; NP-07, NP-08
**Dependencias:** GET /api/v1/route-proposals, motor vial, F5, F6
**Entradas:** 5 pedidos elegibles de hoy en ventana compatible (margen 30 min) con coordenadas viales válidas.
**Acciones:** 1) Invocar GET /api/v1/route-proposals como ADMIN. 2) Inspeccionar partición de rutas y paradas.
**Resultado esperado:** El sistema divide los 5 pedidos en 2 rutas (4+1 o 3+2 según métricas viales), nunca una ruta de 5.
**Criterio de aceptación:** Todas las rutas tienen entre 1 y 4 paradas; suma total de paradas igual a 5 sin duplicados.
**Evidencia esperada:** Log HTTP y JSON de propuesta

### CP-086 — Declarar emergencia pasa ruta a INTERRUPTED y bloquea
**Origen:** `C19.1` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-25; NP-11
**Dependencias:** POST /api/v1/dispatch/interventions, ruta IN_PROGRESS, F5
**Entradas:** Ruta IN_PROGRESS con 1 entrega DELIVERED y 2 paradas pendientes; EMERGENCY_DECLARE con routeId y requestId.
**Acciones:** 1) Ejecutar POST /api/v1/dispatch/interventions con EMERGENCY_DECLARE. 2) Consultar ruta, RouteUnitRecovery y pedidos.
**Resultado esperado:** Ruta pasa a INTERRUPTED, conserva entrega realizada, crea RouteUnitRecovery por unidad pendiente y las bloquea.
**Criterio de aceptación:** Estado INTERRUPTED, entrega previa intacta, un registro RouteUnitRecovery por unidad pendiente y bloqueo activo.
**Evidencia esperada:** Log JSON y estado en BD

### CP-087 — Retorno individual desbloquea solo unidad confirmada
**Origen:** `C19.2` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-25; NP-11
**Dependencias:** Ruta INTERRUPTED con >=2 RouteUnitRecovery pendientes, F5
**Entradas:** Dos unidades pendientes (U1, U2) en RouteUnitRecovery; Product.stock inicial S; UNIT_RECOVERY_CONFIRM para U1.
**Acciones:** 1) Enviar UNIT_RECOVERY_CONFIRM con recoveryId de U1. 2) Consultar U1, U2 y Product.stock.
**Resultado esperado:** U1 registra returnedAt y se desbloquea; U2 permanece bloqueada y Product.stock sigue igual a S.
**Criterio de aceptación:** Solo U1 queda liberada; U2 conserva returnedAt NULL y no se genera movimiento de suma en Product.stock.
**Evidencia esperada:** Log JSON y estado en BD

### CP-088 — Cierre de emergencia con pendientes mantiene bloqueo 409
**Origen:** `C20.1` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-26; NP-11, NP-17
**Dependencias:** Ruta INTERRUPTED con unidades sin retorno físico, F5
**Entradas:** Emergencia con U1 sin retornar; acciones EMERGENCY_CLOSE y luego intento de gestión o reencolado.
**Acciones:** 1) Ejecutar EMERGENCY_CLOSE. 2) Consultar pendientes visibles. 3) Intentar gestión/requeue de pedido bloqueado.
**Resultado esperado:** Incidencia cierra dejando unidades sin retorno visibles y pedidos afectados bloqueados con 409 RECOVERY_PENDING.
**Criterio de aceptación:** Pendientes siguen listados tras EMERGENCY_CLOSE y cualquier intento de requeue/gestión retorna 409 RECOVERY_PENDING.
**Evidencia esperada:** Log JSON y respuestas 409

### CP-089 — Cierre de emergencia no libera repartidor si returnedAt NULL
**Origen:** `C20.2` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-26; NP-11, NP-17
**Dependencias:** Ruta INTERRUPTED asignada a REPARTIDOR-A, F5
**Entradas:** Ruta en emergencia cerrada con EMERGENCY_CLOSE mientras existe RouteUnitRecovery con returnedAt IS NULL.
**Acciones:** 1) Ejecutar EMERGENCY_CLOSE. 2) Consultar disponibilidad de REPARTIDOR-A y reservas activas.
**Resultado esperado:** El cierre EMERGENCY_CLOSE no restablece por sí solo la disponibilidad ni libera al repartidor mientras returnedAt sea NULL.
**Criterio de aceptación:** DriverReservation permanece activa tras EMERGENCY_CLOSE y REPARTIDOR-A no aparece disponible para nueva asignación.
**Evidencia esperada:** Log JSON y tabla DriverReservation

### CP-090 — Liberación de repartidor por ADMIN respeta ausencias y 409
**Origen:** `C20.3` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-25, NR-26; NP-11, NP-17
**Dependencias:** Ruta INTERRUPTED, DriverReservation, ausencias vigentes, F5
**Entradas:** Ruta INTERRUPTED con EMERGENCY_DRIVER_RELEASE; variante con ausencia activa; segunda llamada repetida.
**Acciones:** 1) Ejecutar EMERGENCY_DRIVER_RELEASE como ADMIN. 2) Verificar DriverReservation y registro de ausencia. 3) Repetir acción.
**Resultado esperado:** Libera DriverReservation respetando ausencias vigentes (sigue no disponible si ausente); al repetir rechaza 409 DRIVER_ALREADY_RELEASED.
**Criterio de aceptación:** Reserva liberada una sola vez; la ausencia vigente prevalece en disponibilidad y repetición devuelve 409 DRIVER_ALREADY_RELEASED.
**Evidencia esperada:** Log JSON y respuestas 200/409

### CP-091 — Declarar pérdida con stock >= 1 prepara reemplazo y descuenta
**Origen:** `C21.1` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-27; NP-12, NP-18
**Dependencias:** POST /api/v1/dispatch/interventions, Product.stock >= 1, F5
**Entradas:** Original no recuperado de ítem con Product.stock = S (>= 1); LOSS_DECLARE con orderId, orderItemId y requestId.
**Acciones:** 1) Ejecutar LOSS_DECLARE como ADMIN. 2) Consultar OrderItemLoss, Product.stock y movimientos de inventario.
**Resultado esperado:** Se crea OrderItemLoss con reemplazo PREPARED, Product.stock pasa a S-1 y registra movimiento REPLACEMENT_OUT.
**Criterio de aceptación:** Estado PREPARED sin esperar retorno original; exactamente 1 unidad descontada (S-1) con trazabilidad REPLACEMENT_OUT.
**Evidencia esperada:** Log JSON y movimientos de stock

### CP-092 — Reemplazo mantiene mismo pedido y no genera nuevo cobro
**Origen:** `C21.2` | **Prioridad:** Alta | **Método:** INTEGRACION | **Trazabilidad:** NR-27; NP-12, NP-18
**Dependencias:** Pedido con pérdida y reemplazo PREPARED, F1, F2, F5
**Entradas:** Pedido original con 1 PurchaseReceipt y saldo inicial de CLIENTE-A tras compra original.
**Acciones:** 1) Consultar pedido, historial de pérdida/reemplazo, PurchaseReceipt y saldo tras LOSS_DECLARE.
**Resultado esperado:** Conserva el mismo pedido e historial de pérdida/reemplazo; no crea nuevo PurchaseReceipt ni nuevo débito.
**Criterio de aceptación:** Conteo de PurchaseReceipt igual a 1, saldo sin cargos adicionales y mismo ID de pedido.
**Evidencia esperada:** Log pedido, recibo y saldo en BD

### CP-093 — Declarar pérdida con stock 0 crea PENDING sin stock negativo
**Origen:** `C22.1` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-27; NP-18
**Dependencias:** POST /api/v1/dispatch/interventions, Product.stock = 0, F5
**Entradas:** Ítem con Product.stock === 0; solicitud LOSS_DECLARE válida con orderId, orderItemId y requestId.
**Acciones:** 1) Ejecutar LOSS_DECLARE como ADMIN. 2) Consultar estado de OrderItemLoss, Product.stock y movimientos.
**Resultado esperado:** Crea pérdida en estado PENDING sin descuento de stock (se mantiene en 0) ni reemplazo ficticio.
**Criterio de aceptación:** Estado PENDING, Product.stock === 0 (sin valores negativos) y cero movimientos REPLACEMENT_OUT.
**Evidencia esperada:** Log JSON y verificación Product.stock

### CP-094 — Contacto y reprogramación tras reemplazo sin entrega hoy
**Origen:** `C22.2` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-27; NP-18
**Dependencias:** Reemplazo PREPARED en pedido gestionable, F5
**Entradas:** Pedido con reemplazo PREPARED sin entrega posible hoy; acciones CONTACT y RESCHEDULE con fecha acordada.
**Acciones:** 1) Registrar CONTACT como ADMIN. 2) Ejecutar RESCHEDULE con fecha futura válida. 3) Consultar auditoría y pedido.
**Resultado esperado:** Registra acciones CONTACT y RESCHEDULE en auditoría y actualiza fecha acordada del pedido sin crear entrega ficticia.
**Criterio de aceptación:** Fecha acordada persistida, historial auditado de CONTACT/RESCHEDULE y sin marcas de entrega adelantada.
**Evidencia esperada:** Log JSON y tabla DispatchAudit

### CP-095 — Preparación diferida al reponer stock y 409 NO_FREE_STOCK
**Origen:** `C22.3` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-27; NP-18
**Dependencias:** Pérdida en estado PENDING, ajuste de stock, F5
**Entradas:** Pérdida PENDING con lossId; primero stock = 0, luego reposición a stock = S (>= 1); acción REPLACEMENT_PREPARE.
**Acciones:** 1) Invocar REPLACEMENT_PREPARE con stock 0. 2) Reponer stock a S. 3) Repetir REPLACEMENT_PREPARE y validar.
**Resultado esperado:** Con stock 0 rechaza 409 NO_FREE_STOCK; tras reponer a S convierte pérdida a PREPARED y descuenta 1 unidad (S-1).
**Criterio de aceptación:** 409 NO_FREE_STOCK sin descuento en paso 1; transición PENDING->PREPARED y stock S-1 en paso 3.
**Evidencia esperada:** Log JSON 409/200 y stock en BD

### CP-096 — Recuperación tardía SELLABLE suma +1 sin doble entrega
**Origen:** `C23.1` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-28; NP-12, NP-18
**Dependencias:** Pérdida declarada/reemplazada en OrderItemLoss, F5
**Entradas:** Pérdida con lossId y Product.stock = S; acción ORIGINAL_RECOVER con recoveryCondition = SELLABLE.
**Acciones:** 1) Ejecutar ORIGINAL_RECOVER SELLABLE como ADMIN. 2) Consultar Product.stock, movimiento RECOVERY_IN y pedido.
**Resultado esperado:** Product.stock aumenta a S+1 con movimiento RECOVERY_IN, conserva historial de pérdida/reemplazo y no duplica entrega.
**Criterio de aceptación:** Stock exacto S+1, registro de condición SELLABLE, historial íntegro y pedido sin entrega duplicada.
**Evidencia esperada:** Log JSON y movimientos de stock

### CP-097 — Recuperación tardía DAMAGED registra estado sin sumar stock
**Origen:** `C23.2` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-28; NP-12, NP-18
**Dependencias:** Pérdida declarada en OrderItemLoss, F5
**Entradas:** Pérdida con lossId y Product.stock = S; acción ORIGINAL_RECOVER con recoveryCondition = DAMAGED.
**Acciones:** 1) Ejecutar ORIGINAL_RECOVER DAMAGED como ADMIN. 2) Consultar condición en OrderItemLoss y Product.stock.
**Resultado esperado:** Registra recuperación tardía con condición física DAMAGED sin aumentar Product.stock (se mantiene en S).
**Criterio de aceptación:** Condición DAMAGED persistida en OrderItemLoss, Product.stock igual a S y sin movimiento RECOVERY_IN vendible.
**Evidencia esperada:** Log JSON y registro OrderItemLoss

### CP-098 — Repetición de ORIGINAL_RECOVER rechaza 409 sin doble suma
**Origen:** `C23.3` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-28; NP-12, NP-18
**Dependencias:** Pérdida ya recuperada mediante ORIGINAL_RECOVER, F5
**Entradas:** Mismo lossId ya recuperado previamente; segundo envío de ORIGINAL_RECOVER con nuevo requestId.
**Acciones:** 1) Enviar ORIGINAL_RECOVER sobre lossId ya recuperado. 2) Verificar código de respuesta, stock y movimientos.
**Resultado esperado:** Operación rechazada con 409 ORIGINAL_ALREADY_RECOVERED sin sumar ni descontar unidades adicionales.
**Criterio de aceptación:** HTTP 409 ORIGINAL_ALREADY_RECOVERED; Product.stock e historial de movimientos idénticos a antes del reintento.
**Evidencia esperada:** Log HTTP 409 y stock en BD

### CP-099 — Cancelación LOSS_CANCEL restituye stock y bloquea si no aplica
**Origen:** `C23.4` | **Prioridad:** Alta | **Método:** API | **Trazabilidad:** NR-27, NR-28; NP-12, NP-18
**Dependencias:** Pérdidas PREPARED, PENDING y bloqueadas (reclamada/retiro), F5
**Entradas:** Pérdida PREPARED con stock S; pérdida recuperada/con reclamo activo o retiro en tienda; LOSS_CANCEL.
**Acciones:** 1) Ejecutar LOSS_CANCEL sobre pérdida PREPARED. 2) Verificar soft-cancel y stock S+1. 3) Probar casos bloqueados.
**Resultado esperado:** Soft-cancel de OrderItemLoss y restituye +1 (REPLACEMENT_CANCEL_IN) si estaba PREPARED; rechaza 409 en bloqueados.
**Criterio de aceptación:** Stock S+1 solo en PREPARED, soft-cancel auditado y HTTP 409 cuando ya hubo recuperación, reclamo activo o retiro.
**Evidencia esperada:** Log JSON 200/409 y stock en BD

### CP-100 — Concurrencia UNIT_RECOVERY_CONFIRM vs LOSS_DECLARE en unidad
**Origen:** `C24.1` | **Prioridad:** Alta | **Método:** INTEGRACION | **Trazabilidad:** NR-25 a NR-29; Transversal
**Dependencias:** Entorno aislado concurrente, ruta INTERRUPTED, F5
**Entradas:** Misma unidad U1 pendiente en ruta INTERRUPTED; 2 hilos simultáneos: UNIT_RECOVERY_CONFIRM y LOSS_DECLARE.
**Acciones:** 1) Disparar ambas peticiones concurrentemente con requestId distintos. 2) Inspeccionar respuestas y BD.
**Resultado esperado:** Exactamente una operación gana (200) y la otra rechaza con 409 UNIT_HAS_ACTIVE_LOSS o 409 UNIT_ALREADY_RECOVERED.
**Criterio de aceptación:** Sin estado inconsistente ni doble mutación: 1 éxito y 1 conflicto 409 específico según orden de serialización.
**Evidencia esperada:** Log concurrencia y estado en BD

### CP-101 — Idempotencia de intervenciones con requestId UUID y conflicto
**Origen:** `C24.2` | **Prioridad:** Alta | **Método:** INTEGRACION | **Trazabilidad:** NR-25 a NR-29; Transversal
**Dependencias:** POST /api/v1/dispatch/interventions, tabla DispatchAudit, F5
**Entradas:** Mismo requestId UUID: 1) envío válido, 2) repetición idéntica, 3) reenvío con payload o acción distinta.
**Acciones:** 1) Ejecutar intervención válida. 2) Reenviar payload idéntico con mismo requestId. 3) Reenviar payload distinto.
**Resultado esperado:** Repetición idéntica re-entrega auditoría original sin re-ejecutar efecto; payload distinto rechaza 409 ConflictException.
**Criterio de aceptación:** 1 sola mutación de estado, mismo registro de auditoría en replay y 409 ConflictException ante payload alterado.
**Evidencia esperada:** Log JSON 200/409 y DispatchAudit

### CP-102 — Rendimiento generación de rutas con volumen de 100 pedidos
**Origen:** `C29.1` | **Prioridad:** Complementaria | **Método:** NO_FUNCIONAL | **Trazabilidad:** NR-17 a NR-19; Plan Sec. 4
**Dependencias:** Entorno aislado, motor vial activo, script JMeter/k6, F5, F6
**Entradas:** Dataset sintético aislado de 100 pedidos elegibles del día dentro de cobertura vial.
**Acciones:** 1) Registrar versión y hardware del entorno. 2) Medir GET /api/v1/route-proposals con 100 pedidos.
**Resultado esperado:** Se registran latencia p50, máximo, tasa de errores, versión y hardware sin clasificar contra un SLA inventado.
**Criterio de aceptación:** Reporte reproducible con p50, max, errores y especificaciones de entorno/versión para línea base de 100 pedidos.
**Evidencia esperada:** Reporte JMeter/k6 y log entorno

### CP-103 — Rendimiento generación de rutas con volumen de 500 pedidos
**Origen:** `C29.2` | **Prioridad:** Complementaria | **Método:** NO_FUNCIONAL | **Trazabilidad:** NR-17 a NR-19; Plan Sec. 4
**Dependencias:** Entorno aislado, motor vial activo, script JMeter/k6, F5, F6
**Entradas:** Dataset sintético aislado de 500 pedidos elegibles del día con distribución horaria y vial.
**Acciones:** 1) Mantener misma versión y hardware que en 100 pedidos. 2) Medir GET /api/v1/route-proposals con 500 pedidos.
**Resultado esperado:** Se documentan p50, máximo, errores o impedimento real observado en entorno aislado sin inventar SLA fijo.
**Criterio de aceptación:** Evidencia completa de p50, max, errores, versión y hardware para el volumen de 500 pedidos.
**Evidencia esperada:** Reporte JMeter/k6 y log entorno

### CP-104 — Rendimiento generación de rutas con volumen de 2000 pedidos
**Origen:** `C29.3` | **Prioridad:** Complementaria | **Método:** NO_FUNCIONAL | **Trazabilidad:** NR-17 a NR-19; Plan Sec. 4
**Dependencias:** Entorno aislado, motor vial activo, script JMeter/k6, F5, F6
**Entradas:** Dataset sintético aislado de 2000 pedidos elegibles del día; referencia comparativa 100/500.
**Acciones:** 1) Medir GET /api/v1/route-proposals con 2000 pedidos. 2) Comparar tiempos y errores frente a 100 y 500 pedidos.
**Resultado esperado:** Se registran p50, máximo, errores, versión y hardware junto con comparativa 100/500/2000 sin umbral inventado.
**Criterio de aceptación:** Tabla comparativa reproducible 100/500/2000 con métricas y entorno reales, sin calificar aprobación por SLA arbitrario.
**Evidencia esperada:** Reporte JMeter/k6 comparativo

### CP-105 — Concurrencia Shop última unidad: [201, 409 STOCK_UNAVAILABLE]
**Origen:** `C31.1` | **Prioridad:** Alta | **Método:** INTEGRACION | **Trazabilidad:** NR-01, NR-05, NR-29; Transversal
**Dependencias:** POST /api/v1/shop/checkout, entorno concurrente, F1, F2
**Entradas:** Producto con stock = 1; 2 solicitudes simultáneas válidas (CLIENTE-A y CLIENTE-B) con tarjetas demo e Idempotency-Key.
**Acciones:** 1) Ejecutar ambos POST /api/v1/shop/checkout en paralelo. 2) Consultar respuestas, stock, pedidos y recibos.
**Resultado esperado:** Respuestas [201, 409 STOCK_UNAVAILABLE]; se crea 1 solo pedido y 1 recibo, stock final 0 sin sobreventa.
**Criterio de aceptación:** Exactamente un 201 y un 409 STOCK_UNAVAILABLE; stock >= 0 (0 final) y sin débito ni pedido para la rechazada.
**Evidencia esperada:** Log concurrencia y BD Shop

### CP-106 — Concurrencia Shop saldo: [201, 422 INSUFFICIENT_DEMO_FUNDS]
**Origen:** `C31.2` | **Prioridad:** Alta | **Método:** INTEGRACION | **Trazabilidad:** NR-01, NR-05, NR-29; Transversal
**Dependencias:** POST /api/v1/shop/checkout, tarjeta DEMO_LIMITED, F1, F2
**Entradas:** Tarjeta DEMO_LIMITED con saldo 2000c; producto con stock >= 2; 2 compras concurrentes de 1725c.
**Acciones:** 1) Lanzar 2 POST /api/v1/shop/checkout simultáneos de 1725c. 2) Verificar respuestas, saldo final y stock.
**Resultado esperado:** Respuestas [201, 422 INSUFFICIENT_DEMO_FUNDS]; saldo final 275c y stock descontado solo 1 vez.
**Criterio de aceptación:** 1 compra aprobada (201) y 1 rechazada (422 INSUFFICIENT_DEMO_FUNDS); saldo final 275c y stock intacto en el rechazo.
**Evidencia esperada:** Log concurrencia, saldo y stock

### CP-107 — Fallo pre-commit Shop con trigger en purchaseReceipt: rollback
**Origen:** `C31.3` | **Prioridad:** Alta | **Método:** INTEGRACION | **Trazabilidad:** NR-01, NR-05, NR-29; Transversal
**Dependencias:** Entorno BD aislado con trigger BEFORE INSERT controlado, F1, F2
**Entradas:** Prueba de integración/BD aislada: trigger BEFORE INSERT controlado en purchaseReceipt; checkout válido.
**Acciones:** 1) Activar trigger controlado en entorno aislado. 2) Ejecutar POST /api/v1/shop/checkout. 3) Consultar BD y retirar trigger.
**Resultado esperado:** Checkout falla con HTTP 500 y realiza rollback total: sin pedido, sin PurchaseReceipt, sin descuento de stock ni saldo.
**Criterio de aceptación:** HTTP 500; conteos de Order, PurchaseReceipt, Product.stock y saldo demo idénticos al estado previo a la petición.
**Evidencia esperada:** Log HTTP 500 y consulta SQL pre/post
