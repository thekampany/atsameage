import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function PeopleSameAgeLane() {
  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8018/api";

  const [people, setPeople] = useState([]);
  const [laneData, setLaneData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState({});
  const [ageYears, setAgeYears] = useState(0);
  const [ageMonths, setAgeMonths] = useState(0);

  const [allMonths, setAllMonths] = useState([]);
  const [visibleMonths, setVisibleMonths] = useState([]);
  const laneRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem('selectedPeople', JSON.stringify(selected));
  }, [selected]);

  useEffect(() => {
    async function load() {
      try {
        const [peopleRes, laneRes] = await Promise.all([
          api.get("/people/"),
          api.get("/sameagelane/")
        ]);

        setPeople(peopleRes.data);
        setLaneData(laneRes.data);

        // Initially everything checked
        const defaults = {};
        peopleRes.data.forEach(p => { defaults[p.id] = true; });
        setSelected(defaults);

        // collect all months
        const allSet = new Set();
        laneRes.data.forEach(person => {
          person.agelane.forEach(p => allSet.add(p.age_in_months));
        });
        const sortedMonths = Array.from(allSet).sort((a, b) => a - b);
        setAllMonths(sortedMonths);

        // Calculate age youngest person
        if (laneRes.data.length > 0) {
          const today = new Date();
          let youngest = laneRes.data[0];
          laneRes.data.forEach(p => {
            if (new Date(p.birth_date) > new Date(youngest.birth_date)) youngest = p;
          });
          const birth = new Date(youngest.birth_date);
          let years = today.getFullYear() - birth.getFullYear();
          let months = today.getMonth() - birth.getMonth();
          if (months < 0) {
            years -= 1;
            months += 12;
          }
          setAgeYears(years);
          setAgeMonths(months);

          const youngestMonths = youngest.agelane
            .map(p => p.age_in_months)
            .sort((a, b) => b - a)
            .slice(0, 4);
          setVisibleMonths(youngestMonths);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const toggle = (id) => {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const goToPhotos = () => {
    const totalMonths = parseInt(ageYears || 0, 10) * 12 + parseInt(ageMonths || 0, 10);
    if (isNaN(totalMonths) || totalMonths <= 0) return;

    const selectedIds = Object.keys(selected)
      .filter(id => selected[id])
      .join(",");

    navigate(`/photos/same-age/${totalMonths}?people=${selectedIds}`);
  };

  const handleShiftRight = () => {
    if (visibleMonths.length === 0) return;
    const maxMonth = Math.max(...allMonths);
    setVisibleMonths(prev => prev.map(m => (m + 1 <= maxMonth ? m + 1 : m)));
  };

  const handleShiftLeft = () => {
    if (visibleMonths.length === 0) return;
    const minMonth = Math.min(...allMonths);
    setVisibleMonths(prev => prev.map(m => (m - 1 >= minMonth ? m - 1 : m)));
  };

  if (loading) return <div>Loading...</div>;

  const displayedLane = laneData.filter(p => selected[p.person_id]);

  return (
    <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "2rem" }}>
      
        <div style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "flex-start",
        padding: "10px",
        gap: "10px"
        }}>
        {/* People list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: "1 1 250px", padding: "10px", flexWrap: "wrap",border: "1px solid #ccc", borderRadius: "8px" }}>
            {people.map(p => (
            <div key={p.id}>
                <label>
                <input
                    type="checkbox"
                    checked={selected[p.id] || false}
                    onChange={() => toggle(p.id)}
                />
                &nbsp;{p.name} ({p.birth_date})&nbsp; 
                <span className="person-info">
                    {p.photo_count} photos {Math.max(0, p.oldest_age.years)}y{Math.max(0, p.oldest_age.months)}m {Math.max(0, p.youngest_age.years)}y{Math.max(0, p.youngest_age.months)}m
                </span>
                </label>
            </div>            ))}
        </div>

        {/* Age inputs + button */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: "1 1 200px", padding: "10px", flexWrap: "wrap",border: "1px solid #ccc", borderRadius: "8px"}}>
            <input
            type="number"
            value={ageYears}
            onChange={(e) => setAgeYears(parseInt(e.target.value || 0, 10))}
            placeholder="0"
            style={{
                width: "4rem",
                padding: "5px",
                width: "5ch",
                border: "1px solid #ccc",
                borderRadius: "4px",
                textAlign: "right"
            }}
            />
            <span>Year</span>

            <input
            type="number"
            value={ageMonths}
            onChange={(e) => setAgeMonths(parseInt(e.target.value || 0, 10))}
            placeholder="0"
            style={{
                width: "4rem",
                width: "5ch",
                padding: "5px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                textAlign: "right"
            }}
            />
            <span>Month(s)</span>

            <button
            onClick={goToPhotos}
            style={{
                padding: "5px 10px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                cursor: "pointer"
            }}
            >
            Show Pictures
            </button>
        </div>
        </div>

      {/* SAME AGE LANE */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          onClick={handleShiftRight}
          style={{
            cursor: "pointer",
            userSelect: "none",
            fontSize: "24px",
            opacity: 0.5
          }}
        >◀</div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px", flex: 1 }}>
          {displayedLane.map(person => (
            <div key={person.person} style={{ display: "flex", flexDirection: "row", gap: "10px" }}>
              {visibleMonths.map(month => {
                const photoObj = person.agelane.find(p => p.age_in_months === month);
                return (
                  <div key={month} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    {photoObj ? (
                      <img
                        src={`${API_URL}/photos/proxy/${photoObj.photo.source_id}/`}
                        alt={`Month ${month}`}
                        style={{
                          width: "150px",
                          height: "150px",
                          objectFit: "cover",
                          border: "1px solid #ccc",
                          borderRadius: "4px"
                        }}
                      />
                    ) : (
                      <div style={{
                        width: "150px",
                        height: "150px",
                        background: "#eee",
                        border: "1px solid #ccc",
                        borderRadius: "4px"
                      }} />
                    )}
                    <div style={{ textAlign: "center", fontSize: "12px" }}>{month} mo</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div
          onClick={handleShiftLeft}
          style={{
            cursor: "pointer",
            userSelect: "none",
            fontSize: "24px",
            opacity: 0.5
          }}
        >▶</div>
      </div>
    </div>
  );
}
