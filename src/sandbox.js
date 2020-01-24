import dotenv from "dotenv";
dotenv.config();
import axios from "axios";

import querystring from "querystring";

export function debugJestSum(a, b) {
  return a + b;
}

/*
search?keywords={keywords}&loc ationName={locationName}&employerId={employerId}&distanceFromLocation={distance in miles}
*/

// reedApi
//   .get("/search", querystring.stringify({ keywords: "python" }))
//   // .get(
//   //   "/search?keywords=accountant&location=london&employerid=123&distancefromlocation=15"
//   // )
//   .then(resp => console.log(resp.data))
//   .catch(error => console.log(error));
// console.log(process.env.YO);

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
    postedByDirectEmployer = null,
    resultsToTake = 100,
    resultsToSkip = 0
  }) {
    const params = removeAllNulls({
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
      postedByDirectEmployer,
      resultsToTake,
      resultsToSkip
    });
    const resp = await this.axiosReedApi.get(
      `/search?${querystring.stringify(params)}`
    );
    const searchRes = resp.data;

    if (searchRes.totalResults >= 500)
      throw new Error("Too many results (>= 500)");

    return searchRes;
  }

  async details(jobId) {
    const resp = await this.axiosReedApi.get(`/jobs/${jobId}`);
    return resp.data;
  }
}

async function main() {
  const reedApi = new ReedApi();
  const searchRes = await reedApi.search({ keywords: "python" });
  const results = searchRes.results;

  const jobDetails = await Promise.all(
    results.map(res => reedApi.details(res.jobId))
  );

  console.log(Object.keys(searchRes));
  console.log(searchRes.totalResults);
  console.log(searchRes.results.length);
  console.log(searchRes.results[99]);

  const detailRes = await reedApi.details(39680634);
  console.log(detailRes);

  const yo = searchRes.results[3];
  const yoDetails = jobDetails[3];

  console.log(jobDetails.length);
  console.log(jobDetails[99]);
}

main().catch(e => console.log(e));
// const axios = axios
