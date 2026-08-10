// ===== Zeutica — Rastreo de Importaciones (orquestador) =====
const { useState: pe_uS } = React;

function PageEmbarques() {
  const [vista, setVista] = pe_uS({ tipo: 'lista' }); // { tipo: 'lista' | 'nuevo' | 'detalle', id? }
  const [reloadToken, setReloadToken] = pe_uS(0);

  if (vista.tipo === 'nuevo') {
    return (
      <window.EmbarqueForm
        onSaved={(id) => { setReloadToken(t => t + 1); setVista({ tipo: 'detalle', id }); }}
        onCancel={() => setVista({ tipo: 'lista' })}
      />
    );
  }

  if (vista.tipo === 'detalle') {
    return (
      <window.EmbarqueDetail
        id={vista.id}
        onBack={() => { setReloadToken(t => t + 1); setVista({ tipo: 'lista' }); }}
        onDeleted={() => { setReloadToken(t => t + 1); setVista({ tipo: 'lista' }); }}
      />
    );
  }

  return (
    <window.EmbarquesList
      reloadToken={reloadToken}
      onNew={() => setVista({ tipo: 'nuevo' })}
      onSelect={(id) => setVista({ tipo: 'detalle', id })}
    />
  );
}

window.PageEmbarques = PageEmbarques;
