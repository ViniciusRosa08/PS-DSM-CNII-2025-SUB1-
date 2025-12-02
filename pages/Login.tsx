import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ShieldCheck, User, ArrowRight, Loader2, Mail } from 'lucide-react';
import * as AzureService from '../services/azure';
import { Customer } from '../types';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER' | 'ADMIN'>('LOGIN');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login State
  const [loginEmail, setLoginEmail] = useState('');

  // Register State
  const [registerData, setRegisterData] = useState({
    fullName: '',
    email: '',
    phone: '',
    driverLicense: '',
    city: ''
  });

  const handleAdminLogin = () => {
    setLoading(true);
    setTimeout(() => {
        localStorage.setItem('userRole', 'ADMIN');
        localStorage.setItem('userName', 'Administrador');
        navigate('/admin/vehicles');
    }, 800);
  };

  const handleCustomerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
        const customer = await AzureService.getCustomerByEmail(loginEmail);
        if (customer) {
            localStorage.setItem('userRole', 'CUSTOMER');
            localStorage.setItem('userId', customer.rowKey);
            localStorage.setItem('userName', customer.fullName);
            navigate('/customer/browse');
        } else {
            setError("Email não encontrado. Verifique ou crie uma conta.");
        }
    } catch (e: any) {
        setError("Erro ao conectar: " + e.message);
    } finally {
        setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!registerData.fullName || !registerData.email || !registerData.driverLicense) {
        setError("Preencha os campos obrigatórios.");
        return;
    }

    setLoading(true);
    setError(null);

    try {
        // Check if email exists
        const existing = await AzureService.getCustomerByEmail(registerData.email);
        if (existing) {
            setError("Este email já está cadastrado.");
            setLoading(false);
            return;
        }

        const newCustomer: Customer = {
            partitionKey: "Customer",
            rowKey: crypto.randomUUID(),
            fullName: registerData.fullName,
            email: registerData.email,
            phone: registerData.phone,
            driverLicense: registerData.driverLicense,
            city: registerData.city
        };

        await AzureService.upsertCustomer(newCustomer);
        
        // Auto login
        localStorage.setItem('userRole', 'CUSTOMER');
        localStorage.setItem('userId', newCustomer.rowKey);
        localStorage.setItem('userName', newCustomer.fullName);
        navigate('/customer/browse');

    } catch (e: any) {
        setError("Erro ao criar conta: " + e.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-800 to-black flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 flex flex-col">
        
        {/* Header */}
        <div className="p-8 pb-4 text-center">
            <div className="bg-orange-500 p-3 rounded-2xl shadow-lg shadow-orange-500/30 mb-4 inline-block">
                <Zap className="w-8 h-8 text-white fill-current" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">TurboCloud</h1>
            <p className="text-gray-500 text-sm">Gerenciamento e Locação Inteligente</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
            <button 
                onClick={() => { setActiveTab('LOGIN'); setError(null); }}
                className={`flex-1 py-4 text-sm font-bold transition-colors relative
                ${activeTab === 'LOGIN' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
                Entrar
                {activeTab === 'LOGIN' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>}
            </button>
            <button 
                onClick={() => { setActiveTab('REGISTER'); setError(null); }}
                className={`flex-1 py-4 text-sm font-bold transition-colors relative
                ${activeTab === 'REGISTER' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
                Criar Conta
                {activeTab === 'REGISTER' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>}
            </button>
            <button 
                onClick={() => { setActiveTab('ADMIN'); setError(null); }}
                className={`flex-1 py-4 text-sm font-bold transition-colors relative
                ${activeTab === 'ADMIN' ? 'text-purple-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
                Admin
                {activeTab === 'ADMIN' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></div>}
            </button>
        </div>

        {/* Content */}
        <div className="p-8 pt-6 flex-1 bg-gray-50/50">
            {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 text-xs rounded border border-red-200">
                    {error}
                </div>
            )}

            {activeTab === 'LOGIN' && (
                <form onSubmit={handleCustomerLogin} className="space-y-4 animate-fade-in">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Cadastrado</label>
                        <input 
                            type="email" 
                            className="w-full bg-white border border-gray-300 rounded-lg p-3 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="seu@email.com"
                            value={loginEmail}
                            onChange={e => setLoginEmail(e.target.value)}
                            required
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                        Acessar Conta
                    </button>
                </form>
            )}

            {activeTab === 'REGISTER' && (
                <form onSubmit={handleRegister} className="space-y-3 animate-fade-in">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Completo</label>
                        <input type="text" className="w-full bg-white border border-gray-300 rounded-lg p-2.5 outline-none focus:border-blue-500" placeholder="Seu nome" value={registerData.fullName} onChange={e => setRegisterData({...registerData, fullName: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                        <input type="email" className="w-full bg-white border border-gray-300 rounded-lg p-2.5 outline-none focus:border-blue-500" placeholder="seu@email.com" value={registerData.email} onChange={e => setRegisterData({...registerData, email: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                         <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefone</label>
                            <input type="text" className="w-full bg-white border border-gray-300 rounded-lg p-2.5 outline-none focus:border-blue-500" placeholder="(11) 999..." value={registerData.phone} onChange={e => setRegisterData({...registerData, phone: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CNH</label>
                            <input type="text" className="w-full bg-white border border-gray-300 rounded-lg p-2.5 outline-none focus:border-blue-500" placeholder="Nº CNH" value={registerData.driverLicense} onChange={e => setRegisterData({...registerData, driverLicense: e.target.value})} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cidade</label>
                        <input type="text" className="w-full bg-white border border-gray-300 rounded-lg p-2.5 outline-none focus:border-blue-500" placeholder="Sua cidade" value={registerData.city} onChange={e => setRegisterData({...registerData, city: e.target.value})} />
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <User className="w-5 h-5" />}
                        Cadastrar
                    </button>
                </form>
            )}

            {activeTab === 'ADMIN' && (
                <div className="animate-fade-in space-y-4">
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 flex gap-3 items-start">
                        <ShieldCheck className="w-5 h-5 text-purple-600 mt-0.5" />
                        <div>
                            <h3 className="font-bold text-purple-900 text-sm">Área Restrita</h3>
                            <p className="text-xs text-purple-700 mt-1">Acesso exclusivo para gerenciamento de frota e dados.</p>
                        </div>
                    </div>
                     <button 
                        onClick={handleAdminLogin}
                        disabled={loading}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg shadow-lg shadow-purple-200 flex items-center justify-center gap-2 transition-all"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                        Entrar como Admin
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Login;