import React, { useState, useEffect} from "react";
import './App.css';

import { BrowserRouter as Router, Routes, Route, useParams, useLocation, Link } from "react-router-dom";

import PeopleList from "./components/PeopleList";
import PhotosSameAgePage from "./components/PhotosSameAge";
import TasksPage from "./components/TaskList";
import SameAgeLane from "./components/SameAgeLane";
import PeopleSameAgeLane from "./components/PeopleSameAgeLane";
import SlideShow from "./components/SlideShow";
import ThemeContext from './components/ThemeContext';

function PhotosSameAgeWrapper() {
  const { ageMonths } = useParams();
  const query = new URLSearchParams(useLocation().search);
  const people = query.get("people"); // "1,2,7"

  return (
    <PhotosSameAgePage
      ageMonths={parseInt(ageMonths)}
      people={people}
    />
  );
}


function App() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <Router>
        <div className={`App ${theme}`}>
          {/* HEADER */}
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 20px",
              borderBottom: "1px solid #ddd",
              position: "sticky",
              top: 0,
              zIndex: 1000
            }}
          >
            <h1 style={{ margin: 0 }}>AtSameAge</h1>
            <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
              <nav style={{ display: "flex", gap: "15px" }}>
                <Link to="/">Home</Link>
                <Link to="/tasks">Ingestions</Link>
                <Link to="/slideshow">Slideshow</Link>
              </nav>
              <button className="as-link" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
                Light/Dark
              </button>
            </div>
          </header>

          {/* ROUTES */}
          <main style={{ padding: "0px" }}>
            <Routes>
              <Route path="/" element={<PeopleSameAgeLane />} />
              <Route 
                path="/photos/same-age/:ageMonths"
                element={<PhotosSameAgeWrapper />}
              />
              <Route path="/sameagelane" element={<SameAgeLane />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/slideshow" element={<SlideShow />} />
            </Routes>
          </main>
        </div>
      </Router>
    </ThemeContext.Provider>
  );
}

export default App;