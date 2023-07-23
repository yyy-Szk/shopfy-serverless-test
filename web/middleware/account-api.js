import express from "express";

import { QRCodesDB } from "../qr-codes-db.js";
import {
  getQrCodeOr404,
  getShopUrlFromSession,
  parseQrCodeBody,
  formatQrCodeResponse,
} from "../helpers/qr-codes.js";
import bcrypt from "bcryptjs";

export default function applyAccountApiEndpoints(app) {
  app.use(express.json());

  app.post("/api/account", async (req, res) => {
    try {
      console.log("======", req.body, "======");
      const { company, email, orderAveragePrice, orderCountPerMonth, overview, password, passwordConfirmation } = req.body
  
      if (password !== passwordConfirmation) {
        res.status(200).send({
          status: "fail",
          message: "Password and password confirmation do not match"
        })
        return;
      }
      const hashedPassword = await bcrypt.hashSync(password, 10);
  
      await QRCodesDB.createAccount(company, email, orderAveragePrice, orderCountPerMonth, overview, hashedPassword);
  
      res.send("登録に成功しました。");
    } catch (error) {
      console.log(error)
      res.status(500).send(error.message);
    }
  });
}

