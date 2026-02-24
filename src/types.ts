export interface MenuItem {
  category: string;
  name: string;
  description: string;
  price: string;
  options: string[];
  image: string;
  isActive: boolean;
}

export interface AppConfig {
  phone: string;
  businessName: string;
}

export interface CartItem {
  id: string;
  name: string;
  price: string;
  options?: string[];
  addOns?: { name: string, price: string, quantity: number }[];
  quantity: number;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
}
