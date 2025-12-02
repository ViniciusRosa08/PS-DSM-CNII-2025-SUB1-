import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Car, Calendar, User, CheckCircle, X, CreditCard, Edit2, Save, QrCode, Copy } from 'lucide-react';
import { Vehicle, Rental, Customer } from '../types';
import * as AzureService from '../services/azure';

const CustomerPortal: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [myRentals, setMyRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Booking Modal State
  const [bookingVehicle, setBookingVehicle] = useState<Vehicle | null>(null);
  const [rentalDays, setRentalDays] = useState(3);
  const [isProcessingBooking, setIsProcessingBooking] = useState(false);

  // Payment Modal State
  const [payingRental, setPayingRental] = useState<Rental | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentMethodSelection, setPaymentMethodSelection] = useState<'CREDIT' | 'PIX'>('CREDIT');
  const [pixKey, setPixKey] = useState('');

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState<Partial<Customer>>({});

  // Real User State
  const [currentUser, setCurrentUser] = useState<Customer | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
      if (payingRental) {
          const randomId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          const rawPix = `00020126580014BR.GOV.BCB.PIX0136${randomId}520400005303986540${payingRental.totalPrice.toFixed(2).replace('.', '')}5802BR5913TurboCloudRent6009SAOPAULO62070503***6304`;
          setPixKey(rawPix.toUpperCase());
          setPaymentMethodSelection('CREDIT'); 
      }
  }, [payingRental]);

  const loadData = async () => {
    setLoading(true);
    try {
        const userId = localStorage.getItem('userId');
        
        if (!userId) {
            alert("Sessão expirada. Faça login novamente.");
            navigate('/login');
            return;
        }

        const customers = await AzureService.getCustomers();
        const user = customers.find(c => c.rowKey === userId);

        if (!user) {
             alert("Usuário não encontrado.");
             navigate('/login');
             return;
        }

        setCurrentUser(user);
        setProfileData(user);
        
        const vData = await AzureService.getVehicles();
        setVehicles(vData);

        const rData = await AzureService.getRentals();
        setMyRentals(rData.filter(r => r.customerId === user.rowKey));
        
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const openBookingModal = (vehicle: Vehicle) => {
      setBookingVehicle(vehicle);
      setRentalDays(3); // Default
  };

  const confirmBooking = async () => {
      if (!bookingVehicle || !currentUser) return;

      setIsProcessingBooking(true);

      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + rentalDays);

      const startDate = start.toISOString().split('T')[0];
      const endDate = end.toISOString().split('T')[0];
      
      const rental: Rental = {
          partitionKey: "Rental",
          rowKey: crypto.randomUUID(),
          vehicleId: bookingVehicle.rowKey,
          customerId: currentUser.rowKey,
          vehicleModel: `${bookingVehicle.brand} ${bookingVehicle.model}`,
          customerName: currentUser.fullName,
          startDate: startDate,
          endDate: endDate,
          totalPrice: rentalDays * bookingVehicle.pricePerDay,
          status: 'Active',
          paymentStatus: 'Pending',
          paymentMethod: 'Cartão de Crédito'
      };

      try {
          await AzureService.upsertRental(rental);
          await AzureService.upsertVehicle({...bookingVehicle, isAvailable: false});
          
          setVehicles(prev => prev.map(v => v.rowKey === bookingVehicle.rowKey ? {...v, isAvailable: false} : v));
          setMyRentals(prev => [...prev, rental]);
          
          setBookingVehicle(null);
          alert(`Sucesso! Você alugou o ${bookingVehicle.model} por ${rentalDays} dias.`);
      } catch(e: any) {
          alert(e.message || "Erro na locação. Tente novamente.");
      } finally {
          setIsProcessingBooking(false);
      }
  };

  const handleSaveProfile = async () => {
      if (!currentUser) return;
      setIsProcessingBooking(true);
      
      try {
          const updatedUser = { ...currentUser, ...profileData };
          await AzureService.upsertCustomer(updatedUser as Customer);
          setCurrentUser(updatedUser as Customer);
          // Update local storage name if changed
          if(updatedUser.fullName) localStorage.setItem('userName', updatedUser.fullName);
          
          setIsEditingProfile(false);
          alert("Perfil atualizado com sucesso!");
      } catch (e: any) {
          alert("Erro ao salvar perfil.");
      } finally {
          setIsProcessingBooking(false);
      }
  };

  const handlePayment = async () => {
      if (!payingRental) return;
      setIsProcessingPayment(true);

      try {
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const updatedRental = { 
              ...payingRental, 
              paymentStatus: 'Paid' as const,
              paymentMethod: paymentMethodSelection === 'PIX' ? 'Pix' : 'Cartão de Crédito' as any
          };
          await AzureService.upsertRental(updatedRental);
          
          setMyRentals(prev => prev.map(r => r.rowKey === payingRental.rowKey ? updatedRental : r));
          setPayingRental(null);
          alert("Pagamento confirmado! Obrigado.");
      } catch (e) {
          alert("Erro no pagamento.");
      } finally {
          setIsProcessingPayment(false);
      }
  };

  const copyPixKey = () => {
      navigator.clipboard.writeText(pixKey);
      alert("Chave Pix copiada!");
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>;

  if (path === '/customer/profile') {
      return (
          <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-100 animate-fade-in">
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                        <User className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">{currentUser?.fullName}</h2>
                        <p className="text-gray-500">Perfil de Cliente</p>
                    </div>
                </div>
                {!isEditingProfile ? (
                    <button onClick={() => setIsEditingProfile(true)} className="flex items-center gap-2 text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" /> Editar
                    </button>
                ) : (
                     <div className="flex gap-2">
                        <button onClick={() => setIsEditingProfile(false)} className="text-gray-500 hover:text-gray-700 px-3 py-2">Cancelar</button>
                        <button onClick={handleSaveProfile} disabled={isProcessingBooking} className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors">
                            {isProcessingBooking ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />} Salvar
                        </button>
                     </div>
                )}
              </div>
              
              {currentUser ? (
                  <div className="space-y-4">
                      {/* Read Only Fields */}
                      <div className="grid grid-cols-2 gap-4">
                           <div className="p-4 bg-gray-50 rounded-lg opacity-70">
                              <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Nome Completo (Fixo)</label>
                              <div className="text-gray-800">{currentUser.fullName}</div>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-lg opacity-70">
                              <label className="block text-xs uppercase text-gray-500 font-bold mb-1">CNH (Fixo)</label>
                              <div className="text-gray-800">{currentUser.driverLicense}</div>
                          </div>
                      </div>

                      {/* Editable Fields */}
                      <div className="grid grid-cols-2 gap-4">
                          <div className={`p-4 rounded-lg border ${isEditingProfile ? 'border-blue-200 bg-white' : 'border-transparent bg-gray-50'}`}>
                              <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Email</label>
                              {isEditingProfile ? (
                                  <input type="email" className="w-full bg-white border border-gray-300 rounded p-1" value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})} />
                              ) : (
                                  <div className="text-gray-800">{currentUser.email}</div>
                              )}
                          </div>
                          <div className={`p-4 rounded-lg border ${isEditingProfile ? 'border-blue-200 bg-white' : 'border-transparent bg-gray-50'}`}>
                              <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Telefone</label>
                              {isEditingProfile ? (
                                  <input type="text" className="w-full bg-white border border-gray-300 rounded p-1" value={profileData.phone} onChange={e => setProfileData({...profileData, phone: e.target.value})} />
                              ) : (
                                  <div className="text-gray-800">{currentUser.phone}</div>
                              )}
                          </div>
                          <div className={`p-4 rounded-lg border ${isEditingProfile ? 'border-blue-200 bg-white' : 'border-transparent bg-gray-50'}`}>
                              <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Cidade</label>
                              {isEditingProfile ? (
                                  <input type="text" className="w-full bg-white border border-gray-300 rounded p-1" value={profileData.city || ''} onChange={e => setProfileData({...profileData, city: e.target.value})} />
                              ) : (
                                  <div className="text-gray-800">{currentUser.city || 'Não informada'}</div>
                              )}
                          </div>
                          <div className={`p-4 rounded-lg border ${isEditingProfile ? 'border-blue-200 bg-white' : 'border-transparent bg-gray-50'}`}>
                              <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Endereço</label>
                              {isEditingProfile ? (
                                  <input type="text" className="w-full bg-white border border-gray-300 rounded p-1" value={profileData.address || ''} onChange={e => setProfileData({...profileData, address: e.target.value})} />
                              ) : (
                                  <div className="text-gray-800">{currentUser.address || 'Não informado'}</div>
                              )}
                          </div>
                      </div>
                  </div>
              ) : (
                  <p className="text-red-500">Erro ao carregar perfil.</p>
              )}
          </div>
      );
  }

  if (path === '/customer/my-rentals') {
      return (
        <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Minhas Locações</h2>
            <div className="space-y-4">
                {myRentals.map(rental => (
                    <div key={rental.rowKey} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center hover:shadow-md transition-shadow gap-4">
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-blue-900">{rental.vehicleModel}</h3>
                            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                                <span className="flex items-center gap-1"><Calendar className="w-4 h-4"/> {rental.startDate} até {rental.endDate}</span>
                                <span>Total: R$ {rental.totalPrice}</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                             <div className="flex gap-2">
                                <span className={`inline-block px-3 py-1 text-xs rounded-full font-bold
                                    ${rental.status === 'Active' ? 'bg-blue-100 text-blue-700' : 
                                    rental.status === 'Canceled' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}
                                `}>
                                    {rental.status === 'Active' ? 'Ativa' : rental.status === 'Canceled' ? 'Cancelada' : 'Concluída'}
                                </span>
                                {rental.status === 'Active' && (
                                     <span className={`inline-block px-3 py-1 text-xs rounded-full font-bold flex items-center gap-1
                                        ${rental.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}
                                     `}>
                                        {rental.paymentStatus === 'Paid' ? <CheckCircle className="w-3 h-3"/> : null}
                                        {rental.paymentStatus === 'Paid' ? 'Pago' : 'Pendente'}
                                     </span>
                                )}
                             </div>
                             
                             {rental.status === 'Active' && rental.paymentStatus !== 'Paid' && (
                                 <button 
                                    onClick={() => setPayingRental(rental)}
                                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded-lg shadow-sm transition-colors"
                                 >
                                     <CreditCard className="w-4 h-4" /> Pagar Agora
                                 </button>
                             )}
                        </div>
                    </div>
                ))}
                {myRentals.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-xl border border-dashed">
                        <p className="text-gray-500">Nenhuma locação encontrada para sua conta.</p>
                    </div>
                )}
            </div>

            {/* Payment Modal */}
            {payingRental && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up">
                        <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-blue-600"/> Checkout Seguro
                            </h3>
                            <button onClick={() => setPayingRental(null)}><X className="w-5 h-5 text-gray-400"/></button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="text-center">
                                <p className="text-gray-500 text-sm mb-1">Total a pagar</p>
                                <div className="text-3xl font-extrabold text-gray-800">R$ {payingRental.totalPrice.toFixed(2)}</div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => setPaymentMethodSelection('CREDIT')}
                                    className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all
                                    ${paymentMethodSelection === 'CREDIT' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                                >
                                    <CreditCard className="w-5 h-5" />
                                    <span className="text-xs font-bold">Cartão</span>
                                </button>
                                <button 
                                    onClick={() => setPaymentMethodSelection('PIX')}
                                    className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all
                                    ${paymentMethodSelection === 'PIX' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                                >
                                    <QrCode className="w-5 h-5" />
                                    <span className="text-xs font-bold">Pix</span>
                                </button>
                            </div>

                            {paymentMethodSelection === 'PIX' ? (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="flex justify-center">
                                        <div className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm">
                                            <img 
                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pixKey)}`} 
                                                alt="QR Code Pix" 
                                                className="w-40 h-40"
                                            />
                                        </div>
                                    </div>
                                    <div className="bg-gray-100 p-3 rounded-lg flex items-center justify-between gap-2 border border-gray-200">
                                        <div className="text-xs font-mono text-gray-600 truncate w-48 select-all">
                                            {pixKey}
                                        </div>
                                        <button onClick={copyPixKey} className="p-2 hover:bg-gray-200 rounded text-gray-600" title="Copiar Chave">
                                            <Copy className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3 animate-fade-in">
                                    <input type="text" placeholder="Número do Cartão" className="w-full border border-gray-300 rounded p-3 text-sm bg-white" disabled />
                                    <div className="grid grid-cols-2 gap-3">
                                        <input type="text" placeholder="MM/AA" className="w-full border border-gray-300 rounded p-3 text-sm bg-white" disabled />
                                        <input type="text" placeholder="CVV" className="w-full border border-gray-300 rounded p-3 text-sm bg-white" disabled />
                                    </div>
                                    <input type="text" placeholder="Nome no Cartão" className="w-full border border-gray-300 rounded p-3 text-sm bg-white" disabled />
                                </div>
                            )}

                            <button 
                                onClick={handlePayment} 
                                disabled={isProcessingPayment} 
                                className={`w-full py-3 text-white rounded-xl font-bold text-lg shadow-lg transition-all flex justify-center items-center gap-2
                                    ${paymentMethodSelection === 'PIX' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}
                                `}
                            >
                                {isProcessingPayment ? <Loader2 className="w-5 h-5 animate-spin"/> : null}
                                {paymentMethodSelection === 'PIX' ? 'Já fiz o Pix' : 'Pagar Agora'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      );
  }

  // Default: Browse Vehicles
  return (
    <div className="animate-fade-in">
        <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Olá, {currentUser?.fullName}!</h1>
            <p className="text-gray-500">Escolha seu próximo carro para hoje.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {vehicles.filter(v => v.isAvailable).map(vehicle => (
                <div key={vehicle.rowKey} className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden flex flex-col group">
                     <div className="h-56 overflow-hidden bg-gray-100 relative">
                        <img src={vehicle.imageUrl} alt={vehicle.model} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                            <p className="text-white font-bold">{vehicle.transmission || 'Automático'} • {vehicle.fuel || 'Flex'}</p>
                        </div>
                     </div>
                     <div className="p-6 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">{vehicle.brand} {vehicle.model}</h3>
                                <p className="text-gray-400 text-sm">{vehicle.year} • {vehicle.color || 'Cor não inf.'}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-blue-600">R$ {vehicle.pricePerDay}</p>
                                <p className="text-xs text-gray-400">/dia</p>
                            </div>
                        </div>
                        <div className="mt-auto pt-4 border-t border-gray-100">
                            <button 
                                onClick={() => openBookingModal(vehicle)}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                <Car className="w-5 h-5" />
                                Alugar Agora
                            </button>
                        </div>
                     </div>
                </div>
            ))}
            {vehicles.filter(v => v.isAvailable).length === 0 && (
                <div className="col-span-3 text-center py-12 text-gray-400">Nenhum veículo disponível no momento.</div>
            )}
        </div>

        {/* BOOKING MODAL */}
        {bookingVehicle && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                    <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                        <h3 className="text-lg font-bold text-gray-800">Confirmar Locação</h3>
                        <button onClick={() => setBookingVehicle(null)} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="p-6 space-y-6">
                        <div className="flex items-center gap-4">
                            <img src={bookingVehicle.imageUrl} alt="Car" className="w-20 h-20 rounded-lg object-cover bg-gray-100" />
                            <div>
                                <h4 className="font-bold text-gray-900">{bookingVehicle.brand} {bookingVehicle.model}</h4>
                                <p className="text-sm text-gray-500">{bookingVehicle.year} • {bookingVehicle.plate}</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Por quantos dias deseja alugar?</label>
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => setRentalDays(Math.max(1, rentalDays - 1))}
                                    className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                                >-</button>
                                <span className="text-xl font-bold w-12 text-center">{rentalDays}</span>
                                <button 
                                    onClick={() => setRentalDays(rentalDays + 1)}
                                    className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                                >+</button>
                            </div>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-xl flex justify-between items-center">
                            <span className="text-blue-800 font-medium">Total Estimado</span>
                            <span className="text-2xl font-bold text-blue-700">R$ {rentalDays * bookingVehicle.pricePerDay}</span>
                        </div>
                    </div>

                    <div className="p-6 pt-0 flex gap-3">
                        <button 
                            onClick={() => setBookingVehicle(null)} 
                            className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={confirmBooking}
                            disabled={isProcessingBooking}
                            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                        >
                            {isProcessingBooking ? <Loader2 className="animate-spin w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                            Confirmar
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default CustomerPortal;