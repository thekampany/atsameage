import React, { useEffect, useState } from "react";
import axios from "axios";

export default function SameAgeLane() {
  const [people, setPeople] = useState([]);
  const [visibleMonths, setVisibleMonths] = useState([]);
  const [allMonths, setAllMonths] = useState([]);

    useEffect(() => {
    axios.get("http://localhost:8018/api/sameagelane/")
        .then(res => {
        const data = res.data;

        const youngest = data
            .filter(p => p.birth_date)
            .sort((a, b) => new Date(b.birth_date) - new Date(a.birth_date))[0];

        if (!youngest) {
            setPeople(data);
            return;
        }

        const monthsYoungest = youngest.agelane
            .map(p => p.age_in_months)
            .sort((a, b) => b - a); 

        let monthsSet = new Set();
        data.forEach(person => {
            person.agelane.forEach(photo => monthsSet.add(photo.age_in_months));
        });

        const sortedAllMonths = Array.from(monthsSet).sort((a, b) => b - a);
        setAllMonths(sortedAllMonths);

        const initial = monthsYoungest.slice(0, 4);
        setVisibleMonths(initial);

        setPeople(data);
        });
    }, []);

  const handleShiftLeft = () => {
    const newVisible = visibleMonths.map(m => {
      const next = m + 1;
      return next <= Math.max(...allMonths) ? next : m;
    });
    setVisibleMonths(newVisible);
  };

  const handleShiftRight = () => {
    const newVisible = visibleMonths.map(m => {
      const prev = m - 1;
      return prev >= Math.min(...allMonths) ? prev : m;
    });
    setVisibleMonths(newVisible);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Same Age Lane</h2>

      <div style={{
        display: "flex",
        flexDirection: "row",
        position: "relative",
        marginTop: "30px"
      }}>
        
        <div
          onClick={handleShiftLeft}
          style={{
            width: "60px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            userSelect: "none",
            fontSize: "24px",
            opacity: 0.3
          }}
        >
          ◀
        </div>

        {/* PHOTO GRID */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {people.map(person => (
            <div key={person.person} style={{ display: "flex", flexDirection: "row", alignItems: "flex-start" }}>
              
              <div style={{ display: "flex", flexDirection: "row", gap: "10px" }}>
                {visibleMonths.map(month => {
                  const photoObj = person.agelane.find(p => p.age_in_months === month);
                  return (
                    <div key={month} style={{ display: "flex", flexDirection: "column" }}>
                      {photoObj ? (
                        <img
                          src={`http://localhost:8018/api/photos/proxy/${photoObj.photo.id}/`}
                          alt={`Month ${month}`}
                          style={{
                            width: "100px",
                            height: "100px",
                            objectFit: "cover",
                            border: "1px solid #ccc",
                            borderRadius: "4px"
                          }}
                        />
                      ) : (
                        <div style={{
                          width: "100px",
                          height: "100px",
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
            </div>
          ))}
        </div>

        <div
          onClick={handleShiftRight}
          style={{
            width: "60px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            userSelect: "none",
            fontSize: "24px",
            opacity: 0.3
          }}
        >
          ▶
        </div>
      </div>
    </div>
  );
}
