# Laburen MCP Shop (Challenge)

La demo se prueba en vivo desde Chatwoot (Website widget). El script Python solo sirve para regenerar el seed desde el XLSX (opcional).

## MCP Endpoint
https://laburen-mcp-shop.lucasferreyra6991.workers.dev/mcp

## Tools
- list_products
- get_product
- create_cart
- update_cart
- get_cart
- chatwoot_add_labels
- chatwoot_handoff

## Docs
Ver `docs/CONCEPT.md` (flujo + endpoints + errores).

## Test rápido
GET /mcp devuelve 405 (Method Not Allowed).
Las tools se consumen vía POST (JSON-RPC) desde Laburen.

## Setup (D1)
wrangler d1 execute laburen_shop --remote --file=sql/0001_schema.sql
python scripts/xlsx_to_sql.py data/products.xlsx sql/seed_products.sql
wrangler d1 execute laburen_shop --remote --file=sql/seed_products.sql





