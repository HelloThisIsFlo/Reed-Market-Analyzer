import dotenv from "dotenv";
dotenv.config();
import axios from "axios";
import hash from "object-hash";
import { dirname } from "path";
import fs from "fs";

import querystring from "querystring";

export const removeAllNulls = obj => {
  return Object.keys(obj)
    .filter(key => obj[key] !== null)
    .reduce((objWithoutNulls, nonNullKeyFromObj) => {
      objWithoutNulls[nonNullKeyFromObj] = obj[nonNullKeyFromObj];
      return objWithoutNulls;
    }, {});
};

const storeData = (filename, data) => {
  try {
    fs.writeFileSync(filename, JSON.stringify(data));
  } catch (err) {
    console.error(err);
  }
};
const loadData = filename => {
  try {
    return JSON.parse(fs.readFileSync(filename, "utf8"));
  } catch (err) {
    console.error(err);
    return false;
  }
};

class Cache {
  constructor() {
    this.path = dirname(dirname(require.main.filename)) + "/.cache";
  }

  has(params) {
    return fs.existsSync(this.filename(params));
  }

  save(params, result) {
    storeData(this.filename(params), result);
  }

  get(params) {
    return loadData(this.filename(params));
  }

  delete(params) {
    fs.unlinkSync(this.filename(params));
  }

  filename(params) {
    const paramsHash = hash(params);
    return `${this.path}/${paramsHash}.json`;
  }
}

class ReedApi {
  constructor(cache) {
    const reedApiKey = process.env.REED_API_KEY;
    const reedApiVersion = "1.0";

    this.cache = cache;
    this.axiosReedApi = axios.create({
      baseURL: `https://www.reed.co.uk/api/${reedApiVersion}`,
      auth: {
        username: `${reedApiKey}`,
        password: ""
      }
    });

    this.axiosReedApi.interceptors.request.use(request => {
      console.log("Starting Request", request.url);
      return request;
    });
  }

  async search({
    keywords = "",
    locationName = "London",
    distanceFromLocation = 15,
    permanent = false,
    contract = true,
    temp = null,
    partTime = null,
    fullTime = null,
    minimumSalary = null,
    maximumSalary = null,
    postedByRecruitmentAgency = null,
    postedByDirectEmployer = null
  }) {
    const searchParams = removeAllNulls({
      keywords,
      locationName,
      distanceFromLocation,
      permanent,
      contract,
      temp,
      partTime,
      fullTime,
      minimumSalary,
      maximumSalary,
      postedByRecruitmentAgency,
      postedByDirectEmployer
    });
    const fetchPage = async alreadyFetched => {
      const resultsToTake = 100;
      const resp = await this.getWithCache(
        `/search?${querystring.stringify({
          ...searchParams,
          resultsToTake,
          resultsToSkip: alreadyFetched
        })}`
      );
      const { results, totalResults } = resp;
      return { results, totalResults };
    };

    let alreadyFetched = 0;
    let allResults = [];

    let page = await fetchPage(alreadyFetched);
    if (page.totalResults >= 500) throw new Error("Too many results (>= 500)");
    alreadyFetched += page.results.length;
    allResults = [...allResults, ...page.results];
    while (alreadyFetched < page.totalResults) {
      page = await fetchPage(alreadyFetched);
      alreadyFetched += page.results.length;
      allResults = [...allResults, ...page.results];
    }

    return allResults;
  }

  async getWithCache(url, forceRefresh = false) {
    if (forceRefresh) this.cache.delete(url);
    if (this.cache.has(url)) return this.cache.get(url);

    const resp = await this.axiosReedApi.get(url);
    this.cache.save(url, resp.data);
    return resp.data;
  }

  async details(jobId) {
    return this.getWithCache(`/jobs/${jobId}`);
  }

  async detailsForAll(searchResults) {
    return await Promise.all(
      searchResults.map(res => res.jobId).map(this.details.bind(this))
    );
  }
}

async function main() {
  const demoApi = async () => {
    const cache = new Cache();
    const reedApi = new ReedApi(cache);
    const results = await reedApi.search({ keywords: "python" });
    console.log("results.length", results.length);

    const detailRes = await reedApi.details(39680634);
    console.log(detailRes);

    const jobDetails = await reedApi.detailsForAll(results);
    console.log(jobDetails.length);
    console.log(jobDetails[99]);
  };
  const demoCache = async () => {
    const cache = new Cache();
    console.log(cache.has({ this: "is", a: 4, test: true }));
  };
  await demoApi();
}

main().catch(e => console.log(e));
