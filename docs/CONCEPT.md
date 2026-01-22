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
- Se valida stock (`qty <= stock`) pero **no** se descuenta stock (no hay checkout real).
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
Endpoints / Tools (MCP)
MCP HTTP Endpoint
URL: https://<tu-worker>.workers.dev/mcp

Método: POST (JSON-RPC)

Header: MCP-Protocol-Version: 2025-06-18

Tools
list_products

Input: { q?, inStockOnly?, limit? }

Output: { products[], count }

get_product

Input: { id }

Output: { product|null }

create_cart

Input: { conversation_id, items? }

Output: { cart, items, total }

update_cart (Extra: edición)

Input: { conversation_id, items:[{product_id, qty}] }

Reglas: qty>0 upsert, qty=0 elimina, valida stock.

get_cart

Input: { conversation_id }

Output: { cart|null, items[], total }

chatwoot_add_labels

Input: { conversation_id, labels[] }

Acción: mergea labels (no pisa)

chatwoot_handoff

Input: { conversation_id, reason, summary }

Acción: agrega labels + private note con resumen

Manejo de errores (esperado)
Sin resultados en list_products: pedir reformulación (tipo/talla/color/categoría).

Stock insuficiente en update_cart: informar stock disponible y sugerir ajustar qty.

Si faltan datos (ID o qty): preguntar antes de llamar tools.

Demo mínima (criterio de éxito)
“Quiero ver productos” → list_products

“Ver detalle ID X” → get_product

“Agregar ID X cantidad Y” → create_cart + update_cart + get_cart

“Modificar ID X cantidad Y” / “Quitar ID X” → update_cart

“Finalizar compra” → chatwoot_handoff

yaml
Copiar código

Con esto, GitHub te renderiza el diagrama sin errores.

---

## 2) README con bloques de código (mejor presentación)
Tu README está bien, pero te conviene que el “Setup (D1)” esté en bloque para que se vea prolijo.

> Reemplazá solo la sección `## Setup (D1)` por esta:

```md
## Setup (D1)

```bash
wrangler d1 execute laburen_shop --remote --file=sql/0001_schema.sql
python scripts/xlsx_to_sql.py data/products.xlsx sql/seed_products.sql
wrangler d1 execute laburen_shop --remote --file=sql/seed_products.sql
yaml
Copiar código

---

## 3) Limpieza final (importantísimo)
En tu `CONCEPT.md` eliminá cualquier línea tipo:
- `Unable to render rich display`
- links a docs de GitHub
- `::contentReference[...]`

Eso **no debe** estar en el entregable.

---

## 4) Commit final recomendado
```bash
git add docs/CONCEPT.md README.md
git commit -m "Fix conceptual doc and improve README formatting"
git push
