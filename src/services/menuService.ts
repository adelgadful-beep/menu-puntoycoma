import { MenuItem, AppConfig } from '../types';

const SPREADSHEET_ID = '10h0Fnn9ICr4cs4aisl1MT8rzkzFGZi6gEPkoSDEZf6A';
const MENU_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;
const CONFIG_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Config`;

export async function fetchMenuData(): Promise<{ items: MenuItem[], config: AppConfig }> {
  try {
    const [menuRes, configRes] = await Promise.all([
      fetch(MENU_URL),
      fetch(CONFIG_URL)
    ]);

    if (!menuRes.ok || !configRes.ok) {
      throw new Error('Failed to fetch data');
    }

    const menuCsv = await menuRes.text();
    const configCsv = await configRes.text();

    return {
      items: parseMenuCSV(menuCsv),
      config: parseConfigCSV(configCsv)
    };
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}

function parseMenuCSV(csv: string): MenuItem[] {
  const lines = csv.split('\n');
  return lines.slice(1)
    .filter(line => line.trim() !== '')
    .map(line => {
      const parts = parseCSVLine(line);
      return {
        category: parts[0]?.trim() || '',
        name: parts[1]?.trim() || '',
        description: parts[2]?.trim() || '',
        price: parts[3]?.trim() || '',
        options: parts[4] ? parts[4].split(',').map(o => o.trim()).filter(o => o !== '') : [],
        image: parts[5]?.trim() || '',
        isActive: parts[6]?.trim().toLowerCase() === 'sí' || parts[6]?.trim().toLowerCase() === 'si'
      };
    })
    .filter(item => item.isActive);
}

function parseConfigCSV(csv: string): AppConfig {
  const lines = csv.split('\n');
  const config: AppConfig = {
    phone: '50689112755',
    businessName: 'Soda Punto y Coma'
  };

  lines.forEach(line => {
    const parts = parseCSVLine(line);
    const key = parts[0]?.trim().toLowerCase();
    const value = parts[1]?.trim();

    if (key === 'teléfono negocio' && value) {
      config.phone = value.replace(/\D/g, '');
      if (!config.phone.startsWith('506')) {
        config.phone = `506${config.phone}`;
      }
    }
    if (key === 'negocio' && value) {
      config.businessName = value;
    }
  });

  return config;
}

function parseCSVLine(line: string): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(s => s.replace(/^"|"$/g, '').trim());
}
