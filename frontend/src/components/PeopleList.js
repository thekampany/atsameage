import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function PeopleList() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState({});
  const [ageMonths, setAgeMonths] = useState(""); 
  const [ageYears, setAgeYears] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get("/people/");
        setPeople(res.data);

        const defaults = {};
        res.data.forEach(p => { defaults[p.id] = true; });
        setSelected(defaults);
      } catch (err) {
        console.error("Failed to fetch people", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function toggle(id) {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  }

  if (loading) return <div>Loading...</div>;

  const selectedIds = Object.keys(selected)
    .filter(id => selected[id])
    .join(",");

  function goToPhotos() {
  const totalMonths =
  (parseInt(ageYears || 0, 10) * 12) + parseInt(ageMonths || 0, 10);
  if (isNaN(totalMonths) || totalMonths <= 0) return;

  navigate(`/photos/same-age/${totalMonths}?people=${selectedIds}`);

  }
  return (
    <div>
      {people.map((person) => (
        <div key={person.id}>
          <label>
            <input
              type="checkbox"
              checked={selected[person.id] || false}
              onChange={() => toggle(person.id)}
            />
            &nbsp;
            {person.name} ({person.birth_date}) – {person.photo_count} photos between
            {person.oldest_age.years}y{person.oldest_age.months}m and {person.youngest_age.years}y{person.youngest_age.months}m
          </label>
        </div>
      ))}

    <div style={{ marginTop: "1rem" }}>
       <input type="number" placeholder="10" value={ageYears} 
       onChange={(e) => setAgeYears(e.target.value)} 
       style={{ width: "4rem", marginRight: "0.5rem" }} />Year&nbsp;&nbsp;
       <input type="number" placeholder="0" value={ageMonths} 
       onChange={(e) => setAgeMonths(e.target.value)} 
       style={{ width: "4rem", marginRight: "0.5rem" }} />Month(s)&nbsp;&nbsp;&nbsp;
       <button onClick={goToPhotos}> Show Pictures </button> 
       </div> 
    </div>
  );
}
