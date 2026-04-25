export type TemplateVariables = {
  nombre: string;
  telefono: string;
  [key: string]: string;
};

export function interpolate(template: string, variables: TemplateVariables): string {
  let result = template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key];
    if (value !== undefined && value !== '') {
      return value;
    }
    return '';
  });
  
  // Limpiar espacios dobles y espacios antes de signos
  result = result.replace(/\s+/g, ' ').trim();
  result = result.replace(/\s+([,.!?])/g, '$1');
  
  return result;
}

export function extractVariables(template: string): string[] {
  const matches = template.matchAll(/\{\{(\w+)\}\}/g);
  return [...new Set([...matches].map(m => m[1]))];
}

export function validateTemplate(
  template: string,
  variables: TemplateVariables
): { valid: boolean; missing: string[] } {
  const required = extractVariables(template);
  const missing = required.filter(v => !(v in variables));
  return {
    valid: missing.length === 0,
    missing,
  };
}
