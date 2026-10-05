#!/usr/bin/env node
/**
 * Script de validación para construirParcela
 * Verifica que consignment_note viaje como string (código SAT)
 */

// Simula la función de construcción del payload
function construirParcela(paquete) {
  return {
    length: Number(paquete.length),
    width: Number(paquete.width),
    height: Number(paquete.height),
    weight: Number(paquete.weight),
    consignment_note: paquete.consignment_note ? String(paquete.consignment_note).trim() : undefined,
    package_type: (paquete.package_type || '').trim() || undefined,
    package_protected: true,
    declared_value: 2000.0,
  };
}

// Utilidad para assertions
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FALLO: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

// Tests
console.log('\n🧪 Validando payload de Skydropx...\n');

// Test 1: consignment_note como string
const test1 = construirParcela({
  length: 25,
  width: 20,
  height: 15,
  weight: 2,
  package_type: '4G',
  consignment_note: '53103200',
});
assert(test1.consignment_note === '53103200', 'consignment_note es "53103200" (string)');
assert(typeof test1.consignment_note === 'string', 'consignment_note es de tipo string');

// Test 2: consignment_note NO incluye descripción
assert(!test1.consignment_note.includes('-'), 'consignment_note NO incluye guion (sin descripción)');
assert(!test1.consignment_note.includes('Ropa'), 'consignment_note NO incluye texto descriptivo');

// Test 3: consignment_note vacío → undefined
const test3 = construirParcela({
  length: 25,
  width: 20,
  height: 15,
  weight: 2,
  package_type: '4G',
  consignment_note: '',
});
assert(test3.consignment_note === undefined, 'consignment_note vacío resulta en undefined');

// Test 4: consignment_note con espacios
const test4 = construirParcela({
  length: 25,
  width: 20,
  height: 15,
  weight: 2,
  package_type: '4G',
  consignment_note: '  52101508  ',
});
assert(test4.consignment_note === '52101508', 'consignment_note se trimea correctamente');
assert(!test4.consignment_note.includes(' '), 'consignment_note NO contiene espacios');

// Test 5: Payload completo
const test5 = construirParcela({
  length: 25,
  width: 20,
  height: 15,
  weight: 2,
  package_type: '4G',
  consignment_note: '53103200',
});
assert(test5.length === 25, 'length es número 25');
assert(test5.width === 20, 'width es número 20');
assert(test5.height === 15, 'height es número 15');
assert(test5.weight === 2, 'weight es número 2');
assert(test5.package_type === '4G', 'package_type es "4G"');
assert(test5.package_protected === true, 'package_protected es true');
assert(test5.declared_value === 2000.0, 'declared_value es 2000.0');

// Test 6: Conversión de strings numéricos
const test6 = construirParcela({
  length: '25.5',
  width: '20',
  height: '15',
  weight: '2.5',
  package_type: '4G',
  consignment_note: '53103200',
});
assert(test6.length === 25.5, 'length string "25.5" se convierte a número 25.5');
assert(test6.weight === 2.5, 'weight string "2.5" se convierte a número 2.5');
assert(typeof test6.length === 'number', 'length es de tipo number');

// Test 7: package_type vacío → undefined
const test7 = construirParcela({
  length: 25,
  width: 20,
  height: 15,
  weight: 2,
  package_type: '   ',
  consignment_note: '53103200',
});
assert(test7.package_type === undefined, 'package_type con solo espacios resulta en undefined');

// Test 8: Diferentes códigos SAT
const codigosSAT = ['53103200', '52101508'];
codigosSAT.forEach(codigo => {
  const result = construirParcela({
    length: 25,
    width: 20,
    height: 15,
    weight: 2,
    package_type: '4G',
    consignment_note: codigo,
  });
  assert(result.consignment_note === codigo, `consignment_note "${codigo}" se preserva correctamente`);
});

console.log('\n✨ Todos los tests pasaron correctamente!\n');
console.log('📋 Resumen:');
console.log('  • consignment_note viaja como STRING (código SAT)');
console.log('  • La UI muestra label "53103200 - Ropa Desechable" pero payload envía "53103200"');
console.log('  • package_protected y declared_value están incluidos para seguro');
console.log('  • Todos los campos numéricos se convierten correctamente\n');
