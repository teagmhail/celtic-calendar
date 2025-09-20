import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './App.css';
import { ControlsPanel } from './components/ControlsPanel.tsx';
import { FestivalTable } from './components/FestivalTable.tsx';
import { FestivalWheel } from './components/FestivalWheel.tsx';

function App() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { i18n, t } = useTranslation();
  const [includeSolarFestivals, setIncludeSolarFestivals] = useState(true);
  const [showWheel, setShowWheel] = useState(true);

  // Update document title on language or translation change
  useEffect(() => {
    document.title = t("title");
  }, [t, i18n.language]);

  return (
    <div className="app">
      <ControlsPanel
        year={year}
        setYear={setYear}
        includeSolarFestivals={includeSolarFestivals}
        setIncludeSolarFestivals={setIncludeSolarFestivals}
        showWheel={showWheel}
        setShowWheel={setShowWheel}
      />
      <div className="page-content">
        {showWheel ? (
          <div className="festival-wheel-container">
            <FestivalWheel
              year={year}
              includeFireFestivals={true}
              includeSolarFestivals={includeSolarFestivals}
            />
          </div>
        ) : (
          <FestivalTable
            year={year}
            includeFireFestivals={true} // Fire festivals are always included
            includeSolarFestivals={includeSolarFestivals}
          />
        )}
      </div>
    </div>
  );
}

export default App