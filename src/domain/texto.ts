/** Minúsculas, sin acentos, sin signos y con un solo espacio entre palabras: "Código Art." → "codigo art". */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%/+]+/g, ' ')
    .trim();
}
