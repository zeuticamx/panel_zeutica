FROM nginx:alpine

# Recibe API_BASE como argumento de build (desde EasyPanel)
ARG API_BASE=http://localhost:8000
ENV API_BASE=$API_BASE

# Copia archivos
COPY . /usr/share/nginx/html

# Inyecta API_BASE en index.html usando envsubst.
# Se valida antes: un valor con | & \ o comillas rompería el sed (o inyectaría código en index.html).
RUN echo "$API_BASE" | grep -Eq '^https?://[A-Za-z0-9._:/-]+$' || { echo "API_BASE invalida: $API_BASE" >&2; exit 1; } && \
    apk add --no-cache gettext && \
    cd /usr/share/nginx/html && \
    sed -i "s|// window.API_BASE_URL = .*|window.API_BASE_URL = '${API_BASE}';|" index.html && \
    apk del gettext

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]