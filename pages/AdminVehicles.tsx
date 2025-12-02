import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Search, Loader2, AlertCircle, Database } from 'lucide-react';
import { Vehicle } from '../types';
import * as AzureService from '../services/azure';

const AdminVehicles: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Validation State
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Search Filters
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [formData, setFormData] = useState<Partial<Vehicle>>({
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    plate: '',
    color: '',
    transmission: 'Automático',
    fuel: 'Flex',
    pricePerDay: 0,
    isAvailable: true,
    imageUrl: '',
  });

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await AzureService.getVehicles();
      setVehicles(data);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Erro ao carregar veículos.");
    } finally {
      setLoading(false);
    }
  };

  const handleSeedData = async () => {
      setLoading(true);
      try {
          await AzureService.seedVehicles();
          await loadVehicles();
          alert("Veículos de teste gerados com sucesso!");
      } catch (e: any) {
          alert("Erro ao gerar dados: " + e.message);
      } finally {
          setLoading(false);
      }
  };

  const handleOpenModal = (vehicle?: Vehicle) => {
    setFormErrors({});
    if (vehicle) {
      setEditingVehicle(vehicle);
      setFormData(vehicle);
    } else {
      setEditingVehicle(null);
      setFormData({
        brand: '',
        model: '',
        year: new Date().getFullYear(),
        plate: '',
        color: '',
        transmission: 'Automático',
        fuel: 'Flex',
        pricePerDay: 0,
        isAvailable: true,
        imageUrl: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploading(true);
      setFormErrors(prev => ({ ...prev, imageUrl: '' }));
      try {
        const url = await AzureService.uploadImage(e.target.files[0]);
        setFormData(prev => ({ ...prev, imageUrl: url }));
      } catch (err: any) {
        alert(err.message || "Falha ao enviar imagem. Verifique CORS.");
      } finally {
        setUploading(false);
      }
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.brand?.trim()) errors.brand = "Marca é obrigatória";
    if (!formData.model?.trim()) errors.model = "Modelo é obrigatório";
    if (!formData.plate?.trim()) errors.plate = "Placa é obrigatória";
    
    const currentYear = new Date().getFullYear();
    if (!formData.year || formData.year < 1900 || formData.year > currentYear + 1) {
      errors.year = `Ano inválido (1900-${currentYear + 1})`;
    }
    
    if (!formData.pricePerDay || formData.pricePerDay <= 0) {
      errors.pricePerDay = "Preço deve ser maior que zero";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);

    const vehicleToSave: Vehicle = {
      partitionKey: "Vehicle",
      rowKey: editingVehicle ? editingVehicle.rowKey : crypto.randomUUID(),
      brand: formData.brand!,
      model: formData.model!,
      year: Number(formData.year),
      plate: formData.plate!,
      color: formData.color,
      transmission: formData.transmission as any,
      fuel: formData.fuel as any,
      pricePerDay: Number(formData.pricePerDay),
      isAvailable: formData.isAvailable ?? true,
      imageUrl: formData.imageUrl || 'https://via.placeholder.com/400x300?text=Sem+Imagem',
    };

    try {
      await AzureService.upsertVehicle(vehicleToSave);
      setIsModalOpen(false);
      loadVehicles();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Falha ao salvar veículo. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (v: Vehicle) => {
    if (confirm(`Excluir ${v.brand} ${v.model}?`)) {
      try {
        await AzureService.deleteVehicle(v.partitionKey, v.rowKey);
        loadVehicles();
      } catch (err: any) {
        alert("Falha ao excluir: " + err.message);
      }
    }
  };

  const filteredVehicles = vehicles.filter(v => 
    v.brand.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.plate.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Gerenciamento de Veículos</h2>
        <div className="flex gap-2">
            <button 
            onClick={handleSeedData}
            className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
            >
            <Database className="w-4 h-4" /> Gerar Dados de Teste
            </button>
            <button 
            onClick={() => handleOpenModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm"
            >
            <Plus className="w-4 h-4" /> Novo Veículo
            </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6 border border-gray-100 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Buscar por marca, modelo ou placa..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 flex items-center gap-2 border border-red-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{errorMsg}</span>
        </div>
      )}

      {/* Grid */}
      {loading ? (
         <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVehicles.map(vehicle => (
            <div key={vehicle.rowKey} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-md transition-shadow">
              <div className="h-48 overflow-hidden bg-gray-100 relative">
                <img src={vehicle.imageUrl} alt={vehicle.model} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute top-2 right-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${vehicle.isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {vehicle.isAvailable ? 'Disponível' : 'Indisponível'}
                    </span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-gray-900">{vehicle.brand} {vehicle.model}</h3>
                    <p className="text-sm text-gray-500">{vehicle.year} • {vehicle.plate}</p>
                    {vehicle.transmission && <p className="text-xs text-gray-400 mt-1">{vehicle.transmission} • {vehicle.fuel}</p>}
                  </div>
                  <div className="text-right">
                    <span className="block font-bold text-blue-600">R$ {vehicle.pricePerDay}</span>
                    <span className="text-xs text-gray-400">/dia</span>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-50 flex justify-end gap-2">
                  <button onClick={() => handleOpenModal(vehicle)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(vehicle)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!loading && filteredVehicles.length === 0 && (
              <div className="col-span-3 text-center py-12 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <p className="mb-2">Nenhum veículo encontrado.</p>
                  <button onClick={handleSeedData} className="text-blue-600 font-semibold text-sm hover:underline">
                      Clique para gerar veículos de teste
                  </button>
              </div>
          )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold">{editingVehicle ? 'Editar Veículo' : 'Novo Veículo'}</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marca *</label>
                  <input type="text" className={`w-full border border-gray-300 bg-white rounded p-2 ${formErrors.brand ? 'border-red-500' : ''}`} value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} />
                  {formErrors.brand && <p className="text-xs text-red-500 mt-1">{formErrors.brand}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modelo *</label>
                  <input type="text" className={`w-full border border-gray-300 bg-white rounded p-2 ${formErrors.model ? 'border-red-500' : ''}`} value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} />
                  {formErrors.model && <p className="text-xs text-red-500 mt-1">{formErrors.model}</p>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ano *</label>
                  <input type="number" className={`w-full border border-gray-300 bg-white rounded p-2 ${formErrors.year ? 'border-red-500' : ''}`} value={formData.year} onChange={e => setFormData({...formData, year: Number(e.target.value)})} />
                  {formErrors.year && <p className="text-xs text-red-500 mt-1">{formErrors.year}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Placa *</label>
                  <input type="text" className={`w-full border border-gray-300 bg-white rounded p-2 ${formErrors.plate ? 'border-red-500' : ''}`} value={formData.plate} onChange={e => setFormData({...formData, plate: e.target.value})} />
                  {formErrors.plate && <p className="text-xs text-red-500 mt-1">{formErrors.plate}</p>}
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Preço (Dia) *</label>
                   <input type="number" className={`w-full border border-gray-300 bg-white rounded p-2 ${formErrors.pricePerDay ? 'border-red-500' : ''}`} value={formData.pricePerDay} onChange={e => setFormData({...formData, pricePerDay: Number(e.target.value)})} />
                   {formErrors.pricePerDay && <p className="text-xs text-red-500 mt-1">{formErrors.pricePerDay}</p>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cor</label>
                    <input type="text" className="w-full border border-gray-300 bg-white rounded p-2" value={formData.color || ''} onChange={e => setFormData({...formData, color: e.target.value})} placeholder="Ex: Prata" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Câmbio</label>
                    <select className="w-full border border-gray-300 bg-white rounded p-2" value={formData.transmission} onChange={e => setFormData({...formData, transmission: e.target.value as any})}>
                        <option value="Automático">Automático</option>
                        <option value="Manual">Manual</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Combustível</label>
                    <select className="w-full border border-gray-300 bg-white rounded p-2" value={formData.fuel} onChange={e => setFormData({...formData, fuel: e.target.value as any})}>
                        <option value="Flex">Flex</option>
                        <option value="Gasolina">Gasolina</option>
                        <option value="Diesel">Diesel</option>
                        <option value="Elétrico">Elétrico</option>
                    </select>
                  </div>
              </div>

              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Imagem</label>
                  <div className="flex gap-2 items-center">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                    {uploading && <Loader2 className="animate-spin text-blue-600" />}
                  </div>
                  {formData.imageUrl && <img src={formData.imageUrl} alt="Preview" className="mt-2 h-24 rounded object-cover border" />}
              </div>
              <div className="flex items-center gap-2">
                 <input type="checkbox" id="avail" checked={formData.isAvailable} onChange={e => setFormData({...formData, isAvailable: e.target.checked})} className="rounded text-blue-600" />
                 <label htmlFor="avail" className="text-sm font-medium text-gray-700">Disponível para locação</label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                <button 
                  disabled={uploading || isSubmitting} 
                  type="submit" 
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded disabled:opacity-50 flex items-center gap-2"
                >
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

export default AdminVehicles;