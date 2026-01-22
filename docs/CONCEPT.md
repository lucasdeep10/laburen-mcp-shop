# Desafío Laburen — Fase Conceptual (Agente vendedor con MCP + DB + Chatwoot)

## Objetivo
Construir un agente de IA que pueda:
- Explorar productos (buscar/listar)
- Mostrar detalles de productos
- Crear un carrito por conversación y agregar ítems
- (Extra) Editar carrito (cambiar cantidades / eliminar)
- Derivar a humano en Chatwoot dejando contexto y etiquetas

## Arquitectura (alto nivel)
Usuario → Chatwoot (widget/WhatsApp) → Agente Laburen → MCP (Cloudflare Worker) → D1 (productos + carritos)  
Opcional: MCP → Chatwoot API (labels / private note / handoff)

## Supuestos de diseño
- Un carrito por conversación: `carts.conversation_id` es único.
- Se valida stock (`qty <= stock`) pero no se descuenta stock (no hay checkout real).
- `conversation_id` proviene del ID real de Chatwoot.

## Mapa de flujo (interacción)
```mermaid
flowchart TD
  A[Usuario busca productos] --> B[Tool: list_products]
  B --> C[Agente muestra opciones (IDs)]
  C --> D{Usuario elige}
  D -->|Detalle| E[Tool: get_product]
  E --> C

  D -->|Comprar| F[Tool: create_cart]
  F --> G[Tool: update_cart]
  G --> H[Tool: get_cart]
  H --> I{Editar carrito?}
  I -->|Sí| G
  I -->|No| J{Pide humano / cerrar}
  J -->|Sí| K[Tool: chatwoot_handoff]
  J -->|No| C
```

## Endpoints / Tools (MCP)

### MCP HTTP Endpoint

- URL: `https://<tu-worker>.workers.dev/mcp`
- Método: `POST` (JSON-RPC)
- Header: `MCP-Protocol-Version: 2025-06-18`

### Tools

1. `list_products`
- Input: `{ q?, inStockOnly?, limit? }`
- Output: `{ products[], count }`
1. `get_product`
- Input: `{ id }`
- Output: `{ product|null }`
1. `create_cart`
- Input: `{ conversation_id, items? }`
- Output: `{ cart, items, total }`
1. `update_cart` *(Extra: edición)*
- Input: `{ conversation_id, items:[{product_id, qty}] }`
- Reglas: `qty>0` upsert, `qty=0` elimina, valida stock.
1. `get_cart`
- Input: `{ conversation_id }`
- Output: `{ cart|null, items[], total }`
1. `chatwoot_add_labels`
- Input: `{ conversation_id, labels[] }`
- Acción: mergea labels (no pisa)
1. `chatwoot_handoff`
- Input: `{ conversation_id, reason, summary }`
- Acción: agrega labels + private note con resumen

## Manejo de errores (esperado)

- Sin resultados en `list_products`: pedir reformulación (tipo/talla/color/categoría).
- Stock insuficiente en `update_cart`: informar stock disponible y sugerir ajustar qty.
- Si faltan datos (ID o qty): preguntar antes de llamar tools.

## Demo mínima (criterio de éxito)

1. “Quiero ver productos” → `list_products`
2. “Ver detalle ID X” → `get_product`
3. “Agregar ID X cantidad Y” → `create_cart` + `update_cart` + `get_cart`
4. “Modificar ID X cantidad Y” / “Quitar ID X” → `update_cart`
5. “Finalizar compra” → `chatwoot_handoff`
