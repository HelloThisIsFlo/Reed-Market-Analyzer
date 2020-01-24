import dotenv from "dotenv";
dotenv.config();
import axios from "axios";
const AXIOS_DEBUG = false;
import hash from "object-hash";
import { dirname } from "path";
import fs from "fs";
import _ from "lodash";

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
      if (AXIOS_DEBUG) {
        console.log("Starting Request", request.url);
      }
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

class MarketCrawler {
  constructor(reedApi) {
    this.reedApi = reedApi;
  }

  async contractsMatching({
    keywords,
    matchingKeywordsInDescription = [],
    nonMatchingKeywordsInDescription = []
  }) {
    const lowerCase = wordList => wordList.map(word => word.toLowerCase());
    matchingKeywordsInDescription = lowerCase(matchingKeywordsInDescription);
    nonMatchingKeywordsInDescription = lowerCase(
      nonMatchingKeywordsInDescription
    );
    const descriptionFilter = jobDetail => {
      const description = jobDetail.jobDescription.toLowerCase();
      let isMatching = true;
      for (let expectedKeyword of matchingKeywordsInDescription) {
        if (!description.includes(expectedKeyword)) {
          isMatching = false;
        }
      }
      for (let unexpectedKeyword of nonMatchingKeywordsInDescription) {
        if (description.includes(unexpectedKeyword)) {
          isMatching = false;
        }
      }
      return isMatching;
    };

    const jobDetails = await this.reedApi.detailsForAll(
      await this.reedApi.search({ keywords })
    );

    return jobDetails.filter(descriptionFilter);
  }

  async logNumOfContracts(
    {
      keywords,
      matchingKeywordsInDescription = [],
      nonMatchingKeywordsInDescription = []
    },
    logUrls = false
  ) {
    const matching = await this.contractsMatching({
      keywords,
      matchingKeywordsInDescription,
      nonMatchingKeywordsInDescription
    });

    console.log(
      `K: '${keywords}' ` +
        `M: '${matchingKeywordsInDescription.join(" ")}' ` +
        `nM: '${nonMatchingKeywordsInDescription.join(" ")}' ` +
        `==> ${matching.length}`
    );
    if (logUrls)
      matching.map(contract => contract.jobUrl).forEach(id => console.log(id));

    console.log("");
  }
}

const QueryFactory = marketCrawler => keywords => {
  let matchingKeywordsInDescription = [];
  let nonMatchingKeywordsInDescription = [];

  return {
    withTdd() {
      matchingKeywordsInDescription.push("tdd");
      return this;
    },

    withNoAI() {
      nonMatchingKeywordsInDescription.push("ai");
      nonMatchingKeywordsInDescription.push("machine");
      return this;
    },

    async run() {
      await marketCrawler.logNumOfContracts({
        keywords,
        matchingKeywordsInDescription,
        nonMatchingKeywordsInDescription
      });
    }
  };
};

async function main() {
  const cache = new Cache();
  const reedApi = new ReedApi(cache);
  const marketCrawler = new MarketCrawler(reedApi);
  const newQuery = QueryFactory(marketCrawler);

  await newQuery("react")
    .withTdd()
    .run();
  await newQuery("python")
    .withTdd()
    .withNoAI()
    .run();
  await newQuery("python")
    .withNoAI()
    .run();
  await newQuery("java")
    .withTdd()
    .withNoAI()
    .run();
  await newQuery("java")
    .withNoAI()
    .run();
  await newQuery("elixir").run();
}

main().catch(e => console.log(e));
