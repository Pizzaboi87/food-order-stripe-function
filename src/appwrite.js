import { Client, Databases, ID, Permission, Role } from "node-appwrite";

class AppwriteService {
  constructor(apiKey) {
    const client = new Client();
    client
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID);

    if (apiKey) {
      client.setKey(apiKey);
    }

    this.databases = new Databases(client);
  }

  async createPendingOrder(databaseId, collectionId, userId, payload) {
    const pricing = payload?.pricing ?? {};
    const address = payload?.address ?? {};
    const items = Array.isArray(payload?.items) ? payload.items : [];

    return this.databases.createDocument(
      databaseId,
      collectionId,
      ID.unique(),
      {
        userId,
        orderId: "pending",
        status: "pending",

        customerName: payload?.customerName ?? "",
        phone: payload?.phone ?? "",

        city: address?.city ?? "",
        street: address?.street ?? "",
        houseNumber: address?.houseNumber ?? "",
        floorDoor: address?.floorDoor ?? "",

        itemCount: Number(payload?.itemCount ?? 0),
        itemsJson: JSON.stringify(items),

        subtotalHuf: Number(pricing?.subtotalHuf ?? 0),
        discountHuf: Number(pricing?.discountHuf ?? 0),
        deliveryFeeHuf: Number(pricing?.deliveryFeeHuf ?? 0),
        totalHuf: Number(pricing?.totalHuf ?? 0),
      },
      [Permission.read(Role.user(userId))]
    );
  }

  async markOrderPaid(databaseId, collectionId, orderDocId, stripeSessionId) {
    return this.databases.updateDocument(
      databaseId,
      collectionId,
      orderDocId,
      {
        status: "paid",
        orderId: stripeSessionId,
      }
    );
  }
}

export default AppwriteService;
