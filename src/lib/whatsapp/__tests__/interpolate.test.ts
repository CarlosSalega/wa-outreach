import { describe, it, expect } from 'vitest';
import { interpolate, extractVariables, validateTemplate } from '../interpolate';

describe('interpolate', () => {
  it('reemplaza {{nombre}} y {{telefono}} con los valores dados', () => {
    const result = interpolate(
      'Hola {{nombre}}, te contactamos al {{telefono}}',
      { nombre: 'Juan', telefono: '5491122334455' },
    );
    expect(result).toBe('Hola Juan, te contactamos al 5491122334455');
  });

  it('reemplaza la misma variable múltiples veces', () => {
    const result = interpolate(
      '{{nombre}}, {{nombre}}, {{nombre}}',
      { nombre: 'Pedro' },
    );
    expect(result).toBe('Pedro, Pedro, Pedro');
  });

  it('deja espacio limpio cuando la variable no existe', () => {
    const result = interpolate(
      'Hola {{nombre}}, tu {{descuento}}',
      { nombre: 'Ana' },
    );
    // El trim elimina trailing spaces, el espacio entre "tu" y el
    // siguiente signo se limpia con la regla de puntuación
    expect(result).toBe('Hola Ana, tu');
  });

  it('limpia espacios dobles que quedan por variables vacías', () => {
    const result = interpolate(
      'Hola  {{nombre}}   bienvenido',
      { nombre: 'Luis' },
    );
    expect(result).toBe('Hola Luis bienvenido');
  });

  it('limpia espacios antes de signos de puntuación', () => {
    const result = interpolate(
      'Hola {{nombre}} , que tal ?',
      { nombre: 'María' },
    );
    expect(result).toBe('Hola María, que tal?');
  });

  it('devuelve string vacío si el template es solo variables no definidas', () => {
    const result = interpolate('{{a}}{{b}}', {});
    expect(result).toBe('');
  });

  it('tolera variables con valor vacío sin romperse', () => {
    const result = interpolate('{{x}}', { x: '' });
    expect(result).toBe('');
  });
});

describe('extractVariables', () => {
  it('extrae variables únicas de un template', () => {
    expect(extractVariables('{{nombre}} {{telefono}} {{nombre}}')).toEqual([
      'nombre',
      'telefono',
    ]);
  });

  it('devuelve array vacío si no hay variables', () => {
    expect(extractVariables('Hola mundo')).toEqual([]);
  });
});

describe('validateTemplate', () => {
  it('retorna valid true cuando todas las variables están definidas', () => {
    const result = validateTemplate('{{nombre}} {{telefono}}', {
      nombre: 'Juan',
      telefono: '123',
    });
    expect(result).toEqual({ valid: true, missing: [] });
  });

  it('retorna las variables faltantes con valid false', () => {
    const result = validateTemplate('{{nombre}} {{apellido}} {{telefono}}', {
      nombre: 'Juan',
    });
    expect(result).toEqual({
      valid: false,
      missing: ['apellido', 'telefono'],
    });
  });
});
