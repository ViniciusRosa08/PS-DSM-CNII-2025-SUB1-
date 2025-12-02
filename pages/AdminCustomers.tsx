import React, { useEffect, useState } from 'react';
import { Plus, Search, Loader2, Mail, Phone, FileText, MapPin } from 'lucide-react';
import { Customer } from '../types';
import * as AzureService from '../services/azure';

const AdminCustomers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<Partial<Customer>>({
    fullName: '',
    email: '',
    phone: '',
    driverLicense: '',
    address: '',
    city: ''
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await AzureService.getCustomers();
      setCustomers(data);
    } catch (e) {
      console.error(e);
      // alert("Error loading customers."); // handled by global UI usually, or simple console
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (customer?: Customer) => {
    setFormErrors({});
    if (customer) {
      setEditingCustomer(customer);
      setFormData(customer);
    } else {
      setEditingCustomer(null);
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        driverLicense: '',
        address: '',
        city: ''
      });
    }
    setIsModalOpen(true);
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.fullName?.trim()) errors.fullName = "Nome completo é obrigatório";
    if (!formData.email?.trim()) errors.email = "Email é obrigatório";
    else if (!validateEmail(formData.email)) errors.email = "Email inválido";
    if (!formData.phone?.trim()) errors.phone = "Telefone é obrigatório";
    if (!formData.driverLicense?.trim()) errors.driverLicense = "CNH é obrigatória";
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);

    const customerToSave: Customer = {
      partitionKey: "Customer",
      rowKey: editingCustomer ? editingCustomer.rowKey : crypto.randomUUID(),
      fullName: formData.fullName!,
      email: formData.email!,
      phone: formData.phone!,
      driverLicense: formData.driverLicense!,
      address: formData.address,
      city: formData.city
    };

    try {
      await AzureService.upsertCustomer(customerToSave);
      setIsModalOpen(false);
      loadCustomers();
    } catch (err: any) {
      alert(err.message || "Failed to save customer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (c: Customer) => {
    if (confirm(`Excluir ${c.fullName}?`)) {
      try {
        await AzureService.deleteCustomer(c.partitionKey, c.rowKey);
        loadCustomers();
      } catch (err) {
        alert("Failed to delete");
      }
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Gerenciamento de Clientes</h2>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Novo Cliente
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm mb-6 border border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou email..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Nome</th>
                <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Contato</th>
                <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Documento (CNH)</th>
                <th className="px-6 py-4 font-semibold text-gray-600 text-sm text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCustomers.map(customer => (
                <tr key={customer.rowKey} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{customer.fullName}</div>
                    {customer.city && <div className="text-xs text-gray-400 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3"/> {customer.city}</div>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="flex items-center gap-2 mb-1"><Mail className="w-3 h-3" /> {customer.email}</div>
                    <div className="flex items-center gap-2"><Phone className="w-3 h-3" /> {customer.phone}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="flex items-center gap-2"><FileText className="w-3 h-3" /> {customer.driverLicense}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleOpenModal(customer)} className="text-blue-600 hover:text-blue-800 mr-3">Editar</button>
                    <button onClick={() => handleDelete(customer)} className="text-red-500 hover:text-red-700">Excluir</button>
                  </td>
                </tr>
              ))}
               {filteredCustomers.length === 0 && (
                  <tr>
                      <td colSpan={4} className="text-center py-8 text-gray-400">Nenhum cliente encontrado.</td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
             <div className="p-6 border-b">
              <h3 className="text-lg font-bold">{editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
                <input type="text" className={`w-full border border-gray-300 bg-white rounded p-2 ${formErrors.fullName ? 'border-red-500' : ''}`} value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                {formErrors.fullName && <p className="text-xs text-red-500">{formErrors.fullName}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input type="email" className={`w-full border border-gray-300 bg-white rounded p-2 ${formErrors.email ? 'border-red-500' : ''}`} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                    {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
                  </div>
                   <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone *</label>
                    <input type="text" className={`w-full border border-gray-300 bg-white rounded p-2 ${formErrors.phone ? 'border-red-500' : ''}`} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                    {formErrors.phone && <p className="text-xs text-red-500">{formErrors.phone}</p>}
                  </div>
              </div>
               <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CNH *</label>
                <input type="text" className={`w-full border border-gray-300 bg-white rounded p-2 ${formErrors.driverLicense ? 'border-red-500' : ''}`} value={formData.driverLicense} onChange={e => setFormData({...formData, driverLicense: e.target.value})} />
                {formErrors.driverLicense && <p className="text-xs text-red-500">{formErrors.driverLicense}</p>}
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                    <input type="text" className="w-full border border-gray-300 bg-white rounded p-2" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Rua, Número, Bairro" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                    <input type="text" className="w-full border border-gray-300 bg-white rounded p-2" value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} />
                  </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded flex items-center gap-2">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCustomers;