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
Ver `docs/DEMO.md` (Test + Evidencia).

## Test rápido
GET /mcp devuelve 405 (Method Not Allowed).
Las tools se consumen vía POST (JSON-RPC) desde Laburen.

## Setup (D1)
wrangler d1 execute laburen_shop --remote --file=sql/0001_schema.sql
python scripts/xlsx_to_sql.py data/products.xlsx sql/seed_products.sql
wrangler d1 execute laburen_shop --remote --file=sql/seed_products.sql

## Probar Chatwoot Widget en local (sin Laburen)

> Esto es solo para test manual rápido. La evaluación principal se hace en vivo desde Chatwoot/Laburen.

### Requisitos
- Python 3.x
- Un Inbox tipo **Website** creado en Chatwoot (ya configurado en este challenge)

### 1) Crear el archivo HTML local
1. Crear el archivo `test/chatwoot_test.html`
2. Pegar dentro el snippet del widget de Chatwoot (lo obtenés desde Chatwoot → Settings → Inboxes → Website → Copy snippet)

Contenido base:

```html
<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Chatwoot Test</title></head>
  <body>
    <h1>Chatwoot Test</h1>

  <!-- PEGAR AQUÍ EL SNIPPET DEL WIDGET DE CHATWOOT -->

  </body>
</html>
```

### 2) Servir el HTML con un server local

- Desde la raíz del repo:
python -m http.server 8000

- Abrir en el navegador:
http://localhost:8000/test/chatwoot_test.html




