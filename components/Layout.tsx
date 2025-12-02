import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Car, Users, Calendar, LayoutDashboard, UserCircle, LogOut, Zap } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const role = localStorage.getItem('userRole') || 'CUSTOMER';
  const userName = localStorage.getItem('userName') || 'Usuário';
  const isAdmin = role === 'ADMIN';

  // Simple active link checker
  const isActive = (path: string) => location.pathname === path ? "bg-indigo-700 text-white" : "text-indigo-100 hover:bg-indigo-600";

  const handleLogout = () => {
      localStorage.clear();
      navigate('/login');
  };

  // Don't show layout on login page
  if (location.pathname === '/login') return <>{children}</>;

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-gradient-to-b from-indigo-900 to-slate-900 text-white flex flex-col fixed h-full shadow-2xl z-10">
        <div className="p-6 border-b border-indigo-700/50 flex items-center gap-3">
          <div className="bg-orange-500 p-2 rounded-lg shadow-lg shadow-orange-500/20">
             <Zap className="w-6 h-6 text-white fill-current" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-none">TurboCloud</h1>
            <p className="text-xs text-indigo-300 font-medium tracking-wide">RENTALS</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2 mt-4 px-4">
            {isAdmin ? 'Painel Administrativo' : 'Área do Cliente'}
          </div>

          {isAdmin ? (
            <>
              <Link to="/admin/vehicles" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive('/admin/vehicles')}`}>
                <Car className="w-5 h-5" />
                <span>Veículos</span>
              </Link>
              <Link to="/admin/customers" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive('/admin/customers')}`}>
                <Users className="w-5 h-5" />
                <span>Clientes</span>
              </Link>
              <Link to="/admin/rentals" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive('/admin/rentals')}`}>
                <Calendar className="w-5 h-5" />
                <span>Locações</span>
              </Link>
            </>
          ) : (
             <>
              <Link to="/customer/browse" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive('/customer/browse')}`}>
                <LayoutDashboard className="w-5 h-5" />
                <span>Alugar Carro</span>
              </Link>
              <Link to="/customer/my-rentals" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive('/customer/my-rentals')}`}>
                <Calendar className="w-5 h-5" />
                <span>Minhas Locações</span>
              </Link>
              <Link to="/customer/profile" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive('/customer/profile')}`}>
                <UserCircle className="w-5 h-5" />
                <span>Meu Perfil</span>
              </Link>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-indigo-800/50 bg-indigo-950/30">
           <div className="mb-4 px-4">
               <p className="text-xs text-indigo-300">Logado como:</p>
               <p className="font-semibold text-sm text-white truncate" title={userName}>{isAdmin ? 'Administrador' : userName}</p>
           </div>
           <button 
            onClick={handleLogout}
            className="flex items-center gap-2 justify-center w-full px-4 py-2 bg-red-600/10 text-red-400 border border-red-600/20 rounded-lg text-sm hover:bg-red-600 hover:text-white transition-all duration-300"
           >
             <LogOut className="w-4 h-4" />
             <span>Sair do Sistema</span>
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen bg-slate-50">
        <div className="max-w-7xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;