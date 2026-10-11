"use client";

import {
  ArrowLeft, BookOpen, CalendarDays, Check, ChevronDown, Compass, Filter,
  GitCompareArrows, GripVertical, Heart, ListFilter, ListPlus, Map as MapIcon, MapPin,
  Pencil, Plus, Search, SlidersHorizontal, Sparkles, Star, Trophy, UserRound, X
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addWishlistCity, createPersonalList, createVisit, deleteVisit, downloadAccountData, loadAppState,
  loadVisits, removeWishlistCity, savePersonalListCities, saveRankingOrder, saveYearlyGoal as saveStoredYearlyGoal,
  updateVisit, type StoredCity
} from "../backend/index";
import { authRedirectUrl, isSupabaseConfigured, supabase } from "../backend/supabase";
import Onboarding, { type EntryStage } from "./Onboarding";
import { cityIdentity, latestCities, visitHistory, GUEST_KEY, ONBOARDING_KEY } from "./journey";

type RatingKey = "personal" | "culture" | "architecture" | "food" | "nature" | "nightlife";
type Ratings = Record<RatingKey, number | null>;
type CityId = number | string;

type City = {
  id: CityId; name: string; country: string; continent: string; lat: number; lng: number;
  rating: number; ratings: Ratings; dateFrom: string; dateTo: string;
  visitType: string; note: string; emoji: string; photoUrl?: string;
};

type CityOption = {
  id?: string;
  name: string; ascii?: string; country: string; continent: string;
  lat: number; lng: number; emoji: string; population?: number;
};

type PersonalList = { id: CityId; title: string; cityIds: CityId[] };

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
const reviewAccountEmail = "appreview@citylogger.test";
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
const escapeMapText = (value: string) => value.replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]!));
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
  onSelect: (city: City | null) => void;
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
        center: selected ? [selected.lat, selected.lng] : [22, 8],
        zoom: selected ? 6 : 2,
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
      map.on("click", () => onSelect(null));
      updateZoomDetail();
    }

    createMap();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout>;

    async function drawMarkers() {
      if (cancelled) return;
      const map = mapInstance.current;
      const layer = markerLayer.current;
      if (!map || !layer) {
        retry = setTimeout(drawMarkers, 40);
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
            <span class="city-marker-label">${escapeMapText(city.name)}</span>
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
          `<strong>${escapeMapText(city.name)}</strong><br>${escapeMapText(city.country)} · ${displayScore.toFixed(1)}/5 ${scoreCategory.toLowerCase()}`,
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
          html: `<div class="city-map-marker wishlist-marker"><span class="city-marker-label">${escapeMapText(city.name)} · Want to visit</span></div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });
        L.marker([city.lat, city.lng], { icon, title: `${city.name} · Want to visit`, riseOnHover: true })
          .bindTooltip(`<strong>${escapeMapText(city.name)}</strong><br>${escapeMapText(city.country)} · Want to visit`, { direction: "top", offset: [0, -13], className: "city-tooltip" })
          .addTo(layer);
      });
    }

    drawMarkers();
    return () => { cancelled = true; clearTimeout(retry); };
  }, [cities, wishlist, selected, onSelect, scoreCategory]);

  useEffect(() => () => {
    mapInstance.current?.remove();
    mapInstance.current = null;
  }, []);

  return <div ref={mapElement} className="leaflet-map" aria-label="Interactive map of your rated cities" />;
}

export default function CityLogger({ nativeMode = false }: { nativeMode?: boolean }) {
  const [tab, setTab] = useState<"map" | "rankings" | "log" | "compare" | "lists" | "profile" | "city">("map");
  const [cities, setCities] = useState<City[]>([]);
  const [selected, setSelected] = useState<City | null>(null);
  const [entryStage, setEntryStage] = useState<EntryStage>("loading");
  const [onboardingNotice, setOnboardingNotice] = useState("");
  const [guestReady, setGuestReady] = useState(false);
  const [guestImportAvailable, setGuestImportAvailable] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [guestStorageError, setGuestStorageError] = useState("");
  const signupPending = useRef(false);
  const entryInitialised = useRef(false);
  const savingVisit = useRef(false);
  const visitOperationId = useRef<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
  const [editorReturnTab, setEditorReturnTab] = useState<"map" | "city">("map");
  const [query, setQuery] = useState("");
  const [candidate, setCandidate] = useState<CityOption | null>(null);
  const [searchResults, setSearchResults] = useState<CityOption[]>(suggestions);
  const [searching, setSearching] = useState(false);
  const [ratings, setRatings] = useState<Ratings>({ personal: 4, culture: 4, architecture: 4, food: 4, nature: null, nightlife: null });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [visitType, setVisitType] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("Overall");
  const [filterOpen, setFilterOpen] = useState(false);
  const [continent, setContinent] = useState("All");
  const [wishlist, setWishlist] = useState<CityOption[]>([]);
  const [manualOrder, setManualOrder] = useState<CityId[] | null>(null);
  const [draggedCity, setDraggedCity] = useState<CityId | null>(null);
  const [compareIds, setCompareIds] = useState<[CityId, CityId]>(["", ""]);
  const [lists, setLists] = useState<PersonalList[]>([]);
  const [newListTitle, setNewListTitle] = useState("");
  const [yearlyGoal, setYearlyGoal] = useState(10);
  const [goalDraft, setGoalDraft] = useState("10");
  const [editingGoal, setEditingGoal] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<"welcome" | "signin" | "signup" | "forgot" | "reset">("welcome");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [profileName, setProfileName] = useState("Your travel journal");
  const [syncStatus, setSyncStatus] = useState<"idle" | "loading" | "saved" | "error">("idle");
  const syncRequest = useRef(0);
  const publicPageUrl = (path: string) => nativeMode ? `https://citylogger.app${path}` : path;
  const citySummaries = useMemo(() => latestCities(cities), [cities]);
  const storyHistory = useMemo(() => selected ? visitHistory(cities, selected) : [], [cities, selected]);
  const currentCity = storyHistory[0] || selected;

  const filtered = useMemo(() =>
    citySummaries.filter(city =>
      (continent === "All" || city.continent === continent) &&
      scoreFor(city, category) !== null
    ), [citySummaries, continent, category]);

  const ranked = useMemo(() => [...filtered].sort((a, b) =>
    (scoreFor(b, category) || 0) - (scoreFor(a, category) || 0) ||
    b.dateFrom.localeCompare(a.dateFrom) ||
    a.name.localeCompare(b.name)
  ), [filtered, category]);
  const chronological = useMemo(() => [...cities].sort((a, b) => b.dateFrom.localeCompare(a.dateFrom)), [cities]);
  const displayedRanked = useMemo(() => {
    if (!manualOrder) return ranked;
    const positions = new Map(manualOrder.map((id, index) => [id, index]));
    const position = (city: City) => Math.min(...visitHistory(cities, city).map(visit => positions.get(visit.id) ?? 999));
    return [...ranked].sort((a, b) => position(a) - position(b));
  }, [ranked, manualOrder, cities]);
  const compared = compareIds.map((id,index) => citySummaries.find(city => String(city.id) === String(id)) || citySummaries[index] || citySummaries[0]).filter(Boolean);
  const draftOverall = calculateOverall(ratings);
  const requiredRatingsComplete = requiredRatingKeys.every(key => ratings[key] !== null && (ratings[key] || 0) > 0);
  const currentYear = new Date().getFullYear();
  const citiesThisYear = new Set(cities.filter(city => city.dateFrom.startsWith(`${currentYear}-`)).map(cityIdentity)).size;
  const goalProgress = Math.min(100, Math.round((citiesThisYear / yearlyGoal) * 100));

  useEffect(() => {
    if (nativeMode) window.scrollTo({ top: 0, behavior: "instant" });
  }, [tab, nativeMode]);

  function restoreGuest() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(GUEST_KEY) || "null");
      setCities(Array.isArray(saved?.cities) ? saved.cities : []);
      setWishlist(Array.isArray(saved?.wishlist) ? saved.wishlist : []);
      setLists(Array.isArray(saved?.lists) ? saved.lists : []);
      setManualOrder(Array.isArray(saved?.manualOrder) ? saved.manualOrder : null);
      const goal = Math.max(1, Math.min(999, Number(saved?.yearlyGoal ?? localStorage.getItem("citylogger-yearly-goal-v2")) || 10));
      setYearlyGoal(goal); setGoalDraft(String(goal));
    } catch { setCities([]); setWishlist([]); setLists([]); setManualOrder(null); }
    setSelected(null);
    setProfileName("Your travel journal");
    setGuestReady(true);
  }

  useEffect(() => {
    if (!authReady || entryInitialised.current) return;
    entryInitialised.current = true;
    if (!user) restoreGuest();
    let complete = false;
    try { complete = window.localStorage.getItem(ONBOARDING_KEY) === "complete"; } catch { /* Storage can be unavailable in private browsing. */ }
    setEntryStage(user || complete ? "done" : "welcome");
  }, [authReady, user]);

  useEffect(() => {
    if (user) {
      if (!signupPending.current) setEntryStage("done");
      try { const guest = JSON.parse(localStorage.getItem(GUEST_KEY) || "null"); setGuestImportAvailable(Boolean(guest?.cities?.length || guest?.wishlist?.length || guest?.lists?.length)); } catch { setGuestImportAvailable(false); }
    }
  }, [user?.id]);

  useEffect(() => {
    if (!guestReady || !authReady || user) return;
    try { localStorage.setItem(GUEST_KEY, JSON.stringify({cities,wishlist,lists,manualOrder,yearlyGoal})); setGuestStorageError(""); }
    catch { setGuestStorageError("Your device could not save this journal. Keep this window open and free up storage before trying again."); setSyncStatus("error"); }
  }, [cities,wishlist,lists,manualOrder,yearlyGoal,guestReady,authReady,user]);

  function finishOnboarding() {
    try { localStorage.setItem(ONBOARDING_KEY,"complete"); } catch { /* The session still works without browser storage. */ }
    signupPending.current = false;
    setEntryStage("done"); setTab("map");
  }

  function enterGuest() {
    try { if (localStorage.getItem(ONBOARDING_KEY) === "complete") { finishOnboarding(); return; } } catch { /* Continue without persistent preferences. */ }
    setEntryStage("cards");
  }

  async function importGuestJournal() {
    if (!user || saveBusy) return;
    setSaveBusy(true); setSyncStatus("loading"); setSaveError("");
    try {
      const guest = JSON.parse(localStorage.getItem(GUEST_KEY) || "null") as {cities: City[];wishlist: CityOption[];lists: PersonalList[];manualOrder: CityId[] | null;yearlyGoal: number} | null;
      if (!guest) return;
      for (const visit of guest.cities || []) await createVisit(visit as StoredCity, String(visit.id));
      for (const city of guest.wishlist || []) await addWishlistCity(city);
      for (const [index,list] of (guest.lists || []).entries()) {
        await createPersonalList(list.title, lists.length + index, String(list.id));
        await savePersonalListCities(String(list.id), list.cityIds.map(String));
      }
      if (guest.manualOrder?.length && !manualOrder) await saveRankingOrder(guest.manualOrder.map(String));
      if (!cities.length) await saveStoredYearlyGoal(guest.yearlyGoal || 10);
      const [stored,state]=await Promise.all([loadVisits(),loadAppState()]);
      setCities(stored);setWishlist(state.wishlist);setLists(state.lists);setManualOrder(state.rankingOrder.length?state.rankingOrder:null);setYearlyGoal(state.yearlyGoal);setGoalDraft(String(state.yearlyGoal));
      localStorage.removeItem(GUEST_KEY);
      setGuestImportAvailable(false);setSyncStatus("saved");
    } catch (error) { setSaveError(error instanceof Error?error.message:"Could not import. Your guest journal is still on this device; you can retry.");setSyncStatus("error"); }
    finally {setSaveBusy(false);}
  }

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
      setAuthReady(true);
      if (window.sessionStorage.getItem("citylogger-password-recovery") === "true") {
        window.sessionStorage.removeItem("citylogger-password-recovery");
        setAuthView("reset");
        setAuthOpen(true);
      }
    }).catch(() => { setAuthReady(true); setAuthMessage("We couldn’t restore your session. Please sign in again."); });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      if (event === "PASSWORD_RECOVERY") {
        setAuthView("reset");
        setAuthOpen(true);
      }
      if (event === "SIGNED_OUT") {
        ++syncRequest.current;
        restoreGuest();
        setTab("map");
        setEntryStage("welcome");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    setCities([]); setSelected(null); setWishlist([]); setLists([]); setManualOrder(null);
    let active = true;
    const refresh = async () => {
      const requestId = ++syncRequest.current;
      setSyncStatus("loading");
      try {
        const [stored, appState] = await Promise.all([loadVisits(), loadAppState()]);
        if (!active || requestId !== syncRequest.current) return;
        setCities(stored);
        setSelected(current => current ? stored.find(city => city.id === current.id) || null : null);
        setWishlist(appState.wishlist);
        setLists(appState.lists);
        setManualOrder(appState.rankingOrder.length ? appState.rankingOrder : null);
        setYearlyGoal(appState.yearlyGoal);
        setGoalDraft(String(appState.yearlyGoal));
        setProfileName(appState.displayName || user.user_metadata?.display_name || user.email?.split("@")[0] || "Traveller");
        if (stored.length >= 2) setCompareIds([stored[0].id, stored[1].id]);
        else if (stored.length === 1) setCompareIds([stored[0].id, stored[0].id]);
        setSyncStatus("idle");
      } catch {
        if (active && requestId === syncRequest.current) setSyncStatus("error");
      }
    };
    refresh();
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { active = false; document.removeEventListener("visibilitychange", onVisible); };
  }, [user?.id]);

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
        const matchingRecords = records
          .filter(record =>
            normalizeSearch(record[0]).includes(needle) ||
            normalizeSearch(record[1]).includes(needle) ||
            normalizeSearch(record[2]).includes(needle)
          );
        const uniqueRecords = [...new Map(
          matchingRecords.map(record => [
            `${normalizeSearch(record[0])}|${normalizeSearch(record[2])}`,
            record
          ])
        ).values()];
        const matches = uniqueRecords
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

  function beginAdd(city: CityOption | City) {
    visitOperationId.current = crypto.randomUUID();
    setSaveError("");
    setEditingVisitId(null);
    setCandidate({ ...city, id: city.id === undefined ? undefined : String(city.id) });
    setQuery(city.name);
    setRatings({ personal: 4, culture: 4, architecture: 4, food: 4, nature: null, nightlife: null });
    const today = new Date().toLocaleDateString("en-CA");
    setDateFrom(today);
    setDateTo(today);
    setVisitType("");
    setNote("");
  }

  function openAddCity() {
    setSaveError("");
    setEditingVisitId(null);
    setCandidate(null);
    setQuery("");
    setSearchResults(suggestions);
    setSearching(false);
    setAdding(true);
  }

  function closeVisitEditor() {
    if (savingVisit.current) return;
    setAdding(false);
    setEditingVisitId(null);
  }

  function editSelectedVisit() {
    if (!selected) return;
    setSaveError("");
    setEditingVisitId(String(selected.id));
    setEditorReturnTab(tab === "city" ? "city" : "map");
    setCandidate({
      name: selected.name,
      country: selected.country,
      continent: selected.continent,
      lat: selected.lat,
      lng: selected.lng,
      emoji: selected.emoji
    });
    setQuery(selected.name);
    setRatings({ ...selected.ratings });
    setDateFrom(selected.dateFrom);
    setDateTo(selected.dateTo);
    setVisitType(selected.visitType);
    setNote(selected.note);
    setAdding(true);
  }

  async function saveYearlyGoal() {
    const nextGoal = Math.min(999, Math.max(1, Math.round(Number(goalDraft))));
    if (!Number.isFinite(nextGoal)) return;
    setYearlyGoal(nextGoal);
    setGoalDraft(String(nextGoal));
    setEditingGoal(false);
    if (!user) {
      return;
    }
    try {
      await saveStoredYearlyGoal(nextGoal);
      setSyncStatus("saved");
      window.setTimeout(() => setSyncStatus("idle"), 1800);
    } catch {
      setSyncStatus("error");
    }
  }

  async function saveCity() {
    if (savingVisit.current || !candidate || !requiredRatingsComplete || !dateFrom || !dateTo || dateTo < dateFrom) return;
    savingVisit.current = true; setSaveBusy(true); setSaveError("");
    const draftCity = {
      ...candidate,
      rating: draftOverall,
      ratings,
      dateFrom,
      dateTo,
      visitType,
      note
    };
    setSyncStatus("loading");
    try {
      const operationId = visitOperationId.current || (visitOperationId.current = crypto.randomUUID());
      const savedCity = !user ? { ...draftCity, id: editingVisitId || operationId } : editingVisitId
        ? await updateVisit({ ...draftCity, id: editingVisitId } as StoredCity)
        : await createVisit(draftCity as Omit<StoredCity, "id">, operationId);
      if (editingVisitId) {
        setCities(current => current.map(city => String(city.id) === editingVisitId ? savedCity : city));
      } else {
        setCities(current => [savedCity, ...current]);
      }
      setSelected(savedCity);
      setAdding(false);
      setCandidate(null);
      setQuery("");
      setTab(editingVisitId ? editorReturnTab : "map");
      setEditingVisitId(null);
      setSyncStatus("saved");
      window.setTimeout(() => setSyncStatus("idle"), 1800);
    } catch (error) {
      setSyncStatus("error");
      setSaveError(error instanceof Error ? error.message : "The visit could not be saved.");
    } finally { savingVisit.current = false; setSaveBusy(false); }
  }

  async function submitAuth() {
    if (!supabase) {
      setAuthMessage("Account services are temporarily unavailable. You can continue as a guest and try again later.");
      return;
    }
    setAuthBusy(true);
    setAuthMessage("");
    try {
      if (authView === "signup") {
        if (authEmail.trim().toLowerCase() === reviewAccountEmail) {
          const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
          if (error) throw error;
          setAuthMessage("");
          setAuthOpen(false);
          return;
        }
        signupPending.current = true;
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: { data: { display_name: authName }, emailRedirectTo: authRedirectUrl() }
        });
        if (error) { signupPending.current = false; throw error; }
        setOnboardingNotice(data.session ? "Your account is ready." : "Check your email to confirm your account. You can explore and save on this device while you wait.");
        setAuthOpen(false); setEntryStage("cards");
      } else if (authView === "signin") {
        signupPending.current = false;
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
        setAuthOpen(false);
        setEntryStage("done");
      } else if (authView === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(authEmail, { redirectTo: authRedirectUrl() });
        if (error) throw error;
        setAuthMessage("Password reset instructions have been sent if that account exists.");
      } else if (authView === "reset") {
        const { error } = await supabase.auth.updateUser({ password: authPassword });
        if (error) throw error;
        setAuthMessage("Password updated. You can continue using CityLog.");
      }
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function exportMyData() {
    if (!user) return;
    setSyncStatus("loading");
    try {
      const payload = await downloadAccountData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `citylog-data-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setSyncStatus("idle");
    } catch {
      setSyncStatus("error");
    }
  }

  async function removeAccount() {
    if (!supabase || !user) return;
    const confirmed = window.confirm("Permanently delete your account, visits, ratings and notes? This cannot be undone.");
    if (!confirmed) return;
    setSyncStatus("loading");
    const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
    if (error) {
      setSyncStatus("error");
      setAuthMessage(error.message);
      return;
    }
    await supabase.auth.signOut();
    restoreGuest();
    setTab("map");
    setSyncStatus("idle");
  }

  async function removeSelectedVisit() {
    if (!selected) return;
    if (!window.confirm(`Delete this visit to ${selected.name}? Other visits will be kept.`)) return;
    setSyncStatus("loading");
    try {
      if (user) await deleteVisit(String(selected.id));
      setCities(current => current.filter(city => city.id !== selected.id));
      const remaining = storyHistory.filter(city => city.id !== selected.id);
      setSelected(remaining[0] || null);
      setLists(current => current.map(list => ({...list,cityIds:list.cityIds.filter(id=>id!==selected.id)})));
      setManualOrder(current => current?.filter(id=>id!==selected.id) || null);
      if (tab === "city" && !remaining.length) setTab("log");
      setSyncStatus("idle");
    } catch {
      setSyncStatus("error");
    }
  }

  async function addWantToVisit(city: CityOption) {
    const existing = wishlist.find(item => item.name === city.name && item.country === city.country);
    if (!user) {
      setWishlist(current => existing ? current.filter(item => cityIdentity(item) !== cityIdentity(city)) : [...current,{...city,id:crypto.randomUUID()}]);
      return;
    }
    setSyncStatus("loading");
    try {
      if (existing) {
        await removeWishlistCity({ id: existing.id || "", name: existing.name, country: existing.country });
        setWishlist(current => current.filter(item => !(item.name === city.name && item.country === city.country)));
      } else {
        const saved = await addWishlistCity(city);
        setWishlist(current => [...current, saved]);
      }
      setSyncStatus("saved");
      window.setTimeout(() => setSyncStatus("idle"), 1800);
    } catch {
      setSyncStatus("error");
    }
  }

  async function reorderRanking(targetId: CityId) {
    if (draggedCity === null || draggedCity === targetId) return;
    const order = displayedRanked.map(city => city.id);
    const from = order.indexOf(draggedCity);
    const to = order.indexOf(targetId);
    order.splice(to, 0, order.splice(from, 1)[0]);
    setManualOrder(order);
    setDraggedCity(null);
    if (user) {
      try {
        await saveRankingOrder(order.map(String));
      } catch {
        setSyncStatus("error");
      }
    }
  }

  async function moveRankedCity(cityId: CityId, direction: -1 | 1) {
    const order = displayedRanked.map(city => city.id);
    const index = order.indexOf(cityId);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
    setManualOrder(order);
    if (user) try { await saveRankingOrder(order.map(String)); } catch { setSyncStatus("error"); }
  }

  async function createList() {
    const title = newListTitle.trim();
    if (!title) return;
    if (!user) {
      setLists(current => [...current,{id:crypto.randomUUID(),title,cityIds:[]}]);
      setNewListTitle("");
      return;
    }
    setSyncStatus("loading");
    try {
      const saved = await createPersonalList(title, lists.length);
      setLists(current => [...current, saved]);
      setNewListTitle("");
      setSyncStatus("saved");
      window.setTimeout(() => setSyncStatus("idle"), 1800);
    } catch {
      setSyncStatus("error");
    }
  }

  async function moveListCity(listId: CityId, cityId: CityId, direction: -1 | 1) {
    const nextLists = lists.map(list => {
      if (list.id !== listId) return list;
      const cityIds = [...list.cityIds];
      const index = cityIds.indexOf(cityId);
      const next = index + direction;
      if (next < 0 || next >= cityIds.length) return list;
      [cityIds[index], cityIds[next]] = [cityIds[next], cityIds[index]];
      return { ...list, cityIds };
    });
    setLists(nextLists);
    if (user && typeof listId === "string") {
      const list = nextLists.find(item => item.id === listId);
      if (list) try { await savePersonalListCities(listId, list.cityIds.map(String)); } catch { setSyncStatus("error"); }
    }
  }

  async function addCityToList(listId: CityId, cityId: CityId) {
    const nextLists = lists.map(list => list.id === listId && !list.cityIds.includes(cityId) ? { ...list, cityIds: [...list.cityIds, cityId] } : list);
    setLists(nextLists);
    if (user && typeof listId === "string") {
      const list = nextLists.find(item => item.id === listId);
      if (list) try { await savePersonalListCities(listId, list.cityIds.map(String)); } catch { setSyncStatus("error"); }
    }
  }

  async function toggleManualOrder() {
    const next = manualOrder ? null : displayedRanked.map(city => city.id);
    setManualOrder(next);
    if (user) try { await saveRankingOrder(next ? next.map(String) : []); } catch { setSyncStatus("error"); }
  }

  return (
    <main className={`app-shell view-${tab} ${entryStage !== "done" ? "entry-active" : ""} ${adding ? "editor-open" : ""}`}>
      <div className="product-layer" inert={entryStage !== "done" || authOpen || adding} aria-hidden={entryStage !== "done" || undefined}>
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><MapPin size={18}/></span><span>citylog</span></div>
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
          <strong>{citySummaries.length} cities</strong>
          <p>across {new Set(cities.map(c => c.country)).size} countries</p>
          <div className="progress"><span style={{ width: `${goalProgress}%` }}/></div>
          <small>{goalProgress}% of your {currentYear} goal</small>
        </div>
        <button className="avatar-row account-entry" onClick={() => user ? setTab("profile") : setAuthOpen(true)}>
          <span className="avatar">{user ? (user.user_metadata?.display_name || user.email || "U").slice(0, 2).toUpperCase() : "?"}</span>
          <span><strong>{user ? user.user_metadata?.display_name || "My account" : "Create an account"}</strong><small>{user ? syncStatus === "loading" ? "Syncing…" : "Private · synced" : "Save and sync your travels"}</small></span>
        </button>
      </aside>

      <section className="main-pane">
        {!user && guestStorageError && <div className="guest-import" role="alert">{guestStorageError}</div>}
        {user && guestImportAvailable && entryStage === "done" && <div className="guest-import"><span>Your guest journal is still on this device.</span><button disabled={saveBusy} onClick={importGuestJournal}>{saveBusy?"Saving…":"Save it to my account →"}</button>{saveError&&<p role="alert">{saveError}</p>}</div>}
        <header className="topbar">
          <div>
            {nativeMode && tab === "map" && <div className="native-only native-map-brand"><span className="brand-mark"><MapPin size={18}/></span><span>citylog</span></div>}
            <p className="kicker">{tab === "map" ? "YOUR TRAVEL MAP" : tab === "rankings" ? "YOUR FAVOURITES" : tab === "log" ? "YOUR TRAVEL LOG" : tab === "compare" ? "CITY HEAD TO HEAD" : tab === "lists" ? "YOUR COLLECTIONS" : "YOUR JOURNEY"}</p>
            <h1>{tab === "map" ? "The world, according to you." : tab === "rankings" ? "Cities worth returning to." : tab === "log" ? "Every trip, in order." : tab === "compare" ? "How do your cities compare?" : tab === "lists" ? "Save places your way." : "A life well travelled."}</h1>
          </div>
          <div className="top-actions">
            {!user && <button className="account-btn" onClick={() => { setAuthView("welcome"); setAuthOpen(true); }}>Sign in</button>}
            <button className="primary-btn" onClick={openAddCity}><Plus/>Log a city</button>
          </div>
        </header>

        {tab === "map" && (
          <>
            <div className="control-row">
              {nativeMode ? <div className="compact-categories">
                <button className={category === "Overall" ? "active" : ""} onClick={() => setCategory("Overall")}>Overall</button>
                <label className="category-select"><span className="sr-only">Map rating category</span><select aria-label="Map rating category" value={category === "Overall" ? "" : category} onChange={event => setCategory(event.target.value || "Overall")}><option value="">Categories</option>{categories.slice(1).map(item=><option key={item}>{item}</option>)}</select><ChevronDown/></label>
              </div> : <div className="segmented">{categories.map(item=><button key={item} className={category===item?"active":""} onClick={()=>setCategory(item)}>{item}</button>)}</div>}
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
              <div className="map-legend"><span>0</span>{["#CD554F","#E28A43","#D4B849","#62A461","#236844"].map(c => <i key={c} style={{ background: c }}/>) }<span>4.5+</span><i className="purple-key"/><span>Want to visit</span></div>
              {selected && filtered.some(c => c.id === selected.id) && (
                <article className="city-preview">
                  <button className="close-btn" onClick={() => setSelected(null)} aria-label="Close"><X/></button>
                  <div className="preview-copy">
                    <p className="city-meta">{selected.country}</p>
                    <div className="preview-title"><h2>{selected.name}</h2><strong style={{color:colorForScore(selected.rating)}}>{selected.rating.toFixed(1)} ★</strong></div>
                    {selected.note && <p className="preview-note">{selected.note}</p>}
                    <div className="preview-actions">
                      <button className="text-btn" onClick={()=>setTab("city")}>View City Story <span>→</span></button>
                    </div>
                  </div>
                </article>
              )}
              {!citySummaries.length && syncStatus !== "loading" && <div className="map-empty"><p className="kicker">YOUR STORY STARTS SOMEWHERE</p><h2>What city comes to mind?</h2><p>One place. One memory. The beginning of your map.</p><button className="primary-btn" onClick={openAddCity}><Plus/>Log your first city</button></div>}
            </div>
          </>
        )}

        {tab === "rankings" && (
          <div className="rankings-layout">
            <div className="rankings-head">
              <div className="segmented">{categories.map(item => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
              <button className="filter-btn" onClick={() => nativeMode ? setFilterOpen(!filterOpen) : toggleManualOrder()}>
                {nativeMode ? <><SlidersHorizontal/>Filters{continent !== "All" && <span className="filter-dot"/>}</> : <><ListFilter/>{manualOrder ? "Custom order · Reset" : "Drag to reorder"}<ChevronDown/></>}
              </button>
              {nativeMode && filterOpen && <div className="filter-popover">
                <label>Continent</label>
                <select value={continent} onChange={event => setContinent(event.target.value)}>
                  {["All", "Europe", "Asia", "Africa", "North America", "South America", "Oceania"].map(item => <option key={item}>{item}</option>)}
                </select>
              </div>}
            </div>
            <div className="ranking-list">
              {displayedRanked.map((city, index) => (
                <div className={`rank-row ${draggedCity === city.id ? "dragging" : ""}`} key={city.id} draggable onDragStart={() => setDraggedCity(city.id)} onDragOver={event => event.preventDefault()} onDrop={() => reorderRanking(city.id)}>
                  <GripVertical className="drag-handle" aria-label="Drag to reorder"/>
                  <span className={`rank-number ${index < 3 ? "top" : ""}`}>{index + 1}</span>
                  <span className="rank-flag">{city.emoji}</span>
                  <button className="rank-main rank-city-link" onClick={() => { setSelected(city); setTab("city"); }}><strong>{city.name}</strong><small>{city.country} · {formatVisitDate(city.dateFrom, city.dateTo)}</small></button>
                  <span className="rank-rating"><strong>{(scoreFor(city, category) || 0).toFixed(1)}</strong><Star fill={colorForScore(scoreFor(city, category) || 0)} color={colorForScore(scoreFor(city, category) || 0)}/></span>
                  <span className="rank-bar"><i style={{ width: `${(scoreFor(city, category) || 0) * 20}%`, background: colorForScore(scoreFor(city, category) || 0) }}/></span>
                  <span className="rank-order-buttons native-only"><button disabled={index === 0} onClick={() => moveRankedCity(city.id, -1)} aria-label={`Move ${city.name} up`}>↑</button><button disabled={index === displayedRanked.length - 1} onClick={() => moveRankedCity(city.id, 1)} aria-label={`Move ${city.name} down`}>↓</button></span>
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
                <button key={city.id} className="log-entry" onClick={() => { setSelected(city); setTab("city"); }}>
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

        {tab === "city" && selected && currentCity && (
          <div className="city-detail-layout">
            <div className="story-navigation"><button className="city-detail-back" onClick={() => {setSelected(currentCity);setTab("map");}}><ArrowLeft/>Your map</button><span>{storyHistory.length} {storyHistory.length===1?"visit":"visits"} · A story still being written</span></div>
            <article className="city-detail-card">
              <header>
                <div><p className="kicker">CITY STORY · {selected.country.toUpperCase()}</p><h2>{selected.name}</h2><small>{selected.continent} · {displayedRanked.findIndex(city=>cityIdentity(city)===cityIdentity(selected))>=0 ? `#${displayedRanked.findIndex(city=>cityIdentity(city)===cityIdentity(selected))+1} in your current ranking` : "Your personal perspective"}</small></div>
                <div className="story-overall"><strong style={{ color: colorForScore(currentCity.rating) }}>{currentCity.rating.toFixed(1)}<span> / 5</span></strong><small>Latest visit · overall</small></div>
              </header>
              {selected.photoUrl && <img className="story-photo" src={selected.photoUrl} alt={`${selected.name}, from your visit`} />}
              <div className="story-columns"><section className="story-current"><div className="story-section-title"><p className="kicker">{selected.id===currentCity.id?"CURRENT CITY LOG":"PAST VISIT"}</p>{selected.id!==currentCity.id&&<button className="text-btn" onClick={()=>setSelected(currentCity)}>Latest visit →</button>}</div><h3>{formatVisitDate(selected.dateFrom, selected.dateTo)}</h3><p className="story-visit-type">{selected.visitType || "Personal visit"} · {selected.rating.toFixed(1)} ★</p>
              <div className="city-detail-ratings">
                {[...requiredRatingKeys, ...optionalRatingKeys].map(key => selected.ratings[key] !== null && (
                  <div key={key}><span>{key === "personal" ? "Personal experience" : key}</span><b>{selected.ratings[key]?.toFixed(1)}</b><i><span style={{ width: `${(selected.ratings[key] || 0) * 20}%`, background: colorForScore(selected.ratings[key] || 0) }}/></i></div>
                ))}
              </div>
              <section className="story-memory"><p className="kicker">YOUR MEMORY</p><p>{selected.note || "There’s more to this story. Add a memory when you’re ready."}</p></section>
              <div className="city-detail-actions">
                <button className="visit-action edit" onClick={editSelectedVisit}><Pencil/>Edit visit</button>
                <button className="visit-action delete" onClick={removeSelectedVisit}><X/>Delete</button>
              </div></section><section className="story-history"><div className="story-section-title"><p className="kicker">LOG HISTORY</p><span>{storyHistory.length} entries</span></div><div className="history-timeline">{storyHistory.map(visit=><button key={visit.id} className={`history-entry ${visit.id===selected.id?"active":""}`} onClick={()=>setSelected(visit)}><i style={{background:colorForScore(visit.rating)}}/><span><strong>{new Intl.DateTimeFormat("en-GB",{month:"long",year:"numeric"}).format(new Date(`${visit.dateFrom}T12:00:00`))}</strong><small>{visit.visitType || "Visit"}</small>{visit.note&&<p>{visit.note}</p>}</span><b>{visit.rating.toFixed(1)} ★</b></button>)}</div><button className="primary-btn" onClick={()=>{beginAdd(currentCity);setEditorReturnTab("city");setAdding(true);}}><Plus/>Log another visit</button><p className="history-hint">A new visit adds to your story. Earlier memories stay here.</p></section></div>
            </article>
          </div>
        )}

        {tab === "compare" && (
          <div className="compare-layout">
            <section className="compare-section standalone-section">
              <div className="section-heading"><span><GitCompareArrows/></span><div><p className="kicker">COMPARE CITIES</p><h2>Head to head</h2></div></div>
              <div className="compare-pickers">
                {[0, 1].map(index => (
                  <select key={index} aria-label={`Compare city ${index + 1}`} value={String(compared[index]?.id || "")} onChange={event => setCompareIds(current => {
                    const next: [CityId, CityId] = [...current];
                    next[index] = event.target.value;
                    return next;
                  })}>
                    {citySummaries.map(city => <option key={city.id} value={city.id}>{city.name}, {city.country}</option>)}
                  </select>
                ))}
              </div>
              <div className="compare-grid">
                {compared.map((city, index) => (
                  <article key={`${city.id}-${index}`}>
                    <span className="compare-flag">{city.emoji}</span><h3>{city.name}</h3><small>{city.country}</small>
                    <strong style={{ color: colorForScore(city.rating) }}>{city.rating.toFixed(1)}</strong>
                    <div className="compare-ratings">{[...requiredRatingKeys,...optionalRatingKeys].map(key => <p key={key}><span>{key === "personal" ? "Experience" : key}</span><b>{city.ratings[key]?.toFixed(1) || "—"}</b></p>)}</div>
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
                <div><span className="list-icon"><Heart fill="currentColor"/></span><span><h3>Want to Visit</h3><small>{wishlist.length} saved cities · purple on your map</small></span><button className="native-only want-add-city" onClick={openAddCity}><Plus/>Add city</button></div>
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
                      const city = cities.find(candidate => String(candidate.id) === event.target.value);
                      if (city) addCityToList(list.id, city.id);
                    }}><option value="">+ Add a city</option>{citySummaries.filter(city => !list.cityIds.some(id => cities.some(visit => visit.id===id && cityIdentity(visit)===cityIdentity(city)))).map(city => <option key={city.id} value={city.id}>{city.name}</option>)}</select>
                  </div>
                </article>
              ))}
              <div className="new-list"><input aria-label="New list title" value={newListTitle} onChange={event => setNewListTitle(event.target.value)} onKeyDown={event => { if (event.key === "Enter") createList(); }} placeholder="Name a new list, e.g. Best food cities"/><button onClick={createList}><Plus/>Create list</button></div>
              <section className="native-only native-compare">
                <div className="section-heading"><span><GitCompareArrows/></span><div><p className="kicker">COMPARE CITIES</p><h2>Head to head</h2></div></div>
                <div className="compare-pickers">
                  {[0, 1].map(index => (
                    <select key={index} aria-label={`Compare city ${index + 1}`} value={String(compared[index]?.id || "")} onChange={event => setCompareIds(current => {
                      const next: [CityId, CityId] = [...current];
                      next[index] = event.target.value;
                      return next;
                    })}>
                      {citySummaries.map(city => <option key={city.id} value={city.id}>{city.name}, {city.country}</option>)}
                    </select>
                  ))}
                </div>
                <div className="compare-grid">
                  {compared.map((city, index) => (
                    <article key={`native-${city.id}-${index}`}>
                      <span className="compare-flag">{city.emoji}</span><h3>{city.name}</h3><small>{city.country}</small>
                      <strong style={{ color: colorForScore(city.rating) }}>{city.rating.toFixed(1)}</strong>
                      <div className="compare-ratings">{[...requiredRatingKeys,...optionalRatingKeys].map(key => <p key={key}><span>{key === "personal" ? "Experience" : key}</span><b>{city.ratings[key]?.toFixed(1) || "—"}</b></p>)}</div>
                    </article>
                  ))}
                </div>
              </section>
            </section>
          </div>
        )}

        {tab === "profile" && (
          <div className="profile-layout">
            <div className="profile-hero">
              <span className="profile-avatar">{profileName.slice(0, 2).toUpperCase()}</span>
              <div><p className="kicker">TRAVEL JOURNAL</p><h2>{profileName}</h2><p>Collecting places, not things.</p></div>
            </div>
            <div className="stats-grid">
              <article><MapPin/><strong>{citySummaries.length}</strong><span>Cities logged</span></article>
              <article><Compass/><strong>{new Set(cities.map(c => c.country)).size}</strong><span>Countries</span></article>
              <article><Star/><strong>{citySummaries.length ? (citySummaries.reduce((a,c) => a + c.rating, 0) / citySummaries.length).toFixed(1) : "—"}</strong><span>Average rating</span></article>
            </div>
            <article className="insight-card"><span className="insight-icon"><Sparkles/></span><div><p className="kicker">YOUR TRAVEL STORY</p><h3>{cities.length ? `${cities.length} memories. Still more to discover.` : "Your next chapter starts with a city."}</h3><p>Your ratings and memories build a picture of what matters to you.</p></div></article>
            <div className="year-card">
              <div>
                <p className="kicker">{currentYear} TRAVEL GOAL</p>
                <h3>{citiesThisYear} of {yearlyGoal} cities this year</h3>
              </div>
              <div className="goal-actions">
                <span>{goalProgress}%</span>
                <button className="edit-goal-btn" onClick={() => setEditingGoal(true)}><Pencil/>Edit goal</button>
              </div>
              <div className="wide-progress"><i style={{width:`${goalProgress}%`}}/></div>
              {editingGoal && (
                <form className="goal-editor" onSubmit={event => { event.preventDefault(); saveYearlyGoal(); }}>
                  <label htmlFor="yearly-city-goal">How many cities do you want to visit in {currentYear}?</label>
                  <div>
                    <input id="yearly-city-goal" type="number" min="1" max="999" value={goalDraft} onChange={event => setGoalDraft(event.target.value)}/>
                    <button type="submit">Save goal</button>
                    <button type="button" onClick={() => { setGoalDraft(String(yearlyGoal)); setEditingGoal(false); }}>Cancel</button>
                  </div>
                </form>
              )}
            </div>
            <section className="account-settings">
              <p className="kicker">ACCOUNT & PRIVACY</p>
              <button className="replay-onboarding" onClick={()=>{setOnboardingNotice("");setEntryStage("cards");}}>Replay the CityLog introduction <span>→</span></button>
              {user ? <>
                <h3>{user.email}</h3>
                <p>Your cities, ratings and notes are private and accessible only to this account.</p>
                <div className="settings-actions">
                  <button onClick={exportMyData}>Download My Data</button>
                  <a href={publicPageUrl("/support")} target={nativeMode ? "_blank" : undefined} rel={nativeMode ? "noreferrer" : undefined}>Support</a>
                  <a href={publicPageUrl("/privacy")} target={nativeMode ? "_blank" : undefined} rel={nativeMode ? "noreferrer" : undefined}>Privacy Policy</a>
                  <a href={publicPageUrl("/terms")} target={nativeMode ? "_blank" : undefined} rel={nativeMode ? "noreferrer" : undefined}>Terms of Use</a>
                  <button onClick={() => supabase?.auth.signOut()}>Sign out</button>
                  <button className="danger" onClick={removeAccount}>Delete Account</button>
                </div>
              </> : <>
                <h3>Keep your travel history safe.</h3>
                <p>Your guest journal is saved on this device. Create an account for cloud backup and access on other devices. Clearing browser or app data removes guest entries.</p>
                <button className="primary-btn" onClick={() => setAuthOpen(true)}>Create account or sign in</button>
                <div className="settings-actions"><a href={publicPageUrl("/support")}>Support</a><a href={publicPageUrl("/privacy")}>Privacy Policy</a><a href={publicPageUrl("/terms")}>Terms of Use</a></div>
              </>}
            </section>
          </div>
        )}
        {tab !== "map" && tab !== "profile" && tab !== "city" && tab !== "lists" && !cities.length && <div className="journal-empty"><MapIcon/><h2>A world of possibilities.</h2><p>Log a city to start your personal record, compare experiences and find your favourites.</p><button className="primary-btn" onClick={openAddCity}><Plus/>Log a city</button></div>}
      </section>

      <nav className="mobile-nav" aria-label="Primary">
        <button className={tab === "map" ? "active" : ""} onClick={() => setTab("map")}><MapIcon/><span>Map</span></button>
        <button className={tab === "rankings" ? "active" : ""} onClick={() => setTab("rankings")}><Trophy/><span>Rankings</span></button>
        <button className="add-mobile" aria-label="Log a city" onClick={openAddCity}><Plus/></button>
        <button className={tab === "log" || tab === "city" ? "active" : ""} onClick={() => setTab("log")}><BookOpen/><span>Log</span></button>
        <button className={`compare-tab ${tab === "compare" ? "active" : ""}`} onClick={() => setTab("compare")}><GitCompareArrows/><span>Compare</span></button>
        <button className={tab === "lists" ? "active" : ""} onClick={() => setTab("lists")}><ListPlus/><span>Lists</span></button>
        <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}><UserRound/><span>Profile</span></button>
      </nav>
      </div>

      <Onboarding stage={entryStage} onStage={setEntryStage} notice={onboardingNotice} onGuest={enterGuest} onComplete={finishOnboarding} onAuth={mode=>{setAuthView(mode);setAuthMessage("");setAuthOpen(true);}}/>

      {adding && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) closeVisitEditor(); }}>
          <section className="add-modal" role="dialog" aria-modal="true" aria-labelledby="add-title">
            <div className="modal-head">
              <button className="back-btn" onClick={() => editingVisitId ? closeVisitEditor() : candidate ? setCandidate(null) : closeVisitEditor()}><ArrowLeft/></button>
              <div><p className="kicker">{editingVisitId ? "EDIT MEMORY" : "NEW MEMORY"}</p><h2 id="add-title">{candidate ? editingVisitId ? `Update ${candidate.name}` : `How was ${candidate.name}?` : "Where have you been?"}</h2></div>
              <button className="close-btn static" onClick={closeVisitEditor}><X/></button>
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
                {saveError && <p className="auth-message" role="alert">{saveError}</p>}
                {!user && <p className="guest-save-note">Saved on this device. You can move your journal to an account later.</p>}
                <button className="save-btn" disabled={saveBusy || !requiredRatingsComplete || !dateFrom || !dateTo || dateTo < dateFrom} onClick={saveCity}>{saveBusy ? "Saving your visit…" : editingVisitId ? <><Check/>Save changes · {draftOverall.toFixed(1)}</> : <><MapPin/>Add to my map · {draftOverall.toFixed(1)}</>}</button>
              </div>
            )}
          </section>
        </div>
      )}

      {authOpen && (
        <div className="modal-backdrop auth-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setAuthOpen(false); }}>
          <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button className="close-btn static auth-close" onClick={() => setAuthOpen(false)} aria-label="Close account dialog"><X/></button>
            {authView === "welcome" ? <>
              <span className="auth-mark"><MapPin/></span>
              <p className="kicker">WELCOME TO CITYLOG</p>
              <h2 id="auth-title">Your travels, saved for good.</h2>
              <p>Explore the app first. When you’re ready, create a private account to save visits and sync them across devices.</p>
              {authMessage && <p className="auth-message">{authMessage}</p>}
              {!isSupabaseConfigured && <p className="config-note">Cloud accounts are ready in the code but this preview still needs its Supabase project keys.</p>}
              <button className="save-btn" onClick={() => { setAuthView("signup"); setAuthMessage(""); }}>Create free account</button>
              <button className="account-btn wide" onClick={() => { setAuthView("signin"); setAuthMessage(""); }}>I already have an account</button>
              <p className="legal-copy">By creating an account, you agree to the <a href={publicPageUrl("/terms")} target={nativeMode ? "_blank" : undefined} rel={nativeMode ? "noreferrer" : undefined}>Terms</a> and acknowledge the <a href={publicPageUrl("/privacy")} target={nativeMode ? "_blank" : undefined} rel={nativeMode ? "noreferrer" : undefined}>Privacy Policy</a>.</p>
            </> : <>
              <button className="auth-back" onClick={() => { setAuthView("welcome"); setAuthMessage(""); }}><ArrowLeft/>Back</button>
              <p className="kicker">{authView === "signup" ? "CREATE ACCOUNT" : authView === "signin" ? "WELCOME BACK" : authView === "forgot" ? "RESET PASSWORD" : "CHOOSE A NEW PASSWORD"}</p>
              <h2 id="auth-title">{authView === "signup" ? "Start your private travel log." : authView === "signin" ? "Sign in to CityLog." : authView === "forgot" ? "Check your inbox next." : "Secure your account."}</h2>
              {authView === "signup" && <label className="auth-field"><span>Display name <small>OPTIONAL</small></span><input value={authName} onChange={event => setAuthName(event.target.value)} autoComplete="name"/></label>}
              {authView !== "reset" && <label className="auth-field"><span>Email</span><input type="email" value={authEmail} onChange={event => setAuthEmail(event.target.value)} autoComplete="email"/></label>}
              {authView !== "forgot" && <label className="auth-field"><span>Password</span><input type="password" minLength={8} value={authPassword} onChange={event => setAuthPassword(event.target.value)} autoComplete={authView === "signin" ? "current-password" : "new-password"}/></label>}
              {authMessage && <p className="auth-message">{authMessage}</p>}
              {authView === "signup" && authEmail.trim().toLowerCase() === reviewAccountEmail && <p className="config-note">This is the pre-confirmed App Review account. Continue to sign in directly—no email verification is required.</p>}
              <button className="save-btn" disabled={authBusy || (authView !== "reset" && !authEmail) || (authView !== "forgot" && authPassword.length < 8)} onClick={submitAuth}>{authBusy ? "Please wait…" : authView === "signup" && authEmail.trim().toLowerCase() === reviewAccountEmail ? "Open review account" : authView === "signup" ? "Create account" : authView === "signin" ? "Sign in" : authView === "forgot" ? "Send reset email" : "Update password"}</button>
              {authView === "signin" && <button className="forgot-link" onClick={() => { setAuthView("forgot"); setAuthMessage(""); }}>Forgotten your password?</button>}
              {authView === "signup" && <p className="legal-copy">Your account is private. Read our <a href={publicPageUrl("/privacy")} target={nativeMode ? "_blank" : undefined} rel={nativeMode ? "noreferrer" : undefined}>Privacy Policy</a>, <a href={publicPageUrl("/terms")} target={nativeMode ? "_blank" : undefined} rel={nativeMode ? "noreferrer" : undefined}>Terms</a> and <a href={publicPageUrl("/support")} target={nativeMode ? "_blank" : undefined} rel={nativeMode ? "noreferrer" : undefined}>Support</a>.</p>}
            </>}
          </section>
        </div>
      )}
      {authReady && entryStage === "done" && syncStatus !== "idle" && <div role="status" className={`sync-toast ${syncStatus}`}>{syncStatus === "loading" ? "Saving your travels…" : syncStatus === "saved" ? user ? "Saved to your account" : "Saved on this device" : "Could not sync. Please try again."}</div>}
    </main>
  );
}
