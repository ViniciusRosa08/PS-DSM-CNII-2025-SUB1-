export interface Vehicle {
  partitionKey: string; // usually "Vehicle" or Brand
  rowKey: string; // UUID
  brand: string;
  model: string;
  year: number;
  plate: string;
  color?: string;
  transmission?: 'Manual' | 'Automático';
  fuel?: 'Flex' | 'Gasolina' | 'Diesel' | 'Elétrico';
  pricePerDay: number;
  isAvailable: boolean;
  imageUrl: string;
  timestamp?: Date;
}

export interface Customer {
  partitionKey: string; // "Customer"
  rowKey: string; // UUID or Email
  fullName: string;
  email: string;
  phone: string;
  driverLicense: string; // CNH
  city?: string;
  address?: string;
  timestamp?: Date;
}

export interface Rental {
  partitionKey: string; // "Rental"
  rowKey: string; // UUID
  vehicleId: string; // FK to Vehicle RowKey
  customerId: string; // FK to Customer RowKey
  vehicleModel: string; // Snapshot for display
  customerName: string; // Snapshot for display
  startDate: string; // ISO String
  endDate: string; // ISO String
  totalPrice: number;
  paymentMethod?: 'Cartão de Crédito' | 'Pix' | 'Dinheiro' | 'Boleto';
  paymentStatus?: 'Pending' | 'Paid';
  status: 'Active' | 'Completed' | 'Canceled';
  timestamp?: Date;
}

export type ViewMode = 'ADMIN' | 'CUSTOMER';