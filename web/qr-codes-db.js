/*
  This file interacts with the app's database and is used by the app's REST APIs.
*/

import sqlite3 from "sqlite3";
import path from "path";
import shopify from "./shopify.js";
import pg from "pg";

const DEFAULT_DB_FILE = path.join(process.cwd(), "qr_codes_db.sqlite");
const DEFAULT_PURCHASE_QUANTITY = 1;
const DATABASE_URL = "postgres://yoshimasa-suzuki:@localhost:5432/shopify_tutorial"

export const QRCodesDB = {
  qrCodesTableName: "qr_codes",
  sessionsTableName: "sessions",
  db: null,
  ready: null,
  connection: async function() {
    const client = new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: false
    })
    client.connect();

    return client;
  },
  create: async function ({
    shopDomain,
    title,
    productId,
    variantId,
    handle,
    discountId,
    discountCode,
    destination,
  }) {
    await this.ready;

    const query = `
      INSERT INTO ${this.qrCodesTableName}
      (shopDomain, title, productId, variantId, handle, discountId, discountCode, destination, scans)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)
      RETURNING id;
    `;

    const rawResults = await this.__query(query, [
      shopDomain,
      title,
      productId,
      variantId,
      handle,
      discountId,
      discountCode,
      destination,
    ]);
    const rows = rawResults.rows;

    return rows[0].id;
  },

  update: async function (
    id,
    {
      title,
      productId,
      variantId,
      handle,
      discountId,
      discountCode,
      destination,
    }
  ) {
    await this.ready;

    const query = `
      UPDATE ${this.qrCodesTableName}
      SET
        title = $1,
        productId = $2,
        variantId = $3,
        handle = $4,
        discountId = $5,
        discountCode = $6,
        destination = $7
      WHERE
        id = $8;
    `;

    await this.__query(query, [
      title,
      productId,
      variantId,
      handle,
      discountId,
      discountCode,
      destination,
      id,
    ]);
    return true;
  },

  list: async function (shopDomain) {
    await this.ready;
    const query = `
      SELECT * FROM ${this.qrCodesTableName}
      WHERE shopDomain = $1;
    `;
    const results = await this.__query(query, [shopDomain]);
    const rows = results.rows;

    return rows.map((qrcode) => this.__addImageUrl(qrcode));
  },

  read: async function (id) {
    await this.ready;
    const query = `
      SELECT * FROM ${this.qrCodesTableName}
      WHERE id = $1;
    `;
    const result = await this.__query(query, [id]);
    const rows = result.rows;
    if (!Array.isArray(rows) || rows?.length !== 1) return undefined;

    return this.__addImageUrl(rows[0]);
  },

  delete: async function (id) {
    await this.ready;
    const query = `
      DELETE FROM ${this.qrCodesTableName}
      WHERE id = $1;
    `;
    await this.__query(query, [id]);
    return true;
  },

  /* The destination URL for a QR code is generated at query time */
  generateQrcodeDestinationUrl: function (qrcode) {
    return `${shopify.api.config.hostScheme}://${shopify.api.config.hostName}/qrcodes/${qrcode.id}/scan`;
  },

  /* The behavior when a QR code is scanned */
  handleCodeScan: async function (qrcode) {

    /* Log the scan in the database */
    await this.__increaseScanCount(qrcode);

    const url = new URL(qrcode.shopDomain);
    switch (qrcode.destination) {

      /* The QR code redirects to the product view */
      case "product":
        return this.__goToProductView(url, qrcode);

      /* The QR code redirects to checkout */
      case "checkout":
        return this.__goToProductCheckout(url, qrcode);

      default:
        throw `Unrecognized destination "${qrcode.destination}"`;
    }
  },

  /* Private */

  /*
    Used to check whether to create the database.
    Also used to make sure the database and table are set up before the server starts.
  */

  __hasQrCodesTable: async function () {
    const query = `
      SELECT 1 FROM information_schema.tables WHERE table_name = $1;
    `;
    const result = await this.__query(query, [this.qrCodesTableName]);
    const rows = result.rows;

    return rows.length === 1;
  },
  __hasSessionsTable: async function () {
    const query = `
      SELECT 1 FROM information_schema.tables WHERE table_name = $1;
    `;
    const result = await this.__query(query, [this.sessionsTableName]);
    const rows = result.rows;

    return rows.length === 1;
  },

  /* Initializes the connection with the app's sqlite3 database */
  init: async function () {

    /* Initializes the connection to the database */
    this.db = this.db ?? await this.connection

    const hasQrCodesTable = await this.__hasQrCodesTable();
    const hasSessionsTable = await this.__hasSessionsTable();
    
    if (hasQrCodesTable && hasSessionsTable) {
      this.ready = Promise.resolve();
      return
    }

    const readyQueries = []
    if (!hasQrCodesTable) {
      const query = `
        CREATE TABLE ${this.qrCodesTableName} (
          id SERIAL PRIMARY KEY,
          shopDomain VARCHAR(511) NOT NULL,
          title VARCHAR(511) NOT NULL,
          productId VARCHAR(255) NOT NULL,
          variantId VARCHAR(255) NOT NULL,
          handle VARCHAR(255) NOT NULL,
          discountId VARCHAR(255) NOT NULL,
          discountCode VARCHAR(255) NOT NULL,
          destination VARCHAR(255) NOT NULL,
          scans INTEGER,
          createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;

      /* Tell the various CRUD methods that they can execute */
      readyQueries.push(this.__query(query));
    }

    if (!hasSessionsTable) {
      const query = `
        CREATE TABLE ${this.sessionsTableName} (
          id SERIAL PRIMARY KEY,
          shopDomain VARCHAR(255) NOT NULL,
          shopifyId VARCHAR(255) NOT NULL,
          state VARCHAR(255) NOT NULL,
          isOnline BOOLEAN NOT NULL,
          scope VARCHAR(1024),
          expires INTEGER,
          onlineAccessInfo VARCHAR(255),
          accessToken VARCHAR(255),
          createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
      readyQueries.push(this.__query(query));
    }

    this.ready = Promise.all(readyQueries);
  },
  createSession: async function (session) {
    await this.ready;
    const query = `
      INSERT INTO ${this.sessionsTableName} (
        shopDomain,
        shopifyId,
        state,
        isOnline,
        scope,
        expires,
        onlineAccessInfo,
        accessToken
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      )
      RETURNING *;
    `;
    const result = await this.__query(query, [
      session.shop,
      session.id,
      session.state,
      session.isOnline,
      session.scope,
      null,
      "",
      session.accessToken,
    ]);

    const rows = result.rows;
    // if (!Array.isArray(rows) || rows?.length !== 1) return undefined;

    return rows[0];
  },
  readSessionByShopifyId: async function (shopifyId) {
    await this.ready;
    const query = `
      SELECT * FROM ${this.sessionsTableName}
      WHERE shopifyId = $1
      LIMIT 1;
    `;
    const result = await this.__query(query, [shopifyId]);
    const rows = result.rows;
    if (!rows.length) return undefined;
    // if (!Array.isArray(rows) || rows?.length !== 1) return undefined;

    return rows[0];
  },
  readSessionByShopDomain: async function (shopDomain) {
    await this.ready;
    const query = `
      SELECT * FROM ${this.sessionsTableName}
      WHERE shopDomain = $1;
    `;
    const result = await this.__query(query, [shopDomain]);
    const rows = result.rows;
    // if (!Array.isArray(rows) || rows?.length !== 1) return undefined;

    return rows[0];
  },
  deleteSessionsByShopifyId: async function (ids) {
    await this.ready;
    const query = `
      DELETE FROM ${this.sessionsTableName}
      WHERE shopifyId = ANY($1);
    `;
    await this.__query(query, [ids]);
  },
  deleteSessionByShopifyId: async function (id) {
    await this.ready;
    const query = `
      DELETE FROM ${this.sessionsTableName}
      WHERE shopifyId = $1;
    `;
    await this.__query(query, [id]);
  },

  /* Perform a query on the database. Used by the various CRUD methods. */
  __query: function (sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.query(sql, params, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      })
    })
  },

  __addImageUrl: function (qrcode) {
    try {
      qrcode.imageUrl = this.__generateQrcodeImageUrl(qrcode);
    } catch (err) {
      console.error(err);
    }

    return qrcode;
  },

  __generateQrcodeImageUrl: function (qrcode) {
    return `${shopify.api.config.hostScheme}://${shopify.api.config.hostName}/qrcodes/${qrcode.id}/image`;
  },

  __increaseScanCount: async function (qrcode) {
    const query = `
      UPDATE ${this.qrCodesTableName}
      SET scans = scans + 1
      WHERE id = ?
    `;
    await this.__query(query, [qrcode.id]);
  },

  __goToProductView: function (url, qrcode) {
    return productViewURL({
      discountCode: qrcode.discountCode,
      host: url.toString(),
      productHandle: qrcode.handle,
    });
  },

  __goToProductCheckout: function (url, qrcode) {
    return productCheckoutURL({
      discountCode: qrcode.discountCode,
      host: url.toString(),
      variantId: qrcode.variantId,
      quantity: DEFAULT_PURCHASE_QUANTITY,
    });
  },
};

/* Generate the URL to a product page */
function productViewURL({ host, productHandle, discountCode }) {
  const url = new URL(host);
  const productPath = `/products/${productHandle}`;

  /* If this QR Code has a discount code, then add it to the URL */
  if (discountCode) {
    url.pathname = `/discount/${discountCode}`;
    url.searchParams.append("redirect", productPath);
  } else {
    url.pathname = productPath;
  }

  return url.toString();
}

/* Generate the URL to checkout with the product in the cart */
function productCheckoutURL({ host, variantId, quantity = 1, discountCode }) {
  const url = new URL(host);
  const id = variantId.replace(
    /gid:\/\/shopify\/ProductVariant\/([0-9]+)/,
    "$1"
  );

  /* The cart URL resolves to a checkout URL */
  url.pathname = `/cart/${id}:${quantity}`;

  if (discountCode) {
    url.searchParams.append("discount", discountCode);
  }

  return url.toString();
}
