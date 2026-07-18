"use client";

import {
  ArrowLeft, BookOpen, CalendarDays, Camera, Check, ChevronDown, Compass, Filter,
  GitCompareArrows, GripVertical, Heart, ListFilter, ListPlus, Map as MapIcon, MapPin,
  Plus, Search, SlidersHorizontal, Sparkles, Star, Trophy, UserRound, X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type RatingKey = "personal" | "culture" | "architecture" | "food" | "nature" | "nightlife";
type Ratings = Record<RatingKey, number | null>;

type City = {
  id: number; name: string; country: string; continent: string; lat: number; lng: number;
  rating: number; ratings: Ratings; dateFrom: string; dateTo: string;
  visitType: string; note: string; emoji: string;
};

type CityOption = {
  name: string; ascii?: string; country: string; continent: string;
  lat: number; lng: number; emoji: string; population?: number;
};

type PersonalList = { id: number; title: string; cityIds: number[] };

const starterCities: City[] = [
  { id: 1, name: "Lisbon", country: "Portugal", continent: "Europe", lat: 38.72, lng: -9.14, rating: 4.7, ratings: { personal: 5, culture: 4.5, architecture: 4.5, food: 5, nature: 4, nightlife: 5 }, dateFrom: "2025-05-09", dateTo: "2025-05-15", visitType: "Holiday", note: "Golden evenings, tiled streets and the best small plates.", emoji: "🇵🇹" },
  { id: 2, name: "Kyoto", country: "Japan", continent: "Asia", lat: 35.01, lng: 135.77, rating: 4.7, ratings: { personal: 5, culture: 5, architecture: 5, food: 4.5, nature: 4, nightlife: null }, dateFrom: "2024-10-12", dateTo: "2024-10-19", visitType: "Holiday", note: "Quiet gardens before breakfast. A city that rewards slowing down.", emoji: "🇯🇵" },
  { id: 3, name: "Cape Town", country: "South Africa", continent: "Africa", lat: -33.93, lng: 18.42, rating: 4.4, ratings: { personal: 4.5, culture: 4, architecture: 4, food: 4.5, nature: 5, nightlife: 4.5 }, dateFrom: "2025-02-03", dateTo: "2025-02-12", visitType: "Holiday", note: "Mountains, ocean and long lunches.", emoji: "🇿🇦" },
  { id: 4, name: "New York", country: "United States", continent: "North America", lat: 40.71, lng: -74.01, rating: 4.3, ratings: { personal: 4.5, culture: 5, architecture: 4.5, food: 4.5, nature: 3, nightlife: 4.5 }, dateFrom: "2023-09-18", dateTo: "2023-09-25", visitType: "City break", note: "Endless energy. Walked everywhere.", emoji: "🇺🇸" },
  { id: 5, name: "Marrakech", country: "Morocco", continent: "Africa", lat: 31.63, lng: -8.0, rating: 3.6, ratings: { personal: 3.5, culture: 4, architecture: 4.5, food: 4, nature: 3, nightlife: 2.5 }, dateFrom: "2024-03-06", dateTo: "2024-03-10", visitType: "City break", note: "Intense, colourful and unforgettable.", emoji: "🇲🇦" },
  { id: 6, name: "Reykjavík", country: "Iceland", continent: "Europe", lat: 64.15, lng: -21.94, rating: 4.1, ratings: { personal: 4, culture: 3.5, architecture: 3.5, food: 3.5, nature: 5, nightlife: null }, dateFrom: "2023-01-14", dateTo: "2023-01-19", visitType: "Road trip", note: "Small city, enormous landscapes.", emoji: "🇮🇸" }
];

const suggestions: CityOption[] = [
  { name: "Barcelona", country: "Spain", continent: "Europe", lat: 41.39, lng: 2.17, emoji: "🇪🇸" },
  { name: "Buenos Aires", country: "Argentina", continent: "South America", lat: -34.6, lng: -58.38, emoji: "🇦🇷" },
  { name: "Copenhagen", country: "Denmark", continent: "Europe", lat: 55.68, lng: 12.57, emoji: "🇩🇰" },
  { name: "Melbourne", country: "Australia", continent: "Oceania", lat: -37.81, lng: 144.96, emoji: "🇦🇺" },
  { name: "Seoul", country: "South Korea", continent: "Asia", lat: 37.57, lng: 126.98, emoji: "🇰🇷" }
];

const categories = ["Overall", "Personal", "Culture", "Architecture", "Food", "Nature", "Nightlife"];
const requiredRatingKeys: RatingKey[] = ["personal", "culture", "architecture", "food"];
const optionalRatingKeys: RatingKey[] = ["nature", "nightlife"];
const colorForScore = (score: number) =>
  score > 4.5 ? "#236844" :
  score > 4 ? "#62A461" :
  score > 3 ? "#D4B849" :
  score > 2 ? "#E28A43" : "#CD554F";
const scoreFor = (city: City, category: string) =>
  category === "Overall" ? city.rating : city.ratings[category.toLowerCase() as RatingKey];
const calculateOverall = (ratings: Ratings) => {
  const values = Object.values(ratings).filter((value): value is number => value !== null && value > 0);
  return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : 0;
};
const formatVisitDate = (from: string, to: string) => {
  const formatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const start = formatter.format(new Date(`${from}T12:00:00`));
  if (!to || to === from) return start;
  return `${start} – ${formatter.format(new Date(`${to}T12:00:00`))}`;
};
const normalizeSearch = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const countryFlag = (code: string) => code.length === 2
  ? String.fromCodePoint(...code.toUpperCase().split("").map(char => 127397 + char.charCodeAt(0)))
  : "🌍";

function CategoryRating({
  label,
  value,
  optional = false,
  onChange
}: {
  label: string;
  value: number | null;
  optional?: boolean;
  onChange: (value: number | null) => void;
}) {
  if (optional && value === null) {
    return (
      <div className="category-rating optional-empty">
        <span><strong>{label}</strong><small>Optional</small></span>
        <button type="button" onClick={() => onChange(3.5)}>+ Add rating</button>
      </div>
    );
  }

  return (
    <label className="category-rating">
      <span><strong>{label}</strong>{optional && <button type="button" onClick={() => onChange(null)}>Remove</button>}</span>
      <div>
        <input
          type="range"
          min="1"
          max="5"
          step="0.5"
          value={value || 1}
          onChange={event => onChange(Number(event.target.value))}
          aria-label={`${label} rating`}
        />
        <output style={{ background: colorForScore(value || 1) }}>{(value || 1).toFixed(1)}</output>
      </div>
    </label>
  );
}

function InteractiveMap({
  cities,
  wishlist,
  selected,
  onSelect,
  scoreCategory
}: {
  cities: City[];
  wishlist: CityOption[];
  selected: City | null;
  onSelect: (city: City) => void;
  scoreCategory: string;
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
        const displayScore = scoreFor(city, scoreCategory);
        if (displayScore === null) return;
        const icon = L.divIcon({
          className: "city-div-icon",
          html: `<div class="city-map-marker${isSelected ? " is-selected" : ""}" style="--marker-color:${colorForScore(displayScore)}">
            <span class="city-marker-label">${city.name}</span>
          </div>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19]
        });

        const marker = L.marker([city.lat, city.lng], {
          icon,
          title: `${city.name}, ${displayScore.toFixed(1)} stars`,
          riseOnHover: true
        }).addTo(layer);

        marker.bindTooltip(
          `<strong>${city.name}</strong><br>${city.country} · ${displayScore.toFixed(1)}/5 ${scoreCategory.toLowerCase()}`,
          { direction: "top", offset: [0, -18], className: "city-tooltip" }
        );
        marker.on("click", () => {
          onSelect(city);
          if (map.getZoom() < 6) map.flyTo([city.lat, city.lng], 6, { duration: 0.8 });
        });
      });

      wishlist.forEach(city => {
        const icon = L.divIcon({
          className: "city-div-icon",
          html: `<div class="city-map-marker wishlist-marker"><span class="city-marker-label">${city.name} · Want to visit</span></div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });
        L.marker([city.lat, city.lng], { icon, title: `${city.name} · Want to visit`, riseOnHover: true })
          .bindTooltip(`<strong>${city.name}</strong><br>${city.country} · Want to visit`, { direction: "top", offset: [0, -13], className: "city-tooltip" })
          .addTo(layer);
      });
    }

    drawMarkers();
    return () => { cancelled = true; };
  }, [cities, wishlist, selected, onSelect, scoreCategory]);

  useEffect(() => () => {
    mapInstance.current?.remove();
    mapInstance.current = null;
  }, []);

  return <div ref={mapElement} className="leaflet-map" aria-label="Interactive map of your rated cities" />;
}

export default function CityLogger() {
  const [tab, setTab] = useState<"map" | "rankings" | "log" | "compare" | "lists" | "profile">("map");
  const [cities, setCities] = useState(starterCities);
  const [selected, setSelected] = useState<City | null>(starterCities[0]);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [candidate, setCandidate] = useState<CityOption | null>(null);
  const [searchResults, setSearchResults] = useState<CityOption[]>(suggestions);
  const [searching, setSearching] = useState(false);
  const [ratings, setRatings] = useState<Ratings>({ personal: 4, culture: 4, architecture: 4, food: 4, nature: null, nightlife: null });
  const [dateFrom, setDateFrom] = useState("2026-07-01");
  const [dateTo, setDateTo] = useState("2026-07-05");
  const [visitType, setVisitType] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("Overall");
  const [filterOpen, setFilterOpen] = useState(false);
  const [continent, setContinent] = useState("All");
  const [wishlist, setWishlist] = useState<CityOption[]>([
    { name: "Mexico City", country: "Mexico", continent: "North America", lat: 19.43, lng: -99.13, emoji: "🇲🇽" },
    { name: "Hanoi", country: "Vietnam", continent: "Asia", lat: 21.03, lng: 105.85, emoji: "🇻🇳" }
  ]);
  const [manualOrder, setManualOrder] = useState<number[] | null>(null);
  const [draggedCity, setDraggedCity] = useState<number | null>(null);
  const [compareIds, setCompareIds] = useState<[number, number]>([starterCities[0].id, starterCities[1].id]);
  const [lists, setLists] = useState<PersonalList[]>([
    { id: 1, title: "Most underrated", cityIds: [starterCities[0].id, starterCities[4].id, starterCities[2].id] }
  ]);
  const [newListTitle, setNewListTitle] = useState("");

  const filtered = useMemo(() =>
    cities.filter(city =>
      (continent === "All" || city.continent === continent) &&
      scoreFor(city, category) !== null
    ), [cities, continent, category]);

  const ranked = useMemo(() => [...filtered].sort((a, b) =>
    (scoreFor(b, category) || 0) - (scoreFor(a, category) || 0) ||
    b.dateFrom.localeCompare(a.dateFrom) ||
    a.name.localeCompare(b.name)
  ), [filtered, category]);
  const chronological = useMemo(() => [...cities].sort((a, b) => b.dateFrom.localeCompare(a.dateFrom)), [cities]);
  const displayedRanked = useMemo(() => {
    if (!manualOrder) return ranked;
    const positions = new Map(manualOrder.map((id, index) => [id, index]));
    return [...ranked].sort((a, b) => (positions.get(a.id) ?? 999) - (positions.get(b.id) ?? 999));
  }, [ranked, manualOrder]);
  const compared = compareIds.map(id => cities.find(city => city.id === id) || cities[0]);
  const draftOverall = calculateOverall(ratings);
  const requiredRatingsComplete = requiredRatingKeys.every(key => ratings[key] !== null && (ratings[key] || 0) > 0);

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
    setCandidate(city);
    setQuery(city.name);
    setRatings({ personal: 4, culture: 4, architecture: 4, food: 4, nature: null, nightlife: null });
    setDateFrom("2026-07-01");
    setDateTo("2026-07-05");
    setVisitType("");
    setNote("");
  }

  function saveCity() {
    if (!candidate || !requiredRatingsComplete || !dateFrom || !dateTo || dateTo < dateFrom) return;
    const newCity: City = {
      ...candidate,
      id: Date.now(),
      rating: draftOverall,
      ratings,
      dateFrom,
      dateTo,
      visitType,
      note: note || "A new city in my travel story."
    };
    setCities(prev => [newCity, ...prev]);
    setSelected(newCity); setAdding(false); setCandidate(null); setQuery(""); setTab("map");
  }

  function addWantToVisit(city: CityOption) {
    setWishlist(current => current.some(item => item.name === city.name && item.country === city.country)
      ? current.filter(item => !(item.name === city.name && item.country === city.country))
      : [...current, city]);
  }

  function reorderRanking(targetId: number) {
    if (draggedCity === null || draggedCity === targetId) return;
    const order = displayedRanked.map(city => city.id);
    const from = order.indexOf(draggedCity);
    const to = order.indexOf(targetId);
    order.splice(to, 0, order.splice(from, 1)[0]);
    setManualOrder(order);
    setDraggedCity(null);
  }

  function createList() {
    const title = newListTitle.trim();
    if (!title) return;
    setLists(current => [...current, { id: Date.now(), title, cityIds: [] }]);
    setNewListTitle("");
  }

  function moveListCity(listId: number, cityId: number, direction: -1 | 1) {
    setLists(current => current.map(list => {
      if (list.id !== listId) return list;
      const cityIds = [...list.cityIds];
      const index = cityIds.indexOf(cityId);
      const next = index + direction;
      if (next < 0 || next >= cityIds.length) return list;
      [cityIds[index], cityIds[next]] = [cityIds[next], cityIds[index]];
      return { ...list, cityIds };
    }));
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><MapPin size={18}/></span><span>citylogger</span></div>
        <nav className="desktop-nav" aria-label="Primary">
          <button className={tab === "map" ? "active" : ""} onClick={() => setTab("map")}><MapIcon/>Map</button>
          <button className={tab === "rankings" ? "active" : ""} onClick={() => setTab("rankings")}><Trophy/>Rankings</button>
          <button className={tab === "log" ? "active" : ""} onClick={() => setTab("log")}><BookOpen/>Log</button>
          <button className={tab === "compare" ? "active" : ""} onClick={() => setTab("compare")}><GitCompareArrows/>Compare</button>
          <button className={tab === "lists" ? "active" : ""} onClick={() => setTab("lists")}><ListPlus/>My Lists</button>
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
            <p className="kicker">{tab === "map" ? "YOUR TRAVEL MAP" : tab === "rankings" ? "YOUR FAVOURITES" : tab === "log" ? "YOUR TRAVEL LOG" : tab === "compare" ? "CITY HEAD TO HEAD" : tab === "lists" ? "YOUR COLLECTIONS" : "YOUR JOURNEY"}</p>
            <h1>{tab === "map" ? "The world, according to you." : tab === "rankings" ? "Cities worth returning to." : tab === "log" ? "Every trip, in order." : tab === "compare" ? "How do your cities compare?" : tab === "lists" ? "Save places your way." : "A life well travelled."}</h1>
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
              <InteractiveMap cities={filtered} wishlist={wishlist} selected={selected} onSelect={setSelected} scoreCategory={category}/>
              <div className="map-legend"><span>≤2</span>{["#CD554F","#E28A43","#D4B849","#62A461","#236844"].map(c => <i key={c} style={{ background: c }}/>) }<span>4.5+</span><i className="purple-key"/><span>Want to visit</span></div>
              {selected && filtered.some(c => c.id === selected.id) && (
                <article className="city-preview">
                  <button className="close-btn" onClick={() => setSelected(null)} aria-label="Close"><X/></button>
                  <div className="photo-block"><span>{selected.emoji}</span><small>{selected.country.toUpperCase()}</small></div>
                  <div className="preview-copy">
                    <p className="city-meta"><MapPin/>{selected.country} · {formatVisitDate(selected.dateFrom, selected.dateTo)}</p>
                    <h2>{selected.name}</h2>
                    <div className="stars">{[1,2,3,4,5].map(n => <Star key={n} fill={n <= Math.round(selected.rating) ? colorForScore(selected.rating) : "none"} color={n <= Math.round(selected.rating) ? colorForScore(selected.rating) : "#c7c9c3"}/>)}<strong>{selected.rating.toFixed(1)}</strong></div>
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
              <button className="filter-btn" onClick={() => setManualOrder(manualOrder ? null : displayedRanked.map(city => city.id))}><ListFilter/>{manualOrder ? "Custom order · Reset" : "Drag to reorder"}<ChevronDown/></button>
            </div>
            <div className="ranking-list">
              {displayedRanked.map((city, index) => (
                <div className={`rank-row ${draggedCity === city.id ? "dragging" : ""}`} key={city.id} draggable onDragStart={() => setDraggedCity(city.id)} onDragOver={event => event.preventDefault()} onDrop={() => reorderRanking(city.id)}>
                  <GripVertical className="drag-handle" aria-label="Drag to reorder"/>
                  <span className={`rank-number ${index < 3 ? "top" : ""}`}>{index + 1}</span>
                  <span className="rank-flag">{city.emoji}</span>
                  <button className="rank-main rank-city-link" onClick={() => { setSelected(city); setTab("map"); }}><strong>{city.name}</strong><small>{city.country} · {formatVisitDate(city.dateFrom, city.dateTo)}</small></button>
                  <span className="rank-rating"><strong>{(scoreFor(city, category) || 0).toFixed(1)}</strong><Star fill={colorForScore(scoreFor(city, category) || 0)} color={colorForScore(scoreFor(city, category) || 0)}/></span>
                  <span className="rank-bar"><i style={{ width: `${(scoreFor(city, category) || 0) * 20}%`, background: colorForScore(scoreFor(city, category) || 0) }}/></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "log" && (
          <div className="log-layout">
            <div className="log-summary"><BookOpen/><span><strong>{cities.length} entries</strong><small>Newest visits first</small></span></div>
            <div className="log-list">
              {chronological.map((city, index) => (
                <button key={city.id} className="log-entry" onClick={() => { setSelected(city); setTab("map"); }}>
                  <span className="log-date">{new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date(`${city.dateFrom}T12:00:00`))}</span>
                  <span className="log-line"><i className={index === 0 ? "latest" : ""}/></span>
                  <span className="rank-flag">{city.emoji}</span>
                  <span className="rank-main"><strong>{city.name}</strong><small>{city.country} · {formatVisitDate(city.dateFrom, city.dateTo)}{city.visitType ? ` · ${city.visitType}` : ""}</small></span>
                  <span className="rank-rating"><strong>{city.rating.toFixed(1)}</strong><Star fill={colorForScore(city.rating)} color={colorForScore(city.rating)}/></span>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === "compare" && (
          <div className="compare-layout">
            <section className="compare-section standalone-section">
              <div className="section-heading"><span><GitCompareArrows/></span><div><p className="kicker">COMPARE CITIES</p><h2>Head to head</h2></div></div>
              <div className="compare-pickers">
                {[0, 1].map(index => (
                  <select key={index} aria-label={`Compare city ${index + 1}`} value={compareIds[index]} onChange={event => setCompareIds(current => {
                    const next: [number, number] = [...current];
                    next[index] = Number(event.target.value);
                    return next;
                  })}>
                    {cities.map(city => <option key={city.id} value={city.id}>{city.name}, {city.country}</option>)}
                  </select>
                ))}
              </div>
              <div className="compare-grid">
                {compared.map((city, index) => (
                  <article key={`${city.id}-${index}`}>
                    <span className="compare-flag">{city.emoji}</span><h3>{city.name}</h3><small>{city.country}</small>
                    <strong style={{ color: colorForScore(city.rating) }}>{city.rating.toFixed(1)}</strong>
                    <div className="compare-ratings">{requiredRatingKeys.map(key => <p key={key}><span>{key === "personal" ? "Experience" : key}</span><b>{city.ratings[key]?.toFixed(1)}</b></p>)}</div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === "lists" && (
          <div className="lists-layout">
            <section className="lists-section standalone-section">
              <div className="section-heading"><span><ListPlus/></span><div><p className="kicker">MY LISTS</p><h2>Your collections</h2></div></div>
              <article className="personal-list want-list">
                <div><span className="list-icon"><Heart fill="currentColor"/></span><span><h3>Want to Visit</h3><small>{wishlist.length} saved cities · purple on your map</small></span></div>
                <div className="list-cities">{wishlist.map((city, index) => <span key={`${city.name}-${city.country}`}><b>{index + 1}</b>{city.emoji} {city.name}<button aria-label={`Remove ${city.name}`} onClick={() => addWantToVisit(city)}><X/></button></span>)}</div>
              </article>
              {lists.map(list => (
                <article className="personal-list" key={list.id}>
                  <div><span className="list-icon"><ListFilter/></span><span><h3>{list.title}</h3><small>{list.cityIds.length} cities · order it your way</small></span></div>
                  <div className="list-cities">
                    {list.cityIds.map((id, index) => {
                      const city = cities.find(item => item.id === id);
                      return city ? <span key={id}><b>{index + 1}</b>{city.emoji} {city.name}<span className="list-order"><button disabled={index === 0} onClick={() => moveListCity(list.id, id, -1)}>↑</button><button disabled={index === list.cityIds.length - 1} onClick={() => moveListCity(list.id, id, 1)}>↓</button></span></span> : null;
                    })}
                    <select aria-label={`Add city to ${list.title}`} value="" onChange={event => {
                      const id = Number(event.target.value);
                      if (id) setLists(current => current.map(item => item.id === list.id && !item.cityIds.includes(id) ? { ...item, cityIds: [...item.cityIds, id] } : item));
                    }}><option value="">+ Add a city</option>{cities.filter(city => !list.cityIds.includes(city.id)).map(city => <option key={city.id} value={city.id}>{city.name}</option>)}</select>
                  </div>
                </article>
              ))}
              <div className="new-list"><input aria-label="New list title" value={newListTitle} onChange={event => setNewListTitle(event.target.value)} onKeyDown={event => { if (event.key === "Enter") createList(); }} placeholder="Name a new list, e.g. Best food cities"/><button onClick={createList}><Plus/>Create list</button></div>
            </section>
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
        <button className={tab === "log" ? "active" : ""} onClick={() => setTab("log")}><BookOpen/><span>Log</span></button>
        <button className={tab === "compare" ? "active" : ""} onClick={() => setTab("compare")}><GitCompareArrows/><span>Compare</span></button>
        <button className={tab === "lists" ? "active" : ""} onClick={() => setTab("lists")}><ListPlus/><span>Lists</span></button>
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
                    <div className="suggestion-row" key={`${city.name}-${city.country}-${city.lat}`}>
                      <button className="city-result" onClick={() => beginAdd(city)}><span>{city.emoji}</span><span><strong>{city.name}</strong><small>{city.country} · {city.continent}{city.population ? ` · ${city.population.toLocaleString()} people` : ""}</small></span><Plus/></button>
                      <button className={`want-btn ${wishlist.some(item => item.name === city.name && item.country === city.country) ? "saved" : ""}`} onClick={() => addWantToVisit(city)} aria-label={`${wishlist.some(item => item.name === city.name && item.country === city.country) ? "Remove" : "Add"} ${city.name} ${wishlist.some(item => item.name === city.name && item.country === city.country) ? "from" : "to"} Want to Visit`}><Heart fill={wishlist.some(item => item.name === city.name && item.country === city.country) ? "currentColor" : "none"}/></button>
                    </div>
                  ))}
                  {!searching && query.length >= 2 && searchResults.length === 0 && <div className="empty-search">No matching city found. Try another spelling.</div>}
                </div>
                <p className="data-credit">Worldwide city data by <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a></p>
              </>
            ) : (
              <div className="rating-form">
                <div className="candidate-chip"><span>{candidate.emoji}</span><div><strong>{candidate.name}</strong><small>{candidate.country}</small></div><Check/></div>
                <div className="overall-score" style={{ "--score-color": colorForScore(draftOverall) } as React.CSSProperties}>
                  <span><small>CALCULATED OVERALL</small><strong>{draftOverall.toFixed(1)}</strong></span>
                  <div><Star fill={colorForScore(draftOverall)} color={colorForScore(draftOverall)}/><p>Based on {Object.values(ratings).filter(value => value !== null).length} category ratings</p></div>
                </div>
                <div className="category-ratings">
                  <p className="section-label">CORE RATINGS · HALF-STARS ENABLED</p>
                  {requiredRatingKeys.map(key => (
                    <CategoryRating key={key} label={key === "personal" ? "Personal experience" : key[0].toUpperCase() + key.slice(1)} value={ratings[key]} onChange={value => setRatings(current => ({ ...current, [key]: value }))}/>
                  ))}
                  <p className="section-label optional-label">OPTIONAL RATINGS</p>
                  {optionalRatingKeys.map(key => (
                    <CategoryRating key={key} optional label={key[0].toUpperCase() + key.slice(1)} value={ratings[key]} onChange={value => setRatings(current => ({ ...current, [key]: value }))}/>
                  ))}
                </div>
                <div className="form-row date-range">
                  <label><span><CalendarDays/>Arrived</span><input type="date" value={dateFrom} onChange={event => { setDateFrom(event.target.value); if (dateTo < event.target.value) setDateTo(event.target.value); }}/></label>
                  <label><span><CalendarDays/>Left</span><input type="date" min={dateFrom} value={dateTo} onChange={event => setDateTo(event.target.value)}/></label>
                </div>
                <label className="select-field"><span><Filter/>Visit type <small>OPTIONAL</small></span><select value={visitType} onChange={event => setVisitType(event.target.value)}><option value="">Choose a visit type</option><option>Holiday</option><option>City break</option><option>Road trip</option><option>Work</option><option>Study</option><option>Lived there</option><option>Visiting friends or family</option><option>Day trip</option></select></label>
                <label className="note-field"><span>Your memory <small>OPTIONAL</small></span><textarea value={note} onChange={e => setNote(e.target.value)} maxLength={160} placeholder="What made this city memorable?"/><small>{note.length}/160</small></label>
                <button className="photo-btn"><Camera/>Add a favourite photo <small>Optional</small></button>
                <button className="save-btn" disabled={!requiredRatingsComplete || !dateFrom || !dateTo || dateTo < dateFrom} onClick={saveCity}><MapPin/>Add to my map · {draftOverall.toFixed(1)}</button>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
