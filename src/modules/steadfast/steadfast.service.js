import axios from "axios";

const BASE_URL =
  process.env.STEADFAST_BASE_URL || "https://portal.packzy.com/api/v1";

const getClient = () => {
  const apiKey = process.env.STEADFAST_API_KEY;
  const secretKey = process.env.STEADFAST_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error(
      "Steadfast API Key or Secret Key is missing in environment variables",
    );
  }

  return axios.create({
    baseURL: BASE_URL,
    headers: {
      "Api-Key": apiKey,
      "Secret-Key": secretKey,
      "Content-Type": "application/json",
    },
    timeout: 10000,
  });
};

export const steadfastService = {
  /**
   * Create single order consignment in Steadfast
   */
  async createConsignment(orderData) {
    const client = getClient();
    const payload = {
      invoice: orderData.invoice, // Unique Invoice Number
      recipient_name: orderData.recipient_name,
      recipient_phone: orderData.recipient_phone,
      recipient_address: orderData.recipient_address,
      cod_amount: Number(orderData.cod_amount || 0),
      note: orderData.note || "",
    };

    const response = await client.post("/create_order", payload);
    return response.data;
  },

  /**
   * Track delivery status by Consignment ID
   */
  async getStatusByCid(consignmentId) {
    const client = getClient();
    const response = await client.get(`/status_by_cid/${consignmentId}`);
    return response.data;
  },

  /**
   * Track delivery status by Invoice Number
   */
  async getStatusByInvoice(invoice) {
    const client = getClient();
    const response = await client.get(`/status_by_invoice/${invoice}`);
    return response.data;
  },

  /**
   * Get current merchant account balance
   */
  async getBalance() {
    const client = getClient();
    const response = await client.get("/get_balance");
    return response.data;
  },
};
