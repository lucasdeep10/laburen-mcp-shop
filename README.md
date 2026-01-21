# Laburen MCP Shop (Challenge)

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
