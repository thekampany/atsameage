import React, { useState, useEffect } from 'react';
import api from "../api";

export default function SlideShow() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [validMonths, setValidMonths] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        let peopleParam = '';
 
        const saved = localStorage.getItem('selectedPeople');
        if (saved) {
          const selected = JSON.parse(saved);
          const ids = Object.keys(selected).filter(id => selected[id]).join(',');
          const peopleParam = ids;
        }

        const url = peopleParam 
          ? `/sameagelane/?people=${peopleParam}`
          : `/sameagelane/`;
        
        const res = await api.get(url);
        setData(res.data);
        
        if (res.data.length > 0) {
          const months = findValidMonths(res.data);
          setValidMonths(months);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const findValidMonths = (persons) => {
    if (persons.length === 0) return [];
    
    const personMonths = persons.map(person => 
      new Set(person.agelane.map(entry => entry.age_in_months))
    );
    
    const maxMonth = Math.max(
      ...persons.flatMap(p => p.agelane.map(e => e.age_in_months))
    );
    
    const valid = [];
    for (let month = 0; month <= maxMonth; month++) {
      if (personMonths.every(set => set.has(month))) {
        valid.push(month);
      }
    }
    
    return valid;
  };

  const getPhotosForMonth = (month) => {
    return data.map(person => {
      const entry = person.agelane.find(e => e.age_in_months === month);
      return {
        person: person.person,
        photo: entry?.photo,
        personId: person.person_id
      };
    }).filter(item => item.photo);
  };

  useEffect(() => {
    if (isPaused || validMonths.length === 0) return;
    
    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % validMonths.length);
    }, 5000);
    
    return () => clearInterval(timer);
  }, [isPaused, validMonths.length]);

  useEffect(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }, []);

  const goToPrevious = () => {
    setCurrentIndex(prev => 
      prev === 0 ? validMonths.length - 1 : prev - 1
    );
  };

  const goToNext = () => {
    setCurrentIndex(prev => (prev + 1) % validMonths.length);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#111827' }}>
        <div style={{ color: 'white', fontSize: '20px' }}>Loading...</div>
      </div>
    );
  }

  if (validMonths.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#111827' }}>
        <div style={{ color: 'white', fontSize: '20px' }}>
          No months found where all persons have a photo
        </div>
      </div>
    );
  }

  const currentMonth = validMonths[currentIndex];
  const currentPhotos = getPhotosForMonth(currentMonth);
  const years = Math.floor(currentMonth / 12);
  const months = currentMonth % 12;

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw', backgroundColor: 'black', overflow: 'hidden' }}>
      {/* photo grid */}
      <div style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexWrap: currentPhotos.length > 3 ? 'wrap' : 'nowrap'
      }}>
        {currentPhotos.map((item, idx) => (
          <div 
            key={`${item.personId}-${currentMonth}-${idx}`} 
            style={{
              position: 'relative',
              overflow: 'hidden',
              backgroundColor: '#1f2937',
              flex: currentPhotos.length <= 3 ? '1 1 0' : '1 1 50%',
              minWidth: 0,
              minHeight: 0
            }}
          >
            <img
              src={`http://localhost:8018/api/photos/proxy/${item.photo.source_id}/`}
              alt={`${item.person} - ${currentMonth} maanden`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
              padding: '16px'
            }}>
              <p style={{ color: 'white', fontWeight: '600', fontSize: '18px' }}>{item.person}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        position: 'absolute',
        top: '60px',
        left: '16px',
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '12px 24px',
        borderRadius: '8px',
        fontSize: '24px',
        fontWeight: 'bold'
      }}>
        {years > 0 && `${years} jaar `}
        {months > 0 && `${months} ${months === 1 ? 'maand' : 'maanden'}`}
        {years === 0 && months === 0 && 'Geboorte'}
      </div>

      {/* Controls */}
      <div style={{
        position: 'absolute',
        bottom: '60px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: '12px 24px',
        borderRadius: '9999px'
      }}>
        <button
          onClick={goToPrevious}
          style={{
            color: 'white',
            fontSize: '28px',
            padding: '0 8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
          aria-label="Vorige"
        >
          ‹
        </button>
        
        <button
          onClick={() => setIsPaused(!isPaused)}
          style={{
            color: 'white',
            fontSize: '20px',
            padding: '0 8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
          aria-label={isPaused ? 'Afspelen' : 'Pauzeren'}
        >
          {isPaused ? '▶' : '⏸'}
        </button>
        
        <button
          onClick={goToNext}
          style={{
            color: 'white',
            fontSize: '28px',
            padding: '0 8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
          aria-label="Volgende"
        >
          ›
        </button>
        
        <span style={{ color: 'white', marginLeft: '8px' }}>
          {currentIndex + 1} / {validMonths.length}
        </span>
      </div>

      {/* Progress bar */}
      {!isPaused && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '4px',
          backgroundColor: '#1f2937'
        }}>
          <div 
            style={{
              height: '100%',
              backgroundColor: '#3b82f6',
              transition: 'all 0.1s',
              width: `${((currentIndex + 1) / validMonths.length) * 100}%`
            }}
          />
        </div>
      )}
    </div>
  );
}