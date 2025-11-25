// frontend/src/api.js
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

const api = axios.create({
  baseURL: API_URL,
});

export default api;


export async function fetchPhotosSameAge(ageMonths, delta = 1) {
  const res = await fetch(
    `/api/photos/same_age/?age_months=${ageMonths}&delta=${delta}`
  );
  if (!res.ok) {
    throw new Error("Failed to fetch photos at same age");
  }
  return await res.json();
}


async function fetchTasks() {
  const res = await fetch("/api/tasks/");
  const data = await res.json();
  setTasks(data);
}
async function runTask(name) {
  await fetch(`/api/tasks/run/${name}/`, {
    method: "POST"
  });
}
