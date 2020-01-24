import dotenv from "dotenv";
dotenv.config();
import axios from "axios";

export function debugJestSum(a, b) {
  return a + b;
}

const reedApi = axios.create({ baseURL: "" });
console.log(process.env.YO);
// const axios = axios
