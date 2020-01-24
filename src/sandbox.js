import dotenv from "dotenv";
dotenv.config();
import axios from "axios";

import querystring from "querystring";

export const removeAllNulls = obj => {
  return Object.keys(obj)
    .filter(key => obj[key] !== null)
    .reduce((objWithoutNulls, nonNullKeyFromObj) => {
      objWithoutNulls[nonNullKeyFromObj] = obj[nonNullKeyFromObj];
      return objWithoutNulls;
    }, {});
};

class ReedApi {
  constructor() {
    const reedApiKey = process.env.REED_API_KEY;
    const reedApiVersion = "1.0";

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
      const resp = await this.axiosReedApi.get(
        `/search?${querystring.stringify({
          ...searchParams,
          resultsToTake,
          resultsToSkip: alreadyFetched
        })}`
      );
      const { results, totalResults } = resp.data;
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

  async details(jobId) {
    const resp = await this.axiosReedApi.get(`/jobs/${jobId}`);
    return resp.data;
  }

  async detailsForAll(searchResults) {
    return await Promise.all(
      searchResults.map(res => res.jobId).map(this.details.bind(this))
    );
  }
}

async function main() {
  const reedApi = new ReedApi();
  const results = await reedApi.search({ keywords: "python" });
  console.log("results.length", results.length);

  const detailRes = await reedApi.details(39680634);
  console.log(detailRes);

  const jobDetails = await reedApi.detailsForAll(results);
  console.log(jobDetails.length);
  console.log(jobDetails[99]);
}

main().catch(e => console.log(e));
