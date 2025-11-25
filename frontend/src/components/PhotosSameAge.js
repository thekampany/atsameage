import React, { useEffect, useState } from "react";
import "./PhotosSameAgePage.css";

function PhotosSameAgePage({ ageMonths, people }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = `http://localhost:8018/api/photos/same_age/?age_months=${ageMonths}&people=${people}`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        setPhotos(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [ageMonths, people]);

  if (loading) return <p>Loading photos...</p>;
  if (!photos.length) return <p>No photos found for age {ageMonths} months.</p>;

  return (
<div>
  <h2>Photos at {ageMonths} months</h2>
  {photos.map((photo) => {
    const box = photo.person_face_box;
    const cropSize = 200;

    const boxWidth = box ? box.boundingBoxX2 - box.boundingBoxX1 : 1;
    const boxHeight = box ? box.boundingBoxY2 - box.boundingBoxY1 : 1;

    // Originele foto afmetingen
    const imgWidth = box ? box.imageWidth : 1;
    const imgHeight = box ? box.imageHeight : 1;

    // Schaal zodat face-box cropSize vult
    const scaleX = cropSize / boxWidth;
    const scaleY = cropSize / boxHeight;
    const scale = Math.min(scaleX, scaleY);

    // Centreer het middelpunt van de bounding box
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
              `http://localhost:8018/api/photos/proxy/${photo.source_id}/`,
              "_blank"
            )
          }
        >
          <img
            src={`http://localhost:8018/api/photos/proxy/${photo.source_id}/`}
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
