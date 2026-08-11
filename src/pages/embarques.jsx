// ===== Zeutica — Rastreo de Importaciones (orquestador) =====
const { useState: pe_uS } = React;

function PageEmbarques({ user }) {
  const [vista, setVista] = pe_uS({ tipo: 'lista' }); // { tipo: 'lista' | 'nuevo' | 'detalle', id? }
  const [reloadToken, setReloadToken] = pe_uS(0);
  const esGerencia = window.AppShell.GERENCIA_USERS.includes(user);

  if (vista.tipo === 'nuevo' && esGerencia) {
    return (
      <window.EmbarqueForm
        onSaved={(id) => { setReloadToken(t => t + 1); setVista({ tipo: 'detalle', id }); }}
        onCancel={() => setVista({ tipo: 'lista' })}
      />
    );
  }

  if (vista.tipo === 'detalle') {
    return esGerencia ? (
      <window.EmbarqueDetail
        id={vista.id}
        onBack={() => { setReloadToken(t => t + 1); setVista({ tipo: 'lista' }); }}
        onDeleted={() => { setReloadToken(t => t + 1); setVista({ tipo: 'lista' }); }}
      />
    ) : (
      <window.EmbarqueViewer
        id={vista.id}
        onBack={() => setVista({ tipo: 'lista' })}
      />
    );
  }

  return (
    <window.EmbarquesList
      reloadToken={reloadToken}
      onNew={() => setVista({ tipo: 'nuevo' })}
      onSelect={(id) => setVista({ tipo: 'detalle', id })}
      esGerencia={esGerencia}
    />
  );
}

window.PageEmbarques = PageEmbarques;
