/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Utensils, 
  Coffee, 
  Beer, 
  Search, 
  Clock, 
  ChevronRight, 
  Info,
  AlertCircle,
  RefreshCw,
  Menu as MenuIcon,
  X,
  ChefHat,
  Sun,
  Moon,
  Wind,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Send,
  Check
} from 'lucide-react';
import { MenuItem, AppConfig, CartItem } from './types';
import { fetchMenuData } from './services/menuService';

export default function App() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [itemToConfigure, setItemToConfigure] = useState<MenuItem | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<{ name: string, price: string, quantity: number }[]>([]);
  const [configQuantity, setConfigQuantity] = useState(1);
  const [orderType, setOrderType] = useState<'local' | 'llevar'>('local');
  const [orderComments, setOrderComments] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);

  const availableAddOns = useMemo(() => {
    return menuItems.filter(item => 
      ['adicionales', 'porciones solas'].includes(item.category.toLowerCase().trim())
    );
  }, [menuItems]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { items, config } = await fetchMenuData();
      setMenuItems(items);
      setConfig(config);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError('No se pudo cargar el menú. Por favor, intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const addToCart = (item: MenuItem, options?: string[], addOns?: { name: string, price: string, quantity: number }[], qty: number = 1) => {
    const optionsKey = options ? options.sort().join('-') : '';
    const addOnsKey = addOns ? addOns.map(a => `${a.name}x${a.quantity}`).sort().join('-') : '';
    const cartId = `${item.name}-${optionsKey}-${addOnsKey}`;
    
    setCart(prev => {
      const existing = prev.find(i => i.id === cartId);
      if (existing) {
        return prev.map(i => i.id === cartId ? { ...i, quantity: i.quantity + qty } : i);
      }
      return [...prev, {
        id: cartId,
        name: item.name,
        price: item.price,
        options,
        addOns,
        quantity: qty
      }];
    });
    
    setItemToConfigure(null);
    setSelectedOptions([]);
    setSelectedAddOns([]);
    setConfigQuantity(1);
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      // Base price
      const priceParts = item.price.split(',');
      const cleanPrice = priceParts[0].replace(/\D/g, '');
      let itemPrice = parseInt(cleanPrice) || 0;

      // Add-ons price
      if (item.addOns) {
        item.addOns.forEach(addOn => {
          const addOnParts = addOn.price.split(',');
          const cleanAddOnPrice = addOnParts[0].replace(/\D/g, '');
          itemPrice += (parseInt(cleanAddOnPrice) || 0) * addOn.quantity;
        });
      }

      return acc + (itemPrice * item.quantity);
    }, 0);
  }, [cart]);

  const sendOrder = async () => {
    if (!config || cart.length === 0) return;

    let message = `*Nuevo Pedido - ${config.businessName}*\n\n`;
    message += `*Cliente:* ${customerName || 'No especificado'}\n`;
    message += `*Teléfono:* ${customerPhone || 'No especificado'}\n\n`;
    
    cart.forEach(item => {
      let itemLine = `• ${item.quantity}x ${item.name}`;
      if (item.options && item.options.length > 0) {
        itemLine += ` (${item.options.join(', ')})`;
      }
      itemLine += ` - ${item.price}\n`;
      
      if (item.addOns && item.addOns.length > 0) {
        item.addOns.forEach(addOn => {
          itemLine += `  + ${addOn.quantity}x ${addOn.name} (${addOn.price})\n`;
        });
      }
      message += itemLine;
    });
    message += `\n*Tipo de pedido:* ${orderType === 'local' ? 'Para comer aquí' : 'Para llevar'}\n`;
    if (orderComments.trim()) {
      message += `*Comentarios:* ${orderComments}\n`;
    }
    message += `\n*Total: ₡${cartTotal.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*\n\n_Pedido realizado desde el menú digital_`;

    const encodedMessage = encodeURIComponent(message);
    
    // Attempt to send to sheet if webhook is configured
    const webhookUrl = (import.meta as any).env.VITE_ORDER_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          mode: 'no-cors', // Common for Google Apps Script
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            "Identificación": `ORD-${Date.now()}`,
            "fecha": new Date().toLocaleString('es-CR'),
            "teléfono": customerPhone,
            "nombre del cliente": customerName,
            "detalles": `${cart.map(i => `${i.quantity}x ${i.name}${i.options?.length ? ` (${i.options.join(', ')})` : ''}`).join(', ')}${orderComments ? ` | Notas: ${orderComments}` : ''} | Tipo: ${orderType === 'local' ? 'Local' : 'Llevar'}`,
            "total": cartTotal,
            "estado": "Pendiente"
          })
        });
      } catch (e) {
        console.error('Error sending to sheet:', e);
      }
    }

    window.open(`https://wa.me/${config.phone}?text=${encodedMessage}`, '_blank');
  };

  const categories = useMemo(() => {
    const cats = Array.from(new Set(menuItems.map(item => item.category)));
    return ['Todos', ...cats];
  }, [menuItems]);

  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesCategory = selectedCategory === 'Todos' || item.category === selectedCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'desayunos': return <Sun className="w-5 h-5" />;
      case 'almuerzos': return <ChefHat className="w-5 h-5" />;
      case 'café': return <Coffee className="w-5 h-5" />;
      case 'bebidas y batidos': return <Beer className="w-5 h-5" />;
      case 'plato del día': return <Clock className="w-5 h-5" />;
      case 'menú infantil': return <Wind className="w-5 h-5" />;
      default: return <Utensils className="w-5 h-5" />;
    }
  };

  if (loading && menuItems.length === 0) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-500 ${isDarkMode ? 'bg-dark-bg' : 'bg-soda-cream'}`}>
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="mb-4"
        >
          <RefreshCw className={`w-12 h-12 ${isDarkMode ? 'text-dark-text' : 'text-soda-brown'}`} />
        </motion.div>
        <h2 className={`text-2xl font-serif animate-pulse ${isDarkMode ? 'text-dark-text' : 'text-soda-brown'}`}>Cargando delicias...</h2>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans selection:bg-soda-copper/20 transition-colors duration-500 ${isDarkMode ? 'dark bg-dark-bg text-dark-text' : 'bg-soda-cream text-soda-dark'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-40 backdrop-blur-md border-b px-4 py-3 md:px-8 shadow-sm transition-colors duration-500 ${isDarkMode ? 'bg-dark-bg/90 border-white/10' : 'bg-soda-cream/90 border-soda-copper/30'}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className={`p-2 rounded-full md:hidden transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-soda-copper/10'}`}
            >
              <MenuIcon className={`w-6 h-6 ${isDarkMode ? 'text-dark-text' : 'text-soda-brown'}`} />
            </button>
            <div className="flex items-center gap-3">
              {/* Logo Placeholder - Circular like the logo */}
              <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full border-2 flex items-center justify-center overflow-hidden shadow-inner shrink-0 transition-colors ${isDarkMode ? 'bg-dark-surface border-white/20' : 'bg-soda-cream border-soda-copper'}`}>
                <Utensils className={`w-6 h-6 md:w-8 md:h-8 ${isDarkMode ? 'text-dark-text' : 'text-soda-brown'}`} />
              </div>
              <div>
                <h1 className={`text-xl md:text-3xl font-serif font-bold leading-tight ${isDarkMode ? 'text-dark-text' : 'text-soda-brown'}`}>
                  Punto y Coma
                </h1>
                <p className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-soda-copper font-bold">
                  Soda & Restaurante
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-6">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-full transition-all duration-300 ${isDarkMode ? 'bg-white/10 text-yellow-400 hover:bg-white/20' : 'bg-soda-brown/10 text-soda-brown hover:bg-soda-brown/20'}`}
              title={isDarkMode ? 'Modo Día' : 'Modo Noche'}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <div className="hidden md:flex items-center gap-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-soda-brown/40" />
                <input 
                  type="text"
                  placeholder="Buscar platillo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`pl-10 pr-4 py-2 border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-soda-copper/20 w-64 transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-dark-text' : 'bg-white/50 border-soda-copper/30 text-soda-dark'}`}
                />
              </div>
              <div className={`flex flex-col items-end text-[10px] ${isDarkMode ? 'text-dark-text/60' : 'text-soda-brown/60'}`}>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Actualizado: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>

            <button 
              onClick={loadData}
              className={`p-2 rounded-full transition-colors md:hidden ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-soda-copper/10'}`}
            >
              <RefreshCw className={`w-5 h-5 ${isDarkMode ? 'text-dark-text' : 'text-soda-brown'} ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 md:px-8 flex flex-col md:flex-row gap-8">
        {/* Desktop Sidebar */}
        <aside className="hidden md:block w-64 shrink-0">
          <div className="sticky top-32">
            <h3 className={`text-[10px] uppercase tracking-[0.2em] font-black mb-6 border-b pb-2 transition-colors ${isDarkMode ? 'text-soda-copper border-white/10' : 'text-soda-copper border-soda-copper/20'}`}>Categorías</h3>
            <nav className="space-y-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl transition-all duration-300 group ${
                    selectedCategory === cat 
                      ? 'bg-soda-brown text-soda-cream shadow-xl shadow-soda-brown/20 scale-[1.02]' 
                      : isDarkMode 
                        ? 'hover:bg-white/10 text-dark-text' 
                        : 'hover:bg-soda-copper/10 text-soda-brown'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`${selectedCategory === cat ? 'text-soda-cream' : 'text-soda-copper'}`}>
                      {getCategoryIcon(cat)}
                    </span>
                    <span className="font-bold tracking-tight">{cat}</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform ${selectedCategory === cat ? 'translate-x-1 opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                </button>
              ))}
            </nav>

            <div className={`mt-12 p-6 rounded-[32px] border shadow-sm backdrop-blur-sm transition-colors ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/40 border-soda-copper/20'}`}>
              <div className={`flex items-center gap-2 mb-3 ${isDarkMode ? 'text-dark-text' : 'text-soda-brown'}`}>
                <Info className="w-5 h-5 text-soda-copper" />
                <h4 className="font-serif font-bold text-lg">Nuestra Promesa</h4>
              </div>
              <p className={`text-sm leading-relaxed italic transition-colors ${isDarkMode ? 'text-dark-text/60' : 'text-soda-brown/80'}`}>
                Cocinamos con amor y productos locales para brindarte el mejor sabor de casa.
              </p>
            </div>
          </div>
        </aside>

        {/* Mobile Search Bar */}
        <div className="md:hidden">
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-soda-copper" />
            <input 
              type="text"
              placeholder="Buscar platillo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-12 pr-4 py-4 border rounded-3xl text-base focus:outline-none focus:ring-2 focus:ring-soda-copper/20 shadow-sm backdrop-blur-sm transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-dark-text' : 'bg-white/80 border-soda-copper/30 text-soda-dark'}`}
            />
          </div>
          
          <div className="flex overflow-x-auto pb-4 gap-3 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 flex items-center gap-2 px-6 py-3.5 rounded-full whitespace-nowrap transition-all font-bold text-sm ${
                  selectedCategory === cat 
                    ? 'bg-soda-brown text-soda-cream shadow-lg' 
                    : isDarkMode 
                      ? 'bg-white/5 text-dark-text border border-white/10' 
                      : 'bg-white/80 text-soda-brown border border-soda-copper/20'
                }`}
              >
                {getCategoryIcon(cat)}
                <span>{cat}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Menu Grid */}
        <div className="flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-3xl p-6 flex items-start gap-4 mb-8">
              <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-red-900">Error de conexión</h3>
                <p className="text-red-700 text-sm">{error}</p>
                <button 
                  onClick={loadData}
                  className="mt-3 text-sm font-bold text-red-800 underline underline-offset-4"
                >
                  Reintentar ahora
                </button>
              </div>
            </div>
          )}

          <div className="flex items-baseline justify-between mb-10">
            <h2 className={`text-3xl md:text-5xl font-serif font-bold transition-colors ${isDarkMode ? 'text-dark-text' : 'text-soda-brown'}`}>
              {selectedCategory === 'Todos' ? 'Menú Principal' : selectedCategory}
            </h2>
            <div className={`h-px flex-1 mx-6 hidden sm:block transition-colors ${isDarkMode ? 'bg-white/10' : 'bg-soda-copper/20'}`} />
            <span className="text-xs text-soda-copper font-black uppercase tracking-widest">
              {filteredItems.length} {filteredItems.length === 1 ? 'Opción' : 'Opciones'}
            </span>
          </div>

          {filteredItems.length === 0 ? (
            <div className="text-center py-24 bg-white/30 rounded-[48px] border-2 border-dashed border-soda-copper/20">
              <Utensils className="w-16 h-16 text-soda-copper/30 mx-auto mb-6" />
              <p className="text-soda-brown/60 font-serif text-xl italic">No encontramos lo que buscas...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-8">
              <AnimatePresence mode="popLayout">
                {filteredItems.map((item, index) => (
                  <motion.div
                    key={item.name}
                    layout
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.4, delay: index * 0.03 }}
                    className={`group rounded-[40px] p-8 border transition-all flex flex-col h-full relative overflow-hidden ${isDarkMode ? 'bg-dark-surface border-white/10 hover:border-white/20 hover:bg-white/5' : 'bg-white/70 border-soda-copper/10 hover:border-soda-copper/40 hover:bg-white hover:shadow-2xl hover:shadow-soda-brown/5'}`}
                  >
                    {/* Decorative Semicolon like in logo */}
                    <div className="absolute -right-4 -bottom-4 text-soda-copper/5 font-serif text-8xl pointer-events-none group-hover:text-soda-copper/10 transition-colors">
                      ;
                    </div>

                    <div className="flex justify-between items-start mb-6">
                      <span className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full border transition-colors ${isDarkMode ? 'bg-white/5 text-soda-copper border-white/10' : 'bg-soda-cream text-soda-brown border-soda-copper/20'}`}>
                        {item.category}
                      </span>
                      <div className="flex flex-col items-end">
                        <span className={`text-2xl font-serif font-bold transition-colors ${isDarkMode ? 'text-dark-text' : 'text-soda-brown'}`}>
                          {item.price}
                        </span>
                      </div>
                    </div>

                    <h3 className={`text-2xl font-serif font-bold mb-3 leading-tight transition-colors ${isDarkMode ? 'text-dark-text' : 'text-soda-dark group-hover:text-soda-brown'}`}>
                      {item.name}
                    </h3>

                    {item.description && (
                      <p className={`text-sm leading-relaxed mb-6 flex-grow font-medium transition-colors ${isDarkMode ? 'text-dark-text/60' : 'text-soda-brown/70'}`}>
                        {item.description}
                      </p>
                    )}

                    <div className="mt-auto space-y-4">
                      {item.options.length > 0 && (
                        <div className={`pt-4 border-t transition-colors ${isDarkMode ? 'border-white/10' : 'border-soda-copper/10'}`}>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-soda-copper font-black mb-3">Opciones</p>
                          <div className="flex flex-wrap gap-2">
                            {item.options.map(opt => (
                              <span key={opt} className={`text-[11px] px-3 py-1.5 rounded-xl font-bold border transition-colors ${isDarkMode ? 'bg-white/5 text-dark-text border-white/5' : 'bg-soda-cream/50 text-soda-brown border-soda-copper/5'}`}>
                                {opt}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setItemToConfigure(item);
                          setSelectedOptions([]);
                          setSelectedAddOns([]);
                          setConfigQuantity(1);
                        }}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-soda-brown text-soda-cream rounded-2xl font-bold hover:bg-soda-dark transition-all shadow-lg shadow-soda-brown/20 active:scale-95"
                      >
                        <Plus className="w-5 h-5" />
                        <span>Agregar al pedido</span>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <motion.button
          initial={{ scale: 0, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-8 right-8 z-50 flex items-center gap-3 px-8 py-5 bg-soda-brown text-soda-cream rounded-full shadow-2xl shadow-soda-brown/40 hover:bg-soda-dark transition-all active:scale-95"
        >
          <div className="relative">
            <ShoppingCart className="w-6 h-6" />
            <span className="absolute -top-3 -right-3 w-6 h-6 bg-soda-copper text-soda-cream text-[10px] font-black rounded-full flex items-center justify-center border-2 border-soda-brown">
              {cart.reduce((a, b) => a + b.quantity, 0)}
            </span>
          </div>
          <span className="font-bold text-lg">₡{cartTotal.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </motion.button>
      )}

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-soda-dark/40 backdrop-blur-md z-[60]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 200 }}
              className={`fixed inset-y-0 right-0 w-full md:w-[450px] z-[70] flex flex-col shadow-2xl transition-colors duration-500 ${isDarkMode ? 'bg-dark-surface' : 'bg-soda-cream'}`}
            >
              <div className={`p-8 border-b flex items-center justify-between transition-colors ${isDarkMode ? 'border-white/10' : 'border-soda-copper/20'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-soda-brown flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5 text-soda-cream" />
                  </div>
                  <h2 className={`text-2xl font-serif font-bold transition-colors ${isDarkMode ? 'text-dark-text' : 'text-soda-brown'}`}>Tu Pedido</h2>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-dark-text' : 'hover:bg-soda-copper/10 text-soda-brown'}`}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

               <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {cart.length === 0 ? (
                  <div className="text-center py-20">
                    <Utensils className="w-16 h-16 text-soda-copper/20 mx-auto mb-6" />
                    <p className={`font-serif text-xl italic transition-colors ${isDarkMode ? 'text-dark-text/40' : 'text-soda-brown/60'}`}>Tu pedido está vacío...</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-6">
                      {cart.map((item) => (
                        <div key={item.id} className={`flex gap-4 p-6 rounded-[32px] border transition-colors ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/60 border-soda-copper/10'}`}>
                          <div className="flex-1">
                            <h4 className={`font-serif font-bold text-lg transition-colors ${isDarkMode ? 'text-dark-text' : 'text-soda-dark'}`}>{item.name}</h4>
                            {item.options && item.options.length > 0 && (
                              <p className="text-xs text-soda-copper font-bold uppercase tracking-widest mt-1">
                                {item.options.join(', ')}
                              </p>
                            )}
                            {item.addOns && item.addOns.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {item.addOns.map(addOn => (
                                  <p key={addOn.name} className={`text-[10px] font-medium transition-colors ${isDarkMode ? 'text-dark-text/40' : 'text-soda-brown/60'}`}>
                                    + {addOn.quantity}x {addOn.name} ({addOn.price})
                                  </p>
                                ))}
                              </div>
                            )}
                            <p className={`font-bold mt-2 transition-colors ${isDarkMode ? 'text-dark-text' : 'text-soda-brown'}`}>{item.price}</p>
                          </div>
                          <div className="flex flex-col items-center justify-between">
                            <button 
                              onClick={() => removeFromCart(item.id)}
                              className="p-2 text-soda-copper/40 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <div className={`flex items-center gap-3 rounded-full px-3 py-1.5 border transition-colors ${isDarkMode ? 'bg-dark-bg border-white/10' : 'bg-soda-cream border-soda-copper/20'}`}>
                              <button onClick={() => updateQuantity(item.id, -1)} className={`p-1 transition-colors ${isDarkMode ? 'text-dark-text/60 hover:text-soda-copper' : 'hover:text-soda-copper'}`}>
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className={`font-black text-xs w-4 text-center transition-colors ${isDarkMode ? 'text-dark-text' : ''}`}>{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.id, 1)} className={`p-1 transition-colors ${isDarkMode ? 'text-dark-text/60 hover:text-soda-copper' : 'hover:text-soda-copper'}`}>
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                      <div>
                        <p className="text-soda-copper font-black uppercase tracking-widest text-[10px] mb-4">Tus Datos</p>
                        <div className="space-y-4">
                          <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Tu nombre completo"
                            className={`w-full border-2 rounded-2xl px-5 py-4 transition-all text-sm font-medium focus:outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-dark-text placeholder:text-dark-text/20 focus:border-white/20' : 'bg-white/50 border-soda-copper/10 text-soda-brown placeholder:text-soda-brown/30 focus:border-soda-copper/30'}`}
                          />
                          <input
                            type="tel"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            placeholder="Tu número de teléfono"
                            className={`w-full border-2 rounded-2xl px-5 py-4 transition-all text-sm font-medium focus:outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-dark-text placeholder:text-dark-text/20 focus:border-white/20' : 'bg-white/50 border-soda-copper/10 text-soda-brown placeholder:text-soda-brown/30 focus:border-soda-copper/30'}`}
                          />
                        </div>
                      </div>

                      <div>
                        <p className="text-soda-copper font-black uppercase tracking-widest text-[10px] mb-4">¿Cómo deseas tu pedido?</p>
                        <div className="grid grid-cols-2 gap-4">
                          <button
                            onClick={() => setOrderType('local')}
                            className={`flex items-center justify-center gap-2 py-4 rounded-2xl border-2 transition-all font-bold text-sm ${
                              orderType === 'local'
                                ? 'bg-soda-brown text-soda-cream border-soda-brown shadow-md'
                                : isDarkMode
                                  ? 'bg-white/5 text-dark-text border-white/10 hover:border-white/20'
                                  : 'bg-white/50 text-soda-brown border-soda-copper/10 hover:border-soda-copper/30'
                            }`}
                          >
                            <Utensils className="w-4 h-4" />
                            <span>Para aquí</span>
                          </button>
                          <button
                            onClick={() => setOrderType('llevar')}
                            className={`flex items-center justify-center gap-2 py-4 rounded-2xl border-2 transition-all font-bold text-sm ${
                              orderType === 'llevar'
                                ? 'bg-soda-brown text-soda-cream border-soda-brown shadow-md'
                                : isDarkMode
                                  ? 'bg-white/5 text-dark-text border-white/10 hover:border-white/20'
                                  : 'bg-white/50 text-soda-brown border-soda-copper/10 hover:border-soda-copper/30'
                            }`}
                          >
                            <Wind className="w-4 h-4" />
                            <span>Para llevar</span>
                          </button>
                        </div>
                      </div>

                      <div>
                        <p className="text-soda-copper font-black uppercase tracking-widest text-[10px] mb-4">Notas adicionales</p>
                        <textarea
                          value={orderComments}
                          onChange={(e) => setOrderComments(e.target.value)}
                          placeholder="Ej: Sin cebolla, alérgico al maní..."
                          className={`w-full border-2 rounded-3xl p-5 transition-all min-h-[120px] text-sm font-medium focus:outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-dark-text placeholder:text-dark-text/20 focus:border-white/20' : 'bg-white/50 border-soda-copper/10 text-soda-brown placeholder:text-soda-brown/30 focus:border-soda-copper/30'}`}
                        />
                      </div>
                    </>
                  )}
                </div>

              <div className={`p-8 border-t space-y-6 transition-colors duration-500 ${isDarkMode ? 'bg-dark-bg/80 backdrop-blur-xl border-white/10' : 'bg-white/80 backdrop-blur-xl border-soda-copper/20'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-soda-copper font-black uppercase tracking-[0.2em] text-xs">Total a pagar</span>
                  <span className={`text-3xl font-serif font-bold transition-colors ${isDarkMode ? 'text-dark-text' : 'text-soda-brown'}`}>₡{cartTotal.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <button 
                  disabled={cart.length === 0 || !customerName.trim() || !customerPhone.trim()}
                  onClick={sendOrder}
                  className="w-full flex items-center justify-center gap-3 py-5 bg-soda-brown text-soda-cream rounded-[24px] font-bold text-lg hover:bg-soda-dark transition-all shadow-xl shadow-soda-brown/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  <Send className="w-5 h-5" />
                  <span>Enviar por WhatsApp</span>
                </button>
                {(!customerName.trim() || !customerPhone.trim()) && cart.length > 0 && (
                  <p className="text-[10px] text-soda-copper font-bold text-center animate-pulse">
                    * Por favor ingresa tu nombre y teléfono para continuar
                  </p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Option Selection Modal */}
      <AnimatePresence>
        {itemToConfigure && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setItemToConfigure(null)}
              className="fixed inset-0 bg-soda-dark/60 backdrop-blur-md z-[100]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-2xl rounded-[48px] z-[110] shadow-2xl border max-h-[90vh] flex flex-col overflow-hidden transition-colors duration-500 ${isDarkMode ? 'bg-dark-surface border-white/10' : 'bg-soda-cream border-soda-copper/20'}`}
            >
              <div className={`p-8 border-b flex items-center justify-between transition-colors ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/40 border-soda-copper/10'}`}>
                <div>
                  <h3 className={`text-2xl md:text-3xl font-serif font-bold transition-colors ${isDarkMode ? 'text-dark-text' : 'text-soda-brown'}`}>{itemToConfigure.name}</h3>
                  <p className="text-soda-copper font-black uppercase tracking-widest text-[10px] mt-1">Personaliza tu pedido</p>
                </div>
                <div className="flex items-center gap-2">
                  {cart.length > 0 && (
                    <button 
                      onClick={() => {
                        setItemToConfigure(null);
                        setIsCartOpen(true);
                      }}
                      className={`p-3 rounded-full transition-colors relative ${isDarkMode ? 'bg-white/10 text-dark-text hover:bg-white/20' : 'bg-soda-copper/10 text-soda-brown hover:bg-soda-copper/20'}`}
                    >
                      <ShoppingCart className="w-5 h-5" />
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-soda-brown text-soda-cream text-[8px] font-black rounded-full flex items-center justify-center">
                        {cart.reduce((a, b) => a + b.quantity, 0)}
                      </span>
                    </button>
                  )}
                  <button 
                    onClick={() => setItemToConfigure(null)}
                    className={`p-3 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-dark-text' : 'hover:bg-soda-copper/10 text-soda-brown'}`}
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-10">
                {itemToConfigure.options.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <MenuIcon className="w-4 h-4 text-soda-copper" />
                        <p className="text-soda-copper font-black uppercase tracking-widest text-[10px]">
                          {itemToConfigure.name.toLowerCase().includes('pinto con 2') 
                            ? `Acompañamientos (${selectedOptions.length}/2)` 
                            : 'Selecciona una opción'}
                        </p>
                      </div>
                      {selectedOptions.length > 0 && (
                        <button 
                          onClick={() => setSelectedOptions([])}
                          className="text-[10px] text-soda-copper font-bold underline"
                        >
                          Limpiar selección
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {itemToConfigure.options.map((opt, idx) => {
                        const count = selectedOptions.filter(o => o === opt).length;
                        const isMax = itemToConfigure.name.toLowerCase().includes('pinto con 2') 
                          ? selectedOptions.length >= 2 
                          : selectedOptions.length >= 1;

                        return (
                          <div key={`${opt}-${idx}`} className="relative group">
                            <button
                              onClick={() => {
                                const isSelected = selectedOptions.includes(opt);
                                if (isSelected) {
                                  // Remove one instance of this option
                                  const index = selectedOptions.lastIndexOf(opt);
                                  if (index > -1) {
                                    const newOpts = [...selectedOptions];
                                    newOpts.splice(index, 1);
                                    setSelectedOptions(newOpts);
                                  }
                                } else {
                                  if (itemToConfigure.name.toLowerCase().includes('pinto con 2')) {
                                    if (selectedOptions.length < 2) {
                                      setSelectedOptions([...selectedOptions, opt]);
                                    }
                                  } else {
                                    setSelectedOptions([opt]);
                                  }
                                }
                              }}
                              disabled={!selectedOptions.includes(opt) && isMax}
                              className={`w-full flex items-center justify-between p-5 rounded-3xl transition-all border-2 text-sm ${
                                selectedOptions.includes(opt)
                                  ? 'bg-soda-brown text-soda-cream border-soda-brown shadow-lg' 
                                  : isDarkMode
                                    ? 'bg-white/5 text-dark-text border-white/10 hover:border-white/20 disabled:opacity-50'
                                    : 'bg-white/50 text-soda-brown border-soda-copper/10 hover:border-soda-copper/30 disabled:opacity-50'
                              }`}
                            >
                              <span className="font-bold">{opt}</span>
                              {count > 0 && (
                                <div className="flex items-center gap-2">
                                  {itemToConfigure.name.toLowerCase().includes('pinto con 2') && (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const index = selectedOptions.lastIndexOf(opt);
                                        if (index > -1) {
                                          const newOpts = [...selectedOptions];
                                          newOpts.splice(index, 1);
                                          setSelectedOptions(newOpts);
                                        }
                                      }}
                                      className="p-1 hover:bg-white/20 rounded-full transition-colors"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                  )}
                                  <span className="bg-soda-copper text-soda-cream text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border border-soda-brown">
                                    {count}
                                  </span>
                                </div>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {['desayunos', 'almuerzos'].includes(itemToConfigure.category.toLowerCase()) && availableAddOns.length > 0 && (
                  <div className={`p-8 rounded-[40px] border transition-colors ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/40 border-soda-copper/10'}`}>
                    <div className="flex items-center gap-2 mb-6">
                      <Plus className="w-4 h-4 text-soda-copper" />
                      <p className="text-soda-copper font-black uppercase tracking-widest text-[10px]">Adicionales Disponibles</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      {availableAddOns.map((addOn) => {
                        const currentAddOn = selectedAddOns.find(a => a.name.startsWith(addOn.name));
                        const quantity = currentAddOn?.quantity || 0;
                        
                        return (
                          <div key={addOn.name} className="space-y-3">
                            <div className={`flex items-center justify-between p-5 rounded-3xl transition-all border-2 ${
                              quantity > 0
                                ? 'bg-soda-copper/10 border-soda-copper shadow-sm' 
                                : isDarkMode
                                  ? 'bg-white/5 border-white/10 hover:border-white/20'
                                  : 'bg-white/50 border-soda-copper/10 hover:border-soda-copper/30'
                            }`}>
                              <div className="text-left">
                                <p className={`font-bold transition-colors ${isDarkMode ? 'text-dark-text' : 'text-soda-brown'}`}>{addOn.name}</p>
                                <p className="text-[10px] mt-1 text-soda-copper font-bold">{addOn.price}</p>
                              </div>
                              
                              <div className="flex items-center gap-4">
                                {quantity > 0 ? (
                                  <div className={`flex items-center gap-3 rounded-full px-3 py-1.5 border shadow-inner transition-colors ${isDarkMode ? 'bg-dark-bg border-white/10' : 'bg-white border-soda-copper/20'}`}>
                                    <button 
                                      onClick={() => {
                                        setSelectedAddOns(prev => {
                                          const existing = prev.find(a => a.name.startsWith(addOn.name));
                                          if (existing && existing.quantity > 1) {
                                            return prev.map(a => a.name.startsWith(addOn.name) ? { ...a, quantity: a.quantity - 1 } : a);
                                          }
                                          return prev.filter(a => !a.name.startsWith(addOn.name));
                                        });
                                      }}
                                      className={`p-1 transition-colors ${isDarkMode ? 'text-dark-text/60 hover:text-soda-copper' : 'text-soda-brown hover:text-soda-copper'}`}
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <span className={`font-black text-xs w-4 text-center transition-colors ${isDarkMode ? 'text-dark-text' : 'text-soda-brown'}`}>{quantity}</span>
                                    <button 
                                      onClick={() => {
                                        setSelectedAddOns(prev => {
                                          const existing = prev.find(a => a.name.startsWith(addOn.name));
                                          if (existing) {
                                            return prev.map(a => a.name.startsWith(addOn.name) ? { ...a, quantity: a.quantity + 1 } : a);
                                          }
                                          return [...prev, { name: addOn.name, price: addOn.price, quantity: 1 }];
                                        });
                                      }}
                                      className={`p-1 transition-colors ${isDarkMode ? 'text-dark-text/60 hover:text-soda-copper' : 'text-soda-brown hover:text-soda-copper'}`}
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={() => setSelectedAddOns([...selectedAddOns, { name: addOn.name, price: addOn.price, quantity: 1 }])}
                                    className="p-3 bg-soda-copper text-soda-cream rounded-full shadow-lg shadow-soda-copper/20 hover:scale-110 transition-transform active:scale-95"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            {quantity > 0 && addOn.options.length > 0 && (
                              <div className="pl-6 pr-2 pb-2 flex flex-wrap gap-2">
                                {addOn.options.map(opt => {
                                  const isOptSelected = currentAddOn?.name.includes(`(${opt})`);
                                  return (
                                    <button
                                      key={opt}
                                      onClick={() => {
                                        setSelectedAddOns(prev => prev.map(a => 
                                          a.name.startsWith(addOn.name) ? { ...a, name: `${addOn.name} (${opt})` } : a
                                        ));
                                      }}
                                      className={`text-[10px] px-4 py-2 rounded-full border-2 transition-all font-bold ${
                                        isOptSelected
                                          ? 'bg-soda-brown text-soda-cream border-soda-brown shadow-md'
                                          : isDarkMode
                                            ? 'bg-white/5 text-dark-text border-white/10 hover:border-white/20'
                                            : 'bg-white text-soda-brown border-soda-copper/20 hover:border-soda-copper/40'
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className={`p-8 border-t flex flex-col sm:flex-row gap-6 items-center transition-colors ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/80 border-soda-copper/20'}`}>
                <div className={`flex items-center gap-4 rounded-full px-6 py-3 border-2 shadow-inner transition-colors ${isDarkMode ? 'bg-dark-bg border-white/10' : 'bg-soda-cream border-soda-copper/20'}`}>
                  <button 
                    onClick={() => setConfigQuantity(Math.max(1, configQuantity - 1))}
                    className={`p-2 transition-colors ${isDarkMode ? 'text-dark-text/60 hover:text-soda-copper' : 'text-soda-brown hover:text-soda-copper'}`}
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <span className={`font-black text-xl w-8 text-center transition-colors ${isDarkMode ? 'text-dark-text' : 'text-soda-brown'}`}>{configQuantity}</span>
                  <button 
                    onClick={() => setConfigQuantity(configQuantity + 1)}
                    className={`p-2 transition-colors ${isDarkMode ? 'text-dark-text/60 hover:text-soda-copper' : 'text-soda-brown hover:text-soda-copper'}`}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex gap-4 w-full">
                  <button 
                    onClick={() => setItemToConfigure(null)}
                    className={`flex-1 py-5 font-bold rounded-[24px] transition-colors ${isDarkMode ? 'text-dark-text hover:bg-white/10' : 'text-soda-brown hover:bg-soda-copper/10'}`}
                  >
                    Cancelar
                  </button>
                  <button 
                    disabled={
                      (itemToConfigure.options.length > 0 && itemToConfigure.name.toLowerCase().includes('pinto con 2') && selectedOptions.length < 2) ||
                      (itemToConfigure.options.length > 0 && !itemToConfigure.name.toLowerCase().includes('pinto con 2') && selectedOptions.length < 1)
                    }
                    onClick={() => addToCart(itemToConfigure, selectedOptions, selectedAddOns, configQuantity)}
                    className="flex-[2] py-5 bg-soda-brown text-soda-cream rounded-[24px] font-bold text-lg hover:bg-soda-dark transition-all shadow-xl shadow-soda-brown/20 disabled:opacity-50 active:scale-[0.98]"
                  >
                    Confirmar y Agregar
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <footer className={`max-w-7xl mx-auto px-4 py-16 md:px-8 border-t mt-20 transition-colors duration-500 ${isDarkMode ? 'border-white/10' : 'border-soda-copper/20'}`}>
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-soda-brown flex items-center justify-center">
                <span className="text-soda-cream font-serif font-bold text-lg">;</span>
              </div>
              <span className={`font-serif font-bold text-2xl transition-colors ${isDarkMode ? 'text-dark-text' : 'text-soda-brown'}`}>Punto y Coma</span>
            </div>
            <p className="text-soda-copper font-bold text-xs uppercase tracking-widest">Soda & Restaurante</p>
          </div>
          
          <div className="text-center md:text-right space-y-2">
            <p className={`text-sm font-medium transition-colors ${isDarkMode ? 'text-dark-text/40' : 'text-soda-brown/50'}`}>
              &copy; {new Date().getFullYear()} Soda Punto y Coma. Todos los derechos reservados.
            </p>
            <p className="text-[10px] text-soda-copper font-black uppercase tracking-widest">
              Menú Digital • Actualización Automática
            </p>
          </div>
        </div>
      </footer>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-soda-dark/40 backdrop-blur-md z-50 md:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 200 }}
              className={`fixed inset-y-0 left-0 w-80 z-50 p-8 md:hidden shadow-2xl border-r overflow-y-auto transition-colors duration-500 ${isDarkMode ? 'bg-dark-surface border-white/10' : 'bg-soda-cream border-soda-copper/30'}`}
            >
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-soda-brown flex items-center justify-center">
                    <span className="text-soda-cream font-serif font-bold text-xl">;</span>
                  </div>
                  <h2 className={`text-2xl font-serif font-bold transition-colors ${isDarkMode ? 'text-dark-text' : 'text-soda-brown'}`}>Menú</h2>
                </div>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-dark-text' : 'hover:bg-soda-copper/10 text-soda-brown'}`}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <h3 className="text-[10px] uppercase tracking-[0.2em] text-soda-copper font-black mb-6 border-b border-soda-copper/20 pb-2">Explorar</h3>
              <nav className="space-y-3">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all font-bold ${
                      selectedCategory === cat 
                        ? 'bg-soda-brown text-soda-cream shadow-xl shadow-soda-brown/20' 
                        : isDarkMode
                          ? 'bg-white/5 text-dark-text border border-white/10'
                          : 'bg-white/50 text-soda-brown border border-soda-copper/10'
                    }`}
                  >
                    <span className={selectedCategory === cat ? 'text-soda-cream' : 'text-soda-copper'}>
                      {getCategoryIcon(cat)}
                    </span>
                    <span>{cat}</span>
                  </button>
                ))}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
