import React, { useEffect, useState } from 'react';
import { Plus, XCircle, Loader2, Calendar, Edit2, CheckCircle, Trash2 } from 'lucide-react';
import { Rental, Vehicle, Customer } from '../types';
import * as AzureService from '../services/azure';

const AdminRentals: React.FC = () => {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingRental, setEditingRental] = useState<Rental | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState<{
      vehicleId: string,
      customerId: string,
      startDate: string,
      endDate: string,
      paymentMethod: 'Cartão de Crédito' | 'Pix' | 'Dinheiro' | 'Boleto',
      status: 'Active' | 'Completed' | 'Canceled'
  }>({
    vehicleId: '',
    customerId: '',
    startDate: '',
    endDate: '',
    paymentMethod: 'Cartão de Crédito',
    status: 'Active'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rData, vData, cData] = await Promise.all([
        AzureService.getRentals(),
        AzureService.getVehicles(),
        AzureService.getCustomers()
      ]);
      setRentals(rData);
      setVehicles(vData);
      setCustomers(cData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (rental?: Rental) => {
      setFormErrors({});
      if (rental) {
          setEditingRental(rental);
          setFormData({
              vehicleId: rental.vehicleId,
              customerId: rental.customerId,
              startDate: rental.startDate,
              endDate: rental.endDate,
              paymentMethod: rental.paymentMethod || 'Cartão de Crédito',
              status: rental.status
          });
      } else {
          setEditingRental(null);
          setFormData({
            vehicleId: '',
            customerId: '',
            startDate: '',
            endDate: '',
            paymentMethod: 'Cartão de Crédito',
            status: 'Active'
          });
      }
      setIsModalOpen(true);
  };

  const calculateTotal = () => {
    if (!formData.startDate || !formData.endDate || !formData.vehicleId) return 0;
    const vehicle = vehicles.find(v => v.rowKey === formData.vehicleId);
    if (!vehicle) return 0;
    
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    
    start.setUTCHours(0,0,0,0);
    end.setUTCHours(0,0,0,0);
    
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    return diffDays > 0 ? diffDays * vehicle.pricePerDay : 0;
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    const today = new Date().toISOString().split('T')[0];

    if (!formData.customerId) errors.customerId = "Selecione um cliente";
    if (!formData.vehicleId) errors.vehicleId = "Selecione um veículo";
    if (!formData.startDate) errors.startDate = "Data de início obrigatória";
    if (!formData.endDate) errors.endDate = "Data de fim obrigatória";
    
    if (!editingRental && formData.startDate && formData.startDate < today) {
        errors.startDate = "Data de início não pode ser no passado";
    }

    if (formData.startDate && formData.endDate) {
        if (new Date(formData.startDate) >= new Date(formData.endDate)) {
            errors.endDate = "Data final deve ser posterior à inicial";
        }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const vehicle = vehicles.find(v => v.rowKey === formData.vehicleId);
    const customer = customers.find(c => c.rowKey === formData.customerId);

    if(!vehicle || !customer) return;

    setIsSubmitting(true);

    const rental: Rental = {
      partitionKey: "Rental",
      rowKey: editingRental ? editingRental.rowKey : crypto.randomUUID(),
      vehicleId: formData.vehicleId,
      customerId: formData.customerId,
      vehicleModel: `${vehicle.brand} ${vehicle.model}`,
      customerName: customer.fullName,
      startDate: formData.startDate,
      endDate: formData.endDate,
      totalPrice: calculateTotal(),
      paymentMethod: formData.paymentMethod,
      status: formData.status,
      paymentStatus: editingRental?.paymentStatus || 'Pending'
    };

    try {
      await AzureService.upsertRental(rental);
      
      // Update vehicle availability based on status
      const isRentalActive = rental.status === 'Active';
      await AzureService.upsertVehicle({
          ...vehicle,
          isAvailable: !isRentalActive
      });

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to save rental");
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelRental = async (rental: Rental) => {
    if(!confirm("Cancelar esta locação? O veículo ficará disponível novamente.")) return;

    try {
        const updatedRental: Rental = { ...rental, status: 'Canceled' };
        await AzureService.upsertRental(updatedRental);

        // Free up vehicle
        const vehicle = vehicles.find(v => v.rowKey === rental.vehicleId);
        if (vehicle) {
            await AzureService.upsertVehicle({ ...vehicle, isAvailable: true });
        }
        loadData();
    } catch (e: any) {
        alert("Erro ao cancelar: " + e.message);
    }
  };

  const deleteRental = async (rental: Rental) => {
      if(!confirm("ATENÇÃO: Deseja EXCLUIR permanentemente este registro de locação?")) return;
      
      try {
          await AzureService.deleteRental(rental.partitionKey, rental.rowKey);
          
          // If deleted rental was active, free up vehicle
          if (rental.status === 'Active') {
              const vehicle = vehicles.find(v => v.rowKey === rental.vehicleId);
              if (vehicle) {
                  await AzureService.upsertVehicle({ ...vehicle, isAvailable: true });
              }
          }
          loadData();
      } catch (e: any) {
          alert("Erro ao excluir: " + e.message);
      }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Gerenciamento de Locações</h2>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Nova Locação
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : (
         <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Cliente</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Veículo</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Período</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Pagamento</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Total</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rentals.map(rental => (
                <tr key={rental.rowKey} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{rental.customerName}</td>
                  <td className="px-6 py-4 text-gray-600">{rental.vehicleModel}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="flex items-center gap-2"><Calendar className="w-3 h-3"/> {rental.startDate}</div>
                    <div className="flex items-center gap-2 ml-5">à {rental.endDate}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                      <div>{rental.paymentMethod || '-'}</div>
                      {rental.paymentStatus === 'Paid' && <div className="text-xs text-green-600 font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Pago</div>}
                  </td>
                  <td className="px-6 py-4 font-semibold text-blue-600">R$ {rental.totalPrice}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full font-bold
                        ${rental.status === 'Active' ? 'bg-green-100 text-green-700' : 
                          rental.status === 'Canceled' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}
                    `}>
                        {rental.status === 'Active' ? 'Ativa' : rental.status === 'Canceled' ? 'Cancelada' : 'Concluída'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                     <button onClick={() => handleOpenModal(rental)} className="text-gray-500 hover:text-blue-600 p-2 hover:bg-blue-50 rounded" title="Editar">
                        <Edit2 className="w-4 h-4" />
                     </button>
                    {rental.status === 'Active' && (
                        <button onClick={() => cancelRental(rental)} className="text-orange-500 hover:text-orange-700 p-2 hover:bg-orange-50 rounded" title="Cancelar Locação (Mudar Status)">
                            <XCircle className="w-4 h-4" />
                        </button>
                    )}
                    <button onClick={() => deleteRental(rental)} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded" title="Excluir Registro">
                        <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
               {rentals.length === 0 && (
                  <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-400">Nenhuma locação registrada.</td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Rental Modal (Create/Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
             <div className="p-6 border-b">
              <h3 className="text-lg font-bold">{editingRental ? 'Editar Locação' : 'Nova Locação'}</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                <select 
                    className={`w-full border border-gray-300 bg-white rounded p-2 ${formErrors.customerId ? 'border-red-500' : ''}`} 
                    value={formData.customerId} 
                    onChange={e => setFormData({...formData, customerId: e.target.value})}
                    disabled={!!editingRental} 
                >
                    <option value="">Selecione um cliente...</option>
                    {customers.map(c => <option key={c.rowKey} value={c.rowKey}>{c.fullName}</option>)}
                </select>
                {formErrors.customerId && <p className="text-xs text-red-500">{formErrors.customerId}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Veículo *</label>
                <select 
                    className={`w-full border border-gray-300 bg-white rounded p-2 ${formErrors.vehicleId ? 'border-red-500' : ''}`} 
                    value={formData.vehicleId} 
                    onChange={e => setFormData({...formData, vehicleId: e.target.value})}
                >
                    <option value="">Selecione um veículo...</option>
                    {vehicles.filter(v => v.isAvailable || v.rowKey === formData.vehicleId).map(v => (
                        <option key={v.rowKey} value={v.rowKey}>
                            {v.brand} {v.model} - {v.plate} (R$ {v.pricePerDay}) {v.isAvailable ? '' : '[Indisponível]'}
                        </option>
                    ))}
                </select>
                {formErrors.vehicleId && <p className="text-xs text-red-500">{formErrors.vehicleId}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Início *</label>
                    <input type="date" className={`w-full border border-gray-300 bg-white rounded p-2 ${formErrors.startDate ? 'border-red-500' : ''}`} value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                    {formErrors.startDate && <p className="text-xs text-red-500">{formErrors.startDate}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fim *</label>
                    <input type="date" min={formData.startDate} className={`w-full border border-gray-300 bg-white rounded p-2 ${formErrors.endDate ? 'border-red-500' : ''}`} value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                    {formErrors.endDate && <p className="text-xs text-red-500">{formErrors.endDate}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pagamento</label>
                      <select className="w-full border border-gray-300 bg-white rounded p-2" value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value as any})}>
                          <option value="Cartão de Crédito">Cartão de Crédito</option>
                          <option value="Pix">Pix</option>
                          <option value="Dinheiro">Dinheiro</option>
                          <option value="Boleto">Boleto</option>
                      </select>
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select className="w-full border border-gray-300 bg-white rounded p-2" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                          <option value="Active">Ativa</option>
                          <option value="Completed">Concluída</option>
                          <option value="Canceled">Cancelada</option>
                      </select>
                  </div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded text-center">
                  <span className="text-gray-600 text-sm">Valor Estimado</span>
                  <div className="text-2xl font-bold text-blue-700">R$ {calculateTotal()}</div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded flex items-center gap-2">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {editingRental ? 'Atualizar' : 'Confirmar Locação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRentals;