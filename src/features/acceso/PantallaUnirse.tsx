import { useState } from 'react';
import type { FormEvent } from 'react';
import { unirseConCodigo } from '../../db';
import type { Backend } from '../../nube';
import { Boton } from '../../ui/Boton';
import { CampoTexto } from '../../ui/CampoTexto';
import { Encabezado } from '../../ui/Encabezado';
import { IconoProveedores } from '../../ui/Iconos';

interface Props {
  backend: Backend;
  onUnido: () => void;
  onVolver: () => void;
}

/** El empleado entra al comercio con el código que le pasó el dueño. */
export function PantallaUnirse({ backend, onUnido, onVolver }: Props) {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await unirseConCodigo(backend, codigo, nombre);
      onUnido();
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-12">
      <Encabezado Icono={IconoProveedores} titulo="Unirme a un comercio" descripcion="Escribí el código que te pasó el dueño. Dura 7 días y sirve una sola vez." />
      <form onSubmit={enviar} className="mt-6 space-y-5" noValidate>
        <CampoTexto etiqueta="Código" valor={codigo} onCambiar={setCodigo} autoComplete="off" autoCapitalize="characters" placeholder="Ej.: 041C 24D4 2B33" />
        <CampoTexto etiqueta="Tu nombre" valor={nombre} onCambiar={setNombre} autoComplete="given-name" ayuda="Para que el dueño sepa quién sos." maxLength={60} />
        {error && (
          <p className="text-red-700" role="alert">
            {error}
          </p>
        )}
        <Boton type="submit" disabled={enviando || codigo.trim() === ''}>
          Unirme
        </Boton>
        <Boton type="button" variante="secundario" onClick={onVolver}>
          Volver
        </Boton>
      </form>
    </main>
  );
}
