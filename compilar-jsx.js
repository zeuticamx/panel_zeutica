// Precompila los <script type="text/babel"> de index.html a JS plano para producción.
// Lo corre el Dockerfile (etapa de build); en desarrollo local index.html sigue usando
// Babel en el navegador y no hace falta correrlo.
//
// Usa el mismo @babel/standalone y las mismas opciones que aplica en el navegador
// (buildBabelOptions de 7.29.0: presets react + env y tres plugins), así que el código
// que se ejecuta es el mismo; solo cambia que ya no se transpila en cada carga.
//
// Uso: node compilar-jsx.js <carpeta-del-sitio>   (modifica la carpeta en sitio)
'use strict';
const fs = require('fs');
const path = require('path');
const Babel = require('@babel/standalone');

const raiz = path.resolve(process.argv[2] || '.');
const rutaIndex = path.join(raiz, 'index.html');
let html = fs.readFileSync(rutaIndex, 'utf8');

const OPCIONES = {
  presets: ['react', 'env'],
  plugins: ['transform-class-properties', 'transform-object-rest-spread', 'transform-flow-strip-types'],
};

function fallar(msg) {
  console.error('compilar-jsx: ' + msg);
  process.exit(1);
}

// Comentarios HTML fuera: un <script> comentado (p. ej. pendientes.jsx) no debe compilarse.
html = html.replace(/<!--[\s\S]*?-->/g, (c) => (c.includes('<script') ? '' : c));

let compilados = 0;
html = html.replace(
  /<script type="text\/babel" src="([^"?]+)\.jsx(\?[^"]*)?"><\/script>/g,
  (_, ruta, query) => {
    const origen = path.join(raiz, ruta + '.jsx');
    const codigo = fs.readFileSync(origen, 'utf8');
    let salida;
    try {
      salida = Babel.transform(codigo, Object.assign({ filename: ruta + '.jsx' }, OPCIONES)).code;
    } catch (e) {
      fallar(ruta + '.jsx: ' + e.message);
    }
    fs.writeFileSync(path.join(raiz, ruta + '.js'), salida);
    fs.unlinkSync(origen);
    compilados++;
    return '<script src="' + ruta + '.js' + (query || '') + '"></script>';
  }
);

if (html.includes('text/babel')) fallar('quedó algún <script type="text/babel"> sin compilar');

// Babel ya no se necesita en el navegador.
const antes = html.length;
html = html.replace(/<script src="https:\/\/unpkg\.com\/@babel\/standalone@[^"]*"[^>]*><\/script>\n?/, '');
if (html.length === antes) fallar('no encontré el <script> de @babel/standalone');

// React en build de producción (más ligero y rápido que el de desarrollo).
const REACT_PROD = {
  react: 'sha384-DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z',
  'react-dom': 'sha384-gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1',
};
for (const pkg of Object.keys(REACT_PROD)) {
  const re = new RegExp(
    '<script src="https://unpkg\\.com/' + pkg + '@18\\.3\\.1/umd/' + pkg + '\\.development\\.js"[^>]*></script>'
  );
  if (!re.test(html)) fallar('no encontré el <script> de ' + pkg + '@18.3.1 (development)');
  html = html.replace(
    re,
    '<script src="https://unpkg.com/' + pkg + '@18.3.1/umd/' + pkg + '.production.min.js" integrity="' +
      REACT_PROD[pkg] + '" crossorigin="anonymous"></script>'
  );
}

fs.writeFileSync(rutaIndex, html);
console.log('compilar-jsx: ' + compilados + ' archivos .jsx compilados');
