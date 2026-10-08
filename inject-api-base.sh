#!/bin/bash
# Lee API_BASE desde .env e inyecta en index.html antes de desplegar
# Uso: ./inject-api-base.sh

if [ ! -f .env ]; then
  echo "Error: .env no encontrado en $(pwd)"
  exit 1
fi

source .env

if [ -z "$API_BASE" ]; then
  echo "Error: API_BASE no está definida en .env"
  exit 1
fi

# Reemplaza el placeholder en index.html
sed -i.bak "s|// window.API_BASE_URL = 'https://postgresqldb-server-zeutica.i4mjht.easypanel.host';|window.API_BASE_URL = '$API_BASE';|" index.html

echo "✓ API_BASE inyectada en index.html: $API_BASE"
