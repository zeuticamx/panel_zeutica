# Etapa 1: precompila los .jsx (antes los transpilaba Babel en el navegador en cada carga,
# lo que hacía lenta la página en datos móviles). Ver compilar-jsx.js.
FROM node:22-alpine AS build
WORKDIR /build
RUN npm install --no-audit --no-fund @babel/standalone@7.29.0
COPY . /build/sitio
RUN node /build/sitio/compilar-jsx.js /build/sitio && rm /build/sitio/compilar-jsx.js

# Etapa 2: nginx sirve el sitio ya compilado
FROM nginx:alpine

# Recibe API_BASE como argumento de build (desde EasyPanel)
ARG API_BASE=http://localhost:8000
ENV API_BASE=$API_BASE

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/sitio /usr/share/nginx/html
RUN rm -f /usr/share/nginx/html/nginx.conf /usr/share/nginx/html/Dockerfile

# Inyecta API_BASE en index.html usando envsubst.
# Se valida antes: un valor con | & \ o comillas rompería el sed (o inyectaría código en index.html).
RUN echo "$API_BASE" | grep -Eq '^https?://[A-Za-z0-9._:/-]+$' || { echo "API_BASE invalida: $API_BASE" >&2; exit 1; } && \
    apk add --no-cache gettext && \
    cd /usr/share/nginx/html && \
    sed -i "s|// window.API_BASE_URL = .*|window.API_BASE_URL = '${API_BASE}';|" index.html && \
    apk del gettext

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
