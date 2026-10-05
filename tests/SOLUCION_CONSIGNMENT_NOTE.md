# Solución: Error HTTP 422 en consignment_note

## 🔴 Problema
```
HTTP 422: parcels.0.consignment_note: Input should be a valid string
```

El backend rechazaba el payload porque estaba enviando `consignment_note` como **integer**, pero Pydantic esperaba **string**.

## 🔧 Causa raíz
En [skydropx_envio.jsx:312](../src/pages/skydropx_envio.jsx#L312):
```javascript
// ❌ ANTES (incorrecto)
consignment_note: paquete.consignment_note ? Number(paquete.consignment_note) : undefined,
```

Esto convertía el código `'53103200'` a número `53103200`, que Pydantic rechazaba.

## ✅ Solución
```javascript
// ✅ DESPUÉS (correcto)
consignment_note: paquete.consignment_note ? String(paquete.consignment_note).trim() : undefined,
```

Ahora envía el código SAT como **string**, tal como lo espera el backend.

## 📋 Validación del backend

**Schema Pydantic** ([api_zeutica1/routers/skydropx.py:81](../../api_zeutica1/routers/skydropx.py#L81)):
```python
class Paquete(BaseModel):
    consignment_note: Optional[str] = Field(
        default=None, 
        description="Contenido del paquete (carta porte). Requerido para generar guia."
    )
```

El backend define `consignment_note: Optional[str]`, confirmando que debe ser **string**.

## 🎯 Comportamiento esperado

### UI (Formulario)
El select muestra labels amigables:
```
53103200 - Ropa Desechable
52101508 - Tapetes de Entrada
```

Así el usuario ve el significado, no solo números.

### Payload (Lo que se envía)
El formulario captura el `code` del select, que viaja como string:
```json
{
  "parcels": [{
    "length": 25,
    "width": 20,
    "height": 15,
    "weight": 2,
    "consignment_note": "53103200",
    "package_type": "4G",
    "package_protected": true,
    "declared_value": 2000.0
  }]
}
```

**Nota:** El payload contiene **solo el código** (`"53103200"`), no la descripción completa.

## ✅ Tests de validación

Se incluyó [validate_skydropx_payload.js](./validate_skydropx_payload.js) que valida:

✅ `consignment_note` viaja como **string**  
✅ `consignment_note` NO incluye descripción (sin guion)  
✅ `consignment_note` se trimea (sin espacios)  
✅ `package_protected` y `declared_value` están presentes (seguro)  
✅ Campos numéricos se convierten correctamente  
✅ Diferentes códigos SAT se preservan  

**Resultado:** ✨ Todos los tests pasaron

## 📝 Resumen de cambios

| Archivo | Cambio |
|---------|--------|
| [skydropx_envio.jsx:312](../src/pages/skydropx_envio.jsx#L312) | `Number()` → `String().trim()` |
| [skydropx_envio.jsx:48-50](../src/pages/skydropx_envio.jsx#L48-50) | Comentario aclarado |
| [validate_skydropx_payload.js](./validate_skydropx_payload.js) | Tests de validación |

## 🚀 Próximo paso

Generación de guía debería funcionar ahora sin error 422:
- `POST /api/v1/shipments` con payload correcto
- Backend recibe `consignment_note: "53103200"` (string) ✅
- Skydropx procesa sin errores de validación ✅
