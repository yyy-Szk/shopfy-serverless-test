import { BillingInterval, LATEST_API_VERSION, Session } from "@shopify/shopify-api";
import { shopifyApp } from "@shopify/shopify-app-express";
import { SQLiteSessionStorage } from "@shopify/shopify-app-session-storage-sqlite";
import {PostgreSQLSessionStorage} from '@shopify/shopify-app-session-storage-postgresql';
import { restResources } from "@shopify/shopify-api/rest/admin/2023-04";

// - storeSession: DBにセッション情報を保存。引数[session]
// - loadSession: DBからセッション情報を取得。引数[id]
// - deleteSession: DBからセッション情報を削除。引数[id]
// - deleteSessions: DBから全てのセッション情報を削除。引数[ids]
// - findSessionsByShop: DBからストアドメインを元にセッション情報を取得。引数[shop]

class OriginalSessionStorage {
  constructor(dbClient) {
    this.dbClient = dbClient;
  }

  // storeSession(session: Session): Promise<boolean>;
  async storeSession(session) {
    console.log("storeSession")
    const result = this.dbClient.createSession(session);
    if (!result)
      return false;

    return true;
  }

  // loadSession(id: string): Promise<Session | undefined>;
  async loadSession(id) {
    console.log(id)
    const result = await this.dbClient.readSessionByShopifyId(id);
    if (!result)
      return undefined;

    const sessionParams = {
      id: result.shopifyid,
      shop: result.shopdomain,
      state: result.state,
      isOnline: result.isonline,
      scope: result.scope,
      expires: result.expires,
      accessToken: result.accesstoken,
      onlineAccessInfo: result.onlineaccessinfo
    }

    return new Session(sessionParams);
  }

  // deleteSession(id: string): Promise<boolean>;
  async deleteSession(id) {
    console.log("deleteSession")
    const result = await this.dbClient.deleteSessionByShopifyId(id);
    if (!result)
      return false;

    return true;
  }

  // deleteSessions(ids: string[]): Promise<boolean>;
  async deleteSessions(ids) {
    console.log("deleteSessions")
    const result = this.dbClient.deleteSessionsByShopifyId(ids);
    if (!result)
      return false;

    return true;
  }

  // findSessionsByShop(shop: string): Promise<Session[]>;
  async findSessionsByShop(shop) {
    console.log("findSessionsByShop")
    const result = await this.dbClient.readSessionByShopDomain(shop);

    const sessionParams = {
      id: result.shopifyid,
      shop: result.shopdomain,
      state: result.state,
      isOnline: result.isonline,
      scope: result.scope,
      expires: result.expires,
      accessToken: result.accesstoken,
      onlineAccessInfo: result.onlineaccessinfo
    }

    return [new Session(sessionParams)]
  }
}

// import sqlite3 from "sqlite3";
import pg from "pg";
import { join } from "path";
const DATABASE_URL = "postgres://yoshimasa-suzuki:@localhost:5432/shopify_tutorial"
import { QRCodesDB } from "./qr-codes-db.js";

// const DB_PATH = `${process.cwd()}/database.sqlite`;
// const database = new sqlite3.Database(join(process.cwd(), "database.sqlite"));
// const database = QRCodesDB.connection();
// Initialize SQLite DB
QRCodesDB.db = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: false
})
QRCodesDB.db.connect();
QRCodesDB.init();

// The transactions with Shopify will always be marked as test transactions, unless NODE_ENV is production.
// See the ensureBilling helper to learn more about billing in this template.
const billingConfig = {
  "My Shopify One-Time Charge": {
    // This is an example configuration that would do a one-time charge for $5 (only USD is currently supported)
    amount: 5.0,
    currencyCode: "USD",
    interval: BillingInterval.OneTime,
  },
};

const shopify = shopifyApp({
  api: {
    apiVersion: LATEST_API_VERSION,
    restResources,
    billing: undefined, // or replace with billingConfig above to enable example billing
  },
  auth: {
    path: "/api/auth",
    callbackPath: "/api/auth/callback",
  },
  webhooks: {
    path: "/api/webhooks",
  },
  // This should be replaced with your preferred storage strategy
  // sessionStorage: new SQLiteSessionStorage(database),
  // sessionStorage: new PostgreSQLSessionStorage(DATABASE_URL),
  sessionStorage: new OriginalSessionStorage(QRCodesDB),
  
});

export default shopify;
