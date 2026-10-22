import { describe, expect, it } from 'vitest';
import { textoDiferencia, tonoDiferencia } from './caja';
import { buscarClientes, mensajeSaldo, mismoNombre, numeroWhatsapp, superaLimite, textoSaldo } from './clientes';
import { problemaTicket } from './ventas';

describe('fiado', () => {
  it('textos del saldo', () => {
    expect(textoSaldo(150_000)).toBe('Debe $ 1.500,00');
    expect(textoSaldo(0)).toBe('Al día');
    expect(textoSaldo(-20_000)).toBe('A favor $ 200,00');
  });

  it('límite: sin límite nunca se pasa', () => {
    expect(superaLimite(null, 1_000_000)).toBe(false);
    expect(superaLimite(10_000, 10_000)).toBe(false);
    expect(superaLimite(10_000, 10_001)).toBe(true);
    expect(superaLimite(-500, 1)).toBe(true);
  });

  it('busca sin importar mayúsculas ni acentos, y compara nombres como la base', () => {
    const clientes = [{ nombre: 'Doña Rosa' }, { nombre: 'José Pérez' }, { nombre: 'Rosario' }];
    expect(buscarClientes(clientes, 'rosa').map((c) => c.nombre)).toEqual(['Doña Rosa', 'Rosario']);
    expect(buscarClientes(clientes, 'jose PEREZ').map((c) => c.nombre)).toEqual(['José Pérez']);
    expect(buscarClientes(clientes, '  ')).toHaveLength(3);
    expect(mismoNombre(' doña   rosa', 'Doña Rosa')).toBe(true);
    expect(mismoNombre('Dona Rosa', 'Doña Rosa')).toBe(false);
  });

  it('número de WhatsApp a partir de cómo se anotó', () => {
    expect(numeroWhatsapp('11 5555-1234')).toBe('5491155551234');
    expect(numeroWhatsapp('011 5555 1234')).toBe('5491155551234');
    expect(numeroWhatsapp('+54 9 11 5555 1234')).toBe('5491155551234');
    expect(numeroWhatsapp('+54 11 5555 1234')).toBe('5491155551234');
    expect(numeroWhatsapp('351 444 5566')).toBe('5493514445566');
    expect(numeroWhatsapp('4444-5555')).toBeNull();
    expect(numeroWhatsapp(null)).toBeNull();
    expect(mensajeSaldo('Kiosco Pepe', 'Rosa Gómez', 150_000)).toBe('Hola Rosa, te escribimos de Kiosco Pepe. Tu saldo de fiado es de $ 1.500,00. ¡Gracias!');
  });

  it('un ticket fiado necesita cliente', () => {
    const lineas = [{ productoId: null, descripcion: 'Varios', cantidad: 1, precioUnitario: 1_000 }];
    expect(problemaTicket(lineas, 'fiado')).toBe('Elegí a quién se le fía.');
    expect(problemaTicket(lineas, 'fiado', { id: 'x' })).toBeNull();
    expect(problemaTicket(lineas, 'efectivo')).toBeNull();
  });
});

describe('caja', () => {
  it('textos de la diferencia', () => {
    expect(textoDiferencia(0)).toBe('Cerró justo');
    expect(textoDiferencia(50_000)).toBe('Sobran $ 500,00');
    expect(textoDiferencia(-120_000)).toBe('Faltan $ 1.200,00');
    expect([tonoDiferencia(0), tonoDiferencia(1), tonoDiferencia(-1)]).toEqual(['justo', 'sobra', 'falta']);
  });
});
