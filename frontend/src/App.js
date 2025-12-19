import React, { useState, useEffect} from "react";
import './App.css';

import { BrowserRouter as Router, Routes, Route, useParams, useLocation, Link } from "react-router-dom";

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
              <a 
                href="https://github.com/thekampany/atsameage" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ 
                  display: "flex", 
                  alignItems: "center",
                  color: theme === 'light' ? '#24292e' : '#f0f6fc'
                }}
                title="View on GitHub"
              >
                <svg 
                  height="20" 
                  width="20" 
                  viewBox="0 0 16 16" 
                  fill="currentColor"
                  style={{ display: "block" }}
                >
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                </svg>
              </a>
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