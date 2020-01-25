import dotenv from "dotenv";
dotenv.config();
import axios from "axios";
const AXIOS_DEBUG = false;
import hash from "object-hash";
import { dirname } from "path";
import fs from "fs";
import _ from "lodash";

import querystring from "querystring";
import TimeDifference from "./timeDifference";

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
    if (!fs.existsSync(this.path)) {
      fs.mkdirSync(this.path);
    }
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
    if (process.env.REED_API_KEY === undefined) {
      throw new Error(
        "Do not forget to set 'REED_API_KEY' in a '.env' " +
          "file at the root of the project"
      );
    }
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
    nonMatchingKeywordsInDescription = [],
    maxAgeInDays
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

    const ageFilter = jobDetail => jobDetail.daysAgo <= maxAgeInDays;

    const addDaysAgoInfo = jobDetail => {
      const parseDate = dateString => {
        const [day, month, year] = dateString.split("/");
        return new Date(year, month - 1, day);
      };
      const datePosted = parseDate(jobDetail.datePosted);
      const diff = new TimeDifference(datePosted);
      return { ...jobDetail, daysAgo: diff.daysAgo };
    };

    const jobDetails = await this.reedApi.detailsForAll(
      await this.reedApi.search({ keywords })
    );
    const sortByAge = (a, b) => a.daysAgo - b.daysAgo;

    const jobDetailsMatching = jobDetails
      .filter(descriptionFilter)
      .map(addDaysAgoInfo)
      .filter(ageFilter);
    jobDetailsMatching.sort(sortByAge);

    return jobDetailsMatching;
  }

  async logNumOfContracts(
    {
      keywords,
      matchingKeywordsInDescription = [],
      nonMatchingKeywordsInDescription = [],
      maxAgeInDays
    },
    logUrls = false
  ) {
    const matching = await this.contractsMatching({
      keywords,
      matchingKeywordsInDescription,
      nonMatchingKeywordsInDescription,
      maxAgeInDays
    });

    console.log(
      `K: '${keywords}' ` +
        `M: '${matchingKeywordsInDescription.join(" ")}' ` +
        `nM: '${nonMatchingKeywordsInDescription.join(" ")}' ` +
        `D: ${maxAgeInDays} ` +
        `==> ${matching.length}`
    );
    if (logUrls)
      matching
        .map(contract => ({ url: contract.jobUrl, daysAgo: contract.daysAgo }))
        .forEach(({ url, daysAgo }) =>
          console.log(`${url} - ${daysAgo} Days ago`)
        );

    console.log("");
  }
}

const QueryFactory = marketCrawler => keywords => {
  let matchingKeywordsInDescription = [];
  let nonMatchingKeywordsInDescription = [];
  let maxAgeInDays = 40;

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

    postedAtMost({ daysAgo }) {
      maxAgeInDays = daysAgo;
      return this;
    },

    async run({ logLinks = false } = {}) {
      await marketCrawler.logNumOfContracts(
        {
          keywords,
          matchingKeywordsInDescription,
          nonMatchingKeywordsInDescription,
          maxAgeInDays
        },
        logLinks
      );
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
    .postedAtMost({ daysAgo: 3 })
    .run();
  await newQuery("python")
    .withNoAI()
    .postedAtMost({ daysAgo: 7 })
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

  await newQuery("python")
    .withTdd()
    .postedAtMost({daysAgo: 3})
    .run({ logLinks: true });

  await newQuery("python")
    // .withTdd()
    .postedAtMost({daysAgo: 3})
    .run({ logLinks: true });


  await newQuery("react")
    // .withTdd()
    .postedAtMost({daysAgo: 3})
    .run({ logLinks: true });

  await newQuery("java")
    .withTdd()
    .postedAtMost({daysAgo: 3})
    .run({ logLinks: true });
}

main().catch(e => console.log(e));
