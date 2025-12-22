import React, { useEffect, useState } from "react";
import "./PhotosSameAgePage.css";

function PhotosSameAgePage({ ageMonths, people }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8018/api";

  useEffect(() => {
    const url = `${API_URL}/photos/same_age/?age_months=${ageMonths}&people=${people}`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        setPhotos(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [ageMonths, people]);

  if (loading) return <div style={{ padding: "20px" }}>Loading...</div>;
  if (!photos.length) return <div style={{ padding: "20px" }}>No photos found for age {ageMonths} months.</div>;

  return (
<div style={{ padding: "20px" }}>
  <h2>Photos at {ageMonths} months</h2>
  {photos.map((photo) => {
    const box = photo.person_face_box;
    const cropSize = 200;

    const boxWidth = box ? box.boundingBoxX2 - box.boundingBoxX1 : 1;
    const boxHeight = box ? box.boundingBoxY2 - box.boundingBoxY1 : 1;

    const imgWidth = box ? box.imageWidth : 1;
    const imgHeight = box ? box.imageHeight : 1;

    const scaleX = cropSize / boxWidth;
    const scaleY = cropSize / boxHeight;
    const scale = Math.min(scaleX, scaleY);

    const boxCenterX = box ? box.boundingBoxX1 + boxWidth / 2 : 0;
    const boxCenterY = box ? box.boundingBoxY1 + boxHeight / 2 : 0;
    const targetX = cropSize / 2;
    const targetY = cropSize / 2;

    const offsetX = box ? targetX / scale - boxCenterX : 0;
    const offsetY = box ? targetY / scale - boxCenterY : 0;

    return (
      <div key={photo.id} style={{ marginBottom: "1rem" }}>
        <div
          style={{
            width: `${cropSize}px`,
            height: `${cropSize}px`,
            overflow: "hidden",
            display: "inline-block",
            borderRadius: "8px",
            border: "1px solid #ccc",
            cursor: "pointer",
          }}
          onClick={() =>
            window.open(
              `${API_URL}/photos/proxy/${photo.id}/`,
              "_blank"
            )
          }
        >
          <img
            src={`${API_URL}/photos/proxy/${photo.id}/`}
            alt={photo.person_name || "Person"}
            style={{
              display: "block",
              width: `${imgWidth}px`, 
              height: `${imgHeight}px`, 
              transform: `scale(${scale}) translate(${offsetX}px, ${offsetY}px)`,
              transformOrigin: "top left",
              transition: "transform 0.5s ease",
            }}
            className="photo-crop"
          />
        </div>
        <p>
          {photo.person_name}  {photo.age_formatted} on {photo.photo_date}
        </p>
      </div>
    );
  })}
</div>
  );
}

export default PhotosSameAgePage;
