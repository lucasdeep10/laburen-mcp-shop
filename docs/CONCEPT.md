# Desafío Laburen — Fase Conceptual (Agente vendedor con MCP + DB + Chatwoot)

## Objetivo
Construir un agente de IA que pueda:
1) Explorar productos (buscar/listar)
2) Mostrar detalles de productos
3) Crear un carrito por conversación y agregar items
4) (Extra) Editar carrito (cambiar cantidades / eliminar)
5) Derivar a humano en Chatwoot dejando contexto y etiquetas

## Arquitectura (alto nivel)
Usuario (WhatsApp) → Chatwoot → Laburen Agent → MCP Server (Cloudflare Worker) → D1 (productos + carritos)
y opcionalmente → Chatwoot API (labels / nota privada / handoff)

## Supuestos de diseño
- **Un carrito por conversación**: `carts.conversation_id` único.
- El agente **valida stock**, pero **no descuenta stock** (no hay checkout real en el challenge).
- Identidad: `conversation_id` proviene de Chatwoot (ID de conversación).

---

## Diagrama de flujo (interacción)

```mermaid
flowchart TD
  A[Usuario pregunta por productos] --> B{Intención}
  B -->|Explorar / buscar| C[MCP: list_products(q, inStockOnly, limit)]
  C --> D[Agente muestra opciones + pregunta preferencia]
  D --> E{Usuario elige producto}
  E -->|Pide detalle| F[MCP: get_product(id)]
  F --> D

  E -->|Quiere comprar / agregar| G[MCP: create_cart(conversation_id) si no existe]
  G --> H[MCP: update_cart(conversation_id, items[{product_id, qty}])]
  H --> I[Agente resume carrito: items + total]
  I --> J{Usuario pide editar?}
  J -->|Sí| K[MCP: update_cart (cambia qty / qty=0 elimina)]
  K --> I
  J -->|No| L{Usuario quiere humano / cerrar}
  L -->|Sí| M[MCP: chatwoot_handoff(conversation_id, reason, summary)]
  L -->|No| D
Endpoints / Tools (MCP)
MCP HTTP Endpoint (Cloudflare Worker)
URL base: https://<tu-worker>.workers.dev/mcp

Método: POST (JSON-RPC)

Header recomendado: MCP-Protocol-Version: 2025-06-18

Tools del MCP
1) list_products
Uso: explorar catálogo y buscar por texto
Input: { q?: string, inStockOnly?: boolean, limit?: number }
Output: { products: [{id,name,description,price,stock}], count }
Regla de agente: si el usuario “busca”, “ver opciones”, “qué tenés”, llamar a esta tool.

2) get_product
Uso: detalle del producto elegido
Input: { id: number }
Output: { product: {id,name,description,price,stock} | null }

3) create_cart
Uso: asegurar carrito por conversación
Input: { conversation_id: string, items?: [{product_id:number, qty:number}] }
Output: { cart, items, total }

4) update_cart (Extra: edición)
Uso: agregar / actualizar / eliminar items
Input: { conversation_id: string, items: [{product_id:number, qty:number}] }
Reglas:

qty > 0 agrega o actualiza

qty = 0 elimina el item

valida qty <= stock, si no: error “Stock insuficiente…”

5) get_cart
Uso: ver estado del carrito
Input: { conversation_id: string }
Output: { cart|null, items: [...], total }

6) chatwoot_add_labels
Uso: etiquetar conversación según productos / estado
Input: { conversation_id: string, labels: string[] }
Regla: mergea labels (no pisa).

7) chatwoot_handoff
Uso: derivación a humano con contexto
Input: { conversation_id: string, reason: string, summary: string }
Acciones: agrega labels + nota privada (resumen del carrito y motivo).
Regla de agente: si el usuario pide “hablar con humano”, “asesor”, “finalizar compra”, usar esta tool.

Manejo de errores (comportamiento esperado)
Si list_products no encuentra resultados → pedir reformulación (“marca”, “rango de precio”, “categoría”).

Si update_cart falla por stock → el agente ofrece el máximo disponible o alternativas.

Si faltan datos (producto o qty) → el agente pregunta antes de llamar tools.

Criterios de éxito (demo)
Usuario: “Quiero ver productos” → lista opciones (MCP)

Usuario: “Mostrame el 3” → detalle (MCP)

Usuario: “Agregá 2” → carrito + total (MCP)

Usuario: “Cambiá a 1” → edita (MCP)

Usuario: “Quiero hablar con un humano” → handoff + resumen en Chatwoot (MCP → Chatwoot)

yaml
Copiar código

---

### Próximo paso (técnico, para que la demo funcione)
1) **Cargar products.xlsx en D1** (tabla `products`)  
2) En Laburen, configurar el agente para que use las tools MCP y pase `conversation_id` correcto  
3) Probar E2E en Chatwoot: listar → detalle → carrito → editar → handoff

Si querés, en el próximo mensaje te armo el **“script de carga de products.xlsx”** (2 opciones: desde UI de D1 o conversión a SQL) y un **prompt de instrucciones** para Laburen para que el agente se comporte “vendedor” y use tools de forma consistente.
::contentReference[oaicite:0]{index=0}