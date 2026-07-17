"use client";

import {
  ArrowLeft, CalendarDays, Camera, Check, ChevronDown, Compass, Filter,
  Heart, ListFilter, Map as MapIcon, MapPin, Plus, Search, SlidersHorizontal,
  Sparkles, Star, Trophy, UserRound, X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type City = {
  id: number; name: string; country: string; continent: string; lat: number; lng: number;
  rating: number; category: string; date: string; note: string; emoji: string;
};

type CityOption = {
  name: string; ascii?: string; country: string; continent: string;
  lat: number; lng: number; emoji: string; population?: number;
};

const starterCities: City[] = [
  { id: 1, name: "Lisbon", country: "Portugal", continent: "Europe", lat: 38.72, lng: -9.14, rating: 5, category: "Food", date: "May 2025", note: "Golden evenings, tiled streets and the best small plates.", emoji: "🇵🇹" },
  { id: 2, name: "Kyoto", country: "Japan", continent: "Asia", lat: 35.01, lng: 135.77, rating: 5, category: "Culture", date: "Oct 2024", note: "Quiet gardens before breakfast. A city that rewards slowing down.", emoji: "🇯🇵" },
  { id: 3, name: "Cape Town", country: "South Africa", continent: "Africa", lat: -33.93, lng: 18.42, rating: 4, category: "Nature", date: "Feb 2025", note: "Mountains, ocean and long lunches.", emoji: "🇿🇦" },
  { id: 4, name: "New York", country: "United States", continent: "North America", lat: 40.71, lng: -74.01, rating: 4, category: "Culture", date: "Sep 2023", note: "Endless energy. Walked everywhere.", emoji: "🇺🇸" },
  { id: 5, name: "Marrakech", country: "Morocco", continent: "Africa", lat: 31.63, lng: -8.0, rating: 3, category: "Food", date: "Mar 2024", note: "Intense, colourful and unforgettable.", emoji: "🇲🇦" },
  { id: 6, name: "Reykjavík", country: "Iceland", continent: "Europe", lat: 64.15, lng: -21.94, rating: 4, category: "Nature", date: "Jan 2023", note: "Small city, enormous landscapes.", emoji: "🇮🇸" }
];

const suggestions: CityOption[] = [
  { name: "Barcelona", country: "Spain", continent: "Europe", lat: 41.39, lng: 2.17, emoji: "🇪🇸" },
  { name: "Buenos Aires", country: "Argentina", continent: "South America", lat: -34.6, lng: -58.38, emoji: "🇦🇷" },
  { name: "Copenhagen", country: "Denmark", continent: "Europe", lat: 55.68, lng: 12.57, emoji: "🇩🇰" },
  { name: "Melbourne", country: "Australia", continent: "Oceania", lat: -37.81, lng: 144.96, emoji: "🇦🇺" },
  { name: "Seoul", country: "South Korea", continent: "Asia", lat: 37.57, lng: 126.98, emoji: "🇰🇷" }
];

const colors = ["", "#D66055", "#E58D52", "#D6B44D", "#81AA66", "#3E9367"];
const categories = ["Overall", "Food", "Culture", "Nature", "Nightlife"];
const normalizeSearch = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const countryFlag = (code: string) => code.length === 2
  ? String.fromCodePoint(...code.toUpperCase().split("").map(char => 127397 + char.charCodeAt(0)))
  : "🌍";

function InteractiveMap({
  cities,
  selected,
  onSelect
}: {
  cities: City[];
  selected: City | null;
  onSelect: (city: City) => void;
}) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<import("leaflet").Map | null>(null);
  const markerLayer = useRef<import("leaflet").LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function createMap() {
      if (!mapElement.current || mapInstance.current) return;
      const L = await import("leaflet");
      if (cancelled || !mapElement.current) return;

      const map = L.map(mapElement.current, {
        center: [22, 8],
        zoom: 2,
        minZoom: 2,
        maxZoom: 18,
        zoomControl: false,
        worldCopyJump: true,
        preferCanvas: true
      });

      L.control.zoom({ position: "topright" }).addTo(map);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);

      const layer = L.layerGroup().addTo(map);
      mapInstance.current = map;
      markerLayer.current = layer;

      const updateZoomDetail = () => {
        if (mapElement.current) {
          mapElement.current.dataset.cityZoom = map.getZoom() >= 5 ? "true" : "false";
        }
      };
      map.on("zoomend", updateZoomDetail);
      updateZoomDetail();
    }

    createMap();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function drawMarkers() {
      const map = mapInstance.current;
      const layer = markerLayer.current;
      if (!map || !layer) {
        window.setTimeout(drawMarkers, 40);
        return;
      }

      const L = await import("leaflet");
      if (cancelled) return;
      layer.clearLayers();

      cities.forEach(city => {
        const isSelected = selected?.id === city.id;
        const icon = L.divIcon({
          className: "city-div-icon",
          html: `<div class="city-map-marker${isSelected ? " is-selected" : ""}" style="--marker-color:${colors[city.rating]}">
            <span class="city-marker-label">${city.name}</span>
          </div>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19]
        });

        const marker = L.marker([city.lat, city.lng], {
          icon,
          title: `${city.name}, ${city.rating} stars`,
          riseOnHover: true
        }).addTo(layer);

        marker.bindTooltip(
          `<strong>${city.name}</strong><br>${city.country} · ${city.rating}/5`,
          { direction: "top", offset: [0, -18], className: "city-tooltip" }
        );
        marker.on("click", () => {
          onSelect(city);
          if (map.getZoom() < 6) map.flyTo([city.lat, city.lng], 6, { duration: 0.8 });
        });
      });
    }

    drawMarkers();
    return () => { cancelled = true; };
  }, [cities, selected, onSelect]);

  useEffect(() => () => {
    mapInstance.current?.remove();
    mapInstance.current = null;
  }, []);

  return <div ref={mapElement} className="leaflet-map" aria-label="Interactive map of your rated cities" />;
}

export default function CityLogger() {
  const [tab, setTab] = useState<"map" | "rankings" | "profile">("map");
  const [cities, setCities] = useState(starterCities);
  const [selected, setSelected] = useState<City | null>(starterCities[0]);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [candidate, setCandidate] = useState<CityOption | null>(null);
  const [searchResults, setSearchResults] = useState<CityOption[]>(suggestions);
  const [searching, setSearching] = useState(false);
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("Overall");
  const [filterOpen, setFilterOpen] = useState(false);
  const [continent, setContinent] = useState("All");

  const filtered = useMemo(() =>
    cities.filter(c => (continent === "All" || c.continent === continent) &&
      (category === "Overall" || c.category === category)), [cities, continent, category]);

  const ranked = useMemo(() => [...filtered].sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name)), [filtered]);

  useEffect(() => {
    const needle = normalizeSearch(query.trim());
    if (needle.length < 2) {
      setSearchResults(suggestions);
      setSearching(false);
      return;
    }

    const prefix = needle.replace(/[^a-z0-9]/g, "").slice(0, 2) || "__";
    const controller = new AbortController();
    setSearching(true);

    fetch(`/cities/${prefix}.json`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : [])
      .then((records: [string, string, string, string, number, number, number, string][]) => {
        const matches = records
          .filter(record =>
            normalizeSearch(record[0]).includes(needle) ||
            normalizeSearch(record[1]).includes(needle) ||
            normalizeSearch(record[2]).includes(needle)
          )
          .slice(0, 12)
          .map(record => ({
            name: record[0],
            ascii: record[1],
            country: record[2],
            continent: record[3],
            lat: record[4],
            lng: record[5],
            population: record[6],
            emoji: countryFlag(record[7])
          }));
        setSearchResults(matches);
      })
      .catch(error => {
        if (error.name !== "AbortError") setSearchResults([]);
      })
      .finally(() => setSearching(false));

    return () => controller.abort();
  }, [query]);

  function beginAdd(city: CityOption) {
    setCandidate(city); setQuery(city.name); setRating(0); setNote("");
  }

  function saveCity() {
    if (!candidate || !rating) return;
    const newCity: City = {
      ...candidate, id: Date.now(), rating,
      category: category === "Overall" ? "Culture" : category,
      date: "Jul 2026", note: note || "A new city in my travel story."
    };
    setCities(prev => [newCity, ...prev]);
    setSelected(newCity); setAdding(false); setCandidate(null); setQuery(""); setTab("map");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><MapPin size={18}/></span><span>citylogger</span></div>
        <nav className="desktop-nav" aria-label="Primary">
          <button className={tab === "map" ? "active" : ""} onClick={() => setTab("map")}><MapIcon/>Map</button>
          <button className={tab === "rankings" ? "active" : ""} onClick={() => setTab("rankings")}><Trophy/>Rankings</button>
          <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}><UserRound/>Profile</button>
        </nav>
        <div className="sidebar-card">
          <span className="eyebrow">YOUR JOURNEY</span>
          <strong>{cities.length} cities</strong>
          <p>across {new Set(cities.map(c => c.country)).size} countries</p>
          <div className="progress"><span style={{ width: "38%" }}/></div>
          <small>38% of your 2026 goal</small>
        </div>
        <div className="avatar-row"><span className="avatar">AM</span><span><strong>Alex Morgan</strong><small>Traveller since 2019</small></span></div>
      </aside>

      <section className="main-pane">
        <header className="topbar">
          <div>
            <p className="kicker">{tab === "map" ? "YOUR TRAVEL MAP" : tab === "rankings" ? "YOUR FAVOURITES" : "YOUR JOURNEY"}</p>
            <h1>{tab === "map" ? "The world, according to you." : tab === "rankings" ? "Cities worth returning to." : "A life well travelled."}</h1>
          </div>
          <button className="primary-btn" onClick={() => setAdding(true)}><Plus/>Log a city</button>
        </header>

        {tab === "map" && (
          <>
            <div className="control-row">
              <div className="segmented">
                {categories.map(item => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}
              </div>
              <button className="filter-btn" onClick={() => setFilterOpen(!filterOpen)}><SlidersHorizontal/>Filters{continent !== "All" && <span className="filter-dot"/>}</button>
              {filterOpen && <div className="filter-popover">
                <label>Continent</label>
                <select value={continent} onChange={e => setContinent(e.target.value)}>
                  {["All", "Europe", "Asia", "Africa", "North America", "South America", "Oceania"].map(x => <option key={x}>{x}</option>)}
                </select>
              </div>}
            </div>

            <div className="map-card">
              <InteractiveMap cities={filtered} selected={selected} onSelect={setSelected}/>
              <div className="map-legend"><span>Not for me</span>{colors.slice(1).map(c => <i key={c} style={{ background: c }}/>) }<span>Loved it</span></div>
              {selected && filtered.some(c => c.id === selected.id) && (
                <article className="city-preview">
                  <button className="close-btn" onClick={() => setSelected(null)} aria-label="Close"><X/></button>
                  <div className="photo-block"><span>{selected.emoji}</span><small>{selected.country.toUpperCase()}</small></div>
                  <div className="preview-copy">
                    <p className="city-meta"><MapPin/>{selected.country} · {selected.date}</p>
                    <h2>{selected.name}</h2>
                    <div className="stars">{[1,2,3,4,5].map(n => <Star key={n} fill={n <= selected.rating ? colors[selected.rating] : "none"} color={n <= selected.rating ? colors[selected.rating] : "#c7c9c3"}/>)}</div>
                    <p>“{selected.note}”</p>
                    <button className="text-btn">View city story <span>→</span></button>
                  </div>
                </article>
              )}
            </div>
          </>
        )}

        {tab === "rankings" && (
          <div className="rankings-layout">
            <div className="rankings-head">
              <div className="segmented">{categories.map(item => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
              <button className="filter-btn"><ListFilter/>Sort: Highest rated <ChevronDown/></button>
            </div>
            <div className="ranking-list">
              {ranked.map((city, index) => (
                <button className="rank-row" key={city.id} onClick={() => { setSelected(city); setTab("map"); }}>
                  <span className={`rank-number ${index < 3 ? "top" : ""}`}>{index + 1}</span>
                  <span className="rank-flag">{city.emoji}</span>
                  <span className="rank-main"><strong>{city.name}</strong><small>{city.country} · {city.category}</small></span>
                  <span className="rank-rating"><strong>{city.rating}.0</strong><Star fill={colors[city.rating]} color={colors[city.rating]}/></span>
                  <span className="rank-bar"><i style={{ width: `${city.rating * 20}%`, background: colors[city.rating] }}/></span>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === "profile" && (
          <div className="profile-layout">
            <div className="profile-hero">
              <span className="profile-avatar">AM</span>
              <div><p className="kicker">TRAVEL JOURNAL</p><h2>Alex Morgan</h2><p>Collecting places, not things.</p></div>
            </div>
            <div className="stats-grid">
              <article><MapPin/><strong>{cities.length}</strong><span>Cities logged</span></article>
              <article><Compass/><strong>{new Set(cities.map(c => c.country)).size}</strong><span>Countries</span></article>
              <article><Star/><strong>{(cities.reduce((a,c) => a + c.rating, 0) / cities.length).toFixed(1)}</strong><span>Average rating</span></article>
            </div>
            <article className="insight-card"><span className="insight-icon"><Sparkles/></span><div><p className="kicker">YOUR TRAVEL TASTE</p><h3>You’re happiest in culture-rich coastal cities.</h3><p>Lisbon, Kyoto and Cape Town define your top travel pattern. Food and nature consistently lift your ratings.</p></div></article>
            <div className="year-card"><div><p className="kicker">2026 TRAVEL GOAL</p><h3>6 of 16 new cities</h3></div><span>38%</span><div className="wide-progress"><i style={{width:"38%"}}/></div></div>
          </div>
        )}
      </section>

      <nav className="mobile-nav" aria-label="Primary">
        <button className={tab === "map" ? "active" : ""} onClick={() => setTab("map")}><MapIcon/><span>Map</span></button>
        <button className={tab === "rankings" ? "active" : ""} onClick={() => setTab("rankings")}><Trophy/><span>Rankings</span></button>
        <button className="add-mobile" onClick={() => setAdding(true)}><Plus/></button>
        <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}><UserRound/><span>Profile</span></button>
      </nav>

      {adding && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setAdding(false); }}>
          <section className="add-modal" role="dialog" aria-modal="true" aria-labelledby="add-title">
            <div className="modal-head">
              <button className="back-btn" onClick={() => candidate ? setCandidate(null) : setAdding(false)}><ArrowLeft/></button>
              <div><p className="kicker">NEW MEMORY</p><h2 id="add-title">{candidate ? `How was ${candidate.name}?` : "Where have you been?"}</h2></div>
              <button className="close-btn static" onClick={() => setAdding(false)}><X/></button>
            </div>
            {!candidate ? (
              <>
                <label className="search-box"><Search/><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search for a city"/></label>
                <p className="section-label">{query ? searching ? "SEARCHING 234,000+ CITIES…" : "SEARCH RESULTS" : "SUGGESTED FOR YOU"}</p>
                <div className="suggestions">
                  {searchResults.map(city => (
                    <button key={`${city.name}-${city.country}-${city.lat}`} onClick={() => beginAdd(city)}><span>{city.emoji}</span><span><strong>{city.name}</strong><small>{city.country} · {city.continent}{city.population ? ` · ${city.population.toLocaleString()} people` : ""}</small></span><Plus/></button>
                  ))}
                  {!searching && query.length >= 2 && searchResults.length === 0 && <div className="empty-search">No matching city found. Try another spelling.</div>}
                </div>
                <p className="data-credit">Worldwide city data by <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a></p>
              </>
            ) : (
              <div className="rating-form">
                <div className="candidate-chip"><span>{candidate.emoji}</span><div><strong>{candidate.name}</strong><small>{candidate.country}</small></div><Check/></div>
                <fieldset>
                  <legend>Your overall rating</legend>
                  <div className="big-stars">{[1,2,3,4,5].map(n => <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}><Star fill={n <= rating ? colors[rating || n] : "none"} color={n <= rating ? colors[rating || n] : "#c7c9c3"}/></button>)}</div>
                  <p>{rating === 1 ? "Not for me" : rating === 2 ? "It had its moments" : rating === 3 ? "Glad I went" : rating === 4 ? "Would happily return" : rating === 5 ? "One of my favourites" : "Tap to rate"}</p>
                </fieldset>
                <div className="form-row">
                  <label><span><CalendarDays/>Visit date</span><input type="month" defaultValue="2026-07"/></label>
                  <label><span><Filter/>Best for</span><select value={category === "Overall" ? "Culture" : category} onChange={e => setCategory(e.target.value)}><option>Food</option><option>Culture</option><option>Nature</option><option>Nightlife</option></select></label>
                </div>
                <label className="note-field"><span>Your memory <small>OPTIONAL</small></span><textarea value={note} onChange={e => setNote(e.target.value)} maxLength={160} placeholder="What made this city memorable?"/><small>{note.length}/160</small></label>
                <button className="photo-btn"><Camera/>Add a favourite photo <small>Optional</small></button>
                <button className="save-btn" disabled={!rating} onClick={saveCity}><MapPin/>Add to my map</button>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
