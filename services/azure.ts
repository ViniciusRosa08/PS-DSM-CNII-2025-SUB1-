import { Vehicle, Customer, Rental } from "../types";

// Azure Credentials
const ACCOUNT_NAME = "stop2cn2"; 
const SAS_TOKEN_INPUT = "sv=2024-11-04&ss=bfqt&srt=sco&sp=rwdlacupiytfx&se=2025-12-12T05:56:00Z&st=2025-12-01T21:41:00Z&spr=https,http&sig=OKKIF%2FVwmh7aFyDeHUKgHJvq6zEINX31amkmI7DUxj4%3D";

// Limpeza e Preparação do Token
const CLEAN_SAS_PARAMS = SAS_TOKEN_INPUT.trim().replace(/^\?/, '');
const SAS_QUERY_APPEND = `&${CLEAN_SAS_PARAMS}`;
const SAS_QUERY_START = `?${CLEAN_SAS_PARAMS}`;

const BLOB_ENDPOINT = `https://${ACCOUNT_NAME}.blob.core.windows.net`;
const TABLE_ENDPOINT = `https://${ACCOUNT_NAME}.table.core.windows.net`;

const VEHICLES_TABLE = "Vehicles";
const CUSTOMERS_TABLE = "Customers";
const RENTALS_TABLE = "Rentals";
const IMAGES_CONTAINER = "car-images";

// --- CORS PROXY CONFIGURATION ---
const USE_PROXY = true;
const CORS_PROXY = "https://corsproxy.io/?";

const getUrl = (url: string) => {
  // Adiciona um timestamp para evitar cache do proxy
  const separator = url.includes('?') ? '&' : '?';
  const noCacheUrl = `${url}${separator}_t=${new Date().getTime()}`;
  return USE_PROXY ? `${CORS_PROXY}${encodeURIComponent(noCacheUrl)}` : noCacheUrl;
};

// --- Helpers ---

async function handleResponse(response: Response, context: string) {
  if (!response.ok) {
    if (response.status === 404) return null; 
    
    const text = await response.text();
    console.error(`Azure Error [${context}]: ${response.status}`, text);
    throw new Error(`Erro Azure (${response.status}): ${response.statusText} - ${text}`);
  }
  return response;
}

/**
 * Helper para requisições na Table Storage
 */
async function tableRequest(tableName: string, method: string, body?: any, partitionKey?: string, rowKey?: string) {
  let azureUrl = `${TABLE_ENDPOINT}/${tableName}`;
  
  if (partitionKey && rowKey) {
    azureUrl += `(PartitionKey='${partitionKey}',RowKey='${rowKey}')`;
  } 
  
  azureUrl += SAS_QUERY_START;
  const finalUrl = getUrl(azureUrl);

  const headers: any = {
    'Accept': 'application/json;odata=nometadata',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate', // FORÇA O NAVEGADOR A NÃO USAR CACHE
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  const options: RequestInit = {
    method,
    headers,
    cache: 'no-store' // Importante para fetch API
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(finalUrl, options);
    
    if (method === 'GET') {
      if (!response.ok) {
        if (response.status === 404) return [];
        const text = await response.text();
        if (text.includes("CORS")) throw new Error("Erro de Proxy/CORS.");
        throw new Error(`Erro na busca: ${response.statusText}`);
      }
      const data = await response.json();
      return data.value || data;
    } else {
      await handleResponse(response, `${method} ${tableName}`);
    }
  } catch (error: any) {
    console.error(`Falha na requisição para ${tableName}:`, error);
    if (error.message && error.message.includes('Failed to fetch')) {
        throw new Error("Erro de Conexão. Verifique CORS ou Data do Token.");
    }
    throw error;
  }
}

async function createTableIfNotExists(tableName: string) {
  const azureUrl = `${TABLE_ENDPOINT}/Tables${SAS_QUERY_START}`;
  const finalUrl = getUrl(azureUrl);

  try {
    await fetch(finalUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json;odata=nometadata',
        'Content-Type': 'application/json',
        'Prefer': 'return-no-content'
      },
      body: JSON.stringify({ TableName: tableName })
    });
  } catch (e) {
    console.warn(`Tentativa de criar tabela ${tableName} falhou.`);
  }
}

async function createContainerIfNotExists(containerName: string) {
  const azureUrl = `${BLOB_ENDPOINT}/${containerName}?restype=container${SAS_QUERY_APPEND}`;
  const finalUrl = getUrl(azureUrl);
  
  try {
    await fetch(finalUrl, { method: 'PUT' });
  } catch (e) {
    console.warn(`Container ${containerName} check falhou.`);
  }
}

// --- Inicialização ---

export const initializeAzureResources = async () => {
  console.log("Inicializando conexão Azure via Proxy...");
  try {
    await Promise.all([
      createTableIfNotExists(VEHICLES_TABLE),
      createTableIfNotExists(CUSTOMERS_TABLE),
      createTableIfNotExists(RENTALS_TABLE),
      createContainerIfNotExists(IMAGES_CONTAINER)
    ]);
  } catch (error) {
    console.error("Erro na inicialização de recursos:", error);
  }
};

// --- Serviços Blob ---

export const uploadImage = async (file: File): Promise<string> => {
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '');
  const blobName = `${new Date().getTime()}-${safeName}`;
  const directUrl = `${BLOB_ENDPOINT}/${IMAGES_CONTAINER}/${blobName}`;
  const uploadUrl = `${directUrl}${SAS_QUERY_START}`;
  const proxiedUploadUrl = getUrl(uploadUrl);

  try {
    const response = await fetch(proxiedUploadUrl, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': file.type
      },
      body: file
    });

    if (!response.ok) {
      throw new Error(`Upload falhou: ${response.status}`);
    }
    return `${directUrl}${SAS_QUERY_START}`;
  } catch (error: any) {
    throw new Error("Falha no upload de imagem.");
  }
};

// --- Serviços Table ---

export const getVehicles = async (): Promise<Vehicle[]> => tableRequest(VEHICLES_TABLE, 'GET');
export const upsertVehicle = async (vehicle: Vehicle) => tableRequest(VEHICLES_TABLE, 'PUT', vehicle, vehicle.partitionKey, vehicle.rowKey);

export const deleteVehicle = async (pk: string, rk: string) => {
    const url = `${TABLE_ENDPOINT}/${VEHICLES_TABLE}(PartitionKey='${pk}',RowKey='${rk}')${SAS_QUERY_START}`;
    const response = await fetch(getUrl(url), { 
        method: 'DELETE', 
        headers: { 'If-Match': '*' } 
    });
    
    if (!response.ok && response.status !== 404) {
        throw new Error(`Falha ao deletar: ${response.statusText}`);
    }
};

export const getCustomers = async (): Promise<Customer[]> => tableRequest(CUSTOMERS_TABLE, 'GET');

// Função auxiliar para Login
export const getCustomerByEmail = async (email: string): Promise<Customer | null> => {
    try {
        const customers = await getCustomers();
        return customers.find(c => c.email.toLowerCase() === email.toLowerCase()) || null;
    } catch (e) {
        return null;
    }
};

export const upsertCustomer = async (customer: Customer) => tableRequest(CUSTOMERS_TABLE, 'PUT', customer, customer.partitionKey, customer.rowKey);

export const deleteCustomer = async (pk: string, rk: string) => {
    const url = `${TABLE_ENDPOINT}/${CUSTOMERS_TABLE}(PartitionKey='${pk}',RowKey='${rk}')${SAS_QUERY_START}`;
    const response = await fetch(getUrl(url), { 
        method: 'DELETE', 
        headers: { 'If-Match': '*' } 
    });

    if (!response.ok && response.status !== 404) {
         throw new Error(`Falha ao deletar Cliente: ${response.statusText}`);
    }
};

export const getRentals = async (): Promise<Rental[]> => tableRequest(RENTALS_TABLE, 'GET');
export const upsertRental = async (rental: Rental) => tableRequest(RENTALS_TABLE, 'PUT', rental, rental.partitionKey, rental.rowKey);

export const deleteRental = async (pk: string, rk: string) => {
    const url = `${TABLE_ENDPOINT}/${RENTALS_TABLE}(PartitionKey='${pk}',RowKey='${rk}')${SAS_QUERY_START}`;
    const response = await fetch(getUrl(url), { 
        method: 'DELETE', 
        headers: { 'If-Match': '*' } 
    });

    if (!response.ok && response.status !== 404) {
         throw new Error(`Falha ao deletar Locação: ${response.statusText}`);
    }
};

// --- SEED FUNCTION ---
export const seedVehicles = async () => {
    const vehicles: Vehicle[] = [
        {
            partitionKey: "Vehicle",
            rowKey: crypto.randomUUID(),
            brand: "Toyota",
            model: "Corolla XEi",
            year: 2024,
            plate: "ABC-1234",
            color: "Branco Pérola",
            transmission: "Automático",
            fuel: "Flex",
            pricePerDay: 180,
            isAvailable: true,
            imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/2019_Toyota_Corolla_Icon_Tech_VVT-i_Hybrid_1.8.jpg/1200px-2019_Toyota_Corolla_Icon_Tech_VVT-i_Hybrid_1.8.jpg"
        },
        {
            partitionKey: "Vehicle",
            rowKey: crypto.randomUUID(),
            brand: "Jeep",
            model: "Compass Longitude",
            year: 2023,
            plate: "JEP-9988",
            color: "Preto Carbon",
            transmission: "Automático",
            fuel: "Diesel",
            pricePerDay: 250,
            isAvailable: true,
            imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4e/Jeep_Compass_%28MP%29_facelift_IMG_5210.jpg"
        }
    ];

    for (const v of vehicles) {
        await upsertVehicle(v);
    }
};