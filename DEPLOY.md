# Deploy en EasyPanel

## Configuración API_BASE

El panel se despliega en EasyPanel, que injeta `API_BASE` desde variables de entorno.

### Pasos:

1. **En EasyPanel**, ve a tu aplicación y abre **Settings** → **Environment Variables** o **Build Variables**

2. **Agrega la variable:**
   ```
   API_BASE=https://postgresqldb-server_zeutica.i4mjht.easypanel.host
   ```

3. **Guarda y haz un nuevo Deploy** (rebuild)

El `Dockerfile` automáticamente inyectará esta URL en `index.html` durante el build.

### Cómo funciona:

- `Dockerfile` recibe `API_BASE` como argumento de build
- Antes de iniciar nginx, modifica `index.html` y reemplaza:
  ```javascript
  // window.API_BASE_URL = 'https://...';
  ```
  con:
  ```javascript
  window.API_BASE_URL = 'https://postgresqldb-server_zeutica.i4mjht.easypanel.host';
  ```
- `api.jsx` usa esa variable global si existe, sino fallback a localhost

### Para desarrollo local:

No necesitas hacer nada especial. El panel usa `http://127.0.0.1:8000` automáticamente.

### Verificar que funciona:

En el navegador, abre DevTools (F12) → Console y verifica:
```javascript
window.API_BASE_URL
```
Debería mostrar la URL correcta.
