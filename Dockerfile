FROM nginx:alpine

# Recibe API_BASE como argumento de build (desde EasyPanel)
ARG API_BASE=http://localhost:8000
ENV API_BASE=$API_BASE

# Copia archivos
COPY . /usr/share/nginx/html

# Inyecta API_BASE en index.html usando envsubst
RUN apk add --no-cache gettext && \
    cd /usr/share/nginx/html && \
    sed -i "s|// window.API_BASE_URL = .*|window.API_BASE_URL = '${API_BASE}';|" index.html && \
    apk del gettext

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]