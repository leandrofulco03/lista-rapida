import { useEffect, useRef, useState } from 'react';
import { Boton } from './Boton';

/**
 * Escáner de códigos de barras con la cámara, con el detector del navegador (BarcodeDetector).
 * Lo tienen Chrome en Android y en computadoras con cámara; en los que no, el botón no aparece y se
 * escribe el código (un lector de códigos USB o Bluetooth también "escribe" el código en el campo).
 */

interface DetectorCodigos {
  detect(fuente: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type ConstructorDetector = new (opciones?: { formats?: string[] }) => DetectorCodigos;

const FORMATOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'];

export const puedeEscanear = (): boolean =>
  typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;

interface Props {
  onCodigo: (codigo: string) => void;
  onCerrar: () => void;
}

export function Escaner({ onCodigo, onCerrar }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  // La cámara se abre una vez; el aviso puede cambiar sin reiniciarla.
  const alLeer = useRef(onCodigo);
  alLeer.current = onCodigo;

  useEffect(() => {
    let flujo: MediaStream | null = null;
    let activo = true;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const Detector = (window as unknown as { BarcodeDetector: ConstructorDetector }).BarcodeDetector;
    const detector = new Detector({ formats: FORMATOS });

    async function buscar() {
      if (!activo || !video.current) return;
      try {
        if (video.current.readyState >= 2) {
          const [codigo] = await detector.detect(video.current);
          if (codigo?.rawValue && activo) {
            activo = false;
            navigator.vibrate?.(80);
            alLeer.current(codigo.rawValue.trim());
            return;
          }
        }
      } catch {
        // Un cuadro que no se pudo leer: se prueba con el siguiente.
      }
      espera = setTimeout(buscar, 200);
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(async (f) => {
        flujo = f;
        if (!activo || !video.current) return f.getTracks().forEach((t) => t.stop());
        video.current.srcObject = f;
        await video.current.play();
        buscar();
      })
      .catch(() => setError('No pudimos usar la cámara. Revisá que la app tenga permiso, o escribí el código.'));

    return () => {
      activo = false;
      clearTimeout(espera);
      flujo?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4" role="dialog" aria-modal="true" aria-label="Escanear código de barras">
      <p className="text-center text-lg font-semibold text-white">Apuntá al código de barras</p>
      <div className="relative mx-auto mt-4 w-full max-w-md flex-1 overflow-hidden rounded-2xl bg-black">
        <video ref={video} muted playsInline className="size-full object-cover" />
        <div aria-hidden="true" className="absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-xl border-4 border-green-400/80" />
      </div>
      {error && (
        <p className="mx-auto mt-3 max-w-md rounded-xl bg-red-50 p-3 text-red-900" role="alert">
          {error}
        </p>
      )}
      <Boton type="button" variante="secundario" onClick={onCerrar} className="mx-auto mt-4 max-w-md">
        Cerrar
      </Boton>
    </div>
  );
}
